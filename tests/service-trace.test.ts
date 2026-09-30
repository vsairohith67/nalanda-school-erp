import { describe, it, expect } from "vitest";
import { mkdtempSync, lstatSync, rmSync, readFileSync, writeFileSync, mkdirSync, existsSync, linkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { ServiceTrace, readTrace, validateEvent } from "./helpers/service-trace";
import { finalize } from "../scripts/qa-recovery-service-traces";
import { observeDecision, observeRevocation } from "./helpers/native-decision-trace";

function owned() {
  const root = mkdtempSync(path.join(tmpdir(), "nalanda-service-recorder-")), identity = lstatSync(root);
  return { root, cleanup() { const now = lstatSync(root); expect(now.isSymbolicLink()).toBe(false); expect(now.ino).toBe(identity.ino); expect(now.dev).toBe(identity.dev); expect(path.dirname(root)).toBe(path.resolve(tmpdir())); rmSync(root, { recursive: true }); expect(existsSync(root)).toBe(false); } };
}
const owner = { contract: "NALANDA_SERVICE_TRACE_V1", source: "a".repeat(40), run: "1", attempt: "1", job: "HARNESS_ONLY", provider: "sqlite", node: process.version, image: "unavailable", runner: "unavailable" };
function files(root: string) {
  mkdirSync(root); writeFileSync(path.join(root, "ownership.json"), JSON.stringify(owner) + "\n");
  for (const kind of ["finance", "native"]) { const trace = new ServiceTrace(path.join(root, `${kind}.jsonl`)); const span = trace.begin("setup"); trace.end(span); trace.result("pass"); trace.close(); }
}
describe("HARNESS_ONLY service recorder retention and publication", () => {
  it.each(["fail", "timeout", "setup-fail"])("retains %s child evidence and verifies nonzero exit without reclassifying acceptance", mode => {
    const resource = owned();
    try {
      const file = path.join(resource.root, "child.jsonl");
      const child = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "--config", "tests/fixtures/service-trace-child.config.ts"], { env: { ...process.env, SERVICE_TRACE_CHILD_MODE: mode, SERVICE_TRACE_CHILD_FILE: file }, encoding: "utf8", timeout: 12000, windowsHide: true });
      expect(child.error).toBeUndefined(); expect(child.signal).toBeNull(); expect(child.status).toBe(1);
      const events = readTrace(file); expect(events.some(e => e.kind === "RESULT" && e.status === "FAIL")).toBe(true);
      expect(events.some(e => e.kind === "START" && e.phase === (mode === "setup-fail" ? "setup" : "recorder_selftest"))).toBe(true);
      if (mode === "timeout") expect(events.some(e => e.kind === "END")).toBe(false);
      else expect(events.some(e => e.kind === "ERROR")).toBe(true);
      expect(events.some(e => e.status === "PASS")).toBe(false);
    } finally { resource.cleanup(); }
  });
  it("publishes only the exact allowlisted files and explicitly retains unfinished phases", () => {
    const resource = owned();
    try { const root = path.join(resource.root, "private"), dest = path.join(resource.root, "public"); files(root);
      const trace = new ServiceTrace(path.join(root, "unfinished.jsonl")); trace.begin("snapshot"); trace.result("fail"); trace.close();
      // An unexpected input is refusal, not an extra file in an upload glob.
      expect(() => finalize(root, dest, owner)).toThrow("HANDOFF_INVALID"); expect(existsSync(dest)).toBe(false);
      const data = readFileSync(path.join(root, "unfinished.jsonl")); rmSync(path.join(root, "unfinished.jsonl")); writeFileSync(path.join(root, "finance.jsonl"), data);
      expect(finalize(root, dest, owner).map(f => f.file)).toEqual(["finance.json", "native.json"]);
      expect(JSON.parse(readFileSync(path.join(dest, "finance.json"), "utf8")).unfinished).toEqual([{ span: 1, phase: "snapshot" }]);
      expect(JSON.parse(readFileSync(path.join(dest, "manifest.json"), "utf8")).files).toHaveLength(2);
      expect(() => finalize(root, dest, owner)).toThrow();
    } finally { resource.cleanup(); }
  });
  it.each(["unknown", "private", "truncated", "oversized", "duplicate", "foreign-owner", "hardlink"])("fails closed on %s before public emission", kind => {
    const resource = owned();
    try { const root = path.join(resource.root, "private"), dest = path.join(resource.root, "public"); files(root); const file = path.join(root, "native.jsonl"); const raw = readFileSync(file, "utf8");
      if (kind === "unknown" || kind === "private") { const event = JSON.parse(raw.split("\n")[0]); event[kind === "private" ? "cookie" : "extra"] = "PRIVATE_FIELD_MUST_NOT_PASS"; writeFileSync(file, JSON.stringify(event) + "\n"); }
      if (kind === "truncated") writeFileSync(file, raw.slice(0, -1));
      if (kind === "oversized") writeFileSync(file, "x".repeat(2_000_001));
      if (kind === "duplicate") writeFileSync(file, raw.replace('"seq":1', '"seq":1,"seq":1'));
      if (kind === "foreign-owner") writeFileSync(path.join(root, "ownership.json"), JSON.stringify({ ...owner, run: "2" }) + "\n");
      if (kind === "hardlink") { rmSync(file); linkSync(path.join(root, "finance.jsonl"), file); }
      expect(() => finalize(root, dest, owner)).toThrow(); expect(existsSync(dest)).toBe(false);
    } finally { resource.cleanup(); }
  });
  it("accepts only strict synthetic labels, decision rows and bounded safe states", () => {
    const trace = new ServiceTrace();
    trace.emit("DECISION", "evaluator", 0, 1, null, { actor: trace.label("private actor"), session: trace.label("private cookie identity"), role: trace.label("private role"), actorRole: "SUPER_ADMIN", cutoffMs: 1, attempt: 1, allowed: false, source: "USER_DENY", rows: [] });
    expect(JSON.stringify(trace.events)).not.toContain("private");
    trace.emit("TEST_CONTRACT", "test_case", 0, 0, null, { case: trace.label("private-case"), purpose: "DECLARED_ROLLBACK_AND_ROUTE_CONTROL" });
    expect(() => trace.emit("TEST_CONTRACT", "test_case", 0, 0, null, { case: "local-1", purpose: "PRIVATE_ARBITRARY_NAME" })).toThrow();
    for (const bad of [{ ...trace.events[0], status: "RAW_ERROR_OR_TOKEN" }, { ...trace.events[0], detail: { ...trace.events[0].detail, actor: "unrestricted-id" } }, { ...trace.events[0], extra: "raw" }]) expect(() => validateEvent(bad)).toThrow();
    trace.close();
  });
  it("observes existing transaction queries and their cutoff without an additional query or changed outcome", async () => {
    const trace = new ServiceTrace(), cutoff = new Date(100), row = { id: "private-override", userId: "private-actor", effect: "DENY", status: "ACTIVE", validFrom: new Date(99), validUntil: null, revokedAt: null };
    let queries = 0, transactions = 0;
    const tx = { userPermissionOverride: { findMany: async (args: any) => { expect(args.cutoff).toBe(cutoff); queries++; return [row]; } }, userRoleAssignment: { findFirst: async () => ({ role: "SUPER_ADMIN" }) } };
    const client = { $transaction: async (fn: any) => { transactions++; return fn(tx); } };
    const input = { userId: row.userId, sessionId: "private-web", roleAssignmentId: "private-role", now: cutoff };
    const evaluate = async (db: any, args: any) => { await db.userRoleAssignment.findFirst({}); const rows = await db.userPermissionOverride.findMany({ cutoff: args.now }); expect(rows[0]).toBe(row); return { allowed: false, source: "USER_DENY" }; };
    const refusal = Error("ORIGINAL_REFUSAL_NOT_EMITTED");
    const service = async (db: any) => { for (let i = 0; i < 2; i++) await db.$transaction(async (current: any) => { expect(await observeDecision(evaluate, current, input)).toEqual({ allowed: false, source: "USER_DENY" }); }); throw refusal; };
    await expect(observeRevocation(trace, service, client)).rejects.toBe(refusal);
    expect(queries).toBe(2); expect(transactions).toBe(2);
    expect(trace.events.filter(e => e.kind === "DECISION_INPUT").map(e => (e.detail as any).cutoffMs)).toEqual([100, 100]);
    expect(trace.events.filter(e => e.kind === "RETURNED_ROWS").map(e => (e.detail as any).rows.length)).toEqual([1, 1]);
    const decisions = trace.events.filter(e => e.kind === "DECISION");
    expect(decisions.map(e => e.attempt)).toEqual([1, 2]);
    expect(decisions.map(e => (e.detail as any).cutoffMs)).toEqual([100, 100]);
    expect((decisions[0].detail as any).rows).toHaveLength(1);
    expect(JSON.stringify(trace.events)).not.toMatch(/private-|ORIGINAL_REFUSAL/);
    expect(trace.events.filter(e => e.kind === "OUTCOME").map(e => e.status)).toEqual(["REJECTED"]);
    trace.close();
  });
});
