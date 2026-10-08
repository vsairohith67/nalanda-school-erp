import { it, expect } from "vitest";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { QaTrace, readQaJournal, projectQaSignal, type QaCase } from "./helpers/qa-reliability";
import { atomicPrivateJson, captureCustodyChild, custodyStartupScript, custodyStreamLimit, readCustodyStages, safePrivateJson } from "./helpers/custody-execution";
import { ServiceTrace } from "./helpers/service-trace";
import { prepareQaReliability, finalizeQaReliability, finalize } from "../scripts/qa-recovery-service-traces";

// HARNESS_ONLY: fixed Node programs start no descendants and make no native
// custody/Compose/product/admission claim. Real helper cases stay separate.
const owner = { contract: "NALANDA_SERVICE_TRACE_V1", source: "a".repeat(40), run: "1", attempt: "1", job: "HARNESS_ONLY", provider: "sqlite", node: process.version, image: "unavailable", runner: "unavailable" };
function owned() {
  const root = mkdtempSync(path.join(tmpdir(), "nalanda-qa-reliability-")), identity = lstatSync(root);
  return { root, cleanup() { const now = lstatSync(root); expect(now.isSymbolicLink()).toBe(false); expect(now.ino).toBe(identity.ino); expect(now.dev).toBe(identity.dev); expect(path.dirname(root)).toBe(path.resolve(tmpdir())); rmSync(root, { recursive: true }); } };
}
function prepared(base: string) { const root = path.join(base, "private", "qa-reliability"); prepareQaReliability(root, owner); return root; }
function caseTrace(root: string, id: QaCase) { const directory = path.join(root, `custody-${id}`); mkdirSync(directory); return { directory, trace: new QaTrace("custody", id, directory) }; }

it("persists launch intent before blocking and retains exit/stdout without parse masking", () => {
  const r = owned();
  try {
    const root = prepared(r.root), { directory, trace } = caseTrace(root, "harness-nonzero"), script = path.join(directory, "child-control.cjs");
    writeFileSync(script, `const fs=require('node:fs'),path=require('node:path');const root=__dirname;
const launch=JSON.parse(fs.readFileSync(path.join(root,'parent-launch.json'),'utf8'));
const first=JSON.parse(fs.readFileSync(path.join(root,'phases.jsonl'),'utf8').split('\\n')[0]);
if(launch.timeoutMs!==10000||first.phase!=='custody-parent-launch')process.exit(9);
process.stdout.write('{"partial":');process.stderr.write('PRIVATE_CHILD_DIAGNOSTIC');process.exit(7);`);
    const result = captureCustodyChild({ command: process.execPath, args: [script], directory, trace, mode: "HARNESS_ONLY" }); trace.finish("FAIL");
    expect(result.process.exit).toBe(7); expect(result.process.errorCategory).toBe("NONZERO_EXIT"); expect(result.output.state).toBe("MALFORMED");
    expect(result.stdout).toBe('{"partial":'); expect(result.stderr).toBe("PRIVATE_CHILD_DIAGNOSTIC"); expect(result.process.closed).toBe(true); expect(result.process.settled).toBe("UNKNOWN");
    expect(result.evidenceComplete).toBe(true); expect(result.nativeMetadataValid).toBe(false);
    const dest = path.join(r.root, "public"); finalizeQaReliability(root, dest, owner);
    const raw = readFileSync(path.join(dest, "qa-reliability.json"), "utf8");
    expect(raw).not.toMatch(/PRIVATE_CHILD_DIAGNOSTIC|parentPid|childPid|executable|creationUtc|parent-launch\.json|stdout\.bin/);
    expect(JSON.parse(raw).cases.find((c: any) => c.caseId === "harness-nonzero").declaredResult).toBe("FAIL");
    expect(readdirSync(dest).sort()).toEqual(["manifest.json", "qa-reliability.json"]);
    const manifest = JSON.parse(readFileSync(path.join(dest, "manifest.json"), "utf8"));
    expect(manifest.files).toEqual([{ file: "qa-reliability.json", size: Buffer.byteLength(raw), sha256: createHash("sha256").update(raw).digest("hex") }]);
    expect(JSON.parse(raw).cases.filter((c: any) => c.state === "MISSING")).toHaveLength(15);
  } finally { r.cleanup(); }
});

