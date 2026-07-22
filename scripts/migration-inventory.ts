import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "./migration-isolation";

function fileSha256(filePath: string) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex").toUpperCase();
}

export const LEGACY_MIGRATION_ROOT = path.join(WORKSPACE_ROOT, "prisma", "migration-archives", "devops1b-legacy-chain");
export const ACTIVE_MIGRATION_ROOT = path.join(WORKSPACE_ROOT, "prisma", "migrations");
export const LEGACY_MANIFEST_PATH = path.join(LEGACY_MIGRATION_ROOT, "DEVOPS1B_LEGACY_MIGRATION_MANIFEST.json");

export type MigrationInventoryRow = {
  directory: string;
  purpose: string;
  tablesCreated: string[];
  tablesAltered: string[];
  indexesAndConstraints: string[];
  dependencies: string[];
  missingDependencies: string[];
  assumesPriorData: boolean;
  dataStatements: string[];
  safeOnEmptyInOrder: boolean;
  operationalStatus: string;
  sha256: string;
};

function migrationDirectories(root: string) {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(path.join(root, entry.name, "migration.sql")))
    .map((entry) => entry.name)
    .sort();
}

function matches(source: string, expression: RegExp) {
  return [...source.matchAll(expression)].map((match) => match[1]).filter(Boolean);
}

function unique(values: string[]) {
  return [...new Set(values)].sort();
}

function purpose(directory: string) {
  return directory.replace(/^\d+_?/, "").split("_").filter(Boolean).map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
}

