// Narrow projections for the existing native process/scenario evidence; no raw text escapes.
export const nativeScenarios = ["A-clean-launch", "B-invalid-pin", "C-local-vault-empty", "F-remote-reference-draft-refusal", "D-explicit-lock-and-os-background", "E-cold-restart-wrong-pin", "G-reset-cancel-confirm", "H-platform-accessibility-layout"] as const;
export const controlLabels = {
  UNLOCK: "Unlock app", WORKSPACE: "Workspace", SECURITY: "Security", LOCK: "Lock",
  RESET: "Reset app data", CANCEL: "Cancel", REMOTE: "No remote server configured",
  REFERENCE: "Download encrypted reference data", SAVE: "Save encrypted draft", ERASE: "Erase this app's local data",
} as const;
export const stateLabels = {
  LOCKED: "Welcome back", NO_REMOTE_PROFILE: "NO REMOTE SERVER CONFIGURED", VERSION: "App 0.1.0",
  WORKSPACE: "Workspace", RECENT_DRAFTS: "Recent drafts", EMPTY_QUEUE: "0 items",
  NO_REMOTE_BANNER: "No remote server is configured.", OFFLINE_BANNER: "You are offline.",
  ONLINE: "Network available", OFFLINE: "Offline", NO_REMOTE_CONTROL: "No remote server configured",
  REFERENCE_REFUSAL: "Connect once and download current reference data before creating an offline draft.",
  WRONG_PIN: "App PIN was not accepted.", RESET: "Reset app data",
} as const;
export function controlKey(label: string): string {
  return Object.entries(controlLabels).find(([, value]) => value === label)?.[0] ?? "UNKNOWN_CONTROL";
}
export function stateKey(label: string): string {
  return Object.entries(stateLabels).find(([, value]) => value === label)?.[0] ?? "UNKNOWN_STATE";
}
const bound = (value: number) => Math.max(0, Math.min(1000, Math.trunc(value)));
type UiNode = Record<string, string>;
export function androidState(tree: readonly UiNode[]) {
  const own = tree.filter(n => n.package === "com.nalandaps.erp");
  // Input text/content descriptions can contain credentials, even if they resemble a known label.
  const display = own.filter(n => n.class !== "android.widget.EditText" && n.password !== "true");
  const matches = (n: UiNode, label: string) => n.text === label || n["content-desc"] === label;
  const controls = Object.fromEntries(Object.entries(controlLabels).map(([key, label]) => {
    const rows = display.filter(n => matches(n, label));
    return [key, {count: bound(rows.length), actionable: bound(rows.filter(n => n.clickable === "true").length), enabled: bound(rows.filter(n => n.enabled === "true").length)}];
  }));
  const states = Object.fromEntries(Object.entries(stateLabels).map(([key, label]) => [key, display.some(n => n.text?.includes(label) || n["content-desc"]?.includes(label))]));
  const appUi={nodes:bound(own.length),webViews:bound(own.filter(n=>n.class==="android.webkit.WebView").length),editableFields:bound(own.filter(n=>n.class==="android.widget.EditText").length),focusedEditableFields:bound(own.filter(n=>n.class==="android.widget.EditText"&&n.focused==="true").length)};
  return {controls, states, appUi, passwordFields: bound(own.filter(n => n.class === "android.widget.EditText" && n.password === "true").length), focusedPasswordFields: bound(own.filter(n => n.class === "android.widget.EditText" && n.password === "true" && n.focused === "true").length), network: states.ONLINE && !states.OFFLINE ? "ONLINE" : states.OFFLINE && !states.ONLINE ? "OFFLINE" : "UNKNOWN"};
}

