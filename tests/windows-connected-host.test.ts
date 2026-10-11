import {createHash} from "node:crypto";
import {beforeEach,it,expect,vi} from "vitest";
import {windowsTarget} from "./fixtures/windows-auth";
// UNIT_OR_CONTRACT. OS, SSH, trust, WebDriver and serving transport are doubles.
// The real host factory, its preparation sequence and cleanup control flow run.
const h=vi.hoisted(()=>({events:[] as string[],fault:"",target:null as any,instance:null as any,app:null as any,journey:null as any,rows:[] as any[],parents:[] as any[],records:new Map<number,any>(),pending:0,readback:null as any,original:""}));
const hit=(name:string)=>{h.events.push(name);if(h.fault===name)throw Error("PRIVATE_FAILURE_NOT_FOR_PUBLIC_OUTPUT");};
vi.mock("node:fs",async original=>({...await original<typeof import("node:fs")>(),writeFileSync:()=>hit("evidence-write")}));
vi.mock("../scripts/portable/native-launch-admission",()=>({admitWindowsNativeLaunch:async()=>{hit("admit");return {verifyFiles:()=>hit("verify-files")};}}));
vi.mock("../scripts/portable/native-qa-profile",()=>({validateNativeQaProfile:()=>({origin:h.target.origin,databaseSha256:"d".repeat(64),nativeBuildId:"fixture"})}));
vi.mock("../scripts/portable/windows-qa-trust",()=>({createWindowsQaTrust:()=>({prepare:()=>hit("trust-prepare"),verify:()=>hit("trust-verify"),cleanup:()=>hit("trust-cleanup")})}));
vi.mock("../scripts/portable/windows-forwarding",()=>({OwnedWindowsApplicationForward:class{async start(){hit("forward-start");}async bind(){hit("forward-bind");}async cleanup(){hit("forward-cleanup");}}}));
vi.mock("../scripts/portable/windows-process-observer",async original=>({...await original<typeof import("../scripts/portable/windows-process-observer")>(),OwnedWindowsProcessObserver:class{async start(){hit("observer-start");}events(){return h.rows;}async cleanup(){hit("observer-cleanup");}}}));
vi.mock("../scripts/portable/windows-observation",async original=>({...await original<typeof import("../scripts/portable/windows-observation")>(),readNativeObservation:(_t:any,p:any)=>h.records.get(p.pid),pendingNativeObservation:(_t:any,p:any)=>{hit("pending-journal");return h.pending-->0?null:h.records.get(p.pid);},checkEarlyWindowsPrivacy:async()=>hit("early-observer")}));
vi.mock("../scripts/portable/windows-webdriver-host",()=>({
 assertWindowsFile:()=>{},privateWindowsOs:(i:any)=>{hit(i.operation);if(i.operation==="processes")return h.rows.map(e=>({...h.instance,pid:e.pid,created:e.at}));return {state:i.operation==="profile-claim"?"FRESH_PROFILES_CLAIMED":"OWNED_PROFILES_REMOVED"};},
 OwnedWindowsWebDriver:class{
  async preflight(){hit("preflight");}async verifyCallbackEnvironment(){hit("callback-environment");}async closeForCallback(){hit("cold-stop");}async attachCold(p:any){hit("cold-attach");return {app:h.app,instance:p};}async start(){hit("driver-start");return {app:h.app,browser:{command:async()=>hit("cancel-bootstrap")},instance:h.instance};}
  async bind(){hit("driver-bind");}async background(){hit("background");}async original(){return h.original;}
  browserProcesses(){return h.parents;}currentBrowserProcesses(){return h.parents;}async cleanup(){hit("driver-cleanup");}
 }
}));
vi.mock("../scripts/portable/windows-private-transport",()=>({validateWindowsPrivateTransport:()=>{},createPrivateWindowsChannel:()=>({native:()=>({context:{trust:{},profile:{}}})}),createPrivateWindowsServerPorts:()=>({
 prepare:async()=>{hit("fixture-prepare");return {userId:"subject",password:"p".repeat(48),expectedStudents:["SYNTHETIC-private"],username:"synthetic",databaseIdentitySha256:"d".repeat(64)};},
 observe:()=>{},read:async()=>h.readback,prepareControl:async()=>hit("control-prepare"),cleanupGoverned:async()=>hit("server-cleanup"),clear:()=>hit("server-clear")
})}));
vi.mock("../scripts/portable/windows-auth-lifecycle",async original=>{
 const actual=await original<typeof import("../scripts/portable/windows-auth-lifecycle")>();
 return {...actual,runWindowsAuthentication:async(host:any)=>{
  hit("journey");
  for(const name of ["admit","launch","bind","observeOriginalAuthorization","totp","read","approvePendingDevice","revokeSession","beforeCallbackLaunch","observeCallback","assertCallbackProcessed","closeForCallback","observeColdCallback","restart","background","foreground","assertProfilePreserved","cleanup"])expect(typeof host[name]).toBe("function");
  if(h.journey)await h.journey(host);
  await host.cleanup();return {evidenceClass:"HARNESS_FIXTURE_ONLY"};
 }};
});
import {createConnectedWindowsHost,parseWindowsConnectedInput} from "../scripts/portable/windows-connected-host";
beforeEach(()=>{vi.unstubAllEnvs();h.target=windowsTarget();h.instance={pid:77,created:"2026-09-30T00:00:00Z",executable:h.target.executable,sha256:h.target.artifactSha256,userSid:h.target.userSid};h.events=[];h.fault="";h.journey=null;h.rows=[];h.pending=0;h.parents=[{...h.instance,pid:33,executable:"C:\\qa\\edge.exe"}];h.readback={requestStatus:"CONSUMED",sessionId:"session",sessionRevoked:false,mfaEvidence:{status:"VERIFIED"}};
 h.original=h.target.origin+"/native/authorize?request=00000000-0000-4000-8000-000000000001&state="+"s".repeat(43)+"&challenge="+"c".repeat(43)+"&proof="+"p".repeat(86);
 const sha=(s:string)=>createHash("sha256").update(s).digest("hex"),requestId="00000000-0000-4000-8000-000000000001";
 h.records=new Map([[77,{instance:"owned",device:{requestId,publicDeviceId:"device",publicKeyHash:"e".repeat(64)},original:{requestId,stateHash:sha("s".repeat(43)),urlHash:sha(h.original)},callbacks:[],exchanges:[]}]]);h.app={waitText:async()=>{},earlyPrivacy:async()=>{},fill:async()=>{},clickText:async()=>{},body:async()=>"Workspace"};vi.stubEnv("EXPECTED_SHA",h.target.source);vi.stubEnv("GITHUB_RUN_ID",h.target.runId);vi.stubEnv("GITHUB_RUN_ATTEMPT",h.target.attempt);});
