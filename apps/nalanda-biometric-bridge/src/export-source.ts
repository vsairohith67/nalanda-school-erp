import { closeSync, constants, fstatSync, lstatSync, openSync, opendirSync, readSync, realpathSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { digest, EXPORT_LIMITS, parseExport, type ExportInput } from "./export-profile.js";
import type { AcquiredExport } from "./export-ledger.js";

const componentRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
export function pathsOverlap(a:string,b:string) { const x=path.resolve(a).toLowerCase(),y=path.resolve(b).toLowerCase(); return x===y || x.startsWith(y+path.sep) || y.startsWith(x+path.sep); }
export function assertSourceBoundary(source:string,protectedPaths:string[]) {
  if (!path.isAbsolute(source)||source.startsWith("\\\\")||/[\x00-\x1f]/.test(source)||source.includes(":" ,3)||source===path.parse(source).root || protectedPaths.some(p=>pathsOverlap(source,p)) || pathsOverlap(source,componentRoot)) throw new Error("EXPORT_SOURCE_BOUNDARY_REFUSED");
}
function ancestors(file:string) { const result:string[]=[];let cursor=path.resolve(file);while(true){result.push(cursor);if(cursor===path.parse(cursor).root)break;cursor=path.dirname(cursor);}return result; }
export function assertNoLinks(file:string,allowMissing=false) {
  for (const cursor of ancestors(file)) {
    let s;try{s=lstatSync(cursor);}catch(e){if(allowMissing&&(e as NodeJS.ErrnoException).code==="ENOENT")continue;throw e;} if (s.isSymbolicLink()) throw new Error("EXPORT_REPARSE_POINT_REFUSED");
    // Detect Windows filesystem aliases (including short names) before output use.
    if (realpathSync(cursor).toLowerCase()!==cursor.toLowerCase()) throw new Error("EXPORT_PATH_ALIAS_REFUSED");
  }
}
type AclRow={path:string;failed?:boolean;attributes:number;owner:string;rules:Array<{sid:string;allow:boolean;rights:number;inheritOnly:boolean}>};
function aclRows(files:string[]) {
  // Fixed, read-only .NET ACL queries. No script loader, policy change, source
  // execution, command interpolation or ACL mutation. Query shared ancestors once.
  const query=`$ErrorActionPreference='Stop'; $rows=@(); foreach($p in (ConvertFrom-Json $env:NALANDA_EXPORT_CHECK_PATHS)) { try { $item=Get-Item -LiteralPath $p -Force; $acl=$item.GetAccessControl(); $rules=@($acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]) | ForEach-Object { [pscustomobject]@{sid=$_.IdentityReference.Value;allow=($_.AccessControlType -eq 'Allow');rights=[int64]$_.FileSystemRights;inheritOnly=[bool]($_.PropagationFlags -band [Security.AccessControl.PropagationFlags]::InheritOnly)} }); $rows += [pscustomobject]@{path=$item.FullName;attributes=[int64]$item.Attributes;owner=$acl.GetOwner([Security.Principal.SecurityIdentifier]).Value;rules=$rules} } catch { $rows += [pscustomobject]@{path=$p;failed=$true} } }; ConvertTo-Json -InputObject $rows -Depth 5 -Compress`;
  try {
    const paths=[...new Set(files.flatMap(ancestors))],exe=path.join(process.env.SystemRoot??"C:\\Windows","System32","WindowsPowerShell","v1.0","powershell.exe");
    const rows=JSON.parse(execFileSync(exe,["-NoLogo","-NoProfile","-NonInteractive","-Command",query],{encoding:"utf8",env:{...process.env,NALANDA_EXPORT_CHECK_PATHS:JSON.stringify(paths)},stdio:["ignore","pipe","pipe"],timeout:10_000,windowsHide:true,maxBuffer:128*1024})) as AclRow[];
    if(!Array.isArray(rows)||rows.length!==paths.length)throw new Error();return new Map(rows.map(r=>[path.resolve(r.path).toLowerCase(),r]));
  } catch { throw new Error("EXPORT_SOURCE_ACL_QUERY_FAILED"); }
}
function checkAccess(input:ExportInput,file:string,rows?:Map<string,AclRow>) {
  assertNoLinks(file);
  if(process.platform!=="win32") { for(const p of new Set([input.sourceDirectory,file])){const s=lstatSync(p);if((s.mode&0o077)!==0||(process.getuid&&s.uid!==process.getuid()))throw new Error("EXPORT_SOURCE_ACCESS_REFUSED");}return; }
  const allowed=new Set(["S-1-5-18","S-1-5-32-544",...input.sourceAccessSids]),owners=new Set([...allowed,"S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464"]);
  for(const p of new Set([...ancestors(file),...ancestors(input.sourceDirectory)])) {
    const r=rows?.get(p.toLowerCase());if(!r||r.failed)throw new Error("EXPORT_SOURCE_ACL_QUERY_FAILED");
    if((r.attributes&1024)!==0)throw new Error("EXPORT_REPARSE_POINT_REFUSED");if(!owners.has(r.owner))throw new Error("EXPORT_SOURCE_OWNER_REFUSED");
    const privateEntry=[path.resolve(file).toLowerCase(),path.resolve(input.sourceDirectory).toLowerCase()].includes(p.toLowerCase());
    for(const rule of r.rules)if(rule.allow&&(privateEntry?!allowed.has(rule.sid):!rule.inheritOnly&&!owners.has(rule.sid)&&!!(rule.rights&(65536|64|262144|524288))))throw new Error(privateEntry?"EXPORT_SOURCE_ACCESS_REFUSED":"EXPORT_SOURCE_PARENT_ACCESS_REFUSED");
  }
}
export function assertSourceAccess(input:ExportInput,file=input.sourceDirectory) { checkAccess(input,file,process.platform==="win32"?aclRows([input.sourceDirectory,file]):undefined); }
function enumerate(input:ExportInput) {
  assertNoLinks(input.sourceDirectory);
  const dir=opendirSync(input.sourceDirectory),files:string[]=[];let count=0;
  try{for(let e=dir.readSync();e;e=dir.readSync()){if(++count>EXPORT_LIMITS.directoryEntries)throw new Error("EXPORT_DIRECTORY_CAPACITY");
    if(e.name.startsWith(input.profile.filenamePrefix)&&input.profile.extensions.includes(path.extname(e.name).toLowerCase() as any))files.push(path.join(input.sourceDirectory,e.name));
  }}finally{dir.closeSync();}return files.sort();
}
export function selectedFiles(input:ExportInput) { assertSourceAccess(input);return enumerate(input); }
function signature(s:ReturnType<typeof fstatSync>) { return `${s.dev}:${s.ino}:${s.size}:${s.mtimeMs}:${s.ctimeMs}:${s.birthtimeMs}`; }
const leases=new WeakMap<object,{input:ExportInput;entries:Map<string,{signature?:string;error?:string}>}>();
export function openExportScan(input:ExportInput,cursor=0) {
  // Enumeration reads only bounded names/metadata; validate source and selected
  // file ACLs before reading any content, using one subprocess for this cycle.
  const files=enumerate(input),selected=files.length?Array.from({length:Math.min(files.length,EXPORT_LIMITS.filesPerCycle)},(_,i)=>files[(cursor+i)%files.length]):[];
  const before=new Map(selected.map(file=>{try{return [file,signature(lstatSync(file))] as const;}catch{return [file,undefined] as const;}}));
  const rows=process.platform==="win32"?aclRows([input.sourceDirectory,...selected]):undefined;
  checkAccess(input,input.sourceDirectory,rows);
  const entries=new Map<string,{signature?:string;error?:string}>();
  for(const file of selected){try{checkAccess(input,file,rows);const sig=signature(lstatSync(file));if(sig!==before.get(file))throw new Error("EXPORT_SOURCE_CHANGED");entries.set(file,{signature:sig});}catch(e){entries.set(file,{error:e instanceof Error&&/^EXPORT_[A-Z_]+$/.test(e.message)?e.message:"EXPORT_SOURCE_UNAVAILABLE"});}}
  const lease={};leases.set(lease,{input,entries});return {files,lease};
}
// Two complete bounded reads, handle/path identity and metadata checks. No vendor
// lock, writes, sidecars, renames or quiet-time-only inference.
export function acquireExport(file:string,input:ExportInput,deviceId:string,betweenReads?:()=>void,lease?:object,remainingBytes=EXPORT_LIMITS.bytesPerCycle):AcquiredExport {
  return acquireExportWithBytes(file,input,deviceId,betweenReads,lease,remainingBytes).snapshot;
}
// Review and ingestion share acquisition. Exact bytes are exposed only to the
// explicit private-review caller, never added to queue state or general health.
export function acquireExportWithBytes(file:string,input:ExportInput,deviceId:string,betweenReads?:()=>void,lease?:object,remainingBytes=EXPORT_LIMITS.bytesPerCycle) {
  if(path.dirname(path.resolve(file))!==path.resolve(input.sourceDirectory))throw new Error("EXPORT_SOURCE_BOUNDARY_REFUSED");
  const name=path.basename(file);if(!/^[A-Za-z0-9_.-]{1,128}$/.test(name)||name.endsWith(".")||!name.startsWith(input.profile.filenamePrefix)||!input.profile.extensions.includes(path.extname(name).toLowerCase() as any))throw new Error("EXPORT_SOURCE_FILE_REFUSED");
  let expectedSignature:string|undefined;
  if(lease){const state=leases.get(lease),entry=state?.entries.get(file);if(state?.input!==input||!entry)throw new Error("EXPORT_SOURCE_LEASE_INVALID");if(entry.error)throw new Error(entry.error);if(signature(lstatSync(file))!==entry.signature)throw new Error("EXPORT_SOURCE_CHANGED");expectedSignature=entry.signature;state.entries.delete(file);}
  else assertSourceAccess(input,file);
  assertNoLinks(file);
  const fd=openSync(file,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
  try {
    const before=fstatSync(fd);if(expectedSignature && signature(before)!==expectedSignature)throw new Error("EXPORT_SOURCE_CHANGED");if(!before.isFile()||before.nlink!==1||before.size<1||before.size>EXPORT_LIMITS.bytes)throw new Error("EXPORT_FILE_SIZE_INVALID");
    // Charge actual handle size, not an earlier directory-entry estimate.
    if(!Number.isSafeInteger(remainingBytes)||remainingBytes<before.size*2)throw new Error("EXPORT_CYCLE_CAPACITY");
    assertNoLinks(file);if(signature(before)!==signature(lstatSync(file)))throw new Error("EXPORT_SOURCE_CHANGED");
    const read=()=>{const bytes=Buffer.alloc(before.size);let offset=0;while(offset<bytes.length){const n=readSync(fd,bytes,offset,bytes.length-offset,offset);if(!n)throw new Error("EXPORT_SOURCE_CHANGED");offset+=n;}return bytes;};
    const first=read();betweenReads?.();const second=read();const after=fstatSync(fd),current=lstatSync(file);assertNoLinks(file);
    if(signature(before)!==signature(after)||signature(before)!==signature(current)||!first.equals(second))throw new Error("EXPORT_SOURCE_CHANGED");
    const parsed=parseExport(first,input.profile,deviceId);return {snapshot:{...parsed,sourceKey:digest(path.resolve(file)),incarnation:digest(`${before.dev}:${before.ino}:${before.birthtimeMs}`)},bytes:first};
  }finally{closeSync(fd);}
}
