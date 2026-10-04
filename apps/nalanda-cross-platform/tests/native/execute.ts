import assert from "node:assert/strict";
import { createHash, randomInt } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { producerProcess } from "../../../../scripts/portable/producer-process";
import { Android, appId, journey } from "./android";
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
  const run = (stage: string, executable: string, args: string[], timeoutMs = 30_000) => producerProcess({stage,tool:executable,args,timeoutMs},workspace);
  const toolVersion = await run("tool-version", tool, platform === "ANDROID" ? ["version"] : ["--version"]);
  let packageHash: string;
  if (platform === "ANDROID") {
    packagePath = file(packagePath); packageHash = hash(packagePath);
    assert(packageHash === o["--sha256"], "NATIVE_PACKAGE_HASH_MISMATCH");
    const metadata = await run("package-metadata", metadataTool, ["dump", "badging", packagePath]);
    assert(metadata.includes(`package: name='${appId}'`) && metadata.includes("versionName='0.1.0'") && metadata.includes(`launchable-activity: name='${appId}.MainActivity'`) && metadata.includes("application-debuggable"), "ANDROID_PACKAGE_ID_VERSION_OR_DEBUG_PROFILE_REFUSED");
    const a = new Android(tool, o["--serial"], workspace);
    assert((await a.run(["get-state"])).trim() === "device" && (await a.run(["shell","getprop","ro.kernel.qemu"])).trim() === "1", "ANDROID_EXACT_EMULATOR_NOT_READY");
    assert((await a.run(["emu","avd","name"])).split(/\r?\n/)[0]==="native_1b_phone","ANDROID_EMULATOR_OWNERSHIP_REFUSED");
    assert(!(await a.run(["shell","pm","list","packages",appId])).includes(`package:${appId}`), "ANDROID_EXISTING_APP_SANDBOX_REFUSED");
    mkdirSync(output, {mode:0o700});
    const results: unknown[] = []; let installAttempted = false, cleanup = "NOT_EXECUTED", success = false;
    const record = async (scenario: string, action: () => Promise<void>) => {
      const started = new Date().toISOString(); try {
        await action();
        if(scenario==="A-clean-launch"){
          const png=execFileSync(tool,["-s",o["--serial"],"exec-out","screencap","-p"],{timeout:10_000,maxBuffer:20_000_000,windowsHide:true});
          await assertProtectedNativeCapture(png);writeFileSync(path.join(output,"protected-launch.png"),png,{flag:"wx",mode:0o600});
        }
        results.push({scenario,started,ended:new Date().toISOString(),assertion:"PASS"}); }
      catch { results.push({scenario,started,ended:new Date().toISOString(),assertion:"FAIL"}); throw Error(`NATIVE_SCENARIO_FAILED:${scenario}`); }
    };
    const started = new Date().toISOString();
    try {
      installAttempted = true; const install = await a.run(["install", packagePath]); assert(install.includes("Success"), "ANDROID_INSTALL_FAILED");
      await journey(a, String(randomInt(10_000_000,99_999_999)), record);
      success = true;
    } finally {
      try { if(installAttempted && (await a.run(["shell","pm","list","packages",appId])).includes(`package:${appId}`)) { await a.run(["shell","am","force-stop",appId]); const uninstall=await a.run(["uninstall",appId]); assert(uninstall.includes("Success")); } assert(!(await a.run(["shell","pm","list","packages",appId])).includes(`package:${appId}`)); await a.run(["shell","rm","-f","/sdcard/nalanda-native-1b.xml"]); cleanup="VERIFIED"; } catch {cleanup="UNRECONCILED";}
      // Same exclusive/private writer convention as the existing connected host.
      writeFileSync(path.join(output,"evidence.json"),JSON.stringify({source,tree:execFileSync("git",["show","-s","--format=%T","HEAD"],{encoding:"utf8"}).trim(),platform,profile:"NO_REMOTE_SERVER_CONFIGURED",packageHash,target:o["--serial"],tools:{toolSha256:hash(tool),metadataToolSha256:hash(metadataTool),toolVersion},started,ended:new Date().toISOString(),exit:success&&cleanup==="VERIFIED"?0:1,assertions:results,cleanup,authenticated:false,physical:false}),{flag:"wx",mode:0o600});
      console.log(JSON.stringify({platform,status:success&&cleanup==="VERIFIED"?"PASS":"FAILED",scenarios:results,cleanup,authenticated:false,physical:false}));
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
    const xcodeVersion=await run("xcode-version",metadataTool,["-version"]);
    const inventory=JSON.parse(await run("ios-inventory",tool,["simctl","list","--json"]));
    const runtime=inventory.runtimes.filter((r:any)=>r.isAvailable && r.identifier.startsWith("com.apple.CoreSimulator.SimRuntime.iOS-")).sort((a:any,b:any)=>a.identifier.localeCompare(b.identifier)).at(-1);
    const deviceType=inventory.devicetypes.find((d:any)=>d.name.startsWith(o["--target-kind"]==="phone"?"iPhone":"iPad") && (!d.minRuntimeVersionString || Number(d.minRuntimeVersionString.split(".")[0])<=Number(runtime?.version.split(".")[0])));
    assert(runtime && deviceType,"IOS_SUPPORTED_RUNTIME_OR_DEVICE_TYPE_UNAVAILABLE");
    mkdirSync(output,{mode:0o700});
    const started=new Date().toISOString();let serial:string|undefined,success=false,cleanup="NOT_EXECUTED",errorCode="",copiedHash:string|null=null;
    const processes:unknown[]=[];
    const xcode=async(stage:string,args:string[])=>{
      const started=new Date().toISOString();let status="FAILED",stdoutSha256:string|null=null;
      try{const stdout=await producerProcess({stage,tool:metadataTool,args,timeoutMs:900_000},workspace);writeFileSync(path.join(output,`${stage}.stdout`),stdout,{flag:"wx",mode:0o600});stdoutSha256=createHash("sha256").update(stdout).digest("hex");status="PASS";}
      catch{throw Error("IOS_XCODE_STAGE_FAILED:"+stage);}
      finally{processes.push({stage,started,ended:new Date().toISOString(),status,exit:status==="PASS"?0:null,stdoutSha256,failureOutput:"UNAVAILABLE_WITH_EXISTING_TRANSPORT"});}
    };
    try {
      serial=(await run("ios-create-owned-target",tool,["simctl","create",`nalanda-native-${process.env.GITHUB_RUN_ID}-${o["--target-kind"]}`,deviceType.identifier,runtime.identifier])).trim();
      assert(/^[A-Fa-f0-9-]{36}$/.test(serial),"IOS_OWNED_TARGET_ID_INVALID");
      await run("ios-boot",tool,["simctl","boot",serial]);await run("ios-boot-readiness",tool,["simctl","bootstatus",serial,"-b"],120_000);
      await run("ios-theme",tool,["simctl","ui",serial,"appearance","light"]);
      const derived=path.join(output,"derived"),project=path.join(workspace,"apps/nalanda-cross-platform/tests/native/NativeJourney.xcodeproj");
      await xcode("ios-build-ui-runner",["build-for-testing","-project",project,"-scheme","NativeJourney","-destination",`platform=iOS Simulator,id=${serial}`,"-derivedDataPath",derived,"CODE_SIGNING_ALLOWED=NO",`NALANDA_SIM_APP=${packagePath}`]);
      const copied=path.join(derived,"Build/Products/Debug-iphonesimulator/Nalanda School.app");copiedHash=packageDigest(copied);assert(copiedHash===packageHash,"IOS_TEST_TARGET_PACKAGE_SUBSTITUTED");
      const testArgs=["test-without-building","-project",project,"-scheme","NativeJourney","-destination",`platform=iOS Simulator,id=${serial}`,"-derivedDataPath",derived,"-parallel-testing-enabled","NO","-maximum-concurrent-test-simulator-destinations","1","CODE_SIGNING_ALLOWED=NO"];
      await xcode("ios-real-ui-journey",[...testArgs,"-resultBundlePath",path.join(output,"journey.xcresult"),"-only-testing:NativeJourney/NativeJourney/testNoRemoteJourney"]);
      await run("ios-dark-theme",tool,["simctl","ui",serial,"appearance","dark"]);
      await xcode("ios-dark-locked-layout",[...testArgs,"-resultBundlePath",path.join(output,"dark-layout.xcresult"),"-only-testing:NativeJourney/NativeJourney/testDarkLockedLayout"]);
      await run("ios-final-locked-launch",tool,["simctl","launch",serial,appId]);
      const capture=path.join(output,"locked-dark.png"); let captureReady=false; const captureDeadline=Date.now()+60_000; while(Date.now()<captureDeadline){await run("ios-final-capture",tool,["simctl","io",serial,"screenshot",capture]);try{await assertNonblankNativeCapture(capture);captureReady=true;break;}catch{await new Promise(resolve=>setTimeout(resolve,1_000));}} assert(captureReady,"IOS_FINAL_CAPTURE_READINESS_TIMEOUT");
      success=true;
    } catch(error) {errorCode=error instanceof Error?error.message:"IOS_EXECUTION_FAILED";throw error;}
    finally {
      if(serial) try {await run("ios-owned-shutdown",tool,["simctl","shutdown",serial]);await run("ios-owned-delete",tool,["simctl","delete",serial]);const after=JSON.parse(await run("ios-cleanup-readback",tool,["simctl","list","devices","--json"]));assert(!Object.values(after.devices).flat().some((d:any)=>d.udid===serial));cleanup="VERIFIED";}catch{cleanup="UNRECONCILED";}
      writeFileSync(path.join(output,"evidence.json"),JSON.stringify({source,platform,profile:"NO_REMOTE_SERVER_CONFIGURED",packageHash,copiedHash,target:serial,runtime,deviceType,tools:{toolSha256:hash(tool),metadataToolSha256:hash(metadataTool),toolVersion,xcodeVersion},started,ended:new Date().toISOString(),exit:success&&cleanup==="VERIFIED"?0:1,assertions:success?scenarios.map(s=>({scenario:s,assertion:"PASS"})):[],processes,errorCode,cleanup,authenticated:false,physical:false}),{flag:"wx",mode:0o600});
      console.log(JSON.stringify({platform,targetKind:o["--target-kind"],status:success&&cleanup==="VERIFIED"?"PASS":"FAILED",scenarios:success?scenarios:[],cleanup,authenticated:false,physical:false}));
    }
    assert(success&&cleanup==="VERIFIED","NATIVE_EXECUTION_OR_CLEANUP_FAILED");
  }
}
if(process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2)).catch(error=>{console.error(error instanceof Error?error.message:"NATIVE_EXECUTION_REFUSED");process.exitCode=1;});