const processCauses = new Set(["CHILD_STARTUP_FAILED", "CHILD_GROUP_UNRECONCILED", "CHILD_TIMEOUT", "CHILD_CANCELLED", "CHILD_OUTPUT_LIMIT", "CHILD_EXIT_FAILED", "PRIVATE_RETENTION_FAILED"]);
const assertionCauses = new Set(["ANDROID_ACCESSIBILITY_TREE_INVALID", "ANDROID_UI_ACQUISITION_EXHAUSTED", "ANDROID_CONTROL_BOUNDS_INVALID", "ANDROID_CONTROL_NOT_VISIBLE", "ANDROID_CONTROL_NOT_UNIQUE", "ANDROID_CONTROL_DISABLED", "ANDROID_APP_WEBVIEW_MISSING", "ANDROID_INPUT_NOT_UNIQUE", "ANDROID_TEST_INPUT_INVALID", "ANDROID_ACTIVITY_LAUNCH_REFUSED", "ANDROID_LOCKED_CONTENT_LEAK", "ANDROID_EXPECTED_ACCESSIBILITY_STATE_NOT_READY", "ANDROID_SOFTWARE_KEYBOARD_NOT_SHOWN", "ANDROID_ORIGINAL_SETTING_INVALID", "ANDROID_SETTING_RESTORE_FAILED"]);
export function androidCause(error: unknown): string {
  const message = error instanceof Error ? error.message.split(/\r?\n/,1)[0] : "";
  const setupCauses=new Set(["ANDROID_EXACT_EMULATOR_NOT_READY","ANDROID_EMULATOR_OWNERSHIP_REFUSED","ANDROID_BOOT_NOT_COMPLETED","ANDROID_RUNTIME_API_OR_ABI_REFUSED","ANDROID_PACKAGE_RUNTIME_MISMATCH","ANDROID_PACKAGE_MANAGER_NOT_RESPONSIVE","ANDROID_EXISTING_APP_SANDBOX_REFUSED","ANDROID_INSTALL_ATTEMPT_LIMIT","ANDROID_INSTALL_FAILED","ANDROID_PACKAGE_ID_VERSION_OR_DEBUG_PROFILE_REFUSED"]);
  if (assertionCauses.has(message) || processCauses.has(message) || setupCauses.has(message)) return message;
  if (message === "QA_PROCESS_RETENTION_FAILED" || message === "NATIVE_PRIVATE_PROCESS_RETENTION_FAILED") return "PRIVATE_RETENTION_FAILED";
  if (message === "QA_PROCESS_UNAVAILABLE") return "CHILD_STARTUP_FAILED";
  if (message === "QA_PROCESS_CANCELLED") return "CHILD_CANCELLED";
  if (message === "QA_PROCESS_GROUP_UNRECONCILED") return "CHILD_GROUP_UNRECONCILED";
  if (message === "QA_PROCESS_FAILED_OR_CANCELLED") return "CHILD_EXECUTION_FAILED";
  return "ASSERTION_OR_OPERATION_UNKNOWN";
}
// Finite NodeJS.Signals catalog; an unrecognized signal never becomes free-form public text.
const signals = new Set(["SIGABRT","SIGALRM","SIGBUS","SIGCHLD","SIGCONT","SIGFPE","SIGHUP","SIGILL","SIGINT","SIGIO","SIGIOT","SIGKILL","SIGPIPE","SIGPOLL","SIGPROF","SIGPWR","SIGQUIT","SIGSEGV","SIGSTKFLT","SIGSTOP","SIGSYS","SIGTERM","SIGTRAP","SIGTSTP","SIGTTIN","SIGTTOU","SIGUNUSED","SIGURG","SIGUSR1","SIGUSR2","SIGVTALRM","SIGWINCH","SIGXCPU","SIGXFSZ","SIGBREAK","SIGLOST","SIGINFO"]);
export function processMetadata(r: {exit: number|null; signal: string|null; durationMs: number; timedOut: boolean; cancelled: boolean; startupFailed: boolean; outputLimit: boolean; terminationFailed: boolean; closed: boolean}) {
  const integer = (n: number, max: number) => Number.isSafeInteger(n) && n >= 0 && n <= max ? n : null;
  return {exit: r.exit === null ? null : integer(r.exit, 4294967295), signal: r.signal === null ? null : signals.has(r.signal) ? r.signal : "UNKNOWN", durationMs: integer(r.durationMs, 1_000_000_000), timedOut: r.timedOut === true, cancelled: r.cancelled === true, startupFailed: r.startupFailed === true, outputLimit: r.outputLimit === true, terminationFailed: r.terminationFailed === true, closed: r.closed === true};
}
export function childCause(r: Parameters<typeof processMetadata>[0]) {
  return r.startupFailed ? "CHILD_STARTUP_FAILED" : r.terminationFailed ? "CHILD_GROUP_UNRECONCILED" : r.timedOut ? "CHILD_TIMEOUT" : r.cancelled ? "CHILD_CANCELLED" : r.outputLimit ? "CHILD_OUTPUT_LIMIT" : r.exit !== 0 ? "CHILD_EXIT_FAILED" : null;
}
export const androidInstallCodes=["INSTALL_FAILED_INSUFFICIENT_STORAGE","INSTALL_FAILED_NO_MATCHING_ABIS","INSTALL_FAILED_OLDER_SDK","INSTALL_FAILED_TEST_ONLY","INSTALL_FAILED_INVALID_APK","INSTALL_FAILED_USER_RESTRICTED"] as const;
export function androidInstallProjection(stdout:Buffer,stderr:Buffer) {
  const modes=new Set<string>(),failures=new Set<typeof androidInstallCodes[number]>();let reportedSuccess=false;
  for(const stream of [stdout,stderr])for(const line of stream.toString("utf8").split(/\r?\n/)) {
    const mode=/^Performing (Streamed|Incremental|Push) Install$/.exec(line);
    if(mode)modes.add(mode[1].toUpperCase());
    if(line==="Success")reportedSuccess=true;
    for(const code of androidInstallCodes)if(new RegExp(`\\b${code}\\b`).test(line))failures.add(code);
  }
  // Only fixed operational markers escape. They do not prove package admission,
  // command success, upload completion, launch, or the cause of a later timeout.
  return {mode:modes.size===1?[...modes][0]:modes.size>1?"AMBIGUOUS":"UNKNOWN",reportedSuccess,knownFailureCodes:androidInstallCodes.filter(code=>failures.has(code))};
}

