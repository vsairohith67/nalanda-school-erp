import assert from "node:assert/strict";
import {parseCsv,MARKS_IMPORT_COLUMNS,GOVERNED_IMPORT_COLUMNS} from "../../lib/marks-import-csv";

export const MARKS_BROWSER_SCENARIOS=["MB1","MB2","MB3","MB4","MB5","MB6","MB7"] as const;
export type MarksContext={model:"legacy"|"governed";academicYear:string;examCode:string;className:string;section:string;subjectName:string;componentName:string;students:{id:string;admissionNo:string}[]};
export type MarkExpectation={studentId:string;state:string;marks:string|null;version:number};
export function marksSame(a:unknown,b:unknown,code="MARKS_STATE"){assert(JSON.stringify(a)===JSON.stringify(b),code);}
export function assertMarksBound(actual:any,expected:{scope:string;source:string;runId:string;attempt:string}){for(const [key,value] of Object.entries(expected))assert(actual[key]===value,"MARKS_READBACK_BINDING");}
export function assertMarksUnchanged(a:unknown,b:unknown){marksSame(a,b,"MARKS_UNEXPECTED_BUSINESS_EFFECT");}
export function assertMarksPrivacy(text:string,canaries:string[]){assert(!canaries.some(v=>v.length&&text.includes(v)),"MARKS_PRIVATE_PAYLOAD");}
export const marksCsv=(rows:readonly (readonly string[])[])=>Buffer.from(rows.map(row=>row.map(v=>`"${v.replaceAll('"','""')}"`).join(",")).join("\r\n")+"\r\n");
export function assertMarksTemplate(bytes:Buffer,c:MarksContext){
 assert(bytes.length>0&&bytes.length<=(c.model==="governed"?400000:2000000),"MARKS_TEMPLATE_BOUND");
 const rows=parseCsv(bytes.toString("utf8").replace(/^\uFEFF/,"")),columns=c.model==="governed"?GOVERNED_IMPORT_COLUMNS:MARKS_IMPORT_COLUMNS;
 marksSame(rows.shift(),columns,"MARKS_TEMPLATE_COLUMNS");assert(rows.length===c.students.length&&rows.every(r=>r.length===columns.length),"MARKS_TEMPLATE_ROSTER");
 const found=new Set<string>();
 for(const row of rows){const d=Object.fromEntries(columns.map((key,i)=>[key,row[i]])),student=c.students.find(s=>s.admissionNo===d.admissionNumber);assert(student&&!found.has(student.id),"MARKS_TEMPLATE_ROSTER");found.add(student.id);
  if(c.model==="legacy")for(const key of ["examCode","className","section","subjectName","componentName"] as const)assert(d[key]===c[key],"MARKS_TEMPLATE_CONTEXT");
  else{assert(d.templateVersion==="governed-draft-v1"&&d.studentId===student.id,"MARKS_TEMPLATE_CONTEXT");for(const key of ["sheetVersion","versionNumber","rowVersion"])assert(/^[1-9]\d*$/.test(d[key]),"MARKS_TEMPLATE_VERSION");assert(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(d.contextReceipt),"MARKS_TEMPLATE_RECEIPT");}
 }
 return rows;
}
/** Edits only the three allowed entry fields in an actual downloaded template.
 * Context, version and signed receipt bytes remain unchanged. */
export function completeMarksTemplate(bytes:Buffer,c:MarksContext,entries:{state:string;marks:string;remarks:string}[]){
 const rows=assertMarksTemplate(bytes,c),columns=c.model==="governed"?GOVERNED_IMPORT_COLUMNS:MARKS_IMPORT_COLUMNS;assert(entries.length===rows.length,"MARKS_ENTRY_COUNT");
 const fields=columns as readonly string[];
 for(const row of rows){const student=c.students.findIndex(s=>s.admissionNo===row[fields.indexOf("admissionNumber")]);const e=entries[student];assert(e&&["PRESENT","ABSENT","EXEMPT","NOT_APPLICABLE",...(c.model==="governed"?["NOT_ENTERED"]:[])].includes(e.state),"MARKS_ENTRY_STATE");assert(e.state==="PRESENT"?/^\d+(\.\d+)?$/.test(e.marks):e.marks==="","MARKS_ENTRY_BLANK");row[fields.indexOf("marksObtained")]=e.marks;row[fields.indexOf(c.model==="governed"?"entryState":"entryStatus")]=e.state;row[fields.indexOf("remarks")]=e.remarks;}
 return marksCsv([columns,...rows]);
}
export function assertMarksRows(actual:MarkExpectation[],expected:MarkExpectation[]){const canonical=(rows:MarkExpectation[])=>rows.map(r=>({studentId:r.studentId,state:r.state,marks:r.marks,version:r.version})).sort((a,b)=>a.studentId.localeCompare(b.studentId));marksSame(canonical(actual),canonical(expected),"MARKS_ROWS");}
export function assertMarksEvent(before:any[],after:any[],expected:Record<string,unknown>){assert(new Set(after.map(e=>e.id)).size===after.length,"MARKS_AUDIT_DUPLICATE_ID");for(const old of before)marksSame(after.find(e=>e.id===old.id),old,"MARKS_PRIOR_AUDIT_CHANGED");const added=after.filter(e=>!before.some(old=>old.id===e.id));assert(added.length===1,"MARKS_AUDIT_COUNT");for(const [key,value] of Object.entries(expected))assert(added[0][key]===value,"MARKS_AUDIT_BINDING");}
export function assertMarksExport(bytes:Buffer,expected:string[][]){assert(bytes.length>0&&bytes.length<=2_000_000,"MARKS_EXPORT_BOUND");const rows=parseCsv(bytes.toString("utf8").replace(/^\uFEFF/,""));const canonical=(table:string[][])=>[table[0],...table.slice(1).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))];marksSame(canonical(rows),canonical(expected),"MARKS_EXPORT_SCOPE_OR_VALUES");assert(rows.every(r=>r.every(v=>!/^\s*[=+@]/.test(v))),"MARKS_EXPORT_FORMULA");}

export function assertMarksExportAudit(before:any[],after:any[],actorUserId:string,reportRunId:string,format:"CSV"|"PDF",mode:"COLOUR"|"MONOCHROME"){assertMarksEvent(before,after,{eventType:"EXPORT_AUTHORIZED",actorUserId,reportRunId});const added=after.find(e=>!before.some(old=>old.id===e.id));let details:any;try{details=JSON.parse(added.safeDetailsJson);}catch{throw Error("MARKS_EXPORT_AUDIT_DETAILS");}marksSame(details,{format,mode,privacy:"No raw actor ID, Student ID, IP address, user agent, or provider transfer recorded."},"MARKS_EXPORT_AUDIT_DETAILS");}
