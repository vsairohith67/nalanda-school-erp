import { mkdtemp, mkdir, readFile, writeFile, readdir, rm, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import path from "node:path";
import { operatorPlan, runPortableOperator, OPERATOR_COMMANDS, type OperatorAdapter, type OperatorStep, type OperatorReceipt, type OperatorManifest } from "../lib/portable-runtime/operator";
import { CiOperatorAdapter, assertEphemeralCi, validateComposeBoundary } from "../scripts/portable/operator-adapter";
const manifest: OperatorManifest = { schemaVersion: 1, operationId: "aaaaaaaaaaaaaaaa", restoreArtifact: { id: "synthetic-artifact", ciphertextSha256: "c".repeat(64) }, classification: "INTEGRATION_TEST_ENVIRONMENT", profile: "local-single-node", project: "nalanda-ci-123-test", target: path.resolve("tmp/synthetic-operator-target"), image: `sha256:${"a".repeat(64)}`, releaseCommit: "a".repeat(40), composeSha256: "b".repeat(64), architecture: "amd64", postgresMajor: 17, backupVersion: 45, migration: "20260904120000_communication_delivery_foundation_1a", previous: { image: `sha256:${"b".repeat(64)}`, releaseCommit: "b".repeat(40), backupVersion: 45, migration: "20260904120000_communication_delivery_foundation_1a" } };
class SyntheticAdapter implements OperatorAdapter {
  receipt: OperatorReceipt | null = null; effects: OperatorStep[] = []; locked = false; fail: OperatorStep | null = null;
  resources = { data: "synthetic rows", backup: "encrypted bytes", key: "synthetic key" };
  async preflight() {} async inspectTarget() {}
  async acquire() { if (this.locked) throw new Error("LOCK_CONTENDED"); this.locked = true; }
  async release() { this.locked = false; }
  async readReceipt() { return this.receipt ? structuredClone(this.receipt) : null; }
  async writeReceipt(value: OperatorReceipt) { this.receipt = structuredClone(value); }
  async execute(step: OperatorStep) { if (this.fail === step) throw new Error("synthetic failure with private content"); this.effects.push(step); }
  async reconcile(step: OperatorStep) { return this.effects.includes(step) ? "COMPLETE" as const : "NOT_STARTED" as const; }
}
describe("portable executable orchestration", () => {
  it.each(OPERATOR_COMMANDS)("defaults %s to no mutations", async command => {
    const adapter = new SyntheticAdapter(); const result = await runPortableOperator(command, manifest, adapter);
    expect(result.state).toBe("DRY_RUN"); expect(adapter.receipt).toBeNull(); expect(adapter.locked).toBe(false);
    expect(adapter.effects).toEqual(command === "doctor" ? ["validate", "migration-status", "readiness"] : []);
  });
  for (const command of OPERATOR_COMMANDS.filter(c => !["preflight", "doctor"].includes(c))) {
    for (const step of operatorPlan(command, manifest).steps) {
      it(`${command} preserves evidence/data and resumes after ${step} fails`, async () => {
        const adapter = new SyntheticAdapter(); const before = structuredClone(adapter.resources); adapter.fail = step;
        await expect(runPortableOperator(command, manifest, adapter, { apply: true })).rejects.toThrow("OPERATOR_STEP_FAILED");
        expect(adapter.receipt?.state).toBe("FAILED"); expect(adapter.receipt?.uncertain).toBe(step);
        expect(JSON.stringify(adapter.receipt)).not.toContain("private content"); expect(adapter.locked).toBe(false);
        adapter.fail = null; await runPortableOperator(command, manifest, adapter, { apply: true, resume: true });
        expect(adapter.effects).toEqual(operatorPlan(command, manifest).steps); expect(adapter.receipt?.state).toBe("COMPLETE"); expect(adapter.resources).toEqual(before);
        await runPortableOperator(command, manifest, adapter, { apply: true, resume: true });
        expect(adapter.effects).toEqual(operatorPlan(command, manifest).steps);
      });
    }
  }
  it("rechecks target admission under lock and preserves competing failure evidence", async () => {
    class ContendedAdapter extends SyntheticAdapter {
      inspections = 0;
      async inspectTarget() { this.inspections++; if (this.locked) throw new Error("OTHER_OPERATION_REQUIRES_RECONCILIATION"); }
    }
    const adapter = new ContendedAdapter();
    await expect(runPortableOperator("install", manifest, adapter, { apply: true })).rejects.toThrow("OPERATOR_STEP_FAILED");
    expect(adapter.inspections).toBe(2); expect(adapter.receipt).toBeNull();
    expect(adapter.effects).toEqual([]); expect(adapter.locked).toBe(false);
  });
  it("blocks changed plans, schema downgrade and unclassified effects", async () => {
    expect(() => operatorPlan("rollback", { ...manifest, previous: { ...manifest.previous, migration: "older" } })).toThrow("ROLLBACK_SCHEMA_INCOMPATIBLE");
    const adapter = new SyntheticAdapter(); adapter.fail = "migrate";
    await expect(runPortableOperator("migrate", manifest, adapter, { apply: true })).rejects.toThrow();
    await expect(runPortableOperator("upgrade", manifest, adapter, { apply: true, resume: true })).rejects.toThrow("RESUME_PLAN_MISMATCH");
  });
  it("rejects ambiguous/relative targets, arbitrary commands and external environments", () => {
    for (const bad of [{ target: "relative" }, { classification: "PRODUCTION" }, { postgresMajor: 16 }, { image: "latest" }, { secret: "private" }, { project: "unrelated" }]) expect(() => operatorPlan("install", { ...manifest, ...bad })).toThrow();
    expect(() => assertEphemeralCi({})).toThrow("EPHEMERAL_EXACT_HEAD_CI_REQUIRED");
    expect(() => validateComposeBoundary({ services: { web: { network_mode: "host" } }, networks: {} }, "/work", "/work/tmp")).toThrow();
    expect(() => validateComposeBoundary({ services: {}, networks: { data: { external: true } } }, "/work", "/work/tmp")).toThrow();
    expect(() => validateComposeBoundary({ services: { web: { volumes: [{ type: "bind", source: "/private/dev.db", read_only: true }] } }, networks: {} }, "/work", "/work/tmp")).toThrow();
  });
});

// Filesystem/Compose process boundary is real; no Docker process or ERP is started.
describe("durable filesystem and synthetic process adapter", () => {
  const config = () => ({ networks: { data: { internal: true } }, volumes: {}, services: Object.fromEntries(
    ["web-1", "web-2", "reverse-proxy", "backup-worker", "migrator", "seed", "backup-qa"].map(name => [name, {
      image: "nalanda-portable-staging:test", environment: { NALANDA_SYNTHETIC_STAGING: "true", PORTABLE_EXPECTED_POSTGRES_MIGRATION: manifest.migration }, depends_on: { seed: { condition: "service_completed_successfully" } }
    }])) });
  it("installs, backs up, resumes terminal receipt, diagnoses and uninstalls without removing data", async () => {
    const workspace = await realpath(await mkdtemp(path.join(tmpdir(), "nalanda-operator-test-")));
    const target = path.join(workspace, "tmp", "portable-operator", manifest.project);
    const m = { ...manifest, target }; const calls: string[][] = [];
    const processAdapter = async (args: string[]) => {
      calls.push(args);
      if (args.includes("config")) return JSON.stringify(config());
      if (args.includes("dist/portable/operator-recovery.mjs")) return JSON.stringify({ state: "VERIFIED", operationId: args.at(-1), backupVersion: 45, id: "synthetic-artifact", ciphertextSha256: "c".repeat(64) });
      return "";
    };
    class IsolatedAdapter extends CiOperatorAdapter { async preflight() {} }
    const adapter = (command: any, selected = m, resume = false) => new IsolatedAdapter(workspace, selected, path.join(workspace, "deploy/portable/compose.yml"), command, processAdapter, resume);
    try {
      await runPortableOperator("install", m, adapter("install"), { apply: true });
      const resolved = JSON.parse(await readFile(path.join(target, "compose.json"), "utf8"));
      expect(resolved.services.seed).toBeUndefined();
      expect(resolved.services["reverse-proxy"].environment.PORTABLE_UPSTREAMS).toBe("web-1:3000");
      expect(resolved.services["web-1"].image).toBe(m.image);
      const start = calls.find(args => args.includes("up") && args.includes("web-1"))!;
      expect(start).not.toContain("web-2"); expect(start).toContain("reverse-proxy"); expect(start).toContain("backup-worker");
      const terminal = await readFile(path.join(target, `${m.operationId}.install.receipt.json`), "utf8");
      const priorCalls = calls.length;
      await runPortableOperator("install", m, adapter("install", m, true), { apply: true, resume: true });
      expect(calls.length).toBe(priorCalls);
      await writeFile(path.join(target, "preserved-synthetic-data"), "synthetic bytes");
      const next = { ...m, operationId: "bbbbbbbbbbbbbbbb" };
      await runPortableOperator("backup", next, adapter("backup", next), { apply: true });
      expect(JSON.parse(await readFile(path.join(target, `${next.operationId}.backup.result.json`), "utf8")).state).toBe("VERIFIED");
      await expect(runPortableOperator("uninstall", next, adapter("uninstall", next), { apply: true })).rejects.toThrow("OPERATION_ID_ALREADY_USED");
      const pending = { schemaVersion: 1, command: "upgrade", planHash: "f".repeat(64), state: "FAILED", completed: ["validate"], uncertain: "backup", safeCode: "OPERATOR_STEP_FAILED" };
      const pendingFile = path.join(target, "dddddddddddddddd.upgrade.receipt.json");
      await writeFile(pendingFile, JSON.stringify(pending));
      const blocked = { ...next, operationId: "eeeeeeeeeeeeeeee" };
      await expect(runPortableOperator("backup", blocked, adapter("backup", blocked), { apply: true })).rejects.toThrow("OTHER_OPERATION_REQUIRES_RECONCILIATION");
      await rm(pendingFile); // Synthetic test fixture only; no operator clears another receipt.
      const beforeDoctor = await readdir(target);
      await runPortableOperator("doctor", next, adapter("doctor", next));
      expect(await readdir(target)).toEqual(beforeDoctor);
      const uninstall = { ...next, operationId: "cccccccccccccccc" };
      await runPortableOperator("uninstall", uninstall, adapter("uninstall", uninstall), { apply: true });
      expect(await readFile(path.join(target, "preserved-synthetic-data"), "utf8")).toBe("synthetic bytes");
      expect(await readFile(path.join(target, `${m.operationId}.install.receipt.json`), "utf8")).toBe(terminal);
      expect(calls.flat()).not.toContain("down"); expect(calls.flat()).not.toContain("--volumes");
      expect((await readdir(path.dirname(target))).some(name => name.endsWith(".lock"))).toBe(false);
    } finally { if (!workspace.startsWith(path.join(await realpath(tmpdir()), "nalanda-operator-test-"))) throw new Error("TEST_CLEANUP_BOUNDARY"); await rm(workspace, { recursive: true }); }
  });
  it.each(["migrate", "start", "readiness"] as const)("recovers real durable receipts after completed %s and receipt-write failure", async failedStep => {
    const workspace = await realpath(await mkdtemp(path.join(tmpdir(), "nalanda-operator-test-")));
    const m = { ...manifest, target: path.join(workspace, "tmp", "portable-operator", manifest.project) };
    const calls: string[][] = [];
    const processAdapter = async (args: string[]) => { calls.push(args); return args.includes("config") ? JSON.stringify(config()) : ""; };
    let inject = true;
    class FaultAdapter extends CiOperatorAdapter {
      async preflight() {}
      async writeReceipt(receipt: OperatorReceipt) {
        if (inject && receipt.completed.at(-1) === failedStep && receipt.uncertain === null) { inject = false; throw new Error("synthetic disk fault"); }
        await super.writeReceipt(receipt);
      }
    }
    const make = (resume = false) => new FaultAdapter(workspace, m, path.join(workspace, "deploy/portable/compose.yml"), "install", processAdapter, resume);
    try {
      await expect(runPortableOperator("install", m, make(), { apply: true })).rejects.toThrow("OPERATOR_STEP_FAILED");
      const receipt = JSON.parse(await readFile(path.join(m.target, `${m.operationId}.install.receipt.json`), "utf8"));
      expect(receipt.state).toBe("FAILED");
      await runPortableOperator("install", m, make(true), { apply: true, resume: true });
      expect(JSON.parse(await readFile(path.join(m.target, `${m.operationId}.install.receipt.json`), "utf8")).state).toBe("COMPLETE");
      expect(calls.filter(a => a.includes("run") && a.at(-1) === "migrator")).toHaveLength(1);
      const configFile = path.join(m.target, "compose.json"); const tampered = JSON.parse(await readFile(configFile, "utf8"));
      tampered.services["web-1"].network_mode = "host"; await writeFile(configFile, JSON.stringify(tampered));
      const priorCalls = calls.length;
      await expect(make().execute("readiness", m)).rejects.toThrow("COMPOSE_HOST_ACCESS_FORBIDDEN");
      expect(calls).toHaveLength(priorCalls);
      delete tampered.services["web-1"].network_mode;
      tampered.services.migrator.command = ["dist/portable/runtime-command.mjs", "seed-synthetic"];
      await writeFile(configFile, JSON.stringify(tampered));
      await expect(make().execute("migrate", m)).rejects.toThrow("RESOLVED_CONFIG_PROVENANCE_MISMATCH");
      expect(calls.filter(a => a.includes("run") && a.at(-1) === "migrator")).toHaveLength(1);

    } finally { if (!workspace.startsWith(path.join(await realpath(tmpdir()), "nalanda-operator-test-"))) throw new Error("TEST_CLEANUP_BOUNDARY"); await rm(workspace, { recursive: true }); }
  });
  it("preserves a rejected resume receipt byte-for-byte", async () => {
    const a = new SyntheticAdapter(); a.fail = "migrate";
    await expect(runPortableOperator("migrate", manifest, a, { apply: true })).rejects.toThrow();
    const prior = JSON.stringify(a.receipt);
    await expect(runPortableOperator("upgrade", manifest, a, { apply: true, resume: true })).rejects.toThrow("RESUME_PLAN_MISMATCH");
    expect(JSON.stringify(a.receipt)).toBe(prior);
    a.reconcile = async () => "UNKNOWN" as never;
    await expect(runPortableOperator("migrate", manifest, a, { apply: true, resume: true })).rejects.toThrow("PARTIAL_EFFECT_REQUIRES_RECONCILIATION");
    expect(JSON.stringify(a.receipt)).toBe(prior);
  });
});
