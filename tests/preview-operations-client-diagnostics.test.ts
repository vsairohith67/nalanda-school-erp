import { mkdtempSync, readFileSync, readdirSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { operationsPreparationProcess, OperationsProcessError, type OperationsProcessEvent } from "../scripts/portable/operations-preparation-process";
import { OperationsPreparationObservation } from "./helpers/operations-preparation-observation";
import { QaTrace } from "./helpers/qa-reliability";
import { finalizeQaReliability, prepareQaReliability } from "../scripts/qa-recovery-service-traces";

const options = { cwd: process.cwd(), env: { NODE_ENV: "test" as const, PATH: process.env.PATH, SystemRoot: process.env.SystemRoot }, timeoutMs: 3000, maxBuffer: 4096 };
const owner = { contract: "NALANDA_SERVICE_TRACE_V1" as const, source: "a".repeat(40), run: "1", attempt: "1", job: "operations-diagnostic-harness", provider: "sqlite", node: process.version, image: "unavailable", runner: "unavailable" };

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
