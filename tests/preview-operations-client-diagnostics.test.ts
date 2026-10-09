import { mkdtempSync, readFileSync, readdirSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it, vi, type TestContext } from "vitest";
import { operationsPreparationProcess, OperationsProcessError, OperationsProcessOwner, type OperationsProcessEvent } from "../scripts/portable/operations-preparation-process";
import { OperationsPreparationObservation, observedOperationsCase, type OperationsCaseContext } from "./helpers/operations-preparation-observation";
import { QaTrace } from "./helpers/qa-reliability";
import { finalizeQaReliability, prepareQaReliability } from "../scripts/qa-recovery-service-traces";

const options = { cwd: process.cwd(), env: { NODE_ENV: "test" as const, PATH: process.env.PATH, SystemRoot: process.env.SystemRoot }, timeoutMs: 3000, maxBuffer: 4096 };
const owner = { contract: "NALANDA_SERVICE_TRACE_V1" as const, source: "a".repeat(40), run: "1", attempt: "1", job: "operations-diagnostic-harness", provider: "sqlite", node: process.version, image: "unavailable", runner: "unavailable" };

// HARNESS_ONLY clock/lifecycle controls: the real observer and its registered
// finished callback execute, with no Compose client or configured CI journal.
async function isolatedLifecycleControl(assertions: (context: OperationsCaseContext, finish: () => Promise<void>, receipts: any[], controller: AbortController) => Promise<void>, task?: TestContext["task"]) {
  const saved = process.env.NALANDA_QA_RELIABILITY_TRACE_DIR, receipts: any[] = [], controller = new AbortController();
  let finished!: Parameters<TestContext["onTestFinished"]>[0];
  const context: OperationsCaseContext = { signal: controller.signal, ...(task ? { task } : {}), onTestFinished(handler, timeout) { expect(timeout).toBe(3000); finished = handler; } };
  const capture = vi.spyOn(console, "info").mockImplementation(message => { receipts.push(JSON.parse(String(message))); });
  delete process.env.NALANDA_QA_RELIABILITY_TRACE_DIR;
  try { await assertions(context, async () => { expect(finished).toBeTypeOf("function"); await finished({} as TestContext); }, receipts, controller); }
  finally { capture.mockRestore(); if (saved === undefined) delete process.env.NALANDA_QA_RELIABILITY_TRACE_DIR; else process.env.NALANDA_QA_RELIABILITY_TRACE_DIR = saved; }
}

it("HARNESS_ONLY: the revised case declares PASS only after its actual finished callback", async testContext => isolatedLifecycleControl(async (context, finish, receipts) => {
  let trace!: QaTrace;
  await observedOperationsCase(context, "local-single-node", async scope => { trace = scope.trace; scope.registerFixture(async () => {}); scope.execution(1); });
  expect(trace.directory).toBeUndefined();expect(trace.events.some(event => event.kind === "RESULT")).toBe(false);
  expect(Object.getOwnPropertyDescriptor(testContext.task.meta, "operationsLifecycle")).toBeUndefined();
  await finish();
  expect(trace.events.find(event => event.kind === "RESULT")?.status).toBe("PASS");
  const receipt = receipts.find(row => row.stage === "FINISHED");
  expect(receipt).toMatchObject({ scope: "HARNESS_ONLY", declaredResult: "PASS", bodySettled: true, fixtureSettled: true, ownedWorkSettled: true, cancelled: false });
  for (const phase of [receipt.setup, receipt.action, receipt.teardown, receipt.finishedHook]) { expect(phase.startMs).toBeTypeOf("number");expect(phase.endMs).toBeGreaterThanOrEqual(phase.startMs); }
  expect(receipt.totalObservedMs).toBeLessThanOrEqual(48000);
  const binding = Object.getOwnPropertyDescriptor(testContext.task.meta, "operationsLifecycle")!;
  expect(binding).toMatchObject({ enumerable: true, writable: false, configurable: false, value: receipt });
  expect(Object.isFrozen(binding.value)).toBe(true);expect(Object.isFrozen(binding.value.action)).toBe(true);
  expect(JSON.parse(JSON.stringify(testContext.task.meta)).operationsLifecycle).toEqual(receipt);
  expect(JSON.stringify(receipts)).not.toMatch(/"pid"|"env"|"stdout"|"stderr"|"path"/);
}, testContext.task));

