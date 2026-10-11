import { createHash, generateKeyPairSync, verify } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:http";
import { afterEach, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
import { unzipSync, strFromU8 } from "fflate";
import { EncryptedDurableQueue } from "./encrypted-queue.js";
import { simulateScenario } from "./adapters/simulator.js";
import { syncPreparedBatch, validateAcknowledgement } from "./sync.js";
import { runBridgeCycle, safeCode } from "./agent.js";
import { loadBridgeConfig } from "./config.js";
import { validateNormalizedEvent, type BridgeConfig, type QueueEvent } from "./contracts.js";
import { monthlyReportRows, renderMonthlyReport, validateMonthlyReport, type MonthlySummary, type ReportOrder } from "./monthly-report.js";
import { planMetadataReconciliation } from "./reconciliation-plan.js";
import { atomicWrite } from "./atomic-file.js";
import { parseGenericCsv } from "./adapters/csv.js";

const dirs: string[] = [], id = "00000000-0000-4000-8000-000000000001", key = Buffer.alloc(32, 7).toString("base64url");
function directory() { const dir = mkdtempSync(path.join(tmpdir(), "nalanda-companion-synthetic-")); dirs.push(dir); return dir; }
function punches(scenario: Parameters<typeof simulateScenario>[0] = "normal"): QueueEvent[] { return simulateScenario(scenario, id).map(e => ({ ...e, bridgeReceivedTimestamp: new Date().toISOString(), queuedAt: new Date().toISOString(), localState: "RECEIVED_FROM_DEVICE", attemptCount: 0 })); }
afterEach(() => { vi.useRealTimers(); for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

it("preserves byte-identical request body and immutable received time after crash/repeated poll", () => {
  const file = path.join(directory(), "queue.enc"), q = new EncryptedDurableQueue(file, key), events = punches(); q.append(events);
  const b = q.prepareBatch()!; q.append(events.map(e => ({ ...e, bridgeReceivedTimestamp: "2026-09-30T20:00:00.000Z" })));
  const restarted = new EncryptedDurableQueue(file, key);
  expect(restarted.prepareBatch()!.body).toBe(b.body); expect(restarted.load()[0].bridgeReceivedTimestamp).toBe(events[0].bridgeReceivedTimestamp);
  restarted.confirmBatch(b.reference, true); expect(restarted.size()).toBe(0);
});
it("retains more than 1000 rejected/review punches and fails closed with wrong key and corruption", () => {
  const file = path.join(directory(), "q.enc"), q = new EncryptedDurableQueue(file, key);
  q.append(punches("week-backlog")); for (let i = 0; i < 12; i++) q.markSendFailed(Math.min(100, q.peek().length), "BRIDGE_SYNC_REJECTED");
  expect(q.size()).toBe(1120); expect(q.load()).toHaveLength(1120);
  const bytes = readFileSync(file); expect(() => new EncryptedDurableQueue(file, Buffer.alloc(32, 8).toString("base64url")).load()).toThrow("AUTH_OR_CORRUPTION"); expect(readFileSync(file)).toEqual(bytes);
  writeFileSync(file, '{"broken":true}'); expect(() => q.load()).toThrow("AUTH_OR_CORRUPTION");
});
it("preserves original file after capacity/disk write failure and never advances a checkpoint", async () => {
  const dir = directory(), file = path.join(dir, "q.enc"), q = new EncryptedDurableQueue(file, key, 2000); q.append(punches()); const bytes = readFileSync(file);
  expect(() => q.append(punches("week-backlog"))).toThrow("CAPACITY"); expect(readFileSync(file)).toEqual(bytes);
  expect(() => atomicWrite(path.join(file, "impossible"), "data")).toThrow(); expect(readFileSync(file)).toEqual(bytes);
  const config: BridgeConfig = { bridgeId: id, erpUrl: "https://example.invalid", privateKeyPath: "unused", queuePath: file, healthPath: path.join(dir, "health.json"), pollIntervalMs: 60000, devices: [{ deviceId: id, host: "127.0.0.1", port: 1, profile: "SIMULATOR" }] };
  process.env.NALANDA_BIOMETRIC_QUEUE_KEY = key; let checkpoint = false;
  const result = await runBridgeCycle(config, undefined, () => ({ profile: "SIMULATOR", officialProtocolRequired: false, poll: async () => simulateScenario("week-backlog", id), acknowledgePoll: async () => { checkpoint = true; } }), () => q);
  expect(checkpoint).toBe(false); expect(result.lastErrorCode).toContain("CAPACITY"); expect(readFileSync(file)).toEqual(bytes);
  const full = new EncryptedDurableQueue(file, key, 2000, () => { throw Object.assign(new Error("disk full"), { code: "ENOSPC" }); });
  expect(() => full.append([{ ...punches()[0], sequenceNumber: 99 }])).toThrow("disk full"); expect(readFileSync(file)).toEqual(bytes);
});
it("holds ambiguous identities, changed sequence payloads and preserves reset epochs", () => {
  const q = new EncryptedDurableQueue(path.join(directory(), "q.enc"), key), events = punches(); q.append(events); q.append([{ ...events[0], punchCode: "UNKNOWN" }]);
  q.append([{ ...events[0], sequenceEpoch: 2 }]); q.append([{ ...events[0], sequenceNumber: null, eventReference: null }]);
  expect(q.size()).toBe(5); expect(q.load().filter(e => e.localState === "NEEDS_ADMIN_REVIEW")).toHaveLength(2);
  expect(JSON.parse(q.prepareBatch()!.body).events).toHaveLength(3);
});
it("rejects extra adapter fields and redacts exceptions", () => {
  expect(() => validateNormalizedEvent({ ...punches()[0], payload: { fingerprintTemplate: "forbidden" } } as any)).toThrow("PRIVACY");
  expect(safeCode(new Error("password=private-value"))).toBe("BRIDGE_OPERATION_FAILED");
});
it.each([{}, {schemaVersion:1,status:"ACCEPTED",accepted:1,duplicates:0,exceptions:0,batchReference:"batch-one",serverTime:new Date().toISOString()}, {schemaVersion:1,status:"ACCEPTED",accepted:2,duplicates:0,exceptions:0,batchReference:"wrong",serverTime:new Date().toISOString()}])("refuses malformed, partial, or unrelated ACK %#", r => {
  expect(() => validateAcknowledgement(r, "batch-one", 2)).toThrow("ACK_INVALID");
});
it("verifies real Ed25519 signed loopback batches, lost ACK replay, unknown-user exceptions and timeout", async () => {
  const dir = directory(), signing = generateKeyPairSync("ed25519"); writeFileSync(path.join(dir, "key.jwk"), JSON.stringify(signing.privateKey.export({format:"jwk"})));
  const q = new EncryptedDurableQueue(path.join(dir, "q.enc"), key); q.append(punches("unknown-staff")); const batch = q.prepareBatch()!, committed = new Map<string,string>(); let calls=0;
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk)); const body=Buffer.concat(chunks).toString();
    const hash=createHash("sha256").update(body).digest("hex"), h=req.headers;
    const message=["nalanda-biometric-request-v1","POST","/api/biometric/ingest",h["x-nalanda-biometric-timestamp"],h["x-nalanda-biometric-nonce"],hash,id,"1","1"].join("\n");
    expect(h["x-nalanda-biometric-body-sha256"]).toBe(hash); expect(verify(null,Buffer.from(message),signing.publicKey,Buffer.from(String(h["x-nalanda-biometric-signature"]),"base64url"))).toBe(true);
    const payload=JSON.parse(body), prior=committed.get(payload.batchReference); if(prior) expect(body).toBe(prior); committed.set(payload.batchReference,body); calls++;
    if(calls===1){ req.socket.destroy(); return; } if(calls===3) return;
    res.writeHead(202,{"Content-Type":"application/json"}); res.end(JSON.stringify({schemaVersion:1,batchReference:payload.batchReference,status:"DUPLICATE_ACCEPTED",accepted:payload.events.length,duplicates:payload.events.length,exceptions:0,serverTime:new Date().toISOString()}));
  }); await new Promise<void>(r=>server.listen(0,"127.0.0.1",r));
  const port=(server.address() as any).port, config:BridgeConfig={bridgeId:id,erpUrl:`http://127.0.0.1:${port}`,privateKeyPath:path.join(dir,"key.jwk"),queuePath:path.join(dir,"q.enc"),healthPath:path.join(dir,"health.json"),pollIntervalMs:60000,transportEnabled:true,syntheticOnly:true,devices:[]};
  try { await expect(syncPreparedBatch(config,batch)).rejects.toThrow(); expect(q.size()).toBe(batch.identities.length); const ack=await syncPreparedBatch(config,new EncryptedDurableQueue(config.queuePath,key).prepareBatch()!); q.confirmBatch(batch.reference,ack.duplicate); expect(q.size()).toBe(0); await expect(syncPreparedBatch(config,batch,undefined,50)).rejects.toThrow(); expect(committed.size).toBe(1); }
  finally { server.closeAllConnections(); await new Promise<void>(r=>server.close(()=>r())); }
});
it("retains queue on partial ACK and bounds retries across restart", () => {
  vi.useFakeTimers(); const q=new EncryptedDurableQueue(path.join(directory(),"q.enc"),key); q.append(punches()); q.prepareBatch(); q.batchFailed("BRIDGE_ACK_INVALID"); expect(q.prepareBatch()).toBeUndefined(); expect(q.size()).toBe(2); expect(q.history()).toHaveLength(2);
  const retry=new EncryptedDurableQueue(path.join(directory(),"q.enc"),key); retry.append(punches()); for(let i=0;i<20;i++){retry.prepareBatch();retry.batchFailed("BRIDGE_OPERATION_FAILED");vi.advanceTimersByTime(300000);} expect(retry.prepareBatch()).toBeUndefined(); expect(retry.size()).toBe(2);
});
it("explicitly resumes the same held batch and keeps deduplication after acknowledged history expires", () => {
  vi.useFakeTimers(); const file=path.join(directory(),"q.enc"), q=new EncryptedDurableQueue(file,key), events=punches();
  q.append(events); const batch=q.prepareBatch()!; q.batchFailed("BRIDGE_ACK_INVALID");
  new EncryptedDurableQueue(file,key).resumeHeldBatch(); expect(q.prepareBatch()!.body).toBe(batch.body);
  q.confirmBatch(batch.reference,false); vi.advanceTimersByTime(8*86400000);
  q.append(events); q.append(events); expect(q.size()).toBe(0); expect(q.prepareBatch()).toBeUndefined();
  q.append([{...events[0],punchCode:"UNKNOWN"}]); expect(q.size()).toBe(1); expect(q.history()[0].lastErrorCode).toContain("RETIRED_IDENTITY_CONFLICT");
});
it("preserves exact device user, original timezone timestamp and unknown direction for CSV input", () => {
  const header="opaqueDeviceUserId,punchTimestamp,verificationMethod,punchCode,statusCode,sequenceNumber,sequenceEpoch,eventReference";
  const [event]=parseGenericCsv(header+"\n0007,2026-08-03T09:07:00+05:30,CARD,UNKNOWN,,12,1,",id);
  expect(event.opaqueDeviceUserId).toBe("0007"); expect(event.punchTimestamp).toBe("2026-08-03T09:07:00+05:30");expect(event.punchCode).toBe("UNKNOWN");expect(event.estimatedClockDriftSeconds).toBeNull();
  expect(()=>parseGenericCsv(header+"\n0007,2026-08-03T09:07:00.000,CARD,UNKNOWN,,12,1,",id)).toThrow("TIMESTAMP_INVALID");
});
it("keeps successful device poll, punch and ACK health separate from an unavailable adapter", async () => {
  const dir=directory(), config:BridgeConfig={bridgeId:id,erpUrl:"https://example.invalid",privateKeyPath:"unused",queuePath:path.join(dir,"q.enc"),healthPath:path.join(dir,"health.json"),pollIntervalMs:60000,devices:[{deviceId:id,host:"127.0.0.1",port:1,profile:"SIMULATOR"}]};process.env.NALANDA_BIOMETRIC_QUEUE_KEY=key;
  await runBridgeCycle(config); const first=JSON.parse(readFileSync(config.healthPath,"utf8")); expect(first.lastPollAt).toBeTruthy();expect(first.lastPunchAt).toBeTruthy();expect(first.lastSyncAt).toBeUndefined();
  config.devices[0].profile="ESSL_ZK_LAN_SDK"; await runBridgeCycle(config);const next=JSON.parse(readFileSync(config.healthPath,"utf8")); expect(next.status).toBe("DEGRADED");expect(next.adapterUnavailable).toBe(true);expect(next.lastPollAt).toBe(first.lastPollAt);expect(next.lastSyncAt).toBeUndefined();
});

