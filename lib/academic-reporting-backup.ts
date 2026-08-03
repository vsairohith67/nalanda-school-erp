import type { PrismaClient } from "@prisma/client";

export const ACADEMIC_REPORT_BACKUP_KEYS = ["academicReportDefinitions","academicReportRuns","academicReportSourceReferences","academicReportAuditEvents"] as const;
export type AcademicReportBackupKey = (typeof ACADEMIC_REPORT_BACKUP_KEYS)[number];
export type AcademicReportingBackup = Record<AcademicReportBackupKey, Record<string,unknown>[]>;

const FIELDS: Record<AcademicReportBackupKey, Set<string>> = {
  academicReportDefinitions:new Set(["id","publicKey","definitionCode","name","family","schemaVersion","status","parameterSchemaJson","minimumGroupSize","definitionHash","createdAt"]),
  academicReportRuns:new Set(["id","publicKey","definitionId","requestFingerprint","parameterJson","accessScopeJson","normalizationRule","sourceFingerprint","status","immutableSummaryJson","summaryHash","supersedesRunId","generatedAt","createdByRole","createdAt"]),
  academicReportSourceReferences:new Set(["id","reportRunId","ordinal","sourceKind","sourceRecordId","sourceVersion","publicReference","resultSnapshotId","reportCardVersionId","formulaVersion","roundingPolicyVersion","schemeVersionRefsJson","attendanceBasisKey","sourceLockedAt","publishedAt","sourceHash","createdAt"]),
  academicReportAuditEvents:new Set(["id","eventKey","reportRunId","eventType","actorRole","safeDetailsJson","occurredAt","createdAt"])
};
const REQUIRED: Record<AcademicReportBackupKey,string[]> = {
  academicReportDefinitions:["id","publicKey","definitionCode","name","family","schemaVersion","status","parameterSchemaJson","minimumGroupSize","definitionHash"],
  academicReportRuns:["id","publicKey","definitionId","requestFingerprint","parameterJson","accessScopeJson","normalizationRule","sourceFingerprint","status","immutableSummaryJson","summaryHash","generatedAt","createdByRole"],
  academicReportSourceReferences:["id","reportRunId","ordinal","sourceKind","sourceRecordId","sourceVersion","publicReference","resultSnapshotId","reportCardVersionId","formulaVersion","roundingPolicyVersion","schemeVersionRefsJson","sourceLockedAt","publishedAt","sourceHash"],
  academicReportAuditEvents:["id","eventKey","reportRunId","eventType","actorRole","safeDetailsJson","occurredAt"]
};

export async function loadAcademicReportingBackup(client: Pick<PrismaClient,"academicReportDefinition"|"academicReportRun"|"academicReportSourceReference"|"academicReportAuditEvent">): Promise<AcademicReportingBackup> {
  const [definitions,runs,sources,audits]=await Promise.all([
    client.academicReportDefinition.findMany({orderBy:[{family:"asc"},{createdAt:"asc"}]}),client.academicReportRun.findMany({orderBy:[{generatedAt:"asc"},{createdAt:"asc"}]}),client.academicReportSourceReference.findMany({orderBy:[{reportRunId:"asc"},{ordinal:"asc"}]}),client.academicReportAuditEvent.findMany({orderBy:[{occurredAt:"asc"},{createdAt:"asc"}]})
  ]);
  return {academicReportDefinitions:definitions.map(withoutActor),academicReportRuns:runs.map(withoutActor),academicReportSourceReferences:sources,academicReportAuditEvents:audits.map(withoutActor)} as unknown as AcademicReportingBackup;
}

