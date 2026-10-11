import { closeSync, constants, fstatSync, fsyncSync, lstatSync, openSync, readSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadBridgeConfig } from "./config.js";
import { safeCode } from "./agent.js";
import { acquireExportWithBytes, assertNoLinks, assertSourceAccess, assertSourceBoundary, pathsOverlap } from "./export-source.js";
import { digest, EXPORT_LIMITS, EXPORT_PROFILE, exportProfileHash, parseExport, type ExportInput } from "./export-profile.js";
import type { AcquiredExport } from "./export-ledger.js";

type Interval = { from: string; to: string };
type Observation = { opaqueDeviceUserId: string; punchTimestamp: string; punchCode: "IN" | "OUT" | "UNKNOWN"; count: number };
export type ComparisonRequest = { schemaVersion: 1; file: string; compareFile?: string; previousReport?: string; interval: Interval; operator?: { origin: "OPERATOR_SOURCE_VIEW"; reference: string; totalRows?: number; inRows?: number; outRows?: number; observations?: Observation[] } };
type Capture = { snapshot: AcquiredExport; bytes: Buffer };
type RowReview = { line: number; rowHash: string; state: "COMPATIBLE" | "HELD_FOR_REVIEW" | "REJECTED"; code?: string };
const count = (v: unknown) => Number.isSafeInteger(v) && Number(v) >= 0 && Number(v) <= EXPORT_LIMITS.rows;
function exact(value: unknown, keys: string[]) { if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(k=>!keys.includes(k))) throw new Error("EXPORT_REVIEW_REQUEST_INVALID"); }
function instant(v: unknown): v is string { return typeof v === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.000Z$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString() === v; }
function observationTime(v:unknown):v is string {return typeof v==="string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString()===v;}
export function validateComparisonRequest(value: unknown): ComparisonRequest {
  exact(value,["schemaVersion","file","compareFile","previousReport","interval","operator"]); const r=value as ComparisonRequest;
  if (r.schemaVersion!==1 || typeof r.file!=="string" || !path.isAbsolute(r.file) || (r.compareFile!==undefined && (typeof r.compareFile!=="string" || !path.isAbsolute(r.compareFile))) || (r.previousReport!==undefined && (typeof r.previousReport!=="string" || !path.isAbsolute(r.previousReport))) || (r.compareFile!==undefined && r.previousReport!==undefined)) throw new Error("EXPORT_REVIEW_REQUEST_INVALID");
  exact(r.interval,["from","to"]); if (!instant(r.interval.from)||!instant(r.interval.to)||r.interval.from>r.interval.to) throw new Error("EXPORT_REVIEW_INTERVAL_INVALID");
  if (r.operator!==undefined) {
    const o=r.operator; exact(o,["origin","reference","totalRows","inRows","outRows","observations"]);
    if(o.origin!=="OPERATOR_SOURCE_VIEW" || typeof o.reference!=="string" || !/^[A-Za-z0-9_-]{1,64}$/.test(o.reference) || [o.totalRows,o.inRows,o.outRows].some(v=>v!==undefined&&!count(v)) || (o.observations!==undefined && (!Array.isArray(o.observations)||o.observations.length>100))) throw new Error("EXPORT_REVIEW_OPERATOR_INVALID");
    for(const x of o.observations??[]) { exact(x,["opaqueDeviceUserId","punchTimestamp","punchCode","count"]); if(typeof x.opaqueDeviceUserId!=="string" || !/^[A-Za-z0-9._:@/-]{1,128}$/.test(x.opaqueDeviceUserId) || !instant(x.punchTimestamp) || x.punchTimestamp<r.interval.from || x.punchTimestamp>r.interval.to || !["IN","OUT","UNKNOWN"].includes(x.punchCode) || !count(x.count)) throw new Error("EXPORT_REVIEW_OPERATOR_INVALID"); }
    if([o.totalRows,o.inRows,o.outRows].every(v=>v===undefined)&&!o.observations?.length)throw new Error("EXPORT_REVIEW_OPERATOR_INVALID");
  }
  return r;
}
// No second export parser, durable ledger, signer or reconciliation authority.
// Every row remains represented; collision peers are all held, never collapsed.
export function analyzeComparison(current: Capture, previous: Capture | undefined, request: ComparisonRequest) {
  const classify=(s:AcquiredExport):RowReview[]=>{
    const subjects=new Map<string,number>(); for(const r of s.rows)if(r.subjectHash)subjects.set(r.subjectHash,(subjects.get(r.subjectHash)??0)+1);
    return s.rows.map(r=>({line:r.line,rowHash:r.rowHash,...(!r.event?{state:/STAFF_MAPPING_UNKNOWN|DIRECTION_UNRESOLVED|DEVICE_BINDING_MISMATCH/.test(r.rejection??"")?"HELD_FOR_REVIEW" as const:"REJECTED" as const,code:r.rejection??"EXPORT_ROW_INVALID"}:r.event.punchCode==="UNKNOWN"?{state:"HELD_FOR_REVIEW" as const,code:"EXPORT_DIRECTION_UNKNOWN_REVIEW"}:(subjects.get(r.subjectHash!)??0)>1?{state:"HELD_FOR_REVIEW" as const,code:"EXPORT_SAME_SECOND_CONFLICT_REVIEW"}:{state:"COMPATIBLE" as const})}));
  };
  let relation="NOT_COMPARED",overlap=0;
  if(previous) {
    if(previous.snapshot.profileHash!==current.snapshot.profileHash)relation="PROFILE_CHANGED_REVIEW";
    else if(previous.bytes.equals(current.bytes))relation="BYTE_IDENTICAL_REPLAY";
    else if(previous.snapshot.sourceKey===current.snapshot.sourceKey && previous.snapshot.incarnation===current.snapshot.incarnation && current.bytes.length>previous.bytes.length && current.bytes.subarray(0,previous.bytes.length).equals(previous.bytes))relation="VERIFIED_SAME_FILE_APPEND";
    else relation="AMBIGUOUS_REEXPORT_OR_REPLACEMENT";
    const available=new Map<string,number>(); for(const r of previous.snapshot.rows)available.set(r.rowHash,(available.get(r.rowHash)??0)+1);
    for(const r of current.snapshot.rows){const n=available.get(r.rowHash)??0;if(n){overlap++;available.set(r.rowHash,n-1);}}
  }
  const rows=classify(current.snapshot), previousRows=previous?classify(previous.snapshot):undefined;
  if(previous && /AMBIGUOUS|PROFILE_CHANGED/.test(relation)) {
    const refs=new Set(previous.snapshot.rows.flatMap(r=>r.subjectHash?[r.subjectHash]:[]));
    rows.forEach((r,i)=>{if(r.state==="COMPATIBLE" && refs.has(current.snapshot.rows[i].subjectHash!)){r.state="HELD_FOR_REVIEW";r.code="EXPORT_OVERLAP_REVIEW";}});
    const currentSubjects=new Set(current.snapshot.rows.flatMap(r=>r.subjectHash?[r.subjectHash]:[]));
    previousRows?.forEach((r,i)=>{if(r.state==="COMPATIBLE" && currentSubjects.has(previous!.snapshot.rows[i].subjectHash!)){r.state="HELD_FOR_REVIEW";r.code="EXPORT_OVERLAP_REVIEW";}});
  }
  const selected=current.snapshot.rows.filter(r=>r.utcTimestamp && r.utcTimestamp>=request.interval.from && r.utcTimestamp<=request.interval.to);
  const interpreted={totalRows:selected.length,inRows:selected.filter(r=>r.event?.punchCode==="IN").length,outRows:selected.filter(r=>r.event?.punchCode==="OUT").length};
  const totals=(["totalRows","inRows","outRows"] as const).flatMap(k=>request.operator?.[k]===undefined?[]:[{kind:k,supplied:request.operator[k]!,observed:interpreted[k],matches:request.operator[k]===interpreted[k]}]);
  const observations=(request.operator?.observations??[]).map(o=>({supplied:o,observed:selected.filter(r=>r.event?.opaqueDeviceUserId===o.opaqueDeviceUserId && r.utcTimestamp===o.punchTimestamp && r.event?.punchCode===o.punchCode).length})).map(o=>({...o,matches:o.supplied.count===o.observed}));
  const counts={parsedRows:rows.length,compatibleRows:rows.filter(r=>r.state==="COMPATIBLE").length,heldRows:rows.filter(r=>r.state==="HELD_FOR_REVIEW").length,rejectedRows:rows.filter(r=>r.state==="REJECTED").length};
  const unresolvedIntervalRows=current.snapshot.rows.filter(r=>!r.utcTimestamp).length;
  const outsideIntervalRows=current.snapshot.rows.length-selected.length-unresolvedIntervalRows;
  const independent=request.operator?totals.every(t=>t.matches)&&observations.every(o=>o.matches)&&!unresolvedIntervalRows?"SUPPLIED_CHECKS_MATCH":"DISCREPANCY_OR_UNRESOLVED":"NOT_SUPPLIED";
  const summary={schemaVersion:1,mode:"READ_ONLY_COMPARISON",sourceKind:"EXPLICIT_FILE_OBSERVATION",...counts,wholeFileState:"SAFELY_PARSED",unexaminedFiles:0,relation,overlappingRows:overlap,selectedIntervalRows:selected.length,outsideIntervalRows,unresolvedIntervalRows,operatorEvidence:independent,comparedTotals:totals.length,comparedObservations:observations.length,matchingTotals:totals.filter(t=>t.matches).length,matchingObservations:observations.filter(o=>o.matches).length,reviewRequired:counts.heldRows>0||counts.rejectedRows>0||outsideIntervalRows>0||unresolvedIntervalRows>0||/AMBIGUOUS|PROFILE_CHANGED/.test(relation)||independent!=="SUPPLIED_CHECKS_MATCH",codes:[...new Set(rows.flatMap(r=>r.code?[r.code]:[]))],physicalDeviceOrigin:"NOT_AUTHENTICATED",businessAttendanceApproval:"NOT_GRANTED"};
  return {summary,rows,previousRows,totals,observations,interval:request.interval};
}

function privateInput(file:string,input:ExportInput,protectedPaths:string[]) {
  const dir=path.dirname(file); assertSourceBoundary(dir,protectedPaths);assertNoLinks(file);const access={...input,sourceDirectory:dir};assertSourceAccess(access,file);return access;
}
// Protected review JSON is data only. Bound and double-read one regular handle;
// do not follow links, interpret raw exceptions or change filesystem permissions.
function readPrivateJson(file:string,input:ExportInput,protectedPaths:string[],limit:number):unknown {
  privateInput(file,input,protectedPaths);const fd=openSync(file,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
  try { const before=fstatSync(fd),signature=(s:typeof before)=>`${s.dev}:${s.ino}:${s.size}:${s.mtimeMs}:${s.ctimeMs}`;
    if(!before.isFile()||before.nlink!==1||before.size<1||before.size>limit)throw new Error("EXPORT_REVIEW_INPUT_INVALID");
    const read=()=>{const b=Buffer.alloc(before.size);let n=0;while(n<b.length){const got=readSync(fd,b,n,b.length-n,n);if(!got)throw new Error("EXPORT_SOURCE_CHANGED");n+=got;}return b;};const first=read(),second=read();assertNoLinks(file);
    if(!first.equals(second)||signature(before)!==signature(fstatSync(fd))||signature(before)!==signature(lstatSync(file)))throw new Error("EXPORT_SOURCE_CHANGED");
    return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(first));
  }finally{closeSync(fd);}
}
export function compareExport(configFile:string,requestFile:string,privateOutput?:string) {
  const config=loadBridgeConfig(configFile);if(config.transportEnabled)throw new Error("EXPORT_REVIEW_TRANSPORT_MUST_BE_DISABLED");
  const device=config.devices.find(d=>d.profile===EXPORT_PROFILE);if(!device?.exportInput)throw new Error("EXPORT_CONFIG_INVALID");
  const input=device.exportInput,protectedPaths=[path.dirname(path.resolve(configFile)),path.dirname(config.privateKeyPath),path.dirname(config.queuePath),path.dirname(config.healthPath),input.sourceDirectory];
  const request=validateComparisonRequest(readPrivateJson(requestFile,input,protectedPaths,128*1024));
  let current:Capture;try{current=acquireExportWithBytes(request.file,input,device.deviceId);}catch(e){return {schemaVersion:1,mode:"READ_ONLY_COMPARISON",wholeFileState:"REFUSED_UNEXAMINED",parsedRows:null,compatibleRows:null,heldRows:null,rejectedRows:null,unexaminedFiles:request.compareFile||request.previousReport?2:1,codes:[safeCode(e)],reviewRequired:true,privateOutput:"NOT_CREATED"};}
  let previous:Capture|undefined,comparisonRefusal:string|undefined;
  if(request.compareFile)try{previous=acquireExportWithBytes(request.compareFile,input,device.deviceId);}catch(e){comparisonRefusal=safeCode(e);}
  if(request.previousReport) try {
    const saved=readPrivateJson(request.previousReport,input,protectedPaths,16*1024*1024) as any;
    if(saved?.schemaVersion!==1||saved?.mode!=="PRIVATE_EXPORT_REVIEW"||saved?.trace?.synthetic!==config.syntheticOnly||saved?.trace?.profileHash!==exportProfileHash(input.profile,device.deviceId)||typeof saved?.capture?.bytesBase64!=="string"||saved.capture.bytesBase64.length>Math.ceil(EXPORT_LIMITS.bytes/3)*4||typeof saved.capture.sourceKey!=="string"||typeof saved.capture.incarnation!=="string"||![saved.capture.sourceKey,saved.capture.incarnation,saved.capture.fileHash].every((v:string)=>/^[a-f0-9]{64}$/.test(v)))throw new Error("EXPORT_REVIEW_PREVIOUS_INVALID");
    const bytes=Buffer.from(saved.capture.bytesBase64,"base64");if(bytes.toString("base64")!==saved.capture.bytesBase64||digest(bytes)!==saved.capture.fileHash||!observationTime(saved.capture.observedAt))throw new Error("EXPORT_REVIEW_PREVIOUS_INVALID");
    previous={bytes,snapshot:{...parseExport(bytes,input.profile,device.deviceId,saved.capture.observedAt),sourceKey:saved.capture.sourceKey,incarnation:saved.capture.incarnation}};
  }catch(e){comparisonRefusal=safeCode(e);}
  const analysis=analyzeComparison(current,previous,request);
  if(comparisonRefusal){Object.assign(analysis.summary,{wholeFileState:"CURRENT_PARSED_COMPARISON_UNEXAMINED",unexaminedFiles:1,relation:"COMPARISON_UNEXAMINED",reviewRequired:true,codes:[...analysis.summary.codes,comparisonRefusal]});}
  let outputState="NOT_REQUESTED";
  if(privateOutput) {
    try {
      if(!path.isAbsolute(privateOutput)||[requestFile,request.previousReport].some(f=>f&&pathsOverlap(f,privateOutput)))throw new Error("EXPORT_REVIEW_OUTPUT_REFUSED");
      const dir=path.dirname(privateOutput);assertSourceBoundary(dir,protectedPaths);assertNoLinks(privateOutput,true);const access={...input,sourceDirectory:dir};assertSourceAccess(access);
      const fd=openSync(privateOutput,"wx",0o600);
      try {assertSourceAccess(access,privateOutput);const stat=fstatSync(fd);if(stat.nlink!==1||stat.ino!==lstatSync(privateOutput).ino)throw new Error("EXPORT_REVIEW_OUTPUT_REFUSED");
        const pack=(c:Capture)=>({bytesBase64:c.bytes.toString("base64"),fileHash:c.snapshot.fileHash,sourceKey:c.snapshot.sourceKey,incarnation:c.snapshot.incarnation,observedAt:c.snapshot.observedAt});
        const profileDefinition=Object.fromEntries(Object.entries(input.profile).filter(([key])=>key!=="employeeMapping"));
        const content=JSON.stringify({schemaVersion:1,mode:"PRIVATE_EXPORT_REVIEW",trace:{profileDefinition,profileHash:current.snapshot.profileHash,employeeIdentifierKind:input.profile.employeeIdentifierKind,deviceId:device.deviceId,synthetic:config.syntheticOnly,sourceOrigin:"FILE_BYTES_OBSERVED_NOT_DEVICE_AUTHENTICATED"},capture:pack(current),previousCapture:previous?pack(previous):undefined,request,analysis},null,2);
        if(Buffer.byteLength(content)>16*1024*1024)throw new Error("EXPORT_REVIEW_OUTPUT_LIMIT");
        writeFileSync(fd,content);fsyncSync(fd);outputState="CREATED";
      }finally{closeSync(fd);}
    }catch{outputState="REFUSED";}
  }
  return {...analysis.summary,synthetic:config.syntheticOnly,privateOutput:outputState,...(outputState==="REFUSED"?{codes:[...analysis.summary.codes,"EXPORT_REVIEW_OUTPUT_REFUSED"],reviewRequired:true}:{})};
}