export function reportFixtures(): { summary: MonthlySummary; order: ReportOrder } {
  return { summary:{schemaVersion:1,month:"2026-08",sourceRevision:"SYNTHETIC-REV-1",review:{status:"APPROVED",reviewerReference:"SYNTHETIC-REVIEWER",reviewedAt:"2026-09-01T00:00:00Z",synthetic:true},staff:[{staffReference:"SYN-1",leaves:0.5,lates:0,remarks:"Approved half day",evidenceReferences:["SYN-E1"]},{staffReference:"SYN-2",leaves:0,lates:1.5,remarks:"",evidenceReferences:[]},{staffReference:"SYN-3",leaves:2.5,lates:1,remarks:"=literal approved evidence",evidenceReferences:["SYN-E3"]}]},order:{schemaVersion:1,version:"SYNTHETIC-ORDER-1",month:"2026-08",approvalReference:"SYNTHETIC-APPROVAL",synthetic:true,rows:[{staffReference:"SYN-1",displayName:"Zeta Synthetic",group:"Teaching",include:true,position:2},{staffReference:"SYN-2",displayName:"Alpha Synthetic",group:"Non-Teaching",include:true,position:1},{staffReference:"SYN-3",displayName:"Beta Synthetic",group:"Teaching",include:true,position:1}]} };
}
it("reads back exact groups/order and numeric 0/0.5/1/1.5/2.5 with literal text and unchanged source", () => {
  const dir=directory(),{summary,order}=reportFixtures(),source=path.join(dir,"summary.json"),manifest=path.join(dir,"order.json"),output=path.join(dir,"report.xlsx");writeFileSync(source,JSON.stringify(summary));writeFileSync(manifest,JSON.stringify(order));const before=readFileSync(source);
  renderMonthlyReport(source,manifest,"2026-08",output,"synthetic"); const workbook=XLSX.read(readFileSync(output),{type:"buffer"}),sheet=workbook.Sheets.Attendance;
  expect(sheet.A1.v).toBe("Month: August 2026"); expect(sheet.B5.v).toBe("Beta Synthetic");expect(sheet.B6.v).toBe("Zeta Synthetic");expect(sheet.C6).toMatchObject({t:"n",v:0.5}); expect(sheet.C10).toMatchObject({t:"n",v:0});expect(sheet.D10).toMatchObject({t:"n",v:1.5});expect(sheet.C5).toMatchObject({t:"n",v:2.5});expect(sheet.D5).toMatchObject({t:"n",v:1});expect(sheet.E5).toMatchObject({t:"s",v:"=literal approved evidence"});expect(Object.values(sheet).some(c=>(c as any)?.f)).toBe(false);expect(readFileSync(source)).toEqual(before);
  expect(JSON.parse(readFileSync(`${output}.manifest.json`,"utf8")).sourceRevision).toBe("SYNTHETIC-REV-1"); expect(()=>renderMonthlyReport(source,manifest,"2026-08",path.join(dir,"final.xlsx"),"final-approved")).toThrow("NOT_REAL_AUTHORITY");
});
it("reports unknown values, missing/extra/duplicate mappings, wrong month and unapproved remarks", () => {
  const {summary,order}=reportFixtures();summary.staff[0].leaves=null;summary.staff[0].evidenceReferences=[];order.rows[0].position=1;order.rows.push({...order.rows[0]});summary.staff.push({...summary.staff[0],staffReference:"EXTRA"});order.rows.push({...order.rows[0],staffReference:"MISSING"});
  expect(validateMonthlyReport(summary,order,"2026-09").issues).toEqual(expect.arrayContaining(["MONTH_MISMATCH","DUPLICATE_POSITION","DUPLICATE_STAFF_ID","MISSING_SUMMARY","EXTRA_EMPLOYEE","UNRESOLVED_NUMERIC_VALUE","REMARK_EVIDENCE_MISSING"]));
});
it("preserves empty sections and long literal names/remarks consistently", () => {
  const {summary,order}=reportFixtures();order.rows.forEach(r=>r.group="Teaching");order.rows.forEach((r,i)=>r.position=i+1);order.rows[0].displayName="=A long synthetic name ".repeat(5);summary.staff[0].remarks="Approved long evidence ".repeat(50);
  expect(monthlyReportRows(summary,order,"2026-08")).toEqual(monthlyReportRows(summary,order,"2026-08")); expect(monthlyReportRows(summary,order,"2026-08").at(-3)).toEqual(["Non-Teaching Staff"]);
});
it("keeps metadata plans non-executable and outages non-destructive", () => {
  const input={remoteAvailable:true,localRevision:"L1",remoteRevision:"R1",now:"2026-10-01T00:00:00Z",expiresAt:"2026-10-01T01:00:00Z"},local=[{staffReference:"SYN-1",deviceUserId:"0001",displayName:"Synthetic",revision:"L1"}];
  expect(planMetadataReconciliation(local,[],{...input,remoteAvailable:false})).toEqual({status:"UNAVAILABLE",actions:[]}); expect(planMetadataReconciliation(local,[],input)).toMatchObject({executable:false,actions:[{proposal:"REVIEW_MAPPING"}]});expect(()=>planMetadataReconciliation(local,[],{...input,expiresAt:input.now})).toThrow("EXPIRED");
});
it("fits long approved names with short remarks and explicit multiline remarks", () => {
  const {summary,order}=reportFixtures(),dir=directory(),source=path.join(dir,"summary.json"),manifest=path.join(dir,"order.json"),output=path.join(dir,"long.xlsx");
  order.rows.find(r=>r.staffReference==="SYN-3")!.displayName="Long synthetic name ".repeat(9);
  summary.staff.find(r=>r.staffReference==="SYN-3")!.remarks="Approved";
  summary.staff.find(r=>r.staffReference==="SYN-1")!.remarks="Approved\nline two\nline three\nline four";
  writeFileSync(source,JSON.stringify(summary));writeFileSync(manifest,JSON.stringify(order));renderMonthlyReport(source,manifest,"2026-08",output,"synthetic");
  const xml=strFromU8(unzipSync(readFileSync(output))["xl/worksheets/sheet1.xml"]);
  expect(Number(xml.match(/<row\b[^>]*r="5"[^>]*\bht="([^"]+)"/)![1])).toBeGreaterThanOrEqual(98);
  expect(Number(xml.match(/<row\b[^>]*r="6"[^>]*\bht="([^"]+)"/)![1])).toBeGreaterThanOrEqual(68);
});