export function validateAcademicReportingBackupRows(root: Record<string,unknown>, links: {resultSnapshotIds?:Set<string>;reportCardVersionIds?:Set<string>} = {}): AcademicReportingBackup {
  const result=Object.fromEntries(ACADEMIC_REPORT_BACKUP_KEYS.map((key)=>[key,rows(root[key],key,FIELDS[key],REQUIRED[key])])) as AcademicReportingBackup;
  const definitions=unique(result.academicReportDefinitions,"academicReportDefinitions","id"),runs=unique(result.academicReportRuns,"academicReportRuns","id");
  unique(result.academicReportDefinitions,"academicReportDefinitions","publicKey");unique(result.academicReportDefinitions,"academicReportDefinitions","definitionCode");unique(result.academicReportRuns,"academicReportRuns","publicKey");unique(result.academicReportRuns,"academicReportRuns","requestFingerprint");
  for(const[index,row]of result.academicReportDefinitions.entries()){if(!families.has(text(row.family)))throw new Error(`academicReportDefinitions[${index}].family is unsupported`);oneOf(row.status,["ACTIVE","ARCHIVED"],`academicReportDefinitions[${index}].status`);positive(row.schemaVersion,`academicReportDefinitions[${index}].schemaVersion`);boundedInteger(row.minimumGroupSize,3,50,`academicReportDefinitions[${index}].minimumGroupSize`);hash(row.definitionHash,`academicReportDefinitions[${index}].definitionHash`);json(row.parameterSchemaJson,`academicReportDefinitions[${index}].parameterSchemaJson`);}
  for(const[index,row]of result.academicReportRuns.entries()){if(!definitions.has(text(row.definitionId)))throw new Error(`academicReportRuns[${index}] has an invalid definition link`);for(const field of ["requestFingerprint","sourceFingerprint","summaryHash"])hash(row[field],`academicReportRuns[${index}].${field}`);for(const field of ["parameterJson","accessScopeJson","immutableSummaryJson"])json(row[field],`academicReportRuns[${index}].${field}`);oneOf(row.status,["COMPLETED"],`academicReportRuns[${index}].status`);oneOf(row.normalizationRule,["NONE","STRICT_MATCH","PERCENTAGE_NORMALIZED"],`academicReportRuns[${index}].normalizationRule`);if(row.supersedesRunId&&(!runs.has(text(row.supersedesRunId))||row.supersedesRunId===row.id))throw new Error(`academicReportRuns[${index}] has an invalid supersession link`);}
  const sourceKeys=new Set<string>();for(const[index,row]of result.academicReportSourceReferences.entries()){if(!runs.has(text(row.reportRunId)))throw new Error(`academicReportSourceReferences[${index}] has an invalid run link`);positive(row.ordinal,`academicReportSourceReferences[${index}].ordinal`);positive(row.sourceVersion,`academicReportSourceReferences[${index}].sourceVersion`);oneOf(row.sourceKind,["LOCKED_RESULT_AND_ISSUED_REPORT"],`academicReportSourceReferences[${index}].sourceKind`);hash(row.sourceHash,`academicReportSourceReferences[${index}].sourceHash`);json(row.schemeVersionRefsJson,`academicReportSourceReferences[${index}].schemeVersionRefsJson`);const key=`${row.reportRunId}|${row.ordinal}`;if(sourceKeys.has(key))throw new Error(`academicReportSourceReferences[${index}] duplicates a run ordinal`);sourceKeys.add(key);if(links.resultSnapshotIds&&!links.resultSnapshotIds.has(text(row.resultSnapshotId)))throw new Error(`academicReportSourceReferences[${index}] has an unavailable locked snapshot`);if(links.reportCardVersionIds&&!links.reportCardVersionIds.has(text(row.reportCardVersionId)))throw new Error(`academicReportSourceReferences[${index}] has an unavailable issued version`);}
  unique(result.academicReportAuditEvents,"academicReportAuditEvents","eventKey");for(const[index,row]of result.academicReportAuditEvents.entries()){if(!runs.has(text(row.reportRunId)))throw new Error(`academicReportAuditEvents[${index}] has an invalid run link`);oneOf(row.eventType,["RUN_GENERATED","RUN_SUPERSEDES","EXPORT_AUTHORIZED"],`academicReportAuditEvents[${index}].eventType`);json(row.safeDetailsJson,`academicReportAuditEvents[${index}].safeDetailsJson`);}
  if(/password|secret|token|cookie|session|ipaddress|useragent/i.test(JSON.stringify(result)))throw new Error("Academic reporting backup contains a prohibited secret or surveillance field");
  return result;
}

export function academicReportingBackupCount(value: AcademicReportingBackup){return ACADEMIC_REPORT_BACKUP_KEYS.reduce((sum,key)=>sum+value[key].length,0);}

function withoutActor<T extends Record<string,unknown>>(row:T){const{createdByUserId:_created,actorUserId:_actor,...safe}=row;return safe;}
function rows(value:unknown,label:string,allowed:Set<string>,required:string[]){if(value===undefined)return[];if(!Array.isArray(value)||value.length>100_000)throw new Error(`${label} must be a bounded array`);return value.map((item,index)=>{if(!item||typeof item!=="object"||Array.isArray(item))throw new Error(`${label}[${index}] must be an object`);const row=item as Record<string,unknown>;for(const key of Object.keys(row))if(!allowed.has(key))throw new Error(`${label}[${index}].${key} is unsupported`);for(const key of required)if(row[key]===undefined||row[key]===null||row[key]==="")throw new Error(`${label}[${index}].${key} is required`);return row;});}
function unique(rows:Record<string,unknown>[],label:string,field:string){const values=new Set<string>();rows.forEach((row,index)=>{const value=bounded(row[field],200,`${label}[${index}].${field}`);if(values.has(value))throw new Error(`${label}[${index}].${field} is duplicated`);values.add(value);});return values;}
function bounded(value:unknown,maximum:number,label:string){const valueText=text(value);if(!valueText||valueText.length>maximum)throw new Error(`${label} is invalid`);return valueText;}
function positive(value:unknown,label:string){return boundedInteger(value,1,1_000_000,label);}
function boundedInteger(value:unknown,minimum:number,maximum:number,label:string){const number=Number(value);if(!Number.isInteger(number)||number<minimum||number>maximum)throw new Error(`${label} is invalid`);return number;}
function oneOf(value:unknown,allowed:string[],label:string){const result=text(value);if(!allowed.includes(result))throw new Error(`${label} is unsupported`);return result;}
function hash(value:unknown,label:string){if(!/^[a-f0-9]{64}$/i.test(text(value)))throw new Error(`${label} is invalid`);}
function json(value:unknown,label:string){if(typeof value!=="string"||value.length>2_000_000)throw new Error(`${label} must be bounded JSON`);try{return JSON.parse(value);}catch{throw new Error(`${label} must be valid JSON`);}}
function text(value:unknown){return String(value??"").trim();}
const families=new Set(["STUDENT_LONGITUDINAL","CLASS_SECTION_SUMMARY","SUBJECT_PAPER_DISTRIBUTION","SUBJECT_GROUP_SUMMARY","OUTCOME_DISTRIBUTION","COMPARATIVE_DELTA","COMPLETION_MISSING_SOURCE","CLASS_AVERAGE_HIGHEST","BOARD_CLASS_COMPARATIVE","LEADERSHIP_SUMMARY"]);
