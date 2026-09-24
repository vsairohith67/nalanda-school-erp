import {describe,it,expect} from "vitest";
import {validateWindowsTarget,validateOriginalAuthorization,assertNativeIdentity,assertLockedView,assertRevokedReadback,assertOwnedProcess,runWindowsAuthentication} from "../scripts/portable/windows-auth-lifecycle";

const hash="a".repeat(64),source="b".repeat(40);
import {windowsTarget} from "./fixtures/windows-auth";
const identity={source,runId:"123",attempt:"1",databaseIdentitySha256:hash,userId:"synthetic-user",deviceId:"synthetic-device",publicDeviceId:"00000000-0000-4000-8000-000000000001",sessionId:"00000000-0000-4000-8000-000000000002",requestId:"00000000-0000-4000-8000-000000000003",requestStatus:"CONSUMED",deviceStatus:"ACTIVE",sessionRevoked:false,activeSessions:1,role:"ACCOUNTANT",mfaUsed:true,referenceStudents:["SYNTHETIC-1"],referenceVersion:"synthetic-version",tokenVersion:1,rotatedTokenVersions:[] as number[]};
describe("Windows lifecycle admission assertions (contract evidence only)",()=>{
 it("binds different Edge browser and WebView versions independently",()=>{expect(validateWindowsTarget(windowsTarget(),{source,runId:"123",attempt:"1"})).toEqual(windowsTarget());});
 it.each(["source","runId","attempt","architecture","appId","profile","origin","artifactSha256","tauriDriverVersion"])("refuses substituted %s",key=>{const t:any=windowsTarget();t[key]="foreign";expect(()=>validateWindowsTarget(t,{source,runId:"123",attempt:"1"})).toThrow();});
 it.each(["executable","userProfile","appData","webviewData","browserData","roaming","local"])("refuses foreign %s",key=>{const t:any=windowsTarget();t[key]="C:\\Users\\Owner\\private";expect(()=>validateWindowsTarget(t,{source,runId:"123",attempt:"1"})).toThrow();});
 it("rejects WebView mismatch independently of system browser",()=>{const t=windowsTarget();t.webviewDriverVersion=t.browserDriverVersion;expect(()=>validateWindowsTarget(t,{source,runId:"123",attempt:"1"})).toThrow();});
 it("requires the observed original app URL and exact parameter set",()=>{
  const url=windowsTarget().origin+"/native/authorize?request="+identity.requestId+"&state="+"s".repeat(43)+"&challenge="+"c".repeat(43)+"&proof="+"p".repeat(86);
  expect(validateOriginalAuthorization(url,windowsTarget().origin).requestId).toBe(identity.requestId);
  for(const bad of ["",url.replace("https:","http:"),url.replace("portable-staging.localhost","evil.invalid"),url+"&state=duplicate",url+"#fragment",url.replace("/native/authorize","/login"),url+"&redirect=https://evil.invalid"]){expect(()=>validateOriginalAuthorization(bad,windowsTarget().origin)).toThrow();}
 });
 it.each(["source","runId","attempt","databaseIdentitySha256","userId","deviceId","publicDeviceId","requestId","sessionId","role","requestStatus","deviceStatus"])("rejects wrong native readback %s",key=>{expect(()=>assertNativeIdentity({...identity,[key]:"wrong"},identity)).toThrow();});
 it("rejects duplicate sessions, missing MFA and wrong references",()=>{for(const edit of [{activeSessions:2},{mfaUsed:false},{referenceStudents:["SYNTHETIC-OTHER"]},{sessionRevoked:true}])expect(()=>assertNativeIdentity({...identity,...edit},identity)).toThrow();});
 it("refuses private locked DOM, wrong denial and revoked session resurrection",()=>{
  expect(()=>assertLockedView("Welcome back Unlock app PRIVATE-CANARY",["PRIVATE-CANARY"])).toThrow();
  assertLockedView("Welcome back Unlock local encrypted drafts. Unlock app",["PRIVATE-CANARY"]);
  const revoked={...identity,deviceStatus:"REVOKED",activeSessions:0};
  assertRevokedReadback(revoked,identity,"NATIVE_SESSION_REVOKED");
  for(const reason of ["500","FEATURE_DISABLED","timeout","NATIVE_ROLE_DENIED"])expect(()=>assertRevokedReadback(revoked,identity,reason)).toThrow();
  expect(()=>assertRevokedReadback(identity,identity,"NATIVE_SESSION_REVOKED")).toThrow();
 });
 it("cannot stop a PID reused by a foreign executable, user or start time",()=>{
  const p={pid:123,created:"2026-09-24T00:00:00.000Z",executable:windowsTarget().executable,sha256:hash,userSid:windowsTarget().userSid};assertOwnedProcess(p,p);
  for(const edit of [{pid:124},{created:"later"},{executable:"C:\\foreign.exe"},{sha256:"c".repeat(64)},{userSid:"foreign"}])expect(()=>assertOwnedProcess({...p,...edit},p)).toThrow();
 });
 it("runs no UI and still closes partial startup when admission/start fails",async()=>{
  const events:string[]=[];const host:any={admit:async()=>{events.push("admit");throw Error("EXTERNAL_RUNTIME_BLOCKED");},cleanup:async()=>events.push("cleanup")};
  await expect(runWindowsAuthentication(host,{} as any)).rejects.toThrow("WINDOWS_AUTH_LIFECYCLE_FAILED");expect(events).toEqual(["admit","cleanup"]);
 });
});
