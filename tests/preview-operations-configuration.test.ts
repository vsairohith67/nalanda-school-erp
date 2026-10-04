import { createHash, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { prepareOperations, runPreparationCli, validateOperationsSettings, validatePreparedCompose } from "../scripts/portable/prepare-operations";
import { runOperatorCli } from "../scripts/portable/operator";
import { encryptCloudBackup } from "../lib/cloud-backup-container";
import { makeRecoveryHandoff } from "../lib/portable-runtime/recovery-handoff";
import { CiOperatorAdapter } from "../scripts/portable/operator-adapter";
import { OPERATOR_COMMANDS, type OperatorCommand, type OperatorManifest } from "../lib/portable-runtime/operator";

const workspace = process.cwd();
async function manifest(profile: "local-single-node" | "generic-vps"): Promise<OperatorManifest> {
  const project = "nalanda-ci-123-operations-test";
  return { schemaVersion: 1, classification: "INTEGRATION_TEST_ENVIRONMENT", profile, project, target: path.join(workspace, "tmp", "portable-operator", project), image: "sha256:" + "a".repeat(64), releaseCommit: "a".repeat(40), composeSha256: createHash("sha256").update(await readFile("deploy/portable/compose.yml")).digest("hex"), architecture: "amd64", operationId: "a".repeat(16), postgresMajor: 17, backupVersion: 48, migration: (await readdir("prisma/postgresql/migrations")).filter(name => /^\d{14}_/.test(name)).sort().at(-1)!, previous: { image: "sha256:" + "b".repeat(64), releaseCommit: "b".repeat(40), migration: (await readdir("prisma/postgresql/migrations")).filter(name => /^\d{14}_/.test(name)).sort().at(-1)!, backupVersion: 48 }, restoreArtifact: { id: "synthetic-artifact", ciphertextSha256: "c".repeat(64) } };
}
async function fixture() {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "nalanda-operations-config-")));
  return { root, input: path.join(root, "settings.json"), output: path.join(root, "prepared"), async close() { expect(root.startsWith(path.join(await realpath(tmpdir()), "nalanda-operations-config-"))).toBe(true); await rm(root, { recursive: true }); } };
}
describe("explicit offline operations preparation", () => {
  it("keeps backup counters process-local across separate replicas and a fresh restart", () => {
    const moduleUrl = pathToFileURL(path.join(workspace, "lib", "portable-runtime", "observability.ts")).href;
    const observe = (increment: boolean) => JSON.parse(execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `import {incrementPortableMetric,portableMetricsText} from ${JSON.stringify(moduleUrl)};const before=portableMetricsText();${increment ? 'incrementPortableMetric("nalanda_backup_success_total");' : ''}console.log(JSON.stringify({before,after:portableMetricsText()}));`], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], windowsHide: true, timeout: 10000, env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, NODE_ENV: "test" } }));
    for (let replica = 0; replica < 2; replica++) {
      const observed = observe(true);
      expect(observed.before).not.toContain("nalanda_backup_success_total");
      expect(observed.after).toContain("nalanda_backup_success_total 1\n");
    }
    expect(observe(false).after).not.toContain("nalanda_backup_success_total");
  });
  it.each(["local-single-node", "generic-vps"] as const)("parses effective canonical Compose and connects all existing argv for %s", async profile => {
    const f = await fixture();
    try {
      const selected = await manifest(profile);
      await writeFile(f.input, JSON.stringify({ schemaVersion: 1, purpose: "synthetic-integration", profile, applicationOrigin: "https://portable-staging.localhost:8443", manifest: selected }));
      vi.stubEnv("DATABASE_URL", "must-not-be-discovered"); vi.stubEnv("PORTABLE_IMAGE_ID", "latest"); vi.stubEnv("COMPOSE_FILE", "foreign.yml");
      const result = await runPreparationCli(["--settings", f.input, "--workspace", workspace, "--output", f.output]);
      expect(result).toMatchObject({ state: "SYNTHETIC_CONFIGURATION_PREPARED_NOT_ADMITTED", executable: false, admitted: false, profile });
      expect(result.unresolved).toContain("REQUIRED_SECRET_FILES");
      const commands = JSON.parse(await readFile(path.join(f.output, "commands.json"), "utf8"));
      expect(commands.commands.map((entry: any) => entry.command)).toEqual([...OPERATOR_COMMANDS]);
      let qualified = 0;
      for (const entry of commands.commands) {
        const effect = vi.fn();
        const value = await runOperatorCli(entry.argv.slice(1), { qualify: m => { expect(m).toEqual({...selected, operationId: entry.operationId}); qualified++; }, adapter: () => ({ preflight: async () => {}, inspectTarget: async () => {}, acquire: async () => {}, release: async () => {}, readReceipt: async () => null, writeReceipt: async () => {}, execute: effect, reconcile: async () => "UNKNOWN" }) });
        expect(value.state).toBe("DRY_RUN");
        expect(effect).toHaveBeenCalledTimes(entry.command === "doctor" ? 3 : 0);
      }
      expect(qualified).toBe(10);
      expect(new Set(commands.commands.map((entry: any) => entry.operationId)).size).toBe(10);
      expect(commands.freshOperationIdRequiredForNewMutation).toBe(true);
      const originalReport = await readFile(path.join(f.output, "preparation.json"), "utf8");
      const another = path.join(f.root, "second"); await prepareOperations(f.input, workspace, another);
      expect(await readFile(path.join(another, "preparation.json"), "utf8")).toBe(originalReport);
      expect(originalReport).not.toContain("must-not-be-discovered");
      await expect(prepareOperations(f.input, workspace, f.output)).rejects.toThrow();
      expect(await readFile(path.join(f.output, "preparation.json"), "utf8")).toBe(originalReport);
      // Production qualification still refuses this fabricated test binding.
      await expect(runOperatorCli(commands.commands[0].argv.slice(1))).rejects.toThrow();
    } finally { vi.unstubAllEnvs(); await f.close(); }
  });
  it("uses generated distinct operations through the actual filesystem adapter and retains same-operation resume/refusal", async () => {
    const f = await fixture();
    try {
      for (const file of ["deploy/portable/compose.yml", "deploy/portable/profiles/local-single-node.json"]) {
        await mkdir(path.dirname(path.join(f.root, file)), {recursive: true});
        await copyFile(path.join(workspace, file), path.join(f.root, file));
      }
      const base = await manifest("local-single-node");
      const selected = {...base, target: path.join(f.root, "tmp", "portable-operator", base.project)};
      f.output = path.join(f.root, "tmp", "prepared");
      await mkdir(path.dirname(f.output), {recursive: true});
      await mkdir(path.join(f.root, "prisma", "postgresql", "migrations", selected.migration), {recursive: true});
      await writeFile(f.input, JSON.stringify({schemaVersion: 1, purpose: "synthetic-integration", profile: selected.profile, applicationOrigin: "https://portable-staging.localhost:8443", manifest: selected}));
      await prepareOperations(f.input, f.root, f.output);
      const commands = JSON.parse(await readFile(path.join(f.output, "commands.json"), "utf8")).commands;
      const install = commands.find((row: any) => row.command === "install"), backup = commands.find((row: any) => row.command === "backup");
      const calls: string[][] = [];
      // Existing bounded process fixture: real target locks/markers/config/receipts,
      // injected Docker responses and preflight; no fabricated CI env or daemon.
      const processFixture = async (args: string[]) => {
        calls.push(args);
        if (args.includes("config")) return JSON.stringify({networks: {data: {internal: true}}, services: Object.fromEntries(["web-1", "web-2", "reverse-proxy", "backup-worker", "migrator", "seed", "backup-qa"].map(name => [name, {image: "synthetic-process-fixture", environment: {NALANDA_SYNTHETIC_STAGING: "true", PORTABLE_EXPECTED_POSTGRES_MIGRATION: selected.migration}, depends_on: {seed: {condition: "service_completed_successfully"}}}]))});
        if (args.includes("dist/portable/operator-recovery.mjs")) {
          const encrypted = await encryptCloudBackup(Buffer.from("{}"), {backupFormatVersion: 48, createdAt: new Date(), encryptionKeyVersion: "V1", key: randomBytes(32)});
          const handoff = makeRecoveryHandoff(encrypted.bytes, {sourceProject: selected.project, sourceCommit: selected.releaseCommit, runId: "123", attempt: "1", artifactId: "synthetic-artifact", objectKey: `cloud-backup/${"a".repeat(24)}/${"b".repeat(24)}.npsbackup`});
          return JSON.stringify({state: "VERIFIED", operationId: args.at(-2), backupVersion: 48, id: "synthetic-artifact", ciphertextSha256: handoff.ciphertextSha256, transfer: {manifest: handoff, container: encrypted.bytes.toString("base64")}});
        }
        return "";
      };
      class IsolatedAdapter extends CiOperatorAdapter { async preflight() {} }
      const dependencies = {qualify(m: OperatorManifest) {expect(m.image).toBe(selected.image); expect(m.releaseCommit).toBe(selected.releaseCommit);}, adapter: (_workspace: string, m: OperatorManifest, command: OperatorCommand, resume: boolean) => new IsolatedAdapter(f.root, m, path.join(f.root, "deploy", "portable", "compose.yml"), command, processFixture, resume)};
      await mkdir(path.join(f.root, "tmp", "portable-staging", selected.project), {recursive: true});
      expect((await runOperatorCli([...install.argv.slice(1), "--apply"], dependencies)).state).toBe("COMPLETE");
      const installReceipt = path.join(selected.target, `${install.operationId}.install.receipt.json`);
      const preserved = await readFile(installReceipt, "utf8");
      const badFile = path.join(f.output, "same-operation-backup.json");
      await writeFile(badFile, JSON.stringify({...selected, operationId: install.operationId}));
      const beforeRefusal = calls.length;
      await expect(runOperatorCli(["backup", "--manifest", badFile, "--target", selected.target, "--apply"], dependencies)).rejects.toThrow("OPERATION_ID_ALREADY_USED");
      expect(calls.length).toBe(beforeRefusal);
      expect((await runOperatorCli([...backup.argv.slice(1), "--apply"], dependencies)).state).toBe("COMPLETE");
      const beforeResume = calls.length;
      expect((await runOperatorCli([...backup.argv.slice(1), "--apply", "--resume"], dependencies)).state).toBe("COMPLETE");
      expect(calls.length).toBe(beforeResume);
      expect(await readFile(installReceipt, "utf8")).toBe(preserved);
      expect(JSON.parse(await readFile(path.join(selected.target, `${backup.operationId}.backup.receipt.json`), "utf8")).state).toBe("COMPLETE");
      expect((await readdir(path.dirname(selected.target))).some(name => name.endsWith(".lock"))).toBe(false);
      expect(calls.flat()).not.toContain("--volumes");
    } finally {await f.close();}
  });
  it("prepares future HTTPS requirements without a manifest, secrets, daemon or executable configuration", async () => {
    const f = await fixture();
    try {
      await writeFile(f.input, JSON.stringify({ schemaVersion: 1, purpose: "future-private-preview", profile: "generic-vps", applicationOrigin: "https://preview-erp.nalandaps.com" }));
      const result = await prepareOperations(f.input, workspace, f.output);
      expect(result).toMatchObject({ state: "FUTURE_PREVIEW_PREPARATION_INACTIVE", executable: false, admitted: false });
      expect(result.unresolved).toContain("PRIVATE_PREVIEW_CLASSIFICATION_AND_CONSUMER_CONTRACT");
      expect(await readdir(f.output)).toEqual(["preparation.json"]);
    } finally { await f.close(); }
  });
  it("rejects unknown, secret, callback, conflicting classification/profile and mutable inputs", async () => {
    const base = { schemaVersion: 1, purpose: "synthetic-integration", profile: "local-single-node", applicationOrigin: "https://portable-staging.localhost:8443", manifest: await manifest("local-single-node") };
    for (const change of [{ profile: "provider-selected" }, { applicationOrigin: "https://foreign.invalid" }, { callback: "https://foreign.invalid" }, { secretValue: "PRIVATE" }, { purpose: "future-private-preview" }, { manifest: { ...base.manifest, image: "latest" } }, { manifest: { ...base.manifest, profile: "generic-vps" } }, { manifest: { ...base.manifest, previous: { ...base.manifest.previous, image: base.manifest.image } } }]) expect(() => validateOperationsSettings({ ...base, ...change })).toThrow();
    for (const origin of ["http://preview.invalid", "https://user:private@preview.invalid", "https://preview.invalid/path", "https://preview.invalid?callback=x", "https://localhost"]) expect(() => validateOperationsSettings({ schemaVersion: 1, purpose: "future-private-preview", profile: "generic-vps", applicationOrigin: origin })).toThrow();
    await expect(runPreparationCli(["--apply"])).rejects.toThrow("OPERATIONS_ARGUMENT_INVALID");
    await expect(runPreparationCli(["--settings", "a", "--settings", "b"])).rejects.toThrow("OPERATIONS_ARGUMENT_INVALID");
    const f = await fixture();
    try {
      await writeFile(f.input, JSON.stringify({ ...base, manifest: { ...base.manifest, composeSha256: "0".repeat(64) } }));
      await expect(prepareOperations(f.input, workspace, f.output)).rejects.toThrow("COMPOSE_PROVENANCE_MISMATCH");
      expect(await readdir(f.root)).toEqual(["settings.json"]);
      await expect(prepareOperations("relative.json", workspace, f.output)).rejects.toThrow("OPERATIONS_ABSOLUTE_PATH_REQUIRED");
      await expect(prepareOperations(f.input, workspace, path.join(workspace, "lib", "operations-output"))).rejects.toThrow("OPERATIONS_OUTPUT_OVERLAP");
    } finally { await f.close(); }
  });
  it("rejects dangerous changes after real Compose normalization", async () => {
    const selected = await manifest("local-single-node");
    const f = await fixture();
    try {
      const empty = path.join(f.root, "empty"); await writeFile(empty, "");
      const privateRoot = path.join(workspace, "tmp", "portable-staging", selected.project);
      const base = JSON.parse(execFileSync("docker", ["--context", "default", "compose", "--project-name", selected.project, "--profile", "*", "--env-file", empty, "-f", path.join(workspace, "deploy", "portable", "compose.yml"), "config", "--format", "json", "--no-env-resolution"], { encoding: "utf8", stdio: "pipe", env: { NODE_ENV: "test", PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, PORTABLE_IMAGE_ID: selected.image, PORTABLE_CI_ROOT: privateRoot, PORTABLE_SOURCE_SHA: selected.releaseCommit } }));
      expect(() => validatePreparedCompose(base, workspace, privateRoot, selected)).not.toThrow();
      for (const change of [
        (c: any) => c.services.postgres.ports = [{ host_ip: "127.0.0.1", published: "8443" }],
        (c: any) => c.services["web-1"].environment.NALANDA_TRUSTED_PROXY_MODE = "headers-only",
        (c: any) => c.services["web-1"].environment.NALANDA_NATIVE_ALLOWED_ORIGINS = "https://foreign.invalid",
        (c: any) => c.services["web-1"].environment.AUTH_SECRET = "PRIVATE",
        (c: any) => c.services["web-1"].secrets = [],
        (c: any) => c.services["backup-worker"].environment.TRUST_PROXY_HEADERS = "true",
        (c: any) => c.services["web-1"].environment.DIRECT_URL_FILE = "/run/secrets/direct_url",
        (c: any) => c.services["web-1"].environment.PUBLIC_ADMISSIONS_ENABLED = "true",
        (c: any) => { delete c.services["web-1"].environment.APP_ORIGIN; },
        (c: any) => { c.services["web-1"].environment.APP_ORIGIN = ""; },
        (c: any) => { delete c.services["web-1"].environment.APP_ORIGIN; c.services["web-1"].environment.PUBLIC_ADMISSIONS_ENABLED = "true"; },
        (c: any) => { c.services["web-1"].environment.APP_ORIGIN = ""; c.services["web-1"].environment.PUBLIC_ADMISSIONS_ENABLED = "true"; },
        (c: any) => { delete c.services["web-1"].environment.APP_ORIGIN; c.services["web-1"].environment.NALANDA_NATIVE_ALLOWED_ORIGINS = "https://foreign.invalid"; },
        (c: any) => { delete c.services["web-1"].environment.APP_ORIGIN; c.services["web-1"].environment.NALANDA_TRUSTED_PROXY_MODE = "headers-only"; },
        (c: any) => c.services["web-1"].image = "latest",
        (c: any) => c.services["web-1"].mem_limit = 0,
        (c: any) => c.services["web-1"].build = ".",
        (c: any) => c.services["web-1"].network_mode = "host",
        (c: any) => c.services["web-1"].privileged = true,
        (c: any) => c.services["web-1"].volumes = [{ type: "bind", source: "/var/run/docker.sock", read_only: true }],
        (c: any) => c.secrets.database_url.file = path.join(workspace, "prisma", "dev.db")
      ]) { const bad = structuredClone(base); change(bad); expect(() => validatePreparedCompose(bad, workspace, privateRoot, selected)).toThrow(); }
    } finally { await f.close(); }
  });
});
