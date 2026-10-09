import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, realpathSync, rmSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import path from "node:path";

const root = process.cwd(), prefix = path.join(root, "tmp");
const reviewed = [".gitignore", "consumer-runner.d.mts", "fixture.d.mts", "output.d.mts", "examples/operations.csv"];
const script = path.join(root, "scripts/qa-communication-delivery-foundation-1a-public-repo-scan.ts");
const cases = ["reviewed", "mts-sibling", "csv-sibling", "dotfile-sibling", "lookalike", "nested-lookalike", "private-key", "token", "credential", "oversized", "binary", "private-output", "school-file"] as const;

describe("actual five-path communication publication admission", () => {
  it.each(cases)("preserves the existing policy for %s", kind => {
    mkdirSync(prefix, { recursive: true });
    const dir = mkdtempSync(path.join(prefix, "lab-admission-"));
    const write = (file: string, value: string | Buffer) => { const p = path.join(dir, file); mkdirSync(path.dirname(p), { recursive: true }); writeFileSync(p, value); };
    const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, stdio: "pipe" }).toString();
    try {
      const required = readFileSync(script, "utf8").match(/const required = \[([\s\S]*?)\];/)![1];
      for (const match of required.matchAll(/"([^"]+)"/g)) write(match[1], "synthetic required artifact\n");
      git("init", "--initial-branch=main"); git("add", ".");
      git("-c", "user.name=Synthetic QA", "-c", "user.email=qa@example.com", "commit", "-m", "synthetic publication baseline");
      git("update-ref", "refs/remotes/origin/main", "HEAD");
      for (const file of reviewed) write("scripts/laptop-lab/" + file, readFileSync(path.join(root, "scripts/laptop-lab", file), "utf8"));
      const operand = "scripts/laptop-lab/consumer-runner.d.mts";
      if (kind === "mts-sibling") write("scripts/laptop-lab/unreviewed.d.mts", "export const invented: string;\n");
      if (kind === "csv-sibling") write("scripts/laptop-lab/examples/unreviewed.csv", "invented,value\n");
      if (kind === "dotfile-sibling") write("scripts/laptop-lab/.unreviewed", "synthetic\n");
      if (kind === "lookalike") write("scripts/laptop-lab-other/examples/operations.csv", "synthetic\n");
      if (kind === "nested-lookalike") write("scripts/laptop-lab/nested/examples/operations.csv", "synthetic\n");
      if (kind === "private-key") write(operand, ["-----BEGIN ", "PRIVATE KEY-----"].join(""));
      if (kind === "token") write(operand, ["gh", "p_"].join("") + "A".repeat(36));
      if (kind === "credential") write(operand, "postgresql" + "://" + "invented:" + "P".repeat(12) + "@example.invalid/synthetic");
      if (kind === "oversized") write(operand, Buffer.alloc(5 * 1024 * 1024 + 1, 32));
      if (kind === "binary") write("scripts/laptop-lab/owned.db", "synthetic prohibited extension\n");
      if (kind === "private-output") { write("scripts/laptop-lab/outputs/owned.csv", "synthetic output\n"); git("add", "-f", "scripts/laptop-lab/outputs/owned.csv"); }
      if (kind === "school-file") write("school-data/invented.csv", "synthetic prohibited location\n");
      expect(git("check-ignore", "scripts/laptop-lab/outputs/synthetic.json").trim()).toBe("scripts/laptop-lab/outputs/synthetic.json");
      const result = spawnSync(process.execPath, ["--import", pathToFileURL(path.join(root, "node_modules/tsx/dist/loader.mjs")).href, script], {
        cwd: dir, encoding: "utf8", timeout: 10000,
        env: { ...process.env, COMMUNICATION_DIFF_BASE_SHA: git("rev-parse", "HEAD").trim(), TSX_DISABLE_CACHE: "1" }
      });
      expect(result.error).toBeUndefined();
      if (kind === "reviewed") { expect(result.status, result.stderr).toBe(0); expect(result.stdout).toContain("COMMUNICATION_PUBLIC_REPO_SCAN_PASSED"); }
      else {
        expect(result.status).not.toBe(0);
        const label = kind === "private-key" ? ":private-key" : kind === "token" ? ":github-token" : kind === "credential" ? ":database-credential-url" : kind === "oversized" ? ":unsafe-or-oversized" : kind === "binary" ? ":private-or-binary-artifact" : kind === "school-file" ? ":out-of-scope" : ":unreviewed-extension";
        expect(result.stderr).toContain(label);
      }
    } finally {
      const resolved = realpathSync(dir); expect(path.dirname(resolved)).toBe(realpathSync(prefix)); expect(path.basename(resolved)).toMatch(/^lab-admission-/); rmSync(resolved, { recursive: true });
    }
  });
});
