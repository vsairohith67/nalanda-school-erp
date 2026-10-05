import assert from "node:assert/strict";
import { producerProcess, type ProducerProcessObserver } from "../../../../scripts/portable/producer-process";
import { androidState, androidCause, childCause, controlKey, stateKey, processMetadata } from "./diagnostics";

type AcquisitionFailure = {predicate:string;cause:string;kind:string;child:ReturnType<typeof processMetadata>|null};
type WaitObservation = {predicate:string;completed:boolean;successfulTrees:number;negativeObservations:number;acquisitionFailures:number;lastAcquisition:AcquisitionFailure|null};
type Failure = {predicate:string; context:string[]; cause:string; kind:"ASSERTION"|"UI_ACQUISITION"|"CHILD_PROCESS"|"RETENTION"; elapsedMs:number; lastMilestone:string|null; child:ReturnType<typeof processMetadata>|null; state:ReturnType<typeof androidState>|null; stateAgeMs:number|null; acquisitionFailures:number; lastAcquisitionCause:string|null;lastAcquisition:AcquisitionFailure|null;successfulTrees:number;negativePredicateObservations:number;waitObservation:WaitObservation|null};
class AndroidFailure extends Error {
  constructor(readonly diagnostic:Failure) {super("ANDROID_FINITE_PREDICATE_FAILED");}
}
type NamedPredicate="B_EMPTY_UNLOCK_DISABLED"|"B_SHORT_STATE_ACQUIRE"|"B_SHORT_UNLOCK_DISABLED"|"F_REMOTE_DISABLED"|"F_REFERENCE_DISABLED"|"H_FONT_SCALE_APPLIED"|"H_PIN_FIELD_READY"|"H_IME_VISIBLE"|"H_ORIGINAL_SETTING_VALID"|"H_SETTING_RESTORED";

