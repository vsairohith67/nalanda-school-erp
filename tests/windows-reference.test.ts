import {describe,it,expect,vi} from "vitest";
import {createHash,randomUUID} from "node:crypto";
import {assertReferenceStored,assertReferenceCorrelated,refreshWindowsReferences} from "../scripts/portable/windows-reference";
const hash=(s:string)=>createHash("sha256").update(s).digest("hex");
const expected={userId:"synthetic-user",sessionId:randomUUID(),deviceId:"synthetic-device",publicDeviceId:randomUUID(),profile:"PRIVATE_STAGING:https://synthetic.invalid",students:[] as string[]};
const observation={version:1 as const,responseId:randomUUID(),userId:expected.userId,sessionId:expected.sessionId,deviceId:expected.deviceId,publicDeviceId:expected.publicDeviceId,requestHash:hash("request"),snapshotHash:hash("snapshot"),contentHash:hash("pack"),populationHash:hash("[]"),studentCount:0};
const receipt={operationId:randomUUID(),source:"MANUAL" as const,stage:"STORED" as const,observation,profile:expected.profile};
describe("UNIT_OR_DRIVER_CONTRACT: exact manual action and private server correlation",()=>{
 it("requires storage completion, not existing ready text/options or server-only preparation",()=>{
  for(const v of [null,{ready:true}, {...receipt,stage:"REQUESTING"},{...receipt,stage:"VALIDATED"},{...receipt,stage:"FAILED"},{...receipt,source:"AUTOMATIC"},{...receipt,observation:null}])expect(()=>assertReferenceStored(v,null)).toThrow();
  expect(()=>assertReferenceStored(receipt,receipt.operationId)).toThrow("ACTION_MISSING");
  expect(()=>assertReferenceCorrelated(assertReferenceStored(receipt,null),null,expected)).toThrow("NOT_OBSERVED");
 });
 it("matches an empty response and independently owned identity/population",()=>{
  const local=assertReferenceStored(receipt,null);assertReferenceCorrelated(local,observation,expected);
  for(const key of ["responseId","snapshotHash","contentHash","requestHash"] as const)expect(()=>assertReferenceCorrelated(local,{...observation,[key]:key==="responseId"?randomUUID():hash("other")},expected)).toThrow();
  for(const key of ["userId","deviceId","sessionId","publicDeviceId","profile"] as const)expect(()=>assertReferenceCorrelated(local,observation,{...expected,[key]:"foreign"})).toThrow();
  expect(()=>assertReferenceCorrelated(local,observation,{...expected,students:["SYNTHETIC-OTHER"]})).toThrow("POPULATION");
 });
 it("drives the actual control and tolerates fast completion without catching loading",async()=>{
  const calls:string[]=[];let reads=0;
  const app:any={clickText:async(s:string)=>calls.push(s),element:async(_u:string,value:string)=>{expect(value).toContain("Refresh encrypted reference data");return "button";},command:async(_m:string,route:string,body:any)=>{calls.push(route);if(route.includes("/click"))return null;if(body.script.includes("data-reference-refresh"))return JSON.stringify(reads++===0?{...receipt,operationId:randomUUID(),source:"AUTOMATIC"}:receipt);return [];}};
  expect(await refreshWindowsReferences(app,[])).toEqual(receipt);expect(calls).toContain("/element/button/click");
 });
 it("does not accept unchanged success and bounds readiness exhaustion",async()=>{
  vi.useFakeTimers();try{
   const app:any={clickText:async()=>{},element:async()=>"button",command:async(_m:string,route:string)=>route.includes("click")?null:JSON.stringify(receipt)};
   const promise=refreshWindowsReferences(app,[]),check=expect(promise).rejects.toThrow("ACTION_NOT_COMPLETED");await vi.runAllTimersAsync();await check;
  }finally{vi.useRealTimers();}
 });
 it("propagates missing control and failed refresh",async()=>{
  const app:any={clickText:async()=>{},command:async()=>null,element:async()=>{throw Error("MISSING_CONTROL");}};
  await expect(refreshWindowsReferences(app,[])).rejects.toThrow("MISSING_CONTROL");
  let reads=0;app.element=async()=>"button";app.command=async(_m:string,route:string)=>route.includes("click")?null:reads++===0?null:JSON.stringify({...receipt,stage:"FAILED"});
  await expect(refreshWindowsReferences(app,[])).rejects.toThrow("REFRESH_FAILED");
 });
});
