import { realpathSync } from "node:fs";
import path from "node:path";

type Qa20cIsolationEnvironment = NodeJS.ProcessEnv | Record<string, string | undefined>;

export type Qa20cIsolationEvidence =
  | { enabled: false }
  | {
      enabled: true;
      databaseFilename: string;
      providerDirectory: string;
      operationalDatabaseActive: false;
    };

const globalForQa20cIsolation = globalThis as typeof globalThis & {
  qa20cIsolationEvidenceLogged?: boolean;
};

export function assertQa20cIsolatedEnvironment(
  environment: Qa20cIsolationEnvironment = process.env,
  options: { logEvidence?: boolean } = {}
): Qa20cIsolationEvidence {
  if (environment.QA20C_ISOLATED_DATABASE !== "true") return { enabled: false };

  const activeDatabase = databasePathFromUrl(requireValue(environment.DATABASE_URL, "QA20C_DATABASE_URL_REQUIRED"));
  const operationalDatabase = canonicalPath(requireValue(
    environment.QA20C_OPERATIONAL_DATABASE_PATH,
    "QA20C_OPERATIONAL_DATABASE_REQUIRED"
  ));
  const isolatedRoot = canonicalPath(requireValue(environment.QA20C_ISOLATED_ROOT, "QA20C_ISOLATED_ROOT_REQUIRED"));
  const expectedDatabaseRoot = canonicalPath(path.join(isolatedRoot, "database"));
  const providerRoot = canonicalPath(requireValue(
    environment.CLOUD_BACKUP_LOCAL_FOLDER,
    "QA20C_PROVIDER_ROOT_REQUIRED"
  ));
  const tempRoot = canonicalPath(requireValue(environment.CLOUD_BACKUP_TEMP_DIR, "QA20C_TEMP_ROOT_REQUIRED"));
  const rehearsalRoot = canonicalPath(requireValue(
    environment.CLOUD_BACKUP_REHEARSAL_DIR,
    "QA20C_REHEARSAL_ROOT_REQUIRED"
  ));

  if (samePath(activeDatabase, operationalDatabase)) throw new Error("QA20C_OPERATIONAL_DATABASE_REFUSED");
  if (!isContainedBy(activeDatabase, expectedDatabaseRoot)) throw new Error("QA20C_DATABASE_OUTSIDE_ISOLATED_ROOT");
  if (!samePath(providerRoot, canonicalPath(path.join(isolatedRoot, "provider")))) {
    throw new Error("QA20C_PROVIDER_ROOT_MISMATCH");
  }
  if (!samePath(tempRoot, canonicalPath(path.join(isolatedRoot, "temp")))) {
    throw new Error("QA20C_TEMP_ROOT_MISMATCH");
  }
  if (!samePath(rehearsalRoot, canonicalPath(path.join(isolatedRoot, "rehearsal")))) {
    throw new Error("QA20C_REHEARSAL_ROOT_MISMATCH");
  }

  const evidence: Qa20cIsolationEvidence = {
    enabled: true,
    databaseFilename: path.basename(activeDatabase),
    providerDirectory: path.basename(providerRoot),
    operationalDatabaseActive: false
  };
  if (options.logEvidence && !globalForQa20cIsolation.qa20cIsolationEvidenceLogged) {
    console.log(
      `QA20C_ISOLATION_ACTIVE database=${evidence.databaseFilename} provider=${evidence.providerDirectory} operational=false`
    );
    globalForQa20cIsolation.qa20cIsolationEvidenceLogged = true;
  }
  return evidence;
}

function databasePathFromUrl(databaseUrl: string) {
  if (!databaseUrl.startsWith("file:") || databaseUrl.includes("?") || databaseUrl.includes("#")) {
    throw new Error("QA20C_DATABASE_URL_UNSUPPORTED");
  }
  let value: string;
  try {
    value = decodeURIComponent(databaseUrl.slice(5));
  } catch {
    throw new Error("QA20C_DATABASE_URL_UNSUPPORTED");
  }
  if (/^\/[A-Za-z]:[\\/]/.test(value)) value = value.slice(1);
  if (!path.isAbsolute(value)) throw new Error("QA20C_DATABASE_URL_MUST_BE_ABSOLUTE");
  return canonicalPath(value);
}

function requireValue(value: string | undefined, code: string) {
  const normalized = value?.trim();
  if (!normalized) throw new Error(code);
  return normalized;
}

function canonicalPath(value: string) {
  const resolved = path.resolve(value);
  try {
    return realpathSync.native(resolved);
  } catch {
    return resolved;
  }
}

function normalizedForComparison(value: string) {
  const normalized = path.normalize(value);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function samePath(left: string, right: string) {
  return normalizedForComparison(left) === normalizedForComparison(right);
}

function isContainedBy(target: string, root: string) {
  const normalizedTarget = normalizedForComparison(target);
  const normalizedRoot = normalizedForComparison(root);
  return normalizedTarget.startsWith(`${normalizedRoot}${path.sep}`);
}