it.each(["startup", "timeout", "partial", "missing", "malformed", "initialization", "clean", "output-limit"] as const)("retains %s control without claiming real helper execution", mode => {
  const r = owned();
  try {
    const root = prepared(r.root), { directory, trace } = caseTrace(root, `harness-${mode}`), script = path.join(directory, "child-control.cjs");
    const prefix = `const fs=require('node:fs'),path=require('node:path');const root=__dirname;`;
    const programs = {
      startup: "",
      timeout: `fs.writeFileSync(path.join(root,'helper-process.json.partial'),'{');process.stdout.write('{"partial":');setInterval(()=>{},100);`,
      partial: `fs.writeFileSync(path.join(root,'helper-process.json.partial'),'{');process.exit(3);`,
      missing: `process.stdout.write('{"contract":"HARNESS_ONLY"}');`,
      malformed: `fs.writeFileSync(path.join(root,'helper-process.json'),'{"partial":');process.stdout.write('not-json');process.exit(4);`,
      initialization: `fs.writeFileSync(path.join(root,'initialization-failure.json'),JSON.stringify({stage:'HARNESS_ONLY'}));process.stderr.write('CUSTODY_FIXTURE_INITIALIZATION_FAILED');process.exit(1);`,
      clean: `fs.writeFileSync(path.join(root,'wrapper-start.json'),JSON.stringify({stage:'WRAPPER_ENTRY',elapsedMs:0}));fs.writeFileSync(path.join(root,'helper-process.json'),JSON.stringify({executable:'C:\\\\Windows\\\\System32\\\\WindowsPowerShell\\\\v1.0\\\\powershell.exe',version:'5.1.1.1',is64Bit:true,languageMode:'FullLanguage',effectivePolicy:'RemoteSigned',pid:process.pid,creationUtc:new Date().toISOString()}));process.stdout.write('{"contract":"HARNESS_ONLY"}');`,
      "output-limit": `process.stdout.write(Buffer.alloc(200000,120));setInterval(()=>{},100);`
    };
    writeFileSync(script, prefix + programs[mode]);
    const result = captureCustodyChild({ command: mode === "startup" ? path.join(directory, "does-not-exist.exe") : process.execPath, args: [script], directory, trace, mode: "HARNESS_ONLY", timeoutMs: mode === "timeout" ? 500 : 10000 }); trace.finish(mode === "clean" ? "PASS" : "FAIL");
    expect(result.process.settled).toBe("UNKNOWN"); expect(result.receipt.mode).toBe("HARNESS_ONLY");
    if (mode === "startup") { expect(result.process.errorCategory).toBe("STARTUP"); expect(result.process.exit).toBeNull(); expect(result.receipt.childPid).toBeNull(); expect(result.process.closed).toBeNull(); }
    if (mode === "timeout") { expect(result.process.errorCategory).toBe("TIMEOUT"); expect(result.receipt.errorCode).toBe("ETIMEDOUT"); expect(result.stdout).toBe('{"partial":'); }
    if (mode === "partial" || mode === "timeout") { expect(result.metadata.state).toBe("MISSING"); expect(existsSync(path.join(directory, "helper-process.json.partial"))).toBe(true); }
    if (mode === "missing") { expect(result.process.exit).toBe(0); expect(result.output.state).toBe("VALID"); expect(result.nativeMetadataValid).toBe(false); }
    if (mode === "malformed") { expect(result.process.exit).toBe(4); expect(result.output.state).toBe("MALFORMED"); expect(result.metadata.state).toBe("MALFORMED"); }
    if (mode === "initialization") { expect(result.process.exit).toBe(1); expect(result.stderr).not.toContain("LOCAL_CUSTODY_REFUSED"); expect(result.nativeMetadataValid).toBe(false); }
    if (mode === "clean") { expect(result.process.exit).toBe(0); expect(result.nativeMetadataValid).toBe(true); expect(readCustodyStages(directory)[0].state).toBe("VALID"); }
    if (mode === "output-limit") { expect(result.process.errorCategory).toBe("OUTPUT_LIMIT"); expect(lstatSync(path.join(directory, "stdout.bin")).size).toBeLessThanOrEqual(custodyStreamLimit); }
    expect(result.evidenceComplete).toBe(true);
    const dest = path.join(r.root, "public"); finalizeQaReliability(root, dest, owner);
    const c = JSON.parse(readFileSync(path.join(dest, "qa-reliability.json"), "utf8")).cases.find((c: any) => c.caseId === `harness-${mode}`);
    expect(c.classification).toBe("HARNESS_ONLY"); expect(c.processSettlement).toBe("UNKNOWN"); expect(c.result).not.toBe("PASS");
    expect(c.childStages.find((s: any) => s.stage === "HELPER_ENTRY").state).toBe("MISSING");
  } finally { r.cleanup(); }
});

