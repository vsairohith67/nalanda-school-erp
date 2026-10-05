// SOURCE_ONLY draft controls. These never supply device acceptance.
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import {existsSync,mkdirSync,mkdtempSync,readdirSync,readFileSync,rmSync,writeFileSync} from "node:fs";
import os from "node:os";
import path from "node:path";
import {afterAll,afterEach,expect,it,vi} from "vitest";
import {Android,appId,journey} from "@/apps/nalanda-cross-platform/tests/native/android";
import {androidCause,androidState,appleBuild,appleScenarioMarkers,nativeIdentity,nativeScenarios,nativeVersions,processMetadata,swiftSource,type PublicSource} from "@/apps/nalanda-cross-platform/tests/native/diagnostics";
import {processRecorder,ownedSimulatorId,retainNativeEvidence} from "@/apps/nalanda-cross-platform/tests/native/execute";
import {producerProcess,type ProducerProcessObservation} from "@/scripts/portable/producer-process";
const root=mkdtempSync(path.join(os.tmpdir(),"native-projection-r2-"));
afterAll(()=>{expect(path.relative(os.tmpdir(),path.resolve(root))).toMatch(/^native-projection-r2-[^\\/]+$/);rmSync(root,{recursive:true,force:true});});
afterEach(()=>vi.useRealTimers());
const secret="invented-private-credential";
const pin="9".repeat(8);
const hostPath="/private/invented-owner/secret-workspace";
const source:PublicSource={absolutePath:`${hostPath}/${swiftSource}`,relativePath:swiftSource,lineCount:160};
const row=(text:string,extra:Record<string,string>={})=>({package:appId,text,class:"android.widget.TextView",...extra});
const streams=(text:string)=>Buffer.from(text);
const observation=(stage="android-ui-command"):ProducerProcessObservation=>({stage,stdout:streams(`<hierarchy PIN="${pin}">${secret}</hierarchy>`),stderr:streams(`${pin} ${hostPath} ${secret}`),exit:7,signal:null,timedOut:false,cancelled:false,startupFailed:false,outputLimit:false,terminationFailed:false,closed:true,durationMs:12});
const excluded=(value:unknown)=>{const json=JSON.stringify(value);for(const content of [secret,pin,hostPath,"<hierarchy","unknownField","stdoutSha256","stderrSha256","stdoutBytes","stderrBytes"])expect(json).not.toContain(content);};

it("projects app-only known states without password text, foreign apps or unknown fields",()=>{
 const state=androidState([row("Unlock app",{clickable:"true",enabled:"false"}),row("Workspace",{class:"android.widget.EditText",password:"true",unknownField:secret}),row("0 items"),row("Offline"),row("You are offline."),row(secret),row(pin),{...row("Network available"),package:"foreign.notifications"}]);
 expect(state.controls.UNLOCK).toEqual({count:1,actionable:1,enabled:0});expect(state.controls.WORKSPACE.count).toBe(0);expect(state.passwordFields).toBe(1);expect(state.network).toBe("OFFLINE");expect(state.states.EMPTY_QUEUE).toBe(true);excluded(state);
 expect(androidState([row("Network available"),row("Offline")]).network).toBe("UNKNOWN");
 expect(androidState(Array.from({length:1002},()=>row("Unlock app"))).controls.UNLOCK.count).toBe(1000);
});

it("recognizes assertion codes even with Node's appended numeric comparison",()=>{
 let error:unknown;try{assert.equal(0,1,"ANDROID_INPUT_NOT_UNIQUE");}catch(e){error=e;}
 expect(androidCause(error)).toBe("ANDROID_INPUT_NOT_UNIQUE");expect(androidCause(Error(secret))).toBe("ASSERTION_OR_OPERATION_UNKNOWN");
});

