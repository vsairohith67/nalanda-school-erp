import { beforeAll, afterAll, it } from "vitest";
import { ServiceTrace } from "../helpers/service-trace";
const trace = new ServiceTrace(process.env.SERVICE_TRACE_CHILD_FILE!);
afterAll(() => trace.close());
beforeAll(async () => {
  if (process.env.SERVICE_TRACE_CHILD_MODE !== "setup-fail") return;
  try { await trace.phase("setup", async () => { throw Error("HARNESS_ONLY_SETUP_FAILURE"); }); }
  catch (error) { trace.result("fail"); throw error; }
});
it("HARNESS_ONLY expected failure or timeout, never application acceptance", async context => {
  context.onTestFinished(({ task }) => trace.result(task.result?.state));
  await trace.phase("recorder_selftest", async () => {
    if (process.env.SERVICE_TRACE_CHILD_MODE === "fail") throw Error("HARNESS_ONLY_EXPECTED_FAILURE");
    if (process.env.SERVICE_TRACE_CHILD_MODE !== "timeout") throw Error("HARNESS_ONLY_MODE_INVALID");
    await new Promise<void>(() => {});
  });
}, 50);
