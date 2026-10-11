import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { OperationsProcessError, OperationsProcessOwner, operationsPreparationProcess } from "../scripts/portable/operations-preparation-process";
import { prepareOperations } from "../scripts/portable/prepare-operations";
import type { OperatorManifest } from "../lib/portable-runtime/operator";
import { observedOperationsCase } from "./helpers/operations-preparation-observation";
import type { QaCase } from "./helpers/qa-reliability";

const env = { NODE_ENV: "test" as const, PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR };
const options = { cwd: process.cwd(), env, timeoutMs: 3000, maxBuffer: 4096 };
const deadlineProof: { finished: boolean; frameworkAborted: boolean; originalTimeout: boolean; fixtureClosed: boolean; observation?: OperationsProcessError } = { finished: false, frameworkAborted: false, originalTimeout: false, fixtureClosed: false };
async function failure(pending: ReturnType<typeof operationsPreparationProcess>) {
  try { await pending; throw Error("EXPECTED_HARNESS_FAILURE"); }
  catch (error) { expect(error).toBeInstanceOf(OperationsProcessError); return error as OperationsProcessError; }
}
// Only adverse process responses are substituted. Every successful preparation
// still uses both real Compose client calls and the canonical boundary parser.
class ControlledPreparationOwner extends OperationsProcessOwner {
  calls = 0;
  constructor(private failedCall: number, private code: string) { super(); }
  override run(executable: string, argv: string[], selected: Parameters<OperationsProcessOwner["run"]>[2]) {
    this.calls++;
    return this.calls === this.failedCall ? super.run(process.execPath, ["-e", this.code], selected) : super.run(executable, argv, selected);
  }
}
async function preparationFixture() {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "nalanda-operations-adverse-")));
  const project = "nalanda-ci-123-operations-process-control";
  const migration = (await readdir("prisma/postgresql/migrations")).filter(name => /^\d{14}_/.test(name)).sort().at(-1)!;
  const selected: OperatorManifest = { schemaVersion: 1, classification: "INTEGRATION_TEST_ENVIRONMENT", profile: "local-single-node", project, target: path.join(process.cwd(), "tmp", "portable-operator", project), image: "sha256:" + "a".repeat(64), releaseCommit: "a".repeat(40), composeSha256: createHash("sha256").update(await readFile("deploy/portable/compose.yml")).digest("hex"), architecture: "amd64", operationId: "a".repeat(16), postgresMajor: 17, backupVersion: 48, migration, previous: { image: "sha256:" + "b".repeat(64), releaseCommit: "b".repeat(40), migration, backupVersion: 48 }, restoreArtifact: { id: "synthetic-artifact", ciphertextSha256: "c".repeat(64) } };
  const input = path.join(root, "settings.json");
  await writeFile(input, JSON.stringify({ schemaVersion: 1, purpose: "synthetic-integration", profile: selected.profile, applicationOrigin: "https://portable-staging.localhost:8443", manifest: selected }));
  return { root, input };
}