it.each(["pending", "failed-phase", "unsettled", "partial", "malformed", "private-field", "missing"])("publishes conservative %s state and preserves the valid prefix", mode => {
  const r = owned();
  try {
    const root = prepared(r.root), { directory, trace } = caseTrace(root, "harness-clean"), file = path.join(directory, "phases.jsonl");
    const span = trace.begin("fixture-create");
    if (mode !== "pending") trace.end(span, mode === "failed-phase" ? "FAIL" : "PASS", mode === "unsettled" ? { exit: 0, signal: null, errorCategory: "NONE", durationMs: 1, closed: true, settled: "UNKNOWN" } : null);
    trace.finish("PASS"); const original = readFileSync(file, "utf8");
    if (mode === "partial") writeFileSync(file, original.slice(0, -4));
    if (mode === "malformed") writeFileSync(file, original.split("\n")[0] + "\n{bad}\n");
    if (mode === "private-field") { const event = JSON.parse(original.split("\n")[1]); event.cookie = "PRIVATE_COOKIE"; writeFileSync(file, original.split("\n")[0] + "\n" + JSON.stringify(event) + "\n"); }
    if (mode === "missing") rmSync(file);
    const journal = readQaJournal(file); expect(journal.result).toBe("UNKNOWN");
    if (mode !== "missing") expect(journal.events[0].phase).toBe("fixture-create");
    const dest = path.join(r.root, "public"); finalizeQaReliability(root, dest, owner); expect(readFileSync(path.join(dest, "qa-reliability.json"), "utf8")).not.toContain("PRIVATE_COOKIE");
  } finally { r.cleanup(); }
});

it("makes metadata atomic, rejects replay and never treats a torn marker as successful", () => {
  const r = owned();
  try {
    const file = path.join(r.root, "helper-process.json"); writeFileSync(file + ".partial", '{"executable":');
    expect(safePrivateJson(file).state).toBe("MISSING"); expect(() => atomicPrivateJson(file, { value: 1 })).toThrow(); expect(existsSync(file)).toBe(false);
    rmSync(file + ".partial"); atomicPrivateJson(file, { value: 1 }); expect(safePrivateJson(file)).toEqual({ state: "VALID", value: { value: 1 } });
    expect(() => atomicPrivateJson(file, { value: 2 })).toThrow("REPLAY"); expect(() => atomicPrivateJson(path.join(r.root, "oversized.json"), "x".repeat(16384))).toThrow("BOUND");
    writeFileSync(path.join(r.root, "wrapper-start.json.partial"), '{"stage":'); expect(readCustodyStages(r.root)[0].state).toBe("PARTIAL");
  } finally { r.cleanup(); }
});

