import { describe, expect, it } from "vitest";
import { getAppInfo } from "../lib/app-info";

describe("app version information", () => {
  it("returns package version, mode, and database provider", () => {
    expect(getAppInfo({ NODE_ENV: "production" })).toMatchObject({
      name: "Nalanda School Management System",
      version: "0.1.0",
      buildMode: "Production",
      databaseProvider: "SQLite"
    });
  });

  it("reports the selected PostgreSQL build without exposing connection details", () => {
    expect(getAppInfo({ NODE_ENV: "production", DATABASE_PROVIDER: "postgresql" }).databaseProvider).toBe("PostgreSQL");
  });
});
