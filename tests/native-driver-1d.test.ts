import {expect,it} from "vitest";
import {NativeWebDriver} from "../scripts/portable/native-webdriver";
it("refuses remote automation endpoints and malformed sessions before any connection",()=>{
 for(const endpoint of ["http://example.invalid:4723","https://127.0.0.1:4723","http://user:password@127.0.0.1:4723","http://127.0.0.1:4723?target=remote"])expect(()=>new NativeWebDriver(endpoint,"owned-session-123")).toThrow();
 expect(()=>new NativeWebDriver("http://127.0.0.1:4723","../foreign")).toThrow();
});
it("uses the exact owned session and propagates protocol failures instead of success receipts",async()=>{
 const calls:{url:string;body:any}[]=[];
 const transport=async(url:any,init:any)=>{calls.push({url,body:JSON.parse(init.body??"null")});return new Response(JSON.stringify({value:{error:"invalid session id"}}),{status:404});};
 const driver=new NativeWebDriver("http://127.0.0.1:4723","owned-session-123",transport as typeof fetch);
 await expect(driver.fill('input[name="password"]',"PRIVATE-NOT-LOGGED")).rejects.toThrow("NATIVE_AUTOMATION_COMMAND_FAILED");
 expect(calls).toEqual([{url:"http://127.0.0.1:4723/session/owned-session-123/element",body:{using:"css selector",value:'input[name="password"]'}}]);
});
it("refuses ambiguous/mobile context substitution",async()=>{
 const driver=new NativeWebDriver("http://127.0.0.1:4723","owned-session-123",(async()=>new Response(JSON.stringify({value:["WEBVIEW_owned","WEBVIEW_owned"]}))) as typeof fetch);
 await expect(driver.switchMobileWebview("WEBVIEW_owned")).rejects.toThrow();
});