export const appId = "com.nalandaps.erp";
export type UiNode = Record<string, string>;
export function nodes(xml: string): UiNode[] {
  assert(xml.length < 2_000_000 && xml.includes("<hierarchy"), "ANDROID_ACCESSIBILITY_TREE_INVALID");
  const decode = (s: string) => s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  return [...xml.matchAll(/<node\s+([^>]+)>/g)].map(m => Object.fromEntries([...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(a => [a[1], decode(a[2])])));
}
export function center(node: UiNode) {
  const b = node.bounds?.match(/^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/);
  assert(b, "ANDROID_CONTROL_BOUNDS_INVALID");
  const [x, y, right, bottom] = b.slice(1).map(Number);
  assert(right > x && bottom > y, "ANDROID_CONTROL_NOT_VISIBLE");
  return [Math.floor((x + right) / 2), Math.floor((y + bottom) / 2)].map(String);
}
export function control(tree: UiNode[], label: string) {
  const matches = tree.filter(n => n.package === appId && (n.text === label || n["content-desc"] === label));
  const actionable = matches.filter(n => n.clickable === "true");
  assert.equal(actionable.length, 1, "ANDROID_CONTROL_NOT_UNIQUE");
  assert.equal(actionable[0].enabled, "true", "ANDROID_CONTROL_DISABLED");
  return actionable[0];
}
/** Actual ADB accessibility/input adapter. No WebView injection or invoke mock. */
export class Android {
  private milestone:string|null=null;
  private cached: {value:ReturnType<typeof androidState>; at:number}|null=null;
  private acquisitionFailures=0;
  private acquisitionCause:string|null=null;
  private lastAcquisition:AcquisitionFailure|null=null;
  private successfulTrees=0;
  private negativePredicateObservations=0;
  private waitObservation:WaitObservation|null=null;
  private lastChild:ReturnType<typeof processMetadata>|null=null;
  private lastChildCause:string|null=null;
  private scenarioStarted=Date.now();
  private context:string[]=[];
  private unsettled=false;
  private preservedScenarioFailure:Failure|null=null;
  private settingsRestore:{status:"NOT_EXECUTED"|"VERIFIED"|"UNRECONCILED";failure:Failure|null}={status:"NOT_EXECUTED",failure:null};
  beginScenario() {this.scenarioStarted=Date.now();this.milestone=null;this.acquisitionFailures=0;this.acquisitionCause=null;this.lastAcquisition=null;this.successfulTrees=0;this.negativePredicateObservations=0;this.waitObservation=null;this.preservedScenarioFailure=null;}
  failure(error:unknown):Failure {
    if(this.preservedScenarioFailure)return this.preservedScenarioFailure;
    if(error instanceof AndroidFailure)return error.diagnostic;
    return this.diagnostic("SCENARIO_ASSERTION",error);
  }
  preserveScenarioFailure(error:unknown) {this.preservedScenarioFailure=this.failure(error);}
  settingsRestoration() {return this.settingsRestore;}
  async restoreSettings(action:()=>Promise<void>) {
    if(this.unsettled){const failure=this.diagnostic("H_SETTINGS_RESTORE",Error("QA_PROCESS_GROUP_UNRECONCILED"));this.settingsRestore={status:"UNRECONCILED",failure};if(!this.preservedScenarioFailure)throw new AndroidFailure(failure);return;}
    try{await action();this.settingsRestore={status:"VERIFIED",failure:null};}
    catch(error){const failure=error instanceof AndroidFailure?error.diagnostic:this.diagnostic("H_SETTINGS_RESTORE",error);this.settingsRestore={status:"UNRECONCILED",failure};if(!this.preservedScenarioFailure)throw new AndroidFailure(failure);}
  }
  private diagnostic(predicate:string,error:unknown):Failure {
    const cause=androidCause(error), process=cause.startsWith("CHILD_")||cause==="PRIVATE_RETENTION_FAILED"?this.lastChild:null;
    return {predicate,context:[...this.context],cause:cause==="PRIVATE_RETENTION_FAILED"?cause:process?this.lastChildCause??cause:cause,kind:cause==="PRIVATE_RETENTION_FAILED"?"RETENTION":cause.startsWith("CHILD_")?"CHILD_PROCESS":cause==="ANDROID_UI_ACQUISITION_EXHAUSTED"||predicate.includes("ACQUIRE")||predicate.startsWith("UI_TREE")?"UI_ACQUISITION":"ASSERTION",elapsedMs:Date.now()-this.scenarioStarted,lastMilestone:this.milestone,child:process,state:this.cached?.value??null,stateAgeMs:this.cached?Date.now()-this.cached.at:null,acquisitionFailures:this.acquisitionFailures,lastAcquisitionCause:this.acquisitionCause,lastAcquisition:this.lastAcquisition,successfulTrees:this.successfulTrees,negativePredicateObservations:this.negativePredicateObservations,waitObservation:this.waitObservation?{...this.waitObservation}:null};
  }
  private async step<T>(predicate:string, action:()=>T|Promise<T>):Promise<T> {
    this.context.push(predicate);
    try {const result=await action();if(!predicate.startsWith("UI_TREE"))this.milestone=predicate;return result;}
    catch(error){throw error instanceof AndroidFailure?error:new AndroidFailure(this.diagnostic(predicate,error));}
    finally {this.context.pop();}
  }
  check<T>(predicate:NamedPredicate,action:()=>T|Promise<T>){return this.step(predicate,action);}
  private fatal(error:unknown) {return ["PRIVATE_RETENTION_FAILED","CHILD_GROUP_UNRECONCILED"].includes(error instanceof AndroidFailure?error.diagnostic.cause:androidCause(error));}
  constructor(readonly adb: string, readonly serial: string, readonly workspace: string, readonly observer?: ProducerProcessObserver) {
    assert(/^emulator-\d{4,5}$/.test(serial), "ANDROID_DISPOSABLE_EMULATOR_REQUIRED");
  }
  run(args: string[]) {
    const stage = args[0] === "install" ? "android-install" : args[0] === "uninstall" ? "android-uninstall" : "android-ui-command";
    return producerProcess({ stage, tool: this.adb, args: ["-s", this.serial, ...args], timeoutMs: 30_000 }, this.workspace, undefined, r=>{this.lastChild=processMetadata(r);this.lastChildCause=childCause(r);this.unsettled ||=r.terminationFailed===true;return this.observer?.(r);}).catch(error=>{if(androidCause(error)==="CHILD_GROUP_UNRECONCILED")this.unsettled=true;throw error;});
  }
  async tree() {
    return this.step("UI_TREE",async()=>{
      await this.step("UI_TREE_REMOVE",()=>this.run(["shell", "rm", "-f", "/sdcard/nalanda-native-1b.xml"]));
      await this.step("UI_TREE_DUMP",()=>this.run(["shell", "uiautomator", "dump", "/sdcard/nalanda-native-1b.xml"]));
      const xml=await this.step("UI_TREE_READ",()=>this.run(["shell", "cat", "/sdcard/nalanda-native-1b.xml"]));
      const tree=await this.step("UI_TREE_PARSE",()=>nodes(xml));
      this.cached={value:androidState(tree),at:Date.now()};this.successfulTrees=Math.min(1000,this.successfulTrees+1);return tree;
    });
  }
  async wait(check: (tree: UiNode[]) => boolean,predicate="GENERIC_WAIT") {
    const observed:WaitObservation={predicate,completed:false,successfulTrees:0,negativeObservations:0,acquisitionFailures:0,lastAcquisition:null};this.waitObservation=observed;
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      try { const tree = await this.tree();observed.successfulTrees=Math.min(1000,observed.successfulTrees+1);if (check(tree)) {observed.completed=true;return tree;}this.negativePredicateObservations=Math.min(1000,this.negativePredicateObservations+1);observed.negativeObservations=Math.min(1000,observed.negativeObservations+1); }
      catch(error) {if(this.fatal(error))throw error;this.acquisitionFailures=Math.min(1000,this.acquisitionFailures+1);const diagnostic=this.failure(error);this.acquisitionCause=diagnostic.cause;this.lastAcquisition={predicate:diagnostic.predicate,cause:diagnostic.cause,kind:diagnostic.kind,child:diagnostic.child};observed.acquisitionFailures=Math.min(1000,observed.acquisitionFailures+1);observed.lastAcquisition=this.lastAcquisition;}
      await new Promise(r => setTimeout(r, 500));
    }
    if(observed.successfulTrees===0 && observed.acquisitionFailures>0)throw Error("ANDROID_UI_ACQUISITION_EXHAUSTED");
    throw Error("ANDROID_EXPECTED_ACCESSIBILITY_STATE_NOT_READY");
  }
  has(tree: UiNode[], text: string) { return tree.some(n => n.package === appId && (n.text?.includes(text) || n["content-desc"]?.includes(text))); }
  async text(text: string) {const predicate=`STATE_${stateKey(text)}_WAIT`;return this.step(predicate,()=>this.wait(t => this.has(t, text),predicate));}
  async tap(label: string) {
    const key=controlKey(label);
    let tree=await this.step(`CONTROL_${key}_ACQUIRE`,()=>this.tree());
    for(let i=0;i<4;i++) {
      try {const n=await this.step(`CONTROL_${key}_RESOLVE`,()=>control(tree,label));const bounds=await this.step(`CONTROL_${key}_BOUNDS`,()=>center(n));await this.step(`CONTROL_${key}_ACTIVATE`,()=>this.run(["shell","input","tap",...bounds]));return;} catch(error) {
        if(this.fatal(error)||i===3)throw error;
        // Scroll within this foreground app using the observed root bounds.
        tree=await this.step(`CONTROL_${key}_SCROLL_RECOVERY`,async()=>{const root=tree.find(n=>n.package===appId && n.class==="android.webkit.WebView"); assert(root,"ANDROID_APP_WEBVIEW_MISSING");
        const [x,y]=center(root).map(Number);const direction=i===2?-1:1; await this.run(["shell","input","swipe",String(x),String(Math.max(1,y+100*direction)),String(x),String(Math.max(1,y-150*direction)),"300"]);return this.tree();});
      }
    }
  }
  async input(value: string, password = false, label?: string) {
    const key=password?"PIN":label==="e.g. April fee · NPS-1042"?"DRAFT_PURPOSE":label==="0.00"?"DRAFT_AMOUNT":"RESET_CONFIRMATION";
    await this.step(`${key}_INPUT_VALIDATE`,()=>assert(/^[\w %.-]{1,120}$/.test(value), "ANDROID_TEST_INPUT_INVALID"));
    const tree = await this.step(`${key}_FIELD_ACQUIRE`,()=>this.tree());
    const fields = tree.filter(n => n.package === appId && n.class === "android.widget.EditText" && (password ? n.password === "true" : n.password !== "true") && (!label || n.text === label || n["content-desc"] === label || n.hint === label));
    await this.step(`${key}_FIELD_UNIQUE`,()=>assert.equal(fields.length, 1, "ANDROID_INPUT_NOT_UNIQUE"));
    const bounds=await this.step(`${key}_FIELD_BOUNDS`,()=>center(fields[0]));
    await this.step(`${key}_FIELD_FOCUS`,()=>this.run(["shell", "input", "tap", ...bounds]));
    await this.step(`${key}_INPUT`,()=>this.run(["shell", "input", "text", value.replaceAll(" ", "%s")]));
    await this.step(`${key}_IME_DISMISS`,()=>this.run(["shell", "input", "keyevent", "KEYCODE_BACK"])); // dismiss actual IME
  }
  async launch() {
    const result = await this.run(["shell", "am", "start", "-W", "-n", `${appId}/.MainActivity`]);
    assert(!/Error:|Exception/.test(result), "ANDROID_ACTIVITY_LAUNCH_REFUSED");
  }
  async locked() {
    const t = await this.text("Welcome back");
    for (const forbidden of ["April fee", "Science lab supplies", "Hall booking", "Recent drafts"]) assert(!this.has(t, forbidden), "ANDROID_LOCKED_CONTENT_LEAK");
    return t;
  }
  async unlock(pin: string) { await this.input(pin, true); await this.tap("Unlock app"); await this.text("Workspace"); await this.tap("Workspace"); await this.text("Recent drafts"); }
}