export const swiftSource = "apps/nalanda-cross-platform/tests/native/NativeJourney.swift";
export const appleProjectSource = "apps/nalanda-cross-platform/tests/native/NativeJourney.xcodeproj/project.pbxproj";
const appleInputCatalog = {
 SWIFT_SOURCE:{source:swiftSource,target:"NativeJourney",kind:"REPOSITORY_SOURCE",name:"NativeJourney.swift"},
 COMPILED_APP_EXECUTABLE:{source:appleProjectSource,target:"CompiledNalanda",kind:"OWNED_DERIVED_PRODUCT",name:"Nalanda School.app/Nalanda School"},
 COMPILED_APP_PLIST:{source:appleProjectSource,target:"CompiledNalanda",kind:"OWNED_DERIVED_PRODUCT",name:"Nalanda School.app/Info.plist"},
} as const;
export type AppleInputBinding = {absolutePath:string;identity:keyof typeof appleInputCatalog};
export type PublicSource = {absolutePath: string; relativePath: typeof swiftSource; lineCount: number; inputs?:readonly AppleInputBinding[]};
function appleMissingInput(message:string,source:PublicSource) {
 // Extract only this diagnostic's path, then require an exact source-validated input binding.
 // Unknown filenames, arbitrary target names and the rest of the compiler message never escape.
 const at=/^Build input file cannot be found: '([^'\r\n]+)'(?:\..*)?$/.exec(message);
 if(!at)return null;
 const matches=source.inputs?.filter(binding=>binding.absolutePath===at[1]&&Object.hasOwn(appleInputCatalog,binding.identity))??[];
 if(matches.length!==1)return null;
 const known=appleInputCatalog[matches[0].identity];
 const target=/\(in target '([^'\r\n]+)' from project '([^'\r\n]+)'\)$/.exec(message);
 if(!target||target[1]!==known.target||target[2]!=="NativeJourney")return null;
 return {identity:matches[0].identity,...known};
}
const copySteps = ["SOURCE", "DESTINATION", "DIRECTORY", "COPY"] as const;
type BuildStage = "UNKNOWN"|"SWIFT_COMPILE"|"SWIFT_MODULE"|"LINK"|"COPY_SCRIPT"|"PLIST"|"TARGET_VALIDATION"|"SIGNING"|"DESTINATION_OR_CONFIGURATION";
function buildStage(line: string, current: BuildStage): BuildStage {
  if (/^SwiftCompile\s/.test(line)) return "SWIFT_COMPILE";
  if (/^SwiftEmitModule\s/.test(line)) return "SWIFT_MODULE";
  if (/^Ld\s/.test(line)) return "LINK";
  if (/^PhaseScriptExecution\s/.test(line)) return "COPY_SCRIPT";
  if (/^ProcessInfoPlistFile\s/.test(line)) return "PLIST";
  if (/^Validate\s/.test(line)) return "TARGET_VALIDATION";
  if (/^CodeSign\s/.test(line)) return "SIGNING";
  if (/^xcodebuild: error:/.test(line)) return "DESTINATION_OR_CONFIGURATION";
  return current;
}
// These patterns classify reviewed diagnostic grammar. They NEVER substitute/scrub message text.
function compilerCategory(message: string): string {
  const knownSwift = {XCTContext:"XCTCONTEXT",XCTestCase:"XCTESTCASE",XCUIApplication:"XCUIAPPLICATION",XCUIElement:"XCUIELEMENT",XCUIDevice:"XCUIDEVICE",NSPredicate:"NSPREDICATE",StaticString:"STATICSTRING",UInt:"UINT",String:"STRING",Int:"INT"} as const;
  if (message === "no such module 'XCTest'") return "SWIFT_XCTEST_MODULE_UNAVAILABLE";
  for(const [symbol,code] of Object.entries(knownSwift))if(message===`cannot find '${symbol}' in scope` || message===`cannot find type '${symbol}' in scope`)return `SWIFT_${code}_SYMBOL_UNAVAILABLE`;
  if (/^no such module '[^'\r\n]+'$/.test(message)) return "SWIFT_MODULE_UNAVAILABLE";
  if (/^cannot find (?:type )?'[^'\r\n]+' in scope$/.test(message)) return "SWIFT_SYMBOL_UNAVAILABLE";
  if (/^(?:value of )?type '[^'\r\n]+' has no member '[^'\r\n]+'$/.test(message)) return "SWIFT_MEMBER_UNAVAILABLE";
  if (/^cannot convert value of type '[^'\r\n]+' to expected argument type '[^'\r\n]+'$/.test(message)) return "SWIFT_ARGUMENT_TYPE_MISMATCH";
  if (/^missing argument for parameter '[^'\r\n]+' in call$/.test(message)) return "SWIFT_ARGUMENT_MISSING";
  if (/^extra argument '[^'\r\n]+' in call$/.test(message)) return "SWIFT_ARGUMENT_EXTRA";
  if (/^ambiguous use of '[^'\r\n]+'$/.test(message)) return "SWIFT_OVERLOAD_AMBIGUOUS";
  if (message === "Command PhaseScriptExecution failed with a nonzero exit code") return "COPY_SCRIPT_NONZERO";
  if (/^Undefined symbols for architecture (?:arm64|x86_64):$/.test(message)) return "LINK_UNDEFINED_SYMBOLS";
  if (/^linker command failed with exit code [0-9]+ \(use -v to see invocation\)$/.test(message)) return "LINK_COMMAND_FAILED";
  if (/^Build input file cannot be found: /.test(message)) return "BUILD_INPUT_UNAVAILABLE";
  if (/^Multiple commands produce /.test(message)) return "DUPLICATE_BUILD_OUTPUT";
  if (/^Unable to find a destination matching the provided destination specifier:/.test(message)) return "DESTINATION_UNAVAILABLE";
  if (/^Cannot process Info\.plist at path .+ since this file does not exist$/.test(message)) return "PLIST_INPUT_UNAVAILABLE";
  if (message === "Cannot code sign because the target does not have an Info.plist file and one is not being generated automatically.") return "SIGNING_PLIST_UNAVAILABLE";
  return "UNKNOWN";
}
export function appleCause(error: unknown) {
  const message=error instanceof Error?error.message.split(/\r?\n/,1)[0]:"";
  const known=new Set(["IOS_NUMERIC_VERSION_UNAVAILABLE","IOS_INVENTORY_SCHEMA_REFUSED","IOS_OWNED_STATE_UNVERIFIED","IOS_CREATED_TARGET_STATE_REFUSED","IOS_OWNED_BOOT_STATE_REFUSED","IOS_APPEARANCE_READ_UNAVAILABLE","IOS_APPEARANCE_READBACK_MISMATCH","IOS_PUBLIC_INPUT_SOURCE_BINDING_REFUSED","IOS_TEST_TARGET_PACKAGE_SUBSTITUTED","IOS_REQUIRED_SCENARIO_EVIDENCE_MISSING","IOS_FINAL_CAPTURE_READINESS_TIMEOUT","IOS_OWNED_TARGET_ID_INVALID","IOS_SIMULATOR_PACKAGE_METADATA_REFUSED","IOS_SIMULATOR_ARCHITECTURE_REFUSED","IOS_SUPPORTED_RUNTIME_OR_DEVICE_TYPE_UNAVAILABLE","NATIVE_PRIVATE_OUTPUT_WRITE_FAILED","NATIVE_PRIVATE_PROCESS_RETENTION_FAILED","QA_PROCESS_RETENTION_FAILED","NATIVE_PACKAGE_HASH_MISMATCH"]);
  if(known.has(message))return message;
  if(/^IOS_XCODE_STAGE_FAILED:(?:ios-build-ui-runner|ios-real-ui-journey|ios-dark-locked-layout)$/.test(message))return "IOS_XCODE_STAGE_FAILED";
  if(/^NATIVE_OPERATION_FAILED:IOS_(?:SDK_VERSION|CREATE_OWNED_TARGET|CREATED_READBACK|BOOT|BOOT_READINESS|TARGET_READBACK|THEME(?:_READ|_READBACK)?|DARK_THEME(?:_READ|_READBACK)?|FINAL_LOCKED_LAUNCH|FINAL_CAPTURE)$/.test(message))return "IOS_CHILD_OPERATION_FAILED";
  return "IOS_LOCAL_OPERATION_UNKNOWN";
}
export function appleStream(stream: Buffer, source: PublicSource) {
  let stage: BuildStage = "UNKNOWN";
  let first: {stage: BuildStage; category: string; location: {path: typeof swiftSource; line: number; column: number|null}|null;errorCode?:"XCODE_BUILD_INPUT_FILE_NOT_FOUND";input?:ReturnType<typeof appleMissingInput>}|null = null;
  const copy: {step: typeof copySteps[number]; status: "BEGIN"|"PASS"|"FAIL"}[] = [];
  for (const raw of stream.toString("utf8").split(/\r?\n/)) {
    stage = buildStage(raw, stage);
    const marker = /^NALANDA_NATIVE_COPY:(BEGIN|PASS|FAIL):(SOURCE|DESTINATION|DIRECTORY|COPY)$/.exec(raw);
    if (marker) {
      if (copy.length < 12) copy.push({step: marker[2] as typeof copySteps[number], status: marker[1] as "BEGIN"|"PASS"|"FAIL"});
      if (marker[1] === "FAIL" && !first) first = {stage: "COPY_SCRIPT", category: `COPY_${marker[2]}_FAILED`, location: null};
      continue;
    }
    const at = /^(.+?):([0-9]+):(?:([0-9]+):)?\s*(?:fatal )?error:\s*(.*)$/.exec(raw);
    const generic = /^(?:xcodebuild: |ld: |clang: |<unknown>:0: )?(?:fatal )?error:\s*(.*)$/.exec(raw);
    const link = /^Undefined symbols for architecture (?:arm64|x86_64):$/.test(raw);
    const script = raw === "Command PhaseScriptExecution failed with a nonzero exit code";
    if (!first && (at || generic || link || script)) {
      let location: {path: typeof swiftSource; line: number; column: number|null}|null = null;
      if (at && source.relativePath === swiftSource && at[1] === source.absolutePath && Number.isSafeInteger(source.lineCount) && source.lineCount > 0 && Number(at[2]) >= 1 && Number(at[2]) <= source.lineCount) {
        const column = at[3] && Number.isSafeInteger(Number(at[3])) && Number(at[3]) >= 1 && Number(at[3]) <= 10000 ? Number(at[3]) : null;
        location = {path: swiftSource, line: Number(at[2]), column};
      }
      const message=at?.[4]??generic?.[1]??raw,category=compilerCategory(message);
      first = {stage, category, location,...(category==="BUILD_INPUT_UNAVAILABLE"?{errorCode:"XCODE_BUILD_INPUT_FILE_NOT_FOUND" as const,input:appleMissingInput(message,source)}:{})};
    }
  }
  return {firstDiagnostic: first, copy};
}
export function appleBuild(stdout: Buffer, stderr: Buffer, source: PublicSource) {
  const out = appleStream(stdout, source), err = appleStream(stderr, source);
  return {ordering: out.firstDiagnostic && err.firstDiagnostic ? "PER_STREAM_ONLY" : "SINGLE_STREAM_OR_NONE", stdout: out, stderr: err};
}

