import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { OPERATOR_COMMANDS, PORTABLE_PROFILES, validateOperatorManifest, type OperatorManifest } from "../../lib/portable-runtime/operator";
import { validateComposeBoundary } from "./operator-adapter";

type Settings = {
  schemaVersion: 1;
  purpose: "synthetic-integration" | "future-private-preview";
  profile: keyof typeof PORTABLE_PROFILES;
  applicationOrigin: string;
  manifest?: OperatorManifest;
};
const syntheticOrigin = "https://portable-staging.localhost:8443";
const appServices = ["web-1", "web-2", "migrator", "backup-worker", "backup-qa", "runtime-qa", "object-init", "backup-maintenance", "backup-maintenance-plan", "seed"];
const disabledFlags = ["PUBLIC_ADMISSIONS_ENABLED", "OFFLINE_SYNC_ENABLED", "CROSS_PLATFORM_APPS_ENABLED", "TRANSPORT_ENABLED", "CAFETERIA_ENABLED", "EVENT_MEDIA_PUBLIC_PUBLISHING_ENABLED", "CLOUD_AI_ENABLED", "LIVE_PROVIDERS_ENABLED", "WHATSAPP_LIVE_SENDING_ENABLED", "SMS_EMAIL_SMS_LIVE_ENABLED", "SMS_EMAIL_EMAIL_LIVE_ENABLED"];
function requireValue(value: unknown, code: string): asserts value { if (!value) throw Error(code); }
function within(root: string, candidate: string) {
  const relative = path.relative(root, candidate);
  return relative === "" || relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}
async function canonicalFile(file: string, maximum = 65536) {
  requireValue(path.isAbsolute(file) && path.normalize(file) === file, "OPERATIONS_ABSOLUTE_PATH_REQUIRED");
  const stat = await lstat(file);
  requireValue(stat.isFile() && !stat.isSymbolicLink() && stat.size <= maximum && await realpath(file) === file, "OPERATIONS_INPUT_UNSAFE");
  return readFile(file, "utf8");
}
export function validateOperationsSettings(raw: unknown): Settings {
  const settings = raw as Settings;
  requireValue(settings && typeof settings === "object" && !Array.isArray(settings) && Object.keys(settings).every(key => ["schemaVersion", "purpose", "profile", "applicationOrigin", "manifest"].includes(key)), "OPERATIONS_SETTINGS_INVALID");
  requireValue(settings.schemaVersion === 1 && ["synthetic-integration", "future-private-preview"].includes(settings.purpose) && Object.hasOwn(PORTABLE_PROFILES, settings.profile), "OPERATIONS_SETTINGS_INVALID");
  let origin: URL;
  try { origin = new URL(settings.applicationOrigin); } catch { throw Error("OPERATIONS_ORIGIN_INVALID"); }
  requireValue(origin.origin === settings.applicationOrigin && origin.protocol === "https:" && !origin.username && !origin.password && !origin.search && !origin.hash, "OPERATIONS_ORIGIN_INVALID");
  if (settings.purpose === "future-private-preview") {
    requireValue(!settings.manifest && !["localhost", "127.0.0.1", "[::1]", "portable-staging.localhost"].includes(origin.hostname), "FUTURE_PREVIEW_MUST_REMAIN_INACTIVE");
  } else {
    requireValue(settings.applicationOrigin === syntheticOrigin, "SYNTHETIC_ORIGIN_REQUIRED");
    const manifest = validateOperatorManifest(settings.manifest);
    requireValue(manifest.profile === settings.profile, "OPERATIONS_PROFILE_MISMATCH");
    requireValue(!manifest.previous || manifest.previous.image !== manifest.image && manifest.previous.releaseCommit !== manifest.releaseCommit, "DISTINCT_HISTORICAL_TARGET_REQUIRED");
  }
  return structuredClone(settings);
}

