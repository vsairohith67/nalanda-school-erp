import { expect, it } from "vitest";
import { digest, parseExport, validateExportProfile, exportProfileHash, type ExportProfile } from "./export-profile.js";
import { id, profile, bytes } from "./export-test-fixtures.js";
it("binds every management profile field and device identity in a stable versioned hash",()=>{
  const p=profile(); expect(validateExportProfile(p)).toEqual(p); const h=exportProfileHash(p,id);
  expect(exportProfileHash({...p,directionMapping:{U:"UNKNOWN",OUT:"OUT",IN:"IN"}},id)).toBe(h);
  expect(exportProfileHash({...p,timezone:"UTC"},id)).not.toBe(h); expect(exportProfileHash(p,id.replace(/2$/,"3"))).not.toBe(h);
  expect(()=>validateExportProfile({...p,schemaVersion:2})).toThrow();expect(()=>validateExportProfile({...p,guess:true})).toThrow();
});
it("preserves leading zero identifiers and local time with explicit UTC interpretation",()=>{
  const s=parseExport(bytes(),profile(),id); expect(s.rows[0].event).toMatchObject({opaqueDeviceUserId:"0007",punchTimestamp:"2026-10-02T09:00:00+05:30",sequenceNumber:null,verificationMethod:"OTHER"});
  expect(s.rows[0]).toMatchObject({localTimestamp:"2026-10-02 09:00:00",utcTimestamp:"2026-10-02T03:30:00.000Z"});
  expect(parseExport(bytes(),{...profile(),timezone:"UTC"},id).rows[0].utcTimestamp).toBe("2026-10-02T09:00:00.000Z");
});
it.each(["2026-02-29 09:00:00","2026-13-02 09:00:00","2026-10-32 09:00:00","2026-10-02 24:00:00","2026-10-02 09:60:00","2026-10-02 09:00:60","02/10/2026 09:00:00","2026-10-02T09:00:00Z","2026-1-02 09:00:00"])("rejects strict date mismatch %s",date=>{
  expect(parseExport(bytes([`0007,${date},SYN-LOCAL-01,IN`]),profile(),id).rows[0].rejection).toBe("EXPORT_DATE_INVALID");
});
it("supports explicit tab, headerless reordered columns and English month formats without inference",()=>{
  const p:ExportProfile={...profile(),header:false,separator:"\t",dateFormat:"dd-MMM-yyyy HH:mm:ss",columns:["Device Id","Direction","Punch DateTime","Employee Device Code"],extensions:[".dat"]};
  expect(parseExport(bytes(["SYN-LOCAL-01\tIN\t02-Oct-2026 09:00:00\t0007"],p),p,id).rows[0].event?.opaqueDeviceUserId).toBe("0007");
  const q={...profile(),dateFormat:"dd/MM/yyyy HH:mm:ss" as const};expect(parseExport(bytes(["0007,02/10/2026 09:00:00,SYN-LOCAL-01,IN"],q),q,id).rows[0].utcTimestamp).toBe("2026-10-02T03:30:00.000Z");
});
it("refuses namespace/header mismatch and requires approved EmployeeCode mapping",()=>{
  const p={...profile(),employeeIdentifierKind:"EmployeeCode" as const};expect(()=>validateExportProfile(p)).toThrow("COLUMNS");
  p.columns=["Employee code","Punch DateTime","Device Id","Direction"];p.employeeMapping={"EMP-007":"0007"};
  expect(()=>parseExport(bytes(),p,id)).toThrow("HEADER_MISMATCH");
  expect(parseExport(bytes(["EMP-007,2026-10-02 09:00:00,SYN-LOCAL-01,IN"],p),p,id).rows[0].event?.opaqueDeviceUserId).toBe("0007");
});
it.each([
  ["0007,2026-10-02 09:00:00,OTHER,IN","DEVICE_BINDING_MISMATCH"],
  ["0008,2026-10-02 09:00:00,SYN-LOCAL-01,IN","STAFF_MAPPING_UNKNOWN"],
  ["7,2026-10-02 09:00:00,SYN-LOCAL-01,IN","STAFF_MAPPING_UNKNOWN"],
  ["0007,2026-10-02 09:00:00,SYN-LOCAL-01,0","DIRECTION_UNRESOLVED"],
  ["0007,2026-10-02 09:00:00,SYN-LOCAL-01,IN,EXTRA","COLUMN_COUNT_INVALID"],
  ['"0007"x,2026-10-02 09:00:00,SYN-LOCAL-01,IN',"ROW_QUOTING_INVALID"]
])("accounts rejected rows without payload errors %s",(row,reason)=>{const s=parseExport(bytes([row]),profile(),id);expect(s.rows[0].rejection).toBe(`EXPORT_${reason}`);expect(s.rows[0].event).toBeUndefined();});
it("keeps UNKNOWN explicit and refuses binary/unsupported encoding and unterminated writes",()=>{
  expect(parseExport(bytes(["0007,2026-10-02 09:00:00,SYN-LOCAL-01,U"]),profile(),id).rows[0].event?.punchCode).toBe("UNKNOWN");
  expect(()=>parseExport(Buffer.from([0xff,0xfe,0,10]),profile(),id)).toThrow("ENCODING");
  expect(()=>parseExport(Buffer.from("abc\0\n"),profile(),id)).toThrow("BINARY");
  expect(()=>parseExport(bytes().subarray(0,-1),profile(),id)).toThrow("INCOMPLETE");
  expect(()=>parseExport(Buffer.concat([Buffer.from([239,187,191]),bytes()]),profile(),id)).toThrow("ENCODING_MISMATCH");
  expect(parseExport(Buffer.concat([Buffer.from([239,187,191]),bytes()]),{...profile(),encoding:"utf-8-bom"},id).rows[0].event).toBeTruthy();
  expect(()=>validateExportProfile({...profile(),encoding:"utf-16le"})).toThrow("UNSUPPORTED");
});
it("bounds bytes, lines and rows before normalization",()=>{
  expect(()=>parseExport(Buffer.alloc(2*1024*1024+1),profile(),id)).toThrow("SIZE");
  expect(()=>parseExport(bytes(["x".repeat(2049)]),profile(),id)).toThrow("LINE_LIMIT");
  expect(()=>parseExport(bytes(Array(20001).fill("x")),profile(),id)).toThrow("ROW_LIMIT");
});
it("rejects coerced direction types and compares same instants in UTC across profile changes",()=>{
  expect(()=>validateExportProfile({...profile(),directionMapping:{IN:["IN"]}})).toThrow("DIRECTION_MAPPING");
  const a=parseExport(bytes(),profile(),id).rows[0];
  const b=parseExport(bytes(["0007,2026-10-02 03:30:00,SYN-LOCAL-01,IN"]),{...profile(),timezone:"UTC"},id).rows[0];
  expect(a.subjectHash).toBe(b.subjectHash);expect(a.event!.eventReference).not.toBe(b.event!.eventReference);
});

