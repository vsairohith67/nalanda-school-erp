/// <reference types="node" />
import {afterAll,beforeAll,describe,it,expect,vi} from "vitest";
import {DatabaseSync} from "node:sqlite";
import {mkdtempSync,rmSync,lstatSync,readFileSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import {ReferenceRefresh,referenceHash,validateReferenceResponse,type RefreshState,type ReferenceBinding} from "./reference-refresh";
import {referenceJson} from "../../../lib/native-app/reference-observation";
import {NativeOfflineStorageAdapter} from "./offline-adapter";
const h=vi.hoisted(()=>({db:null as any,fail:false,key: new Uint8Array(32).fill(41),guard:null as null|(()=>void)}));
// NATIVE_CLIENT_STORAGE: real AES-GCM and file SQLite; IPC and Stronghold key
// retrieval are adapters, not an executed Rust/Windows vault or driver.
vi.mock("./native",()=>({
 storeEnvelope:async(e:any)=>{h.guard?.();if(h.fail)throw Error("disk failed PRIVATE_CANARY");h.db.prepare("INSERT INTO cache(id,kind,value) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value").run(e.recordId,e.recordType,JSON.stringify(e));},
 listEnvelopes:async(kind:string)=>h.db.prepare("SELECT value FROM cache WHERE kind=?").all(kind).map((r:any)=>JSON.parse(r.value)),deleteEnvelope:async()=>{}
}));
const root=mkdtempSync(path.join(tmpdir(),"nalanda-reference-storage-")),owned=lstatSync(root),file=path.join(root,"synthetic.db");
beforeAll(()=>{h.db=new DatabaseSync(file);h.db.exec("CREATE TABLE cache(id TEXT PRIMARY KEY,kind TEXT,value TEXT)");});
afterAll(()=>{h.db.close();expect(lstatSync(root).ino).toBe(owned.ino);expect(lstatSync(root).isSymbolicLink()).toBe(false);expect(path.dirname(root)).toBe(tmpdir());rmSync(root,{recursive:true});});
const binding:ReferenceBinding={userId:"synthetic-user",deviceId:"synthetic-device",sessionId:crypto.randomUUID(),publicDeviceId:crypto.randomUUID(),profile:"PRIVATE_STAGING:https://synthetic.invalid"};
const vault={contentKey:async()=>h.key} as any;
async function input(empty=false){
 const pack={schemaVersion:1,mode:"FULL",truncated:false,snapshotVersion:crypto.randomUUID(),generatedAt:new Date().toISOString(),softStaleAt:new Date(Date.now()+3600000).toISOString(),hardExpiresAt:new Date(Date.now()+7200000).toISOString(),cursor:crypto.randomUUID(),students:empty?[]:[{id:"synthetic-student",admissionNo:"SYNTHETIC-ONE",name:"PRIVATE_CANARY",academicYear:"2026-27",entityVersion:"1"}],feeStructures:[],vendors:[],expenseCategories:[],expenseDepartments:[],miscIncomeItems:[]};
 const requestHash=await referenceHash(crypto.randomUUID());
 const observation={version:1,responseId:crypto.randomUUID(),userId:binding.userId,sessionId:binding.sessionId,deviceId:binding.deviceId,publicDeviceId:binding.publicDeviceId,requestHash,snapshotHash:await referenceHash(pack.snapshotVersion),contentHash:await referenceHash(referenceJson(pack)),populationHash:await referenceHash(JSON.stringify(pack.students.map(s=>s.admissionNo))),studentCount:pack.students.length};
 return {body:JSON.stringify({...pack,observation}),requestHash,binding};
}
describe("reference completion contracts and encrypted file readback",()=>{
 it.each([false,true])("commits all records atomically and clean-reopens, empty=%s",async empty=>{
  const store=new NativeOfflineStorageAdapter(vault),states:RefreshState[]=[];
  const result=await new ReferenceRefresh().run("MANUAL",()=>input(empty),store.referenceCommit,s=>states.push(s));
  expect(states.map(s=>s.stage)).toEqual(["REQUESTING","VALIDATED","STORED"]);
  expect(states[2].observation).toEqual(result.observation);
  h.db.close();h.db=new DatabaseSync(file);
  const reopened=new NativeOfflineStorageAdapter(vault);
  expect(await reopened.referenceCommit.read()).toEqual(result);expect(await reopened.cursors.current()).toBe(result.pack.cursor);
  expect(readFileSync(file).includes(Buffer.from("PRIVATE_CANARY"))).toBe(false);
 });
 it("storage failure preserves old pack/cursor and never signals stored",async()=>{
  const store=new NativeOfflineStorageAdapter(vault),before=await store.referenceCommit.read(),states:RefreshState[]=[];
  h.fail=true;try{await expect(new ReferenceRefresh().run("MANUAL",()=>input(),store.referenceCommit,s=>states.push(s))).rejects.toThrow("REFERENCE_REFRESH_FAILED");}finally{h.fail=false;}
  expect(await store.referenceCommit.read()).toEqual(before);expect(states.at(-1)?.stage).toBe("FAILED");
 });
 it("rejects decryption/wrong key and missing readback",async()=>{
  const previous=h.key;h.key=new Uint8Array(32).fill(42);try{await expect(new NativeOfflineStorageAdapter(vault).referenceCommit.read()).rejects.toThrow();}finally{h.key=previous;}
  await expect(new ReferenceRefresh().run("MANUAL",()=>input(),{commit:async()=>{},read:async()=>null},()=>{})).rejects.toThrow("REFERENCE_STORAGE_READBACK_MISMATCH");
 });
 it.each(["userId","deviceId","sessionId","publicDeviceId"] as const)("refuses foreign %s",async key=>{const i=await input();await expect(validateReferenceResponse(i.body,{...binding,[key]:"foreign"},i.requestHash)).rejects.toThrow("BINDING");});
 it.each(["truncated","malformed","content","request","version","private-metadata"])("fails closed on %s",async kind=>{
  const i=await input(),v=JSON.parse(i.body);
  if(kind==="truncated")v.truncated=true;if(kind==="content")v.students[0].name="changed";if(kind==="version")v.schemaVersion=2;if(kind==="private-metadata")v.observation.secret="PRIVATE_CANARY";
  await expect(validateReferenceResponse(kind==="malformed"?"{":JSON.stringify(v),binding,kind==="request"?"0".repeat(64):i.requestHash)).rejects.toThrow();
 });
 it("older automatic response cannot complete a manual operation or overwrite it",async()=>{
  const controller=new ReferenceRefresh(),store=new NativeOfflineStorageAdapter(vault),states:RefreshState[]=[];
  let release!:(v:Awaited<ReturnType<typeof input>>)=>void;
  const old=controller.run("AUTOMATIC",()=>new Promise(r=>release=r),store.referenceCommit,s=>states.push(s));const refusal=expect(old).rejects.toThrow("CANCELLED");
  const next=await controller.run("MANUAL",()=>input(),store.referenceCommit,s=>states.push(s));release(await input());await refusal;
  expect(await store.referenceCommit.read()).toEqual(next);expect(states.filter(s=>s.stage==="STORED").map(s=>s.source)).toEqual(["MANUAL"]);
 });
 it.each(["lock","logout","account-switch"])("invalidates pending response on %s",async()=>{
  const controller=new ReferenceRefresh(),store=new NativeOfflineStorageAdapter(vault),before=await store.referenceCommit.read();let release!:()=>void;
  const run=controller.run("MANUAL",async()=>{await new Promise<void>(r=>release=r);return input();},store.referenceCommit,()=>{});const refusal=expect(run).rejects.toThrow("CANCELLED");controller.cancel();release();await refusal;expect(await store.referenceCommit.read()).toEqual(before);
 });
 it("checks cancellation after encryption and before persistence",async()=>{
  const controller=new ReferenceRefresh(),store=new NativeOfflineStorageAdapter({contentKey:async()=>{controller.cancel();return h.key;}} as any);
  await expect(controller.run("MANUAL",()=>input(),store.referenceCommit,()=>{})).rejects.toThrow("CANCELLED");
 });
 it("a rejected superseded request cannot overwrite the newer success",async()=>{
  const controller=new ReferenceRefresh(),store=new NativeOfflineStorageAdapter(vault),states:RefreshState[]=[];let reject!:(e:Error)=>void;
  const old=controller.run("AUTOMATIC",()=>new Promise((_r,j)=>reject=j),store.referenceCommit,s=>states.push(s)),refused=expect(old).rejects.toThrow("REFERENCE_REFRESH_CANCELLED");
  await controller.run("MANUAL",()=>input(),store.referenceCommit,s=>states.push(s));reject(Error("NATIVE_CREDENTIAL_WORK_CANCELLED"));await refused;expect(states.at(-1)?.stage).toBe("STORED");
 });
 it("drains a dispatched atomic write before reset may remove its owned store",async()=>{
  const controller=new ReferenceRefresh();let finish!:()=>void;let began!:()=>void;const started=new Promise<void>(r=>began=r);const events:string[]=[];
  const run=controller.run("MANUAL",()=>input(),{commit:async()=>{began();await new Promise<void>(r=>finish=r);events.push("commit");},read:async()=>null},()=>{});
  const refused=expect(run).rejects.toThrow("CANCELLED");await started;controller.cancel();const drain=controller.drain().then(()=>events.push("reset"));expect(events).toEqual([]);finish();await refused;await drain;expect(events).toEqual(["commit","reset"]);
 });
 it.each(["missing-rate","bad-amount","missing-name"])("rejects correctly hashed incompatible consumed fields: %s",async kind=>{
  const i=await input(),v=JSON.parse(i.body);
  v.miscIncomeItems=[{id:"item",entityVersion:"1",name:"SYNTHETIC item",code:"synthetic",studentLinkPolicy:"REQUIRED",rates:[{id:"rate",academicYear:"2026-27",entityVersion:"1",amount:"10.00"}]}];
  if(kind==="missing-rate")delete v.miscIncomeItems[0].rates;if(kind==="bad-amount")v.miscIncomeItems[0].rates[0].amount="invalid";if(kind==="missing-name")delete v.miscIncomeItems[0].name;
  const {observation,...pack}=v;observation.contentHash=await referenceHash(referenceJson(pack));
  await expect(validateReferenceResponse(JSON.stringify({...pack,observation}),binding,i.requestHash)).rejects.toThrow(/REFERENCE_PACK_(FIELDS|RATES)/);
 });
 it("retains legacy cache without manufacturing observations",async()=>{
  const store=new NativeOfflineStorageAdapter(vault),i=await input(),{pack}=await validateReferenceResponse(i.body,binding,i.requestHash);
  await store.references.put(pack);expect(await store.references.current()).toEqual(pack);expect(await store.referenceCommit.read()).toBeNull();
 });
});