describe.sequential("operations preparation process controls (HARNESS_ONLY)", () => {
  it("demonstrates that a synchronous child prevents timer-driven cancellation delivery", async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20);
    try {
      execFileSync(process.execPath, ["-e", "setTimeout(()=>process.exit(0),150)"], {
        encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
        timeout: 3000, maxBuffer: 4096,
        env
      });
      expect(controller.signal.aborted).toBe(false);
      await new Promise<void>(resolve => setTimeout(resolve, 0));
      expect(controller.signal.aborted).toBe(true);
    } finally { clearTimeout(timer); }
  });
  it("delivers cancellation to an asynchronous child and records actual close", async () => {
    const controller = new AbortController();
    const owner = new OperationsProcessOwner();
    const pending = owner.run(process.execPath, ["-e", "setTimeout(()=>process.exit(0),5000)"], { ...options, signal: controller.signal });
    const timer = setTimeout(() => controller.abort(), 100);
    try {
      const error = await failure(pending);
      expect(error.observation).toMatchObject({ errorCategory: "CANCELLED", closed: true });
      expect(error.observation.durationMs).toBeGreaterThanOrEqual(0);
      expect(error.observation.settled).toBe(process.platform === "win32" ? "UNKNOWN" : "PASS");
      expect(owner.settled).toBe(process.platform !== "win32");
    } finally { clearTimeout(timer); }
  });
  it("distinguishes actual nonzero exit and startup failure without exposing streams", async () => {
    const nonzero = await failure(operationsPreparationProcess(process.execPath, ["-e", "process.stderr.write('HARNESS_PRIVATE_STREAM');process.exit(7)"], options));
    expect(nonzero.observation).toMatchObject({ exit: 7, signal: null, errorCategory: "NONZERO_EXIT", closed: true, settled: "PASS" });
    expect(JSON.stringify(nonzero)).not.toContain("HARNESS_PRIVATE_STREAM");
    const startup = await failure(operationsPreparationProcess(path.join(process.cwd(), "tmp", "no-such-harness-executable"), [], options));
    expect(startup.observation).toMatchObject({ exit: null, signal: null, errorCategory: "STARTUP", closed: true, settled: "PASS" });
  });
  it.each(["stdout", "stderr"] as const)("bounds %s independently before any successful result", async stream => {
    const error = await failure(operationsPreparationProcess(process.execPath, ["-e", `process.${stream}.write('x'.repeat(4097));setTimeout(()=>process.exit(0),5000)`], options));
    expect(error.observation).toMatchObject({ errorCategory: "OUTPUT_LIMIT", closed: true });
    expect(error.observation.settled).toBe(process.platform === "win32" ? "UNKNOWN" : "PASS");
  });
  it("retains a partial output when forced Windows descendant settlement is unknown", async () => {
    const root = await realpath(await mkdtemp(path.join(tmpdir(), "nalanda-operations-process-")));
    const file = path.join(root, "partial.json");
    const owner = new OperationsProcessOwner();
    const pending = owner.run(process.execPath, ["-e", `require('fs').writeFileSync(${JSON.stringify(file)},'{');setTimeout(()=>process.exit(0),5000)`], { ...options, timeoutMs: 300 });
    const error = await failure(pending);
    expect(error.observation).toMatchObject({ errorCategory: "TIMEOUT", closed: true });
    expect(await readFile(file, "utf8")).toBe("{");
    expect(owner.settled).toBe(process.platform !== "win32");
    // This fixed Node harness has no descendants and its actual close is observed.
    // Only the harness may clean up here; the production owner remains UNKNOWN.
    await rm(root, { recursive: true });
  });
  it("does not launch a child for an already aborted signal", async () => {
    const controller = new AbortController(); controller.abort();
    const error = await failure(operationsPreparationProcess(process.execPath, ["-e", "process.exit(9)"], { ...options, signal: controller.signal }));
    expect(error.observation).toEqual({ exit: null, signal: null, errorCategory: "CANCELLED", closed: true, settled: "PASS", durationMs: 0 });
  });
  it.runIf(process.platform !== "win32")("bounds reconciliation after a spontaneously signalled POSIX leader leaves a descendant", async () => {
    const grandchild = "process.on('SIGTERM',()=>{});process.send('READY');setTimeout(()=>process.exit(0),5000)";
    const leader = `const child=require('child_process').spawn(process.execPath,['-e',${JSON.stringify(grandchild)}],{stdio:['ignore','ignore','ignore','ipc']});child.once('message',()=>process.kill(process.pid,'SIGTERM'))`;
    const error = await failure(operationsPreparationProcess(process.execPath, ["-e", leader], options));
    expect(error.observation.errorCategory).toBe("UNKNOWN");
    expect(error.observation.signal).toBe("SIGTERM");
    expect(error.observation.durationMs).toBeLessThan(3000);
  });
  it.for([
    { caseId: "harness-malformed", failedCall: 1, code: "console.log('not-a-version')", error: "OPERATIONS_COMPOSE_VERSION_UNSUPPORTED", attempt: 1 },
    { caseId: "harness-initialization", failedCall: 2, code: "console.log('{HARNESS_PRIVATE_INVALID_JSON')", error: "OPERATIONS_COMPOSE_JSON_INVALID", attempt: 1 },
    { caseId: "harness-nonzero", failedCall: 3, code: "process.stderr.write('HARNESS_PRIVATE_FAILURE');process.exit(7)", error: "OPERATIONS_COMPOSE_PROCESS_NONZERO_EXIT", attempt: 2 },
    { caseId: "harness-partial", failedCall: 4, code: "console.log('{HARNESS_PRIVATE_INVALID_JSON')", error: "OPERATIONS_COMPOSE_JSON_INVALID", attempt: 2 }
  ] as const)("retains and refuses partial outputs for $caseId in preparation $attempt", async (control, context) => observedOperationsCase(context, control.caseId as QaCase, async scope => {
    const fixture = await scope.fixture(preparationFixture, fixture => rm(fixture.root, { recursive: true }));
    const owner = new ControlledPreparationOwner(control.failedCall, control.code);
    scope.registerProcessOwner(owner);
    const first = path.join(fixture.root, "first"), second = path.join(fixture.root, "second");
    let original: string | undefined;
    if (control.attempt === 2) {
      await prepareOperations(fixture.input, process.cwd(), first, { ...scope.execution(1), processOwner: owner });
      original = await scope.phase("filesystem-check", () => readFile(path.join(first, "preparation.json"), "utf8"), 1);
      expect((await readdir(first)).length).toBe(13);
    }
    const output = control.attempt === 1 ? first : second;
    await scope.phase("artifact-refusal", async () => {
      await expect(prepareOperations(fixture.input, process.cwd(), output, { ...scope.execution(control.attempt), processOwner: owner })).rejects.toThrow(control.error);
      expect(await readdir(output)).toEqual(["compose-interpolation.empty"]);
      expect(owner.calls).toBe(control.failedCall);
      // The partial directory cannot be reused, and refusal launches no child.
      await expect(prepareOperations(fixture.input, process.cwd(), output, { ...scope.execution(0), processOwner: owner })).rejects.toThrow();
      expect(owner.calls).toBe(control.failedCall);
      expect(await readdir(output)).toEqual(["compose-interpolation.empty"]);
      if (original !== undefined) expect(await readFile(path.join(first, "preparation.json"), "utf8")).toBe(original);
    });
  }));
  it("preserves a primary body failure when fixture cleanup also fails", async context => {
    await expect(observedOperationsCase(context, "harness-missing", async scope => {
      scope.registerFixture(async () => { throw Error("HARNESS_CLEANUP_FAILURE"); });
      throw Error("HARNESS_PRIMARY_FAILURE");
    })).rejects.toThrow("HARNESS_PRIMARY_FAILURE");
  });
  it("registers an allocated fixture before post-action cancellation is checked", async context => {
    const controller = new AbortController();
    let root: string | undefined, cleaned = false;
    await expect(observedOperationsCase({ signal: controller.signal, onTestFinished: context.onTestFinished }, "harness-clean", async scope => {
      await scope.fixture(async () => {
        root = await realpath(await mkdtemp(path.join(tmpdir(), "nalanda-operations-allocation-")));
        controller.abort();
        return root;
      }, async fixture => { await rm(fixture, { recursive: true }); cleaned = true; });
    })).rejects.toThrow("OPERATIONS_PREPARATION_CANCELLED");
    expect(cleaned).toBe(true);
    await expect(readdir(root!)).rejects.toMatchObject({ code: "ENOENT" });
  });
  it("retains UNKNOWN when allocation cannot register its created fixture", async context => {
    const controller = new AbortController();
    let root: string | undefined, observedSettlement: unknown;
    await expect(observedOperationsCase({ signal: controller.signal, onTestFinished: context.onTestFinished }, "harness-startup", async scope => {
      try {
        await scope.phase("fixture-create", async () => {
          root = await realpath(await mkdtemp(path.join(tmpdir(), "nalanda-operations-unregistered-")));
          controller.abort();
        });
      } finally { observedSettlement = scope.trace; }
    })).rejects.toThrow("OPERATIONS_PREPARATION_CANCELLED");
    expect(await readdir(root!)).toEqual([]);
    expect((observedSettlement as { events: { phase: string; kind: string; status: string }[] }).events).toContainEqual(expect.objectContaining({ phase: "fixture-settlement", kind: "END", status: "UNKNOWN" }));
    // Only this no-child harness knows the root is safe to clean up afterwards.
    await rm(root!, { recursive: true });
  });
  it.fails("cancels owned work at the actual unchanged Vitest deadline (HARNESS_ONLY)", async context => {
    context.onTestFinished(() => {
      deadlineProof.frameworkAborted = context.signal.aborted;
      deadlineProof.originalTimeout = context.signal.reason instanceof Error && context.signal.reason.message.startsWith("Test timed out in 15000ms.");
      deadlineProof.finished = true;
    });
    await observedOperationsCase(context, "harness-timeout", async scope => {
      scope.registerFixture(async () => { deadlineProof.fixtureClosed = true; });
      try {
        await scope.phase("compose-config", () => scope.owner.run(process.execPath, ["-e", "setTimeout(()=>process.exit(0),20000)"], { ...options, timeoutMs: 30000, signal: scope.signal }));
      } catch (error) { if (error instanceof OperationsProcessError) deadlineProof.observation = error; throw error; }
    });
  });
  it("verifies the actual unchanged Vitest deadline capture outside expected-failure semantics", () => {
    // Vitest's it.fails also accepts a failed onTestFinished assertion. Keep all
    // verification in this ordinary case so a broken capture cannot pass.
    expect(deadlineProof).toMatchObject({ finished: true, frameworkAborted: true, originalTimeout: true, fixtureClosed: process.platform !== "win32" });
    expect(deadlineProof.observation?.observation).toMatchObject({ errorCategory: "CANCELLED", closed: true, settled: process.platform === "win32" ? "UNKNOWN" : "PASS" });
  });
});
