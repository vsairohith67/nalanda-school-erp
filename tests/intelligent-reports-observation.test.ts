import { afterEach, expect, it, vi } from "vitest";
import { IntelligentReportsObservation, observedReportingRole, reportingBodiesSettled } from "./helpers/intelligent-reports-observation";
import * as reliability from "./helpers/qa-reliability";

// Control callbacks are HARNESS_ONLY; these checks never claim an actual IAM or
// provider result. The original service suite supplies the real producer.
afterEach(() => vi.restoreAllMocks());
function control() {
  const trace = new reliability.QaTrace("reporting", "harness-clean");
  vi.spyOn(reliability, "configuredQaTrace").mockReturnValue(trace);
  const controller = new AbortController(), finished: Array<() => Promise<void>> = [];
  const context = { signal: controller.signal, onTestFinished: (callback: () => Promise<void>) => { finished.push(callback); } };
  return { trace, controller, context, finished };
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

it("records finite durations without returning private action data into capture", async () => {
  const c = control();
  await observedReportingRole(c.context, "harness-clean", async scope => {
    expect(await scope.phase("report-user-create", () => "HARNESS_PRIVATE_USER")).toBe("HARNESS_PRIVATE_USER");
    await scope.phase("report-expected-refusal", async () => { await expect(Promise.reject(Error("HARNESS_PRIVATE_REFUSAL"))).rejects.toThrow("HARNESS_PRIVATE_REFUSAL"); });
  });
  await c.finished[0]();
  expect(c.trace.pending.size).toBe(0);
  expect(c.trace.events.filter(event => event.kind === "RESULT").map(event => event.status)).toEqual(["PASS"]);
  expect(c.trace.events.find(event => event.kind === "END" && event.phase === "report-body-settlement")?.status).toBe("PASS");
  expect(JSON.stringify(c.trace.events)).not.toContain("HARNESS_PRIVATE");
});

it("preserves the exact unexpected query error and fails its phase and role", async () => {
  const c = control(), primary = Error("HARNESS_PRIVATE_QUERY_FAILURE");
  await expect(observedReportingRole(c.context, "harness-clean", scope => scope.phase("report-grant-create", () => { throw primary; }))).rejects.toBe(primary);
  await c.finished[0]();
  expect(c.trace.events.find(event => event.kind === "END" && event.phase === "report-grant-create")?.status).toBe("FAIL");
  expect(c.trace.events.find(event => event.kind === "RESULT")?.status).toBe("FAIL");
  expect(await reportingBodiesSettled()).toBe(true);
});

it("rejects before the next action when the scope has already been cancelled", async () => {
  const c = control(), scope = new IntelligentReportsObservation(c.trace), next = vi.fn();
  scope.cancel("UNKNOWN");
  await expect(scope.phase("report-authorization", next)).rejects.toThrow("REPORTING_OBSERVATION_CANCELLED");
  expect(next).not.toHaveBeenCalled();
  expect(c.trace.events.some(event => event.phase === "report-authorization")).toBe(false);
  c.trace.finish("FAIL");
});

it("a deadline during a write prevents subsequent grants or authorization even after that write settles", async () => {
  const c = control(), entered = deferred(), write = deferred(), next = vi.fn();
  const pending = observedReportingRole(c.context, "harness-clean", async scope => {
    await scope.phase("report-user-create", async () => { entered.resolve(); await write.promise; });
    await scope.phase("report-grant-create", next);
    await scope.phase("report-authorization", next);
  });
  const rejection = expect(pending).rejects.toThrow("REPORTING_OBSERVATION_CANCELLED");
  await entered.promise;
  c.controller.abort(); write.resolve();
  await rejection; await c.finished[0]();
  expect(next).not.toHaveBeenCalled();
  expect(c.trace.events.find(event => event.kind === "RESULT")?.status).toBe("FAIL");
  expect(c.trace.events.find(event => event.kind === "END" && event.phase === "report-body-settlement")?.status).toBe("PASS");
});

it("retains UNKNOWN settlement and an unfinished phase while a cancelled body remains active", async () => {
  const c = control(), entered = deferred(), write = deferred(), next = vi.fn();
  const pending = observedReportingRole(c.context, "harness-clean", async scope => {
    await scope.phase("report-session-create", async () => { entered.resolve(); await write.promise; });
    await scope.phase("report-authorization", next);
  });
  const rejection = expect(pending).rejects.toThrow("REPORTING_OBSERVATION_CANCELLED");
  await entered.promise;
  try {
    c.controller.abort(); await c.finished[0]();
    expect(c.trace.events.find(event => event.kind === "END" && event.phase === "report-body-settlement")?.status).toBe("UNKNOWN");
    expect(c.trace.events.find(event => event.kind === "RESULT")?.status).toBe("FAIL");
    expect([...c.trace.pending.values()].map(value => value.phase)).toEqual(["report-session-create"]);
    expect(await reportingBodiesSettled()).toBe(false);
  } finally { write.resolve(); await rejection; }
  expect(next).not.toHaveBeenCalled();
  expect(await reportingBodiesSettled()).toBe(true);
});

it("an already expired test runs no role body and cannot declare PASS", async () => {
  const c = control(), body = vi.fn(); c.controller.abort();
  await expect(observedReportingRole(c.context, "harness-clean", body)).rejects.toThrow("REPORTING_OBSERVATION_CANCELLED");
  await c.finished[0]();
  expect(body).not.toHaveBeenCalled();
  expect(c.trace.events.find(event => event.kind === "RESULT")?.status).toBe("FAIL");
});