// Constant markers can preserve partial execution, but never replace the XCTest process verdict.
export function appleScenarioMarkers(stdout: Buffer, stderr: Buffer, processPassed: boolean) {
  const parse = (stream: Buffer) => stream.toString("utf8").split(/\r?\n/).filter(line => /^NALANDA_NATIVE_SCENARIO:/.test(line));
  const out = parse(stdout), err = parse(stderr);
  if (out.length && err.length) return {status: "UNAVAILABLE_CROSS_STREAM_ORDER", scenarios: []};
  const lines = out.length ? out : err;
  if (lines.length > nativeScenarios.length * 2) return {status: "INVALID_PROTOCOL", scenarios: []};
  const rows: {scenario: typeof nativeScenarios[number]; assertion: "PASS"|"NOT_COMPLETED"}[] = [];
  let next = 0, active = false;
  for (const line of lines) {
    const id = nativeScenarios[next];
    if (!id) return {status: "INVALID_PROTOCOL", scenarios: []};
    if (!active && line === `NALANDA_NATIVE_SCENARIO:BEGIN:${id}`) active = true;
    else if (active && line === `NALANDA_NATIVE_SCENARIO:PASS:${id}`) {rows.push({scenario: id, assertion: "PASS"}); active = false; next++;}
    else return {status: "INVALID_PROTOCOL", scenarios: []};
  }
  if (active) rows.push({scenario: nativeScenarios[next], assertion: "NOT_COMPLETED"});
  if (processPassed && (active || next !== nativeScenarios.length)) return {status: "MISSING_REQUIRED_MARKERS", scenarios: rows};
  return {status: lines.length ? "OBSERVED" : "UNAVAILABLE", scenarios: rows};
}
export function nativeIdentity(input: {source: string; tree: string; packageHash: string; run: string|undefined; attempt: string|undefined}) {
  const sha = (v: string, n: number) => new RegExp(`^[a-f0-9]{${n}}$`).test(v) ? v : null;
  const number = (v: string|undefined) => v && /^[1-9][0-9]{0,15}$/.test(v) && Number.isSafeInteger(Number(v)) ? Number(v) : null;
  return {source: sha(input.source, 40), tree: sha(input.tree, 40), packageHash: sha(input.packageHash, 64), run: number(input.run), attempt: number(input.attempt)};
}
export function nativeVersions(toolVersion: string, xcodeVersion = "", runtimeVersion = "") {
  const numeric = (value: string|undefined) => value && /^[0-9]{1,4}(?:\.[0-9]{1,4}){0,3}$/.test(value) ? value : null;
  return {adb: numeric(/^Android Debug Bridge version ([0-9.]+)$/m.exec(toolVersion)?.[1]), xcode: numeric(/^Xcode ([0-9.]+)$/m.exec(xcodeVersion)?.[1]), iosRuntime: numeric(runtimeVersion), application: "0.1.0"};
}