export function buildMigrationInventory(root: string): MigrationInventoryRow[] {
  const available = new Set<string>();
  const rows: MigrationInventoryRow[] = [];
  for (const directory of migrationDirectories(root)) {
    const sqlPath = path.join(root, directory, "migration.sql");
    const sql = readFileSync(sqlPath, "utf8");
    const tablesCreated = unique(matches(sql, /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?([^"`\s(]+)["`]?/gi));
    const tablesAltered = unique(matches(sql, /ALTER\s+TABLE\s+["`]?([^"`\s;]+)["`]?/gi));
    const referenced = matches(sql, /REFERENCES\s+["`]?([^"`\s(]+)["`]?/gi);
    const indexTargets = matches(sql, /CREATE\s+(?:UNIQUE\s+)?INDEX\s+["`]?[^"`\s]+["`]?\s+ON\s+["`]?([^"`\s(]+)["`]?/gi);
    const indexNames = matches(sql, /CREATE\s+(?:UNIQUE\s+)?INDEX\s+["`]?([^"`\s]+)["`]?/gi);
    const constraints = matches(sql, /CONSTRAINT\s+["`]?([^"`\s]+)["`]?/gi);
    const dataStatements = [...sql.matchAll(/^\s*(INSERT(?:\s+OR\s+\w+)?\s+INTO|UPDATE|DELETE\s+FROM)\s+["`]?([^"`\s(]+)["`]?/gim)]
      .map((match) => `${match[1].replace(/\s+/g, " ").toUpperCase()} ${match[2]}`);
    const dataTargets = [...sql.matchAll(/^\s*(?:INSERT(?:\s+OR\s+\w+)?\s+INTO|UPDATE|DELETE\s+FROM)\s+["`]?([^"`\s(]+)["`]?/gim)].map((match) => match[1]);
    const dependencies = unique([...tablesAltered, ...referenced, ...indexTargets, ...dataTargets].filter((name) => !tablesCreated.includes(name)));
    const missingDependencies = dependencies.filter((name) => !available.has(name));
    rows.push({
      directory,
      purpose: purpose(directory),
      tablesCreated,
      tablesAltered,
      indexesAndConstraints: unique([...indexNames, ...constraints]),
      dependencies,
      missingDependencies,
      assumesPriorData: dataStatements.length > 0,
      dataStatements: unique(dataStatements),
      safeOnEmptyInOrder: missingDependencies.length === 0,
      operationalStatus: "Not recorded; the verified operational database had no _prisma_migrations table",
      sha256: fileSha256(sqlPath)
    });
    for (const table of tablesCreated) available.add(table);
  }
  return rows;
}

function list(values: string[]) {
  return values.length ? values.map((value) => `\`${value}\``).join(", ") : "None";
}

export function inventoryMarkdown(rows: MigrationInventoryRow[]) {
  const unsafe = rows.filter((row) => !row.safeOnEmptyInOrder);
  const lines = [
    "# Prisma Migration Dependency Inventory",
    "",
    "## Scope and evidence",
    "",
    `This inventory covers all ${rows.length} historical migration directories captured before DEVOPS-1B repair. SQL hashes are SHA-256. The verified operational database had no \`_prisma_migrations\` table, so none of these migrations was recorded there as applied.`,
    "",
    "The parser treats an altered table, index target, data-mutation target, or foreign-key target as a dependency. A migration is marked unsafe in ordered empty-database deployment when a dependency has not been created by an earlier active migration.",
    "",
    "## Findings",
    "",
    `- Empty-chain-safe migrations in recorded order: ${rows.length - unsafe.length}.`,
    `- Migrations with unresolved prior dependencies: ${unsafe.length}.`,
    `- Never-created foundational dependencies include: ${list(unique(unsafe.flatMap((row) => row.missingDependencies)))}.`,
    "- The first migration alters `Payment` before any migration creates it; the second migration alters `Student` before any migration creates it.",
    "- Because the original core-schema migration is absent, repairing only the first SQL statement would expose further missing dependencies rather than produce a trustworthy historical chain.",
    "",
    "## Per-migration inventory",
    ""
  ];
  for (const row of rows) {
    lines.push(
      `### ${row.directory}`,
      "",
      `- Purpose: ${row.purpose}.`,
      `- Tables created: ${list(row.tablesCreated)}.`,
      `- Tables altered: ${list(row.tablesAltered)}.`,
      `- Indexes and named constraints: ${list(row.indexesAndConstraints)}.`,
      `- Dependencies: ${list(row.dependencies)}.`,
      `- Missing at this point in the historical chain: ${list(row.missingDependencies)}.`,
      `- Assumes prior data: ${row.assumesPriorData ? `Yes (${row.dataStatements.join(", ")})` : "No"}.`,
      `- Safe on an empty database in recorded order: ${row.safeOnEmptyInOrder ? "Yes" : "No"}.`,
      `- Operational _prisma_migrations status: ${row.operationalStatus}.`,
      `- migration.sql SHA-256: \`${row.sha256}\`.`,
      ""
    );
  }
  return `${lines.join("\n").trim()}\n`;
}

export function writeLegacyManifest(root = LEGACY_MIGRATION_ROOT) {
  const migrations = migrationDirectories(root).map((directory) => {
    const sqlPath = path.join(root, directory, "migration.sql");
    return { directory, sha256: fileSha256(sqlPath), bytes: statSync(sqlPath).size };
  });
  const manifest = {
    formatVersion: 1,
    archivePurpose: "DEVOPS-1B preserved pre-baseline Prisma migration evidence",
    archivedFromCommit: "2d1ac63ae4ed987ed9aaf7e9754b93e0f3213758",
    authoritativeSchemaSha256: "B1135F63C2E5579F320A5FFD01BDB3A167520B42D479D3906F7BB611FC82FC00",
    migrationCount: migrations.length,
    migrations
  };
  writeFileSync(LEGACY_MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
}

export function verifyLegacyManifest() {
  if (!existsSync(LEGACY_MANIFEST_PATH)) throw new Error("LEGACY_MIGRATION_MANIFEST_MISSING");
  const manifest = JSON.parse(readFileSync(LEGACY_MANIFEST_PATH, "utf8")) as { migrationCount: number; migrations: Array<{directory:string;sha256:string;bytes:number}> };
  if (manifest.migrationCount !== 40 || manifest.migrations.length !== 40) throw new Error("LEGACY_MIGRATION_MANIFEST_COUNT_INVALID");
  for (const row of manifest.migrations) {
    const sqlPath = path.join(LEGACY_MIGRATION_ROOT, row.directory, "migration.sql");
    if (!existsSync(sqlPath) || fileSha256(sqlPath) !== row.sha256 || statSync(sqlPath).size !== row.bytes) {
      throw new Error(`LEGACY_MIGRATION_MANIFEST_MISMATCH: ${row.directory}`);
    }
  }
  return manifest;
}

function main() {
  const source = existsSync(LEGACY_MIGRATION_ROOT) ? LEGACY_MIGRATION_ROOT : ACTIVE_MIGRATION_ROOT;
  const rows = buildMigrationInventory(source);
  if (process.argv.includes("--write-manifest")) writeLegacyManifest(source);
  if (process.argv.includes("--write-doc")) {
    writeFileSync(path.join(WORKSPACE_ROOT, "docs", "PRISMA_MIGRATION_DEPENDENCY_INVENTORY.md"), inventoryMarkdown(rows), "utf8");
  }
  if (existsSync(LEGACY_MIGRATION_ROOT)) verifyLegacyManifest();
  const unresolved = rows.filter((row) => !row.safeOnEmptyInOrder);
  const active = migrationDirectories(ACTIVE_MIGRATION_ROOT);
  const digest = createHash("sha256").update(JSON.stringify(rows.map((row) => ({ directory: row.directory, sha256: row.sha256 })))).digest("hex").toUpperCase();
  console.log(`Migration inventory passed: active=${active.length} legacy=${existsSync(LEGACY_MIGRATION_ROOT) ? rows.length : 0} unresolvedLegacyDependencies=${unresolved.length}`);
  console.log(`Legacy inventory fingerprint: ${digest}`);
  if (unresolved.length) console.log(`Unresolved historical dependency migrations: ${unresolved.map((row) => row.directory).join(", ")}`);
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("/scripts/migration-inventory.ts")) {
  try { main(); } catch (error) {
    console.error(error instanceof Error ? error.message : "Migration inventory failed");
    process.exitCode = 1;
  }
}
