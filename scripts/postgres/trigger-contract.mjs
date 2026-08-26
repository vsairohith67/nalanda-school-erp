#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const workspace = path.resolve(".");
const outputSql = path.join(workspace, "prisma", "postgresql", "trigger-equivalents.sql");
const outputManifest = path.join(workspace, "prisma", "postgresql", "trigger-manifest.json");

function sha256(value) {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

function translateCondition(source) {
  return source
    .trim()
    .replace(/\b((?:NEW|OLD|[A-Za-z][A-Za-z0-9_]*)\."(?:isActive|temporaryReturnRequired)")\s*(=|<>)\s*1\b/g, "$1 $2 TRUE")
    .replace(/\b((?:NEW|OLD|[A-Za-z][A-Za-z0-9_]*)\."(?:isActive|temporaryReturnRequired)")\s*(=|<>)\s*0\b/g, "$1 $2 FALSE")
    .replace(/\s+IS\s+NOT\s+(?!NULL\b)/gi, " IS DISTINCT FROM ")
    .replace(/\s+IS\s+(?!NOT\b|NULL\b|DISTINCT\b)/gi, " IS NOT DISTINCT FROM ");
}

function sqlLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function parseStatement(statement, triggerName) {
  const source = statement.trim();
  let match = source.match(/^SELECT\s+RAISE\s*\(\s*ABORT\s*,\s*'((?:''|[^'])*)'\s*\)(?:\s+WHERE\s+([\s\S]+))?$/i);
  if (match) return { condition: match[2]?.trim() ?? "TRUE", message: match[1].replaceAll("''", "'") };
  match = source.match(/^SELECT\s+CASE\s+WHEN\s+([\s\S]+)\s+THEN\s+RAISE\s*\(\s*ABORT\s*,\s*'((?:''|[^'])*)'\s*\)\s+END$/i);
  if (match) return { condition: match[1].trim(), message: match[2].replaceAll("''", "'") };
  throw new Error(`POSTGRES_TRIGGER_STATEMENT_UNSUPPORTED:${triggerName}`);
}

function parseTrigger(trigger) {
  const match = trigger.sql.trim().match(/^CREATE\s+TRIGGER\s+"([^"]+)"\s+BEFORE\s+(INSERT|UPDATE|DELETE)(?:\s+OF\s+([\s\S]*?))?\s+ON\s+"([^"]+)"(?:\s+FOR\s+EACH\s+ROW)?(?:\s+WHEN\s+([\s\S]*?))?\s+BEGIN\s+([\s\S]*?)\s+END$/i);
  if (!match) throw new Error(`POSTGRES_TRIGGER_HEADER_UNSUPPORTED:${trigger.name}`);
  const [, name, event, columns, table, headerCondition, body] = match;
  if (name !== trigger.name || table !== trigger.table) throw new Error(`POSTGRES_TRIGGER_IDENTITY_MISMATCH:${trigger.name}`);
  const statements = body.split(";").map((value) => value.trim()).filter(Boolean).map((value) => parseStatement(value, name));
  if (!statements.length) throw new Error(`POSTGRES_TRIGGER_BODY_EMPTY:${name}`);
  return { name, event: event.toUpperCase(), columns: columns?.trim() ?? null, table, headerCondition: headerCondition?.trim() ?? null, statements };
}

function renderTrigger(trigger) {
  const functionName = `nalanda_trigger_${sha256(trigger.name).slice(0, 20).toLowerCase()}`;
  const returnValue = trigger.event === "DELETE" ? "OLD" : "NEW";
  const checks = trigger.statements.map((statement) => {
    const condition = [trigger.headerCondition, statement.condition === "TRUE" ? null : statement.condition]
      .filter(Boolean)
      .map((value) => `(${translateCondition(value)})`)
      .join(" AND ") || "TRUE";
    return `  IF ${condition} THEN\n    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = ${sqlLiteral(statement.message)};\n  END IF;`;
  }).join("\n");
  const columns = trigger.columns ? ` OF ${trigger.columns}` : "";
  return [
    `-- SQLite trigger parity: ${trigger.name}`,
    `CREATE FUNCTION "${functionName}"() RETURNS trigger`,
    "LANGUAGE plpgsql",
    "AS $nalanda_trigger$",
    "BEGIN",
    checks,
    `  RETURN ${returnValue};`,
    "END;",
    "$nalanda_trigger$;",
    "",
    `CREATE TRIGGER "${trigger.name}"`,
    `BEFORE ${trigger.event}${columns} ON "${trigger.table}"`,
    "FOR EACH ROW",
    `EXECUTE FUNCTION "${functionName}"();`
  ].join("\n");
}

export function triggerContract(inventoryPath) {
  const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"));
  if (inventory.views.length) throw new Error("POSTGRES_TRIGGER_CONTRACT_VIEWS_UNSUPPORTED");
  const parsed = inventory.triggers.map(parseTrigger).sort((a, b) => a.name.localeCompare(b.name));
  const sql = `${[
    "-- GENERATED PostgreSQL equivalents for the final active SQLite trigger inventory.",
    "-- Source business semantics are preserved with null-safe comparisons and native booleans.",
    ""
  ].join("\n")}${parsed.map(renderTrigger).join("\n\n")}\n`;
  const manifest = {
    contractVersion: 1,
    source: inventory.source,
    sourceSha256: inventory.sourceSha256,
    views: inventory.views.length,
    triggerCount: parsed.length,
    sqlSha256: sha256(sql),
    triggers: parsed.map((trigger) => ({
      name: trigger.name,
      table: trigger.table,
      event: trigger.event,
      columns: trigger.columns,
      statementCount: trigger.statements.length,
      sqliteSqlSha256: sha256(inventory.triggers.find((item) => item.name === trigger.name).sql)
    }))
  };
  return { sql, manifest };
}

function main() {
  const inventoryPath = path.resolve(process.argv[2] ?? "");
  const mode = process.argv[3] ?? "--check";
  const contract = triggerContract(inventoryPath);
  if (mode === "--write") {
    mkdirSync(path.dirname(outputSql), { recursive: true });
    writeFileSync(outputSql, contract.sql, "utf8");
    writeFileSync(outputManifest, `${JSON.stringify(contract.manifest, null, 2)}\n`, "utf8");
  } else if (mode === "--check") {
    if (readFileSync(outputSql, "utf8").replaceAll("\r\n", "\n") !== contract.sql) throw new Error("POSTGRES_TRIGGER_SQL_DRIFT");
    const committed = JSON.parse(readFileSync(outputManifest, "utf8"));
    if (JSON.stringify(committed) !== JSON.stringify(contract.manifest)) throw new Error("POSTGRES_TRIGGER_MANIFEST_DRIFT");
  } else {
    throw new Error(`POSTGRES_TRIGGER_MODE_INVALID:${mode}`);
  }
  console.log(JSON.stringify({ result: mode === "--write" ? "POSTGRES_TRIGGER_CONTRACT_WRITTEN" : "POSTGRES_TRIGGER_CONTRACT_IN_SYNC", triggers: contract.manifest.triggerCount, views: contract.manifest.views, sqlSha256: contract.manifest.sqlSha256 }));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : "POSTGRES_TRIGGER_CONTRACT_FAILED");
  process.exitCode = 1;
}
