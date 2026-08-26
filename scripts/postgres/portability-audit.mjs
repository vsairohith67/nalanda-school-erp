import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(".");
const output = path.join(root, "docs", "evidence", "postgresql-portability-manifest.json");
const outputRelative = path.relative(root, output).replaceAll("\\", "/");
const patterns = [
  ["PRAGMA", /\bPRAGMA\b/i],
  ["sqlite_master", /\bsqlite_master\b/i],
  ["sqlite_sequence", /\bsqlite_sequence\b/i],
  ["AUTOINCREMENT", /\bAUTOINCREMENT\b/i],
  ["WITHOUT ROWID", /\bWITHOUT\s+ROWID\b/i],
  ["INSERT OR IGNORE", /\bINSERT\s+OR\s+IGNORE\b/i],
  ["REPLACE INTO", /\bREPLACE\s+INTO\b/i],
  ["datetime(", /\bdatetime\s*\(/i],
  ["strftime(", /\bstrftime\s*\(/i],
  ["julianday(", /\bjulianday\s*\(/i],
  ["unixepoch(", /\bunixepoch\s*\(/i],
  ["json_extract", /\bjson_extract\b/i],
  ["json_each", /\bjson_each\b/i],
  ["group_concat", /\bgroup_concat\b/i],
  ["COLLATE NOCASE", /\bCOLLATE\s+NOCASE\b/i],
  ["GLOB", /\bGLOB\b/],
  ["VACUUM", /\bVACUUM\b/i],
  ["WAL", /\bWAL\b/],
  ["busy_timeout", /\bbusy_timeout\b/i],
  ["foreign_keys", /\bforeign_keys\b/i],
  ["BEGIN IMMEDIATE", /\bBEGIN\s+IMMEDIATE\b/i],
  ["BEGIN EXCLUSIVE", /\bBEGIN\s+EXCLUSIVE\b/i],
  ["SQLite file", /(?:file:.*(?:\.db|\.sqlite)|\.(?:db|sqlite)\b)/i],
  ["sidecar", /(?:-wal|-shm|-journal|sidecar)/i],
  ["raw query", /\$(?:queryRaw|executeRaw)(?:Unsafe)?\b/],
  ["trigger", /\bCREATE\s+TRIGGER\b/i],
  ["view", /\bCREATE\s+(?:TEMP\s+)?VIEW\b/i],
  ["partial index", /\bCREATE\s+(?:UNIQUE\s+)?INDEX\b.*\bWHERE\b/i],
  ["generated column", /\bGENERATED\s+ALWAYS\b/i]
];

function classification(relative) {
  const normalized = relative.replaceAll("\\", "/");
  if (normalized.startsWith("prisma/migrations/")) return "SQLITE_ONLY";
  if (normalized.startsWith("prisma/postgresql/")) return "POSTGRESQL_ONLY";
  if (normalized.startsWith("scripts/postgres/") || /lib\/(?:database-|technical-operations|backup)/.test(normalized)) return "REQUIRES_ADAPTER";
  if (normalized.startsWith("tests/") || normalized.startsWith("docs/") || normalized.startsWith("deploy/")) return "PROVIDER_NEUTRAL";
  if (normalized.endsWith("schema.prisma")) return "SQLITE_ONLY";
  return "REQUIRES_ADAPTER";
}

const files = execFileSync("rg", ["--files", "-g", "!node_modules/**", "-g", "!.next/**", "-g", "!tmp/**", "-g", "!.qa-artifacts/**"], { cwd: root, encoding: "utf8" })
  .split(/\r?\n/)
  .filter(Boolean)
  .filter((relative) => relative.replaceAll("\\", "/") !== outputRelative)
  .sort((a, b) => a.localeCompare(b));
const entries = [];
for (const relative of files) {
  let source;
  try { source = readFileSync(path.join(root, relative), "utf8"); } catch { continue; }
  const matches = [];
  source.split(/\r?\n/).forEach((line, index) => {
    for (const [pattern, expression] of patterns) if (expression.test(line)) matches.push({ line: index + 1, pattern });
  });
  if (matches.length) entries.push({ path: relative.replaceAll("\\", "/"), classification: classification(relative), matches });
}
const counts = entries.reduce((result, entry) => ({ ...result, [entry.classification]: (result[entry.classification] ?? 0) + 1 }), {});
const manifest = {
  contract: "POSTGRES-READINESS-1A",
  generatedBy: "scripts/postgres/portability-audit.mjs",
  classifications: ["PROVIDER_NEUTRAL", "SQLITE_ONLY", "POSTGRESQL_ONLY", "REQUIRES_ADAPTER", "SHOULD_USE_PRISMA_API", "UNSAFE_OR_UNUSED"],
  scannedFiles: files.length,
  providerSpecificFiles: entries.length,
  counts,
  entries
};
writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ result: "POSTGRES_PORTABILITY_MANIFEST_WRITTEN", scannedFiles: files.length, providerSpecificFiles: entries.length, counts }));