function terminalProfile():ExportProfile {
  return {...profile(),schemaVersion:2,terminalField:"ALLOW_ONE_EMPTY_TAB_V1",profileId:"synthetic-terminal-tab-v1",header:false,separator:"\t",extensions:[".dat"]};
}
const terminalRow="0007\t2026-10-02 09:00:00\tSYN-LOCAL-01\tIN";
it("opts into exactly one empty terminal tab without changing strict profiles or original byte evidence",()=>{
  const p=terminalProfile(), row=terminalRow+"\t", original=bytes([row],p);
  const legacy:ExportProfile={...profile(),header:false,separator:"\t",extensions:[".dat"]};
  expect(parseExport(original,legacy,id).rows[0].rejection).toBe("EXPORT_COLUMN_COUNT_INVALID");
  const observedAt="2026-10-04T13:00:00.000Z";
  const s=parseExport(original,p,id,observedAt), standard=parseExport(bytes([terminalRow],p),p,id,observedAt);
  expect(s.rows[0].event).toEqual(standard.rows[0].event);
  expect(s.rows[0].rowHash).toBe(digest(row));expect(s.fileHash).toBe(digest(original));
  expect(s.rows[0].rowHash).not.toBe(standard.rows[0].rowHash);expect(s.fileHash).not.toBe(standard.fileHash);
  expect(exportProfileHash(p,id)).not.toBe(exportProfileHash(legacy,id));
  expect(parseExport(bytes([terminalRow],legacy),legacy,id).rows[0].event).toBeTruthy();
});
it.each([
  {schemaVersion:1,terminalField:"ALLOW_ONE_EMPTY_TAB_V1"},
  {schemaVersion:2}, {schemaVersion:3},
  {terminalField:"IGNORE_EXTRAS"}, {separator:","}, {header:true}, {extensions:[".csv"]}, {extensions:[".dat",".txt"]}
])("refuses unversioned or broader terminal policy %j",change=>{
  const p={...terminalProfile(),...change};
  if(Object.keys(change).length===1 && Object.hasOwn(change,"schemaVersion")) delete (p as any).terminalField;
  expect(()=>validateExportProfile(p)).toThrow("EXPORT_PROFILE_");
});
it.each([
  [terminalRow+"\tEXTRA","COLUMN_COUNT_INVALID"],
  [terminalRow+"\t\t","COLUMN_COUNT_INVALID"],
  [terminalRow+'\t""',"COLUMN_COUNT_INVALID"],
  [terminalRow+"\t ","COLUMN_COUNT_INVALID"],
  ["\t2026-10-02 09:00:00\tSYN-LOCAL-01\tIN\t","IDENTIFIER_INVALID"],
  ["0007\t\tSYN-LOCAL-01\tIN\t","DATE_INVALID"],
  ["0007\t2026-10-02 09:00:00\t\tIN\t","DEVICE_BINDING_MISMATCH"],
  ["0007\t2026-10-02 09:00:00\tSYN-LOCAL-01\t\t","DIRECTION_UNRESOLVED"],
  ['"0007\tEXTRA"\t2026-10-02 09:00:00\tSYN-LOCAL-01\tIN\t',"IDENTIFIER_INVALID"],
  ['"0007"x\t2026-10-02 09:00:00\tSYN-LOCAL-01\tIN\t',"ROW_QUOTING_INVALID"],
  ['"0007\t2026-10-02 09:00:00\tSYN-LOCAL-01\tIN\t',"ROW_QUOTING_INVALID"],
  ["0007\t2026-10-02 09:00\tSYN-LOCAL-01\tIN\t","DATE_INVALID"],
  ["0007\t2026-10-02 09:00:00\tOTHER\tIN\t","DEVICE_BINDING_MISMATCH"],
  ["0008\t2026-10-02 09:00:00\tSYN-LOCAL-01\tIN\t","STAFF_MAPPING_UNKNOWN"]
])("retains precise refusals for terminal-profile row %s",(row,reason)=>{
  const p=terminalProfile(), s=parseExport(bytes([row],p),p,id);
  expect(s.rows[0].rejection).toBe(`EXPORT_${reason}`);expect(s.rows[0].event).toBeUndefined();expect(s.rows[0].rowHash).toBe(digest(row));
});
it("tokenizes quoted required fields before framing and preserves duplicate observations and changed source hashes",()=>{
  const p=terminalProfile(), quoted='"0007"\t"2026-10-02 09:00:00"\t"SYN-LOCAL-01"\t"IN"\t';
  const s=parseExport(bytes([quoted,quoted],p),p,id);
  expect(s.rows).toHaveLength(2);expect(s.rows.every(r=>!!r.event)).toBe(true);expect(s.rows[0].event?.eventReference).toBe(s.rows[1].event?.eventReference);
  const changed=parseExport(bytes([quoted,quoted.replace('"IN"','"OUT"')],p),p,id);
  expect(changed.rows).toHaveLength(2);expect(changed.fileHash).not.toBe(s.fileHash);expect(changed.rows[1].event?.punchCode).toBe("OUT");
  expect(changed.rows[1].rowHash).not.toBe(s.rows[1].rowHash);
});
it("retains encoding, final-newline and resource limits with the terminal profile",()=>{
  const p=terminalProfile();
  expect(()=>parseExport(Buffer.from([0xc3,0x28,0x0a]),p,id)).toThrow("ENCODING_UNSUPPORTED");
  expect(()=>parseExport(Buffer.concat([Buffer.from([239,187,191]),bytes([terminalRow+"\t"],p)]),p,id)).toThrow("ENCODING_MISMATCH");
  expect(()=>parseExport(bytes([terminalRow+"\t"],p).subarray(0,-1),p,id)).toThrow("INCOMPLETE_WRITE");
  expect(()=>parseExport(Buffer.alloc(2*1024*1024+1),p,id)).toThrow("FILE_SIZE_INVALID");
  expect(()=>parseExport(bytes(["x".repeat(2049)],p),p,id)).toThrow("LINE_LIMIT");
  expect(()=>parseExport(bytes(Array(20001).fill(terminalRow+"\t"),p),p,id)).toThrow("ROW_LIMIT");
});