it("localizes C PIN-field uniqueness with fresh scoped counts and no credentials",async()=>{
 const a=new Android("source-only-adb","emulator-5580",root);a.beginScenario();
 a.run=async(args:string[])=>args.includes("cat")?`<hierarchy><node package="${appId}" class="android.widget.EditText" password="true" text="${pin}"/><node package="foreign.app" text="${secret}"/></hierarchy>`:"";
 // The single field has no bounds: uniqueness passes, the exact bounds predicate fails.
 let failure:unknown;try{await a.unlock(pin);}catch(e){failure=e;}
 const diagnostic=a.failure(failure);expect(diagnostic).toMatchObject({predicate:"PIN_FIELD_BOUNDS",cause:"ANDROID_CONTROL_BOUNDS_INVALID",kind:"ASSERTION",lastMilestone:"PIN_FIELD_UNIQUE"});expect(diagnostic.state?.passwordFields).toBe(1);expect(diagnostic.stateAgeMs).toBeGreaterThanOrEqual(0);excluded(diagnostic);
 a.run=async()=>"<hierarchy></hierarchy>";try{await a.unlock(pin);}catch(e){expect(a.failure(e)).toMatchObject({predicate:"PIN_FIELD_UNIQUE",cause:"ANDROID_INPUT_NOT_UNIQUE"});}
});

it("keeps terminal child failure distinct when no process observation is available",async()=>{
 const a=new Android("source-only-adb","emulator-5580",root);a.run=async()=>{throw Error("QA_PROCESS_FAILED_OR_CANCELLED");};
 try{await a.unlock(pin);throw Error("unexpected-source-success");}catch(e){expect(a.failure(e)).toMatchObject({predicate:"UI_TREE_REMOVE",context:["PIN_FIELD_ACQUIRE","UI_TREE","UI_TREE_REMOVE"],kind:"CHILD_PROCESS",cause:"CHILD_EXECUTION_FAILED",child:null,state:null,stateAgeMs:null});excluded(a.failure(e));}
});

it("counts recovered UI acquisition separately without declaring a terminal failure",async()=>{
 vi.useFakeTimers();const a=new Android("source-only-adb","emulator-5580",root);let attempt=0;
 a.run=async(args:string[])=>{if(args.includes("cat"))return ++attempt===1?"invalid-secret-tree":"<hierarchy><node package=\"com.nalandaps.erp\" text=\"Workspace\"/></hierarchy>";return "";};
 const wait=a.text("Workspace");await vi.runAllTimersAsync();await wait;
 a.run=async()=>"<hierarchy></hierarchy>";
 const terminal=a.text("Recent drafts").catch(e=>a.failure(e));await vi.runAllTimersAsync();const diagnostic=await terminal;
 expect(diagnostic).toMatchObject({predicate:"STATE_RECENT_DRAFTS_WAIT",cause:"ANDROID_EXPECTED_ACCESSIBILITY_STATE_NOT_READY",acquisitionFailures:1,lastAcquisitionCause:"ANDROID_ACCESSIBILITY_TREE_INVALID",lastMilestone:"STATE_WORKSPACE_WAIT"});excluded(diagnostic);
});

it("distinguishes current wait acquisition exhaustion from prior successful trees",async()=>{
 vi.useFakeTimers();const a=new Android("source-only-adb","emulator-5580",root);
 a.run=async args=>args.includes("cat")?`<hierarchy><node package="${appId}" text="Workspace"/></hierarchy>`:"";await a.text("Workspace");
 a.run=async args=>args.includes("cat")?secret:"";
 const pending=a.text("Recent drafts").then(()=>{throw Error("unexpected-source-success");},e=>a.failure(e));await vi.runAllTimersAsync();const diagnostic=await pending;
 expect(diagnostic).toMatchObject({cause:"ANDROID_UI_ACQUISITION_EXHAUSTED",kind:"UI_ACQUISITION",successfulTrees:1});expect(diagnostic.waitObservation).toMatchObject({predicate:"STATE_RECENT_DRAFTS_WAIT",completed:false,successfulTrees:0,negativeObservations:0,lastAcquisition:{predicate:"UI_TREE_PARSE",cause:"ANDROID_ACCESSIBILITY_TREE_INVALID",kind:"UI_ACQUISITION",child:null}});expect(diagnostic.waitObservation?.acquisitionFailures).toBeGreaterThan(0);expect(diagnostic.stateAgeMs).toBeGreaterThanOrEqual(60000);excluded(diagnostic);
});

