import type { TestContext } from "vitest";
import { configuredQaTrace, reportingCases, type QaCase, type QaPhase, type QaStatus, type QaTrace } from "./qa-reliability";

const activeBodies = new Set<Promise<void>>();

async function settledWithin(body: Promise<void>) {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([body.then(() => true), new Promise<false>(resolve => { timer = setTimeout(() => resolve(false), 3000); })]);
  } finally { clearTimeout(timer); }
}

/** A guard around actual database work, without pretending to cancel a Prisma
 * query that is already running. Cancellation prevents every later action. */
export class IntelligentReportsObservation {
  private controller = new AbortController();
  readonly signal = this.controller.signal;
  constructor(readonly trace: QaTrace) {}
  cancel(cause: "TEST_FAILURE" | "UNKNOWN") { try { this.trace.cancel(cause); } finally { this.controller.abort(); } }
  async phase<T>(phase: QaPhase, action: () => T | Promise<T>): Promise<T> {
    if (this.signal.aborted) throw Error("REPORTING_OBSERVATION_CANCELLED");
    const span = this.trace.begin(phase);
    try {
      const value = await action();
      if (this.signal.aborted) throw Error("REPORTING_OBSERVATION_CANCELLED");
      this.trace.end(span, "PASS");
      return value;
    } catch (primary) {
      try { this.trace.end(span, "FAIL"); } catch { /* Retain the original database/assertion failure. */ }
      throw primary;
    }
  }
}

/** One trace per role inside the original sequential ten-role test. The original
 * test deadline owns cancellation; the 3s barrier is settlement time only. */
export async function observedReportingRole(context: Pick<TestContext, "signal" | "onTestFinished">, caseId: QaCase, body: (scope: IntelligentReportsObservation) => Promise<void>) {
  const trace = configuredQaTrace("reporting", caseId);
  const scope = new IntelligentReportsObservation(trace);
  let bodySettled = false, outcome: QaStatus = "UNKNOWN", primaryFailed = false;
  let resolveBody!: () => void;
  const bodyDone = new Promise<void>(resolve => { resolveBody = resolve; });
  activeBodies.add(bodyDone);
  let finalization: Promise<void> | undefined;
  const abort = () => { outcome = "FAIL"; try { scope.cancel("UNKNOWN"); } catch { /* Cancellation still reaches the guard. */ } };
  context.signal.addEventListener("abort", abort, { once: true });
  const finalize = () => finalization ??= (async () => {
    const span = trace.begin("finalize");
    try {
      if (!bodySettled) { abort(); await settledWithin(bodyDone); }
      const settlement = trace.begin("report-body-settlement");
      trace.end(settlement, bodySettled ? "PASS" : "UNKNOWN");
      trace.end(span, bodySettled ? "PASS" : "UNKNOWN");
      trace.finish(outcome);
      // Local diagnostics reuse these finite events without inventing a hosted
      // run/job identity. Configured CI uses the existing journal/finalizer.
      if (!trace.directory && (reportingCases as readonly string[]).includes(trace.caseId)) console.info(JSON.stringify({
        evidence: "INTELLIGENT_REPORTS_ROLE_PHASES_V1", provider: process.env.DATABASE_PROVIDER === "postgresql" ? "postgresql" : "sqlite", caseId: trace.caseId, declaredResult: outcome,
        phases: trace.events.filter(event => event.kind === "END").map(event => ({ phase: event.phase, status: event.status, durationMs: event.durationMs })),
        unfinished: [...trace.pending.values()].map(value => value.phase)
      }));
    } catch (primary) {
      try { trace.end(span, "FAIL"); trace.finish("FAIL"); } catch { /* Keep partial capture for the existing finalizer. */ }
      throw primary;
    } finally { context.signal.removeEventListener("abort", abort); }
  })();
  context.onTestFinished(async () => {
    if (!bodySettled || context.signal.aborted) abort();
    try { await finalize(); } catch (capture) { if (!primaryFailed && !context.signal.aborted) throw capture; }
  });
  try {
    if (context.signal.aborted) abort();
    if (scope.signal.aborted) throw Error("REPORTING_OBSERVATION_CANCELLED");
    await body(scope);
    if (scope.signal.aborted || context.signal.aborted) throw Error("REPORTING_OBSERVATION_CANCELLED");
    outcome = "PASS";
  } catch (primary) {
    primaryFailed = true; outcome = "FAIL";
    try { scope.cancel("TEST_FAILURE"); } catch { /* Preserve the original failed assertion/query. */ }
    throw primary;
  } finally {
    bodySettled = true; activeBodies.delete(bodyDone); resolveBody();
    try { await finalize(); } catch (capture) { if (!primaryFailed) throw capture; }
  }
}

/** Never disconnect underneath an unfinished observed database body. The suite
 * retains its unique invented fixture; no shared database or cleanup is used. */
export async function reportingBodiesSettled() {
  if (!activeBodies.size) return true;
  return settledWithin(Promise.all([...activeBodies]).then(() => {}));
}
