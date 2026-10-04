import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { normalizedEvent, validateNormalizedEvent, type IngestEnvelope, type QueueEvent, type QueueStateName } from "./contracts.js";
import { atomicWrite } from "./atomic-file.js";
import { runtimeSecrets } from "./runtime-secrets.js";

import { applyExport, emptyExportLedger, validateExportLedger, type ExportLedger, type AcquiredExport } from "./export-ledger.js";

export type PreparedBatch = { reference: string; body: string; identities: string[]; attempts: number; nextAttemptAt: number; held?: boolean; sourceReviewRequired?: boolean };
type State = { version: 1; events: QueueEvent[]; batch?: PreparedBatch; retired?: Record<string, string>; exports?: ExportLedger; exportScan?: number };
const PENDING = new Set<QueueStateName>(["RECEIVED_FROM_DEVICE", "QUEUED", "SENDING"]);
const ACKED = new Set<QueueStateName>(["ACKNOWLEDGED", "DUPLICATE_ACKNOWLEDGED"]);
const STATES = new Set<QueueStateName>([...PENDING, ...ACKED, "REJECTED", "NEEDS_ADMIN_REVIEW"]);

export class EncryptedDurableQueue {
  private readonly key: Buffer;
  constructor(private readonly file: string, encodedKey = runtimeSecrets()?.queueKey ?? process.env.NALANDA_BIOMETRIC_QUEUE_KEY, private readonly maxBytes = 32 * 1024 * 1024, private readonly write = atomicWrite) {
    this.key = Buffer.from(String(encodedKey ?? ""), "base64url");
    if (this.key.length !== 32) throw new Error("BRIDGE_QUEUE_KEY_REQUIRED");
  }
  private state(): State {
    if (!existsSync(this.file)) return { version: 1, events: [] };
    try {
      const stat = statSync(this.file);
      if (!stat.isFile() || stat.size > 48 * 1024 * 1024) throw new Error();
      const envelope = JSON.parse(readFileSync(this.file, "utf8"));
      if (envelope.version !== 1) throw new Error();
      const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(envelope.iv, "base64url"));
      decipher.setAAD(Buffer.from("nalanda-biometric-queue-v1")); decipher.setAuthTag(Buffer.from(envelope.tag, "base64url"));
      const plaintext = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64url")), decipher.final()]);
      if (plaintext.byteLength > this.maxBytes) throw new Error();
      const state = JSON.parse(plaintext.toString("utf8")) as State;
      if (state.version !== 1 || !Array.isArray(state.events) || state.events.length > 100_000) throw new Error();
      if (state.retired && (Object.keys(state.retired).length > 100_000 || Object.entries(state.retired).some(([id, hash]) => id.length > 400 || typeof hash !== "string" || !/^[a-f0-9]{64}$/.test(hash)))) throw new Error();
      if (state.exports) validateExportLedger(state.exports);
      if (state.exportScan !== undefined && (!Number.isSafeInteger(state.exportScan) || state.exportScan < 0 || state.exportScan > 255)) throw new Error();
      for (const event of state.events) {
        validateNormalizedEvent(event);
        if (!STATES.has(event.localState) || !Number.isSafeInteger(event.attemptCount) || event.attemptCount < 0 || typeof event.queuedAt !== "string" || Number.isNaN(Date.parse(event.queuedAt))) throw new Error();
      }
      if (state.batch) {
        const b = state.batch, body = JSON.parse(b.body) as IngestEnvelope;
        if (body.schemaVersion !== 1 || body.batchReference !== b.reference || !Array.isArray(b.identities) || b.identities.length < 1 || b.identities.length > 100 || body.events.length !== b.identities.length || !Number.isSafeInteger(b.attempts) || b.attempts < 0 || !Number.isFinite(b.nextAttemptAt)) throw new Error();
        body.events.forEach(validateNormalizedEvent);
        if (JSON.stringify(body.events.map(queueIdentity)) !== JSON.stringify(b.identities) || b.identities.some(id => !state.events.some(e => queueIdentity(e) === id && !ACKED.has(e.localState)))) throw new Error();
      }
      return state;
    } catch { throw new Error("BRIDGE_QUEUE_AUTH_OR_CORRUPTION_FAILED"); }
  }
  load() { return this.state().events; }
  exportLedger() { return this.state().exports ?? emptyExportLedger(); }
  exportScan() { return this.state().exportScan ?? 0; }
  setExportScan(value: number) { const state=this.state(); state.exportScan=value; this.save(state); }
  recordExportRefusal(sourceKey:string,code?:string) {
    const state=this.state(); state.exports??=emptyExportLedger(); state.exports.refusals??={};
    if (code) { if (state.exports.refusals[sourceKey]?.code===code) return; state.exports.refusals[sourceKey]={code,observedAt:new Date().toISOString()}; }
    else { if (!state.exports.refusals[sourceKey]) return; delete state.exports.refusals[sourceKey]; }
    validateExportLedger(state.exports); this.save(state);
  }
  commitExport(snapshot: AcquiredExport) {
    const state=this.state(); state.exports ??= emptyExportLedger();
    const result=applyExport(state.exports,state.events,snapshot);
    if (state.events.length>100_000) throw new Error("BRIDGE_QUEUE_CAPACITY_EXCEEDED");
    if (result.changed) {
      if (state.batch && state.events.some(e=>state.batch!.identities.includes(queueIdentity(e)) && !!e.eventReference && !!result.conflictReferences?.has(e.eventReference))) { state.batch.held=true; state.batch.sourceReviewRequired=true; }
      this.save(state);
    }
    return result;
  }
  append(events: QueueEvent[]) {
    const state = this.state();
    // Preserve first-observation semantics with a bounded linear identity index.
    // Repeated linear scans made large durable imports quadratic.
    const byIdentity=new Map<string,QueueEvent>();
    for(const event of state.events)if(!byIdentity.has(queueIdentity(event)))byIdentity.set(queueIdentity(event),event);
    const push=(event:QueueEvent)=>{state.events.push(event);const identity=queueIdentity(event);if(!byIdentity.has(identity))byIdentity.set(identity,event);};
    for (const raw of events) {
      const event = normalizedEvent(raw);
      if (event.sequenceNumber === null && !event.eventReference) {
        // Preserve every observation. A reviewer must distinguish repeated downloads from valid same-second punches.
        push({ ...event, queuedAt: raw.queuedAt, localState: "NEEDS_ADMIN_REVIEW", attemptCount: 0, lastErrorCode: "DEVICE_IDENTITY_AMBIGUOUS" });
        continue;
      }
      const identity = queueIdentity(event), existing = byIdentity.get(identity);
      const retiredHash = state.retired?.[identity];
      if (!existing && retiredHash) {
        if (retiredHash !== payloadHash(event)) push({ ...event, queuedAt: raw.queuedAt, localState: "NEEDS_ADMIN_REVIEW", attemptCount: 0, lastErrorCode: "DEVICE_RETIRED_IDENTITY_CONFLICT", reviewReference: payloadHash(event) } as QueueEvent);
        continue;
      }
      if (existing) {
        if (devicePayload(existing) !== devicePayload(event)) {
          const reviewReference = createHash("sha256").update(devicePayload(event)).digest("hex");
          if (!state.events.some(e => (e as QueueEvent & { reviewReference?: string }).reviewReference === reviewReference)) push({ ...event, queuedAt: raw.queuedAt, localState: "NEEDS_ADMIN_REVIEW", attemptCount: 0, lastErrorCode: "DEVICE_IDENTITY_PAYLOAD_CONFLICT", reviewReference } as QueueEvent);
        }
        continue;
      }
      push({ ...event, queuedAt: raw.queuedAt, localState: event.sequenceNumber === null && !event.eventReference ? "NEEDS_ADMIN_REVIEW" : "QUEUED", attemptCount: 0, ...(event.sequenceNumber === null && !event.eventReference ? { lastErrorCode: "DEVICE_IDENTITY_AMBIGUOUS" } : {}) });
    }
    if (state.events.length > 100_000) throw new Error("BRIDGE_QUEUE_CAPACITY_EXCEEDED");
    if (events.length) this.save(state);
  }
  prepareBatch(): PreparedBatch | undefined {
    const state = this.state();
    if (state.batch) return state.batch.held || state.batch.nextAttemptAt > Date.now() ? undefined : state.batch;
    const events = state.events.filter(e => PENDING.has(e.localState) && !("reviewReference" in e)).slice(0, 100);
    if (!events.length) return;
    const reference = `bridge-${randomUUID()}`;
    const body = JSON.stringify({ schemaVersion: 1, batchReference: reference, bridgeTime: new Date().toISOString(), events: events.map(normalizedEvent) } satisfies IngestEnvelope);
    state.batch = { reference, body, identities: events.map(queueIdentity), attempts: 0, nextAttemptAt: 0 };
    this.save(state); return state.batch;
  }
  batchFailed(code: string) {
    const state = this.state(), b = state.batch;
    if (!b) throw new Error("BRIDGE_QUEUE_BATCH_MISSING");
    b.attempts++; b.nextAttemptAt = Date.now() + Math.min(300_000, 5_000 * 2 ** Math.min(b.attempts - 1, 6));
    b.held = b.attempts >= 20 || /ACK_INVALID|REVOKED|NOT_REGISTERED|CHANGED_|SCHEMA|PROFILE/.test(code);
    state.events = state.events.map(e => b.identities.includes(queueIdentity(e)) && !("reviewReference" in e) ? { ...e, localState: b.held ? "NEEDS_ADMIN_REVIEW" : "QUEUED", attemptCount: b.attempts, lastErrorCode: code } : e);
    this.save(state);
  }
  confirmBatch(reference: string, duplicate: boolean) {
    const state = this.state(), b = state.batch;
    if (!b || b.reference !== reference) throw new Error("BRIDGE_QUEUE_ACK_INVALID");
    state.events = state.events.map(e => b.identities.includes(queueIdentity(e)) && !("reviewReference" in e) ? { ...e, localState: duplicate ? "DUPLICATE_ACKNOWLEDGED" : "ACKNOWLEDGED", acknowledgedAt: new Date().toISOString(), lastErrorCode: undefined } : e);
    delete state.batch; this.save(state);
  }
  resumeHeldBatch() {
    const state = this.state(), b = state.batch;
    if (!b?.held) throw new Error("BRIDGE_QUEUE_HELD_BATCH_REQUIRED");
    if (b.sourceReviewRequired) throw new Error("BRIDGE_QUEUE_SOURCE_REVIEW_REQUIRED");
    // Administrator explicitly revalidates transport/credential gates before this local operation.
    // Never rebuild the request body or reset identity/arrival timestamps.
    b.held = false; b.attempts = 0; b.nextAttemptAt = 0;
    state.events = state.events.map(e => b.identities.includes(queueIdentity(e)) && !("reviewReference" in e) ? { ...e, localState: "QUEUED", attemptCount: 0, lastErrorCode: undefined } : e);
    this.save(state);
  }
  peek(limit = 100) { return this.load().filter(e => PENDING.has(e.localState)).slice(0, Math.max(1, Math.min(100, limit))); }
  markSending(count: number) { this.transition(count, e => ({ ...e, localState: "SENDING", attemptCount: e.attemptCount + 1 })); }
  acknowledge(count: number, duplicate = false) { this.transition(count, e => ({ ...e, localState: duplicate ? "DUPLICATE_ACKNOWLEDGED" : "ACKNOWLEDGED", acknowledgedAt: new Date().toISOString() })); }
  markSendFailed(count: number, code: string) { this.transition(count, e => ({ ...e, localState: "NEEDS_ADMIN_REVIEW", lastErrorCode: code })); }
  size() { return this.load().filter(e => !ACKED.has(e.localState)).length; }
  history() { return this.load().filter(e => !PENDING.has(e.localState)); }
  private transition(count: number, fn: (e: QueueEvent) => QueueEvent) {
    const state = this.state(); if (state.batch) throw new Error("BRIDGE_QUEUE_BATCH_ACTIVE");
    const selected = state.events.filter(e => PENDING.has(e.localState)).slice(0, count);
    if (!Number.isInteger(count) || count < 0 || selected.length !== count) throw new Error("BRIDGE_QUEUE_ACK_INVALID");
    const selection=new Set(selected);
    state.events = state.events.map(e => selection.has(e) ? fn(e) : e); this.save(state);
  }
  private save(state: State) {
    const cutoff = Date.now() - 7 * 86_400_000;
    const acked = state.events.filter(e => ACKED.has(e.localState) && Date.parse(e.acknowledgedAt ?? "") >= cutoff).slice(-1_000);
    state.retired ??= {};
    for (const event of state.events) if (ACKED.has(event.localState) && !acked.includes(event)) state.retired[queueIdentity(event)] = payloadHash(event);
    if (Object.keys(state.retired).length > 100_000) throw new Error("BRIDGE_QUEUE_CAPACITY_EXCEEDED");
    state.events = [...state.events.filter(e => !ACKED.has(e.localState)), ...acked];
    const plain = Buffer.from(JSON.stringify(state));
    if (plain.length > this.maxBytes) throw new Error("BRIDGE_QUEUE_CAPACITY_EXCEEDED");
    const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", this.key, iv);
    cipher.setAAD(Buffer.from("nalanda-biometric-queue-v1"));
    const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
    this.write(this.file, JSON.stringify({ version: 1, iv: iv.toString("base64url"), tag: cipher.getAuthTag().toString("base64url"), ciphertext: ciphertext.toString("base64url") }));
  }
}
export function queueIdentity(e: Pick<QueueEvent, "deviceId" | "sequenceNumber" | "sequenceEpoch" | "eventReference" | "opaqueDeviceUserId" | "punchTimestamp" | "punchCode" | "statusCode">) {
  if (e.sequenceNumber !== null) return `${e.deviceId}:sequence:${e.sequenceEpoch}:${e.sequenceNumber}`;
  if (e.eventReference) return `${e.deviceId}:reference:${e.eventReference}`;
  return `${e.deviceId}:fallback:${e.opaqueDeviceUserId}:${e.punchTimestamp}:${e.punchCode}:${e.statusCode ?? ""}`;
}
function devicePayload(e: QueueEvent | ReturnType<typeof normalizedEvent>) { const { bridgeReceivedTimestamp: _, ...fields } = normalizedEvent(e); return JSON.stringify(fields); }
function payloadHash(e: QueueEvent | ReturnType<typeof normalizedEvent>) { return createHash("sha256").update(devicePayload(e)).digest("hex"); }
