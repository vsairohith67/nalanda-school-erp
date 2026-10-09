// Test-only finite observations. Arbitrary diagnostics stay in the owned private
// case directory; this journal is the sole allowlisted public projection input.
import { performance } from "node:perf_hooks";
import { closeSync, lstatSync, mkdirSync, openSync, readFileSync, writeSync } from "node:fs";
import path from "node:path";
import { checkedDirectory } from "./service-trace";

export const qaPhases = ["fixture-create", "settings-validate", "provenance-check", "filesystem-check", "output-create", "compose-version", "compose-config", "compose-parse", "boundary-validate", "manifests-write", "commands-write", "preparation-write", "operator-dry-run", "outputs-equivalent", "occupied-output-refusal", "artifact-refusal", "cancellation", "fixture-settlement", "finalize", "custody-parent-launch", "wrapper-start", "module-initialize", "process-metadata", "helper-entry", "helper-exit", "parent-finalize", "report-user-create", "report-role-create", "report-session-create", "report-grant-create", "report-authorization", "report-expected-refusal", "compose-spawn", "compose-first-stdout", "compose-first-stderr", "compose-exit", "compose-close", "report-body-settlement"] as const;
export type QaPhase = typeof qaPhases[number];
export const custodyCases = ["valid-inspection", "foreign-sid", "exfat", "remote-drive", "wrong-volume", "reparse", "foreign-owner", "wide-acl", "unprotected", "missing-inheritance", "replay", "bad-receipt", "valid-verification"] as const;
export const harnessCases = ["harness-clean", "harness-startup", "harness-nonzero", "harness-timeout", "harness-partial", "harness-missing", "harness-malformed", "harness-initialization", "harness-output-limit", "invalid-process-controls", "filesystem-adapter-controls"] as const;
export const reportingCases = ["role-director", "role-principal", "role-accountant", "role-admin", "role-teacher", "role-parent", "role-student", "role-viewer", "role-computer-operator", "role-gate-staff", "role-custom"] as const;
export const qaCases = ["local-single-node", "generic-vps", "normalized-refusals", ...custodyCases, ...harnessCases, ...reportingCases] as const;
export type QaCase = typeof qaCases[number];
export type QaFamily = "operations" | "custody" | "reporting";
export type QaStatus = "PASS" | "FAIL" | "UNKNOWN";
export const qaSignals = ["SIGHUP", "SIGINT", "SIGQUIT", "SIGILL", "SIGTRAP", "SIGABRT", "SIGIOT", "SIGBUS", "SIGFPE", "SIGKILL", "SIGUSR1", "SIGSEGV", "SIGUSR2", "SIGPIPE", "SIGALRM", "SIGTERM", "SIGSTKFLT", "SIGCHLD", "SIGCONT", "SIGSTOP", "SIGTSTP", "SIGTTIN", "SIGTTOU", "SIGURG", "SIGXCPU", "SIGXFSZ", "SIGVTALRM", "SIGPROF", "SIGWINCH", "SIGIO", "SIGPOLL", "SIGPWR", "SIGSYS", "SIGBREAK", "SIGLOST", "SIGUNUSED"] as const;
export function projectQaSignal(value: string | null | undefined): typeof qaSignals[number] | "UNKNOWN" | null { return value == null ? null : (qaSignals as readonly string[]).includes(value) ? value as typeof qaSignals[number] : "UNKNOWN"; }
export type QaOwner = { contract: "NALANDA_QA_RELIABILITY_V1"; source: string; run: string; attempt: string; job: string; provider: string; node: string; image: string; runner: string };
export type QaProcess = { exit: number | null; signal: typeof qaSignals[number] | "UNKNOWN" | null; errorCategory: "NONE" | "STARTUP" | "NONZERO_EXIT" | "TIMEOUT" | "CANCELLED" | "OUTPUT_LIMIT" | "IO" | "UNKNOWN"; durationMs: number; closed: boolean | null; settled: QaStatus };
export type QaEvent = { seq: number; elapsedMs: number; kind: "START" | "END" | "RESULT" | "BIND"; phase: QaPhase | null; span: number; attempt: number; status: QaStatus | null; durationMs: number | null; process: QaProcess | null; digests: { helperSha256: string; wrapperSha256: string } | null };
const fail = () => { throw Error("QA_RELIABILITY_SCHEMA_INVALID"); };
function exact(v: any, keys: readonly string[]) { if (!v || typeof v !== "object" || Array.isArray(v) || Object.keys(v).sort().join() !== [...keys].sort().join()) fail(); }
const integer = (v: unknown, max = 1_000_000) => { if (!Number.isSafeInteger(v) || (v as number) < 0 || (v as number) > max) fail(); };
const duration = (v: unknown) => { if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 86_400_000) fail(); };
const digest = (v: unknown) => { if (typeof v !== "string" || !/^[a-f0-9]{64}$/.test(v)) fail(); };
export function validateQaOwner(v: unknown): asserts v is QaOwner {
  const x = v as QaOwner; exact(x, ["contract", "source", "run", "attempt", "job", "provider", "node", "image", "runner"]);
  if (x.contract !== "NALANDA_QA_RELIABILITY_V1" || !/^[a-f0-9]{40}$/.test(x.source) || !/^[1-9][0-9]{0,19}$/.test(x.run) || !/^[1-9][0-9]{0,19}$/.test(x.attempt) || !/^[a-zA-Z0-9_-]{1,100}$/.test(x.job) || !["sqlite", "postgresql"].includes(x.provider) || !/^v[0-9]+\.[0-9]+\.[0-9]+$/.test(x.node) || !/^[a-zA-Z0-9._-]{1,80}$/.test(x.image) || !["Windows", "Linux", "macOS", "unavailable"].includes(x.runner)) fail();
}
export function classification(family: QaFamily, caseId: QaCase) {
  if (!["operations", "custody", "reporting"].includes(family) || !qaCases.includes(caseId)) fail();
  if ((harnessCases as readonly string[]).includes(caseId)) return "HARNESS_ONLY" as const;
  if (family === "operations" && ["local-single-node", "generic-vps", "normalized-refusals"].includes(caseId)) return "REAL_CLIENT_ONLY_COMPOSE" as const;
  if (family === "custody" && (custodyCases as readonly string[]).includes(caseId)) return "REAL_HELPER_CONTROLLED_METADATA" as const;
  if (family === "reporting" && (reportingCases as readonly string[]).includes(caseId)) return "REAL_SYNTHETIC_DATABASE_SERVICE" as const;
  return fail();
}
export function validateQaEvent(v: unknown): asserts v is QaEvent {
  const x = v as QaEvent; exact(x, ["seq", "elapsedMs", "kind", "phase", "span", "attempt", "status", "durationMs", "process", "digests"]);
  integer(x.seq, 1000); duration(x.elapsedMs); integer(x.span, 1000); integer(x.attempt, 2);
  if (!["START", "END", "RESULT", "BIND"].includes(x.kind) || (x.phase !== null && !qaPhases.includes(x.phase)) || (x.status !== null && !["PASS", "FAIL", "UNKNOWN"].includes(x.status))) fail();
  if (x.durationMs !== null) duration(x.durationMs);
  if (x.process !== null) {
    exact(x.process, ["exit", "signal", "errorCategory", "durationMs", "closed", "settled"]);
    if (x.process.exit !== null && (!Number.isSafeInteger(x.process.exit) || Math.abs(x.process.exit) > 2 ** 32)) fail();
    if (!(x.process.signal === null || x.process.signal === "UNKNOWN" || (qaSignals as readonly string[]).includes(x.process.signal)) || !["NONE", "STARTUP", "NONZERO_EXIT", "TIMEOUT", "CANCELLED", "OUTPUT_LIMIT", "IO", "UNKNOWN"].includes(x.process.errorCategory) || ![null, true, false].includes(x.process.closed) || !["PASS", "FAIL", "UNKNOWN"].includes(x.process.settled)) fail();
    duration(x.process.durationMs);
  }
  if (x.digests !== null) { exact(x.digests, ["helperSha256", "wrapperSha256"]); digest(x.digests.helperSha256); digest(x.digests.wrapperSha256); }
  if (x.kind === "START" && (x.span === 0 || x.phase === null || x.status !== null || x.durationMs !== null || x.process !== null || x.digests !== null)) fail();
  if (x.kind === "END" && (x.span === 0 || x.phase === null || x.status === null || x.durationMs === null || x.digests !== null)) fail();
  if (x.kind === "RESULT" && (x.span !== 0 || x.phase !== "finalize" || x.status === null || x.durationMs !== null || x.process !== null || x.digests !== null)) fail();
  if (x.kind === "BIND" && (x.span !== 0 || x.phase !== null || x.status !== null || x.durationMs !== null || x.process !== null || x.digests === null)) fail();
}

