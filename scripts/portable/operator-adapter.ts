import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { lstat, realpath, readdir, mkdir, open, readFile, rename, unlink, statfs } from "node:fs/promises";
import path from "node:path";
import { cpus, totalmem } from "node:os";
import { operatorPlan, PORTABLE_PROFILES, type OperatorAdapter, type OperatorManifest, type OperatorReceipt, type OperatorStep, type OperatorCommand } from "../../lib/portable-runtime/operator";

export async function docker(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", ["--context", "default", ...args], { cwd, shell: false, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
      env: { NODE_ENV: process.env.NODE_ENV ?? "test", PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, HOME: process.env.HOME,
        PORTABLE_CI_ROOT: process.env.PORTABLE_CI_ROOT, PORTABLE_SOURCE_SHA: process.env.PORTABLE_SOURCE_SHA,
        PORTABLE_SOURCE_DATE_EPOCH: process.env.PORTABLE_SOURCE_DATE_EPOCH, PORTABLE_IMAGE_TAG: process.env.PORTABLE_IMAGE_TAG } });
    let output = ""; let size = 0; let failed = false;
    const timer = setTimeout(() => { failed = true; child.kill("SIGKILL"); reject(new Error("OPERATOR_PROCESS_TIMEOUT")); }, 15 * 60_000);
    for (const stream of [child.stdout, child.stderr]) stream.on("data", (data: Buffer) => {
      size += data.length;
      if (size > 4 * 1024 * 1024) { failed = true; child.kill("SIGKILL"); }
      else if (stream === child.stdout) output += data.toString("utf8");
    });
    child.once("error", () => { clearTimeout(timer); reject(new Error("OPERATOR_PROCESS_UNAVAILABLE")); });
    child.once("close", code => { clearTimeout(timer); if (failed || code !== 0) reject(new Error("OPERATOR_PROCESS_FAILED")); else resolve(output); });
  });
}

export function assertEphemeralCi(environment: Record<string, string | undefined> = process.env) {
  if (environment.GITHUB_ACTIONS !== "true" || environment.RUNNER_ENVIRONMENT !== "github-hosted" || environment.RUNNER_OS !== "Linux"
    || environment.GITHUB_REPOSITORY !== "vsairohith67/nalanda-school-erp" || !/^\d+$/.test(environment.GITHUB_RUN_ID ?? "")
    || environment.PORTABLE_CI_EXCEPTION !== "OWNER_AUTHORIZED" || environment.DOCKER_HOST || environment.DOCKER_CONTEXT) throw new Error("EPHEMERAL_EXACT_HEAD_CI_REQUIRED");
}

