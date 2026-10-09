import { createHash } from "node:crypto";
import { validateNormalizedEvent, type NormalizedEvent } from "./contracts.js";

export const EXPORT_PROFILE = "ETIMETRACKLITE_RAW_EXPORT_V1" as const;
export type ExportProfile = ({ schemaVersion: 1 } | {
  schemaVersion: 2; terminalField: "ALLOW_ONE_EMPTY_TAB_V1";
}) & {
  profileId: string; columns: string[]; header: boolean;
  separator: "," | "\t"; encoding: "utf-8" | "utf-8-bom";
  filenamePrefix: string; extensions: Array<".csv" | ".txt" | ".dat">;
  dateFormat: "yyyy-MM-dd HH:mm:ss" | "dd/MM/yyyy HH:mm:ss" | "dd-MMM-yyyy HH:mm:ss";
  culture: "en-IN" | "en-GB"; timezone: "Asia/Kolkata" | "UTC";
  employeeIdentifierKind: "EmployeeDeviceCode" | "EmployeeCode";
  localDeviceId: string; approvedMappingReference: string;
  employeeMapping: Record<string, string>; directionMapping: Record<string, "IN" | "OUT" | "UNKNOWN">;
};
export type ExportInput = { sourceDirectory: string; sourceAccessSids: string[]; staleAfterMs: number; profile: ExportProfile };
export type ExportRow = { line: number; rowHash: string; subjectHash?: string; localTimestamp?: string; utcTimestamp?: string; event?: NormalizedEvent; rejection?: string };
export type ExportSnapshot = { schemaVersion: 1; profileHash: string; fileHash: string; bytes: number; observedAt: string; timezone: string; rows: ExportRow[] };
export const EXPORT_LIMITS = { bytes: 2 * 1024 * 1024, rows: 20_000, lineBytes: 2048, directoryEntries: 256, filesPerCycle: 8, bytesPerCycle: 8 * 1024 * 1024 };
const opaque = /^[A-Za-z0-9._:@/-]{1,128}$/;
export const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
function fail(code: string): never { throw new Error(`EXPORT_${code}`); }
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
export function validateExportProfile(value: unknown): ExportProfile {
  if (!record(value)) fail("PROFILE_INVALID");
  const keys = ["schemaVersion", "profileId", "columns", "header", "separator", "encoding", "filenamePrefix", "extensions", "dateFormat", "culture", "timezone", "employeeIdentifierKind", "localDeviceId", "approvedMappingReference", "employeeMapping", "directionMapping"];
  if (value.schemaVersion === 2) keys.push("terminalField");
  if (Object.keys(value).length !== keys.length || Object.keys(value).some(k => !keys.includes(k))) fail("PROFILE_FIELDS_INVALID");
  const p = value as ExportProfile;
  if (![1,2].includes(p.schemaVersion) || typeof p.profileId !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(p.profileId)) fail("PROFILE_VERSION_INVALID");
  if (!["EmployeeDeviceCode", "EmployeeCode"].includes(p.employeeIdentifierKind)) fail("IDENTIFIER_NAMESPACE_INVALID");
  const expected = [p.employeeIdentifierKind === "EmployeeCode" ? "Employee code" : "Employee Device Code", "Punch DateTime", "Device Id", "Direction"];
  if (!Array.isArray(p.columns) || p.columns.length !== 4 || new Set(p.columns).size !== 4 || p.columns.some(c => !expected.includes(c))) fail("PROFILE_COLUMNS_INVALID");
  if (typeof p.header !== "boolean" || ![",", "\t"].includes(p.separator) || !["utf-8", "utf-8-bom"].includes(p.encoding)) fail("PROFILE_FORMAT_UNSUPPORTED");
  if (typeof p.filenamePrefix !== "string" || !/^[A-Za-z0-9_-]{1,40}$/.test(p.filenamePrefix) || !Array.isArray(p.extensions) || !p.extensions.length || p.extensions.length > 3 || new Set(p.extensions).size !== p.extensions.length || p.extensions.some(e => ![".csv", ".txt", ".dat"].includes(e))) fail("PROFILE_FILENAME_INVALID");
  // An explicit management profile revision, restricted to the observed framing.
  // Legacy profiles keep their exact strict four-field contract and hash bytes.
  if (p.schemaVersion === 2 && (p.terminalField !== "ALLOW_ONE_EMPTY_TAB_V1" || p.separator !== "\t" || p.header || p.extensions.length !== 1 || p.extensions[0] !== ".dat")) fail("PROFILE_TERMINAL_FIELD_INVALID");
  if (!["yyyy-MM-dd HH:mm:ss", "dd/MM/yyyy HH:mm:ss", "dd-MMM-yyyy HH:mm:ss"].includes(p.dateFormat) || !["en-IN", "en-GB"].includes(p.culture) || !["Asia/Kolkata", "UTC"].includes(p.timezone)) fail("PROFILE_DATE_UNSUPPORTED");
  if (typeof p.localDeviceId !== "string" || !opaque.test(p.localDeviceId) || typeof p.approvedMappingReference !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(p.approvedMappingReference)) fail("PROFILE_BINDING_INVALID");
  if (!record(p.employeeMapping) || Object.keys(p.employeeMapping).length < 1 || Object.keys(p.employeeMapping).length > 10_000 || Object.entries(p.employeeMapping).some(([a,b]) => !opaque.test(a) || typeof b !== "string" || !opaque.test(b)) || new Set(Object.values(p.employeeMapping)).size !== Object.values(p.employeeMapping).length) fail("STAFF_MAPPING_INVALID");
  if (!record(p.directionMapping) || Object.keys(p.directionMapping).length < 1 || Object.keys(p.directionMapping).length > 16 || Object.entries(p.directionMapping).some(([a,b]) => !/^[A-Za-z0-9_-]{1,16}$/.test(a) || (typeof b !== "string" || !["IN", "OUT", "UNKNOWN"].includes(b)))) fail("DIRECTION_MAPPING_INVALID");
  return p;
}
function stable(value: unknown): unknown { if (Array.isArray(value)) return value.map(stable); if (record(value)) return Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])])); return value; }
export function exportProfileHash(profile: ExportProfile, deviceId: string) { return digest(JSON.stringify(stable({ profile: validateExportProfile(profile), deviceId }))); }
export function parseLocalTimestamp(value: string, p: ExportProfile) {
  let year: number, month: number, day: number, time: string[];
  if (p.dateFormat === "yyyy-MM-dd HH:mm:ss") {
    const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(value); if (!m) fail("DATE_INVALID");
    [year,month,day] = m.slice(1,4).map(Number); time = m.slice(4);
  } else if (p.dateFormat === "dd/MM/yyyy HH:mm:ss") {
    const m = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/.exec(value); if (!m) fail("DATE_INVALID");
    [day,month,year] = m.slice(1,4).map(Number); time = m.slice(4);
  } else {
    const m = /^(\d{2})-([A-Z][a-z]{2})-(\d{4}) (\d{2}):(\d{2}):(\d{2})$/.exec(value); if (!m) fail("DATE_INVALID");
    day = Number(m[1]); month = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].indexOf(m[2]) + 1; year = Number(m[3]); time = m.slice(4);
  }
  const [h,m,s] = time.map(Number), d = new Date(Date.UTC(year,month-1,day,h,m,s));
  if (year < 2000 || year > 2099 || month < 1 || month > 12 || day < 1 || h > 23 || m > 59 || s > 59 || d.getUTCFullYear() !== year || d.getUTCMonth() !== month-1 || d.getUTCDate() !== day) fail("DATE_INVALID");
  const localIso = `${String(year)}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}T${time.join(":")}`;
  return { timestamp: `${localIso}${p.timezone === "UTC" ? "Z" : "+05:30"}`, utc: new Date(d.getTime() - (p.timezone === "Asia/Kolkata" ? 330*60_000 : 0)).toISOString() };
}
function split(line: string, separator: string) {
  const fields: string[] = []; let field = "", quoted = false, closed = false;
  for (let i=0;i<line.length;i++) { const c=line[i];
    if (quoted) { if (c === '"') { if (line[i+1] === '"') { field+='"'; i++; } else { quoted=false; closed=true; } } else field+=c; }
    else if (c === separator) { fields.push(field); field=""; closed=false; }
    else if (c === '"' && !field && !closed) quoted=true;
    else { if (closed || c === '"') fail("ROW_QUOTING_INVALID"); field+=c; }
  }
  if (quoted) fail("ROW_QUOTING_INVALID"); fields.push(field); return fields;
}
export function parseExport(bytes: Buffer, profile: ExportProfile, deviceId: string, observedAt = new Date().toISOString()): ExportSnapshot {
  const p = validateExportProfile(profile), profileHash=exportProfileHash(p,deviceId);
  if (!bytes.length || bytes.length > EXPORT_LIMITS.bytes) fail("FILE_SIZE_INVALID");
  const bom = bytes.subarray(0,3).equals(Buffer.from([239,187,191]));
  if (bom !== (p.encoding === "utf-8-bom")) fail("ENCODING_MISMATCH");
  let source: string; try { source = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bom ? bytes.subarray(3) : bytes); } catch { fail("ENCODING_UNSUPPORTED"); }
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\uFEFF]/.test(source)) fail("BINARY_OR_CONTROL_CONTENT");
  // A nonterminated final record may still be in flight. Never checkpoint a prefix.
  if (!source.endsWith("\n")) fail("INCOMPLETE_WRITE");
  // Bound record count before split allocates an attacker-controlled array.
  let lineCount=0;
  for (let i=0;i<source.length;i++) if (source.charCodeAt(i)===10 && ++lineCount>EXPORT_LIMITS.rows+(p.header?1:0)) fail("ROW_LIMIT");
  const lines=source.slice(0,-1).split("\n").map(l=>l.endsWith("\r")?l.slice(0,-1):l);
  if (lines.length > EXPORT_LIMITS.rows + (p.header ? 1 : 0)) fail("ROW_LIMIT");
  if (lines.some(l=>Buffer.byteLength(l)>EXPORT_LIMITS.lineBytes)) fail("LINE_LIMIT");
  if (p.header && JSON.stringify(split(lines.shift()!,p.separator)) !== JSON.stringify(p.columns)) fail("HEADER_MISMATCH");
  const rows: ExportRow[] = lines.map((line,i) => {
    const row: ExportRow = { line:i+(p.header?2:1), rowHash:digest(line) };
    try {
      if (!line || /\r/.test(line)) fail("ROW_INVALID");
      const values=split(line,p.separator);
      // Tokenize quoting first. Only one literal terminal tab with an empty fifth
      // token is framing; populated or multiple extras still fail. Never trim
      // the source line: rowHash and fileHash retain the original export bytes.
      const terminalFraming=p.schemaVersion===2 && values.length===5 && values[4]==="" && line.endsWith("\t");
      if (values.length!==4 && !terminalFraming) fail("COLUMN_COUNT_INVALID");
      const fields=Object.fromEntries(p.columns.map((c,j)=>[c,values[j]]));
      const code=fields[p.employeeIdentifierKind === "EmployeeCode" ? "Employee code" : "Employee Device Code"];
      if (!opaque.test(code)) fail("IDENTIFIER_INVALID");
      if (fields["Device Id"] !== p.localDeviceId) fail("DEVICE_BINDING_MISMATCH");
      if (!Object.hasOwn(p.employeeMapping,code)) fail("STAFF_MAPPING_UNKNOWN");
      if (!Object.hasOwn(p.directionMapping,fields.Direction)) fail("DIRECTION_UNRESOLVED");
      const local=fields["Punch DateTime"], date=parseLocalTimestamp(local,p), mapped=p.employeeMapping[code];
      row.localTimestamp=local; row.utcTimestamp=date.utc;
      row.subjectHash=digest(JSON.stringify([deviceId,mapped,date.utc]));
      // Bridge observation identity, never a claimed hardware sequence/event identifier.
      const identity=digest(JSON.stringify([profileHash,mapped,date.timestamp,fields.Direction]));
      row.event=validateNormalizedEvent({deviceId,opaqueDeviceUserId:mapped,punchTimestamp:date.timestamp,bridgeReceivedTimestamp:observedAt,estimatedClockDriftSeconds:null,verificationMethod:"OTHER",punchCode:p.directionMapping[fields.Direction],statusCode:null,sequenceNumber:null,sequenceEpoch:1,eventReference:`export-v1-${identity}`,protocolProfile:EXPORT_PROFILE});
    } catch (e) { row.rejection=e instanceof Error && /^EXPORT_[A-Z_]+$/.test(e.message)?e.message:"EXPORT_ROW_INVALID"; }
    return row;
  });
  return {schemaVersion:1,profileHash,fileHash:digest(bytes),bytes:bytes.length,observedAt,timezone:p.timezone,rows};
}
