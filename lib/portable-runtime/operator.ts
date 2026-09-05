import { createHash } from "node:crypto";
import path from "node:path";

export const OPERATOR_COMMANDS = ["preflight", "doctor", "install", "initialise", "migrate", "backup", "restore", "upgrade", "rollback", "uninstall"] as const;
export type OperatorCommand = typeof OPERATOR_COMMANDS[number];
export const PORTABLE_PROFILES = Object.freeze({
  "local-single-node": { replicas: 1, minCpu: 4, minMemoryMiB: 8192, minFreeMiB: 20480, postgresMajor: 17, backupVersion: 45 },
  "generic-vps": { replicas: 2, minCpu: 4, minMemoryMiB: 8192, minFreeMiB: 40960, postgresMajor: 17, backupVersion: 45 }
});
export type OperatorManifest = {
  schemaVersion: 1; classification: "INTEGRATION_TEST_ENVIRONMENT";
  profile: keyof typeof PORTABLE_PROFILES; project: string; target: string;
  image: string; releaseCommit: string; composeSha256: string; architecture: "amd64" | "arm64";
  operationId: string;
  restoreArtifact?: { id: string; ciphertextSha256: string };
  postgresMajor: 17; backupVersion: 45; migration: string;
  previous?: { image: string; releaseCommit: string; migration: string; backupVersion: 45 };
};
export type OperatorStep = "validate" | "dependencies" | "migration-status" | "backup" | "migrate" | "start" | "readiness" | "restore" | "stop-app" | "remove-app";
export type OperatorReceipt = { schemaVersion: 1; planHash: string; command: OperatorCommand; state: "IN_PROGRESS" | "FAILED" | "COMPLETE"; completed: OperatorStep[]; uncertain: OperatorStep | null; safeCode: string };
export interface OperatorAdapter {
  preflight(manifest: OperatorManifest): Promise<void>;
  inspectTarget(manifest: OperatorManifest, command: OperatorCommand): Promise<void>;
  acquire(): Promise<void>;
  release(): Promise<void>;
  readReceipt(): Promise<OperatorReceipt | null>;
  writeReceipt(receipt: OperatorReceipt): Promise<void>;
  execute(step: OperatorStep, manifest: OperatorManifest): Promise<void>;
  reconcile(step: OperatorStep, manifest: OperatorManifest): Promise<"COMPLETE" | "NOT_STARTED" | "UNKNOWN">;
}
const sha = /^[a-f0-9]{40}$/;
const image = /^sha256:[a-f0-9]{64}$/;
export function validateOperatorManifest(raw: unknown): OperatorManifest {
  const m = raw as OperatorManifest;
  const allowed = ["schemaVersion", "classification", "profile", "project", "target", "image", "releaseCommit", "composeSha256", "architecture", "postgresMajor", "backupVersion", "migration", "previous", "operationId", "restoreArtifact"];
  if (!m || typeof m !== "object" || Array.isArray(m) || Object.keys(m).some(k => !allowed.includes(k)) || m.schemaVersion !== 1 || m.classification !== "INTEGRATION_TEST_ENVIRONMENT"
    || !Object.hasOwn(PORTABLE_PROFILES, m.profile) || !/^nalanda-ci-[a-z0-9-]{3,64}$/.test(m.project)
    || typeof m.target !== "string" || !path.isAbsolute(m.target) || path.normalize(m.target) !== m.target || m.target === path.parse(m.target).root
    || !image.test(m.image) || !sha.test(m.releaseCommit) || !/^[a-f0-9]{64}$/.test(m.composeSha256)
    || !/^[a-f0-9]{16}$/.test(m.operationId) || !["amd64", "arm64"].includes(m.architecture) || m.postgresMajor !== 17 || m.backupVersion !== 45 || !/^\d{14}_[a-z0-9_]+$/.test(m.migration)) throw new Error("OPERATOR_MANIFEST_INVALID");
  if (m.restoreArtifact && (Object.keys(m.restoreArtifact).sort().join() !== "ciphertextSha256,id" || !/^[a-z0-9-]{8,64}$/.test(m.restoreArtifact.id) || !/^[a-f0-9]{64}$/.test(m.restoreArtifact.ciphertextSha256))) throw new Error("RESTORE_ARTIFACT_INVALID");
  if (m.previous && (Object.keys(m.previous).sort().join() !== "backupVersion,image,migration,releaseCommit" || !image.test(m.previous.image) || !sha.test(m.previous.releaseCommit) || m.previous.migration !== m.migration || m.previous.backupVersion !== 45)) throw new Error("ROLLBACK_SCHEMA_INCOMPATIBLE");
  return structuredClone(m);
}
export function operatorPlan(command: OperatorCommand, raw: unknown) {
  const manifest = validateOperatorManifest(raw);
  if (!OPERATOR_COMMANDS.includes(command)) throw new Error("OPERATOR_COMMAND_INVALID");
  if (["upgrade", "rollback"].includes(command) && !manifest.previous) throw new Error("PREVIOUS_RELEASE_REQUIRED");
  if (command === "restore" && !manifest.restoreArtifact) throw new Error("EXPLICIT_RESTORE_ARTIFACT_REQUIRED");
  const steps: Record<OperatorCommand, OperatorStep[]> = {
    preflight: ["validate"], doctor: ["validate", "migration-status", "readiness"],
    install: ["validate", "dependencies", "migrate", "start", "readiness"], initialise: ["validate", "dependencies", "migrate", "start", "readiness"],
    migrate: ["validate", "migration-status", "backup", "stop-app", "migrate", "start", "readiness"],
    backup: ["validate", "backup"], restore: ["validate", "restore"],
    upgrade: ["validate", "migration-status", "backup", "stop-app", "migrate", "start", "readiness"],
    rollback: ["validate", "migration-status", "stop-app", "start", "readiness"],
    uninstall: ["validate", "stop-app", "remove-app"]
  };
  const plan = { command, manifest, steps: steps[command], preserve: ["data", "volumes", "backups", "keys"], automaticRollback: false };
  return { ...plan, planHash: createHash("sha256").update(JSON.stringify(plan)).digest("hex") };
}

