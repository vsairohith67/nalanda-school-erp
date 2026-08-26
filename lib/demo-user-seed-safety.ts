import {
  existsSync,
  realpathSync,
  statSync
} from "node:fs";
import path from "node:path";

export const DEMO_USERS_FLAG = "ALLOW_DEMO_USERS";
export const DEMO_USER_DATABASE_ROOT = "DEMO_USER_DATABASE_ROOT";

export type DemoUserSeedDecision =
  | { enabled: false }
  | { enabled: true; databasePath: string; isolatedRoot: string };

function inside(parent: string, candidate: string) {
  const relative = path.relative(parent, candidate);
  return relative !== "" &&
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative);
}

function canonicalPath(candidate: string) {
  const resolved = path.resolve(candidate);
  return existsSync(resolved) ? realpathSync.native(resolved) : resolved;
}

function databasePathFromUrl(databaseUrl: string, workspaceRoot: string) {
  if (!databaseUrl.startsWith("file:") || databaseUrl.includes("?") || databaseUrl.includes("#")) {
    throw new Error("DEMO_USER_DATABASE_URL_INVALID");
  }
  let raw: string;
  try {
    raw = decodeURIComponent(databaseUrl.slice(5).trim());
  } catch {
    throw new Error("DEMO_USER_DATABASE_URL_INVALID");
  }
  if (!raw) throw new Error("DEMO_USER_DATABASE_URL_INVALID");
  if (/^\/[A-Za-z]:[\\/]/.test(raw)) raw = raw.slice(1);
  const normalized = raw.replaceAll("/", path.sep);
  return path.isAbsolute(normalized)
    ? path.resolve(normalized)
    : path.resolve(workspaceRoot, "prisma", normalized);
}

function sameFileIdentity(left: string, right: string) {
  if (!existsSync(left) || !existsSync(right)) return false;
  const leftStat = statSync(left);
  const rightStat = statSync(right);
  return leftStat.dev === rightStat.dev && leftStat.ino === rightStat.ino;
}

export function demoUserSeedDecision(
  environment: NodeJS.ProcessEnv = process.env,
  workspaceRoot = process.cwd()
): DemoUserSeedDecision {
  if (environment[DEMO_USERS_FLAG]?.trim() !== "true") return { enabled: false };

  const deployment = environment.NALANDA_ENVIRONMENT?.trim().toLowerCase();
  if (environment.NODE_ENV === "production" || deployment === "staging" || deployment === "production") {
    throw new Error("DEMO_USERS_FORBIDDEN_IN_RELEASE_ENVIRONMENT");
  }

  const workspace = canonicalPath(workspaceRoot);
  const prismaRoot = canonicalPath(path.join(workspace, "prisma"));
  const operationalDatabase = canonicalPath(path.join(prismaRoot, "dev.db"));
  const ignoredTestRoot = canonicalPath(path.join(workspace, "tmp"));
  const rootValue = environment[DEMO_USER_DATABASE_ROOT]?.trim();
  if (!rootValue || !path.isAbsolute(rootValue)) {
    throw new Error("DEMO_USER_DATABASE_ROOT_MUST_BE_ABSOLUTE");
  }
  const isolatedRoot = canonicalPath(rootValue);
  if (!existsSync(isolatedRoot) || !statSync(isolatedRoot).isDirectory()) {
    throw new Error("DEMO_USER_DATABASE_ROOT_NOT_FOUND");
  }
  if (!inside(ignoredTestRoot, isolatedRoot)) {
    throw new Error("DEMO_USER_DATABASE_ROOT_MUST_BE_IGNORED_TEST_PATH");
  }

  const configuredDatabase = databasePathFromUrl(environment.DATABASE_URL?.trim() ?? "", workspace);
  const databasePath = canonicalPath(configuredDatabase);
  if (
    databasePath.toLowerCase() === operationalDatabase.toLowerCase() ||
    sameFileIdentity(databasePath, operationalDatabase)
  ) {
    throw new Error("DEMO_USERS_REFUSED_OPERATIONAL_DATABASE");
  }
  if (!existsSync(configuredDatabase) || !statSync(configuredDatabase).isFile()) {
    throw new Error("DEMO_USER_DATABASE_MUST_ALREADY_EXIST");
  }
  if (!inside(isolatedRoot, databasePath)) {
    throw new Error("DEMO_USER_DATABASE_OUTSIDE_ISOLATED_ROOT");
  }
  if (!/\.(?:db|sqlite|sqlite3)$/i.test(databasePath)) {
    throw new Error("DEMO_USER_DATABASE_EXTENSION_NOT_IGNORED");
  }

  return { enabled: true, databasePath, isolatedRoot };
}
