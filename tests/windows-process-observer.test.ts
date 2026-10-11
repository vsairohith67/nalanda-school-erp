import {it,expect} from "vitest";
import {assertProtocolLaunch,validateNativeProcessStart} from "../scripts/portable/windows-process-observer";
import {assertColdWebViewPolicy} from "../scripts/portable/windows-webdriver-host";
import {windowsTarget} from "./fixtures/windows-auth";
const t=windowsTarget(),now=Date.now(),parent={pid:42,created:new Date(now-10000).toISOString(),executable:t.root+"\\edge.exe",sha256:"a".repeat(64),userSid:t.userSid};
const event={kind:"START" as const,pid:43,parentPid:42,userSid:t.userSid,image:"nalanda-cross-platform.exe" as const,at:new Date(now).toISOString()};
it("UNIT_OR_CONTRACT: binds an OS receipt to a still-live exact browser parent, not a cached PID",()=>{
 assertProtocolLaunch(event,t,[parent],now-1,[parent]);
 for(const live of [[],[{...parent,created:new Date(now-100).toISOString()}],[{...parent,sha256:"b".repeat(64)}],[{...parent,userSid:"foreign"}]])expect(()=>assertProtocolLaunch(event,t,[parent],now-1,live)).toThrow();
 for(const edit of [{parentPid:99},{userSid:"S-1-5-21-1-2-3-999"},{at:new Date(now-20000).toISOString()},{image:"other.exe"},{kind:"JAVASCRIPT"},{callbackUrl:"secret"}])expect(()=>assertProtocolLaunch({...event,...edit} as any,t,[parent],now-1,[parent])).toThrow();
 expect(()=>validateNativeProcessStart({...event,pid:0})).toThrow();
});
it("requires exact preprovisioned disposable WebView profile/runtime and loopback debugger; never sets policy",()=>{
 const tools={debugPort:9223,webview:{path:t.root+"\\webview\\msedgewebview2.exe"}} as any;
 const policy={arguments:"--remote-debugging-port=9223 --remote-debugging-address=127.0.0.1",folder:t.root+"\\webview",userData:t.webviewData,machineOverride:false,wildcardOverride:false,environmentOverride:false};
 assertColdWebViewPolicy(policy,t,tools);
 for(const edit of [{arguments:policy.arguments.replace("127.0.0.1","0.0.0.0")},{folder:"C:\\foreign"},{userData:t.browserData},{machineOverride:true},{wildcardOverride:true},{environmentOverride:true},{passed:true}])expect(()=>assertColdWebViewPolicy({...policy,...edit},t,tools)).toThrow();
});

it("requires exact pre-authorised browser protocol policy without machine or wildcard overrides",async()=>{
 const {assertBrowserProtocolPolicy}=await import("../scripts/portable/windows-webdriver-host");const t=windowsTarget();
 const value=JSON.stringify([{protocol:"nalandaps-erp",allowed_origins:["https://.portable-staging.localhost:8443"]}]);
 expect(()=>assertBrowserProtocolPolicy({value,machineOverride:false},t)).not.toThrow();
 for(const bad of [{value:null,machineOverride:false},{value,machineOverride:true},{value:value.replace("https://.portable-staging.localhost:8443","*"),machineOverride:false},{value:value.replace("nalandaps-erp","foreign"),machineOverride:false}])expect(()=>assertBrowserProtocolPolicy(bad,t)).toThrow();
});
