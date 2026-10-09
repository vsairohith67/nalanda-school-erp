import { it, expect } from "vitest";
import { mkdtempSync, lstatSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { ServiceTrace, readTrace } from "./helpers/service-trace";
import { MfaJourneyObservation, mfaPhase, observeMfaClient } from "./helpers/native-mfa-trace";
import { finalize } from "../scripts/qa-recovery-service-traces";

// HARNESS_ONLY: deliberate child failures and timed promises test observation
// and cleanup ordering; they never reproduce the historical service timeout.
it.each(["mfa-fail", "mfa-timeout", "mfa-pending"])("retains %s without replacing child failure with finalizer success", mode => {
  const root = mkdtempSync(path.join(tmpdir(), "nalanda-mfa-recorder-")), identity = lstatSync(root);
  try {
    const privateRoot = path.join(root, "private"); mkdirSync(privateRoot);
    const file = path.join(privateRoot, "mfa.jsonl");
    const child = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "--config", "tests/fixtures/service-trace-child.config.ts"], { env: { ...process.env, SERVICE_TRACE_CHILD_MODE: mode, SERVICE_TRACE_CHILD_FILE: file }, encoding: "utf8", timeout: 12000, windowsHide: true });
    expect(child.error).toBeUndefined(); expect(child.signal).toBeNull(); expect(child.status).toBe(1);
    const events = readTrace(file);
    expect(events.some(e => e.kind === "RESULT" && e.status === "FAIL")).toBe(true);
    expect(events.some(e => e.status === "PASS")).toBe(false);
    expect(JSON.stringify(events)).not.toMatch(/PRIVATE_FAILURE|cookie|token|secret|SQL/);
    const work = events.find(e => e.kind === "START" && e.phase === "mfa_journey")!;
    const ended = events.find(e => ["END", "ERROR"].includes(e.kind) && e.span === work.span);
    const cleanup = events.find(e => e.kind === "START" && e.phase === "cleanup");
    if (mode === "mfa-pending") { expect(ended).toBeUndefined(); expect(cleanup).toBeUndefined(); }
    else { expect(ended).toBeDefined(); expect(cleanup!.seq).toBeGreaterThan(ended!.seq); }
    const owner = { contract: "NALANDA_SERVICE_TRACE_V1", source: "a".repeat(40), run: "1", attempt: "1", job: "HARNESS_ONLY", provider: "sqlite", node: process.version, image: "unavailable", runner: "unavailable" };
    writeFileSync(path.join(privateRoot, "ownership.json"), JSON.stringify(owner) + "\n");
    for (const kind of ["finance", "native"]) { const t = new ServiceTrace(path.join(privateRoot, `${kind}.jsonl`)); t.result("pass"); t.close(); }
    const dest = path.join(root, "public"); expect(finalize(privateRoot, dest, owner)).toHaveLength(3);
    const retained = JSON.parse(readFileSync(path.join(dest, "mfa.json"), "utf8"));
    expect(retained.events).toEqual(events); expect(retained.unfinished.some((e: any) => e.phase === "mfa_journey")).toBe(mode === "mfa-pending");
    expect(child.status).toBe(1); // Publication is metadata, never test acceptance.
  } finally {
    const current = lstatSync(root); expect(current.isSymbolicLink()).toBe(false); expect(current.ino).toBe(identity.ino); expect(current.dev).toBe(identity.dev); expect(path.dirname(root)).toBe(path.resolve(tmpdir()));
    rmSync(root, { recursive: true }); expect(existsSync(root)).toBe(false);
  }
});

it("delegates transactions unchanged, adds no reads and retains the original result/refusal", async () => {
  const trace = new ServiceTrace(), observer = new MfaJourneyObservation(trace), tx = {}, options = { isolationLevel: "Serializable" }, result = {}, refusal = Error("PRIVATE_NOT_RECORDED");
  let calls = 0;
  const original = { $transaction: async (fn: any, received: any) => { calls++; expect(received).toBe(options); return fn(tx); } };
  const client = observeMfaClient(original), parent = trace.begin("test_case");
  expect(await observer.run(parent, () => mfaPhase("mfa_totp", () => client.$transaction(async (current: typeof tx) => { expect(current).toBe(tx); return result; }, options), 1))).toBe(result);
  await expect(observer.run(parent, () => mfaPhase("mfa_recovery", () => client.$transaction(async () => { throw refusal; }, options), 2))).rejects.toBe(refusal);
  expect(calls).toBe(2); expect(observer.pendingCount).toBe(0); expect(await observer.drain()).toBe(true);
  expect(trace.events.filter(e => e.kind === "START" && e.phase === "transaction_action").map(e => e.attempt)).toEqual([1, 2]);
  expect(JSON.stringify(trace.events)).not.toContain("PRIVATE"); trace.end(parent); trace.close();
});

it("keeps interleaved journeys separately linked and refuses cleanup while work is pending", async () => {
  const trace = new ServiceTrace(), observer = new MfaJourneyObservation(trace), first = trace.begin("test_case"), second = trace.begin("test_case");
  let release!: () => void;
  const blocked = observer.run(first, () => mfaPhase("mfa_verify", () => new Promise<void>(resolve => { release = resolve; }), 1));
  await observer.run(second, () => mfaPhase("native_exchange", async () => {}, 2));
  expect(await observer.drain(1)).toBe(false); expect(observer.pendingCount).toBe(1);
  for (const budget of [0, 5001, NaN]) await expect(observer.drain(budget)).rejects.toThrow("BOUND_INVALID");
  const journeys = trace.events.filter(e => e.kind === "START" && e.phase === "mfa_journey");
  expect(trace.events.filter(e => e.kind === "LINK" && e.phase === "mfa_journey").map(e => (e.detail as any).parentSpan)).toEqual([first, second]);
  expect(journeys).toHaveLength(2); release(); await blocked; expect(await observer.drain()).toBe(true); expect(observer.pendingCount).toBe(0);
  trace.end(first); trace.end(second); trace.close();
});