const factory=()=>createConnectedWindowsHost({target:h.target,tools:{tauri:{path:"fixture",sha256:"a".repeat(64),version:"2.0.5"},webviewDriver:{path:"fixture",sha256:"a".repeat(64),version:"1"},browserDriver:{path:"fixture",sha256:"a".repeat(64),version:"1"},browser:{path:"fixture",sha256:"a".repeat(64),version:"1"},webview:{path:"fixture",sha256:"a".repeat(64),version:"1"},tauriPort:4444,nativePort:4445,browserPort:4446,debugPort:9223},transport:{} as any});
it("assembles admitted preparation, fresh device fixture, nonempty control and one cleanup without claiming Windows execution",async()=>{
 expect(await factory().run()).toEqual({evidenceClass:"HARNESS_FIXTURE_ONLY"});
 expect(h.events.indexOf("admit")).toBeLessThan(h.events.indexOf("driver-start"));expect(h.events.indexOf("control-prepare")).toBeLessThan(h.events.indexOf("journey"));
 for(const name of ["driver-cleanup","server-cleanup","trust-cleanup","profile-cleanup"])expect(h.events.filter(x=>x===name)).toHaveLength(1);
 expect(h.events.indexOf("driver-cleanup")).toBeLessThan(h.events.indexOf("profile-cleanup"));
});
it.each(["admit","preflight","profile-claim","trust-prepare","forward-start","observer-start","driver-start","early-observer","fixture-prepare","control-prepare","journey"])("cleans only reachable owned preparation after %s failure",async fault=>{
 h.fault=fault;await expect(factory().run()).rejects.toThrow();
 if(["admit","preflight","profile-claim"].includes(fault)){expect(h.events).not.toContain("driver-start");expect(h.events).not.toContain("driver-cleanup");expect(h.events).not.toContain("profile-cleanup");}
 expect(h.events.filter(x=>x==="profile-cleanup").length).toBeLessThanOrEqual(1);
});
it.each(["driver-cleanup","server-cleanup","observer-cleanup","forward-cleanup","trust-cleanup"])("reports %s refusal, preserves profile residue and does not retry teardown",async fault=>{
 h.fault=fault;await expect(factory().run()).rejects.toThrow("CLEANUP_INCOMPLETE");expect(h.events.filter(x=>x===fault)).toHaveLength(1);expect(h.events).not.toContain("profile-cleanup");
});

