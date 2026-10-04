import type { QueueEvent } from "./contracts.js";
import { digest, type ExportSnapshot } from "./export-profile.js";

export type AcquiredExport = ExportSnapshot & { sourceKey: string; incarnation: string };
type FileReceipt = { observedAt: string; rows: number; accepted: number; rejected: number; review: number; replayed: number; issues: Array<{ line: number; rowHash: string; code: string }> };
type SourceReceipt = { incarnation: string; profileHash: string; bytes: number; rowHashes: string[] };
type Observation = { profileHash: string; fileHash: string; line: number; localTimestamp: string; timezone: string; utcTimestamp: string; subjectHash: string };
export type ExportLedger = { version: 1; files: Record<string, FileReceipt>; sources: Record<string, SourceReceipt>; observations: Record<string, Observation>; subjects: Record<string, string>; refusals?:Record<string,{code:string;observedAt:string}>; lastNewFileAt?: string };
export const emptyExportLedger = (): ExportLedger => ({version:1,files:{},sources:{},observations:{},subjects:{}});
const hash=/^[a-f0-9]{64}$/;
export function validateExportLedger(l: ExportLedger) {
  if (!l || l.version!==1 || !l.files || !l.sources || !l.observations || !l.subjects || Object.keys(l.files).length>4096 || Object.keys(l.sources).length>256 || Object.keys(l.observations).length>100_000 || Object.keys(l.subjects).length>100_000) throw new Error("EXPORT_LEDGER_INVALID");
  if (l.refusals && (Object.keys(l.refusals).length>256 || Object.entries(l.refusals).some(([k,v])=>!hash.test(k)||!/^EXPORT_[A-Z_]+$/.test(v.code)||typeof v.observedAt!=="string"))) throw new Error("EXPORT_LEDGER_INVALID");
  for (const [key,f] of Object.entries(l.files)) if (!hash.test(key) || ![f.rows,f.accepted,f.rejected,f.review,f.replayed].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=20_000) || f.rows!==f.accepted+f.rejected+f.review+f.replayed || !Array.isArray(f.issues) || f.issues.length!==f.rejected+f.review || f.issues.some(i=>!Number.isSafeInteger(i.line)||i.line<1||!hash.test(i.rowHash)||!/^EXPORT_[A-Z_]+$/.test(i.code))) throw new Error("EXPORT_LEDGER_INVALID");
  for (const [key,s] of Object.entries(l.sources)) if (!hash.test(key)||!hash.test(s.incarnation)||!hash.test(s.profileHash)||!Number.isSafeInteger(s.bytes)||s.bytes<1||s.bytes>2*1024*1024||!Array.isArray(s.rowHashes)||s.rowHashes.length>20_000||s.rowHashes.some(h=>!hash.test(h))) throw new Error("EXPORT_LEDGER_INVALID");
  for (const [ref,o] of Object.entries(l.observations)) if (!/^export-(v1|review)-[a-f0-9]{64}$/.test(ref)||!hash.test(o.profileHash)||!hash.test(o.fileHash)||!hash.test(o.subjectHash)||!Number.isSafeInteger(o.line)||o.line<1||o.localTimestamp.length>40||!["UTC","Asia/Kolkata"].includes(o.timezone)||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.000Z$/.test(o.utcTimestamp)) throw new Error("EXPORT_LEDGER_INVALID");
  for (const [key,ref] of Object.entries(l.subjects)) if (!hash.test(key)||!Object.hasOwn(l.observations,ref)) throw new Error("EXPORT_LEDGER_INVALID");
}
export function applyExport(l: ExportLedger, events: QueueEvent[], s: AcquiredExport) {
  const fileKey=digest(`${s.profileHash}:${s.fileHash}`);
  if (Object.hasOwn(l.files,fileKey)) return {changed:false, accepted:0, rejected:0, review:0, replayed:s.rows.length};
  const receipt: FileReceipt={observedAt:s.observedAt,rows:s.rows.length,accepted:0,rejected:0,review:0,replayed:0,issues:[]};
  const previous=l.sources[s.sourceKey];
  const append = previous && previous.incarnation===s.incarnation && previous.profileHash===s.profileHash && s.bytes>previous.bytes && previous.rowHashes.length<=s.rows.length && previous.rowHashes.every((h,i)=>h===s.rows[i].rowHash);
  const conflictReferences = new Set<string>();
  for (const [i,row] of s.rows.entries()) {
    if (append && i<previous.rowHashes.length) { receipt.replayed++; continue; }
    if (!row.event) { receipt.rejected++; receipt.issues.push({line:row.line,rowHash:row.rowHash,code:row.rejection??"EXPORT_ROW_INVALID"}); continue; }
    const ref=row.event.eventReference!, subject=row.subjectHash!;
    const repeated=Object.hasOwn(l.observations,ref), conflict=Object.hasOwn(l.subjects,subject);
    const code=repeated ? "EXPORT_REPEAT_IDENTITY_REVIEW" : conflict ? "EXPORT_SAME_SECOND_CONFLICT_REVIEW" : row.event.punchCode==="UNKNOWN" ? "EXPORT_DIRECTION_UNKNOWN_REVIEW" : undefined;
    // Retain every unprovable repeat as a distinct held observation, never silently
    // discard a possible legitimate same-second punch or invent a hardware ID.
    const eventReference=code?`export-review-${digest(`${s.profileHash}:${s.fileHash}:${row.line}`)}`:ref;
    if (code) { receipt.review++; receipt.issues.push({line:row.line,rowHash:row.rowHash,code}); if (conflict) conflictReferences.add(l.subjects[subject]); }
    else receipt.accepted++;
    events.push({...row.event,eventReference,queuedAt:s.observedAt,localState:code?"NEEDS_ADMIN_REVIEW":"QUEUED",attemptCount:0,...(code?{lastErrorCode:code}:{})});
    l.observations[eventReference]={profileHash:s.profileHash,fileHash:s.fileHash,line:row.line,localTimestamp:row.localTimestamp!,timezone:s.timezone,utcTimestamp:row.utcTimestamp!,subjectHash:subject};
    // First observation's identity remains stable even when its semantics are held.
    if (!conflict) l.subjects[subject]=eventReference;
  }
  for (const e of events) if (e.eventReference && conflictReferences.has(e.eventReference) && ["QUEUED","RECEIVED_FROM_DEVICE","SENDING","NEEDS_ADMIN_REVIEW"].includes(e.localState)) { e.localState="NEEDS_ADMIN_REVIEW"; e.lastErrorCode="EXPORT_SAME_SECOND_CONFLICT_REVIEW"; }
  l.files[fileKey]=receipt;
  l.sources[s.sourceKey]={incarnation:s.incarnation,profileHash:s.profileHash,bytes:s.bytes,rowHashes:s.rows.map(r=>r.rowHash)};
  l.lastNewFileAt=s.observedAt;
  validateExportLedger(l);
  return {changed:true,accepted:receipt.accepted,rejected:receipt.rejected,review:receipt.review,replayed:receipt.replayed,conflictReferences};
}