it("does not hide a recorder failure in acquisition polling or bounded control recovery",async()=>{
 for(const [code,cause] of [["QA_PROCESS_RETENTION_FAILED","PRIVATE_RETENTION_FAILED"],["QA_PROCESS_GROUP_UNRECONCILED","CHILD_GROUP_UNRECONCILED"]])for(const action of ["text","tap"] as const){const a=new Android("source-only-adb","emulator-5580",root);let calls=0;a.run=async()=>{calls++;throw Error(code);};try{await a[action]("Workspace");throw Error("unexpected-source-success");}catch(e){expect(a.failure(e).cause).toBe(cause);expect(calls).toBe(1);}}
});

it.each(["RECOVERED_READ","PERSISTENT_READ","RETENTION_FAILED","GROUP_UNRECONCILED","SHORT_UNLOCK_ENABLED"] as const)("preserves B assertions and finite acquisition behavior for %s",async condition=>{
 vi.useFakeTimers();const a=new Android("source-only-adb","emulator-5580",root);let postInput=false,reads=0,bPassed=false;
 const calls:string[][]=[];const initialTime=Date.now();
 const xml=(enabled=false)=>`<hierarchy><node package="${appId}" text="Welcome back"/><node package="${appId}" class="android.widget.EditText" password="true" bounds="[0,0][10,10]" text="${pin}"/><node package="${appId}" text="Unlock app" enabled="${enabled}"/></hierarchy>`;
 a.run=async args=>{
  calls.push(args);if(args.includes("KEYCODE_BACK"))postInput=true;
  if(!args.includes("cat"))return "";
  if(!postInput)return xml();reads++;
  if(condition==="RETENTION_FAILED")throw Error("QA_PROCESS_RETENTION_FAILED");
  if(condition==="GROUP_UNRECONCILED")throw Error("QA_PROCESS_GROUP_UNRECONCILED");
  if(condition==="PERSISTENT_READ"||(condition==="RECOVERED_READ"&&reads===1))throw Error("QA_PROCESS_FAILED_OR_CANCELLED");
  return xml(condition==="SHORT_UNLOCK_ENABLED");
 };
 // Execute the real B action through its unchanged journey ordering; no source-only double accepts C.
 const result=journey(a,pin,async(id,action)=>{if(id==="A-clean-launch")return;if(id!=="B-invalid-pin")throw Error("SOURCE_ONLY_STOP_BEFORE_C");a.beginScenario();await action();bPassed=true;})
  .then(()=>{throw Error("unexpected-source-success");},error=>({error,diagnostic:a.failure(error)}));
 await vi.runAllTimersAsync();const observed=await result;
 expect(calls.filter(args=>args.includes("text"))).toEqual([["shell","input","text","123"]]);
 expect(Date.now()-initialTime).toBeLessThanOrEqual(60000);excluded(observed.diagnostic);
 if(condition==="RECOVERED_READ"){
  expect(bPassed).toBe(true);expect(reads).toBe(2);expect(observed.error.message).toBe("SOURCE_ONLY_STOP_BEFORE_C");
  expect(calls.some(args=>args.includes("force-stop"))).toBe(true);
  expect(observed.diagnostic.waitObservation).toMatchObject({predicate:"B_SHORT_STATE_ACQUIRE",completed:true,successfulTrees:1,acquisitionFailures:1,lastAcquisition:{predicate:"UI_TREE_READ"}});
 }else{
  expect(bPassed).toBe(false);expect(calls.some(args=>args.includes("force-stop"))).toBe(false);
  if(condition==="PERSISTENT_READ"){
   expect(Date.now()-initialTime).toBe(60000);expect(observed.diagnostic).toMatchObject({predicate:"B_SHORT_STATE_ACQUIRE",cause:"ANDROID_UI_ACQUISITION_EXHAUSTED",kind:"UI_ACQUISITION"});
   expect(observed.diagnostic.waitObservation).toMatchObject({completed:false,successfulTrees:0,negativeObservations:0,lastAcquisition:{predicate:"UI_TREE_READ"}});expect(reads).toBeGreaterThan(1);
  }else if(condition==="SHORT_UNLOCK_ENABLED"){
   expect(reads).toBe(1);expect(observed.diagnostic).toMatchObject({predicate:"B_SHORT_UNLOCK_DISABLED",kind:"ASSERTION"});
  }else{
   expect(reads).toBe(1);expect(observed.diagnostic.cause).toBe(condition==="RETENTION_FAILED"?"PRIVATE_RETENTION_FAILED":"CHILD_GROUP_UNRECONCILED");
  }
 }
});

