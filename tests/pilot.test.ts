import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createPilotDatabaseCopy,
  formatPilotDatabaseFilename,
  isPilotDatabaseUrl
} from "../lib/pilot";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, {
    recursive: true,
    force: true
  })));
});

describe("pilot database safety", () => {
  it("generates the expected timestamped pilot filename", () => {
    expect(formatPilotDatabaseFilename(new Date(2026, 5, 20, 9, 7))).toBe(
      "nalanda-pilot-2026-06-20-09-07.db"
    );
  });

  it("does not overwrite an existing pilot database", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "nalanda-pilot-"));
    temporaryDirectories.push(directory);
    const sourcePath = path.join(directory, "source.db");
    const destinationPath = path.join(directory, "pilot-data", "nalanda-pilot.db");
    await writeFile(sourcePath, "source database");
    await mkdir(path.dirname(destinationPath), { recursive: true });
    await writeFile(destinationPath, "existing pilot database", { flag: "wx" });

    await expect(createPilotDatabaseCopy({ sourcePath, destinationPath }))
      .rejects.toThrow("was not overwritten");
    expect(await readFile(destinationPath, "utf8")).toBe("existing pilot database");
  });

  it("detects pilot mode by folder or database filename", () => {
    expect(isPilotDatabaseUrl("file:../pilot-data/nalanda-2026.db")).toBe(true);
    expect(isPilotDatabaseUrl("file:./nalanda-pilot.db")).toBe(true);
    expect(isPilotDatabaseUrl("file:./dev.db")).toBe(false);
    expect(isPilotDatabaseUrl(undefined)).toBe(false);
  });
});
