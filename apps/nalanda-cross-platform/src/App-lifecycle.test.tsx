import {it,expect,vi,beforeEach} from "vitest";
// UNIT_OR_CONTRACT: real App closures; React scheduling, DOM and vault IO doubled.
const h=vi.hoisted(()=>({states:[] as any[],refs:[] as any[],effects:[] as any[],s:0,r:0,e:0,visibility:()=>{},sessions:[] as any[]}));
vi.mock("react",async original=>({...await original<typeof import("react")>(),useState:(initial:any)=>{const i=h.s++;if(!(i in h.states))h.states[i]=typeof initial==="function"?initial():initial;return [h.states[i],(v:any)=>{h.states[i]=typeof v==="function"?v(h.states[i]):v;}];},useRef:(initial:any)=>{const i=h.r++;return h.refs[i]??(h.refs[i]={current:initial});},useMemo:(f:any)=>f(),useEffect:(f:any)=>{h.effects[h.e++]=f;}}));
vi.mock("./native",()=>({exportDiagnostics:async()=>{},isNativeRuntime:()=>true,VaultSession:{unlock:async()=>h.sessions.shift()},resetLocalCache:async()=>{},recordDiagnostic:async()=>{}}));
vi.mock("./auth",()=>({APP_VERSION:"0.1.0",invalidateNativeCredentialWork:async()=>{},nativeCredentialGeneration:()=>0}));
vi.mock("./offline-adapter",()=>({NativeOfflineStorageAdapter:class{drafts={list:async()=>[]};references={current:async()=>null};referenceCommit={read:async()=>null};}}));
import {App} from "./App";
function render(){h.s=h.r=h.e=0;const tree=App();h.effects[1]();return tree;}
function find(tree:any,predicate:(x:any)=>boolean):any{if(!tree||typeof tree!=="object")return; if(predicate(tree))return tree;for(const child of [tree.props?.children].flat(Infinity)){const found=find(child,predicate);if(found)return found;}}
beforeEach(()=>{h.states=[];h.refs=[];h.effects=[];h.sessions=[];vi.stubGlobal("navigator",{onLine:true});vi.stubGlobal("document",{visibilityState:"visible",addEventListener:(_n:string,f:any)=>{h.visibility=f;},removeEventListener:()=>{}});});
it("wipe detaches the old vault before background and a subsequent App unlock uses a new session",async()=>{
 const old={initialize:async()=>{},getSecureJson:async()=>null,deviceId:async()=>"device",wipe:vi.fn(async()=>{}),lock:vi.fn(async()=>{throw Error("STALE_WIPED_VAULT");})};
 const fresh={...old,lock:vi.fn(async()=>{})};h.sessions=[old,fresh];
 await render().props.onUnlock("31415926");
 const workspace=render();find(workspace,x=>x.type==="button"&&x.props.children?.some?.((v:any)=>v==="Security")).props.onClick();
 const security=render();await find(security,x=>typeof x.props?.wipe==="function").props.wipe("ERASE LOCAL DRAFTS");expect(old.wipe).toHaveBeenCalledOnce();
 const locked=render();(document as any).visibilityState="hidden";h.visibility();await Promise.resolve();expect(old.lock).not.toHaveBeenCalled();
 (document as any).visibilityState="visible";await locked.props.onUnlock("27182818");expect(render().props.className).toBe("app-frame");
 vi.unstubAllGlobals();
});