export function validateComposeBoundary(config: any, workspace: string, syntheticRoot: string) {
  const trackedMounts = new Set(["postgres-init-runtime-role.sh", "valkey-entrypoint.sh", "minio-entrypoint.sh", "minio-bootstrap.sh", "minio-app-policy.json", "minio-backup-policy.json", "minio-backup-maintenance-policy.json", "Caddyfile", "caddy-entrypoint.sh"].map(p => path.join(workspace, "deploy", "portable", p)));
  if (!config || !config.services || Object.values(config.networks ?? {}).some((n: any) => n.external || !n.internal) || Object.values(config.volumes ?? {}).some((v: any) => v.external)) throw new Error("COMPOSE_NETWORK_BOUNDARY_INVALID");
  for (const [key, resource] of [...Object.entries(config.networks ?? {}), ...Object.entries(config.volumes ?? {})] as [string, any][]) {
    if (resource.driver_opts || resource.external || resource.name && resource.name !== `${config.name}_${key}` || resource.driver && !["bridge", "local"].includes(resource.driver)) throw new Error("COMPOSE_RESOURCE_OWNERSHIP_INVALID");
  }
  for (const s of Object.values(config.services) as any[]) {
    if (s.privileged || s.devices?.length || s.network_mode && s.network_mode !== "none" || s.pid === "host" || s.ipc === "host") throw new Error("COMPOSE_HOST_ACCESS_FORBIDDEN");
    for (const p of s.ports ?? []) if (p.host_ip !== "127.0.0.1" || String(p.published) !== "8443") throw new Error("COMPOSE_PUBLIC_PORT_FORBIDDEN");
    for (const v of s.volumes ?? []) {
      if (v.type !== "volume" && v.type !== "bind") throw new Error("COMPOSE_MOUNT_INVALID");
      if (v.type === "bind") {
        const source = path.resolve(v.source);
        const relative = path.relative(syntheticRoot, source);
        const generated = relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
        if (!v.read_only || !(trackedMounts.has(source) || generated) || /docker\.sock|\.db(?:$|-)/.test(source)) throw new Error("COMPOSE_PRIVATE_MOUNT_FORBIDDEN");
      }
    }
    for (const [k, v] of Object.entries(s.environment ?? {})) {
      if (/SENTRY|POSTHOG|OTEL_EXPORTER/.test(k) && v) throw new Error("COMPOSE_EXTERNAL_TELEMETRY_FORBIDDEN");
      if (["APP_ORIGIN", "S3_ENDPOINT"].includes(k) && !/^https?:\/\/(?:portable-staging\.localhost:8443|object-store:9000)$/.test(String(v))) throw new Error("COMPOSE_EXTERNAL_ENDPOINT_FORBIDDEN");
    }
  }
  for (const s of Object.values(config.secrets ?? {}) as any[]) {
    const relative = typeof s.file === "string" ? path.relative(syntheticRoot, path.resolve(s.file)) : "..";
    if (s.external || !relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("COMPOSE_SECRET_BOUNDARY_INVALID");
  }
}

export async function validateComposeFiles(config: any, workspace: string, syntheticRoot: string) {
  validateComposeBoundary(config, workspace, syntheticRoot);
  const files = new Set<string>();
  for (const service of Object.values(config.services) as any[]) for (const volume of service.volumes ?? []) if (volume.type === "bind") files.add(path.resolve(volume.source));
  for (const secret of Object.values(config.secrets ?? {}) as any[]) files.add(path.resolve(secret.file));
  for (const file of files) {
    const info = await lstat(file);
    if (!info.isFile() || info.isSymbolicLink() || await realpath(file) !== file) throw new Error("COMPOSE_FILE_PROVENANCE_INVALID");
    if (process.platform !== "win32" && (info.mode & 0o022)) throw new Error("COMPOSE_FILE_PERMISSIONS_INVALID");
  }
}

export class CiOperatorAdapter implements OperatorAdapter {
  private lock: Awaited<ReturnType<typeof open>> | null = null;
  private receiptFile: string;
  private configFile: string;
  private async atomicJson(file: string, value: unknown) {
    const temp = `${file}.${randomUUID()}.pending`;
    const handle = await open(temp, "wx", 0o600);
    try { await handle.writeFile(JSON.stringify(value)); await handle.sync(); } finally { await handle.close(); }
    await rename(temp, file);
  }
  private async ownedJson(file: string) {
    const info = await lstat(file);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 131072 || await realpath(file) !== file) throw new Error("TARGET_FILE_UNSAFE");
    return JSON.parse(await readFile(file, "utf8"));
  }
  constructor(private readonly workspace: string, private readonly manifest: OperatorManifest, private readonly composeFile: string, private readonly command: OperatorCommand, private readonly executeProcess = docker, private readonly resume = false) {
    this.receiptFile = path.join(manifest.target, `${manifest.operationId}.${command}.receipt.json`);
    this.configFile = path.join(manifest.target, "compose.json");
  }
  private args(args: string[]) { return ["compose", "--project-name", this.manifest.project, "-f", this.configFile, ...args]; }
  async preflight(m: OperatorManifest) {
    assertEphemeralCi();
    if (m.migration !== (await readdir(path.join(this.workspace, "prisma", "postgresql", "migrations"))).filter(name => /^\d{14}_/.test(name)).sort().at(-1)) throw new Error("MIGRATION_PROVENANCE_MISMATCH");
    if (m.releaseCommit !== process.env.EXPECTED_SHA || !m.project.startsWith(`nalanda-ci-${process.env.GITHUB_RUN_ID}-`)) throw new Error("OPERATOR_EXACT_HEAD_REQUIRED");
    const root = path.join(this.workspace, "tmp", "portable-operator", m.project);
    if (m.target !== root || this.composeFile !== path.join(this.workspace, "deploy", "portable", "compose.yml")) throw new Error("OPERATOR_TARGET_INVALID");
    const profile = PORTABLE_PROFILES[m.profile];
    const disk = await statfs(this.workspace);
    if (cpus().length < profile.minCpu || totalmem() / 1048576 < profile.minMemoryMiB || disk.bavail * disk.bsize / 1048576 < profile.minFreeMiB) throw new Error("OPERATOR_RESOURCES_INSUFFICIENT");
    if (createHash("sha256").update(await readFile(this.composeFile)).digest("hex") !== m.composeSha256) throw new Error("COMPOSE_PROVENANCE_MISMATCH");
    const info = JSON.parse(await this.executeProcess(["image", "inspect", m.image], this.workspace))[0];
    if (info.Id !== m.image || info.Architecture !== m.architecture || info.Os !== "linux" || info.Config.User !== "65532:65532"
      || info.Config.Labels["org.opencontainers.image.revision"] !== m.releaseCommit) throw new Error("IMAGE_PROVENANCE_MISMATCH");
    if (m.previous) {
      const previous = JSON.parse(await this.executeProcess(["image", "inspect", m.previous.image], this.workspace))[0];
      if (previous.Id !== m.previous.image || previous.Config.Labels["org.opencontainers.image.revision"] !== m.previous.releaseCommit || previous.Architecture !== m.architecture || previous.Os !== "linux" || previous.Config.User !== "65532:65532") throw new Error("PREVIOUS_IMAGE_PROVENANCE_MISMATCH");
    }
    for (const candidate of [m.image, ...(m.previous ? [m.previous.image] : [])]) {
      const name = `${m.project}-probe-${randomUUID()}`;
      const remaining = () => this.executeProcess(["container", "ls", "--all", "-q", "--filter", `name=^/${name}$`], this.workspace);
      if ((await remaining()).trim()) throw new Error("PROBE_TARGET_EXISTS");
      try {
        const migration = (await this.executeProcess(["run", "--rm", "--name", name, "--label", `com.docker.compose.project=${m.project}`, "--label", "com.docker.compose.service=operator-probe", "--network", "none", "--read-only", "--user", "65532:65532", "--memory", "256m", "--cpus", "1", "--pids-limit", "64", "--cap-drop", "ALL", "--security-opt", "no-new-privileges:true", "--entrypoint", "/nodejs/bin/node", candidate, "-e", "console.log(require('node:fs').readdirSync('/app/prisma/postgresql/migrations').filter(n=>/^\\d{14}_/.test(n)).sort().at(-1))"], this.workspace)).trim();
        if (migration !== m.migration) throw new Error("IMAGE_MIGRATION_MISMATCH");
      } finally {
        if ((await remaining()).trim()) await this.executeProcess(["container", "rm", "-f", name], this.workspace);
        if ((await remaining()).trim()) throw new Error("PROBE_CLEANUP_FAILED");
      }
    }
  }
  async inspectTarget(m: OperatorManifest, command: OperatorCommand) {
    const existing = await lstat(m.target).catch((e: NodeJS.ErrnoException) => { if (e.code === "ENOENT") return null; throw e; });
    if (existing && (!existing.isDirectory() || existing.isSymbolicLink() || await realpath(m.target) !== m.target)) throw new Error("TARGET_SYMLINK_FORBIDDEN");
    if (!existing && !["install", "initialise", "restore"].includes(command)) throw new Error("TARGET_NOT_INITIALISED");
    if (existing) {
      const marker = await this.ownedJson(path.join(m.target, "owner.json"));
      if (marker.project !== m.project || marker.classification !== "INTEGRATION_TEST_ENVIRONMENT") throw new Error("TARGET_OWNERSHIP_MISMATCH");
      const entries = await readdir(m.target);
      if (command !== "doctor") for (const name of entries.filter(name => name.endsWith(".receipt.json") && name !== path.basename(this.receiptFile))) {
        const other = await this.ownedJson(path.join(m.target, name));
        if (other.state !== "COMPLETE") throw new Error("OTHER_OPERATION_REQUIRES_RECONCILIATION");
        if (name.startsWith(`${m.operationId}.`)) throw new Error("OPERATION_ID_ALREADY_USED");
      }
      const ownReceipt = entries.includes(path.basename(this.receiptFile));
      if (["install", "initialise"].includes(command) && !ownReceipt && !(this.resume && marker.operationId === m.operationId && marker.initialised === false && (await readdir(m.target)).every(name => name === "owner.json"))) throw new Error("INSTALL_TARGET_NOT_EMPTY");
      if (!ownReceipt && !["install", "initialise", "restore"].includes(command)) {
        const expectedImage = command === "upgrade" ? m.previous?.image : m.image;
        if (!marker.initialised || marker.image !== expectedImage || marker.migration !== m.migration) throw new Error("INSTALLED_RELEASE_MISMATCH");
      }
    } else {
      for (const kind of ["container", "network", "volume"]) {
        if ((await this.executeProcess([kind, "ls", ...(kind === "container" ? ["--all"] : []), "-q", "--filter", `label=com.docker.compose.project=${m.project}`], this.workspace)).trim()) throw new Error("TARGET_RESOURCES_EXIST");
      }
    }
  }
  async acquire() {
    await mkdir(path.dirname(this.manifest.target), { recursive: true, mode: 0o700 });
    if (await realpath(path.dirname(this.manifest.target)) !== path.dirname(this.manifest.target)) throw new Error("TARGET_PARENT_SYMLINK_FORBIDDEN");
    const lockPath = `${this.manifest.target}.lock`;
    const previous = await lstat(lockPath).catch((e: NodeJS.ErrnoException) => { if (e.code === "ENOENT") return null; throw e; });
    if (previous) {
      if (!this.resume || !previous.isFile() || previous.isSymbolicLink() || previous.size > 1024) throw new Error("LOCK_RECONCILIATION_REQUIRED");
      const lock = JSON.parse(await readFile(lockPath, "utf8"));
      if (lock.project !== this.manifest.project || lock.operationId !== this.manifest.operationId || !Number.isSafeInteger(lock.pid) || lock.pid < 1) throw new Error("LOCK_OWNERSHIP_INVALID");
      try { process.kill(lock.pid, 0); throw new Error("LOCK_OWNER_ALIVE"); }
      catch (e) { if ((e as NodeJS.ErrnoException).code !== "ESRCH") throw e; }
      // Retain stale evidence. A live/reused PID or ambiguous owner always blocks.
      await rename(lockPath, `${lockPath}.${randomUUID()}.stale`);
    }
    this.lock = await open(lockPath, "wx", 0o600);
    try {
      await this.lock.writeFile(JSON.stringify({ project: this.manifest.project, operationId: this.manifest.operationId, pid: process.pid })); await this.lock.sync();
      await mkdir(this.manifest.target, { recursive: true, mode: 0o700 });
      try { const owner = await open(path.join(this.manifest.target, "owner.json"), "wx", 0o600); try { await owner.writeFile(JSON.stringify({ project: this.manifest.project, classification: "INTEGRATION_TEST_ENVIRONMENT", operationId: this.manifest.operationId, initialised: false, image: this.manifest.image, migration: this.manifest.migration })); await owner.sync(); } finally { await owner.close(); } }
      catch (e) { if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e; }
    } catch (e) { await this.release(); throw e; }
  }
  async release() { if (this.lock) { await this.lock.close(); this.lock = null; await unlink(`${this.manifest.target}.lock`); } }
  async readReceipt() { try { const stat = await lstat(this.receiptFile); if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 8192) throw new Error("RECEIPT_UNSAFE"); const data = await readFile(this.receiptFile, "utf8"); return JSON.parse(data) as OperatorReceipt; } catch(e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return null; throw e; } }
  async writeReceipt(receipt: OperatorReceipt) {
    const temp = `${this.receiptFile}.${randomUUID()}.pending`;
    const f = await open(temp, "wx", 0o600); try { await f.writeFile(JSON.stringify(receipt)); await f.sync(); } finally { await f.close(); }
    await rename(temp, this.receiptFile);
  }
  private async canonicalConfig(m: OperatorManifest) {
    const config = JSON.parse(await this.executeProcess(["compose", "--project-name", m.project, "-f", this.composeFile, "config", "--format", "json"], this.workspace));
    await validateComposeFiles(config, this.workspace, path.join(this.workspace, "tmp", "portable-staging"));
      // No implicit demo-account bootstrap. Explicit CI fixture setup owns identities.
      delete config.services.seed;
      for (const service of Object.values(config.services) as any[]) {
        delete service.build;
        if (service.depends_on?.seed) { delete service.depends_on.seed; service.depends_on.migrator = { condition: "service_completed_successfully", required: true }; }
        if (String(service.image).startsWith("nalanda-portable-staging:")) service.image = m.image;
      }
      config.services["reverse-proxy"].environment ??= {};
      config.services["reverse-proxy"].environment.PORTABLE_UPSTREAMS = m.profile === "local-single-node" ? "web-1:3000" : "web-1:3000 web-2:3000";
      for (const service of Object.values(config.services) as any[]) {
        if (service.environment?.NALANDA_SYNTHETIC_STAGING === "true") service.environment.PORTABLE_PROFILE = m.profile;
        if (m.profile === "local-single-node" && service.depends_on) delete service.depends_on["web-2"];
      }
    return config;
  }
  async execute(step: OperatorStep, m: OperatorManifest) {
    if (step === "validate") {
      const config = await this.canonicalConfig(m);
      if (this.command === "doctor") { await this.inspectTarget(m, "doctor"); await this.ownedJson(this.configFile); return; }
      await this.atomicJson(this.configFile, config);
      return;
    }
    const saved = await this.ownedJson(this.configFile);
    await validateComposeFiles(saved, this.workspace, path.join(this.workspace, "tmp", "portable-staging"));
    const allowedImages = new Set([this.manifest.image, this.manifest.previous?.image]);
    for (const name of ["web-1", "web-2", "backup-worker", "migrator", "backup-qa"]) {
      if (!allowedImages.has(saved.services[name]?.image) || saved.services[name]?.environment?.PORTABLE_EXPECTED_POSTGRES_MIGRATION !== m.migration) throw new Error("RESOLVED_IMAGE_PROVENANCE_MISMATCH");
    }
    const expected = await this.canonicalConfig(this.manifest);
    if (this.command === "rollback" && this.manifest.previous && saved.services["web-1"].image === this.manifest.previous.image) {
      for (const name of ["web-1", "web-2", "backup-worker"]) expected.services[name].image = this.manifest.previous.image;
    }
    const stable = (value: unknown): string => JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
    if (stable(saved) !== stable(expected)) throw new Error("RESOLVED_CONFIG_PROVENANCE_MISMATCH");
    const commands: Record<Exclude<OperatorStep, "validate">, string[]> = {
      dependencies: ["up", "-d", "--wait", "postgres", "valkey", "object-init"],
      "migration-status": ["run", "--rm", "--no-deps", "migrator", "dist/portable/runtime-command.mjs", "migration-status"],
      backup: ["run", "--rm", "--no-deps", "-e", "PORTABLE_OPERATOR_CI=true", "backup-qa", "dist/portable/operator-recovery.mjs", "backup", m.operationId],
      migrate: ["run", "--rm", "--no-deps", "migrator"],
      start: ["up", "-d", "--wait", "--no-deps", "web-1", "web-2", "reverse-proxy", "backup-worker"],
      readiness: ["exec", "-T", "web-1", "/nodejs/bin/node", "dist/portable/runtime-command.mjs", "health-probe"],
      restore: ["run", "--rm", "--no-deps", "-e", "PORTABLE_OPERATOR_CI=true", "backup-qa", "dist/portable/operator-recovery.mjs", "restore", m.restoreArtifact?.id ?? "", m.restoreArtifact?.ciphertextSha256 ?? "", m.operationId],
      "stop-app": ["stop", "web-1", "web-2", "reverse-proxy", "backup-worker"],
      "remove-app": ["rm", "-f", "web-1", "web-2", "reverse-proxy", "backup-worker"]
    };
    if (step === "start") {
      const config = await this.ownedJson(this.configFile);
      for (const name of ["web-1", "web-2", "backup-worker"]) config.services[name].image = m.image;
      await this.atomicJson(this.configFile, config);
      if (m.profile === "local-single-node") commands.start = ["up", "-d", "--wait", "--no-deps", "web-1", "reverse-proxy", "backup-worker"];
    }
    const output = await this.executeProcess(this.args(commands[step]), this.workspace);
    if (step === "readiness" && this.command !== "doctor") {
      const owner = await this.ownedJson(path.join(m.target, "owner.json"));
      await this.atomicJson(path.join(m.target, "owner.json"), { ...owner, initialised: true, image: saved.services["web-1"].image, migration: m.migration });
    }
    if (step === "migrate") await this.atomicJson(path.join(m.target, `${m.operationId}.migrate.result.json`), { state: "MIGRATED", planHash: operatorPlan(this.command, this.manifest).planHash, command: this.command, operationId: m.operationId, migration: m.migration });
    if (step === "backup" || step === "restore") {
      const result = JSON.parse(output.trim().split(/\r?\n/).at(-1) ?? "{}");
      if (result.operationId !== m.operationId || result.state !== (step === "backup" ? "VERIFIED" : "RESTORED") || result.backupVersion !== 45) throw new Error("RECOVERY_TERMINAL_RESULT_INVALID");
      if (step === "backup" && (!/^[a-z0-9-]{8,64}$/.test(result.id) || !/^[a-f0-9]{64}$/.test(result.ciphertextSha256))) throw new Error("BACKUP_RESULT_INVALID");
      const f = await open(path.join(m.target, `${m.operationId}.${step}.result.json`), "wx", 0o600); try { await f.writeFile(JSON.stringify({ ...result, command: this.command, planHash: operatorPlan(this.command, this.manifest).planHash })); await f.sync(); } finally { await f.close(); }
    }
  }
  async reconcile(step: OperatorStep): Promise<"COMPLETE" | "NOT_STARTED" | "UNKNOWN"> {
    if (step === "backup" || step === "restore" || step === "migrate") {
      try {
        const result = await this.ownedJson(path.join(this.manifest.target, `${this.manifest.operationId}.${step}.result.json`));
        if (result.command === this.command && result.planHash === operatorPlan(this.command, this.manifest).planHash && result.operationId === this.manifest.operationId && (step === "migrate" ? result.state === "MIGRATED" && result.migration === this.manifest.migration : result.state === (step === "backup" ? "VERIFIED" : "RESTORED") && result.backupVersion === 45)) return "COMPLETE";
      } catch { /* Missing or ambiguous terminal evidence is a gate. */ }
    }
    // Read-only and convergent operations are safe to repeat. A possibly committed
    // migration/backup/restore is never guessed or blindly replayed after a crash.
    return ["validate", "dependencies", "migration-status", "readiness", "stop-app", "remove-app", "start"].includes(step) ? "NOT_STARTED" : "UNKNOWN";
  }
}
