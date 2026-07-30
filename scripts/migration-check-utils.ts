import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync
} from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { PRISMA_ROOT, WORKSPACE_ROOT, databaseUrl } from "./migration-isolation";
export * from "./migration-isolation";

function sanitize(value: string) {
  return value
    .replaceAll(WORKSPACE_ROOT, "<workspace>")
    .replaceAll(WORKSPACE_ROOT.replaceAll("\\", "/"), "<workspace>")
    .replace(/((?:SEED_(?:DIRECTOR|ADMIN|ACCOUNTANT|VIEWER)_PASSWORD|AUTH_SECRET|SESSION_SECRET))=[^\s]+/gi, "$1=<redacted>");
}

export type CommandResult = { stdout: string; stderr: string; combined: string };

export function runPnpm(
  args: string[],
  databasePath?: string,
  extraEnvironment: Record<string, string | undefined> = {}
): CommandResult {
  const windowsPnpmEntry = path.join(process.env.APPDATA ?? "", "npm", "node_modules", "pnpm", "bin", "pnpm.mjs");
  const command = process.platform === "win32" ? process.execPath : "pnpm";
  const commandArgs = process.platform === "win32" ? [windowsPnpmEntry, ...args] : args;
  if (process.platform === "win32" && !existsSync(windowsPnpmEntry)) throw new Error("PNPM_RUNTIME_NOT_FOUND");
  const environment = {
    ...process.env,
    ...extraEnvironment,
    ...(databasePath ? { DATABASE_URL: databaseUrl(databasePath) } : {})
  };
  const result = spawnSync(command, commandArgs, {
    cwd: WORKSPACE_ROOT,
    env: environment,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true
  });
  const stdout = sanitize(result.stdout ?? "");
  const stderr = sanitize(result.stderr ?? "");
  if (result.error) throw new Error(`COMMAND_START_FAILED: ${result.error.message}`);
  if (result.status !== 0) {
    const safe = sanitize(`${stdout}\n${stderr}`).trim();
    throw new Error(`COMMAND_FAILED (${args.join(" ")}):\n${safe}`);
  }
  return { stdout, stderr, combined: `${stdout}\n${stderr}`.trim() };
}

export function runPrisma(args: string[], databasePath: string, extraEnvironment: Record<string, string | undefined> = {}) {
  return runPnpm(["exec", "prisma", ...args], databasePath, extraEnvironment);
}

function quote(identifier: string) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function jsonValue(value: unknown): unknown {
  if (value instanceof Uint8Array) return Buffer.from(value).toString("hex");
  if (typeof value === "bigint") return value.toString();
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, jsonValue(item)]));
  }
  if (Array.isArray(value)) return value.map(jsonValue);
  return value;
}

export function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

export function fileSha256(filePath: string) {
  return sha256(readFileSync(filePath));
}

export type SchemaInventory = {
  tables: Array<{
    name: string;
    columns: unknown[];
    foreignKeys: unknown[];
    indexes: Array<{ name: string; unique: number; origin: string; partial: number; columns: unknown[] }>;
  }>;
  views: Array<{ name: string; sql: string }>;
  triggers: Array<{ name: string; table: string; sql: string }>;
};

export function schemaInventory(databasePath: string): SchemaInventory {
  const db = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const tableRows = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name <> '_prisma_migrations' ORDER BY name"
    ).all() as Array<{ name: string }>;
    const tables = tableRows.map(({ name }) => {
      const columns = db.prepare(`PRAGMA table_info(${quote(name)})`).all().map(jsonValue);
      const foreignKeys = db.prepare(`PRAGMA foreign_key_list(${quote(name)})`).all().map(jsonValue);
      const indexRows = db.prepare(`PRAGMA index_list(${quote(name)})`).all() as Array<{
        name: string; unique: number; origin: string; partial: number;
      }>;
      const indexes = indexRows
        .map((row) => ({ ...row, columns: db.prepare(`PRAGMA index_info(${quote(row.name)})`).all().map(jsonValue) }))
        .sort((a, b) => a.name.localeCompare(b.name));
      return { name, columns, foreignKeys, indexes };
    });
    const views = (db.prepare("SELECT name, COALESCE(sql,'') AS sql FROM sqlite_master WHERE type='view' ORDER BY name").all() as Array<{name:string;sql:string}>);
    const triggers = (db.prepare("SELECT name, tbl_name AS 'table', COALESCE(sql,'') AS sql FROM sqlite_master WHERE type='trigger' ORDER BY name").all() as Array<{name:string;table:string;sql:string}>);
    return { tables, views, triggers };
  } finally {
    db.close();
  }
}

