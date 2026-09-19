import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolvePnpmRuntimeEntry } from "../scripts/migration-check-utils";

describe("bulk exchange CI pnpm runtime compatibility", () => {
  it.each([
    "qa-real-user-access-readiness-1a-public-repo-scan.ts",
    "qa-communication-delivery-foundation-1a-public-repo-scan.ts"
  ])("scans workspace configuration without admitting secrets or unknown roots: %s", (name) => {
    const root = mkdtempSync(path.join(os.tmpdir(), "bulk-public-config-"));
    const script = path.resolve("scripts", name);
    const runner = path.resolve("node_modules/tsx/dist/cli.mjs");
    try {
      const required = readFileSync(script, "utf8").match(/const required = \[([\s\S]*?)\];/)![1];
      for (const match of required.matchAll(/"([^"]+)"/g)) {
        const target = path.join(root, match[1]);
        mkdirSync(path.dirname(target), { recursive: true });
        writeFileSync(target, "");
      }
      const git = (...args: string[]) => execFileSync("git", args, { cwd: root, windowsHide: true, stdio: "pipe" });
      git("init", "--quiet");
      git("-c", "user.name=Synthetic QA", "-c", "user.email=qa@example.invalid", "commit", "--quiet", "--allow-empty", "-m", "synthetic baseline");
      git("update-ref", "refs/remotes/origin/main", "HEAD");
      const config = path.join(root, "pnpm-workspace.yaml");
      const run = () => spawnSync(process.execPath, [runner, script], {
        cwd: root, encoding: "utf8", windowsHide: true,
        env: { ...process.env, COMMUNICATION_DIFF_BASE_SHA: "" }
      });
      writeFileSync(config, 'packages:\n  - "."\noverrides:\n  sharp: 0.35.4\n');
      expect(run().status).toBe(0);
      writeFileSync(config, ["# -----BEGIN", "PRIVATE KEY-----\n"].join(" "));
      const secret = run();
      expect(secret.status).not.toBe(0);
      expect(secret.stderr).toContain("pnpm-workspace.yaml:private-key");
      writeFileSync(config, "packages: []\n");
      writeFileSync(path.join(root, "unreviewed.yaml"), "example: true\n");
      const unknown = run();
      expect(unknown.status).not.toBe(0);
      expect(unknown.stderr).toContain("unreviewed.yaml:out-of-scope");
    } finally {
      expect(path.dirname(path.resolve(root))).toBe(path.resolve(os.tmpdir()));
      rmSync(root, { recursive: true, force: true });
    }
  }, 30_000);

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
