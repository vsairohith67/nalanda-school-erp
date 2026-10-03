import {describe,it,expect} from "vitest";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {windowsTarget} from "./fixtures/windows-auth";
import {parseNativeObservation,assertOriginalObservation,assertCallbackObservation,assertEarlyPrivacy} from "../scripts/portable/windows-observation";
const hash=(s:string)=>createHash("sha256").update(s).digest("hex"),id="00000000-0000-4000-8000-000000000001",t=windowsTarget();
const p={pid:123,created:"2026-09-30T00:00:00Z",executable:t.executable,sha256:t.artifactSha256,userSid:t.userSid};
const original=`${t.origin}/native/authorize?request=${id}&state=${"s".repeat(43)}&challenge=${"c".repeat(43)}&proof=${"p".repeat(86)}`;
function record(){return {contract:"NALANDA_NATIVE_OBSERVATION_V1",source:t.source,runId:t.runId,attempt:t.attempt,pid:p.pid,executableSha256:t.artifactSha256,instance:"b".repeat(32),sequence:4,device:{publicDeviceId:id,publicKeyHash:"c".repeat(64),requestId:id},original:{requestId:id,stateHash:hash("s".repeat(43)),urlHash:hash(original)},callbacks:[{requestId:id,stateHash:hash("s".repeat(43)),callbackHash:hash("HARNESS_CALLBACK_ONLY"),delivery:"SINGLE_INSTANCE_ARGUMENT"}],exchanges:[]};}
describe("UNIT_OR_CONTRACT: minimal native observation",()=>{
 it("binds original URL and delivery without calling them a session or storage result",()=>{
  const o=parseNativeObservation(JSON.stringify(record()),t,p);expect(assertOriginalObservation(o,original,t.origin).publicDeviceId).toBe(id);
  expect(assertCallbackObservation(o,original,t.origin,o.instance).delivery).toBe("SINGLE_INSTANCE_ARGUMENT");expect(o.exchanges).toEqual([]);
 });
 it("refuses foreign source/process, private fields, unknown delivery and replay",()=>{
  for(const edit of [{source:"e".repeat(40)},{runId:"other"},{pid:456},{token:"private"},{callbacks:[...record().callbacks,...record().callbacks]},{callbacks:[{...record().callbacks[0],delivery:"INJECTED_WEB_EVENT"}]}])expect(()=>parseNativeObservation(JSON.stringify({...record(),...edit}),t,p)).toThrow();
  expect(()=>parseNativeObservation(" ".repeat(16385),t,p)).toThrow();
 });
 it("refuses substituted original and mismatched state/instance or missing callback",()=>{
  const o=record();expect(()=>assertOriginalObservation(o,original.replace("proof=p","proof=x"),t.origin)).toThrow();
  expect(()=>assertCallbackObservation(o,original,t.origin,"d".repeat(32))).toThrow();
  expect(()=>assertCallbackObservation({...o,callbacks:[]},original,t.origin,o.instance)).toThrow();
  expect(()=>assertCallbackObservation({...o,callbacks:[{...o.callbacks[0],stateHash:"e".repeat(64)}]},original,t.origin,o.instance)).toThrow();
 });
});
function privacy(early=true){
 let privateDom=false,mutation:()=>void=()=>{},frame:()=>void=()=>{},visibility:()=>void=()=>{},click:(event:unknown)=>void=()=>{};
 const document={readyState:early?"loading":"complete",visibilityState:"visible",hidden:false,body:{textContent:""},querySelector:(selector:string)=>selector==='.app-frame'?(privateDom?{}:null):selector==='.lock-screen'?(!privateDom?{}:null):null,addEventListener:(name:string,f:any)=>{if(name==='click')click=f;else visibility=f;}};
 let attributeCanary=false;Object.assign(document,{querySelectorAll:()=>attributeCanary?[{value:"SYNTHETIC Windows one",getAttribute:()=>""}]:[]});
 const window:any={};runInNewContext(readFileSync("apps/nalanda-cross-platform/src-tauri/src/qa_privacy.js","utf8"),{window,document,location:{origin:"http://tauri.localhost",protocol:"http:"},MutationObserver:class{constructor(f:()=>void){mutation=f;}observe(){}},requestAnimationFrame:(f:()=>void)=>{frame=f;}});
 return {read:()=>JSON.parse(JSON.stringify(window.__nalandaEarlyPrivacy.read())),unlock:()=>{window.__nalandaEarlyPrivacy.allowUnlock();click({target:{closest:()=>({textContent:'Unlock app'})}});},arm:()=>window.__nalandaEarlyPrivacy.allowUnlock(),lock:()=>window.__nalandaEarlyPrivacy.expectLocked(),frame:()=>frame(),mutate:(value:boolean)=>{privateDom=value;mutation();},attributeCanary:()=>{attributeCanary=true;mutation();},canary:()=>{document.body.textContent='SYNTHETIC Windows one';mutation();},visibility:(hidden:boolean)=>{document.hidden=hidden;document.visibilityState=hidden?"hidden":"visible";visibility();}};
}
describe("UNIT_OR_CONTRACT: actual initialization script in a doubled DOM, no rendering claim",()=>{
 it("detects private DOM present before unlock and cannot clear a recorded failure",()=>{const h=privacy();h.frame();assertEarlyPrivacy(h.read());h.mutate(true);expect(()=>assertEarlyPrivacy(h.read())).toThrow();h.mutate(false);h.unlock();expect(()=>assertEarlyPrivacy(h.read())).toThrow();});
 it("detects late installation even if the final DOM is locked",()=>{const h=privacy(false);h.frame();expect(()=>assertEarlyPrivacy(h.read())).toThrow();});
 it("does not disarm before an actual unlock interaction and detects canaries outside the workspace",()=>{const h=privacy();h.frame();h.arm();expect(h.read().armed).toBe(true);h.canary();expect(()=>assertEarlyPrivacy(h.read())).toThrow();});
 it("allows legitimate unlock but detects private content on return from background",()=>{const h=privacy();h.frame();h.unlock();h.mutate(true);assertEarlyPrivacy(h.read());h.visibility(true);h.visibility(false);expect(()=>assertEarlyPrivacy(h.read())).toThrow();});
 it("accepts masked return and requires new explicit unlock",()=>{const h=privacy();h.frame();h.unlock();h.mutate(true);h.visibility(true);h.mutate(false);h.visibility(false);assertEarlyPrivacy(h.read());expect(h.read().armed).toBe(true);h.unlock();h.mutate(true);assertEarlyPrivacy(h.read());});
});

it("pending unlock cannot disarm observation after background cancellation",()=>{const h=privacy();h.frame();h.unlock();h.visibility(true);h.mutate(true);expect(h.read().armed).toBe(true);h.visibility(false);expect(()=>assertEarlyPrivacy(h.read())).toThrow();});
it("private form values are observed even without private body text",()=>{const h=privacy();h.frame();h.attributeCanary();expect(()=>assertEarlyPrivacy(h.read())).toThrow();});
