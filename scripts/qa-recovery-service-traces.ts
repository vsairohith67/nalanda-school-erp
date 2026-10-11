// Exact-file, metadata-only CI handoff. Never uploads the recorder's private
// directory, console reports, raw Prisma rows or a database.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync, lstatSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readTrace, checkedDirectory } from "../tests/helpers/service-trace";
import { opensslTraceRoot, opensslPublicRoot, validateOpenSslMetadata } from "../tests/helpers/openssl-fixture";
import { classification, custodyCases, reportingCases, qaCases, qaPhases, readQaJournal, validateQaOwner, type QaOwner, type QaFamily, type QaCase } from "../tests/helpers/qa-reliability";
import { readCustodyStages } from "../tests/helpers/custody-execution";

export const privateRoot = path.resolve("tmp/ci-service-traces");
export const publicRoot = path.resolve("tmp/ci-service-trace-public");
export const outputFiles = ["finance.json", "native.json", "mfa.json", "manifest.json"] as const;
export const qaPrivateRoot = path.join(privateRoot, "qa-reliability");
export const qaPublicRoot = path.resolve("tmp/ci-qa-reliability-public");
export const qaOutputFiles = ["qa-reliability.json", "manifest.json"] as const;
function check(value: unknown, valid: boolean) { if (!valid) throw Error("SERVICE_TRACE_HANDOFF_INVALID"); return value; }
export function ownerFromEnvironment() {
  const source = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  check(source, /^[a-f0-9]{40}$/.test(source) && source === process.env.EXPECTED_SHA);
  for (const key of ["GITHUB_RUN_ID", "GITHUB_RUN_ATTEMPT"]) check(process.env[key], /^[1-9][0-9]{0,19}$/.test(process.env[key] ?? ""));
  const job = process.env.GITHUB_JOB ?? ""; check(job, /^[a-zA-Z0-9_-]{1,100}$/.test(job));
  const provider = process.env.DATABASE_PROVIDER ?? "sqlite"; check(provider, ["sqlite", "postgresql"].includes(provider));
  const image = process.env.ImageVersion ?? "unavailable"; check(image, /^[a-zA-Z0-9._-]{1,80}$/.test(image));
  const runner = process.env.RUNNER_OS ?? "unavailable"; check(runner, ["Windows", "Linux", "macOS", "unavailable"].includes(runner));
  return { contract: "NALANDA_SERVICE_TRACE_V1", source, run: process.env.GITHUB_RUN_ID!, attempt: process.env.GITHUB_RUN_ATTEMPT!, job, provider, node: process.version, image, runner };
}
export function prepare() {
  const owner = ownerFromEnvironment();
  checkedDirectory(path.dirname(privateRoot));
  // mkdir without recursive means an existing/foreign root is a refusal.
  mkdirSync(privateRoot, { mode: 0o700 });
  writeFileSync(path.join(privateRoot, "ownership.json"), JSON.stringify(owner) + "\n", { flag: "wx", mode: 0o600 });
}
export function finalize(root = privateRoot, destination = publicRoot, expected = ownerFromEnvironment()) {
  checkedDirectory(root); checkedDirectory(path.dirname(destination));
  const directory = lstatSync(root); check(null, directory.isDirectory() && !directory.isSymbolicLink());
  const names = readdirSync(root).sort();
  const hasQa = names.includes("qa-reliability");
  check(null, names.join() === ["finance.jsonl", "native.jsonl", "mfa.jsonl", "ownership.json", ...(hasQa ? ["qa-reliability"] : [])].sort().join());
  const ownerFile = path.join(root, "ownership.json"), st = lstatSync(ownerFile);
  check(null, st.isFile() && !st.isSymbolicLink() && st.nlink === 1 && st.size <= 2048);
  const raw = readFileSync(ownerFile, "utf8"); check(null, raw === JSON.stringify(expected) + "\n");
  // QA has its own owner/schema/finalizer. Recognize only its known directory;
  // unrelated failed QA evidence must not block legacy service publication.
  if (hasQa) { const qa = path.join(root, "qa-reliability"); checkedDirectory(qa); check(null, boundedPrivate(path.join(qa, "ownership.json"), 2048) === JSON.stringify(qaOwner(expected)) + "\n"); }
  const projections = ["finance", "native", "mfa"].map(kind => {
    const events = readTrace(path.join(root, `${kind}.jsonl`));
    const active = new Map<number, string>();
    for (const event of events) { if (event.kind === "START") active.set(event.span, event.phase); if (event.kind === "END" || event.kind === "ERROR") active.delete(event.span); }
    check(null, events.some(e => e.kind === "RESULT"));
    // Missing ENDs remain explicit, including child/test timeout evidence. They
    // are never converted into success because cleanup happened later.
    return { file: `${kind}.json`, bytes: JSON.stringify({ contract: "NALANDA_SERVICE_TRACE_V1", evidence: "ISOLATED_SERVICE_OR_CONTRACT", owner: expected, events, unfinished: [...active].map(([span, phase]) => ({ span, phase })) }) + "\n" };
  });
  // Validate ALL projections before making any public directory/file.
  mkdirSync(destination, { mode: 0o700 });
  const files = projections.map(({ file, bytes }) => { writeFileSync(path.join(destination, file), bytes, { flag: "wx", mode: 0o600 }); return { file, size: Buffer.byteLength(bytes), sha256: createHash("sha256").update(bytes).digest("hex") }; });
  writeFileSync(path.join(destination, "manifest.json"), JSON.stringify({ contract: "NALANDA_SERVICE_TRACE_MANIFEST_V1", owner: expected, files }) + "\n", { flag: "wx", mode: 0o600 });
  return files;
}
function qaOwner(expected: ReturnType<typeof ownerFromEnvironment>): QaOwner { check(null, expected.contract === "NALANDA_SERVICE_TRACE_V1"); const owner = { ...expected, contract: "NALANDA_QA_RELIABILITY_V1" as const }; validateQaOwner(owner); return owner; }
function boundedPrivate(file: string, limit: number) {
  const st = lstatSync(file); check(null, st.isFile() && !st.isSymbolicLink() && st.nlink === 1 && st.size <= limit);
  return readFileSync(file, "utf8");
}
function checkPrivateBound(file: string, limit: number) { const st = lstatSync(file); check(null, st.isFile() && !st.isSymbolicLink() && st.nlink === 1 && st.size <= limit); }
const custodyPrivateNames = ["controlled.ps1", "parent-launch.json", "parent-result.json", "stdout.bin", "stderr.bin", "helper-execution.json", "helper-process.json", "initialization-failure.json", "wrapper-start.json", "module-start.json", "module-ready.json", "metadata-written.json", "helper-entry.json", "helper-exit.json", "child-control.cjs"];
function allowedPrivateName(name: string) {
  if (name === "phases.jsonl") return true;
  if (custodyPrivateNames.includes(name) || custodyPrivateNames.some(n => n.endsWith(".json") && name === n + ".partial")) return true;
  return qaPhases.some(phase => new RegExp(`^process-${phase}-[012]-[0-9]{1,2}\\.(stdout\\.bin|stderr\\.bin|json|json\\.partial)$`).test(name));
}
export function inspectQaRoot(root: string, expected: QaOwner) {
  validateQaOwner(expected); checkedDirectory(root);
  check(null, boundedPrivate(path.join(root, "ownership.json"), 2048) === JSON.stringify(expected) + "\n");
  const observed = new Set<string>(); const cases = [];
  for (const name of readdirSync(root).sort()) {
    if (name === "ownership.json") continue;
    let selected: { family: QaFamily; caseId: QaCase } | undefined;
    for (const family of ["operations", "custody", "reporting"] as const) for (const caseId of qaCases) {
      if (name === `${family}-${caseId}`) { classification(family, caseId); selected = { family, caseId }; }
    }
    check(null, !!selected); const directory = path.join(root, name); checkedDirectory(directory);
    const names = readdirSync(directory); check(null, names.length <= 128);
    for (const file of names) { check(null, allowedPrivateName(file)); checkPrivateBound(path.join(directory, file), file === "phases.jsonl" || /^process-compose-config-.*\.stdout\.bin$/.test(file) ? 1_048_576 : 131_072); }
    const journal = readQaJournal(path.join(directory, "phases.jsonl"));
    const childStages = selected!.family === "custody" ? readCustodyStages(directory) : [];
    // An existing case with a lost journal may still contain real child effects.
    // Missing recording is UNKNOWN, never affirmative proof of no execution.
    cases.push({ ...selected!, classification: classification(selected!.family, selected!.caseId), execution: journal.state === "VALID" ? "OBSERVATIONS_ONLY" as const : "OBSERVATIONS_INCOMPLETE" as const, ...journal, childStages }); observed.add(name);
  }
  // Absence is evidence missing, not a fabricated test execution or policy refusal.
  for (const [family, ids] of [["operations", ["local-single-node", "generic-vps"]], ["custody", custodyCases], ["reporting", reportingCases]] as const) {
    for (const caseId of ids) if (!observed.has(`${family}-${caseId}`)) cases.push({ family, caseId, classification: classification(family, caseId), execution: "NOT_EXECUTED" as const, state: "MISSING" as const, events: [], unfinished: [], declaredResult: "UNKNOWN" as const, result: "UNKNOWN" as const, processSettlement: "UNKNOWN" as const, childStages: [] });
  }
  return cases;
}
export function prepareQaReliability(root = qaPrivateRoot, expected = ownerFromEnvironment()) {
  const owner = qaOwner(expected); // Validate before creating even a private parent.
  const parent = path.dirname(root); check(null, path.basename(root) === "qa-reliability"); checkedDirectory(path.dirname(parent));
  if (!existsSync(parent)) { mkdirSync(parent, { mode: 0o700 }); writeFileSync(path.join(parent, "ownership.json"), JSON.stringify(expected) + "\n", { flag: "wx", mode: 0o600 }); }
  checkedDirectory(parent); check(null, boundedPrivate(path.join(parent, "ownership.json"), 2048) === JSON.stringify(expected) + "\n");
  mkdirSync(root, { mode: 0o700 }); writeFileSync(path.join(root, "ownership.json"), JSON.stringify(owner) + "\n", { flag: "wx", mode: 0o600 });
  return owner;
}
export function finalizeQaReliability(root = qaPrivateRoot, destination = qaPublicRoot, expected = ownerFromEnvironment()) {
  const owner = qaOwner(expected); checkedDirectory(path.dirname(destination)); const cases = inspectQaRoot(root, owner);
  const bytes = JSON.stringify({ contract: "NALANDA_QA_RELIABILITY_PUBLIC_V1", owner, evidence: "FINITE_QA_OBSERVATIONS_NOT_ADMISSION", cases }) + "\n";
  check(null, Buffer.byteLength(bytes) <= 2_000_000);
  // Validate every case/owner/bound before any public effect. FAIL, missing RESULT
  // and incomplete spans remain publishable finite evidence, never inferred PASS.
  mkdirSync(destination, { mode: 0o700 }); writeFileSync(path.join(destination, "qa-reliability.json"), bytes, { flag: "wx", mode: 0o600 });
  const files = [{ file: "qa-reliability.json", size: Buffer.byteLength(bytes), sha256: createHash("sha256").update(bytes).digest("hex") }];
  writeFileSync(path.join(destination, "manifest.json"), JSON.stringify({ contract: "NALANDA_QA_RELIABILITY_MANIFEST_V1", owner, files }) + "\n", { flag: "wx", mode: 0o600 }); return files;
}
export function prepareOpenSsl() {
  const owner = ownerFromEnvironment(); checkedDirectory(path.dirname(opensslTraceRoot));
  mkdirSync(opensslTraceRoot, { mode: 0o700 });
  writeFileSync(path.join(opensslTraceRoot, "ownership.json"), JSON.stringify(owner) + "\n", { flag: "wx", mode: 0o600 });
}
export function finalizeOpenSsl(root=opensslTraceRoot,destination=opensslPublicRoot,expected=ownerFromEnvironment()) {
  checkedDirectory(root);checkedDirectory(path.dirname(destination));
  check(null,readdirSync(root).sort().join()===["openssl.json","ownership.json"].sort().join());
  const read=(name:string,limit:number)=>{const f=path.join(root,name),s=lstatSync(f);check(null,s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.size<=limit);return readFileSync(f,"utf8");};
  check(null,read("ownership.json",2048)===JSON.stringify(expected)+"\n");
  const raw=read("openssl.json",16000),v=validateOpenSslMetadata(JSON.parse(raw));
  check(null,raw===JSON.stringify(v)+"\n"&&JSON.stringify(v.owner)===JSON.stringify(expected));
  // Both schema and source/run ownership are checked BEFORE publication.
  mkdirSync(destination,{mode:0o700});writeFileSync(path.join(destination,"openssl.json"),raw,{flag:"wx",mode:0o600});
  const files=[{file:"openssl.json",size:Buffer.byteLength(raw),sha256:createHash("sha256").update(raw).digest("hex")}];
  writeFileSync(path.join(destination,"manifest.json"),JSON.stringify({contract:"NALANDA_OPENSSL_METADATA_MANIFEST_V1",owner:expected,files})+"\n",{flag:"wx",mode:0o600});return files;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { if (process.argv.length !== 3) throw Error("SERVICE_TRACE_COMMAND_INVALID"); if (process.argv[2] === "prepare") prepare(); else if (process.argv[2] === "finalize") finalize(); else if (process.argv[2] === "openssl-prepare") prepareOpenSsl(); else if (process.argv[2] === "openssl-finalize") finalizeOpenSsl(); else if (process.argv[2] === "qa-prepare") prepareQaReliability(); else if (process.argv[2] === "qa-finalize") finalizeQaReliability(); else throw Error("SERVICE_TRACE_COMMAND_INVALID"); }
  catch { process.stderr.write("SERVICE_TRACE_HANDOFF_FAILED\n"); process.exitCode = 1; }
}
