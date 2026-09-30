// Test-only metadata. No application import, raw query, identifier or error text.
import { performance } from "node:perf_hooks";
import { mkdirSync, lstatSync, openSync, closeSync, writeSync, readFileSync } from "node:fs";
import path from "node:path";

export const phases = ["setup", "migration", "seed", "fixture", "actor_setup", "snapshot", "sale", "prior_year", "income", "finance_journey", "client_call", "transaction_wait", "transaction_action", "native_call", "native_attempt", "evaluator", "cleanup", "assertion", "test_case", "recorder_selftest"] as const;
export type Phase = typeof phases[number];
export type TraceKind = "START" | "END" | "ERROR" | "RESULT" | "TEST_CONTRACT" | "LINK" | "DECISION_INPUT" | "RETURNED_ROWS" | "DECISION" | "OVERRIDE" | "OUTCOME" | "MEASUREMENT";
const states = ["PASS", "FAIL", "UNKNOWN", "REVOKED", "ALREADY_REVOKED", "REJECTED"];
const sources = ["ACCOUNT", "SESSION", "ROLE_ASSIGNMENT", "SYSTEM_RESTRICTION", "OBJECT_SCOPE", "USER_DENY", "PROFILE_DENY", "USER_ALLOW", "PROFILE_ALLOW", "BASE_ROLE", "DEFAULT_DENY"];
export type OverrideMetadata = { label: string; actor: string; effect: string; status: string; validFromMs: number; validUntilMs: number | null; revokedAtMs: number | null };
export type DecisionMetadata = { actor: string; session: string; role: string; actorRole: string | null; cutoffMs: number; attempt: number; allowed: boolean; source: string; rows: OverrideMetadata[] };
export type TraceEvent = { seq: number; elapsedMs: number; kind: TraceKind; phase: Phase; span: number; attempt: number; status: string | null; detail: DecisionMetadata | OverrideMetadata | { parentSpan: number } | { case: string; purpose: string } | { actor: string; session: string; role: string; cutoffMs: number; attempt: number } | { rows: OverrideMetadata[] } | { recorderMs: number; events: number } | null };
const fail = () => { throw Error("SERVICE_TRACE_SCHEMA_INVALID"); };
export function checkedDirectory(directory: string) {
  let current = path.resolve(directory);
  for (;;) { const st = lstatSync(current); if (!st.isDirectory() || st.isSymbolicLink()) fail(); const parent = path.dirname(current); if (parent === current) return; current = parent; }
}
function exact(value: any, keys: string[]) { if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join() !== [...keys].sort().join()) fail(); }
function number(value: unknown) { if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > 9e15) fail(); }
function integer(value: unknown) { number(value); if (!Number.isInteger(value) || (value as number) < 0) fail(); }
function label(value: unknown) { if (typeof value !== "string" || !/^local-[1-9][0-9]{0,4}$/.test(value)) fail(); }
function date(value: unknown, nullable = false) { if (nullable && value === null) return; number(value); }
export function validateOverride(value: any) {
  exact(value, ["label", "actor", "effect", "status", "validFromMs", "validUntilMs", "revokedAtMs"]);
  label(value.label); label(value.actor); if (!["ALLOW", "DENY"].includes(value.effect) || !["ACTIVE", "REVOKED"].includes(value.status)) fail();
  date(value.validFromMs); date(value.validUntilMs, true); date(value.revokedAtMs, true);
}
export function validateEvent(value: any): asserts value is TraceEvent {
  exact(value, ["seq", "elapsedMs", "kind", "phase", "span", "attempt", "status", "detail"]);
  integer(value.seq); number(value.elapsedMs); if (value.elapsedMs < 0) fail(); integer(value.span); integer(value.attempt);
  if (!["START", "END", "ERROR", "RESULT", "TEST_CONTRACT", "LINK", "DECISION_INPUT", "RETURNED_ROWS", "DECISION", "OVERRIDE", "OUTCOME", "MEASUREMENT"].includes(value.kind) || !phases.includes(value.phase)) fail();
  if (value.status !== null && !states.includes(value.status)) fail();
  if (value.kind === "LINK") { exact(value.detail, ["parentSpan"]); integer(value.detail.parentSpan); if (value.span === 0 || value.detail.parentSpan === 0 || !["native_attempt", "evaluator"].includes(value.phase)) fail(); }
  else if (value.kind === "OVERRIDE") validateOverride(value.detail);
  else if (value.kind === "DECISION") {
    const d = value.detail; exact(d, ["actor", "session", "role", "actorRole", "cutoffMs", "attempt", "allowed", "source", "rows"]);
    label(d.actor); label(d.session); label(d.role); date(d.cutoffMs); integer(d.attempt);
    if (d.actorRole !== null && !["SUPER_ADMIN", "ACCOUNTANT", "DIRECTOR", "PRINCIPAL", "VIEWER", "TEACHER", "PARENT", "COMPUTER_OPERATOR"].includes(d.actorRole)) fail();
    if (typeof d.allowed !== "boolean" || !sources.includes(d.source) || !Array.isArray(d.rows) || d.rows.length > 32) fail();
    for (const row of d.rows) validateOverride(row);
  } else if (value.kind === "TEST_CONTRACT") { const d = value.detail; exact(d, ["case", "purpose"]); label(d.case); if (!["BUSINESS_AND_REFUSAL_CONTROLS", "DECLARED_ROLLBACK_AND_ROUTE_CONTROL", "EXPLICIT_DENY_CONTROL", "GOVERNANCE_CONTROLS"].includes(d.purpose)) fail(); }
  else if (value.kind === "DECISION_INPUT") { const d = value.detail; exact(d, ["actor", "session", "role", "cutoffMs", "attempt"]); label(d.actor); label(d.session); label(d.role); date(d.cutoffMs); integer(d.attempt); }
  else if (value.kind === "RETURNED_ROWS") { exact(value.detail, ["rows"]); if (!Array.isArray(value.detail.rows) || value.detail.rows.length > 32) fail(); for (const row of value.detail.rows) validateOverride(row); }
  else if (value.kind === "MEASUREMENT") { exact(value.detail, ["recorderMs", "events"]); number(value.detail.recorderMs); if (value.detail.recorderMs < 0) fail(); integer(value.detail.events); }
  else if (value.detail !== null) fail();
}
export function readTrace(file: string) {
  const st = lstatSync(file); if (!st.isFile() || st.isSymbolicLink() || st.nlink !== 1 || st.size > 2_000_000 || st.size === 0) fail();
  const text = readFileSync(file, "utf8"); if (!text.endsWith("\n")) fail();
  const lines = text.trimEnd().split("\n"); if (lines.length > 6000) fail();
  const active = new Set<number>(), linked = new Set<number>();
  return lines.map((line, index) => { if (line.length > 16000) fail(); const value = JSON.parse(line); validateEvent(value); if (value.seq !== index + 1 || JSON.stringify(value) !== line) fail();
    if (value.kind === "START") active.add(value.span);
    if (value.kind === "LINK") { const parent = (value.detail as { parentSpan: number }).parentSpan; if (!active.has(value.span) || !active.has(parent) || parent >= value.span || linked.has(value.span)) fail(); linked.add(value.span); }
    if (value.kind === "END" || value.kind === "ERROR") active.delete(value.span);
    return value; });
}

