import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { expect, it } from "vitest";
import { finalizeQaReliability, prepareQaReliability } from "../scripts/qa-recovery-service-traces";
import { QaTrace } from "./helpers/qa-reliability";

const workspace = process.cwd(), parent = path.join(workspace, "tmp");
const scanner = path.join(workspace, "scripts/qa-real-data-onboarding-preparation-1a-public-repo-scan.ts");
const owner = { contract: "NALANDA_SERVICE_TRACE_V1", source: "a".repeat(40), run: "1", attempt: "1", job: "harness-only-publication", provider: "sqlite", node: process.version, image: "unavailable", runner: "unavailable" };

// HARNESS_ONLY: actual finalizer and actual publication CLI, with invented
// journals. These controls do not claim a Compose or Windows-helper execution.
it.each(["failed-phase", "partial-journal", "private-artifact", "secret-content"] as const)("retains finite failed QA evidence through the actual publication scanner: %s", kind => {
  mkdirSync(parent, { recursive: true });
  const directory = mkdtempSync(path.join(parent, "qa-reliability-publication-")), identity = lstatSync(directory);
  let childSettlementKnown = true;
  const write = (file: string, bytes: string | Buffer) => { const target = path.join(directory, file); mkdirSync(path.dirname(target), { recursive: true }); writeFileSync(target, bytes); };
  const git = (...args: string[]) => {
    childSettlementKnown = false;
    const result = execFileSync("git", args, { cwd: directory, encoding: "utf8", stdio: "pipe", timeout: 10000, windowsHide: true }).trim();
    childSettlementKnown = true; return result;
  };
  try {
    const required = readFileSync(scanner, "utf8").match(/const required = \[([\s\S]*?)\];/)![1];
    for (const match of required.matchAll(/"([^"]+)"/g)) write(match[1], "// Invented required source\n");
    mkdirSync(path.join(directory, "templates/onboarding"), { recursive: true });
    git("init", "--initial-branch=main"); git("add", ".");
    git("-c", "user.name=Synthetic QA", "-c", "user.email=qa@example.com", "commit", "-m", "Invented scanner baseline");
    git("update-ref", "refs/remotes/origin/main", "HEAD");
    write("lib/onboarding-preparation.ts", "// Invented changed source activates full scope scan\n");

    const privateRoot = path.join(directory, "private", "qa-reliability");
    prepareQaReliability(privateRoot, owner);
    const caseRoot = path.join(privateRoot, "operations-harness-partial"); mkdirSync(caseRoot);
    const trace = new QaTrace("operations", "harness-partial", caseRoot);
    trace.begin("compose-config", 1); trace.finish("FAIL");
    if (kind === "partial-journal") writeFileSync(path.join(caseRoot, "phases.jsonl"), '{"privateField":"NOT_FOR_PUBLICATION"', { flag: "a" });
    const output = path.join(directory, "sanitized"); finalizeQaReliability(privateRoot, output, owner);
    const publicBytes = readFileSync(path.join(output, "qa-reliability.json"), "utf8"), value = JSON.parse(publicBytes);
    const recorded = value.cases.find((row: any) => row.caseId === "harness-partial");
    expect(recorded.classification).toBe("HARNESS_ONLY");
    expect(recorded.result).toBe(kind === "partial-journal" ? "UNKNOWN" : "FAIL");
    expect(recorded.unfinished).toEqual([{ span: 1, phase: "compose-config", attempt: 1 }]);
    expect(publicBytes).not.toContain("NOT_FOR_PUBLICATION");
    expect(publicBytes).not.toContain(directory);
    // Private fixture inputs are not part of the repository publication input.
    write(".git/info/exclude", "/private/\n/sanitized/\n");
    for (const file of ["qa-reliability.json", "manifest.json"]) write(`docs/evidence/synthetic-qa/${file}`, readFileSync(path.join(output, file)));
    if (kind === "private-artifact") write("tmp/ci-service-traces/qa-reliability/custody-harness-partial/stdout.bin", "INVENTED_PRIVATE_STREAM");
    if (kind === "secret-content") write("docs/evidence/synthetic-qa/unsafe.txt", ["-----BEGIN ", "PRIVATE KEY-----"].join(""));
    childSettlementKnown = false;
    const result = spawnSync(process.execPath, ["--import", pathToFileURL(path.join(workspace, "node_modules/tsx/dist/loader.mjs")).href, scanner], { cwd: directory, env: { ...process.env, TSX_DISABLE_CACHE: "1" }, encoding: "utf8", timeout: 10000, windowsHide: true });
    childSettlementKnown = !result.error && result.status !== null && result.signal === null;
    expect(result.error).toBeUndefined();
    if (kind === "private-artifact" || kind === "secret-content") {
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain(kind === "private-artifact" ? "OUT_OF_SCOPE_CHANGED_PATH" : "SECRET_LIKE_CONTENT_REFUSED");
    } else {
      expect(result.status, result.stderr).toBe(0); expect(result.stdout).toContain('"scopeChecked":true');
    }
  } finally {
    const current = lstatSync(directory), resolved = realpathSync(directory);
    expect(current.isSymbolicLink()).toBe(false); expect(current.dev).toBe(identity.dev); expect(current.ino).toBe(identity.ino);
    expect(path.dirname(resolved)).toBe(realpathSync(parent)); expect(path.basename(resolved)).toMatch(/^qa-reliability-publication-/);
    if (childSettlementKnown) { rmSync(resolved, { recursive: true }); expect(existsSync(resolved)).toBe(false); }
  }
});
