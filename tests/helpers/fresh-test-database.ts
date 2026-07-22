import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const TEST_DATABASE_ROOT = path.resolve("tmp", "devops1b", "test-databases");
const BASELINE_SQL = path.resolve("prisma", "migrations", "20260722_clean_install_baseline", "migration.sql");
const TEMPLATE_DATABASE = path.join(TEST_DATABASE_ROOT, `DEVOPS1B-template-${process.pid}.db`);

function ensureTemplateDatabase() {
  if (existsSync(TEMPLATE_DATABASE)) return;
  mkdirSync(TEST_DATABASE_ROOT, { recursive: true });
  const bootstrap = [
    'const { readFileSync } = require("node:fs");',
    'const { DatabaseSync } = require("node:sqlite");',
    'const database = new DatabaseSync(process.argv[1]);',
    'try { database.exec(readFileSync(process.argv[2], "utf8")); } finally { database.close(); }'
  ].join(" ");
  execFileSync(process.execPath, ["-e", bootstrap, TEMPLATE_DATABASE, BASELINE_SQL], { stdio: "pipe" });
}

process.once("exit", () => removeFreshTestDatabase(TEMPLATE_DATABASE));

export function createFreshTestDatabase(label: string) {
  ensureTemplateDatabase();
  const safeLabel = label.replace(/[^A-Za-z0-9-]+/g, "-");
  const databasePath = path.join(TEST_DATABASE_ROOT, `DEVOPS1B-${safeLabel}-${process.pid}-${randomUUID()}.db`);
  copyFileSync(TEMPLATE_DATABASE, databasePath);
  return databasePath;
}

export function removeFreshTestDatabase(databasePath: string) {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) rmSync(`${databasePath}${suffix}`, { force: true });
}