export class ServiceTrace {
  private start = performance.now(); private seq = 0; private spans = 0; private ids = new Map<string, string>(); private fd: number | undefined; private recorderMs = 0; private closed = false;
  readonly events: TraceEvent[] = []; readonly pending = new Map<number, Phase>();
  constructor(readonly file?: string) {
    if (file) { const dir = path.dirname(file); checkedDirectory(dir); this.fd = openSync(file, "wx", 0o600); }
  }
  label(id: string) { if (!this.ids.has(id)) this.ids.set(id, `local-${this.ids.size + 1}`); return this.ids.get(id)!; }
  override(row: any): OverrideMetadata { return { label: this.label(row.id), actor: this.label(row.userId), effect: row.effect, status: row.status, validFromMs: row.validFrom.getTime(), validUntilMs: row.validUntil?.getTime() ?? null, revokedAtMs: row.revokedAt?.getTime() ?? null }; }
  emit(kind: TraceKind, phase: Phase, span = 0, attempt = 0, status: string | null = null, detail: TraceEvent["detail"] = null) {
    if (this.closed) return; // Late work after catchable timeout cannot rewrite its finalized journal.
    const began = performance.now();
    const event = { seq: ++this.seq, elapsedMs: Math.round((performance.now() - this.start) * 1000) / 1000, kind, phase, span, attempt, status, detail };
    validateEvent(event); const line = JSON.stringify(event) + "\n";
    if (this.seq > 6000 || Buffer.byteLength(line) > 16000) throw Error("SERVICE_TRACE_BOUND_EXCEEDED");
    this.events.push(event); if (this.fd !== undefined) writeSync(this.fd, line);
    this.recorderMs += performance.now() - began;
  }
  begin(phase: Phase, attempt = 0) { const span = ++this.spans; this.pending.set(span, phase); this.emit("START", phase, span, attempt); return span; }
  end(span: number, error = false, attempt = 0) { const phase = this.pending.get(span); if (!phase) return; this.emit(error ? "ERROR" : "END", phase, span, attempt); this.pending.delete(span); }
  async phase<T>(name: Phase, action: () => Promise<T>, attempt = 0): Promise<T> { const span = this.begin(name, attempt); try { const result = await action(); this.end(span, false, attempt); return result; } catch (error) { this.end(span, true, attempt); throw error; } }
  result(state: string | undefined) { this.emit("RESULT", "assertion", 0, 0, state === "pass" ? "PASS" : state === "fail" ? "FAIL" : "UNKNOWN"); }
  close() { if (this.closed) return; this.emit("MEASUREMENT", "assertion", 0, 0, null, { recorderMs: Math.round(this.recorderMs * 1000) / 1000, events: this.seq }); if (this.fd !== undefined) { closeSync(this.fd); this.fd = undefined; } this.ids.clear(); this.closed = true; }
}
export function configuredTrace(kind: "native" | "finance") {
  const dir = process.env.NALANDA_SERVICE_TRACE_DIR;
  if (!dir) return new ServiceTrace();
  // Explicitly prepared test-only directory. Never use an application database
  // or accept a path from a production request. No overwrite/reuse of outputs.
  const root = path.resolve(dir), permitted = path.resolve("tmp");
  if (!root.startsWith(permitted + path.sep)) throw Error("SERVICE_TRACE_OWNER_MISMATCH");
  checkedDirectory(root);
  const file = path.join(root, "ownership.json"), st = lstatSync(file);
  if (!st.isFile() || st.isSymbolicLink() || st.nlink !== 1 || st.size > 2048) fail();
  const raw = readFileSync(file, "utf8"), owner = JSON.parse(raw);
  exact(owner, ["contract", "source", "run", "attempt", "job", "provider", "node", "image", "runner"]);
  if (raw !== JSON.stringify(owner) + "\n") fail();
  if (owner.contract !== "NALANDA_SERVICE_TRACE_V1" || owner.source !== process.env.EXPECTED_SHA || owner.run !== process.env.GITHUB_RUN_ID || owner.attempt !== process.env.GITHUB_RUN_ATTEMPT || owner.job !== process.env.GITHUB_JOB) throw Error("SERVICE_TRACE_OWNER_MISMATCH");
  return new ServiceTrace(path.join(root, `${kind}.jsonl`));
}
