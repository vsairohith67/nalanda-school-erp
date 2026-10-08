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

const processStages = new Set(["tool-version","package-metadata","android-install","android-uninstall","android-ui-command","ios-package-metadata","ios-architecture","xcode-version","ios-inventory","ios-create-owned-target","ios-boot","ios-boot-readiness","ios-theme","ios-build-ui-runner","ios-real-ui-journey","ios-dark-theme","ios-dark-locked-layout","ios-final-locked-launch","ios-final-capture","ios-owned-shutdown","ios-owned-delete","ios-cleanup-readback"]);
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
    packagePath = file(packagePath); packageHash = hash(packagePath);
    assert(packageHash === o["--sha256"], "NATIVE_PACKAGE_HASH_MISMATCH");
    const metadata = await run("package-metadata", metadataTool, ["dump", "badging", packagePath]);
    assert(metadata.includes(`package: name='${appId}'`) && metadata.includes("versionName='0.1.0'") && metadata.includes(`launchable-activity: name='${appId}.MainActivity'`) && metadata.includes("application-debuggable"), "ANDROID_PACKAGE_ID_VERSION_OR_DEBUG_PROFILE_REFUSED");
    const a = new Android(tool, o["--serial"], workspace, observations.observe);
    assert((await a.run(["get-state"])).trim() === "device" && (await a.run(["shell","getprop","ro.kernel.qemu"])).trim() === "1", "ANDROID_EXACT_EMULATOR_NOT_READY");
    assert((await a.run(["emu","avd","name"])).split(/\r?\n/)[0]==="native_1b_phone","ANDROID_EMULATOR_OWNERSHIP_REFUSED");
    assert(!(await a.run(["shell","pm","list","packages",appId])).includes(`package:${appId}`), "ANDROID_EXISTING_APP_SANDBOX_REFUSED");
    const results: unknown[] = []; let installAttempted = false, cleanup = "NOT_EXECUTED", success = false;
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
      targetEffectsStarted = true; installAttempted = true; const install = await a.run(["install", packagePath]); assert(install.includes("Success"), "ANDROID_INSTALL_FAILED");
      await journey(a, String(randomInt(10_000_000,99_999_999)), record);
      success = true;
    } catch(error) {if(!terminal)terminal=a.failure(error);throw error;
    } finally {
      const originalProcessFailure=observations.failure();
      if(observations.unreconciled()){cleanup="UNRECONCILED";cleanupFailure={cause:"CHILD_GROUP_UNRECONCILED",operations:"NOT_EXECUTED_WITH_UNSETTLED_CHILD_GROUP"};}
      else try { if(installAttempted && (await a.run(["shell","pm","list","packages",appId])).includes(`package:${appId}`)) { await a.run(["shell","am","force-stop",appId]); const uninstall=await a.run(["uninstall",appId]); assert(uninstall.includes("Success")); } assert(!(await a.run(["shell","pm","list","packages",appId])).includes(`package:${appId}`)); await a.run(["shell","rm","-f","/sdcard/nalanda-native-1b.xml"]); cleanup="VERIFIED"; } catch(error) {cleanup="UNRECONCILED";cleanupFailure={cause:androidCause(error),lastProcess:observations.latest()};}
      // Same exclusive/private writer convention as the existing connected host.
      const retention=retainNativeEvidence(output,{source,tree:sourceTree,platform,profile:"NO_REMOTE_SERVER_CONFIGURED",packageHash,target:o["--serial"],tools:{toolSha256:hash(tool),metadataToolSha256:hash(metadataTool),toolVersion},started,ended:new Date().toISOString(),exit:success&&cleanup==="VERIFIED"?0:1,assertions:results,terminal,cleanup,cleanupFailure,authenticated:false,physical:false},success,cleanup);
      emit({platform,...retention,identity:identity(packageHash),versions:nativeVersions(toolVersion),scenarios:results,cleanup,cleanupFailure,settingsRestoration:a.settingsRestoration(),failure:success?null:terminal??originalProcessFailure,observedChildFailure:originalProcessFailure?{...originalProcessFailure,relationship:success?"RECOVERED_DURING_SUCCESSFUL_JOURNEY":"OBSERVED_SEPARATELY_FROM_TERMINAL_PREDICATE"}:null,authenticated:false,physical:false});
      assert(retention.evidenceRetention==="LOCAL_PRIVATE","NATIVE_PRIVATE_OUTPUT_WRITE_FAILED");
    }
    assert(success && cleanup === "VERIFIED", "NATIVE_EXECUTION_OR_CLEANUP_FAILED");
  } else {
    assert(["phone","tablet"].includes(o["--target-kind"]), "IOS_EXPLICIT_TARGET_KIND_REQUIRED");
    packagePath=realpathSync(packagePath); packageHash=packageDigest(packagePath);
    assert(packageHash===o["--sha256"] && packagePath.endsWith(".app"),"NATIVE_PACKAGE_HASH_MISMATCH");
    const plist=JSON.parse(await run("ios-package-metadata",tool,["plutil","-convert","json","-o","-",path.join(packagePath,"Info.plist")]));
    assert(plist.CFBundleIdentifier===appId && plist.CFBundleShortVersionString==="0.1.0" && plist.DTPlatformName==="iphonesimulator" && plist.CFBundleExecutable && !String(plist.CFBundleExecutable).includes("/"),"IOS_SIMULATOR_PACKAGE_METADATA_REFUSED");
    const arch=await run("ios-architecture",tool,["lipo","-archs",path.join(packagePath,plist.CFBundleExecutable)]);
    assert(arch.trim()==="arm64","IOS_SIMULATOR_ARCHITECTURE_REFUSED");
    const projectSource=execFileSync("git",["show",`${source}:${appleProjectSource}`],{encoding:"utf8",windowsHide:true});
    publicSource.inputs=appleInputBindings(workspace,path.join(output,"derived"),projectSource);
    const appInput={configuredExecutablePresent:existsSync(path.join(packagePath,"Nalanda School")),metadataExecutableMatchesConfigured:plist.CFBundleExecutable==="Nalanda School"};
    const xcodeVersion=await run("xcode-version",metadataTool,["-version"]);
    const inventory=JSON.parse(await run("ios-inventory",tool,["simctl","list","--json"]));
    const runtime=inventory.runtimes.filter((r:any)=>r.isAvailable && r.identifier.startsWith("com.apple.CoreSimulator.SimRuntime.iOS-")).sort((a:any,b:any)=>a.identifier.localeCompare(b.identifier)).at(-1);
    const deviceType=inventory.devicetypes.find((d:any)=>d.name.startsWith(o["--target-kind"]==="phone"?"iPhone":"iPad") && (!d.minRuntimeVersionString || Number(d.minRuntimeVersionString.split(".")[0])<=Number(runtime?.version.split(".")[0])));
    assert(runtime && deviceType,"IOS_SUPPORTED_RUNTIME_OR_DEVICE_TYPE_UNAVAILABLE");
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
      targetEffectsStarted=true;const created=(await run("ios-create-owned-target",tool,["simctl","create",`nalanda-native-${process.env.GITHUB_RUN_ID}-${o["--target-kind"]}`,deviceType.identifier,runtime.identifier])).trim();
      serial=ownedSimulatorId(created);
      await run("ios-boot",tool,["simctl","boot",serial]);await run("ios-boot-readiness",tool,["simctl","bootstatus",serial,"-b"],120_000);
      await run("ios-theme",tool,["simctl","ui",serial,"appearance","light"]);
      const derived=path.join(output,"derived"),project=path.join(workspace,"apps/nalanda-cross-platform/tests/native/NativeJourney.xcodeproj");
      await xcode("ios-build-ui-runner",["build-for-testing","-project",project,"-scheme","NativeJourney","-destination",`platform=iOS Simulator,id=${serial}`,"-derivedDataPath",derived,"CODE_SIGNING_ALLOWED=NO",`NALANDA_SIM_APP=${packagePath}`]);
      activeOperation="IOS_COPIED_PACKAGE_DIGEST";const copied=path.join(derived,"Build/Products/Debug-iphonesimulator/Nalanda School.app");copiedHash=packageDigest(copied);assert(copiedHash===packageHash,"IOS_TEST_TARGET_PACKAGE_SUBSTITUTED");
      const testArgs=["test-without-building","-project",project,"-scheme","NativeJourney","-destination",`platform=iOS Simulator,id=${serial}`,"-derivedDataPath",derived,"-parallel-testing-enabled","NO","-maximum-concurrent-test-simulator-destinations","1","CODE_SIGNING_ALLOWED=NO"];
      await xcode("ios-real-ui-journey",[...testArgs,"-resultBundlePath",path.join(output,"journey.xcresult"),"-only-testing:NativeJourney/NativeJourney/testNoRemoteJourney"]);
      activeOperation="IOS_REQUIRED_SCENARIO_MARKERS";assert(observations.journey("ios-real-ui-journey")?.status==="OBSERVED" && observations.journey("ios-real-ui-journey")?.scenarios.length===scenarios.length,"IOS_REQUIRED_SCENARIO_EVIDENCE_MISSING");
      await run("ios-dark-theme",tool,["simctl","ui",serial,"appearance","dark"]);
      await xcode("ios-dark-locked-layout",[...testArgs,"-resultBundlePath",path.join(output,"dark-layout.xcresult"),"-only-testing:NativeJourney/NativeJourney/testDarkLockedLayout"]);
      await run("ios-final-locked-launch",tool,["simctl","launch",serial,appId]);
      const capture=path.join(output,"locked-dark.png"); let captureReady=false; const captureDeadline=Date.now()+60_000; while(Date.now()<captureDeadline){await run("ios-final-capture",tool,["simctl","io",serial,"screenshot",capture]);try{await assertNonblankNativeCapture(capture);captureReady=true;break;}catch{await new Promise(resolve=>setTimeout(resolve,1_000));}} activeOperation="IOS_FINAL_CAPTURE_READINESS";assert(captureReady,"IOS_FINAL_CAPTURE_READINESS_TIMEOUT");
      success=true;
    } catch(error) {errorCode=error instanceof Error?error.message:"IOS_EXECUTION_FAILED";terminal={operation:activeOperation,cause:appleCause(error),process:observations.outcome(activeOperation)??null,childFailure:observations.failure()};throw error;}
    finally {
      const originalProcessFailure=observations.failure();
      if(observations.unreconciled()){cleanup="UNRECONCILED";cleanupFailure={cause:"CHILD_GROUP_UNRECONCILED",operations:"NOT_EXECUTED_WITH_UNSETTLED_CHILD_GROUP"};}
      else if(serial) try {await run("ios-owned-shutdown",tool,["simctl","shutdown",serial]);await run("ios-owned-delete",tool,["simctl","delete",serial]);const after=JSON.parse(await run("ios-cleanup-readback",tool,["simctl","list","devices","--json"]));assert(!Object.values(after.devices).flat().some((d:any)=>d.udid===serial));cleanup="VERIFIED";}catch{cleanup="UNRECONCILED";cleanupFailure={cause:"IOS_OWNED_CLEANUP_FAILED",lastProcess:observations.latest()};}
      else {cleanup="UNRECONCILED";cleanupFailure={cause:"IOS_CREATED_TARGET_OWNERSHIP_UNVERIFIED",operations:"NOT_EXECUTED_WITH_UNVERIFIED_TARGET"};}
      const retention=retainNativeEvidence(output,{source,platform,profile:"NO_REMOTE_SERVER_CONFIGURED",packageHash,copiedHash,target:serial,runtime,deviceType,tools:{toolSha256:hash(tool),metadataToolSha256:hash(metadataTool),toolVersion,xcodeVersion},started,ended:new Date().toISOString(),exit:success&&cleanup==="VERIFIED"?0:1,assertions:observations.journey("ios-real-ui-journey")?.scenarios??[],processes,errorCode,terminal,cleanup,cleanupFailure,authenticated:false,physical:false},success,cleanup);
      emit({platform,targetKind:o["--target-kind"],...retention,identity:identity(packageHash),versions:nativeVersions(toolVersion,xcodeVersion,runtime.version),scenarios:observations.journey("ios-real-ui-journey")?.scenarios??[],scenarioEvidence:observations.journey("ios-real-ui-journey")?.status??"NOT_EXECUTED",cleanup,cleanupFailure,failure:terminal,observedChildFailure:originalProcessFailure,appInput,build:observations.build("ios-build-ui-runner")??null,buildProcess:observations.outcome("ios-build-ui-runner")??null,authenticated:false,physical:false});
      assert(retention.evidenceRetention==="LOCAL_PRIVATE","NATIVE_PRIVATE_OUTPUT_WRITE_FAILED");
    }
    assert(success&&cleanup==="VERIFIED","NATIVE_EXECUTION_OR_CLEANUP_FAILED");
  }
  } catch(error) {if(!summaryWritten)emit({platform,status:"FAILED",scenarios:[],failure:{operation:activeOperation,cause:platform==="IOS"?appleCause(error):androidCause(error),process:observations.outcome(activeOperation)??null,childFailure:observations.failure()},cleanup:targetEffectsStarted?"UNRECONCILED":"NOT_EXECUTED",authenticated:false,physical:false});throw error;}
}
if(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2)).catch(error=>{const code=error instanceof Error?error.message:"";console.error(/^(NATIVE_|ANDROID_|IOS_|WINDOWS_|QA_PROCESS_)[A-Za-z0-9_:-]+$/.test(code)?code:"NATIVE_EXECUTION_FAILED_DETAILS_PRIVATE");process.exitCode=1;});
