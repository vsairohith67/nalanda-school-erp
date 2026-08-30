import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { validateNormalizedEvent, type QueueEvent, type QueueStateName } from "./contracts.js";

type QueueState = { version: 1; events: QueueEvent[] };
const MAX_QUEUE_PLAINTEXT_BYTES = 32 * 1024 * 1024;
const MAX_QUEUE_ENVELOPE_BYTES = 48 * 1024 * 1024;
const ACKNOWLEDGED_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ACKNOWLEDGED_HISTORY = 1_000;
const MAX_SEND_ATTEMPTS = 20;
const PENDING_STATES = new Set<QueueStateName>(["RECEIVED_FROM_DEVICE", "QUEUED", "SENDING"]);

export class EncryptedDurableQueue {
  private readonly key: Buffer;
  constructor(private readonly file: string, encodedKey = process.env.NALANDA_BIOMETRIC_QUEUE_KEY) { this.key = Buffer.from(String(encodedKey ?? ""), "base64url"); if (this.key.length !== 32) throw new Error("BRIDGE_QUEUE_KEY_REQUIRED"); }
  load(): QueueEvent[] { if (!existsSync(this.file)) return []; const stat = statSync(this.file); if (!stat.isFile() || stat.size > MAX_QUEUE_ENVELOPE_BYTES) throw new Error("BRIDGE_QUEUE_INVALID"); const envelope = JSON.parse(readFileSync(this.file, "utf8")) as { version: 1; iv: string; tag: string; ciphertext: string }; const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(envelope.iv, "base64url")); decipher.setAAD(Buffer.from("nalanda-biometric-queue-v1")); decipher.setAuthTag(Buffer.from(envelope.tag, "base64url")); const plaintext = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64url")), decipher.final()]); if (plaintext.byteLength > MAX_QUEUE_PLAINTEXT_BYTES) throw new Error("BRIDGE_QUEUE_INVALID"); const state = JSON.parse(plaintext.toString("utf8")) as QueueState; if (state.version !== 1 || !Array.isArray(state.events) || state.events.length > 100_000) throw new Error("BRIDGE_QUEUE_INVALID"); for (const event of state.events) { validateNormalizedEvent(event); if (typeof event.queuedAt !== "string" || Number.isNaN(new Date(event.queuedAt).getTime()) || !validQueueState(event.localState) || !Number.isSafeInteger(event.attemptCount) || event.attemptCount < 0 || event.attemptCount > 10_000) throw new Error("BRIDGE_QUEUE_INVALID"); } return state.events; }
  append(events: QueueEvent[]) { for (const event of events) { validateNormalizedEvent(event); if (typeof event.queuedAt !== "string" || Number.isNaN(new Date(event.queuedAt).getTime())) throw new Error("BRIDGE_QUEUE_INVALID"); } const state = this.load(); const identities = new Set(state.map(queueIdentity)); const additions = events.filter((event) => { const identity = queueIdentity(event); if (identities.has(identity)) return false; identities.add(identity); return true; }).map((event) => ({ ...event, localState: "QUEUED" as const, attemptCount: 0 })); if (state.length + additions.length > 100_000) throw new Error("BRIDGE_QUEUE_CAPACITY_EXCEEDED"); if (additions.length) this.save([...state, ...additions]); }
  peek(limit = 100) { return this.load().filter((event) => PENDING_STATES.has(event.localState)).slice(0, Math.max(1, Math.min(100, limit))); }
  markSending(count: number) { this.transitionPending(count, (event) => ({ ...event, localState: "SENDING", attemptCount: event.attemptCount + 1, lastErrorCode: undefined })); }
  acknowledge(count: number, duplicate = false) { const acknowledgedAt = new Date().toISOString(); this.transitionPending(count, (event) => ({ ...event, localState: duplicate ? "DUPLICATE_ACKNOWLEDGED" : "ACKNOWLEDGED", acknowledgedAt, lastErrorCode: undefined })); }
  markSendFailed(count: number, errorCode: string) { const review = /(?:REVOKED|NOT_REGISTERED|NOT_ACTIVE|PROFILE|CONTRACT)/.test(errorCode), rejected = /(?:SCHEMA|BODY_HASH|BATCH_INVALID|CONTENT_TYPE)/.test(errorCode); this.transitionPending(count, (event) => ({ ...event, localState: review || event.attemptCount >= MAX_SEND_ATTEMPTS ? "NEEDS_ADMIN_REVIEW" : rejected ? "REJECTED" : "QUEUED", lastErrorCode: safeErrorCode(errorCode) })); }
  size() { return this.load().filter((event) => PENDING_STATES.has(event.localState)).length; }
  history() { return this.load().filter((event) => !PENDING_STATES.has(event.localState)); }
  private transitionPending(count: number, transition: (event: QueueEvent) => QueueEvent) { const state = this.load(), pending = state.filter((event) => PENDING_STATES.has(event.localState)); if (!Number.isInteger(count) || count < 0 || count > pending.length) throw new Error("BRIDGE_QUEUE_ACK_INVALID"); const selected = new Set(pending.slice(0, count).map(queueIdentity)); this.save(state.map((event) => selected.has(queueIdentity(event)) && PENDING_STATES.has(event.localState) ? transition(event) : event)); }
  private save(events: QueueEvent[]) { mkdirSync(path.dirname(this.file), { recursive: true }); const retained = retainedEvents(events); const plaintext = Buffer.from(JSON.stringify({ version: 1, events: retained } satisfies QueueState)); if (plaintext.byteLength > MAX_QUEUE_PLAINTEXT_BYTES) throw new Error("BRIDGE_QUEUE_CAPACITY_EXCEEDED"); const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", this.key, iv); cipher.setAAD(Buffer.from("nalanda-biometric-queue-v1")); const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]); const temp = `${this.file}.${process.pid}.partial`; writeFileSync(temp, JSON.stringify({ version: 1, iv: iv.toString("base64url"), tag: cipher.getAuthTag().toString("base64url"), ciphertext: ciphertext.toString("base64url") }), { encoding: "utf8", mode: 0o600, flag: "w" }); syncFile(temp); renameSync(temp, this.file); syncFile(this.file); }
}

function validQueueState(value: unknown): value is QueueStateName { return ["RECEIVED_FROM_DEVICE", "QUEUED", "SENDING", "ACKNOWLEDGED", "DUPLICATE_ACKNOWLEDGED", "REJECTED", "NEEDS_ADMIN_REVIEW"].includes(String(value)); }
function safeErrorCode(value: string) { return /^[A-Z0-9_:.-]{3,160}$/.test(value) ? value : "BRIDGE_SYNC_FAILED"; }
function retainedEvents(events: QueueEvent[]) { const cutoff = Date.now() - ACKNOWLEDGED_RETENTION_MS, terminal = events.filter((event) => !PENDING_STATES.has(event.localState) && (!event.acknowledgedAt || new Date(event.acknowledgedAt).getTime() >= cutoff)).slice(-MAX_ACKNOWLEDGED_HISTORY); return [...events.filter((event) => PENDING_STATES.has(event.localState)), ...terminal]; }

function queueIdentity(event: QueueEvent) {
  if (event.sequenceNumber !== null) return `${event.deviceId}:sequence:${event.sequenceEpoch}:${event.sequenceNumber}`;
  if (event.eventReference) return `${event.deviceId}:reference:${event.sequenceEpoch}:${event.eventReference}`;
  return `${event.deviceId}:fallback:${event.sequenceEpoch}:${event.opaqueDeviceUserId}:${event.punchTimestamp}:${event.punchCode}:${event.statusCode ?? ""}`;
}

function syncFile(file: string) { const descriptor = openSync(file, "r+"); try { fsyncSync(descriptor); } finally { closeSync(descriptor); } }
