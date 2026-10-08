// Parent-side observation only. This never makes a custody policy decision.
import { spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { closeSync, existsSync, fsyncSync, lstatSync, openSync, readFileSync, renameSync, writeSync } from "node:fs";
import path from "node:path";
import { checkedDirectory } from "./service-trace";
import { projectQaSignal, type QaProcess, type QaTrace } from "./qa-reliability";

export const custodyStreamLimit = 64 * 1024;
export function atomicPrivateJson(file: string, value: unknown, limit = 16_384) {
  checkedDirectory(path.dirname(file)); const bytes = Buffer.from(JSON.stringify(value) + "\n");
  if (bytes.length > limit || existsSync(file)) throw Error("CUSTODY_PRIVATE_METADATA_BOUND_OR_REPLAY");
  const temporary = file + ".partial", fd = openSync(temporary, "wx", 0o600);
  try { let offset = 0; while (offset < bytes.length) offset += writeSync(fd, bytes, offset); fsyncSync(fd); } finally { closeSync(fd); }
  // The owned single writer uses fresh names; never replace a prior receipt.
  if (existsSync(file)) throw Error("CUSTODY_PRIVATE_METADATA_REPLAY"); renameSync(temporary, file);
}
export function safeJson(text: string, limit = 8192) {
  if (Buffer.byteLength(text) > limit) return { state: "BOUNDS" as const, value: null };
  if (!text.trim()) return { state: "MISSING" as const, value: null };
  try { const value: unknown = JSON.parse(text); if (!value || typeof value !== "object" || Array.isArray(value)) return { state: "MALFORMED" as const, value: null }; return { state: "VALID" as const, value: value as Record<string, unknown> }; }
  catch { return { state: "MALFORMED" as const, value: null }; }
}
export function safePrivateJson(file: string, limit = 8192) {
  try { const st = lstatSync(file); if (!st.isFile() || st.isSymbolicLink() || st.nlink !== 1 || st.size > limit) return { state: "BOUNDS" as const, value: null }; return safeJson(readFileSync(file, "utf8"), limit); }
  catch (error) { return { state: (error as NodeJS.ErrnoException).code === "ENOENT" ? "MISSING" as const : "MALFORMED" as const, value: null }; }
}
export function validNativeMetadata(value: Record<string, unknown> | null) {
  return !!value && Object.keys(value).sort().join() === ["executable", "version", "is64Bit", "languageMode", "effectivePolicy", "pid", "creationUtc"].sort().join()
    && typeof value.executable === "string" && /^[A-Z]:\\[^\r\n]{1,4096}$/i.test(value.executable)
    && typeof value.version === "string" && /^5\.1\.[0-9]+\.[0-9]+$/.test(value.version) && typeof value.is64Bit === "boolean"
    && ["FullLanguage", "ConstrainedLanguage", "RestrictedLanguage", "NoLanguage"].includes(value.languageMode as string)
    && ["Restricted", "AllSigned", "RemoteSigned", "Unrestricted", "Bypass", "Undefined"].includes(value.effectivePolicy as string)
    && Number.isSafeInteger(value.pid) && (value.pid as number) > 0
    && typeof value.creationUtc === "string" && /^\d{4}-\d{2}-\d{2}T[^\r\n]{1,40}$/.test(value.creationUtc) && Number.isFinite(Date.parse(value.creationUtc));
}
export function captureCustodyChild(options: { command: string; args: string[]; input?: string; env?: NodeJS.ProcessEnv; directory: string; trace: QaTrace; mode: "HARNESS_ONLY" | "REAL_HELPER_CONTROLLED_METADATA"; timeoutMs?: number }) {
  checkedDirectory(options.directory);
  const timeoutMs = options.timeoutMs ?? 10000;
  if (!["HARNESS_ONLY", "REAL_HELPER_CONTROLLED_METADATA"].includes(options.mode)) throw Error("CUSTODY_OBSERVATION_MODE_INVALID");
  if (options.mode === "REAL_HELPER_CONTROLLED_METADATA" && (timeoutMs !== 10000 || options.command !== 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe' || options.args.length !== 4 || options.args.slice(0, 3).join() !== ["-NoProfile", "-NonInteractive", "-File"].join() || options.args[3] !== path.join(options.directory, "controlled.ps1"))) throw Error("CUSTODY_ORIGINAL_LAUNCH_CHANGED");
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10000) throw Error("CUSTODY_CHILD_DEADLINE_INVALID");
  const span = options.trace.begin("custody-parent-launch"), start = performance.now();
  // Private intent is complete before invoking the synchronous child. Environment
  // contents are never recorded, and parent identity is never child identity.
  atomicPrivateJson(path.join(options.directory, "parent-launch.json"), { mode: options.mode, command: options.command, args: options.args, timeoutMs, streamLimitBytes: custodyStreamLimit, parentPid: process.pid });
  let result: ReturnType<typeof spawnSync> | undefined, thrown: unknown;
  // The supported default retains Buffer output and encodes string stdin as
  // UTF-8. The output sentinel "buffer" is not a valid string-input encoding.
  try { result = spawnSync(options.command, options.args, { input: options.input, env: options.env, timeout: timeoutMs, maxBuffer: custodyStreamLimit, stdio: ["pipe", "pipe", "pipe"], windowsHide: true }); } catch (error) { thrown = error; }
  const error = (result?.error ?? thrown) as (NodeJS.ErrnoException & { stdout?: Buffer; stderr?: Buffer; status?: number; signal?: string; pid?: number }) | undefined;
  const code = typeof error?.code === "string" ? error.code.slice(0, 80) : null;
  const exit = Number.isSafeInteger(result?.status ?? error?.status) ? (result?.status ?? error?.status)! : null;
  const category: QaProcess["errorCategory"] = code === "ETIMEDOUT" ? "TIMEOUT" : code === "ENOBUFS" ? "OUTPUT_LIMIT" : code === "ENOENT" || code === "EACCES" ? "STARTUP" : error ? "UNKNOWN" : exit !== 0 ? "NONZERO_EXIT" : "NONE";
  const stdout = Buffer.isBuffer(result?.stdout) ? result.stdout : Buffer.isBuffer(error?.stdout) ? error.stdout : Buffer.alloc(0), stderr = Buffer.isBuffer(result?.stderr) ? result.stderr : Buffer.isBuffer(error?.stderr) ? error.stderr : Buffer.alloc(0);
  const recordingErrors: string[] = [];
  for (const [name, bytes] of [["stdout.bin", stdout], ["stderr.bin", stderr]] as const) { try { const fd = openSync(path.join(options.directory, name), "wx", 0o600); try { const retained = bytes.subarray(0, custodyStreamLimit); let offset = 0; while (offset < retained.length) offset += writeSync(fd, retained, offset); } finally { closeSync(fd); } } catch { recordingErrors.push(name === "stdout.bin" ? "STDOUT_WRITE" : "STDERR_WRITE"); } }
  const actualSignal = result?.signal ?? error?.signal ?? null, childPid = result?.pid || error?.pid || null;
  const signal = projectQaSignal(actualSignal);
  // A completed direct spawn return with an exit/signal is closure evidence.
  // PID availability alone is not. No direct-child result proves tree settlement.
  const processResult: QaProcess = { exit, signal, errorCategory: category, durationMs: Math.round(performance.now() - start), closed: result && (Number.isSafeInteger(result.status) || result.signal !== null && result.signal !== undefined) ? true : null, settled: "UNKNOWN" };
  const output = safeJson(stdout.subarray(0, custodyStreamLimit).toString("utf8"));
  const metadata = safePrivateJson(path.join(options.directory, "helper-process.json"));
  const nativeMetadataValid = metadata.state === "VALID" && validNativeMetadata(metadata.value) && (childPid ? metadata.value!.pid === childPid : false);
  const receipt = { mode: options.mode, ...processResult, errorCode: code, actualSignal, childPid, directReturnObserved: !!result, stdoutObservedBytes: stdout.length, stdoutRetainedBytes: Math.min(stdout.length, custodyStreamLimit), stderrObservedBytes: stderr.length, stderrRetainedBytes: Math.min(stderr.length, custodyStreamLimit), outputState: output.state, nativeMetadataState: metadata.state, nativeMetadataValid, recordingErrors };
  try { atomicPrivateJson(path.join(options.directory, "parent-result.json"), receipt); } catch { recordingErrors.push("RESULT_WRITE"); }
  const evidenceComplete = recordingErrors.length === 0;
  options.trace.end(span, category === "NONE" && evidenceComplete ? "PASS" : "FAIL", processResult);
  return { process: processResult, receipt, evidenceComplete, stdout: stdout.subarray(0, custodyStreamLimit).toString("utf8"), stderr: stderr.subarray(0, custodyStreamLimit).toString("utf8"), output, metadata, nativeMetadataValid };
}

const stages = [["wrapper-start.json", "WRAPPER_ENTRY"], ["module-start.json", "MODULE_INITIALIZATION_STARTED"], ["module-ready.json", "MODULE_INITIALIZATION_FINISHED"], ["metadata-written.json", "PROCESS_METADATA_FINISHED"], ["helper-entry.json", "HELPER_ENTRY"], ["helper-exit.json", "HELPER_EXIT"]] as const;
export function readCustodyStages(directory: string) {
  let previous = 0;
  return stages.map(([file, stage]) => {
    const parsed = safePrivateJson(path.join(directory, file));
    let state: "VALID" | "MISSING" | "MALFORMED" | "BOUNDS" | "PARTIAL" = parsed.state;
    if (state === "MISSING" && existsSync(path.join(directory, file + ".partial"))) state = "PARTIAL";
    const v = parsed.value, keys = stage === "HELPER_EXIT" ? ["stage", "elapsedMs", "exit"] : ["stage", "elapsedMs"];
    if (state === "VALID" && (!v || Object.keys(v).sort().join() !== keys.sort().join() || v.stage !== stage || typeof v.elapsedMs !== "number" || !Number.isFinite(v.elapsedMs) || v.elapsedMs < previous || v.elapsedMs > 86_400_000 || stage === "HELPER_EXIT" && v.exit !== null && (!Number.isSafeInteger(v.exit) || Math.abs(v.exit as number) > 2 ** 32))) state = "MALFORMED";
    if (state === "VALID") previous = v!.elapsedMs as number;
    return { stage, state, elapsedMs: state === "VALID" ? v!.elapsedMs as number : null, exit: state === "VALID" && stage === "HELPER_EXIT" ? v!.exit as number | null : null };
  });
}

export function custodyStartupScript(directory: string) {
  const root = directory.replaceAll("'", "''");
  return `$ErrorActionPreference='Stop'
$a4EvidenceRoot='${root}'
 $a4Clock=[Diagnostics.Stopwatch]::StartNew()
function Write-A4Literal { param([string]$Name,[string]$Json)
 $text=$Json+[Environment]::NewLine
 $bytes=([Text.UTF8Encoding]::new($false)).GetBytes($text)
 if($bytes.Length -gt 8192){throw 'A4_METADATA_BOUND'}
 $target=[IO.Path]::Combine($a4EvidenceRoot,$Name);$partial=$target+'.partial'
 $stream=[IO.File]::Open($partial,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
 try{$stream.Write($bytes,0,$bytes.Length);$stream.Flush($true)}finally{$stream.Dispose()}
 [IO.File]::Move($partial,$target)
}
function Write-A4Stage { param([string]$Name,[string]$Stage,[Nullable[int]]$ExitCode=$null)
 $elapsed=$a4Clock.ElapsedMilliseconds.ToString([Globalization.CultureInfo]::InvariantCulture)
 $json='{"stage":"'+$Stage+'","elapsedMs":'+$elapsed
 if($Stage -eq 'HELPER_EXIT'){
  if($null -ne $ExitCode){$json+=',"exit":'+([int]$ExitCode).ToString([Globalization.CultureInfo]::InvariantCulture)}else{$json+=',"exit":null'}
 }
 Write-A4Literal $Name ($json+'}')
}
# The first marker uses .NET only, before native module initialization.
Write-A4Stage 'wrapper-start.json' 'WRAPPER_ENTRY'
Write-A4Stage 'module-start.json' 'MODULE_INITIALIZATION_STARTED'
try {
 Import-Module -Name ([IO.Path]::Combine($PSHOME,'Modules','Microsoft.PowerShell.Security','Microsoft.PowerShell.Security.psd1')) -ErrorAction Stop
 Write-A4Stage 'module-ready.json' 'MODULE_INITIALIZATION_FINISHED'
 $nativeProcess=[Diagnostics.Process]::GetCurrentProcess()
 $metadata=[ordered]@{executable=$nativeProcess.MainModule.FileName;version=$PSVersionTable.PSVersion.ToString();is64Bit=[Environment]::Is64BitProcess;languageMode=$ExecutionContext.SessionState.LanguageMode.ToString();effectivePolicy=(Microsoft.PowerShell.Security\\Get-ExecutionPolicy).ToString();pid=$PID;creationUtc=$nativeProcess.StartTime.ToUniversalTime().ToString('o')}
 Write-A4Literal 'helper-process.json' ($metadata|ConvertTo-Json -Compress)
 Write-A4Stage 'metadata-written.json' 'PROCESS_METADATA_FINISHED'
} catch {
 $failure=[ordered]@{stage='NATIVE_SECURITY_INITIALIZATION';errorId=([string]$_.FullyQualifiedErrorId).Substring(0,[Math]::Min(160,([string]$_.FullyQualifiedErrorId).Length));exceptionType=$_.Exception.GetType().FullName}
 Write-A4Literal 'initialization-failure.json' ($failure|ConvertTo-Json -Compress)
 [Console]::Error.WriteLine('CUSTODY_FIXTURE_INITIALIZATION_FAILED')
 exit 1
}
`;
}
