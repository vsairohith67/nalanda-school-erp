import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolvePnpmRuntimeEntry } from "../scripts/migration-check-utils";

describe("bulk exchange CI pnpm runtime compatibility", () => {
  it("runs the Corepack JavaScript entry when npm_execpath is a native binary", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "bulk-pnpm-native-"));
    try {
      const native = path.join(root, "pnpm-native");
      writeFileSync(native, Buffer.from([0x7f, 0x45, 0x4c, 0x46]));
      const script = path.join(root, "lib", "node_modules", "corepack", "dist", "pnpm.js");
      mkdirSync(path.dirname(script), { recursive: true });
      writeFileSync(script, 'console.log("synthetic-runtime-entry")');
      const entry = resolvePnpmRuntimeEntry({ NODE_ENV: "test", npm_execpath: native }, path.join(root, "bin", "node"));
      expect(entry).toBe(script);
      expect(execFileSync(process.execPath, [entry], { encoding: "utf8", windowsHide: true }).trim()).toBe("synthetic-runtime-entry");
    } finally {
      // The path is an owned mkdtemp result; no operational/worktree data is used.
      expect(path.dirname(path.resolve(root))).toBe(path.resolve(os.tmpdir()));
      rmSync(root, { recursive: true, force: true });
    }
  });
});
