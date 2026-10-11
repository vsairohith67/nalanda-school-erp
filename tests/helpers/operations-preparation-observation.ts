import type { TestContext } from "vitest";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import type { PreparationExecution, PreparationObserver } from "../../scripts/portable/prepare-operations";
import { OperationsProcessError, OperationsProcessOwner, type OperationsProcessObservation } from "../../scripts/portable/operations-preparation-process";
import { configuredQaTrace, projectQaSignal, type QaCase, type QaPhase, type QaProcess, type QaStatus, type QaTrace } from "./qa-reliability";

function publicProcess(value: OperationsProcessObservation): QaProcess {
  return { exit: value.exit, signal: projectQaSignal(value.signal), errorCategory: value.errorCategory, durationMs: value.durationMs, closed: value.closed, settled: value.settled };
}

// A changed integration-harness contract, not an operator/product response SLA.
// The original failed 15s results and every child/cancellation limit remain.
export const operationsCaseContract = Object.freeze({ state: "TEST_CONTRACT_CHANGED", bodyMs: 45000, finishedHookMs: 3000, totalMs: 48000 });
const revisedCases = ["local-single-node", "generic-vps", "filesystem-adapter-controls", "normalized-refusals"] as const;
export type OperationsCaseContext = Pick<TestContext, "signal" | "onTestFinished"> & Partial<Pick<TestContext, "task">>;

export class OperationsPreparationObservation {
  readonly owner = new OperationsProcessOwner();
  private controller = new AbortController();
  readonly signal = this.controller.signal;
  private fixtureClose?: () => Promise<void>;
  private fixtureExpected = false;
  private owners = new Set<OperationsProcessOwner>([this.owner]);
  private processEvents = 0;
  private actionStarted: number | null = null;
  constructor(readonly trace: QaTrace, readonly startedAt = performance.now()) { trace.signal.addEventListener("abort", () => this.controller.abort(), { once: true }); }
  get actionStartedMs() { return this.actionStarted; }
  get ownedWorkSettled() { return [...this.owners].every(owner => owner.settled); }
  private startAction() { this.actionStarted ??= performance.now() - this.startedAt; }
  cancel(cause: "TEST_FAILURE" | "UNKNOWN") { try { this.trace.cancel(cause); } finally { this.controller.abort(); } }
  readonly observer: PreparationObserver = {
    begin: (phase, attempt) => this.trace.begin(phase, attempt),
    end: (span, status, process) => this.trace.end(span as number, status, process ? publicProcess(process) : null),
    processEvent: (event, attempt) => {
      const phases = { spawn: "compose-spawn", "first-stdout": "compose-first-stdout", "first-stderr": "compose-first-stderr", exit: "compose-exit", close: "compose-close" } as const;
      const phase = phases[event.stage];
      // PASS marks the occurrence of this event, not successful Compose startup
      // or discovery of a particular plugin. The enclosing process retains that outcome.
      const span = this.trace.begin(phase, attempt);
      if (this.trace.directory) {
        const sequence = ++this.processEvents;
        if (sequence > 99) throw Error("OPERATIONS_PROCESS_CAPTURE_BOUND_EXCEEDED");
        writeFileSync(path.join(this.trace.directory, `process-${phase}-${attempt}-${sequence}.json`), JSON.stringify({ stage: event.stage, pid: event.pid, selectedComposePlugin: "UNKNOWN" }) + "\n", { flag: "wx", mode: 0o600 });
      }
      this.trace.end(span, "PASS");
    }
  };
  execution(attempt: 0 | 1 | 2): PreparationExecution { this.startAction(); return { signal: this.signal, observer: this.observer, processOwner: this.owner, attempt }; }
  registerProcessOwner(owner: OperationsProcessOwner) { this.owners.add(owner); }
  registerFixture(close: () => Promise<void>) { if (this.fixtureClose) throw Error("OPERATIONS_FIXTURE_ALREADY_REGISTERED"); this.fixtureExpected = true; this.fixtureClose = close; }
  async fixture<T>(allocate: () => Promise<T>, close: (fixture: T) => Promise<void>): Promise<T> {
    return this.phase("fixture-create", async () => { const fixture = await allocate(); this.registerFixture(() => close(fixture)); return fixture; });
  }
  async phase<T>(phase: QaPhase, action: () => T | Promise<T>, attempt: 0 | 1 | 2 = 0): Promise<T> {
    if (["compose-version", "compose-config", "operator-dry-run"].includes(phase)) this.startAction();
    if (phase === "fixture-create") this.fixtureExpected = true;
    const span = this.trace.begin(phase, attempt);
    let returned = false, value: T;
    try {
      if (this.signal.aborted) throw Error("OPERATIONS_PREPARATION_CANCELLED");
      value = await action(); returned = true;
      if (this.signal.aborted) throw Error("OPERATIONS_PREPARATION_CANCELLED");
    } catch (primary) {
      const process = primary instanceof OperationsProcessError ? primary.observation : returned && value! && typeof value === "object" && "observation" in value ? (value as { observation: OperationsProcessObservation }).observation : undefined;
      try { this.trace.end(span, "FAIL", process ? publicProcess(process) : null); } catch { /* An incomplete journal retains the original failure. */ }
      throw primary;
    }
    const process = value! && typeof value === "object" && "observation" in value ? (value as { observation: OperationsProcessObservation }).observation : undefined;
    this.trace.end(span, "PASS", process ? publicProcess(process) : null);
    return value!;
  }
  async settleFixture(bodySettled: boolean) {
    const span = this.trace.begin("fixture-settlement");
    if (!bodySettled || (this.fixtureExpected && !this.fixtureClose) || [...this.owners].some(owner => !owner.settled)) { this.trace.end(span, "UNKNOWN"); return false; }
    try { await this.fixtureClose?.(); this.trace.end(span, "PASS"); return true; }
    catch (primary) { try { this.trace.end(span, "FAIL"); } catch { /* Preserve cleanup failure. */ } throw primary; }
  }
}

