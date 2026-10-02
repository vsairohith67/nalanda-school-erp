import { afterAll, afterEach, expect, it } from "vitest";
import { createHash, createDecipheriv, generateKeyPairSync, verify } from "node:crypto";
import { createServer } from "node:http";
import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, symlinkSync, writeFileSync, truncateSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { id, profile, bytes } from "./export-test-fixtures.js";
import { EXPORT_PROFILE, parseExport, type ExportInput } from "./export-profile.js";
import { acquireExport, assertSourceBoundary, selectedFiles, openExportScan } from "./export-source.js";
import { EncryptedDurableQueue } from "./encrypted-queue.js";
import { atomicWrite } from "./atomic-file.js";
import { runBridgeCycle, safeCode } from "./agent.js";
import { loadBridgeConfig } from "./config.js";
import { previewExport } from "./export-preview.js";
import { syncPreparedBatch } from "./sync.js";
import type { BridgeConfig } from "./contracts.js";
const dirs:string[]=[],key=Buffer.alloc(32,13).toString("base64url");
const sid=process.platform==="win32"?execFileSync("whoami.exe",["/user","/fo","csv","/nh"],{encoding:"utf8",windowsHide:true}).match(/S-1-[0-9-]+/)![0]:"S-1-5-21-100-100-100-1001";
// Hosted workspace ancestry is not a private source boundary. Use only a fresh
// disposable runner fixture; never mutate the workspace/drive ACL or production policy.
const hostedWindows=process.platform==="win32"&&process.env.GITHUB_ACTIONS==="true";
const hostedParent=hostedWindows?path.resolve(process.env.ProgramData!):undefined;
const fixtureBase=hostedParent?mkdtempSync(path.join(hostedParent,"NalandaK30ExportSynthetic-")):path.resolve("../../tmp/k30-export-bridge-1a/fixtures");
mkdirSync(fixtureBase,{recursive:true,mode:0o700});
function removeHostedFixture(){if(!hostedParent||path.dirname(fixtureBase)!==hostedParent||!path.basename(fixtureBase).startsWith("NalandaK30ExportSynthetic-"))throw new Error("unsafe hosted cleanup");rmSync(fixtureBase,{recursive:true});expect(existsSync(fixtureBase)).toBe(false);}
if(hostedWindows)try{execFileSync("icacls.exe",[fixtureBase,"/inheritance:r","/grant:r",`*${sid}:(OI)(CI)F`,"*S-1-5-18:(OI)(CI)F","*S-1-5-32-544:(OI)(CI)F"],{stdio:"pipe",windowsHide:true});}catch(e){removeHostedFixture();throw e;}
afterAll(()=>{if(hostedParent){try{expect(readdirSync(fixtureBase)).toEqual([]);}finally{removeHostedFixture();}}});
function fixture() {
  const root=mkdtempSync(path.join(fixtureBase,"nps-k30-export-synthetic-"));dirs.push(root);
  const source=path.join(root,"source"),data=path.join(root,"private");mkdirSync(source,{mode:0o700});mkdirSync(data,{mode:0o700});
  if (process.platform==="win32") execFileSync("icacls.exe",[source,"/inheritance:r","/grant:r",`*${sid}:(OI)(CI)F`,"*S-1-5-18:(OI)(CI)F","*S-1-5-32-544:(OI)(CI)F"],{stdio:"pipe",windowsHide:true});
  const input:ExportInput={sourceDirectory:source,sourceAccessSids:[sid],staleAfterMs:60_000,profile:profile()};
  const file=path.join(source,"K30_2026.csv"),qfile=path.join(data,"queue.enc"),q=new EncryptedDurableQueue(qfile,key);
  const config:BridgeConfig={bridgeId:id,erpUrl:"https://example.invalid",privateKeyPath:path.join(data,"key.jwk"),queuePath:qfile,healthPath:path.join(data,"health.json"),pollIntervalMs:5000,transportEnabled:false,syntheticOnly:true,devices:[{deviceId:id,host:"127.0.0.1",port:1,profile:EXPORT_PROFILE,exportInput:input}]};
  const put=(content=bytes(),target=file)=>writeFileSync(target,content,{mode:0o600});
  const ingest=()=>q.commitExport(acquireExport(file,input,id));
  process.env.NALANDA_BIOMETRIC_QUEUE_KEY=key;
  return {root,source,data,input,file,qfile,q,config,put,ingest};
}
afterEach(()=>{for(const d of dirs.splice(0)){if(!path.resolve(d).startsWith(fixtureBase+path.sep)||!path.basename(d).startsWith("nps-k30-export-synthetic-"))throw new Error("unsafe test cleanup");rmSync(d,{recursive:true,force:true});expect(existsSync(d)).toBe(false);}});
it("validates actual private Windows source ACL with a positive control",()=>{
  const f=fixture();expect(selectedFiles(f.input)).toEqual([]);
});
it("ingests actual files through service dispatch into encrypted queue without changing the source",async()=>{
  const f=fixture();f.put();const original=readFileSync(f.file);await runBridgeCycle(f.config);
  expect(f.q.load()).toHaveLength(1);expect(readFileSync(f.qfile,"utf8")).not.toContain("0007");expect(readFileSync(f.file)).toEqual(original);
  expect(JSON.parse(readFileSync(f.config.healthPath,"utf8")).exportSources[0].state).toBe("QUEUE_HELD");
  expect(Object.values(new EncryptedDurableQueue(f.qfile,key).exportLedger().observations)[0]).toMatchObject({localTimestamp:"2026-10-02 09:00:00",timezone:"Asia/Kolkata",utcTimestamp:"2026-10-02T03:30:00.000Z"});
});
it("deduplicates byte-identical content after close/reopen and unchanged rename",()=>{
  const f=fixture();f.put();f.ingest();const renamed=path.join(f.source,"K30_renamed.csv");renameSync(f.file,renamed);
  const reopened=new EncryptedDurableQueue(f.qfile,key);expect(reopened.commitExport(acquireExport(renamed,f.input,id)).changed).toBe(false);expect(reopened.load()).toHaveLength(1);
});
it("accepts append tails while preserving established prefix observations",()=>{
  const f=fixture();f.put();f.ingest();appendFileSync(f.file,"0010,2026-10-02 09:01:00,SYN-LOCAL-01,IN\r\n");
  expect(f.ingest()).toMatchObject({accepted:1,replayed:1,review:0});expect(f.q.load()).toHaveLength(2);
});
it("retains reordered overlapping history and genuine same-second observations for review",()=>{
  const f=fixture();const a="0007,2026-10-02 09:00:00,SYN-LOCAL-01,IN",b="0010,2026-10-02 09:00:00,SYN-LOCAL-01,IN";
  f.put(bytes([a,b]));f.ingest();f.put(bytes([b,a,a]));expect(f.ingest()).toMatchObject({review:3,accepted:0});
  expect(f.q.load()).toHaveLength(5);expect(f.q.prepareBatch()).toBeUndefined();expect(Object.values(f.q.exportLedger().files).reduce((n,x)=>n+x.review,0)).toBe(3);
});
it("replacement/truncation and rollover accept new late older punches without timestamp cursors",()=>{
  const f=fixture();f.put();f.ingest();const replacement=path.join(f.source,"K30_temp.txt");f.put(bytes(["0010,2026-09-01 07:00:00,SYN-LOCAL-01,IN"]),replacement);renameSync(replacement,f.file);
  expect(f.ingest().accepted).toBe(1);expect(f.q.load()[1].punchTimestamp).toBe("2026-09-01T07:00:00+05:30");
});
it("defers incomplete exports without a checkpoint",()=>{
  const f=fixture();f.put(bytes().subarray(0,-1));expect(f.ingest).toThrow("INCOMPLETE_WRITE");expect(existsSync(f.qfile)).toBe(false);
  appendFileSync(f.file,"\n");expect(f.ingest().accepted).toBe(1);
});
it("detects same-size writes during acquisition independently of a quiet timer",()=>{
  const f=fixture();f.put();expect(()=>acquireExport(f.file,f.input,id,()=>f.put(bytes(["0010,2026-10-02 09:00:00,SYN-LOCAL-01,IN"])))).toThrow("SOURCE_CHANGED");expect(existsSync(f.qfile)).toBe(false);
});
it("detects truncation during acquisition without consuming a prefix",()=>{
  const f=fixture();f.put();expect(()=>acquireExport(f.file,f.input,id,()=>writeFileSync(f.file,"x"))).toThrow("SOURCE_CHANGED");expect(f.q.size()).toBe(0);
});
it("retains unknown staff/device/direction rejection counts in encrypted metadata",()=>{
  const f=fixture();f.put(bytes(["0008,2026-10-02 09:00:00,SYN-LOCAL-01,IN","0007,2026-10-02 09:00:00,wrong,IN","0007,2026-10-02 09:00:00,SYN-LOCAL-01,0"]));
  expect(f.ingest()).toMatchObject({accepted:0,rejected:3});expect(Object.values(f.q.exportLedger().files)[0].issues).toHaveLength(3);expect(f.q.load()).toHaveLength(0);
  expect(f.ingest().changed).toBe(false);expect(readFileSync(f.qfile,"utf8")).not.toContain("0008");
});
it("holds UNKNOWN and conflicting directions, including an already prepared immutable body",()=>{
  const f=fixture();f.put();f.ingest();const before=f.q.prepareBatch()!.body;f.put(bytes(["0007,2026-10-02 09:00:00,SYN-LOCAL-01,OUT"]));f.ingest();expect(f.q.prepareBatch()).toBeUndefined();
  expect(()=>f.q.resumeHeldBatch()).toThrow("SOURCE_REVIEW_REQUIRED");expect(f.q.prepareBatch()).toBeUndefined();expect(before).toContain('"punchCode":"IN"');
  const envelope=JSON.parse(readFileSync(f.qfile,"utf8")),decipher=createDecipheriv("aes-256-gcm",Buffer.from(key,"base64url"),Buffer.from(envelope.iv,"base64url"));decipher.setAAD(Buffer.from("nalanda-biometric-queue-v1"));decipher.setAuthTag(Buffer.from(envelope.tag,"base64url"));
  const state=JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext,"base64url")),decipher.final()]).toString());expect(state.batch.body).toBe(before);expect(state.batch.sourceReviewRequired).toBe(true);
});
it("bounds directory enumeration and cleans private atomic-write residue after failed rename",()=>{
  const f=fixture();for(let i=0;i<257;i++)f.put(Buffer.from("x"),path.join(f.source,`ignored-${i}.bin`));expect(()=>selectedFiles(f.input)).toThrow("DIRECTORY_CAPACITY");
  const blocked=path.join(f.data,"blocked");mkdirSync(blocked);writeFileSync(path.join(blocked,"keep"),"synthetic");expect(()=>atomicWrite(blocked,"private-synthetic-value")).toThrow();expect(readdirSync(f.data).filter(x=>x.endsWith(".partial"))).toEqual([]);expect(readFileSync(path.join(blocked,"keep"),"utf8")).toBe("synthetic");
});
it("upgrades/reopens old queue state additively and preserves disk/capacity failure state",()=>{
  const f=fixture();f.put();const s=acquireExport(f.file,f.input,id);
  const small=new EncryptedDurableQueue(f.qfile,key,10);expect(()=>small.commitExport(s)).toThrow("CAPACITY");expect(existsSync(f.qfile)).toBe(false);
  const full=new EncryptedDurableQueue(f.qfile,key,32*1024*1024,()=>{throw Object.assign(new Error("ENOSPC"),{code:"ENOSPC"});});expect(()=>full.commitExport(s)).toThrow("ENOSPC");expect(existsSync(f.qfile)).toBe(false);
  f.q.append([{...s.rows[0].event!,protocolProfile:"GENERIC_CSV_IMPORT",eventReference:"prior-synthetic",queuedAt:s.observedAt,localState:"QUEUED",attemptCount:0}]);
  expect(f.q.exportLedger().version).toBe(1);f.q.commitExport(s);expect(new EncryptedDurableQueue(f.qfile,key).load()).toHaveLength(2);
  writeFileSync(f.qfile,"corrupt");expect(()=>f.q.commitExport(s)).toThrow("AUTH_OR_CORRUPTION");expect(readFileSync(f.qfile,"utf8")).toBe("corrupt");
});
it.each(["before","after"])("HARNESS_ONLY process exit %s atomic queue commit replays without loss/duplicate",stage=>{
  const f=fixture();f.put();const s=acquireExport(f.file,f.input,id),snapshot=path.join(f.data,"snapshot.json"),helper=path.join(f.data,"crash.mjs");writeFileSync(snapshot,JSON.stringify(s));
  const queueUrl=new URL("./encrypted-queue.ts",import.meta.url).href,atomicUrl=new URL("./atomic-file.ts",import.meta.url).href;
  writeFileSync(helper,`import {readFileSync} from 'node:fs';import {EncryptedDurableQueue} from ${JSON.stringify(queueUrl)};import {atomicWrite} from ${JSON.stringify(atomicUrl)};const [file,key,snapshot,stage]=process.argv.slice(2);new EncryptedDurableQueue(file,key,33554432,(p,v)=>{if(stage==='before')process.exit(77);atomicWrite(p,v);process.exit(78)}).commitExport(JSON.parse(readFileSync(snapshot,'utf8')));`);
  const run=spawnSync(process.execPath,["--import","tsx",helper,f.qfile,key,snapshot,stage],{encoding:"utf8",windowsHide:true});expect(run.status,run.stderr).toBe(stage==="before"?77:78);
  const reopened=new EncryptedDurableQueue(f.qfile,key);reopened.commitExport(s);expect(reopened.load()).toHaveLength(1);expect(Object.keys(reopened.exportLedger().files)).toHaveLength(1);
});
it("refuses source links and output/key/package overlap",()=>{
  const f=fixture();expect(()=>assertSourceBoundary(f.source,[f.root])).toThrow("BOUNDARY");expect(()=>assertSourceBoundary(path.resolve("."),[])).toThrow("BOUNDARY");
  const link=path.join(f.root,"linked");symlinkSync(f.source,link,process.platform==="win32"?"junction":"dir");expect(()=>selectedFiles({...f.input,sourceDirectory:link})).toThrow("REPARSE");
});
it("refuses public source permissions",()=>{
  const f=fixture();if(process.platform==="win32")execFileSync("icacls.exe",[f.source,"/grant","*S-1-1-0:(OI)(CI)R"],{stdio:"pipe",windowsHide:true});else chmodSync(f.source,0o755);
  expect(()=>selectedFiles(f.input)).toThrow("ACCESS_REFUSED");
});
it("preview validates config without queue writes or identifier/path output",()=>{
  const f=fixture();f.put();const cfg=path.join(f.data,"bridge.json");writeFileSync(cfg,JSON.stringify({...f.config,privateKeyPath:"key.jwk",queuePath:"queue.enc",healthPath:"health.json"}));
  expect(loadBridgeConfig(cfg).devices[0].profile).toBe(EXPORT_PROFILE);const result=JSON.stringify(previewExport(cfg));expect(result).toContain('"validRows":1');expect(result).not.toContain("0007");expect(result).not.toContain(f.source);expect(existsSync(f.qfile)).toBe(false);
});
it("rejects Windows case aliases between queue, health and key outputs",()=>{
  const f=fixture(),cfg=path.join(f.data,"bridge.json");writeFileSync(cfg,JSON.stringify({...f.config,privateKeyPath:"key.jwk",queuePath:"Queue.enc",healthPath:"queue.enc"}));expect(()=>loadBridgeConfig(cfg)).toThrow("PATH_COLLISION");
});
it.each(["queue.enc.pid.lock","queue.enc.pid.lock.acquire","queue.enc.pid.lock.acquire/nested.json"])("reserves queue-derived ownership paths: %s",healthPath=>{
  const f=fixture(),cfg=path.join(f.data,"bridge.json");writeFileSync(cfg,JSON.stringify({...f.config,privateKeyPath:"key.jwk",queuePath:"queue.enc",healthPath}));expect(()=>loadBridgeConfig(cfg)).toThrow("PATH_COLLISION");
});
it("rejects protected output junction aliases before a health write can replace the queue",()=>{
  const f=fixture(),alias=path.join(f.data,"alias"),cfg=path.join(f.data,"bridge.json"),store=path.join(f.data,"store");mkdirSync(store);symlinkSync(store,alias,process.platform==="win32"?"junction":"dir");
  writeFileSync(cfg,JSON.stringify({...f.config,privateKeyPath:"key.jwk",queuePath:"store/q.enc",healthPath:"alias/q.enc"}));expect(()=>loadBridgeConfig(cfg)).toThrow("REPARSE");expect(existsSync(path.join(store,"q.enc"))).toBe(false);
});
it("holds a new source conflict even when its original batch was already transport-held",()=>{
  const f=fixture();f.put();f.ingest();f.q.prepareBatch();f.q.batchFailed("BRIDGE_ACK_INVALID");f.put(bytes(["0007,2026-10-02 09:00:00,SYN-LOCAL-01,OUT"]));f.ingest();expect(()=>f.q.resumeHeldBatch()).toThrow("SOURCE_REVIEW_REQUIRED");
});
it("unsafe matching entries are refused individually while safe files ingest",async()=>{
  const f=fixture();mkdirSync(path.join(f.source,"K30_0-directory.csv"));f.put(bytes(),path.join(f.source,"K30_0 space.csv"));f.put();await runBridgeCycle(f.config);expect(f.q.load()).toHaveLength(1);expect(Object.keys(f.q.exportLedger().refusals!)).toHaveLength(2);
});
it("growth after permission planning is deferred and actual handle size enforces remaining bytes",()=>{
  const f=fixture();f.put();const {lease}=openExportScan(f.input);appendFileSync(f.file,"0010,2026-10-02 09:01:00,SYN-LOCAL-01,IN\r\n");expect(()=>acquireExport(f.file,f.input,id,undefined,lease)).toThrow("SOURCE_CHANGED");
  expect(()=>acquireExport(f.file,f.input,id,undefined,undefined,1)).toThrow("CYCLE_CAPACITY");expect(existsSync(f.qfile)).toBe(false);
});
it("bad files retain bounded private refusal metadata and do not starve later valid files",async()=>{
  const f=fixture();f.put(Buffer.from("wrong,header\nrow\n"),path.join(f.source,"K30_0-bad.csv"));f.put();await runBridgeCycle(f.config);
  expect(f.q.load()).toHaveLength(1);expect(Object.values(f.q.exportLedger().refusals!)[0].code).toBe("EXPORT_HEADER_MISMATCH");
  const health=readFileSync(f.config.healthPath,"utf8");expect(health).toContain("PROFILE_MISMATCH");expect(health).not.toContain("K30_0-bad");expect(health).not.toContain("0007");
});
it("oversized candidates advance fair scan progress without reading their content",async()=>{
  const f=fixture();for(let i=0;i<8;i++){const p=path.join(f.source,`K30_0${i}.csv`);f.put(Buffer.from("x"),p);truncateSync(p,2*1024*1024+1);}f.put();
  await runBridgeCycle(f.config);expect(f.q.load()).toHaveLength(0);expect(f.q.exportScan()).toBe(8);
  await runBridgeCycle(f.config);expect(f.q.load()).toHaveLength(1);expect(Object.keys(f.q.exportLedger().refusals!)).toHaveLength(8);
});
it("stale source uses committed byte novelty rather than a fresh service process or file mtime",async()=>{
  const f=fixture();f.put();const s=acquireExport(f.file,f.input,id);s.observedAt=new Date(Date.now()-120_000).toISOString();f.q.commitExport(s);await runBridgeCycle(f.config);
  expect(JSON.parse(readFileSync(f.config.healthPath,"utf8")).exportSources[0].state).toBe("STALE_SOURCE");
});
it("bounds preview double-read bytes before acquisition and excludes binary DAT by default",()=>{
  const f=fixture();for(let i=0;i<3;i++){const file=path.join(f.source,`K30_${i}.csv`);f.put(Buffer.alloc(2*1024*1024,10),file);}
  f.put(Buffer.from([0,1,2]),path.join(f.source,"K30_binary.dat"));const cfg=path.join(f.data,"bridge.json");writeFileSync(cfg,JSON.stringify({...f.config,privateKeyPath:"key.jwk",queuePath:"queue.enc",healthPath:"health.json"}));
  expect(previewExport(cfg)).toMatchObject({fileCount:3,inspectedFiles:2});expect(existsSync(f.qfile)).toBe(false);
});
it("source states separate no files, incomplete reading, stale and transport hold",async()=>{
  const f=fixture();await runBridgeCycle(f.config);expect(JSON.parse(readFileSync(f.config.healthPath,"utf8")).exportSources[0].state).toBe("WAITING_NO_FILES");
  f.put(bytes().subarray(0,-1));await runBridgeCycle(f.config);expect(JSON.parse(readFileSync(f.config.healthPath,"utf8")).exportSources[0].state).toBe("READING");
});
it("actual file -> queue -> reopen -> real signing -> synthetic receiver preserves lost-ACK body",async()=>{
  const f=fixture();f.put();f.ingest();const pair=generateKeyPairSync("ed25519");writeFileSync(f.config.privateKeyPath,JSON.stringify(pair.privateKey.export({format:"jwk"})),{mode:0o600});
  const batch=new EncryptedDurableQueue(f.qfile,key).prepareBatch()!,bodies:string[]=[];let signatureValid=true;
  const server=createServer(async(req,res)=>{const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));const body=Buffer.concat(chunks).toString();bodies.push(body);const h=req.headers,hash=createHash("sha256").update(body).digest("hex");
    const message=["nalanda-biometric-request-v1","POST","/api/biometric/ingest",h["x-nalanda-biometric-timestamp"],h["x-nalanda-biometric-nonce"],hash,id,"1","1"].join("\n");signatureValid&&=verify(null,Buffer.from(message),pair.publicKey,Buffer.from(String(h["x-nalanda-biometric-signature"]),"base64url"));
    if(bodies.length===1){req.socket.destroy();return;}const p=JSON.parse(body);res.writeHead(202,{"Content-Type":"application/json"});res.end(JSON.stringify({schemaVersion:1,batchReference:p.batchReference,status:"DUPLICATE_ACCEPTED",accepted:p.events.length,duplicates:p.events.length,exceptions:0,serverTime:new Date().toISOString()}));
  });await new Promise<void>(r=>server.listen(0,"127.0.0.1",r));
  try {const config={...f.config,transportEnabled:true,erpUrl:`http://127.0.0.1:${(server.address() as any).port}`};await expect(syncPreparedBatch(config,batch)).rejects.toThrow();const retry=new EncryptedDurableQueue(f.qfile,key).prepareBatch()!;expect(retry.body).toBe(batch.body);const ack=await syncPreparedBatch(config,retry);f.q.confirmBatch(retry.reference,ack.duplicate);expect(signatureValid).toBe(true);expect(bodies).toEqual([batch.body,batch.body]);expect(f.q.size()).toBe(0);}
  finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
});
