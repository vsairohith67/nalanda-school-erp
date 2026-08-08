import {
  existsSync,
  realpathSync,
  statSync
} from "node:fs";
import path from "node:path";

export const DEMO_BUSINESS_DATA_FLAG = "ALLOW_DEMO_BUSINESS_DATA";
export const DEMO_BUSINESS_DATA_ROOT = "DEMO_BUSINESS_DATA_ROOT";

export type DemoBusinessSeedDecision =
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
  if (!databaseUrl.startsWith("file:") || databaseUrl.includes("?")) {
    throw new Error("DEMO_BUSINESS_DATABASE_URL_INVALID");
  }
  const raw = databaseUrl.slice(5).trim();
  if (!raw) throw new Error("DEMO_BUSINESS_DATABASE_URL_INVALID");
  const normalized = raw.replaceAll("/", path.sep);
  return path.isAbsolute(normalized)
    ? path.resolve(normalized)
    : path.resolve(workspaceRoot, "prisma", normalized);
}

function sameFileIdentity(left: string, right: string) {
  if (!existsSync(left) || !existsSync(right)) return false;
  // Windows file indexes can exceed Number.MAX_SAFE_INTEGER. Keep their exact
  // identity so unrelated temporary files cannot be mistaken for hard links.
  const leftStat = statSync(left, { bigint: true });
  const rightStat = statSync(right, { bigint: true });
  return leftStat.dev === rightStat.dev && leftStat.ino === rightStat.ino;
}

export function demoBusinessSeedDecision(
  environment: NodeJS.ProcessEnv = process.env,
  workspaceRoot = process.cwd()
): DemoBusinessSeedDecision {
  if (environment[DEMO_BUSINESS_DATA_FLAG]?.trim() !== "true") {
    return { enabled: false };
  }

  const deployment = environment.NALANDA_ENVIRONMENT?.trim().toLowerCase();
  if (environment.NODE_ENV === "production" || deployment === "staging" || deployment === "production") {
    throw new Error("DEMO_BUSINESS_DATA_FORBIDDEN_IN_RELEASE_ENVIRONMENT");
  }

  const rootValue = environment[DEMO_BUSINESS_DATA_ROOT]?.trim();
  if (!rootValue || !path.isAbsolute(rootValue)) {
    throw new Error("DEMO_BUSINESS_DATA_ROOT_MUST_BE_ABSOLUTE");
  }

  const workspace = canonicalPath(workspaceRoot);
  const prismaRoot = canonicalPath(path.join(workspace, "prisma"));
  const operationalDatabase = canonicalPath(path.join(prismaRoot, "dev.db"));
  const isolatedRoot = canonicalPath(rootValue);
  if (!existsSync(isolatedRoot) || !statSync(isolatedRoot).isDirectory()) {
    throw new Error("DEMO_BUSINESS_DATA_ROOT_NOT_FOUND");
  }
  if (
    isolatedRoot.toLowerCase() === workspace.toLowerCase() ||
    isolatedRoot.toLowerCase() === prismaRoot.toLowerCase() ||
    inside(isolatedRoot, operationalDatabase)
  ) {
    throw new Error("DEMO_BUSINESS_DATA_ROOT_OVERLAPS_OPERATIONAL_STORAGE");
  }

  const configuredDatabase = databasePathFromUrl(environment.DATABASE_URL?.trim() ?? "", workspace);
  if (!existsSync(configuredDatabase) || !statSync(configuredDatabase).isFile()) {
    throw new Error("DEMO_BUSINESS_DATABASE_MUST_ALREADY_EXIST");
  }
  const databasePath = canonicalPath(configuredDatabase);
  if (!inside(isolatedRoot, databasePath)) {
    throw new Error("DEMO_BUSINESS_DATABASE_OUTSIDE_ISOLATED_ROOT");
  }
  if (
    databasePath.toLowerCase() === operationalDatabase.toLowerCase() ||
    sameFileIdentity(databasePath, operationalDatabase)
  ) {
    throw new Error("DEMO_BUSINESS_DATA_REFUSED_OPERATIONAL_DATABASE");
  }

  return { enabled: true, databasePath, isolatedRoot };
}

export function requireDemoBusinessSeed(
  environment: NodeJS.ProcessEnv = process.env,
  workspaceRoot = process.cwd()
) {
  const decision = demoBusinessSeedDecision(environment, workspaceRoot);
  if (!decision.enabled) throw new Error("DEMO_BUSINESS_DATA_EXPLICIT_OPT_IN_REQUIRED");
  return decision;
}