/** All work and assertions stay in the original case. A timeout hook cancels and
 * waits for the body/owned process barrier before it can remove a fixture. */
export async function observedOperationsCase(context: OperationsCaseContext, caseId: QaCase, body: (scope: OperationsPreparationObservation) => Promise<void>) {
  const started = performance.now(), revised = (revisedCases as readonly string[]).includes(caseId);
  const trace = configuredQaTrace("operations", caseId);
  const scope = new OperationsPreparationObservation(trace, started);
  let bodySettled = false, outcome: QaStatus = "UNKNOWN", primaryFailed = false;
  let bodyEnded: number | null = null, teardownStarted: number | null = null, teardownEnded: number | null = null;
  let hookStarted: number | null = null, hookEnded: number | null = null, fixtureSettled: boolean | null = null, traceFinished = false;
  const elapsed = () => performance.now() - started;
  const rounded = (value: number | null) => value === null ? null : Math.round(value * 1000) / 1000;
  const emitted = new Set<string>();
  const receipt = (stage: "START" | "ABORTED_PARTIAL" | "FINISHED") => {
    if (!revised || emitted.has(stage)) return;
    emitted.add(stage);
    // Aggregate clocks only. Actual source/job binding comes from the existing
    // job's retained console and QA owner; no paths, PID, env or child bytes.
    const row = Object.freeze({ evidence: "OPERATIONS_CASE_LIFECYCLE_V1", scope: trace.directory ? "BOUND_INTEGRATION_JOURNAL" : "HARNESS_ONLY", contract: operationsCaseContract, caseId, stage,
      setup: Object.freeze({ startMs: 0, endMs: rounded(scope.actionStartedMs ?? bodyEnded) }),
      action: Object.freeze({ startMs: rounded(scope.actionStartedMs), endMs: rounded(bodyEnded) }),
      teardown: Object.freeze({ startMs: rounded(teardownStarted), endMs: rounded(teardownEnded) }),
      finishedHook: Object.freeze({ startMs: rounded(hookStarted), endMs: rounded(hookEnded) }),
      totalObservedMs: rounded(elapsed()), bodySettled, fixtureSettled, ownedWorkSettled: scope.ownedWorkSettled,
      cancelled: context.signal.aborted || scope.signal.aborted, declaredResult: stage === "START" ? "UNKNOWN" : outcome });
    // Existing Vitest JSON emits this same task's meta and complete duration.
    // Bind exactly one final aggregate; partial stages remain in finite logs.
    if (stage === "FINISHED" && context.task) Object.defineProperty(context.task.meta, "operationsLifecycle", { value: row, enumerable: true, writable: false, configurable: false });
    console.info(JSON.stringify(row));
  };
  const finishTrace = () => { if (!traceFinished) { trace.finish(outcome); traceFinished = true; } };
  let resolveBody!: () => void;
  const bodyDone = new Promise<void>(resolve => { resolveBody = resolve; });
  let finalization: Promise<void> | undefined;
  const abort = () => { outcome = "FAIL"; try { scope.cancel("UNKNOWN"); } catch { /* Incomplete capture cannot prevent cancellation delivery. */ } finally { receipt("ABORTED_PARTIAL"); } };
  context.signal.addEventListener("abort", abort, { once: true });
  const finalize = () => finalization ??= (async () => {
    teardownStarted = elapsed();
    const span = trace.begin("finalize");
    let timer: NodeJS.Timeout | undefined;
    try {
      if (!bodySettled) {
        abort();
        await Promise.race([bodyDone, new Promise<void>(resolve => { timer = setTimeout(resolve, 3000); })]);
      }
      fixtureSettled = await scope.settleFixture(bodySettled);
      if (!fixtureSettled || context.signal.aborted) outcome = "FAIL";
      trace.end(span, fixtureSettled ? "PASS" : "UNKNOWN");
      if (!revised) finishTrace();
      if (!fixtureSettled) throw Error("OPERATIONS_PREPARATION_SETTLEMENT_UNRECONCILED");
    } catch (error) { outcome = "FAIL"; try { trace.end(span, "FAIL"); if (!revised) finishTrace(); } catch { /* Failed/partial journals remain available to the finalizer. */ } throw error; }
    finally { teardownEnded = elapsed(); clearTimeout(timer); context.signal.removeEventListener("abort", abort); }
  })();
  // Arm before fixture allocation. This runs even when Vitest's case deadline
  // rejects the case before its asynchronous body has unwound.
  context.onTestFinished(async () => {
    hookStarted = elapsed();
    let hookFailure: unknown;
    if (!bodySettled) { outcome = "FAIL"; abort(); }
    try { await finalize(); } catch (cleanup) { hookFailure = cleanup; }
    hookEnded = elapsed();
    const exceeded = revised && (teardownEnded === null || teardownEnded > operationsCaseContract.bodyMs || hookEnded - hookStarted > operationsCaseContract.finishedHookMs || hookEnded > operationsCaseContract.totalMs);
    const unsafe = revised && (exceeded || !bodySettled || fixtureSettled !== true || !scope.ownedWorkSettled || context.signal.aborted || scope.signal.aborted);
    if (revised) {
      if (unsafe) {
        outcome = "FAIL"; try { scope.cancel("UNKNOWN"); } catch { /* No future work is permitted after failed finalization. */ }
      }
      finishTrace(); receipt("FINISHED");
    }
    if (hookFailure && !primaryFailed && !context.signal.aborted) throw hookFailure;
    if (exceeded && !primaryFailed && !context.signal.aborted) throw Error("OPERATIONS_CASE_CONTRACT_EXCEEDED");
    if (unsafe && !primaryFailed && !context.signal.aborted) throw Error("OPERATIONS_CASE_SETTLEMENT_UNRECONCILED");
  }, revised ? operationsCaseContract.finishedHookMs : undefined);
  receipt("START");
  try { if (context.signal.aborted) abort(); await body(scope); if (context.signal.aborted || scope.signal.aborted) throw Error("OPERATIONS_PREPARATION_CANCELLED"); outcome = "PASS"; }
  catch (primary) { primaryFailed = true; outcome = "FAIL"; try { scope.cancel("TEST_FAILURE"); } catch { /* Preserve the primary assertion/process error. */ } throw primary; }
  finally {
    bodySettled = true; bodyEnded = elapsed(); resolveBody();
    try { await finalize(); } catch (cleanup) { if (!primaryFailed) throw cleanup; }
  }
}