it("writes the initial startup marker before any cmdlet serialization or module import", () => {
  const script = custodyStartupScript("C:\\HARNESS_ONLY");
  expect(script.indexOf("Write-A4Stage 'wrapper-start.json'")).toBeLessThan(script.indexOf("Import-Module"));
  expect(script.indexOf("Write-A4Stage 'wrapper-start.json'")).toBeLessThan(script.indexOf("ConvertTo-Json"));
  expect(script.slice(0, script.indexOf("Import-Module"))).not.toContain("ConvertTo-Json");
});

it("retains an observed null nested exit separately from actual parent process status", () => {
  const r = owned();
  try {
    atomicPrivateJson(path.join(r.root, "helper-exit.json"), { stage: "HELPER_EXIT", elapsedMs: 1, exit: null });
    expect(readCustodyStages(r.root).at(-1)).toEqual({ stage: "HELPER_EXIT", state: "VALID", elapsedMs: 1, exit: null });
    const file = path.join(r.root, "phases.jsonl"), trace = new QaTrace("custody", "harness-clean", r.root), span = trace.begin("custody-parent-launch");
    trace.end(span, "PASS", { exit: 0, signal: null, errorCategory: "NONE", durationMs: 1, closed: true, settled: "UNKNOWN" }); trace.finish("PASS");
    const retained = readQaJournal(file); expect(retained.declaredResult).toBe("PASS"); expect(retained.result).toBe("UNKNOWN");
    expect(retained.events.find(e => e.process)?.process?.exit).toBe(0);
  } finally { r.cleanup(); }
});

it("reports lost child journaling as incomplete observations and retains known/unknown signals", () => {
  const r = owned();
  try {
    const root = prepared(r.root), { directory, trace } = caseTrace(root, "harness-clean"), script = path.join(directory, "child-control.cjs");
    writeFileSync(script, "process.stdout.write('{}')"); const child = captureCustodyChild({ command: process.execPath, args: [script], directory, trace, mode: "HARNESS_ONLY" }); trace.finish("PASS");
    expect(child.process.exit).toBe(0); rmSync(path.join(directory, "phases.jsonl"));
    const dest = path.join(r.root, "public"); finalizeQaReliability(root, dest, owner);
    const c = JSON.parse(readFileSync(path.join(dest, "qa-reliability.json"), "utf8")).cases.find((c: any) => c.caseId === "harness-clean");
    expect(c.execution).toBe("OBSERVATIONS_INCOMPLETE"); expect(c.result).toBe("UNKNOWN");
    expect(projectQaSignal("SIGHUP")).toBe("SIGHUP"); expect(projectQaSignal("SIGSEGV")).toBe("SIGSEGV"); expect(projectQaSignal("UNRECOGNIZED_SIGNAL")).toBe("UNKNOWN"); expect(projectQaSignal(null)).toBeNull();
  } finally { r.cleanup(); }
});

it("retains the primary nonzero result when private stream recording fails", () => {
  const r = owned();
  try {
    const root = prepared(r.root), { directory, trace } = caseTrace(root, "harness-nonzero"), script = path.join(directory, "child-control.cjs");
    writeFileSync(script, "process.stdout.write('partial');process.exit(7)"); writeFileSync(path.join(directory, "stdout.bin"), "already-owned");
    const result = captureCustodyChild({ command: process.execPath, args: [script], directory, trace, mode: "HARNESS_ONLY" }); trace.finish("FAIL");
    expect(result.process.exit).toBe(7); expect(result.process.errorCategory).toBe("NONZERO_EXIT"); expect(result.stdout).toBe("partial");
    expect(result.evidenceComplete).toBe(false); expect(result.receipt.recordingErrors).toEqual(["STDOUT_WRITE"]);
    expect(safePrivateJson(path.join(directory, "parent-result.json")).value?.exit).toBe(7);
  } finally { r.cleanup(); }
});