export async function journey(a: Android, pin: string, record: (id: string, action: () => Promise<void>) => Promise<void>) {
  await record("A-clean-launch", async () => { await a.launch(); await a.locked(); await a.text("NO REMOTE SERVER CONFIGURED"); await a.text("App 0.1.0"); });
  await record("B-invalid-pin", async () => {
    const t = await a.locked();
    await a.check("B_EMPTY_UNLOCK_DISABLED",()=>assert(t.some(n => n.package === appId && (n.text === "Unlock app" || n["content-desc"] === "Unlock app") && n.enabled === "false")));
    await a.input("123", true);
    const invalid = await a.check("B_SHORT_STATE_ACQUIRE",()=>a.wait(()=>true,"B_SHORT_STATE_ACQUIRE"));
    await a.check("B_SHORT_UNLOCK_DISABLED",()=>assert(invalid.some(n => n.package === appId && (n.text === "Unlock app" || n["content-desc"] === "Unlock app") && n.enabled === "false")));
    await a.run(["shell", "am", "force-stop", appId]); await a.launch(); // empty PIN after real cold start
  });
  await record("C-local-vault-empty", async () => { await a.unlock(pin); await a.text("0 items"); await a.text("No remote server is configured."); });
  await record("F-remote-reference-draft-refusal", async () => {
    await a.tap("Security");
    const t = await a.text("No remote server configured");
    for (const label of ["No remote server configured", "Download encrypted reference data"]) await a.check(label==="No remote server configured"?"F_REMOTE_DISABLED":"F_REFERENCE_DISABLED",()=>assert(t.some(n => n.package === appId && (n.text === label || n["content-desc"] === label) && n.enabled === "false")));
    await a.tap("Workspace");
    // Use ordinary visible fields only; missing references must refuse this draft.
    await a.input("Synthetic purpose", false, "e.g. April fee · NPS-1042");
    await a.input("1.00", false, "0.00");
    await a.tap("Save encrypted draft");
    await a.text("Connect once and download current reference data before creating an offline draft."); await a.text("0 items");
  });
  await record("D-explicit-lock-and-os-background", async () => {
    await a.tap("Lock"); await a.locked(); await a.unlock(pin);
    await a.run(["shell", "input", "keyevent", "KEYCODE_HOME"]); await a.launch(); await a.locked(); await a.unlock(pin);
  });
  await record("E-cold-restart-wrong-pin", async () => {
    await a.run(["shell", "am", "force-stop", appId]); await a.launch(); await a.locked();
    await a.input(pin === "31415926" ? "27182818" : "31415926", true); await a.tap("Unlock app"); await a.text("App PIN was not accepted."); await a.locked();
    // Relaunch clears the typed field, not the genuine failed-attempt counter.
    await a.run(["shell", "am", "force-stop", appId]); await a.launch(); await a.unlock(pin);
  });
  await record("G-reset-cancel-confirm", async () => {
    await a.tap("Security"); await a.tap("Reset app data"); await a.tap("Cancel"); await a.text("Reset app data");
    await a.tap("Lock"); await a.locked(); await a.unlock(pin); // cancellation preserved the vault
    await a.tap("Security"); await a.tap("Reset app data"); await a.input("ERASE LOCAL DRAFTS"); await a.tap("Erase this app's local data"); await a.locked();
    const replacement=pin === "31415926" ? "27182818" : "31415926";
    await a.unlock(replacement); await a.text("0 items"); // unlock awaits the real reset barrier
    await a.run(["shell", "am", "force-stop", appId]); await a.launch(); await a.unlock(replacement); await a.text("0 items");
  });
  await record("H-platform-accessibility-layout",async()=>{
    await a.tap("Lock");await a.locked();
    const keys=[["system","accelerometer_rotation"],["system","user_rotation"],["system","font_scale"]];
    const original:string[]=[];for(const k of keys)original.push(await a.run(["shell","settings","get",...k]));
    try {
      await a.run(["shell","settings","put","system","accelerometer_rotation","0"]);
      await a.run(["shell","settings","put","system","user_rotation","1"]);await a.locked();
      await a.run(["shell","settings","put","system","font_scale","1.3"]);
      await a.check("H_FONT_SCALE_APPLIED",async()=>assert((await a.run(["shell","settings","get","system","font_scale"])).trim()==="1.3"));await a.locked();
      const candidate=(await a.tree()).find(n=>n.package===appId&&n.password==="true");const field=await a.check("H_PIN_FIELD_READY",()=>{assert(candidate);return candidate;});
      await a.run(["shell","input","tap",...center(field)]);
      const ime=await a.run(["shell","dumpsys","input_method"]);await a.check("H_IME_VISIBLE",()=>assert(/mInputShown=true|mIsInputViewShown=true/.test(ime),"ANDROID_SOFTWARE_KEYBOARD_NOT_SHOWN"));
      await a.run(["shell","input","keyevent","KEYCODE_BACK"]);await a.locked();
      await a.run(["shell","input","keyevent","KEYCODE_BACK"]);await a.launch();await a.locked();
    } catch(error){a.preserveScenarioFailure(error);throw error;} finally {
      await a.restoreSettings(async()=>{for(let i=0;i<keys.length;i++) {
        const v=original[i].trim();await a.check("H_ORIGINAL_SETTING_VALID",()=>assert(v==="null"||/^[\d.]+$/.test(v),"ANDROID_ORIGINAL_SETTING_INVALID"));
        await a.run(v==="null"?["shell","settings","delete",...keys[i]]:["shell","settings","put",...keys[i],v]);
        await a.check("H_SETTING_RESTORED",async()=>assert((await a.run(["shell","settings","get",...keys[i]])).trim()===v,"ANDROID_SETTING_RESTORE_FAILED"));
      }});
    }
  });
}
