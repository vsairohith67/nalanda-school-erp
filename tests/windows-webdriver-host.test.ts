import {describe,it,expect} from "vitest";
import {createWindowsSession,assertWindowsEnvironment,assertOwnedWindowsListener,observeOriginalWindowsAuthorization,OwnedWindowsWebDriver} from "../scripts/portable/windows-webdriver-host";
import {windowsTarget} from "./fixtures/windows-auth";
describe("Windows W3C/OS adapter contracts",()=>{
 it("rejects a foreign protocol handler and real owner profile without changing either",()=>{
  const t=windowsTarget(),actual={userSid:t.userSid,userProfile:t.userProfile,roaming:t.roaming,local:t.local,protocolCommand:`"${t.executable}" "%1"`,browserProgId:"MSEdgeHTM"};assertWindowsEnvironment(actual,t);
  for(const edit of [{protocolCommand:'"C:\\School\\erp.exe" "%1"'},{browserProgId:"ChromeHTML"},{userSid:"foreign"},{local:"C:\\Users\\Owner\\AppData\\Local"}])expect(()=>assertWindowsEnvironment({...actual,...edit},t)).toThrow();
 });
 it("creates a W3C session through loopback only and preserves exact capabilities",async()=>{
  const calls:any[]=[];const transport=async(url:any,init:any)=>{calls.push({url,body:JSON.parse(init.body)});return new Response(JSON.stringify({value:{sessionId:"owned-session-123",capabilities:{browserVersion:"152.0.3721.25"}}}));};
  const capabilities={"tauri:options":{application:windowsTarget().executable}};
  const result=await createWindowsSession("http://127.0.0.1:4444",capabilities,transport as typeof fetch);expect(result.driver.session).toBe("owned-session-123");expect(calls[0].body).toEqual({capabilities:{alwaysMatch:capabilities}});
  await expect(createWindowsSession("http://foreign.invalid:4444",capabilities,transport as typeof fetch)).rejects.toThrow();expect(calls).toHaveLength(1);
 });
 it("never reports a malformed/failed session as launch",async()=>{
  for(const value of [{error:"session not created"},{sessionId:"../foreign"},{}])await expect(createWindowsSession("http://127.0.0.1:4444",{},(async()=>new Response(JSON.stringify({value}))) as typeof fetch)).rejects.toThrow();
 });
 it("acquires the unchanged original browser URL, refusing foreign and ambiguous requests",async()=>{
  const url=windowsTarget().origin+"/native/authorize?request=00000000-0000-4000-8000-000000000001&state="+"s".repeat(43)+"&challenge="+"c".repeat(43)+"&proof="+"p".repeat(86);
  let current="one";const browser:any={command:async(method:string,route:string,body:any)=>{if(route==="/window/handles")return ["one","two"];if(route==="/window"){current=body.handle;return;}return current==="one"?url:"about:blank";}};
  const seen=new Set<string>();expect(await observeOriginalWindowsAuthorization(browser,windowsTarget().origin,seen)).toBe(url);expect(seen.has(url)).toBe(true);expect(current).toBe("one");
  const foreign:any={command:async(_m:string,r:string)=>r==="/window/handles"?["one"]:r==="/url"?url.replace("portable-staging.localhost","foreign.invalid"):null};await expect(observeOriginalWindowsAuthorization(foreign,windowsTarget().origin,new Set())).rejects.toThrow();
 });
 it("cleanup refuses a PID with changed identity and does not stop it",async()=>{
  const t=windowsTarget(),owned={pid:7,created:"earlier",executable:t.executable,sha256:t.artifactSha256,userSid:t.userSid},calls:any[]=[];
  const host=new OwnedWindowsWebDriver(t,{} as any,(input:any)=>{calls.push(input);return [{...owned,created:"later"}];});(host as any).processes=[owned];
  await expect(host.cleanup()).rejects.toThrow("WINDOWS_OWNED_CLEANUP_INCOMPLETE");expect(calls.every(c=>c.operation==="processes")).toBe(true);
 });
 it("cleanup attempts remaining owned processes after one refusal",async()=>{
  const t=windowsTarget(),p=(pid:number)=>({pid,created:"same",executable:`C:\\qa\\run-123-1\\${pid}.exe`,sha256:t.artifactSha256,userSid:t.userSid}),stopped:number[]=[];
  const host=new OwnedWindowsWebDriver(t,{} as any,(i:any)=>{if(i.operation==="stop"){stopped.push(i.process.pid);return;}return i.executable.endsWith("2.exe")?[{...p(2),sha256:"wrong"}]:stopped.includes(1)?[]:[p(1)];});(host as any).processes=[p(1),p(2)];await expect(host.cleanup()).rejects.toThrow();expect(stopped).toEqual([1]);
 });
 it("loopback alone cannot qualify a foreign or wildcard-bound listener",()=>{
  assertOwnedWindowsListener([{address:"127.0.0.1",port:4444,pid:8}],4444,[8]);
  for(const rows of [[],[{address:"127.0.0.1",port:4444,pid:9}],[{address:"0.0.0.0",port:4444,pid:8}],[{address:"127.0.0.1",port:5555,pid:8}]])expect(()=>assertOwnedWindowsListener(rows,4444,[8])).toThrow();
 });
 it("does not adopt a child through a reused historical parent PID",()=>{
  const t=windowsTarget(),parent={pid:12,created:"original",executable:t.executable,sha256:t.artifactSha256,userSid:t.userSid,parentPid:1},child={...parent,pid:13,parentPid:12,created:"child"};
  const host=new OwnedWindowsWebDriver(t,{} as any,()=>[{...parent,created:"reused"},child]);(host as any).processes=[parent];expect(()=>(host as any).captureDescendants()).toThrow();expect((host as any).processes).toEqual([parent]);
 });
});