export async function runPortableOperator(command: OperatorCommand, raw: unknown, adapter: OperatorAdapter, options: { apply?: boolean; resume?: boolean } = {}) {
  const plan = operatorPlan(command, raw);
  await adapter.preflight(plan.manifest);
  // Read-only diagnostics execute probes, but do not write receipts or acquire mutation locks.
  if (!options.apply || command === "preflight" || command === "doctor") {
    if (command === "doctor") for (const step of plan.steps) await adapter.execute(step, plan.manifest);
    return { state: "DRY_RUN" as const, plan };
  }
  await adapter.inspectTarget(plan.manifest, command);
  await adapter.acquire();
  let receipt: OperatorReceipt = { schemaVersion: 1, command, planHash: plan.planHash, state: "IN_PROGRESS", completed: [], uncertain: null, safeCode: "STARTED" };
  let admittedReceipt = false;
  try {
    const old = await adapter.readReceipt();
    if (old) {
      if (!options.resume || old.planHash !== plan.planHash || old.command !== command || old.schemaVersion !== 1) throw new Error("RESUME_PLAN_MISMATCH");
      if (!Array.isArray(old.completed) || old.completed.some((s, i) => s !== plan.steps[i]) || old.completed.length > plan.steps.length || (old.uncertain && old.uncertain !== plan.steps[old.completed.length]) || !["IN_PROGRESS", "FAILED", "COMPLETE"].includes(old.state) || old.state === "COMPLETE" && (old.completed.length !== plan.steps.length || old.uncertain !== null)) throw new Error("RESUME_RECEIPT_INVALID");
      receipt = structuredClone(old);
      if (old.state === "COMPLETE") return { state: "COMPLETE" as const, receipt };
      if (old.uncertain) {
        const resolution = await adapter.reconcile(old.uncertain, plan.manifest);
        if (resolution === "UNKNOWN") throw new Error("PARTIAL_EFFECT_REQUIRES_RECONCILIATION");
        if (resolution === "COMPLETE") receipt.completed.push(old.uncertain);
        receipt.uncertain = null;
      }
    }
    admittedReceipt = true;
    for (const step of plan.steps.slice(receipt.completed.length)) {
      receipt.state = "IN_PROGRESS"; receipt.uncertain = step; receipt.safeCode = "STEP_STARTED";
      await adapter.writeReceipt(receipt); // durable intent before mutation
      const selected = command === "rollback" && step === "start" ? { ...plan.manifest, ...plan.manifest.previous } : plan.manifest;
      await adapter.execute(step, selected);
      receipt.completed.push(step); receipt.uncertain = null; receipt.safeCode = "STEP_COMPLETE";
      await adapter.writeReceipt(receipt);
    }
    receipt.state = "COMPLETE"; receipt.safeCode = "COMPLETE"; await adapter.writeReceipt(receipt);
    return { state: "COMPLETE" as const, receipt };
  } catch (error) {
    receipt.state = "FAILED"; receipt.safeCode = "OPERATOR_STEP_FAILED";
    // Never copy arbitrary process errors, secrets, stdout or paths into evidence.
    if (admittedReceipt) await adapter.writeReceipt(receipt);
    throw new Error(error instanceof Error && ["RESUME_PLAN_MISMATCH", "RESUME_RECEIPT_INVALID", "PARTIAL_EFFECT_REQUIRES_RECONCILIATION"].includes(error.message) ? error.message : "OPERATOR_STEP_FAILED");
  } finally { await adapter.release(); }
}