it("preserves actual closed child metadata even when its observer rejects retention",async()=>{
 // Node deliberately refuses the ADB-only argv; this is a source transport control, no native target.
 const a=new Android(process.execPath,"emulator-5580",root,()=>{throw Error(secret);});
 let error:unknown;try{await a.unlock(pin);}catch(e){error=e;}
 const diagnostic=a.failure(error);expect(diagnostic).toMatchObject({predicate:"UI_TREE_REMOVE",cause:"PRIVATE_RETENTION_FAILED",kind:"RETENTION",child:{closed:true}});expect(diagnostic.child?.exit).not.toBe(0);expect(diagnostic.child?.durationMs).toBeGreaterThanOrEqual(0);excluded(diagnostic);
});

it("keeps only private actual stream fingerprints while omitting both UI streams",()=>{
 const output=path.join(root,"omit-ui");mkdirSync(output);const capture=processRecorder(output),r=observation();capture.observe({...r,unknownField:secret} as ProducerProcessObservation);
 expect(readdirSync(output)).toEqual(["process-1.json"]);const metadata=JSON.parse(readFileSync(path.join(output,"process-1.json"),"utf8"));
 expect(metadata.rawRetention).toBe("OMITTED_UI_BOUNDARY");expect(metadata.stdoutBytes).toBe(r.stdout.length);expect(metadata.stderrBytes).toBe(r.stderr.length);expect(metadata.stdoutSha256).toBe(createHash("sha256").update(r.stdout).digest("hex"));expect(metadata.stderrSha256).toBe(createHash("sha256").update(r.stderr).digest("hex"));expect(JSON.stringify(metadata)).not.toContain(secret);expect(metadata).not.toHaveProperty("unknownField");excluded(capture.outcome(r.stage));
});

it("retains the original failure separately from a subsequent cleanup retention failure",()=>{
 const output=path.join(root,"cleanup-failure");mkdirSync(output);const capture=processRecorder(output);capture.observe(observation());const original=capture.failure();
 writeFileSync(path.join(output,"process-2.stdout"),"preserve-collision");expect(()=>capture.observe({...observation("android-uninstall"),exit:0})).toThrow("NATIVE_PRIVATE_PROCESS_RETENTION_FAILED");
 expect(original).toEqual({stage:"android-ui-command",cause:"CHILD_EXIT_FAILED"});expect(capture.failure()).toEqual({stage:"android-uninstall",cause:"PRIVATE_RETENTION_FAILED"});expect(capture.retained("android-uninstall")).toBe(false);expect(capture.outcome("android-uninstall")?.exit).toBe(0);excluded(capture.latest());
});

it("uses the actual evidence writer to fail final retention without overwriting bytes or original diagnostics",()=>{
 const output=path.join(root,"final-write");mkdirSync(output);writeFileSync(path.join(output,"evidence.json"),"preserved-owned-evidence");
 const original={operation:"IOS_COPIED_PACKAGE_DIGEST",cause:"IOS_TEST_TARGET_PACKAGE_SUBSTITUTED"};
 const retained=retainNativeEvidence(output,{original,unknownField:secret},false,"VERIFIED");
 const publicSummary={...retained,failure:original,cleanup:"VERIFIED"};expect(publicSummary).toMatchObject({status:"FAILED",evidenceRetention:"NATIVE_PRIVATE_OUTPUT_WRITE_FAILED",failure:original,cleanup:"VERIFIED"});expect(readFileSync(path.join(output,"evidence.json"),"utf8")).toBe("preserved-owned-evidence");excluded(publicSummary);
 const successRetention=retainNativeEvidence(output,{},true,"VERIFIED");expect(successRetention.status).toBe("FAILED");excluded(successRetention);
});

it("assigns simulator cleanup ownership only to canonical created identifiers",()=>{
 const valid="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";expect(ownedSimulatorId(valid)).toBe(valid);
 for(const id of ["all","booted","-".repeat(36),"a".repeat(36),valid+"\n",secret,hostPath])expect(()=>ownedSimulatorId(id)).toThrow("IOS_OWNED_TARGET_ID_INVALID");
});

