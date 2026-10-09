import assert from "node:assert/strict";
import { createHash, randomInt } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { producerProcess, type ProducerProcessObservation } from "../../../../scripts/portable/producer-process";
import { Android, appId, journey } from "./android";
import { appleBuild, appleScenarioMarkers, appleCause, childCause, processMetadata, androidCause, nativeIdentity, nativeVersions, swiftSource, appleProjectSource, type PublicSource, type AppleInputBinding } from "./diagnostics";
import { assertProtectedNativeCapture, assertNonblankNativeCapture } from "../../../../scripts/qa-ux-native-screen-content";

const scenarios = ["A-clean-launch", "B-invalid-pin", "C-local-vault-empty", "D-explicit-lock-and-os-background", "E-cold-restart-wrong-pin", "F-remote-reference-draft-refusal", "G-reset-cancel-confirm", "H-platform-accessibility-layout"];
const hash = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex");
export function packageDigest(root: string): string {
  if(lstatSync(root).isFile()) return hash(root);
  const h=createHash("sha256");
  const walk=(dir:string)=>{for(const name of readdirSync(dir).sort()){const p=path.join(dir,name);assert(!lstatSync(p).isSymbolicLink(),"NATIVE_PACKAGE_SYMLINK_REFUSED");if(lstatSync(p).isDirectory())walk(p);else {h.update(path.relative(root,p).split(path.sep).join("/"));h.update("\0");h.update(hash(p));h.update("\n");}}};
  walk(root);return h.digest("hex");
}
export function options(args: string[]) {
  const o: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 2) {
    assert(["--mode", "--platform", "--package", "--sha256", "--serial", "--tool", "--metadata-tool", "--output", "--target-kind"].includes(args[i]) && args[i + 1] && !o[args[i]], "NATIVE_ARGUMENTS_INVALID"); o[args[i]] = args[i + 1];
  }
  assert(["list", "execute"].includes(o["--mode"]) && ["ANDROID", "IOS", "WINDOWS"].includes(o["--platform"]), "NATIVE_MODE_OR_PLATFORM_INVALID");
  return o;
}
function inside(child: string, root: string) { const r = path.relative(root, child); return r !== "" && !r.startsWith("..") && !path.isAbsolute(r); }
function file(value: string) { assert(value && path.isAbsolute(value) && !lstatSync(value).isSymbolicLink() && lstatSync(value).isFile(), "NATIVE_TOOL_OR_PACKAGE_INVALID"); return realpathSync(value); }

