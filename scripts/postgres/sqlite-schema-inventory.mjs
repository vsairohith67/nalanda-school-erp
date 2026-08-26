#!/usr/bin/env node

import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

const databasePath = path.resolve(process.argv[2] ?? "");
const outputArgument = process.argv.find((value) => value.startsWith("--out="))?.slice("--out=".length);
const workspace = path.resolve(".");
const relative = path.relative(path.join(workspace, "tmp"), databasePath);
if (!databasePath || relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
  throw new Error("SQLITE_SCHEMA_INVENTORY_REQUIRES_TMP_DATABASE");
}

const database = new DatabaseSync(databasePath, { readOnly: true });
try {
  const objects = database.prepare("SELECT type, name, tbl_name AS tableName, COALESCE(sql, '') AS sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name").all();
  const inventory = {
    source: "synthetic fresh SQLite migration deploy",
    sourceSha256: sha256(JSON.stringify(objects)),
    tables: objects.filter((row) => row.type === "table").map((row) => row.name),
    views: objects.filter((row) => row.type === "view").map((row) => ({ name: row.name, sql: row.sql })),
    indexes: objects.filter((row) => row.type === "index").map((row) => ({ name: row.name, table: row.tableName, sql: row.sql })),
    triggers: objects.filter((row) => row.type === "trigger").map((row) => ({ name: row.name, table: row.tableName, sql: row.sql }))
  };
  const serialized = `${JSON.stringify(inventory, null, 2)}\n`;
  if (outputArgument) writeFileSync(path.resolve(outputArgument), serialized, "utf8");
  console.log(JSON.stringify({
    result: "SQLITE_SCHEMA_INVENTORIED",
    tables: inventory.tables.length,
    views: inventory.views.length,
    indexes: inventory.indexes.length,
    partialIndexes: inventory.indexes.filter((row) => /\sWHERE\s/i.test(row.sql)).length,
    triggers: inventory.triggers.length,
    output: outputArgument ? path.basename(outputArgument) : null
  }));
} finally {
  database.close();
}
