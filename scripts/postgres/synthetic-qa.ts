import { existsSync, lstatSync } from "node:fs";
import path from "node:path";
import { resolveDatabaseProvider, type DatabaseEnvironment } from "../../lib/database-provider";

const SAFE_DATABASE_NAME = /(qa|ci|synthetic|test)/i;
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function configured(environment: DatabaseEnvironment, name: string) {
  return String(environment[name] ?? "").trim();
}

function assertSyntheticOptIn(environment: DatabaseEnvironment) {
  if (configured(environment, "POSTGRES_READINESS_SYNTHETIC_QA") !== "1") {
    throw new Error("POSTGRES_READINESS_SYNTHETIC_QA_OPT_IN_REQUIRED");
  }
  const nodeEnvironment = configured(environment, "NODE_ENV").toLowerCase();
  const deployment = (configured(environment, "DEPLOYMENT_ENVIRONMENT") || configured(environment, "NALANDA_ENVIRONMENT")).toLowerCase();
  if (nodeEnvironment === "production" || deployment === "staging" || deployment === "production") {
    throw new Error("POSTGRES_READINESS_SYNTHETIC_QA_PRODUCTION_FORBIDDEN");
  }
}

export function assertSyntheticPostgresQa(environment: DatabaseEnvironment = process.env) {
  assertSyntheticOptIn(environment);
  if (resolveDatabaseProvider(environment) !== "postgresql") throw new Error("POSTGRES_READINESS_SYNTHETIC_QA_REQUIRES_POSTGRESQL");
  let target: URL;
  try {
    target = new URL(configured(environment, "DATABASE_URL"));
  } catch {
    throw new Error("POSTGRES_READINESS_SYNTHETIC_QA_DATABASE_URL_INVALID");
  }
  if (!LOOPBACK_HOSTS.has(target.hostname.toLowerCase())) throw new Error("POSTGRES_READINESS_SYNTHETIC_QA_LOOPBACK_REQUIRED");
  const databaseName = decodeURIComponent(target.pathname.replace(/^\/+/, ""));
  if (!SAFE_DATABASE_NAME.test(databaseName)) throw new Error("POSTGRES_READINESS_SYNTHETIC_QA_DATABASE_NAME_REQUIRED");
  return { host: target.hostname, databaseName };
}

function sqlitePathFromUrl(databaseUrl: string, workspace: string) {
  if (!databaseUrl.startsWith("file:")) throw new Error("POSTGRES_READINESS_SYNTHETIC_QA_SQLITE_URL_REQUIRED");
  const raw = decodeURIComponent(databaseUrl.slice("file:".length).split("?", 1)[0]);
  if (!raw) throw new Error("POSTGRES_READINESS_SYNTHETIC_QA_SQLITE_URL_REQUIRED");
  return path.resolve(path.isAbsolute(raw) ? raw : path.join(workspace, "prisma", raw));
}

function assertUnder(root: string, target: string, code: string) {
  const relative = path.relative(root, target);
  if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error(code);
}

function assertNoLinkedPath(target: string, root: string, code: string) {
  let current = target;
  while (current !== root) {
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) throw new Error(code);
    const parent = path.dirname(current);
    if (parent === current) throw new Error(code);
    current = parent;
  }
}

export function assertSyntheticSqliteTransfer(environment: DatabaseEnvironment = process.env, workspace = path.resolve(".")) {
  assertSyntheticOptIn(environment);
  if (resolveDatabaseProvider(environment) !== "sqlite") throw new Error("POSTGRES_READINESS_SYNTHETIC_QA_REQUIRES_SQLITE");
  const databasePath = sqlitePathFromUrl(configured(environment, "DATABASE_URL"), workspace);
  const temporaryRoot = path.resolve(workspace, "tmp");
  assertUnder(temporaryRoot, databasePath, "POSTGRES_READINESS_SYNTHETIC_QA_SQLITE_TMP_REQUIRED");
  assertNoLinkedPath(databasePath, temporaryRoot, "POSTGRES_READINESS_SYNTHETIC_QA_SQLITE_LINK_FORBIDDEN");
  return { databasePath };
}

export function assertPrivateTransferCreateTarget(target: string, workspace = path.resolve(".")) {
  const absolute = path.resolve(target);
  const root = path.resolve(workspace, "tmp");
  assertUnder(root, absolute, "POSTGRES_TRANSFER_FILE_MUST_BE_UNDER_TMP");
  if (existsSync(absolute)) throw new Error("POSTGRES_TRANSFER_FILE_ALREADY_EXISTS");
  assertNoLinkedPath(path.dirname(absolute), root, "POSTGRES_TRANSFER_LINK_FORBIDDEN");
}

export function assertPrivateTransferReadTarget(target: string, workspace = path.resolve(".")) {
  const absolute = path.resolve(target);
  const root = path.resolve(workspace, "tmp");
  assertUnder(root, absolute, "POSTGRES_TRANSFER_FILE_MUST_BE_UNDER_TMP");
  if (!existsSync(absolute) || !lstatSync(absolute).isFile()) throw new Error("POSTGRES_TRANSFER_FILE_REQUIRED");
  assertNoLinkedPath(absolute, root, "POSTGRES_TRANSFER_LINK_FORBIDDEN");
}