it("preserves H's original failure while recording a separate restoration failure",async()=>{
 const a=new Android("source-only-adb","emulator-5580",root);const original=Error("ANDROID_SOFTWARE_KEYBOARD_NOT_SHOWN");a.preserveScenarioFailure(original);
 await a.restoreSettings(async()=>{throw Error("ANDROID_SETTING_RESTORE_FAILED");});expect(a.failure(Error(secret)).cause).toBe("ANDROID_SOFTWARE_KEYBOARD_NOT_SHOWN");expect(a.settingsRestoration()).toMatchObject({status:"UNRECONCILED",failure:{predicate:"H_SETTINGS_RESTORE",cause:"ANDROID_SETTING_RESTORE_FAILED"}});excluded(a.settingsRestoration());
});

it("does not run H restoration mutations after an unsettled child group",async()=>{
 const a=new Android("source-only-adb","emulator-5580",root);a.preserveScenarioFailure(Error("QA_PROCESS_GROUP_UNRECONCILED"));
 // Source-only injection of the existing observer latch; no child or target is started.
 (a as unknown as {unsettled:boolean}).unsettled=true;const mutations=vi.fn(async()=>{});await a.restoreSettings(mutations);expect(mutations).not.toHaveBeenCalled();expect(a.settingsRestoration().status).toBe("UNRECONCILED");expect(a.failure(Error(secret)).cause).toBe("CHILD_GROUP_UNRECONCILED");excluded(a.settingsRestoration());
});

it("projects actual nonzero child timeout through the unchanged optional observer",async()=>{
 const output=path.join(root,"actual-timeout");mkdirSync(output);const capture=processRecorder(output);
 await expect(producerProcess({stage:"android-ui-command",tool:process.execPath,args:["-e",`process.stdout.write(${JSON.stringify(secret)});setInterval(()=>{},100)`],timeoutMs:100},root,undefined,capture.observe)).rejects.toThrow("QA_PROCESS_FAILED_OR_CANCELLED");
 expect(capture.outcome("android-ui-command")).toMatchObject({timedOut:true,cancelled:false,closed:true});expect(capture.failure()?.cause).toBe("CHILD_TIMEOUT");expect(readdirSync(output)).toEqual(["process-1.json"]);excluded(capture.outcome("android-ui-command"));
});

it("projects the first diagnostic in each stream without disclosing compiler fragments",()=>{
 const result=appleBuild(streams(`SwiftCompile normal arm64\n${source.absolutePath}:48:9: error: cannot find '${secret}' in scope\n${source.absolutePath}:60:1: error: no such module 'XCTest'`),streams(`error: ${secret} ${pin} ${hostPath}`),source);
 expect(result.ordering).toBe("PER_STREAM_ONLY");expect(result.stdout.firstDiagnostic).toEqual({stage:"SWIFT_COMPILE",category:"SWIFT_SYMBOL_UNAVAILABLE",location:{path:swiftSource,line:48,column:9}});expect(result.stderr.firstDiagnostic?.category).toBe("UNKNOWN");excluded(result);
 const unknown=appleBuild(streams(`error: ${secret}\nerror: no such module 'XCTest'`),Buffer.alloc(0),source);expect(unknown.stdout.firstDiagnostic?.category).toBe("UNKNOWN");
});

it("refuses foreign, traversal, out-of-range and unapproved source locations",()=>{
 for(const location of [`${hostPath}/untracked.swift:1:1`,`${source.absolutePath}/../NativeJourney.swift:1:1`,`${source.absolutePath}:0:1`,`${source.absolutePath}:161:1`])expect(appleBuild(streams(`${location}: error: no such module 'XCTest'`),Buffer.alloc(0),source).stdout.firstDiagnostic?.location).toBe(null);
 expect(appleBuild(streams(`${source.absolutePath}:10:2: error: no such module 'XCTest'`),Buffer.alloc(0),{...source,relativePath:"unapproved.swift"} as unknown as PublicSource).stdout.firstDiagnostic?.location).toBe(null);
});

it("localizes silent copy failure using only fixed operation markers",()=>{
 const result=appleBuild(streams(`NALANDA_NATIVE_COPY:BEGIN:SOURCE\nNALANDA_NATIVE_COPY:PASS:SOURCE\nNALANDA_NATIVE_COPY:BEGIN:DESTINATION\nNALANDA_NATIVE_COPY:FAIL:DESTINATION\nerror: Command PhaseScriptExecution failed with a nonzero exit code`),streams(secret),source);
 expect(result.stdout.firstDiagnostic).toEqual({stage:"COPY_SCRIPT",category:"COPY_DESTINATION_FAILED",location:null});expect(result.stdout.copy).toHaveLength(4);excluded(result);
});