it("HARNESS_ONLY: work becoming unsettled after finalization still rejects the finished callback", async () => isolatedLifecycleControl(async (context, finish, receipts) => {
  class UnsettledControlOwner extends OperationsProcessOwner { override get settled() { return false; } }
  let scope!: OperationsPreparationObservation;
  await observedOperationsCase(context, "local-single-node", async value => { scope = value; scope.registerFixture(async () => {}); scope.execution(1); });
  scope.registerProcessOwner(new UnsettledControlOwner());
  await expect(finish()).rejects.toThrow("OPERATIONS_CASE_SETTLEMENT_UNRECONCILED");
  expect(scope.trace.events.find(event => event.kind === "RESULT")?.status).toBe("FAIL");
  expect(receipts.find(row => row.stage === "FINISHED")).toMatchObject({ declaredResult: "FAIL", ownedWorkSettled: false, cancelled: true });
}));

it("HARNESS_ONLY: a failed cleanup preserves its error and cannot manufacture a successful hook", async () => isolatedLifecycleControl(async (context, finish, receipts) => {
  let scope!: OperationsPreparationObservation;
  await expect(observedOperationsCase(context, "local-single-node", async value => { scope = value; scope.execution(1); scope.registerFixture(async () => { throw Error("HARNESS_CLEANUP_FAILED"); }); })).rejects.toThrow("HARNESS_CLEANUP_FAILED");
  await expect(finish()).rejects.toThrow("HARNESS_CLEANUP_FAILED");
  expect(scope.trace.events.find(event => event.kind === "RESULT")?.status).toBe("FAIL");
  expect(scope.trace.events.find(event => event.kind === "END" && event.phase === "fixture-settlement")?.status).toBe("FAIL");
  expect(receipts.find(row => row.stage === "FINISHED")).toMatchObject({ declaredResult: "FAIL", fixtureSettled: null });
}));

it("HARNESS_ONLY: an already aborted finished context retains failure and refuses later actions", async () => isolatedLifecycleControl(async (context, finish, receipts, controller) => {
  let scope!: OperationsPreparationObservation, laterAction = false;
  await observedOperationsCase(context, "local-single-node", async value => { scope = value; scope.registerFixture(async () => {}); scope.execution(1); });
  controller.abort();await finish();
  expect(scope.trace.events.find(event => event.kind === "RESULT")?.status).toBe("FAIL");
  expect(receipts.find(row => row.stage === "FINISHED")).toMatchObject({ declaredResult: "FAIL", cancelled: true });
  await expect(scope.phase("filesystem-check", async () => { laterAction = true; })).rejects.toThrow();
  expect(laterAction).toBe(false);
}));

it("an unregistered expected fixture cannot turn a resolved body into a successful case", async () => {
  let trace!: QaTrace;
  const configuredDirectory = process.env.NALANDA_QA_RELIABILITY_TRACE_DIR;
  // Pure refusal control: no directory or process is allocated. The actual
  // observer must reject its incomplete lifecycle and retain UNKNOWN settlement.
  // Isolate this expected failure from the real integration journal, restoring
  // only this recorder setting before any subsequent test can execute.
  delete process.env.NALANDA_QA_RELIABILITY_TRACE_DIR;
  try {
  await expect(observedOperationsCase({ signal: new AbortController().signal, onTestFinished: () => {} }, "harness-clean", async scope => {
    trace = scope.trace;
    await scope.phase("fixture-create", async () => undefined);
  })).rejects.toThrow("OPERATIONS_PREPARATION_SETTLEMENT_UNRECONCILED");
  expect(trace.events.find(event => event.kind === "RESULT")?.status).toBe("FAIL");
  expect(trace.events.find(event => event.kind === "END" && event.phase === "fixture-settlement")?.status).toBe("UNKNOWN");
  expect(trace.directory).toBeUndefined();
  } finally {
    if (configuredDirectory === undefined) delete process.env.NALANDA_QA_RELIABILITY_TRACE_DIR;
    else process.env.NALANDA_QA_RELIABILITY_TRACE_DIR = configuredDirectory;
  }
});

// Node controls prove event/privacy behavior only, never real Compose startup,
// executable trust, plugin selection or Windows process-tree settlement.
it("retains actual launch, first-stream, exit and pipe-close boundaries exactly once", async () => {
  const events: OperationsProcessEvent[] = [];
  const result = await operationsPreparationProcess(process.execPath, ["-e", "process.stdout.write('HARNESS_PRIVATE_OUT');process.stdout.write('AGAIN');process.stderr.write('HARNESS_PRIVATE_ERR');process.stderr.write('AGAIN')"], { ...options, onEvent: event => { events.push(event); } });
  expect(events.map(event => event.stage).sort()).toEqual(["close", "exit", "first-stderr", "first-stdout", "spawn"]);
  expect(events[0].stage).toBe("spawn");
  expect(events.slice(-2).map(event => event.stage)).toEqual(["exit", "close"]);
  expect(events.every(event => Number.isSafeInteger(event.pid) && event.pid! > 0)).toBe(true);
  expect(result.observation).toMatchObject({ exit: 0, errorCategory: "NONE", closed: true, settled: "PASS" });
  expect(JSON.stringify(events)).not.toContain("HARNESS_PRIVATE");
});