export class QaTrace {
  private start = performance.now(); private seq = 0; private spans = 0; private fd?: number; private closed = false;
  private controller = new AbortController(); private bound = false;
  readonly events: QaEvent[] = []; readonly pending = new Map<number, { phase: QaPhase; attempt: number; started: number }>();
  readonly signal = this.controller.signal;
  constructor(readonly family: QaFamily, readonly caseId: QaCase, readonly directory?: string) {
    classification(family, caseId);
    if (directory) { checkedDirectory(directory); this.fd = openSync(path.join(directory, "phases.jsonl"), "wx", 0o600); }
  }
  private emit(value: Omit<QaEvent, "seq" | "elapsedMs">) {
    if (this.closed) return;
    const event = { seq: this.seq + 1, elapsedMs: Math.round((performance.now() - this.start) * 1000) / 1000, ...value };
    validateQaEvent(event); const line = JSON.stringify(event) + "\n";
    if (Buffer.byteLength(line) > 8192 || event.seq > 1000) throw Error("QA_RELIABILITY_BOUND_EXCEEDED");
    if (this.fd !== undefined) { const bytes = Buffer.from(line); let offset = 0; while (offset < bytes.length) offset += writeSync(this.fd, bytes, offset); }
    this.seq++; this.events.push(event);
  }
  begin(phase: QaPhase, attempt = 0) { if (this.closed) throw Error("QA_RELIABILITY_TRACE_CLOSED"); const span = ++this.spans; this.emit({ kind: "START", phase, span, attempt, status: null, durationMs: null, process: null, digests: null }); this.pending.set(span, { phase, attempt, started: performance.now() }); return span; }
  end(span: number, status: QaStatus = "PASS", process: QaProcess | null = null) {
    if (this.closed) return; const active = this.pending.get(span); if (!active) throw Error("QA_RELIABILITY_SPAN_UNKNOWN");
    this.emit({ kind: "END", phase: active.phase, span, attempt: active.attempt, status, durationMs: Math.round((performance.now() - active.started) * 1000) / 1000, process, digests: null }); this.pending.delete(span);
  }
  async phase<T>(name: QaPhase, action: () => Promise<T>, attempt = 0): Promise<T> { const span = this.begin(name, attempt); try { const result = await action(); this.end(span); return result; } catch (error) { this.end(span, "FAIL"); throw error; } }
  bind(digests: { helperSha256: string; wrapperSha256: string }) { if (this.bound) throw Error("QA_RELIABILITY_BIND_REPLAY"); this.emit({ kind: "BIND", phase: null, span: 0, attempt: 0, status: null, durationMs: null, process: null, digests }); this.bound = true; }
  cancel(_cause: "TEST_FAILURE" | "TEST_TIMEOUT" | "UNKNOWN" = "UNKNOWN") { if (this.closed || this.controller.signal.aborted) return; const span = this.begin("cancellation"); this.controller.abort(); this.end(span, "UNKNOWN"); }
  finish(status: QaStatus) { if (this.closed) return; try { this.emit({ kind: "RESULT", phase: "finalize", span: 0, attempt: 0, status, durationMs: null, process: null, digests: null }); } finally { if (this.fd !== undefined) closeSync(this.fd); this.fd = undefined; this.closed = true; } }
}