const processStages = new Set(["tool-version","package-metadata","android-install","android-uninstall","android-ui-command","ios-package-metadata","ios-architecture","xcode-version","ios-sdk-version","ios-inventory","ios-create-owned-target","ios-created-readback","ios-boot","ios-boot-readiness","ios-target-readback","ios-theme-read","ios-theme","ios-theme-readback","ios-build-ui-runner","ios-real-ui-journey","ios-dark-theme-read","ios-dark-theme","ios-dark-theme-readback","ios-dark-locked-layout","ios-final-locked-launch","ios-final-capture","ios-cleanup-ownership-readback","ios-owned-shutdown","ios-shutdown-readback","ios-owned-delete","ios-cleanup-readback"]);
export function androidSetupEvidence() {
  return {transport:false,emulator:false,ownedAvd:false,bootCompleted:false,api:null as number|null,abi:null as "x86_64"|"x86"|"arm64-v8a"|"armeabi-v7a"|"UNKNOWN"|null,minimumApi:null as number|null,packageCompatible:false,packageManagerResponsive:false,sandboxAbsent:false,installAttempts:0,installed:false};
}
export async function installReadyAndroid(a:Android,metadata:string,packagePath:string,setup:ReturnType<typeof androidSetupEvidence>) {
  await a.check("SETUP_ADB_TARGET",async()=>{assert((await a.run(["get-state"])).trim()==="device","ANDROID_EXACT_EMULATOR_NOT_READY");setup.transport=true;});
  await a.check("SETUP_EMULATOR_RUNTIME",async()=>{assert((await a.run(["shell","getprop","ro.kernel.qemu"])).trim()==="1","ANDROID_EXACT_EMULATOR_NOT_READY");setup.emulator=true;});
  await a.check("SETUP_OWNED_AVD",async()=>{assert((await a.run(["emu","avd","name"])).split(/\r?\n/)[0]==="native_1b_phone","ANDROID_EMULATOR_OWNERSHIP_REFUSED");setup.ownedAvd=true;});
  await a.check("SETUP_BOOT_COMPLETED",async()=>{assert((await a.run(["shell","getprop","sys.boot_completed"])).trim()==="1","ANDROID_BOOT_NOT_COMPLETED");setup.bootCompleted=true;});
  await a.check("SETUP_API_ABI",async()=>{
    const api=(await a.run(["shell","getprop","ro.build.version.sdk"])).trim();setup.api=/^[1-9][0-9]{0,2}$/.test(api)?Number(api):null;assert(setup.api===35,"ANDROID_RUNTIME_API_OR_ABI_REFUSED");
    const abi=(await a.run(["shell","getprop","ro.product.cpu.abi"])).trim();setup.abi=["x86_64","x86","arm64-v8a","armeabi-v7a"].includes(abi)?abi as Exclude<typeof setup.abi,null|"UNKNOWN">:"UNKNOWN";
    // Bind to the existing owned workflow's android-35/google_apis/x86_64 image.
    assert(setup.abi==="x86_64","ANDROID_RUNTIME_API_OR_ABI_REFUSED");
  });
  await a.check("SETUP_PACKAGE_COMPATIBILITY",()=>{
    const minimum=/^sdkVersion:'([1-9][0-9]{0,2})'$/m.exec(metadata),native=/^native-code:\s*(.+)$/m.exec(metadata);
    setup.minimumApi=minimum?Number(minimum[1]):null;
    assert(setup.minimumApi!==null && setup.minimumApi<=setup.api! && native && [...native[1].matchAll(/'([^']+)'/g)].some(m=>m[1]===setup.abi),"ANDROID_PACKAGE_RUNTIME_MISMATCH");setup.packageCompatible=true;
  });
  await a.check("SETUP_PACKAGE_MANAGER",async()=>{
    // A responsive ADB shell/boot property does not establish PackageManager readiness.
    const packages=(await a.run(["shell","pm","path","android"])).trim().split(/\r?\n/);
    assert(packages.length>0 && packages.length<=16 && packages.every(p=>/^package:\/[A-Za-z0-9_./-]+\.apk$/.test(p)),"ANDROID_PACKAGE_MANAGER_NOT_RESPONSIVE");setup.packageManagerResponsive=true;
  });
  await a.check("SETUP_EMPTY_SANDBOX",async()=>{const packages=(await a.run(["shell","pm","list","packages",appId])).trim();assert(packages==="","ANDROID_EXISTING_APP_SANDBOX_REFUSED");setup.sandboxAbsent=true;});
  await a.check("SETUP_EXACT_PACKAGE_INSTALL",async()=>{assert(setup.installAttempts===0,"ANDROID_INSTALL_ATTEMPT_LIMIT");setup.installAttempts=1;assert((await a.run(["install",packagePath])).split(/\r?\n/).some(line=>line==="Success"),"ANDROID_INSTALL_FAILED");setup.installed=true;});
}
function numericVersion(value:unknown) {
  assert(typeof value==="string" && /^[0-9]{1,5}(?:\.[0-9]{1,3}){0,2}$/.test(value),"IOS_NUMERIC_VERSION_UNAVAILABLE");
  const v=value.split(".").map(Number);while(v.length<3)v.push(0);return v;
}
function versionOrder(a:readonly number[],b:readonly number[]) {return a[0]-b[0] || a[1]-b[1] || a[2]-b[2];}
export function selectAppleTarget(inventory:any,sdkVersion:string,minimumOS:string,kind:string) {
  assert(kind==="phone" || kind==="tablet","IOS_EXPLICIT_TARGET_KIND_REQUIRED");
  const sdk=numericVersion(sdkVersion),minimum=numericVersion(minimumOS);if(versionOrder(minimum,[15,0,0])<0)minimum.splice(0,3,15,0,0); // Existing XCTest project deployment target.
  assert(Array.isArray(inventory?.runtimes) && inventory.runtimes.length<=100 && Array.isArray(inventory?.devicetypes) && inventory.devicetypes.length<=1000,"IOS_INVENTORY_SCHEMA_REFUSED");
  // Select an installed target aligned with the actual selected SDK, not an arbitrary
  // lexically latest runtime. This is a scope choice, not a claim that newer OSes fail.
  const runtimes=inventory.runtimes.filter((r:any)=>r?.isAvailable===true && typeof r.identifier==="string" && /^com\.apple\.CoreSimulator\.SimRuntime\.iOS-[0-9-]+$/.test(r.identifier))
    .map((runtime:any)=>({runtime,version:numericVersion(runtime.version)}))
    .filter((r:any)=>r.version[0]===sdk[0] && versionOrder(r.version,sdk)<=0 && versionOrder(r.version,minimum)>=0)
    .sort((a:any,b:any)=>versionOrder(b.version,a.version)||a.runtime.identifier.localeCompare(b.runtime.identifier));
  for(const candidate of runtimes) {
    const types=inventory.devicetypes.filter((d:any)=>typeof d?.name==="string" && d.name.startsWith(kind==="phone"?"iPhone":"iPad") && typeof d.identifier==="string" && /^com\.apple\.CoreSimulator\.SimDeviceType\.[A-Za-z0-9-]+$/.test(d.identifier))
      .filter((d:any)=>{if(typeof d.minRuntimeVersionString!=="string" || typeof d.maxRuntimeVersionString!=="string")return false;return versionOrder(candidate.version,numericVersion(d.minRuntimeVersionString))>=0 && versionOrder(candidate.version,numericVersion(d.maxRuntimeVersionString))<=0;})
      .sort((a:any,b:any)=>a.identifier.localeCompare(b.identifier));
    if(types.length)return {runtime:candidate.runtime,deviceType:types[0],sdkVersion,policy:"INSTALLED_SDK_ALIGNED_TARGET" as const};
  }
  throw Error("IOS_SUPPORTED_RUNTIME_OR_DEVICE_TYPE_UNAVAILABLE");
}
export function appleOwnedState(inventory:any,serial:string,runtime:string,name:string) {
  ownedSimulatorId(serial);
  assert(inventory?.devices && typeof inventory.devices==="object" && !Array.isArray(inventory.devices),"IOS_OWNED_STATE_UNVERIFIED");
  const groups=Object.entries(inventory.devices);assert(groups.length<=100 && groups.every(([,ds])=>Array.isArray(ds) && ds.length<=1000),"IOS_OWNED_STATE_UNVERIFIED");
  const matches=groups.flatMap(([id,ds])=>(ds as any[]).filter(d=>d?.udid===serial).map(d=>({id,d})));
  if(matches.length===0)return "ABSENT" as const;
  assert(matches.length===1 && matches[0].id===runtime && matches[0].d.name===name,"IOS_OWNED_STATE_UNVERIFIED");
  return ["Booted","Shutdown"].includes(matches[0].d.state)?matches[0].d.state as "Booted"|"Shutdown":"UNKNOWN" as const;
}
type AppleCommand=(stage:string,args:string[],timeoutMs?:number)=>Promise<string>;
export function appleSetupEvidence() {return {createdState:"NOT_OBSERVED",bootState:"NOT_OBSERVED",light:{before:null as "light"|"dark"|null,writePassed:false,verified:false},dark:{before:null as "light"|"dark"|null,writePassed:false,verified:false}};}
export function appleAvailableRuntimes(inventory:any) {
  assert(Array.isArray(inventory?.runtimes) && inventory.runtimes.length<=100,"IOS_INVENTORY_SCHEMA_REFUSED");
  return [...new Set<string>(inventory.runtimes.filter((r:any)=>r?.isAvailable===true && typeof r.identifier==="string" && /^com\.apple\.CoreSimulator\.SimRuntime\.iOS-[0-9-]+$/.test(r.identifier) && typeof r.version==="string" && /^[0-9]{1,5}(?:\.[0-9]{1,3}){0,2}$/.test(r.version)).map((r:any)=>r.version))].sort((a,b)=>versionOrder(numericVersion(a),numericVersion(b))).slice(0,20);
}
export async function verifyAppleAppearance(command:AppleCommand,serial:string,mode:"light"|"dark",setup:ReturnType<typeof appleSetupEvidence>) {
  ownedSimulatorId(serial);const stage=mode==="light"?"ios-theme":"ios-dark-theme";
  const before=(await command(stage+"-read",["simctl","ui",serial,"appearance"])).trim();
  assert(before==="light" || before==="dark","IOS_APPEARANCE_READ_UNAVAILABLE");setup[mode].before=before;
  await command(stage,["simctl","ui",serial,"appearance",mode]);setup[mode].writePassed=true;
  assert((await command(stage+"-readback",["simctl","ui",serial,"appearance"])).trim()===mode,"IOS_APPEARANCE_READBACK_MISMATCH");setup[mode].verified=true;
}
export async function cleanupAppleTarget(command:AppleCommand,serial:string,runtime:string,name:string,unsettled:()=>boolean) {
  ownedSimulatorId(serial);
  const result={status:"UNRECONCILED",initialState:"NOT_OBSERVED",shutdownCommand:"NOT_EXECUTED",shutdownState:"NOT_OBSERVED",deleteCommand:"NOT_EXECUTED",finalState:"NOT_OBSERVED",cause:null as string|null};
  if(unsettled()){result.cause="CHILD_GROUP_UNRECONCILED";return result;}
  try{result.initialState=appleOwnedState(JSON.parse(await command("ios-cleanup-ownership-readback",["simctl","list","devices","--json"])),serial,runtime,name);assert(result.initialState==="Booted" || result.initialState==="Shutdown","IOS_OWNED_STATE_UNVERIFIED");}catch{result.cause="IOS_CLEANUP_OWNERSHIP_UNVERIFIED";return result;}
  if(unsettled()){result.cause="CHILD_GROUP_UNRECONCILED";return result;}
  if(result.initialState==="Booted")try{await command("ios-owned-shutdown",["simctl","shutdown",serial]);result.shutdownCommand="PASS";}catch{result.shutdownCommand="FAILED";result.cause="IOS_SHUTDOWN_COMMAND_FAILED";}
  // A closed/failed shutdown child is not simulator state. Read the same owned ID
  // once; never issue a second shutdown or delete a still-booted/unknown target.
  if(unsettled()){result.cause="CHILD_GROUP_UNRECONCILED";return result;}
  try {
    result.shutdownState=appleOwnedState(JSON.parse(await command("ios-shutdown-readback",["simctl","list","devices","--json"])),serial,runtime,name);
    assert(result.shutdownState==="Shutdown","IOS_OWNED_SHUTDOWN_UNVERIFIED");
    try{result.deleteCommand="FAILED";await command("ios-owned-delete",["simctl","delete",serial]);result.deleteCommand="PASS";}catch{result.cause??="IOS_DELETE_COMMAND_FAILED";}
    if(unsettled()){result.cause="CHILD_GROUP_UNRECONCILED";return result;}
    result.finalState=appleOwnedState(JSON.parse(await command("ios-cleanup-readback",["simctl","list","devices","--json"])),serial,runtime,name);
    assert(result.finalState==="ABSENT","IOS_OWNED_DELETE_UNVERIFIED");
    result.status="VERIFIED";
  }catch{result.cause??="IOS_OWNED_CLEANUP_FAILED";}
  return result;
}
export function appleInputBindings(workspace:string,derived:string,projectSource:string):AppleInputBinding[] {
  // The checked-in project defines these exact target/product/source identities. Do not infer a
  // missing compiler input from them: a later actual diagnostic must match its private path too.
  assert(projectSource.includes('name = CompiledNalanda; productName = "Nalanda School";')&&projectSource.includes('PRODUCT_NAME = "Nalanda School";')&&projectSource.includes('name = NativeJourney; productName = NativeJourney;')&&projectSource.includes('path = NativeJourney.swift;'),"IOS_PUBLIC_INPUT_SOURCE_BINDING_REFUSED");
  assert(path.isAbsolute(workspace)&&path.isAbsolute(derived),"IOS_PUBLIC_INPUT_SOURCE_BINDING_REFUSED");
  const product=path.join(derived,"Build/Products/Debug-iphonesimulator/Nalanda School.app");
  return [{absolutePath:path.join(workspace,...swiftSource.split("/")),identity:"SWIFT_SOURCE"},{absolutePath:path.join(product,"Nalanda School"),identity:"COMPILED_APP_EXECUTABLE"},{absolutePath:path.join(product,"Info.plist"),identity:"COMPILED_APP_PLIST"}];
}
export function processRecorder(output: string, publicSource?:PublicSource) {
  let sequence=0, failure: {stage:string;cause:string}|null=null;
  const outcomes=new Map<string,ReturnType<typeof processMetadata>>();
  const retained=new Map<string,boolean>();
  const builds=new Map<string,ReturnType<typeof appleBuild>>();
  const journeys=new Map<string,ReturnType<typeof appleScenarioMarkers>>();
  let unreconciled=false;
  let latest: {stage:string;process:ReturnType<typeof processMetadata>;cause:string|null}|null=null;
  const observe=(r:ProducerProcessObservation)=>{
    unreconciled ||= r.terminationFailed===true;
    assert(processStages.has(r.stage),"NATIVE_PROCESS_STAGE_NOT_ALLOWLISTED");
    assert(++sequence<=1000,"NATIVE_PROCESS_RECORD_LIMIT");
    let cause:string|null=childCause(r);
    if(cause==="CHILD_EXIT_FAILED" && r.stage==="android-install"){
      const installCodes=["INSTALL_FAILED_INSUFFICIENT_STORAGE","INSTALL_FAILED_NO_MATCHING_ABIS","INSTALL_FAILED_OLDER_SDK","INSTALL_FAILED_TEST_ONLY","INSTALL_FAILED_INVALID_APK","INSTALL_FAILED_USER_RESTRICTED"];
      const detail=r.stdout.toString()+r.stderr.toString();cause=installCodes.find(code=>detail.includes(code))??cause;
    }
    if(cause && !failure)failure={stage:r.stage,cause};
    const metadata=processMetadata(r);outcomes.set(r.stage,metadata);retained.set(r.stage,false);latest={stage:r.stage,process:metadata,cause};
    if(r.stage==="ios-build-ui-runner" && publicSource)builds.set(r.stage,appleBuild(r.stdout,r.stderr,publicSource));
    if(r.stage==="ios-real-ui-journey")journeys.set(r.stage,appleScenarioMarkers(r.stdout,r.stderr,cause===null));
    const stem=path.join(output,`process-${sequence}`);
    try {
      const omit=r.stage==="android-ui-command";
      if(!omit){writeFileSync(stem+".stdout",r.stdout,{flag:"wx",mode:0o600});writeFileSync(stem+".stderr",r.stderr,{flag:"wx",mode:0o600});}
      // Byte lengths/hashes remain PRIVATE, including low-entropy credential-bearing streams.
      writeFileSync(stem+".json",JSON.stringify({stage:r.stage,...metadata,rawRetention:omit?"OMITTED_UI_BOUNDARY":"RETAINED_PRIVATELY",stdoutBytes:r.stdout.length,stderrBytes:r.stderr.length,stdoutSha256:createHash("sha256").update(r.stdout).digest("hex"),stderrSha256:createHash("sha256").update(r.stderr).digest("hex")}),{flag:"wx",mode:0o600});
      retained.set(r.stage,true);
    } catch {failure={stage:r.stage,cause:"PRIVATE_RETENTION_FAILED"};throw Error("NATIVE_PRIVATE_PROCESS_RETENTION_FAILED");}
  };
  return {observe,failure:()=>failure,outcome:(stage:string)=>outcomes.get(stage),retained:(stage:string)=>retained.get(stage)===true,build:(stage:string)=>builds.get(stage),journey:(stage:string)=>journeys.get(stage),latest:()=>latest,unreconciled:()=>unreconciled};
}
export function ownedSimulatorId(value:string) {
  assert(/^[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{12}$/.test(value),"IOS_OWNED_TARGET_ID_INVALID");return value;
}
export function retainNativeEvidence(output:string,evidence:object,success:boolean,cleanup:string) {
  let retained=true;
  try{writeFileSync(path.join(output,"evidence.json"),JSON.stringify(evidence),{flag:"wx",mode:0o600});}catch{retained=false;}
  return {status:success&&cleanup==="VERIFIED"&&retained?"PASS":"FAILED",evidenceRetention:retained?"LOCAL_PRIVATE":"NATIVE_PRIVATE_OUTPUT_WRITE_FAILED"};
}

export async function main(args: string[]) {
  const o = options(args), platform = o["--platform"];
  if (o["--mode"] === "list") { console.log(JSON.stringify({status:"PLANNED_NOT_EXECUTED",platform,profile:"NO_REMOTE_SERVER_CONFIGURED",scenarios, prerequisite:platform === "WINDOWS" ? "ADMITTED_EXACT_WINDOWS_PACKAGE_AND_DISPOSABLE_TARGET_RECIPE" : "ORDINARY_DISPOSABLE_HOSTED_CI_TARGET"})); return; }
  if (platform === "WINDOWS") throw Error("WINDOWS_LOCAL_EXECUTION_NOT_ADMITTED_USE_EXISTING_INTEGRATED_ACCEPTANCE_RECIPE");
  assert(process.env.GITHUB_ACTIONS === "true" && process.env.RUNNER_ENVIRONMENT === "github-hosted" && process.env.NALANDA_NATIVE_PROFILE === "NO_REMOTE_SERVER_CONFIGURED", "NATIVE_NO_REMOTE_EXECUTION_SCOPE_REFUSED");
  assert(platform === "ANDROID" ? process.platform === "linux" : process.platform === "darwin", "NATIVE_PLATFORM_HOST_UNAVAILABLE");
  const workspace = realpathSync(process.cwd()), temp = realpathSync(process.env.RUNNER_TEMP!);
  const output = path.resolve(o["--output"] ?? "");
  assert(inside(output, temp) && !existsSync(output) && realpathSync(path.dirname(output)) === temp, "NATIVE_PRIVATE_OUTPUT_NOT_NEW_OR_OWNED");
  const tool = file(o["--tool"]), metadataTool = file(o["--metadata-tool"]);
  const source = execFileSync("git", ["rev-parse", "HEAD"], {encoding:"utf8", windowsHide:true}).trim();
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH!,"utf8"));
  assert(source === (event.pull_request?.head?.sha ?? process.env.GITHUB_SHA), "NATIVE_SOURCE_NOT_EXACT_CANDIDATE");
  assert(execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], {encoding:"utf8",windowsHide:true}).trim() === "", "NATIVE_TRACKED_SOURCE_DIRTY");
  let packagePath = o["--package"];
  assert(packagePath && path.isAbsolute(packagePath) && inside(realpathSync(packagePath), workspace), "NATIVE_PACKAGE_OUTSIDE_WORKSPACE");
  mkdirSync(output,{mode:0o700});
  const sourceTree=execFileSync("git",["show","-s","--format=%T","HEAD"],{encoding:"utf8",windowsHide:true}).trim();
  const sourceText=execFileSync("git",["show",`${source}:${swiftSource}`],{encoding:"utf8",windowsHide:true});
  const publicSource:PublicSource={absolutePath:path.join(workspace,...swiftSource.split("/")),relativePath:swiftSource,lineCount:sourceText.split(/\r?\n/).length};
  const observations=processRecorder(output,publicSource);let summaryWritten=false,targetEffectsStarted=false;
  let boundPackageHash:string|null=null,androidSetup:ReturnType<typeof androidSetupEvidence>|null=null,appleSetup:ReturnType<typeof appleSetupEvidence>|null=null;
  let appleEnvironment:{sdk:string|null;availableRuntimes:string[];selectionPolicy:string;runtime:string|null;deviceFamily:string|null}|null=null;
  const identity=(packageHash:string)=>nativeIdentity({source,tree:sourceTree,packageHash,run:process.env.GITHUB_RUN_ID,attempt:process.env.GITHUB_RUN_ATTEMPT});
  const emit=(summary:object)=>{summaryWritten=true;console.log(JSON.stringify(summary));};
  let activeOperation="NATIVE_PREFLIGHT";
  const run = async(stage: string, executable: string, args: string[], timeoutMs = 30_000) => {
    assert(processStages.has(stage),"NATIVE_PROCESS_STAGE_NOT_ALLOWLISTED");
    activeOperation=stage;
    try{return await producerProcess({stage,tool:executable,args,timeoutMs},workspace,undefined,observations.observe);}
    catch{throw Error(`NATIVE_OPERATION_FAILED:${stage.replaceAll("-","_").toUpperCase()}`);}
  };
  try {
  const toolVersion = await run("tool-version", tool, platform === "ANDROID" ? ["version"] : ["--version"]);
  let packageHash: string;
  if (platform === "ANDROID") {
    packagePath = file(packagePath); packageHash = hash(packagePath);boundPackageHash=packageHash;
    assert(packageHash === o["--sha256"], "NATIVE_PACKAGE_HASH_MISMATCH");
    const metadata = await run("package-metadata", metadataTool, ["dump", "badging", packagePath]);
    assert(metadata.includes(`package: name='${appId}'`) && metadata.includes("versionName='0.1.0'") && metadata.includes(`launchable-activity: name='${appId}.MainActivity'`) && metadata.includes("application-debuggable"), "ANDROID_PACKAGE_ID_VERSION_OR_DEBUG_PROFILE_REFUSED");
    const a = new Android(tool, o["--serial"], workspace, observations.observe);
    const setup=androidSetup=androidSetupEvidence();
    const results: unknown[] = []; let cleanup = "NOT_EXECUTED", success = false;
    let terminal:ReturnType<Android["failure"]>|null=null,cleanupFailure:object|null=null;
    const record = async (scenario: string, action: () => Promise<void>) => {
      a.beginScenario();const started = new Date().toISOString(); try {
        await action();
        if(scenario==="A-clean-launch"){
          const png=execFileSync(tool,["-s",o["--serial"],"exec-out","screencap","-p"],{timeout:10_000,maxBuffer:20_000_000,windowsHide:true});
          await assertProtectedNativeCapture(png);writeFileSync(path.join(output,"protected-launch.png"),png,{flag:"wx",mode:0o600});
        }
        results.push({scenario,started,ended:new Date().toISOString(),assertion:"PASS"}); }
      catch(error) {terminal=a.failure(error);results.push({scenario,started,ended:new Date().toISOString(),assertion:"FAIL"}); throw Error(`NATIVE_SCENARIO_FAILED:${scenario}`); }
    };
    const started = new Date().toISOString();
    try {
      await installReadyAndroid(a,metadata,packagePath,setup);targetEffectsStarted=true;
      await journey(a, String(randomInt(10_000_000,99_999_999)), record);
      success = true;
    } catch(error) {if(!terminal)terminal=a.failure(error);throw error;
    } finally {
      const originalProcessFailure=observations.failure();
      if(observations.unreconciled()){cleanup="UNRECONCILED";cleanupFailure={cause:"CHILD_GROUP_UNRECONCILED",operations:"NOT_EXECUTED_WITH_UNSETTLED_CHILD_GROUP"};}
      else if(setup.installAttempts===1) try { if((await a.run(["shell","pm","list","packages",appId])).includes(`package:${appId}`)) { await a.run(["shell","am","force-stop",appId]); const uninstall=await a.run(["uninstall",appId]); assert(uninstall.includes("Success")); } assert(!(await a.run(["shell","pm","list","packages",appId])).includes(`package:${appId}`)); await a.run(["shell","rm","-f","/sdcard/nalanda-native-1b.xml"]); cleanup="VERIFIED"; } catch(error) {cleanup="UNRECONCILED";cleanupFailure={cause:androidCause(error),lastProcess:observations.latest()};}
      // Same exclusive/private writer convention as the existing connected host.
      const retention=retainNativeEvidence(output,{source,tree:sourceTree,platform,profile:"NO_REMOTE_SERVER_CONFIGURED",packageHash,target:o["--serial"],tools:{toolSha256:hash(tool),metadataToolSha256:hash(metadataTool),toolVersion},started,ended:new Date().toISOString(),exit:success&&cleanup==="VERIFIED"?0:1,assertions:results,terminal,cleanup,cleanupFailure,authenticated:false,physical:false},success,cleanup);
      emit({platform,...retention,identity:identity(packageHash),versions:nativeVersions(toolVersion),setup,scenarios:results,cleanup,cleanupFailure,settingsRestoration:a.settingsRestoration(),failure:success?null:terminal??originalProcessFailure,observedChildFailure:originalProcessFailure?{...originalProcessFailure,relationship:success?"RECOVERED_DURING_SUCCESSFUL_JOURNEY":"OBSERVED_SEPARATELY_FROM_TERMINAL_PREDICATE"}:null,authenticated:false,physical:false});
      assert(retention.evidenceRetention==="LOCAL_PRIVATE","NATIVE_PRIVATE_OUTPUT_WRITE_FAILED");
    }
    assert(success && cleanup === "VERIFIED", "NATIVE_EXECUTION_OR_CLEANUP_FAILED");
  } else {
    assert(["phone","tablet"].includes(o["--target-kind"]), "IOS_EXPLICIT_TARGET_KIND_REQUIRED");
    packagePath=realpathSync(packagePath); packageHash=packageDigest(packagePath);boundPackageHash=packageHash;
    assert(packageHash===o["--sha256"] && packagePath.endsWith(".app"),"NATIVE_PACKAGE_HASH_MISMATCH");
    const plist=JSON.parse(await run("ios-package-metadata",tool,["plutil","-convert","json","-o","-",path.join(packagePath,"Info.plist")]));
    assert(plist.CFBundleIdentifier===appId && plist.CFBundleShortVersionString==="0.1.0" && plist.DTPlatformName==="iphonesimulator" && plist.CFBundleExecutable && !String(plist.CFBundleExecutable).includes("/"),"IOS_SIMULATOR_PACKAGE_METADATA_REFUSED");
    const arch=await run("ios-architecture",tool,["lipo","-archs",path.join(packagePath,plist.CFBundleExecutable)]);
    assert(arch.trim()==="arm64","IOS_SIMULATOR_ARCHITECTURE_REFUSED");
    const projectSource=execFileSync("git",["show",`${source}:${appleProjectSource}`],{encoding:"utf8",windowsHide:true});
    publicSource.inputs=appleInputBindings(workspace,path.join(output,"derived"),projectSource);
    const appInput={configuredExecutablePresent:existsSync(path.join(packagePath,"Nalanda School")),metadataExecutableMatchesConfigured:plist.CFBundleExecutable==="Nalanda School"};
    const xcodeVersion=await run("xcode-version",metadataTool,["-version"]);
    const sdkVersion=(await run("ios-sdk-version",tool,["--sdk","iphonesimulator","--show-sdk-version"])).trim();numericVersion(sdkVersion);
    const inventory=JSON.parse(await run("ios-inventory",tool,["simctl","list","--json"]));
    appleEnvironment={sdk:sdkVersion,availableRuntimes:appleAvailableRuntimes(inventory),selectionPolicy:"INSTALLED_SDK_ALIGNED_TARGET",runtime:null,deviceFamily:o["--target-kind"]};
    activeOperation="IOS_TARGET_SELECTION";const {runtime,deviceType}=selectAppleTarget(inventory,sdkVersion,plist.MinimumOSVersion,o["--target-kind"]);appleEnvironment.runtime=runtime.version;
    const setup=appleSetup=appleSetupEvidence(),ownedName=`nalanda-native-${process.env.GITHUB_RUN_ID}-${o["--target-kind"]}`;
    const started=new Date().toISOString();let serial:string|undefined,success=false,cleanup="NOT_EXECUTED",errorCode="",copiedHash:string|null=null;
    const processes:unknown[]=[];let cleanupFailure:object|null=null,terminal:object|null=null;
    const xcode=async(stage:string,args:string[])=>{
      activeOperation=stage;
      const started=new Date().toISOString();let status="FAILED",stdoutSha256:string|null=null;
      try{const stdout=await producerProcess({stage,tool:metadataTool,args,timeoutMs:900_000},workspace,undefined,observations.observe);try{writeFileSync(path.join(output,`${stage}.stdout`),stdout,{flag:"wx",mode:0o600});}catch{throw Error("NATIVE_PRIVATE_OUTPUT_WRITE_FAILED");}stdoutSha256=createHash("sha256").update(stdout).digest("hex");status="PASS";}
      catch(error){if(["NATIVE_PRIVATE_OUTPUT_WRITE_FAILED","QA_PROCESS_RETENTION_FAILED"].includes(error instanceof Error?error.message:""))throw error;throw Error("IOS_XCODE_STAGE_FAILED:"+stage);}
      finally{const observed=observations.outcome(stage);processes.push({stage,started,ended:new Date().toISOString(),status,exit:observed?.exit??null,signal:observed?.signal??null,timedOut:observed?.timedOut??null,stdoutSha256,failureOutput:observations.retained(stage)?"RETAINED_PRIVATELY":"UNAVAILABLE"});}
    };
    try {
      targetEffectsStarted=true;const created=(await run("ios-create-owned-target",tool,["simctl","create",ownedName,deviceType.identifier,runtime.identifier])).trim();
      serial=ownedSimulatorId(created);
      setup.createdState=appleOwnedState(JSON.parse(await run("ios-created-readback",tool,["simctl","list","devices","--json"])),serial,runtime.identifier,ownedName);assert(setup.createdState==="Shutdown","IOS_CREATED_TARGET_STATE_REFUSED");
      await run("ios-boot",tool,["simctl","boot",serial]);await run("ios-boot-readiness",tool,["simctl","bootstatus",serial,"-b"],120_000);
      const command:AppleCommand=(stage,args,timeout)=>run(stage,tool,args,timeout);
      setup.bootState=appleOwnedState(JSON.parse(await command("ios-target-readback",["simctl","list","devices","--json"])),serial,runtime.identifier,ownedName);assert(setup.bootState==="Booted","IOS_OWNED_BOOT_STATE_REFUSED");
      await verifyAppleAppearance(command,serial,"light",setup);
      const derived=path.join(output,"derived"),project=path.join(workspace,"apps/nalanda-cross-platform/tests/native/NativeJourney.xcodeproj");
      await xcode("ios-build-ui-runner",["build-for-testing","-project",project,"-scheme","NativeJourney","-destination",`platform=iOS Simulator,id=${serial}`,"-derivedDataPath",derived,"CODE_SIGNING_ALLOWED=NO",`NALANDA_SIM_APP=${packagePath}`]);
      activeOperation="IOS_COPIED_PACKAGE_DIGEST";const copied=path.join(derived,"Build/Products/Debug-iphonesimulator/Nalanda School.app");copiedHash=packageDigest(copied);assert(copiedHash===packageHash,"IOS_TEST_TARGET_PACKAGE_SUBSTITUTED");
      const testArgs=["test-without-building","-project",project,"-scheme","NativeJourney","-destination",`platform=iOS Simulator,id=${serial}`,"-derivedDataPath",derived,"-parallel-testing-enabled","NO","-maximum-concurrent-test-simulator-destinations","1","CODE_SIGNING_ALLOWED=NO"];
      await xcode("ios-real-ui-journey",[...testArgs,"-resultBundlePath",path.join(output,"journey.xcresult"),"-only-testing:NativeJourney/NativeJourney/testNoRemoteJourney"]);
      activeOperation="IOS_REQUIRED_SCENARIO_MARKERS";assert(observations.journey("ios-real-ui-journey")?.status==="OBSERVED" && observations.journey("ios-real-ui-journey")?.scenarios.length===scenarios.length,"IOS_REQUIRED_SCENARIO_EVIDENCE_MISSING");
      setup.bootState=appleOwnedState(JSON.parse(await command("ios-target-readback",["simctl","list","devices","--json"])),serial,runtime.identifier,ownedName);assert(setup.bootState==="Booted","IOS_OWNED_BOOT_STATE_REFUSED");
      await verifyAppleAppearance(command,serial,"dark",setup);
      await xcode("ios-dark-locked-layout",[...testArgs,"-resultBundlePath",path.join(output,"dark-layout.xcresult"),"-only-testing:NativeJourney/NativeJourney/testDarkLockedLayout"]);
      await run("ios-final-locked-launch",tool,["simctl","launch",serial,appId]);
      const capture=path.join(output,"locked-dark.png"); let captureReady=false; const captureDeadline=Date.now()+60_000; while(Date.now()<captureDeadline){await run("ios-final-capture",tool,["simctl","io",serial,"screenshot",capture]);try{await assertNonblankNativeCapture(capture);captureReady=true;break;}catch{await new Promise(resolve=>setTimeout(resolve,1_000));}} activeOperation="IOS_FINAL_CAPTURE_READINESS";assert(captureReady,"IOS_FINAL_CAPTURE_READINESS_TIMEOUT");
      success=true;
    } catch(error) {errorCode=error instanceof Error?error.message:"IOS_EXECUTION_FAILED";terminal={operation:activeOperation,cause:appleCause(error),process:observations.outcome(activeOperation)??null,childFailure:observations.failure()};throw error;}
    finally {
      const originalProcessFailure=observations.failure();
      if(observations.unreconciled()){cleanup="UNRECONCILED";cleanupFailure={cause:"CHILD_GROUP_UNRECONCILED",operations:"NOT_EXECUTED_WITH_UNSETTLED_CHILD_GROUP"};}
      else if(serial) {const settled=await cleanupAppleTarget((stage,args,timeout)=>run(stage,tool,args,timeout),serial,runtime.identifier,ownedName,observations.unreconciled);cleanup=settled.status;cleanupFailure={...settled,shutdownProcess:observations.outcome("ios-owned-shutdown")??null,deleteProcess:observations.outcome("ios-owned-delete")??null,lastProcess:observations.latest()};}
      else {cleanup="UNRECONCILED";cleanupFailure={cause:"IOS_CREATED_TARGET_OWNERSHIP_UNVERIFIED",operations:"NOT_EXECUTED_WITH_UNVERIFIED_TARGET"};}
      const retention=retainNativeEvidence(output,{source,platform,profile:"NO_REMOTE_SERVER_CONFIGURED",packageHash,copiedHash,target:serial,runtime,deviceType,tools:{toolSha256:hash(tool),metadataToolSha256:hash(metadataTool),toolVersion,xcodeVersion},started,ended:new Date().toISOString(),exit:success&&cleanup==="VERIFIED"?0:1,assertions:observations.journey("ios-real-ui-journey")?.scenarios??[],processes,errorCode,terminal,cleanup,cleanupFailure,authenticated:false,physical:false},success,cleanup);
      emit({platform,targetKind:o["--target-kind"],...retention,identity:identity(packageHash),versions:nativeVersions(toolVersion,xcodeVersion,runtime.version),environment:appleEnvironment,setup,scenarios:observations.journey("ios-real-ui-journey")?.scenarios??[],scenarioEvidence:observations.journey("ios-real-ui-journey")?.status??"NOT_EXECUTED",cleanup,cleanupFailure,failure:terminal,observedChildFailure:originalProcessFailure,appInput,build:observations.build("ios-build-ui-runner")??null,buildProcess:observations.outcome("ios-build-ui-runner")??null,authenticated:false,physical:false});
      assert(retention.evidenceRetention==="LOCAL_PRIVATE","NATIVE_PRIVATE_OUTPUT_WRITE_FAILED");
    }
    assert(success&&cleanup==="VERIFIED","NATIVE_EXECUTION_OR_CLEANUP_FAILED");
  }
  } catch(error) {if(!summaryWritten)emit({platform,status:"FAILED",...(boundPackageHash?{identity:identity(boundPackageHash)}:{}),setup:platform==="IOS"?appleSetup:androidSetup,environment:appleEnvironment,scenarios:[],failure:{operation:activeOperation,cause:platform==="IOS"?appleCause(error):androidCause(error),process:observations.outcome(activeOperation)??null,childFailure:observations.failure()},cleanup:targetEffectsStarted?"UNRECONCILED":"NOT_EXECUTED",authenticated:false,physical:false});throw error;}
}
if(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2)).catch(error=>{const code=error instanceof Error?error.message:"";console.error(/^(NATIVE_|ANDROID_|IOS_|WINDOWS_|QA_PROCESS_)[A-Za-z0-9_:-]+$/.test(code)?code:"NATIVE_EXECUTION_FAILED_DETAILS_PRIVATE");process.exitCode=1;});
