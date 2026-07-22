import {
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  realpathSync,
  rmSync
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const PRISMA_ROOT = path.join(WORKSPACE_ROOT, "prisma");
export const QA_ROOT = path.join(WORKSPACE_ROOT, "tmp", "devops1b");
export const OPERATIONAL_DATABASE = path.join(PRISMA_ROOT, "dev.db");
export const BASELINE_MIGRATION = "20260722_clean_install_baseline";

const QA_GROUPS = ["empty-db", "operational-copy", "fresh-clone", "restore", "logs", "reports"] as const;

function inside(parent: string, candidate: string) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

export function ensureQaRoot() {
  mkdirSync(QA_ROOT, { recursive: true });
  for (const group of QA_GROUPS) mkdirSync(path.join(QA_ROOT, group), { recursive: true });
  return QA_ROOT;
}

export function assertIsolatedDatabasePath(candidate: string) {
  ensureQaRoot();
  const resolved = path.resolve(candidate);
  if (resolved.toLowerCase() === path.resolve(OPERATIONAL_DATABASE).toLowerCase()) {
    throw new Error("ISOLATION_REFUSED_OPERATIONAL_DATABASE");
  }
  if (!inside(QA_ROOT, resolved)) throw new Error("ISOLATION_REFUSED_OUTSIDE_DEVOPS1B_ROOT");
  const realRoot = realpathSync(QA_ROOT);
  let current = QA_ROOT;
  for (const segment of path.relative(QA_ROOT, resolved).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    if (!existsSync(current)) break;
    if (lstatSync(current).isSymbolicLink()) throw new Error("ISOLATION_REFUSED_SYMLINK_ESCAPE");
  }
  const parent = path.dirname(resolved);
  mkdirSync(parent, { recursive: true });
  if (!inside(realRoot, realpathSync(parent))) throw new Error("ISOLATION_REFUSED_SYMLINK_ESCAPE");
  return resolved;
}

export function createEmptyIsolatedDatabase(group: "empty-db" | "operational-copy" | "restore", label: string) {
  const safeLabel = label.replace(/[^A-Za-z0-9-]/g, "-");
  const candidate = assertIsolatedDatabasePath(path.join(QA_ROOT, group, `DEVOPS1B-${safeLabel}-${process.pid}-${Date.now()}.db`));
  const descriptor = openSync(candidate, "wx");
  closeSync(descriptor);
  return candidate;
}

export function cleanupIsolatedDatabase(databasePath: string) {
  const checked = assertIsolatedDatabasePath(databasePath);
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    const target = `${checked}${suffix}`;
    if (existsSync(target)) rmSync(target, { force: true });
  }
}

export function databaseUrl(databasePath: string) {
  const checked = assertIsolatedDatabasePath(databasePath);
  return `file:${checked.replaceAll("\\", "/")}`;
}
