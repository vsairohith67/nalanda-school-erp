import { beforeAll, afterAll, it } from "vitest";
import { ServiceTrace } from "../helpers/service-trace";
import { MfaJourneyObservation, mfaPhase } from "../helpers/native-mfa-trace";
const trace = new ServiceTrace(process.env.SERVICE_TRACE_CHILD_FILE!);
const observation = new MfaJourneyObservation(trace), mode = process.env.SERVICE_TRACE_CHILD_MODE!;
afterAll(async () => {
  try {
    if (mode.startsWith("mfa-")) {
      if (!await observation.drain(mode === "mfa-pending" ? 25 : 500)) throw Error("MFA_TEST_IN_FLIGHT_CLEANUP_HELD");
      if (observation.pendingCount) throw Error("HARNESS_ONLY_CLEANUP_ORDER_INVALID");
      await trace.phase("cleanup", async () => {});
    }
  } catch (error) { trace.result("fail"); throw error; }
  finally { trace.close(); }
});
beforeAll(async () => {
  if (process.env.SERVICE_TRACE_CHILD_MODE !== "setup-fail") return;
  try { await trace.phase("setup", async () => { throw Error("HARNESS_ONLY_SETUP_FAILURE"); }); }
  catch (error) { trace.result("fail"); throw error; }
});
it("HARNESS_ONLY expected failure or timeout, never application acceptance", async context => {
  context.onTestFinished(({ task }) => trace.result(task.result?.state));
  if (mode.startsWith("mfa-")) {
    const parent = trace.begin("test_case");
    context.onTestFinished(() => trace.end(parent, true));
    await observation.run(parent, () => mfaPhase("mfa_verify", async () => {
      if (mode === "mfa-fail") throw Error("HARNESS_ONLY_PRIVATE_FAILURE_NEVER_EMITTED");
      if (mode === "mfa-timeout") await new Promise<void>(resolve => setTimeout(resolve, 100));
      else await new Promise<void>(() => {});
    }));
    return;
  }
  await trace.phase("recorder_selftest", async () => {
    if (process.env.SERVICE_TRACE_CHILD_MODE === "fail") throw Error("HARNESS_ONLY_EXPECTED_FAILURE");
    if (process.env.SERVICE_TRACE_CHILD_MODE !== "timeout") throw Error("HARNESS_ONLY_MODE_INVALID");
    await new Promise<void>(() => {});
  });
}, 50);