export function schemaFingerprint(databasePath: string) {
  return sha256(JSON.stringify(schemaInventory(databasePath)));
}

export function databaseDataSnapshot(databasePath: string, includedTables?: string[]) {
  const db = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const rows = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name <> '_prisma_migrations' ORDER BY name"
    ).all() as Array<{ name: string }>;
    const allowed = includedTables ? new Set(includedTables) : null;
    const tables = allowed ? rows.filter(({ name }) => allowed.has(name)) : rows;
    const counts: Record<string, number> = {};
    const hash = createHash("sha256");
    for (const { name } of tables) {
      const columns = (db.prepare(`PRAGMA table_info(${quote(name)})`).all() as Array<{ name: string; pk: number }>);
      const order = columns.filter((column) => column.pk > 0).sort((a, b) => a.pk - b.pk).map((column) => quote(column.name));
      const fallback = columns.map((column) => quote(column.name));
      const rows = db.prepare(`SELECT * FROM ${quote(name)}${columns.length ? ` ORDER BY ${(order.length ? order : fallback).join(", ")}` : ""}`).all();
      counts[name] = rows.length;
      hash.update(name);
      hash.update(JSON.stringify(rows.map(jsonValue)));
    }
    return { counts, digest: hash.digest("hex").toUpperCase() };
  } finally {
    db.close();
  }
}

export function businessBaseline(databasePath: string) {
  const db = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const one = (sql: string) => Number((db.prepare(sql).get() as { value: number }).value ?? 0);
    return {
      students: one("SELECT COUNT(*) AS value FROM Student WHERE deletedAt IS NULL"),
      activeEnrollments: one("SELECT COUNT(*) AS value FROM AcademicYearEnrollment WHERE status = 'ACTIVE'"),
      payments: one("SELECT COUNT(*) AS value FROM Payment WHERE deletedAt IS NULL"),
      collected: one("SELECT COALESCE(SUM(amountPaid),0) AS value FROM Payment WHERE deletedAt IS NULL AND isCancelled = 0")
    };
  } finally {
    db.close();
  }
}

export function modelTableNames(schemaPath = path.join(PRISMA_ROOT, "schema.prisma")) {
  const source = readFileSync(schemaPath, "utf8");
  const names: string[] = [];
  const modelPattern = /model\s+(\w+)\s*\{([\s\S]*?)\n\}/g;
  let match: RegExpExecArray | null;
  while ((match = modelPattern.exec(source))) {
    const mapped = match[2].match(/@@map\(\s*"([^"]+)"\s*\)/)?.[1];
    names.push(mapped ?? match[1]);
  }
  return names.sort();
}

export function assertSchemaEquivalent(databasePath: string) {
  runPrisma([
    "migrate", "diff",
    "--from-url", databaseUrl(databasePath),
    "--to-schema-datamodel", "prisma/schema.prisma",
    "--exit-code"
  ], databasePath);
  const inventory = schemaInventory(databasePath);
  const tables = new Set(inventory.tables.map((table) => table.name));
  const missingModels = modelTableNames().filter((model) => !tables.has(model));
  if (missingModels.length) throw new Error(`SCHEMA_MODELS_MISSING: ${missingModels.join(",")}`);
  return {
    models: modelTableNames().length,
    tables: inventory.tables.length,
    indexes: inventory.tables.reduce((sum, table) => sum + table.indexes.length, 0),
    foreignKeys: inventory.tables.reduce((sum, table) => sum + table.foreignKeys.length, 0),
    fingerprint: sha256(JSON.stringify(inventory))
  };
}