const markerStream=(ids:readonly string[])=>streams(ids.flatMap(id=>[`NALANDA_NATIVE_SCENARIO:BEGIN:${id}`,`NALANDA_NATIVE_SCENARIO:PASS:${id}`]).join("\n"));
it("requires original ordered A/B/C/F/D/E/G/H markers plus actual process success",()=>{
 const full=appleScenarioMarkers(markerStream(nativeScenarios),Buffer.alloc(0),true);expect(full.status).toBe("OBSERVED");expect(full.scenarios.map(r=>r.scenario)).toEqual(nativeScenarios);expect(full.scenarios.every(r=>r.assertion==="PASS")).toBe(true);
 const partial=appleScenarioMarkers(streams(markerStream(nativeScenarios.slice(0,2)).toString()+`\nNALANDA_NATIVE_SCENARIO:BEGIN:${nativeScenarios[2]}`),Buffer.alloc(0),false);expect(partial.scenarios.map(r=>r.assertion)).toEqual(["PASS","PASS","NOT_COMPLETED"]);
 expect(appleScenarioMarkers(markerStream(nativeScenarios.slice(0,2)),Buffer.alloc(0),true).status).toBe("MISSING_REQUIRED_MARKERS");
 for(const ids of [[nativeScenarios[1],nativeScenarios[0]],[nativeScenarios[0],nativeScenarios[0]]])expect(appleScenarioMarkers(markerStream(ids),Buffer.alloc(0),false).status).toBe("INVALID_PROTOCOL");
 expect(appleScenarioMarkers(markerStream([nativeScenarios[0]]),markerStream([nativeScenarios[1]]),false).status).toBe("UNAVAILABLE_CROSS_STREAM_ORDER");expect(appleScenarioMarkers(streams(`NALANDA_NATIVE_SCENARIO:${secret}`),Buffer.alloc(0),false).scenarios).toEqual([]);
});

it.each([
 ["PIN_UNIQUE","PIN_FIELD_UNIQUE"], ["PIN_FOCUS","PIN_FIELD_FOCUS"], ["PIN_TEXT","PIN_INPUT"], ["PIN_BACK","PIN_IME_DISMISS"],
 ["UNLOCK_MISSING","CONTROL_UNLOCK_RESOLVE"], ["UNLOCK_DISABLED","CONTROL_UNLOCK_RESOLVE"], ["UNLOCK_TAP","CONTROL_UNLOCK_ACTIVATE"],
 ["WORKSPACE_MISSING","STATE_WORKSPACE_WAIT"], ["WORKSPACE_TAP","CONTROL_WORKSPACE_ACTIVATE"],
 ["RECENT_MISSING","STATE_RECENT_DRAFTS_WAIT"], ["QUEUE_MISSING","STATE_EMPTY_QUEUE_WAIT"], ["BANNER_MISSING","STATE_NO_REMOTE_BANNER_WAIT"],
])("localizes C source-only failure %s to %s",async(condition,predicate)=>{
 vi.useFakeTimers();const a=new Android("source-only-adb","emulator-5580",root);a.beginScenario();
 const xml=()=>`<hierarchy><node package="${appId}" class="android.webkit.WebView" bounds="[0,0][100,100]"/>`+
  (condition==="PIN_UNIQUE"?"":`<node package="${appId}" class="android.widget.EditText" password="true" bounds="[0,0][10,10]" text="${pin}"/>`)+
  (condition==="UNLOCK_MISSING"?"":`<node package="${appId}" text="Unlock app" clickable="true" enabled="${condition==="UNLOCK_DISABLED"?"false":"true"}" bounds="[20,0][30,10]"/>`)+
  (condition==="WORKSPACE_MISSING"?"":`<node package="${appId}" text="Workspace" clickable="true" enabled="true" bounds="[40,0][50,10]"/>`)+
  (condition==="RECENT_MISSING"?"":`<node package="${appId}" text="Recent drafts"/>`)+
  (condition==="QUEUE_MISSING"?"":`<node package="${appId}" text="0 items"/>`)+
  (condition==="BANNER_MISSING"?"":`<node package="${appId}" text="No remote server is configured."/>`)+"</hierarchy>";
 a.run=async args=>{
  if(args.includes("cat"))return xml();
  const tap=args[1]==="input"&&args[2]==="tap"?args[3]:null;
  if((condition==="PIN_FOCUS"&&tap==="5")||(condition==="PIN_TEXT"&&args[2]==="text")||(condition==="PIN_BACK"&&args.includes("KEYCODE_BACK"))||(condition==="UNLOCK_TAP"&&tap==="25")||(condition==="WORKSPACE_TAP"&&tap==="45"))throw Error("QA_PROCESS_FAILED_OR_CANCELLED");
  return "";
 };
 const result=(async()=>{try{await a.unlock(pin);await a.text("0 items");await a.text("No remote server is configured.");return null;}catch(e){return a.failure(e);}})();
 await vi.runAllTimersAsync();const diagnostic=await result;expect(diagnostic?.predicate).toBe(predicate);excluded(diagnostic);
 if(["WORKSPACE_MISSING","RECENT_MISSING","QUEUE_MISSING","BANNER_MISSING"].includes(condition)){expect(diagnostic?.negativePredicateObservations).toBeGreaterThan(0);expect(diagnostic?.successfulTrees).toBeGreaterThan(0);expect(diagnostic?.acquisitionFailures).toBe(0);}
});

