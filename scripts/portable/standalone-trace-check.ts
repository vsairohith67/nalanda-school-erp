/** Read-only proof of copied generated chunks for the two implicated routes; no runtime admission. */
import {createHash} from "node:crypto";
import {execFileSync} from "node:child_process";
import {lstatSync,readFileSync,realpathSync} from "node:fs";
import path from "node:path";
import {pathToFileURL} from "node:url";

const traces=[
 ".next/server/app/(public)/event-gallery/[albumKey]/page.js.nft.json",
 ".next/server/app/api/admissions/documents/[publicKey]/route.js.nft.json"
] as const;
const fail=(code:string):never=>{throw Error(code);};
const inside=(root:string,file:string)=>{const rel=path.relative(root,file);return rel!==""&&!path.isAbsolute(rel)&&rel!==".."&&!rel.startsWith(".."+path.sep);};

export function checkStandaloneTraceChunks(projectRoot:string) {
 try {
  const root=path.resolve(projectRoot);
  if(!path.isAbsolute(projectRoot)||realpathSync(root)!==root)fail("STANDALONE_ARTIFACT_ROOT_REFUSED");
  const ownedFile=(file:string,maximum:number,missing:string)=>{
   if(!inside(root,file))fail("STANDALONE_TRACE_OUTSIDE_ROOT");
   let current=root;const parts=path.relative(root,file).split(path.sep);
   for(let i=0;i<parts.length;i++){
    current=path.join(current,parts[i]);let stat;try{stat=lstatSync(current);}catch{fail(missing);}
    if(stat.isSymbolicLink()||(i<parts.length-1?!stat.isDirectory():!stat.isFile()))fail("STANDALONE_ARTIFACT_LINK_OR_TYPE_REFUSED");
    if(i===parts.length-1&&(stat.size<=0||stat.size>maximum))fail("STANDALONE_ARTIFACT_SIZE_REFUSED");
   }
   return readFileSync(file);
  };
  ownedFile(path.join(root,".next/standalone/server.js"),1024*1024,"STANDALONE_SERVER_MISSING");
  const chunks=path.join(root,".next/server/chunks"),proof=new Map<string,string>();let bytesChecked=0,entriesExcluded=0;
  for(const trace of traces){
   const file=path.join(root,...trace.split("/"));let data:unknown;
   try{data=JSON.parse(ownedFile(file,8*1024*1024,"STANDALONE_TRACE_MISSING").toString("utf8"));}catch(error){if(error instanceof Error&&error.message.startsWith("STANDALONE_"))throw error;fail("STANDALONE_TRACE_INVALID");}
   const files=(data as {files?:unknown})?.files;
   if(!Array.isArray(files)||files.length===0||files.length>50000)fail("STANDALONE_TRACE_INVALID");
   let routeChunks=0;
   for(const entry of files){
    if(typeof entry!=="string"||entry.length>8192||!entry||entry.includes("\0")||path.isAbsolute(entry))fail("STANDALONE_TRACE_INVALID");
    const original=path.resolve(path.dirname(file),entry);
    if(!inside(root,original))fail("STANDALONE_TRACE_OUTSIDE_ROOT");
    if(!inside(chunks,original)){entriesExcluded++;continue;}
    routeChunks++;const name=path.relative(chunks,original);
    if(/[<>:"|?*\u0000-\u001f]/.test(name)||!name.endsWith(".js"))fail("STANDALONE_NONPORTABLE_CHUNK_REFUSED");
    if(proof.has(name))continue;
    if(proof.size>=512)fail("STANDALONE_CHUNK_COUNT_REFUSED");
    const source=ownedFile(original,8*1024*1024,"STANDALONE_SOURCE_CHUNK_MISSING"),copy=ownedFile(path.join(root,".next/standalone",path.relative(root,original)),8*1024*1024,"STANDALONE_COPIED_CHUNK_MISSING");
    if(bytesChecked+source.length>64*1024*1024)fail("STANDALONE_CHUNK_BYTES_REFUSED");
    const digest=createHash("sha256").update(source).digest("hex");
    if(source.length!==copy.length||digest!==createHash("sha256").update(copy).digest("hex"))fail("STANDALONE_COPIED_CHUNK_MISMATCH");
    proof.set(name,digest);bytesChecked+=source.length;
   }
   if(!routeChunks)fail("STANDALONE_ROUTE_CHUNKS_MISSING");
  }
  return {status:"PASS" as const,scope:"TWO_ROUTE_GENERATED_CHUNK_COPIES_ONLY" as const,tracesChecked:traces.length,generatedChunksChecked:proof.size,sourceBytesChecked:bytesChecked,nonChunkEntriesExcluded:entriesExcluded,proofSha256:createHash("sha256").update(JSON.stringify([...proof].sort())).digest("hex"),runtimeExecuted:false as const};
 }catch(error){if(error instanceof Error&&/^STANDALONE_[A-Z_]+$/.test(error.message))throw error;fail("STANDALONE_ARTIFACT_READ_FAILED");}
}

if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 try{
  if(process.argv.length!==2)fail("STANDALONE_ARGUMENTS_REFUSED");
  const root=realpathSync(process.cwd()),gitRoot=realpathSync(execFileSync("git",["rev-parse","--show-toplevel"],{encoding:"utf8",windowsHide:true}).trim());
  if(root!==gitRoot)fail("STANDALONE_ARTIFACT_ROOT_REFUSED");
  console.log(JSON.stringify(checkStandaloneTraceChunks(root)));
 }catch(error){console.log(JSON.stringify({status:"FAIL",cause:error instanceof Error&&/^STANDALONE_[A-Z_]+$/.test(error.message)?error.message:"STANDALONE_ARTIFACT_READ_FAILED",runtimeExecuted:false}));process.exitCode=1;}
}
