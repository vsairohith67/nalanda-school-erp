import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertBrowserRestoreExecutionSafe,
  assertBrowserRestorePayloadAllowed
} from "@/lib/browser-restore-safety";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("Browser restore fail-closed isolation", () => {
  it("allows execution only on an existing database inside an explicit copied-QA root", () => {
    const fixture = createFixture();
    expect(assertBrowserRestoreExecutionSafe({
      DATABASE_URL: fileUrl(fixture.copiedDatabase),
      BROWSER_RESTORE_COPIED_QA_ROOT: fixture.copiedQaRoot
    }, fixture.projectRoot)).toMatchObject({
      databaseFilename: "restore-copy.db",
      operationalDatabaseActive: false
    });
  });

  it("refuses missing, relative, outside-root, and operational database targets", () => {
    const fixture = createFixture();
    expect(() => assertBrowserRestoreExecutionSafe({
      DATABASE_URL: fileUrl(fixture.copiedDatabase)
    }, fixture.projectRoot)).toThrow("explicit copied-QA root");
    expect(() => assertBrowserRestoreExecutionSafe({
      DATABASE_URL: "file:./dev.db",
      BROWSER_RESTORE_COPIED_QA_ROOT: fixture.copiedQaRoot
    }, fixture.projectRoot)).toThrow("absolute SQLite");
    expect(() => assertBrowserRestoreExecutionSafe({
      DATABASE_URL: fileUrl(fixture.outsideDatabase),
      BROWSER_RESTORE_COPIED_QA_ROOT: fixture.copiedQaRoot
    }, fixture.projectRoot)).toThrow("outside the copied-QA root");
    expect(() => assertBrowserRestoreExecutionSafe({
      DATABASE_URL: fileUrl(fixture.operationalDatabase),
      BROWSER_RESTORE_COPIED_QA_ROOT: fixture.projectRoot
    }, fixture.projectRoot)).toThrow("refuses the operational database");
  });

  it("rejects role-permission rows while retaining ordinary backup payloads", () => {
    expect(() => assertBrowserRestorePayloadAllowed({
      rolePermissions: [{ role: "DIRECTOR", permission: "MANAGE_ROLE_PERMISSIONS", enabled: true }]
    })).toThrow("cannot restore role permissions");
    expect(() => assertBrowserRestorePayloadAllowed({ rolePermissions: [] })).not.toThrow();
  });

  it("keeps validation preview available and gates only restore execution", () => {
    const source = readFileSync("app/api/restore/route.ts", "utf8");
    const preview = source.indexOf('body.action === "validate"');
    const isolationGate = source.indexOf("assertBrowserRestoreExecutionSafe()");
    const restoreSink = source.indexOf("restoreValidatedBackup(prisma");
    expect(preview).toBeGreaterThan(-1);
    expect(isolationGate).toBeGreaterThan(preview);
    expect(restoreSink).toBeGreaterThan(isolationGate);
    expect(source.indexOf("assertBrowserRestorePayloadAllowed(backup)")).toBeGreaterThan(preview);
  });
});

function createFixture() {
  const root = mkdtempSync(path.join(tmpdir(), "browser-restore-"));
  roots.push(root);
  const projectRoot = path.join(root, "project");
  const copiedQaRoot = path.join(root, "copied-qa");
  mkdirSync(path.join(projectRoot, "prisma"), { recursive: true });
  mkdirSync(copiedQaRoot, { recursive: true });
  const operationalDatabase = path.join(projectRoot, "prisma", "dev.db");
  const copiedDatabase = path.join(copiedQaRoot, "restore-copy.db");
  const outsideDatabase = path.join(root, "outside.db");
  writeFileSync(operationalDatabase, "operational");
  writeFileSync(copiedDatabase, "copied");
  writeFileSync(outsideDatabase, "outside");
  return {
    projectRoot,
    copiedQaRoot,
    operationalDatabase,
    copiedDatabase,
    outsideDatabase
  };
}

function fileUrl(value: string) {
  return `file:${value.replaceAll("\\", "/")}`;
}