// Inspect the fully merged/normalized Compose model. Never read secret bytes.
export function validatePreparedCompose(config: any, workspace: string, privateRoot: string, manifest: OperatorManifest) {
  validateComposeBoundary(config, workspace, privateRoot);
  requireValue(config.name === manifest.project, "OPERATIONS_PROJECT_MISMATCH");
  for (const name of appServices) requireValue(config.services[name]?.image === manifest.image, "OPERATIONS_IMAGE_MISMATCH");
  for (const [name, service] of Object.entries(config.services) as [string, any][]) {
    requireValue(!service.build && !service.env_file && !service.develop, "OPERATIONS_RUNTIME_REBUILD_FORBIDDEN");
    requireValue(!service.ports?.length || name === "reverse-proxy", "OPERATIONS_ADMIN_PORT_FORBIDDEN");
    requireValue(service.image?.includes("@sha256:") || service.image === manifest.image, "OPERATIONS_IMMUTABLE_IMAGE_REQUIRED");
    const environment = service.environment ?? {};
    const mounted = new Set((service.secrets ?? []).map((secret: any) => typeof secret === "string" ? secret : (secret.target || secret.source).replace(/^\/run\/secrets\//, "")));
    for (const [key, value] of Object.entries(environment)) {
      if (key.endsWith("_FILE") && value) requireValue(typeof value === "string" && /^\/run\/secrets\/[a-z0-9_]+$/.test(value) && mounted.has(value.split("/").at(-1)), "OPERATIONS_SECRET_REFERENCE_INVALID");
      if (/^(?:AUTH_SECRET|AUTH_VERIFICATION_SECRET|DATABASE_URL|DIRECT_URL|VALKEY_URL|S3_ACCESS_KEY_ID|S3_SECRET_ACCESS_KEY|CLOUD_BACKUP_ENCRYPTION_KEY_V1|NALANDA_PROXY_SHARED_SECRET)$/.test(key)) requireValue(!value, "OPERATIONS_INLINE_SECRET_FORBIDDEN");
    }
    if (appServices.includes(name) && name !== "object-init") {
      requireValue(environment.APP_ORIGIN === syntheticOrigin && environment.NALANDA_ENVIRONMENT === "synthetic-staging" && environment.NALANDA_SYNTHETIC_STAGING === "true", "OPERATIONS_ENVIRONMENT_MISMATCH");
      requireValue(environment.PORTABLE_EXPECTED_POSTGRES_MIGRATION === manifest.migration && environment.DATABASE_PROVIDER === "postgresql", "OPERATIONS_DATABASE_CONTRACT_MISMATCH");
      requireValue(disabledFlags.every(flag => environment[flag] === "false") && environment.AI_ASSISTANT_PROVIDER === "DISABLED", "OPERATIONS_ACTIVATION_FORBIDDEN");
      const background = ["backup-worker", "backup-maintenance", "backup-maintenance-plan"].includes(name);
      requireValue(environment.NALANDA_NATIVE_ALLOWED_ORIGINS === (background ? "" : `nalanda://auth,${syntheticOrigin}`), "OPERATIONS_CALLBACK_MISMATCH");
      requireValue(environment.TRUST_PROXY_HEADERS === (background ? "false" : "true") && environment.NALANDA_TRUSTED_PROXY_MODE === "authenticated-edge-v1" && environment.NALANDA_REQUIRE_TRUSTED_PROXY === "true" && environment.NALANDA_CLIENT_IP_HEADER === "x-forwarded-for", "OPERATIONS_PROXY_CONTRACT_MISMATCH");
    }
    if (name === "web-1" || name === "web-2") {
      requireValue(service.read_only === true && service.cap_drop?.includes("ALL") && service.security_opt?.includes("no-new-privileges:true"), "OPERATIONS_WEB_RESTRICTIONS_INVALID");
      requireValue(Number(service.mem_limit) > 0 && Number(service.cpus) > 0 && Number(service.pids_limit) > 0, "OPERATIONS_RESOURCE_LIMIT_REQUIRED");
      requireValue(!environment.DIRECT_URL_FILE && !mounted.has("direct_url") && !mounted.has("backup_encryption_key"), "OPERATIONS_WEB_CREDENTIAL_ISOLATION_INVALID");
    }
  }
  requireValue(config.services["backup-worker"].environment.DATABASE_URL_FILE === "/run/secrets/backup_database_url" && config.services["backup-worker"].environment.S3_ACCESS_KEY_ID_FILE === "/run/secrets/s3_backup_access_key_id", "OPERATIONS_BACKUP_CREDENTIAL_ISOLATION_INVALID");
  requireValue(config.services["backup-maintenance"].environment.DATABASE_URL_FILE === "/run/secrets/backup_maintenance_database_url", "OPERATIONS_MAINTENANCE_CREDENTIAL_ISOLATION_INVALID");
}

export async function prepareOperations(settingsFile: string, workspace: string, output: string) {
  const settings = validateOperationsSettings(JSON.parse(await canonicalFile(settingsFile)));
  requireValue(path.isAbsolute(workspace) && path.normalize(workspace) === workspace && await realpath(workspace) === workspace, "OPERATIONS_WORKSPACE_UNSAFE");
  requireValue(path.isAbsolute(output) && path.normalize(output) === output && output !== path.parse(output).root && await realpath(path.dirname(output)) === path.dirname(output), "OPERATIONS_OUTPUT_UNSAFE");
  requireValue((!within(workspace, output) || within(path.join(workspace, "tmp"), output)) && !within(output, workspace) && !within(output, settingsFile) && !within(path.join(workspace, "deploy"), output) && !within(path.join(workspace, "prisma"), output) && !within(path.join(workspace, "public"), output), "OPERATIONS_OUTPUT_OVERLAP");
  const composeFile = path.join(workspace, "deploy", "portable", "compose.yml");
  const composeText = await canonicalFile(composeFile);
  const composeSha256 = createHash("sha256").update(composeText).digest("hex");
  const profile = JSON.parse(await canonicalFile(path.join(workspace, "deploy", "portable", "profiles", settings.profile + ".json")));
  const contract = PORTABLE_PROFILES[settings.profile];
  requireValue(profile.profile === settings.profile && profile.postgresMajor === contract.postgresMajor && profile.webReplicas === contract.replicas && profile.minimum.cpu === contract.minCpu && profile.minimum.memoryMiB === contract.minMemoryMiB && profile.minimum.freeStorageMiB === contract.minFreeMiB && profile.operationalActivation === false, "OPERATIONS_PROFILE_CONTRACT_MISMATCH");
  const unresolved = ["ARTIFACT_ADMISSION", "EXACT_RUNTIME_AUTHORIZATION", "REQUIRED_SECRET_FILES", "TARGET_RESOURCE_MEASUREMENT", "PERSISTENT_VOLUME_OWNERSHIP", "RUNNING_TLS_AUTH_FIREWALL_ACCEPTANCE"];
  const report: Record<string, unknown> = { schemaVersion: 1, purpose: settings.purpose, profile: settings.profile, applicationOrigin: settings.applicationOrigin, composeSha256, resourceFloor: profile.minimum, capacityEvidence: profile.capacityEvidence, executable: false, admitted: false, unresolved };
  let manifest: OperatorManifest | undefined;
  if (settings.purpose === "synthetic-integration") {
    manifest = validateOperatorManifest(settings.manifest);
    requireValue(manifest.composeSha256 === composeSha256, "COMPOSE_PROVENANCE_MISMATCH");
    requireValue(manifest.target === path.join(workspace, "tmp", "portable-operator", manifest.project), "OPERATOR_TARGET_INVALID");
    const privateRoot = path.join(workspace, "tmp", "portable-staging", manifest.project);
    requireValue(!within(manifest.target, output) && !within(output, manifest.target) && !within(privateRoot, output) && !within(output, privateRoot), "OPERATIONS_OUTPUT_OVERLAP");
    for (const target of [manifest.target, privateRoot]) requireValue(!await lstat(target).then(() => true, error => { if (error.code === "ENOENT") return false; throw error; }), "OPERATIONS_TARGET_OCCUPIED");
    const migration = (await readdir(path.join(workspace, "prisma", "postgresql", "migrations"))).filter(name => /^\d{14}_/.test(name)).sort().at(-1);
    requireValue(manifest.migration === migration, "MIGRATION_PROVENANCE_MISMATCH");
  } else {
    unresolved.push("PRIVATE_PREVIEW_CLASSIFICATION_AND_CONSUMER_CONTRACT", "IMMUTABLE_IMAGE_SOURCE_ARCHITECTURE", "APPROVED_INDEPENDENT_DATA_NAMESPACE", "REMOTE_DATABASE_TLS_AND_PROVIDER_SETTINGS", "APPROVED_PROXY_ORIGIN_CALLBACK_CONFIGURATION");
  }
  await mkdir(output, { mode: 0o700 }); // exclusive directory; never reuse a partial output
  const write = (name: string, value: unknown) => writeFile(path.join(output, name), JSON.stringify(value, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  if (manifest) {
    await writeFile(path.join(output, "compose-interpolation.empty"), "", { flag: "wx", mode: 0o600 });
    // Only Compose's client-side config parser. No inspect/pull/up/probe/admission.
    // Empty explicit env file and allowlisted interpolation exclude ambient .env/secrets.
    const config = JSON.parse(execFileSync("docker", ["--context", "default", "compose", "--project-name", manifest.project, "--profile", "*", "--env-file", path.join(output, "compose-interpolation.empty"), "-f", composeFile, "config", "--format", "json", "--no-env-resolution"], {
      cwd: workspace, env: { NODE_ENV: "production", PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR, PORTABLE_CI_ROOT: path.join(workspace, "tmp", "portable-staging", manifest.project), PORTABLE_IMAGE_ID: manifest.image, PORTABLE_SOURCE_SHA: manifest.releaseCommit },
      encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], windowsHide: true, timeout: 30000, maxBuffer: 1024 * 1024
    }));
    validatePreparedCompose(config, workspace, path.join(workspace, "tmp", "portable-staging", manifest.project), manifest);
    report.state = "SYNTHETIC_CONFIGURATION_PREPARED_NOT_ADMITTED";
    report.secretReferences = Object.keys(config.secrets).sort();
    const operations = OPERATOR_COMMANDS.map(command => {
      // Deterministic operation identities, not authorization. A fresh validated
      // manifest operationId is required for another mutation; resume reuses its ID.
      const operationId = createHash("sha256").update(`operations-v1:${manifest!.operationId}:${command}`).digest("hex").slice(0, 16);
      const selected = validateOperatorManifest({...manifest!, operationId});
      const manifestFile = path.join(output, `manifest-${command}.json`);
      return {command, selected, manifestFile, operationId};
    });
    requireValue(new Set(operations.map(operation => operation.operationId)).size === OPERATOR_COMMANDS.length, "OPERATIONS_OPERATION_ID_COLLISION");
    for (const operation of operations) await write(`manifest-${operation.command}.json`, operation.selected);
    await write("commands.json", { cwd: workspace, qualificationRequiredBeforeDryRun: true, freshOperationIdRequiredForNewMutation: true, commands: operations.map(({command, manifestFile, operationId}) => ({ command, operationId, argv: ["dist/portable/operator.mjs", command, "--manifest", manifestFile, "--target", manifest!.target], requiresPreviousRelease: command === "upgrade" || command === "rollback", requiresRestoreArtifact: command === "restore" })) });
  } else report.state = "FUTURE_PREVIEW_PREPARATION_INACTIVE";
  await write("preparation.json", report);
  return report;
}

export async function runPreparationCli(argv: string[]) {
  const options = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    requireValue(["--settings", "--workspace", "--output"].includes(argv[i]) && !options.has(argv[i]) && argv[i + 1] && !argv[i + 1].startsWith("--"), "OPERATIONS_ARGUMENT_INVALID");
    options.set(argv[i], argv[i + 1]);
  }
  requireValue(options.size === 3, "OPERATIONS_ARGUMENT_INVALID");
  return prepareOperations(options.get("--settings")!, options.get("--workspace")!, options.get("--output")!);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runPreparationCli(process.argv.slice(2)).then(result => console.log(JSON.stringify({ state: result.state, executable: false, admitted: false, unresolved: result.unresolved }))).catch(error => {
    console.error(JSON.stringify({ state: "FAILED", safeCode: error instanceof Error && /^[A-Z0-9_]+$/.test(error.message) ? error.message : "OPERATIONS_PREPARATION_FAILED" }));
    process.exitCode = 1;
  });
}