it.each([[0,0,0],[1,0,1],[0,1,1],[1,1,1]])("executes both independent Apple targets and preserves aggregate exit (%i,%i)", (phone,tablet,expected)=>{
 const bash=process.platform==="win32"?"C:\\Program Files\\Git\\bin\\bash.exe":"/bin/bash";expect(existsSync(bash)).toBe(true);
 const workflow=readFileSync(".github/workflows/cross-platform-apps.yml","utf8");const loop=workflow.match(/          native_status=0\r?\n[\s\S]*?          exit "\$native_status"/)?.[0];expect(loop).toBeTruthy();
 const target=path.join(root,`apple-loop-${phone}-${tablet}`);mkdirSync(path.join(target,"tmp/platform-review"),{recursive:true});
 const fake=`set -euo pipefail\nAPP_PATH=source-only.app\nAPP_SHA=source-only\nRUNNER_TEMP=source-only\nnode() {\n local kind=unknown\n while (( $# )); do\n  if [[ "$1" == "--target-kind" ]]; then kind="$2"; break; fi\n  shift\n done\n printf '%s\\n' "$kind" >> attempts\n printf '{"sourceOnly":true}\\n'\n if [[ "$kind" == "phone" ]]; then return ${phone}; fi\n if [[ "$kind" == "tablet" ]]; then return ${tablet}; fi\n return 99\n}\n`;
 const result=spawnSync(bash,["--noprofile","--norc","-c",fake+loop],{cwd:target,encoding:"utf8",timeout:5000,windowsHide:true});
 expect(result.error).toBeUndefined();expect(result.status).toBe(expected);expect(readFileSync(path.join(target,"attempts"),"utf8").trim().split(/\r?\n/)).toEqual(["phone","tablet"]);expect(result.stdout.trim().split(/\r?\n/)).toHaveLength(2);
});

it("drops unknown process/identity/version fields and arbitrary signal/version strings",()=>{
 const safe=processMetadata({...observation(),signal:secret,unknownField:secret} as ProducerProcessObservation);expect(safe.signal).toBe("UNKNOWN");excluded(safe);
 const identity=nativeIdentity({source:"a".repeat(40),tree:"b".repeat(40),packageHash:"c".repeat(64),run:"37217435807",attempt:"1",unknownField:secret} as Parameters<typeof nativeIdentity>[0]);expect(identity.run).toBe(37217435807);excluded(identity);
 expect(nativeVersions(`Android Debug Bridge version 1.0.41\n${hostPath}`,`Xcode 16.2\nBuild version ${secret}`,"18.2")).toEqual({adb:"1.0.41",xcode:"16.2",iosRuntime:"18.2",application:"0.1.0"});excluded(nativeVersions(secret,hostPath,pin));
});
