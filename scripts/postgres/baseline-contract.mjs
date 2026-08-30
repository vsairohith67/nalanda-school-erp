#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { schemaContract } from "./schema-contract.mjs";

const workspace = path.resolve(".");
const migrationName = "20260826_postgresql_baseline";
const migrationPath = path.join(workspace, "prisma", "postgresql", "migrations", migrationName, "migration.sql");
const triggerPath = path.join(workspace, "prisma", "postgresql", "trigger-equivalents.sql");
const RELEASED_BASELINE_SHA256 = "B567F7FD126BEB48403A54BF82519C7C1D13DEFC015280E5A02DA81818F6FBAA";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

function prismaBaseline() {
  const prismaEntry = path.join(workspace, "node_modules", "prisma", "build", "index.js");
  const placeholder = "postgresql://provider-generation.invalid/nalanda_generation_only";
  const result = spawnSync(process.execPath, [
    prismaEntry,
    "migrate", "diff",
    "--from-empty",
    "--to-schema-datamodel", "prisma/postgresql/schema.prisma",
    "--script"
  ], {
    cwd: workspace,
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL || placeholder, DIRECT_URL: process.env.DIRECT_URL || placeholder },
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true
  });
  if (result.error || result.status !== 0) throw new Error(`POSTGRES_BASELINE_DIFF_FAILED:${result.error?.message ?? result.stderr.trim()}`);
  return result.stdout.replaceAll("\r\n", "\n").trimEnd();
}

export function baselineContract() {
  const schema = schemaContract();
  const triggers = readFileSync(triggerPath, "utf8").replaceAll("\r\n", "\n").trim();
  const partialIndex = [
    "-- Provider-equivalent partial uniqueness not expressible in the current Prisma schema.",
    "CREATE UNIQUE INDEX \"ParentMeetingParticipant_one_primary\"",
    "ON \"ParentMeetingParticipant\"(\"meetingId\")",
    "WHERE \"participantRole\" = 'PRIMARY_STAFF' AND \"status\" <> 'REMOVED';"
  ].join("\n");
  const sql = `${[
    "-- POSTGRES-READINESS-1A baseline generated from the canonical 330-model schema.",
    "-- Contains no data. SQLite migration history remains separate and unchanged.",
    ""
  ].join("\n")}${prismaBaseline()}\n\n${partialIndex}\n\n${triggers}\n`;
  return { sql, sha256: sha256(sql), schema };
}

function main() {
  const mode = process.argv[2] ?? "--check";
  if (mode !== "--check") throw new Error("POSTGRES_RELEASED_BASELINE_IMMUTABLE");
  const committed = readFileSync(migrationPath, "utf8").replaceAll("\r\n", "\n");
  const actualSha256 = sha256(committed);
  if (actualSha256 !== RELEASED_BASELINE_SHA256) throw new Error("POSTGRES_BASELINE_MIGRATION_DRIFT");
  console.log(JSON.stringify({ result: "POSTGRES_BASELINE_IN_SYNC", migrationName, sha256: actualSha256, policy: "RELEASED_BASELINE_IMMUTABLE" }));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : "POSTGRES_BASELINE_CONTRACT_FAILED");
  process.exitCode = 1;
}
