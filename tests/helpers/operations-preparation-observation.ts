import type { TestContext } from "vitest";
import { writeFileSync } from "node:fs";
import path from "node:path";
import type { PreparationExecution, PreparationObserver } from "../../scripts/portable/prepare-operations";
import { OperationsProcessError, OperationsProcessOwner, type OperationsProcessObservation } from "../../scripts/portable/operations-preparation-process";
import { configuredQaTrace, projectQaSignal, type QaCase, type QaPhase, type QaProcess, type QaStatus, type QaTrace } from "./qa-reliability";

function publicProcess(value: OperationsProcessObservation): QaProcess {
  return { exit: value.exit, signal: projectQaSignal(value.signal), errorCategory: value.errorCategory, durationMs: value.durationMs, closed: value.closed, settled: value.settled };
}

export class OperationsPreparationObservation {
  readonly owner = new OperationsProcessOwner();
  private controller = new AbortController();
  readonly signal = this.controller.signal;
  private fixtureClose?: () => Promise<void>;
  private fixtureExpected = false;
  private owners = new Set<OperationsProcessOwner>([this.owner]);
  private processEvents = 0;
  constructor(readonly trace: QaTrace) { trace.signal.addEventListener("abort", () => this.controller.abort(), { once: true }); }
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
  execution(attempt: 0 | 1 | 2): PreparationExecution { return { signal: this.signal, observer: this.observer, processOwner: this.owner, attempt }; }
  registerProcessOwner(owner: OperationsProcessOwner) { this.owners.add(owner); }
  registerFixture(close: () => Promise<void>) { if (this.fixtureClose) throw Error("OPERATIONS_FIXTURE_ALREADY_REGISTERED"); this.fixtureExpected = true; this.fixtureClose = close; }
  async fixture<T>(allocate: () => Promise<T>, close: (fixture: T) => Promise<void>): Promise<T> {
    return this.phase("fixture-create", async () => { const fixture = await allocate(); this.registerFixture(() => close(fixture)); return fixture; });
  }
  async phase<T>(phase: QaPhase, action: () => T | Promise<T>, attempt: 0 | 1 | 2 = 0): Promise<T> {
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
export async function observedOperationsCase(context: Pick<TestContext, "signal" | "onTestFinished">, caseId: QaCase, body: (scope: OperationsPreparationObservation) => Promise<void>) {
  const trace = configuredQaTrace("operations", caseId);
  const scope = new OperationsPreparationObservation(trace);
  let bodySettled = false, outcome: QaStatus = "UNKNOWN", primaryFailed = false;
  let resolveBody!: () => void;
  const bodyDone = new Promise<void>(resolve => { resolveBody = resolve; });
  let finalization: Promise<void> | undefined;
  const abort = () => { try { scope.cancel("UNKNOWN"); } catch { /* Incomplete capture cannot prevent cancellation delivery. */ } };
  context.signal.addEventListener("abort", abort, { once: true });
  const finalize = () => finalization ??= (async () => {
    const span = trace.begin("finalize");
    let timer: NodeJS.Timeout | undefined;
    try {
      if (!bodySettled) {
        abort();
        await Promise.race([bodyDone, new Promise<void>(resolve => { timer = setTimeout(resolve, 3000); })]);
      }
      const fixtureSettled = await scope.settleFixture(bodySettled);
      trace.end(span, fixtureSettled ? "PASS" : "UNKNOWN");
      trace.finish(outcome);
    } catch (error) { try { trace.end(span, "FAIL"); trace.finish("FAIL"); } catch { /* Failed/partial journals remain available to the finalizer. */ } throw error; }
    finally { clearTimeout(timer); context.signal.removeEventListener("abort", abort); }
  })();
  // Arm before fixture allocation. This runs even when Vitest's 15s deadline
  // rejects the case before its asynchronous body has unwound.
  context.onTestFinished(async () => {
    if (!bodySettled) { outcome = "FAIL"; abort(); }
    try { await finalize(); } catch (cleanup) { if (!primaryFailed && !context.signal.aborted) throw cleanup; }
  });
  try { if (context.signal.aborted) abort(); await body(scope); outcome = "PASS"; }
  catch (primary) { primaryFailed = true; outcome = "FAIL"; try { scope.cancel("TEST_FAILURE"); } catch { /* Preserve the primary assertion/process error. */ } throw primary; }
  finally {
    bodySettled = true; resolveBody();
    try { await finalize(); } catch (cleanup) { if (!primaryFailed) throw cleanup; }
  }
}
