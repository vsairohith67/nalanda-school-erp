import { realpathSync } from "node:fs";
import path from "node:path";

type BrowserRestoreEnvironment = NodeJS.ProcessEnv | Record<string, string | undefined>;

export function assertBrowserRestoreExecutionSafe(
  environment: BrowserRestoreEnvironment = process.env,
  projectRoot = process.cwd()
) {
  const copiedQaRoot = canonicalExistingPath(requireValue(
    environment.BROWSER_RESTORE_COPIED_QA_ROOT,
    "Browser restore requires an explicit copied-QA root"
  ));
  const databasePath = databasePathFromUrl(requireValue(
    environment.DATABASE_URL,
    "Browser restore requires an explicit copied-QA database"
  ));
  const operationalDatabase = canonicalExistingPath(path.join(projectRoot, "prisma", "dev.db"));

  if (samePath(databasePath, operationalDatabase)) {
    throw new Error("Browser restore refuses the operational database");
  }
  if (!isContainedBy(databasePath, copiedQaRoot)) {
    throw new Error("Browser restore database is outside the copied-QA root");
  }

  return {
    databaseFilename: path.basename(databasePath),
    copiedQaRootName: path.basename(copiedQaRoot),
    operationalDatabaseActive: false as const
  };
}

export function assertBrowserRestorePayloadAllowed(
  backup: { rolePermissions?: readonly unknown[] }
) {
  if ((backup.rolePermissions?.length ?? 0) > 0) {
    throw new Error("Browser restore cannot restore role permissions");
  }
}

function databasePathFromUrl(databaseUrl: string) {
  if (!databaseUrl.startsWith("file:") || databaseUrl.includes("?") || databaseUrl.includes("#")) {
    throw new Error("Browser restore requires an absolute SQLite file database");
  }
  let value: string;
  try {
    value = decodeURIComponent(databaseUrl.slice(5));
  } catch {
    throw new Error("Browser restore requires an absolute SQLite file database");
  }
  if (/^\/[A-Za-z]:[\\/]/.test(value)) value = value.slice(1);
  if (!path.isAbsolute(value)) {
    throw new Error("Browser restore requires an absolute SQLite file database");
  }
  return canonicalExistingPath(value);
}

function requireValue(value: string | undefined, message: string) {
  const normalized = value?.trim();
  if (!normalized) throw new Error(message);
  return normalized;
}

function canonicalExistingPath(value: string) {
  try {
    return realpathSync.native(path.resolve(value));
  } catch {
    throw new Error("Browser restore copied-QA path does not exist");
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
  const relative = path.relative(normalizedForComparison(root), normalizedForComparison(target));
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}