it("publishes a complete no-process harness result and records cancellation before signal delivery", () => {
  const r = owned();
  try {
    const root = prepared(r.root), { directory, trace } = caseTrace(root, "harness-clean"), span = trace.begin("fixture-create");
    trace.end(span); trace.finish("PASS"); trace.cancel();
    expect(readQaJournal(path.join(directory, "phases.jsonl")).result).toBe("PASS");
    const { directory: cancelledDir, trace: cancelled } = caseTrace(root, "harness-timeout");
    cancelled.signal.addEventListener("abort", () => expect(readQaJournal(path.join(cancelledDir, "phases.jsonl")).events.some(e => e.phase === "cancellation" && e.kind === "START")).toBe(true));
    cancelled.cancel("TEST_TIMEOUT"); cancelled.finish("FAIL"); expect(cancelled.signal.aborted).toBe(true);
    finalizeQaReliability(root, path.join(r.root, "public"), owner);
  } finally { r.cleanup(); }
});

it.each(["foreign-owner", "invalid-owner", "unknown-file", "oversized", "replay"])("refuses %s before public effects", mode => {
  const r = owned();
  try {
    const root = path.join(r.root, "private", "qa-reliability"), dest = path.join(r.root, "public");
    if (mode === "invalid-owner") { expect(() => prepareQaReliability(root, { ...owner, source: "invalid" })).toThrow(); expect(existsSync(path.dirname(root))).toBe(false); return; }
    prepareQaReliability(root, owner);
    if (mode === "foreign-owner") writeFileSync(path.join(root, "ownership.json"), JSON.stringify({ ...owner, contract: "NALANDA_QA_RELIABILITY_V1", run: "2" }) + "\n");
    if (mode === "replay") { expect(() => prepareQaReliability(root, owner)).toThrow(); return; }
    if (mode === "unknown-file" || mode === "oversized") { const { directory, trace } = caseTrace(root, "harness-clean"); trace.finish("PASS"); writeFileSync(path.join(directory, mode === "unknown-file" ? "unknown.json" : "stdout.bin"), "x".repeat(mode === "oversized" ? 131073 : 1)); }
    expect(() => finalizeQaReliability(root, dest, owner)).toThrow(); expect(existsSync(dest)).toBe(false);
  } finally { r.cleanup(); }
});

it("keeps the legacy finalizer independent and accepts only its known QA sibling directory", () => {
  const r = owned();
  try {
    const root = path.join(r.root, "private"); mkdirSync(root); writeFileSync(path.join(root, "ownership.json"), JSON.stringify(owner) + "\n");
    for (const kind of ["finance", "native", "mfa"]) { const t = new ServiceTrace(path.join(root, `${kind}.jsonl`)); t.result("pass"); t.close(); }
    const qa = path.join(root, "qa-reliability"); prepareQaReliability(qa, owner); const { directory, trace } = caseTrace(qa, "harness-clean"); trace.finish("FAIL"); writeFileSync(path.join(directory, "phases.jsonl"), "{bad}\n");
    expect(finalize(root, path.join(r.root, "legacy-public"), owner)).toHaveLength(3);
    mkdirSync(path.join(root, "unknown-directory")); expect(() => finalize(root, path.join(r.root, "refused-public"), owner)).toThrow(); expect(existsSync(path.join(r.root, "refused-public"))).toBe(false);
  } finally { r.cleanup(); }
});

it.each(["missing-owner", "foreign-owner"])("refuses a %s QA reservation before legacy public effects", mode => {
  const r = owned();
  try {
    const root = path.join(r.root, "private"); mkdirSync(root); writeFileSync(path.join(root, "ownership.json"), JSON.stringify(owner) + "\n");
    for (const kind of ["finance", "native", "mfa"]) { const t = new ServiceTrace(path.join(root, `${kind}.jsonl`)); t.result("pass"); t.close(); }
    const qa = path.join(root, "qa-reliability"); prepareQaReliability(qa, owner);
    if (mode === "missing-owner") rmSync(path.join(qa, "ownership.json")); else writeFileSync(path.join(qa, "ownership.json"), JSON.stringify({ ...owner, contract: "NALANDA_QA_RELIABILITY_V1", run: "2" }) + "\n");
    const destination = path.join(r.root, "public"); expect(() => finalize(root, destination, owner)).toThrow(); expect(existsSync(destination)).toBe(false);
  } finally { r.cleanup(); }
});
