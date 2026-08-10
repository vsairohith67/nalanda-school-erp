import { copyFileSync, existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/password";
import { ensureDefaultRolePermissions } from "../lib/role-permissions";
import { OPERATIONAL_DATABASE, QA_ROOT, assertIsolatedDatabasePath, cleanupIsolatedDatabase, databaseUrl, ensureQaRoot } from "./migration-isolation";

const DATABASE_PATH = path.join(QA_ROOT, "operational-copy", "IMPORT1A-browser.db");
const BROWSER_LOGIN = ["Import1a", "-Browser", "-QA!", "2026"].join("");
const PREFIX = "import1a-browser-";
const ROLES = ["DIRECTOR", "PRINCIPAL", "ADMIN", "COMPUTER_OPERATOR", "ACCOUNTANT", "TEACHER", "PARENT", "VIEWER"] as const;

async function main() {
  const action = String(process.argv[2] ?? "").toLowerCase();
  if (action === "setup") return setup();
  if (action === "cleanup") return cleanup();
  throw new Error("Use setup or cleanup");
}

async function setup() {
  ensureQaRoot();
  const target = assertIsolatedDatabasePath(DATABASE_PATH);
  if (existsSync(target)) cleanupIsolatedDatabase(target);
  copyFileSync(OPERATIONAL_DATABASE, target);
  const prismaCli = path.join(process.cwd(), "node_modules", "prisma", "build", "index.js");
  const migrated = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: databaseUrl(target) }, encoding: "utf8" });
  if (migrated.status !== 0) throw new Error("IMPORT1A_BROWSER_MIGRATION_FAILED");
  const client = new PrismaClient({ datasourceUrl: databaseUrl(target) });
  try {
    const browserCredentialHash = await hashPassword(BROWSER_LOGIN);
    for (const role of ROLES) {
      const suffix = role.toLowerCase().replaceAll("_", "-");
      const id = `${PREFIX}${suffix}`;
      const user = await client.user.create({ data: { id, name: `IMPORT1A ${role.replaceAll("_", " ")}`, username: id, passwordHash: browserCredentialHash, role, isActive: true, lifecycleStatus: "ACTIVE", designation: role } });
      await client.authLoginAlias.create({ data: { id: `${id}-alias`, userId: user.id, type: "USERNAME", normalizedValue: id, displayMasked: id, status: "VERIFIED", isSchoolGoverned: true, verifiedAt: new Date() } });
      await client.userRoleAssignment.create({ data: { id: `${id}-assignment`, publicKey: `${id}-assignment-public`, userId: user.id, role, status: "ACTIVE", reason: "IMPORT1A copied-database Browser fixture", assignedByUserId: user.id, activeKey: `${user.id}:${role}` } });
    }
    await ensureDefaultRolePermissions(client);
    const directorId = `${PREFIX}director`;
    await client.onboardingBatch.create({ data: {
      id: `${PREFIX}staff-batch`, publicKey: "10000000-0000-4000-8000-000000000001", bundleType: "STAFF", status: "APPROVAL_REQUIRED", version: 2,
      uploadedByUserId: directorId, originalFileNameHash: "f".repeat(64), storageKey: "source/aa/bb/10000000-0000-4000-8000-000000000002.xlsx", workbookSha256: "a".repeat(64), mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", byteSize: 1024,
      templateVersion: "1.0", schemaVersion: "IMPORT-1A-2026-08-10", planHash: "b".repeat(64), planVersion: 1,
      planSummaryJson: JSON.stringify({ sheetRows: { Staff: 1 }, createCount: 1, linkCount: 0, enrollmentCount: 0, warningCount: 0, blockingErrorCount: 0, duplicateCount: 0, accountProposalCount: 1, issues: [] }),
      planExpiresAt: new Date(Date.now() + 60 * 60 * 1000), purgeAfter: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      auditEvents: { create: { sequence: 1, eventType: "VALIDATED", previousStatus: "UPLOADED", newStatus: "APPROVAL_REQUIRED", actorUserId: directorId, evidenceHash: "b".repeat(64) } }
    } });
    console.log(JSON.stringify({ status: "IMPORT1A_BROWSER_FIXTURES_READY", databaseUrl: databaseUrl(target), users: ROLES.length, batches: 1 }));
  } finally {
    await client.$disconnect();
  }
}

function cleanup() {
  const target = assertIsolatedDatabasePath(DATABASE_PATH);
  if (existsSync(target)) cleanupIsolatedDatabase(target);
  console.log(JSON.stringify({ status: "IMPORT1A_BROWSER_FIXTURES_CLEANED" }));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : "IMPORT1A_BROWSER_FIXTURE_FAILED"); process.exitCode = 1; });