export function readQaJournal(file: string) {
  const events: QaEvent[] = []; const pending = new Map<number, { phase: QaPhase; attempt: number }>();
  let state: "VALID" | "PARTIAL" | "INVALID" | "MISSING" = "VALID";
  try {
    const st = lstatSync(file); if (!st.isFile() || st.isSymbolicLink() || st.nlink !== 1 || st.size > 1_000_000) return { state: "INVALID" as const, events, unfinished: [], declaredResult: "UNKNOWN" as QaStatus, result: "UNKNOWN" as QaStatus, processSettlement: "UNKNOWN" as QaStatus };
    const raw = readFileSync(file, "utf8"); const lines = raw.split("\n"); if (!raw.endsWith("\n")) { state = "PARTIAL"; lines.pop(); } else lines.pop();
    let resultSeen = false, lastElapsed = 0, bound = false; const spans = new Set<number>();
    for (const line of lines) {
      if (events.length >= 1000 || Buffer.byteLength(line) > 8192 || resultSeen) { state = "INVALID"; break; }
      let event: QaEvent; try { event = JSON.parse(line); validateQaEvent(event); } catch { state = "INVALID"; break; }
      if (event.seq !== events.length + 1 || event.elapsedMs < lastElapsed || JSON.stringify(event) !== line) { state = "INVALID"; break; }
      if (event.kind === "START") { if (spans.has(event.span)) { state = "INVALID"; break; } spans.add(event.span); pending.set(event.span, { phase: event.phase!, attempt: event.attempt }); }
      if (event.kind === "END") { const active = pending.get(event.span); if (!active || active.phase !== event.phase || active.attempt !== event.attempt) { state = "INVALID"; break; } pending.delete(event.span); }
      if (event.kind === "BIND") { if (bound) { state = "INVALID"; break; } bound = true; }
      if (event.kind === "RESULT") resultSeen = true;
      lastElapsed = event.elapsedMs; events.push(event);
    }
  } catch (error) { state = (error as NodeJS.ErrnoException).code === "ENOENT" ? "MISSING" : "INVALID"; }
  const declaredResult = events.find(e => e.kind === "RESULT")?.status ?? "UNKNOWN";
  // A declared test PASS can include an expected operation refusal. Retain both
  // facts, rather than presenting the failed/incomplete operation as successful.
  let result = state === "VALID" ? declaredResult : "UNKNOWN";
  if (result === "PASS" && (pending.size || events.some(e => e.kind === "END" && e.status !== "PASS"))) result = "UNKNOWN";
  const processes = events.flatMap(e => e.process ? [e.process] : []);
  if (result === "PASS" && processes.some(p => p.errorCategory !== "NONE" || p.closed !== true || p.settled !== "PASS")) result = "UNKNOWN";
  const processSettlement: QaStatus = processes.some(p => p.settled === "FAIL") ? "FAIL" : processes.length && processes.every(p => p.settled === "PASS") ? "PASS" : "UNKNOWN";
  return { state, events, unfinished: [...pending].map(([span, value]) => ({ span, ...value })), declaredResult, result, processSettlement };
}

export function configuredQaTrace(family: QaFamily, caseId: QaCase) {
  const configured = process.env.NALANDA_QA_RELIABILITY_TRACE_DIR;
  if (!configured) return new QaTrace(family, caseId);
  const root = path.resolve(configured); if (!root.startsWith(path.resolve("tmp") + path.sep)) throw Error("QA_RELIABILITY_OWNER_MISMATCH"); checkedDirectory(root);
  const file = path.join(root, "ownership.json"), st = lstatSync(file); if (!st.isFile() || st.isSymbolicLink() || st.nlink !== 1 || st.size > 2048) fail();
  const raw = readFileSync(file, "utf8"), owner: QaOwner = JSON.parse(raw); validateQaOwner(owner);
  if (raw !== JSON.stringify(owner) + "\n" || owner.source !== process.env.EXPECTED_SHA || owner.run !== process.env.GITHUB_RUN_ID || owner.attempt !== process.env.GITHUB_RUN_ATTEMPT || owner.job !== process.env.GITHUB_JOB) throw Error("QA_RELIABILITY_OWNER_MISMATCH");
  const directory = path.join(root, `${family}-${caseId}`); mkdirSync(directory, { mode: 0o700 });
  return new QaTrace(family, caseId, directory);
}
