import {beforeEach,describe,expect,it,vi} from "vitest";
const mock=vi.hoisted(()=>({onOpenUrl:vi.fn(),getCurrent:vi.fn(),nativeRequest:vi.fn(),unlisten:vi.fn(),handler:null as null|((urls:string[])=>void)}));
vi.mock("@tauri-apps/plugin-deep-link",()=>({onOpenUrl:mock.onOpenUrl,getCurrent:mock.getCurrent}));
vi.mock("./native",()=>({nativeRequest:mock.nativeRequest}));
import {exchangeNativeCallback,listenForNativeAuthorization,refreshNativeTokens,usableNativeAccess,type NativeTokens} from "./auth";
const callback="nalandaps-erp://auth/callback?code="+"c".repeat(43)+"&state=state&request=request";
beforeEach(()=>{vi.resetAllMocks();mock.handler=null;mock.getCurrent.mockResolvedValue(null);mock.onOpenUrl.mockImplementation(async fn=>{mock.handler=fn;return mock.unlisten;});});
const drain=async()=>{for(let i=0;i<10;i++)await Promise.resolve();};
describe("native callback lifetime",()=>{
 it("unsubscribes registration that completes after lock",async()=>{
  let finish!:(v:()=>void)=>void;mock.onOpenUrl.mockImplementation(()=>new Promise(r=>finish=r));const controller=new AbortController();
  const listening=listenForNativeAuthorization({} as any,vi.fn(),vi.fn(),controller.signal);controller.abort();finish(mock.unlisten);await listening;
  expect(mock.unlisten).toHaveBeenCalledOnce();expect(mock.getCurrent).not.toHaveBeenCalled();
 });
 it("claims a callback before the asynchronous pending-request read",async()=>{
  let finish!:(v:null)=>void;const vault={getSecureJson:vi.fn(()=>new Promise(r=>finish=r))};const done=vi.fn();await listenForNativeAuthorization(vault as any,done,vi.fn());
  mock.handler!([callback]);mock.handler!([callback]);expect(vault.getSecureJson).toHaveBeenCalledOnce();finish(null);await drain();expect(mock.nativeRequest).not.toHaveBeenCalled();expect(done).not.toHaveBeenCalled();
 });
 it("does not exchange when lock occurs during the pending read",async()=>{
  let finish!:(v:unknown)=>void;const vault={getSecureJson:vi.fn(()=>new Promise(r=>finish=r))},controller=new AbortController(),done=vi.fn();
  await listenForNativeAuthorization(vault as any,done,vi.fn(),controller.signal);mock.handler!([callback]);controller.abort();finish({requestId:"request"});await drain();expect(mock.nativeRequest).not.toHaveBeenCalled();expect(done).not.toHaveBeenCalled();
 });
 it("reports invalid callback without installing credentials",async()=>{
  const vault={getSecureJson:vi.fn().mockResolvedValue({requestId:"request",state:"other",createdAt:new Date().toISOString()}),setRefreshToken:vi.fn()};const error=vi.fn();await listenForNativeAuthorization(vault as any,vi.fn(),error);mock.handler!([callback]);await drain();expect(error).toHaveBeenCalledWith("Authorization callback did not match this app request.");expect(vault.setRefreshToken).not.toHaveBeenCalled();
 });
 it("cleans listener on failed cold-start observation",async()=>{mock.getCurrent.mockRejectedValue(Error("private input"));await expect(listenForNativeAuthorization({} as any,vi.fn(),vi.fn())).rejects.toThrow("Native callback observation failed.");expect(mock.unlisten).toHaveBeenCalledOnce();});
 it("only reuses a finite unexpired access token",()=>{
  const now=Date.now(),token={accessExpiresAt:new Date(now+1000).toISOString()} as NativeTokens;expect(usableNativeAccess(token,now)).toBe(true);
  expect(usableNativeAccess(token,now+1000)).toBe(false);expect(usableNativeAccess(null,now)).toBe(false);expect(usableNativeAccess({...token,accessExpiresAt:"invalid"},now)).toBe(false);
 });
 it("does not persist exchange credentials arriving after local lock",async()=>{
  let finish!:(v:any)=>void;let started!:()=>void;const entered=new Promise<void>(r=>started=r);
  mock.nativeRequest.mockImplementation(()=>{started();return new Promise(r=>finish=r);});
  const vault={getSecureJson:vi.fn().mockResolvedValue({requestId:"request",state:"state",nonce:"nonce",verifier:"v".repeat(64),publicDeviceId:"device",createdAt:new Date().toISOString()}),sign:vi.fn().mockResolvedValue("proof"),setRefreshToken:vi.fn(),setSecureJson:vi.fn(),removeSecureJson:vi.fn()};
  // Generate process-local opaque values; no reusable credential fixture enters source.
  const control=new AbortController(),pending=exchangeNativeCallback(vault as any,callback,control.signal);await entered;control.abort();finish({status:200,body:JSON.stringify({accessToken:crypto.randomUUID(),refreshToken:crypto.randomUUID()})});
  await expect(pending).rejects.toThrow("App locked during authorization");expect(vault.setRefreshToken).not.toHaveBeenCalled();expect(vault.setSecureJson).not.toHaveBeenCalled();expect(vault.removeSecureJson).not.toHaveBeenCalled();
 });
 it("shares one in-flight rotation per vault, then permits the next rotation",async()=>{
  const vault={refreshToken:vi.fn().mockResolvedValue(crypto.randomUUID()),getSecureJson:vi.fn().mockResolvedValue({sessionId:"session",tokenVersion:1,publicDeviceId:"device"}),sign:vi.fn().mockResolvedValue("proof"),setRefreshToken:vi.fn(),setSecureJson:vi.fn()};
  mock.nativeRequest.mockResolvedValue({status:200,body:JSON.stringify({refreshToken:crypto.randomUUID(),sessionId:"session",tokenVersion:2})});
  const first=refreshNativeTokens(vault as any),second=refreshNativeTokens(vault as any);expect(first).toBe(second);await Promise.all([first,second]);expect(mock.nativeRequest).toHaveBeenCalledOnce();expect(vault.setRefreshToken).toHaveBeenCalledOnce();await refreshNativeTokens(vault as any);expect(mock.nativeRequest).toHaveBeenCalledTimes(2);
 });
});