const requestId="00000000-0000-4000-8000-000000000001";
function delivered(){
 const row=h.records.get(77),callback={requestId,stateHash:row.original.stateHash,callbackHash:"f".repeat(64),delivery:"WARM_SINGLE_INSTANCE"};
 row.callbacks=[callback];row.exchanges=[{requestId,sessionId:"session",stage:"SERVER_EXCHANGE_RETURNED_NOT_STORAGE_PROOF"}];
 h.rows=[{kind:"START",pid:88,parentPid:33,userSid:h.target.userSid,image:"nalanda-cross-platform.exe",at:new Date().toISOString()}];
 h.records.set(88,{...row,instance:"cold-owned",callbacks:[{...callback,delivery:"COLD_ARGUMENT"}]});
}
it("real host callback methods wait for journal creation, bind warm delivery/exchange and adopt the cold instance",async()=>{
 h.journey=async(host:any)=>{
  await host.observeOriginalAuthorization({});delivered();h.pending=1;
  await host.observeCallback(h.instance,requestId);await host.assertCallbackProcessed(h.instance,requestId);
  await host.closeForCallback(h.instance);await host.beforeCallbackLaunch();
  const next=await host.observeColdCallback(requestId);expect(next.instance.pid).toBe(88);
  expect(h.events.filter(x=>x==="pending-journal").length).toBeGreaterThanOrEqual(3);
  expect(h.events.indexOf("verify-files")).toBeLessThan(h.events.indexOf("cold-attach"));
 };await factory().run();
});
it.each(["wrong-user","wrong-parent","wrong-instance","wrong-state","exchange-mismatch","cold-attach"])("real host refuses %s callback state and executes owned cleanup",async fault=>{
 h.journey=async(host:any)=>{
  await host.observeOriginalAuthorization({});delivered();
  if(fault==="wrong-user")h.rows[0].userSid="S-1-5-21-9-8-7-1001";
  if(fault==="wrong-parent")h.rows[0].parentPid=999;
  if(fault==="wrong-instance")h.records.get(77).instance="foreign";
  if(fault==="wrong-state")h.records.get(77).callbacks[0].stateHash="0".repeat(64);
  if(fault==="exchange-mismatch"){h.readback.sessionId="foreign";await host.assertCallbackProcessed(h.instance,requestId);return;}
  if(fault==="cold-attach")h.fault="cold-attach";
  if(["wrong-user","wrong-parent","cold-attach"].includes(fault))await host.observeColdCallback(requestId);
  else await host.observeCallback(h.instance,requestId);
 };
 await expect(factory().run()).rejects.toThrow();expect(h.events).toContain("driver-cleanup");expect(h.events).toContain("server-cleanup");
});
it("fresh pre-confirm native/backend rejection prevents cold adoption",async()=>{
 h.journey=async(host:any)=>{await host.closeForCallback(h.instance);h.fault="admit";await host.beforeCallbackLaunch();await host.observeColdCallback(requestId);};
 await expect(factory().run()).rejects.toThrow();expect(h.events).not.toContain("cold-attach");expect(h.events).toContain("server-cleanup");
});

it("consumes a real PowerShell newline frame without accepting duplicate keys or oversized stdin",()=>{
 expect(parseWindowsConnectedInput(Buffer.from('{"contract":"fixture"}\r\n'))).toEqual({contract:"fixture"});
 expect(()=>parseWindowsConnectedInput(Buffer.from('{"contract":"a","contract":"b"}\r\n'))).toThrow();
 expect(()=>parseWindowsConnectedInput(Buffer.alloc(32769,32))).toThrow("INPUT_BOUND");
});
