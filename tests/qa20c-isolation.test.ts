import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { assertQa20cIsolatedEnvironment } from "@/lib/qa20c-isolation";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("Prompt 20C copied-database isolation guard", () => {
  it("does not affect ordinary production processes", () => {
    expect(assertQa20cIsolatedEnvironment({})).toEqual({ enabled: false });
  });

  it("accepts only the copied database and isolated storage roots", () => {
    const fixture = createFixture();
    const evidence = assertQa20cIsolatedEnvironment(fixture.environment);
    expect(evidence).toEqual({
      enabled: true,
      databaseFilename: "qa20c-isolated.db",
      providerDirectory: "provider",
      operationalDatabaseActive: false
    });
    expect(JSON.stringify(evidence)).not.toContain(realpathSync.native(fixture.root));
  });

  it("refuses the operational database before Prisma is constructed", () => {
    const fixture = createFixture();
    expect(() => assertQa20cIsolatedEnvironment({
      ...fixture.environment,
      DATABASE_URL: fileUrl(fixture.operationalDatabase)
    })).toThrowError("QA20C_OPERATIONAL_DATABASE_REFUSED");
  });

  it("refuses a copied database or storage directory outside the isolated root", () => {
    const fixture = createFixture();
    expect(() => assertQa20cIsolatedEnvironment({
      ...fixture.environment,
      DATABASE_URL: fileUrl(fixture.outsideDatabase)
    })).toThrowError("QA20C_DATABASE_OUTSIDE_ISOLATED_ROOT");
    expect(() => assertQa20cIsolatedEnvironment({
      ...fixture.environment,
      CLOUD_BACKUP_LOCAL_FOLDER: path.dirname(fixture.outsideDatabase)
    })).toThrowError("QA20C_PROVIDER_ROOT_MISMATCH");
  });

  it("requires an absolute file datasource and every isolated directory marker", () => {
    const fixture = createFixture();
    expect(() => assertQa20cIsolatedEnvironment({
      ...fixture.environment,
      DATABASE_URL: "file:./dev.db"
    })).toThrowError("QA20C_DATABASE_URL_MUST_BE_ABSOLUTE");
    expect(() => assertQa20cIsolatedEnvironment({
      ...fixture.environment,
      CLOUD_BACKUP_REHEARSAL_DIR: undefined
    })).toThrowError("QA20C_REHEARSAL_ROOT_REQUIRED");
  });
});

function createFixture() {
  const root = mkdtempSync(path.join(tmpdir(), "qa20c-isolation-"));
  roots.push(root);
  for (const child of ["database", "provider", "temp", "rehearsal"]) {
    mkdirSync(path.join(root, child), { recursive: true });
  }
  const operationalDatabase = path.join(root, "operational.db");
  const isolatedDatabase = path.join(root, "database", "qa20c-isolated.db");
  const outsideDatabase = path.join(root, "outside.db");
  writeFileSync(operationalDatabase, "operational");
  writeFileSync(isolatedDatabase, "isolated");
  writeFileSync(outsideDatabase, "outside");
  return {
    root,
    operationalDatabase,
    outsideDatabase,
    environment: {
      QA20C_ISOLATED_DATABASE: "true",
      QA20C_OPERATIONAL_DATABASE_PATH: operationalDatabase,
      QA20C_ISOLATED_ROOT: root,
      DATABASE_URL: fileUrl(isolatedDatabase),
      CLOUD_BACKUP_LOCAL_FOLDER: path.join(root, "provider"),
      CLOUD_BACKUP_TEMP_DIR: path.join(root, "temp"),
      CLOUD_BACKUP_REHEARSAL_DIR: path.join(root, "rehearsal")
    }
  };
}

function fileUrl(value: string) {
  return `file:${value.replaceAll("\\", "/")}`;
}
