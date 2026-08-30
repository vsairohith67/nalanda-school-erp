type PortableFs = Pick<typeof import("node:fs"), "lstatSync" | "readFileSync" | "realpathSync">;
type PortablePath = typeof import("node:path");

function nodeBuiltins() {
  // Next also evaluates the instrumentation module while constructing browser
  // bundles. Resolve built-ins only when secret-file access actually runs so a
  // client compilation can never traverse node:fs/node:path.
  const getBuiltinModule = (process as NodeJS.Process & {
    getBuiltinModule?: (id: string) => unknown;
  }).getBuiltinModule;
  if (!getBuiltinModule) throw new PortableSecretError("NODE_BUILTIN_MODULE_UNAVAILABLE");
  return {
    fs: getBuiltinModule("fs") as PortableFs,
    path: getBuiltinModule("path") as PortablePath
  };
}

export const PORTABLE_SECRET_NAMES = [
  "AUTH_SECRET",
  "AUTH_VERIFICATION_SECRET",
  "CLOUD_BACKUP_ENCRYPTION_KEY_V1",
  "DATABASE_URL",
  "DIRECT_URL",
  "NALANDA_PROXY_SHARED_SECRET",
  "PORTABLE_INTERNAL_HEALTH_TOKEN",
  "POSTGRES_RUNTIME_PASSWORD",
  "POSTGRES_MIGRATOR_PASSWORD",
  "VALKEY_URL",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "STAGING_SYNTHETIC_DIRECTOR_PASSWORD"
] as const;

export type PortableSecretName = (typeof PORTABLE_SECRET_NAMES)[number];

const MAX_SECRET_BYTES = 64 * 1024;

export class PortableSecretError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "PortableSecretError";
  }
}

function configured(environment: NodeJS.ProcessEnv, name: string) {
  return environment[name]?.trim() ?? "";
}

function allowedSecretRoots(environment: NodeJS.ProcessEnv) {
  const { path } = nodeBuiltins();
  const roots = [environment.PORTABLE_SECRET_ROOT?.trim() || "/run/secrets"];
  if (environment.NALANDA_SYNTHETIC_STAGING === "true") {
    const synthetic = environment.PORTABLE_SYNTHETIC_SECRET_ROOT?.trim();
    if (synthetic) roots.push(synthetic);
  }
  return roots.filter(Boolean).map((entry) => path.resolve(entry));
}

function assertWithinAllowedRoot(filePath: string, environment: NodeJS.ProcessEnv) {
  const { path } = nodeBuiltins();
  const absolute = path.resolve(filePath);
  const allowed = allowedSecretRoots(environment).some((root) => {
    const relative = path.relative(root, absolute);
    return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
  });
  if (!allowed) throw new PortableSecretError("SECRET_FILE_OUTSIDE_MOUNT_ROOT");
  return absolute;
}

export function readPortableSecret(
  name: PortableSecretName,
  environment: NodeJS.ProcessEnv = process.env,
  options: { required?: boolean } = {}
) {
  const direct = configured(environment, name);
  const fileReference = configured(environment, `${name}_FILE`);
  if (direct && fileReference) throw new PortableSecretError("SECRET_SOURCE_AMBIGUOUS");
  if (direct) return direct;
  if (!fileReference) {
    if (options.required) throw new PortableSecretError("SECRET_REQUIRED");
    return "";
  }

  const absolute = assertWithinAllowedRoot(fileReference, environment);
  const { fs } = nodeBuiltins();
  const stat = fs.lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1 || stat.size > MAX_SECRET_BYTES) {
    throw new PortableSecretError("SECRET_FILE_UNSAFE");
  }
  const real = fs.realpathSync(absolute);
  assertWithinAllowedRoot(real, environment);
  const value = fs.readFileSync(real, "utf8").replace(/[\r\n]+$/, "");
  if (!value || Buffer.byteLength(value, "utf8") > MAX_SECRET_BYTES) {
    throw new PortableSecretError("SECRET_FILE_VALUE_INVALID");
  }
  return value;
}

export function hydratePortableRuntimeSecrets(environment: NodeJS.ProcessEnv = process.env) {
  for (const name of PORTABLE_SECRET_NAMES) {
    if (configured(environment, name) || !configured(environment, `${name}_FILE`)) continue;
    environment[name] = readPortableSecret(name, environment, { required: true });
    delete environment[`${name}_FILE`];
  }
}