it("a refused launch cannot fabricate spawn, output or exit events", async () => {
  const events: OperationsProcessEvent[] = [];
  let failure: unknown;
  try { await operationsPreparationProcess(path.join(process.cwd(), "tmp", "no-such-diagnostic-control-executable"), [], { ...options, onEvent: event => { events.push(event); } }); }
  catch (error) { failure = error; }
  expect(failure).toBeInstanceOf(OperationsProcessError);
  expect((failure as OperationsProcessError).observation).toMatchObject({ exit: null, errorCategory: "STARTUP", closed: true, settled: "PASS" });
  expect(events).toEqual([{ stage: "close", pid: null }]);
});

it("a capture failure rejects the owned process without an unhandled event exception", async () => {
  let failure: unknown;
  try { await operationsPreparationProcess(process.execPath, ["-e", "setTimeout(()=>process.exit(0),5000)"], { ...options, onEvent: () => { throw Error("HARNESS_PRIVATE_CAPTURE_FAILURE"); } }); }
  catch (error) { failure = error; }
  expect(failure).toBeInstanceOf(OperationsProcessError);
  expect((failure as OperationsProcessError).observation).toMatchObject({ errorCategory: "IO", closed: true, settled: process.platform === "win32" ? "UNKNOWN" : "PASS" });
  expect(JSON.stringify(failure)).not.toContain("HARNESS_PRIVATE_CAPTURE_FAILURE");
});

it.each(["exit", "close"] as const)("a capture failure at %s preserves the actual nonzero exit as primary", async stage => {
  let failure: unknown;
  try { await operationsPreparationProcess(process.execPath, ["-e", "process.exit(7)"], { ...options, onEvent: event => { if (event.stage === stage) throw Error("HARNESS_PRIVATE_SECONDARY_CAPTURE_FAILURE"); } }); }
  catch (error) { failure = error; }
  expect(failure).toBeInstanceOf(OperationsProcessError);
  expect((failure as OperationsProcessError).observation).toMatchObject({ exit: 7, signal: null, errorCategory: "NONZERO_EXIT", closed: true, settled: "PASS" });
  expect(JSON.stringify(failure)).not.toContain("HARNESS_PRIVATE_SECONDARY_CAPTURE_FAILURE");
});

it("the existing finalizer projects finite events while retaining PID and unknown plugin identity privately", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "nalanda-operations-diagnostic-control-"));
  try {
    const privateRoot = path.join(root, "private", "qa-reliability");
    prepareQaReliability(privateRoot, owner);
    const directory = path.join(privateRoot, "operations-harness-clean"); mkdirSync(directory);
    const trace = new QaTrace("operations", "harness-clean", directory), scope = new OperationsPreparationObservation(trace);
    const result = await scope.owner.run(process.execPath, ["-e", "process.stdout.write('HARNESS_PRIVATE_OUT');process.stderr.write('HARNESS_PRIVATE_ERR')"], { ...options, onEvent: event => scope.observer.processEvent!(event, 1) });
    expect(result.observation.settled).toBe("PASS"); trace.finish("PASS");
    const privateFiles = readdirSync(directory).filter(name => name.startsWith("process-"));
    expect(privateFiles).toHaveLength(5);
    for (const file of privateFiles) expect(JSON.parse(readFileSync(path.join(directory, file), "utf8"))).toMatchObject({ pid: expect.any(Number), selectedComposePlugin: "UNKNOWN" });
    const destination = path.join(root, "public"); finalizeQaReliability(privateRoot, destination, owner);
    const raw = readFileSync(path.join(destination, "qa-reliability.json"), "utf8"), publicCase = JSON.parse(raw).cases.find((value: any) => value.family === "operations" && value.caseId === "harness-clean");
    expect(publicCase.classification).toBe("HARNESS_ONLY");
    expect(publicCase.events.filter((value: any) => value.kind === "END").map((value: any) => value.phase).sort()).toEqual(["compose-close", "compose-exit", "compose-first-stderr", "compose-first-stdout", "compose-spawn"]);
    expect(raw).not.toContain('"pid"'); expect(raw).not.toContain("selectedComposePlugin"); expect(raw).not.toContain("HARNESS_PRIVATE");
    expect(readdirSync(destination).sort()).toEqual(["manifest.json", "qa-reliability.json"]);
  } finally { rmSync(root, { recursive: true }); } // This fixed Node control has no descendants and actually closed.
});
