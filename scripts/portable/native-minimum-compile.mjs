/** DRAFT Rust minimum compatibility only. No artifact production or admission. */
import {execFileSync, spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import {readFileSync, existsSync, mkdtempSync, writeFileSync, rmSync, lstatSync, realpathSync} from "node:fs";
import {request as httpsRequest} from "node:https";
import os from "node:os";
import path from "node:path";
import {performance} from "node:perf_hooks";
import {fileURLToPath} from "node:url";

// The pinned build script always attempts the signed source pair before MSVC fallback.
const sodiumFiles=["LATEST.tar.gz","LATEST.tar.gz.minisig","libsodium-1.0.22-stable-msvc.zip","libsodium-1.0.22-stable-msvc.zip.minisig"];
const sodiumChecksum="72b04bf6da2c98b727af37ab62cb505f4d751b975b034a9b9ad491d333b0564e";
const sodiumCauses=new Set(["MINIMUM_SODIUM_FILE_REFUSED","MINIMUM_SODIUM_LOCK_REFUSED","MINIMUM_SODIUM_ENVIRONMENT_REFUSED","MINIMUM_SODIUM_CLEANUP_REFUSED","MINIMUM_SODIUM_CLEANUP_FAILED","MINIMUM_SODIUM_DOWNLOAD_TIMEOUT","MINIMUM_SODIUM_HTTP_REFUSED","MINIMUM_SODIUM_SIZE_REFUSED","MINIMUM_SODIUM_TRANSPORT_FAILED","MINIMUM_SODIUM_BODY_REFUSED","MINIMUM_SODIUM_WRITE_REFUSED"]);
const sodiumCause=error=>sodiumCauses.has(error?.message)?error.message:"MINIMUM_SODIUM_PREPARATION_FAILED";
const sodiumCleanupCause=error=>error?.message==="MINIMUM_SODIUM_CLEANUP_REFUSED"?error.message:"MINIMUM_SODIUM_CLEANUP_FAILED";
export function sodiumArchiveDownload(name,destination,request=httpsRequest) {
 if(!sodiumFiles.includes(name))throw Error("MINIMUM_SODIUM_FILE_REFUSED");
 const limit=name.endsWith(".minisig")?4096:40*1024*1024;
 // Direct HTTPS requests do not import Docker/proxy credentials, follow redirects, or retry.
 return new Promise((resolve,reject)=>{
  let child,response,done=false,bytes=0;const chunks=[];
  const finish=(error)=>{if(done)return;done=true;clearTimeout(timer);if(error){response?.destroy();child?.destroy();reject(Error(error));}else resolve({name,bytes,sha256:createHash("sha256").update(Buffer.concat(chunks)).digest("hex")});};
  const timer=setTimeout(()=>finish("MINIMUM_SODIUM_DOWNLOAD_TIMEOUT"),30000);
  try{
   child=request(`https://download.libsodium.org/libsodium/releases/${name}`,{method:"GET",agent:false,headers:{Accept:"application/octet-stream"}},incoming=>{
    response=incoming;
    if(incoming.statusCode!==200){finish("MINIMUM_SODIUM_HTTP_REFUSED");return;}
    const length=incoming.headers["content-length"];
    if(length!==undefined&&(!/^\d+$/.test(String(length))||Number(length)>limit)){finish("MINIMUM_SODIUM_SIZE_REFUSED");return;}
    incoming.on("data",chunk=>{if(done)return;bytes+=chunk.length;if(bytes>limit){finish("MINIMUM_SODIUM_SIZE_REFUSED");return;}chunks.push(Buffer.from(chunk));});
    incoming.on("error",()=>finish("MINIMUM_SODIUM_TRANSPORT_FAILED"));
    incoming.on("aborted",()=>finish("MINIMUM_SODIUM_TRANSPORT_FAILED"));
    incoming.on("end",()=>{if(done)return;if(!bytes||(length!==undefined&&bytes!==Number(length))){finish("MINIMUM_SODIUM_BODY_REFUSED");return;}try{writeFileSync(destination,Buffer.concat(chunks),{flag:"wx",mode:0o600});finish();}catch{finish("MINIMUM_SODIUM_WRITE_REFUSED");}});
   });
   child.on("error",()=>finish("MINIMUM_SODIUM_TRANSPORT_FAILED"));child.end();
  }catch{finish("MINIMUM_SODIUM_TRANSPORT_FAILED");}
 });
}
export async function prepareWindowsSodium(lockText,environment,download=sodiumArchiveDownload) {
 const entry=lockText.split(/\r?\n\[\[package\]\]\r?\n/).find(block=>/^name = "libsodium-sys-stable"\r?$/m.test(block));
 if(!entry||!/^version = "1\.24\.0"\r?$/m.test(entry)||!/^source = "registry\+https:\/\/github.com\/rust-lang\/crates.io-index"\r?$/m.test(entry)||!entry.includes(`checksum = "${sodiumChecksum}"`))throw Error("MINIMUM_SODIUM_LOCK_REFUSED");
 for(const key of ["SODIUM_DIST_DIR","SODIUM_LIB_DIR","SODIUM_SHARED","SODIUM_USE_PKG_CONFIG"])if(environment[key]!==undefined)throw Error("MINIMUM_SODIUM_ENVIRONMENT_REFUSED");
 const parent=realpathSync(os.tmpdir()),directory=mkdtempSync(path.join(parent,"nalanda-minimum-sodium-"));
 const allocated=lstatSync(directory,{bigint:true});
 const cleanup=()=>{
  let current;try{current=lstatSync(directory,{bigint:true});}catch{throw Error("MINIMUM_SODIUM_CLEANUP_REFUSED");}
  if(path.dirname(directory)!==parent||!path.basename(directory).startsWith("nalanda-minimum-sodium-")||!current.isDirectory()||current.isSymbolicLink()||realpathSync(directory)!==directory||current.dev!==allocated.dev||current.ino!==allocated.ino||(allocated.birthtimeNs>0n&&current.birthtimeNs!==allocated.birthtimeNs)||(allocated.ino===0n&&allocated.birthtimeNs<=0n))throw Error("MINIMUM_SODIUM_CLEANUP_REFUSED");
  rmSync(directory,{recursive:true});
 };
 try{
  const files=[];for(const name of sodiumFiles)files.push(await download(name,path.join(directory,name)));
  return {directory,files,cleanup};
 }catch(error){try{cleanup();}catch(cleanupError){const failure=Error(sodiumCause(error));failure.cleanupCause=sodiumCleanupCause(cleanupError);throw failure;}throw error;}
}

/** The callback owns compiler execution. Neither its value nor exception is logged here. */
export async function withPreparedWindowsSodium(lockText,environment,compile,download=sodiumArchiveDownload) {
 const sodium=await prepareWindowsSodium(lockText,environment,download);
 let compilation,dependencyCleanup="VERIFIED",dependencyCleanupFailure=null;
 try{
  // The prepared path belongs only to children started by the callback, never process.env.
  compilation={status:"RETURNED",value:await compile({...environment,SODIUM_DIST_DIR:sodium.directory},sodium.files.map(file=>({...file})))};
 }catch(error){compilation={status:"THREW",error};}
 finally{try{sodium.cleanup();}catch(error){dependencyCleanup="UNRECONCILED";dependencyCleanupFailure=sodiumCleanupCause(error);}}
 return {compilation,files:sodium.files,dependencyCleanup,dependencyCleanupFailure};
}

/** Preserve a failed compiler's exit; cleanup can only turn compiler success into failure. */
export function minimumCompilerExitCode(result,dependencyCleanup) {
 if(result.status!==null&&result.status!==0)return result.status;
 if(result.status===null||result.signal||result.error)return 1;
 return dependencyCleanup==="NOT_EXECUTED"||dependencyCleanup==="VERIFIED"?0:1;
}

export async function minimumCompile() {
const target=process.argv[2];
const targets={
 "x86_64-pc-windows-msvc":"win32",
 "x86_64-unknown-linux-gnu":"linux",
 "aarch64-unknown-linux-gnu":"linux",
 "x86_64-apple-darwin":"darwin",
 "aarch64-apple-darwin":"darwin",
 "aarch64-linux-android":"linux",
 "armv7-linux-androideabi":"linux",
 "i686-linux-android":"linux",
 "x86_64-linux-android":"linux",
 "aarch64-apple-ios":"darwin",
 "aarch64-apple-ios-sim":"darwin",
 "x86_64-apple-ios":"darwin"
};
if(process.argv.length!==3 || targets[target]!==process.platform) throw Error("MINIMUM_TARGET_ENVIRONMENT_MISMATCH");
const manifest="apps/nalanda-cross-platform/src-tauri/Cargo.toml";
const lock="apps/nalanda-cross-platform/src-tauri/Cargo.lock";
const hash=()=>createHash("sha256").update(readFileSync(lock)).digest("hex");
const before=hash();
const source=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim();
const rustc=execFileSync("rustc",["+1.90.0","-vV"],{encoding:"utf8"});
const cargo=execFileSync("cargo",["+1.90.0","-vV"],{encoding:"utf8"});
if(!/^release: 1\.90\.0$/m.test(rustc)||!/^release: 1\.90\.0$/m.test(cargo)) throw Error("MINIMUM_COMPILER_IDENTITY_MISMATCH");
if(!/^rust-version = "1\.90"$/m.test(readFileSync(manifest,"utf8"))) throw Error("MINIMUM_DECLARATION_MISMATCH");
const env={...process.env};
if(target.endsWith("android") || target.endsWith("androideabi")){
 const ndk=env.NDK_HOME||env.ANDROID_NDK_HOME;
 if(!ndk||!path.isAbsolute(ndk)) throw Error("MINIMUM_ANDROID_NDK_MISSING");
 const tool=path.join(ndk,"toolchains/llvm/prebuilt/linux-x86_64/bin");
 const prefixes={"armv7-linux-androideabi":"armv7a-linux-androideabi", "aarch64-linux-android":"aarch64-linux-android","i686-linux-android":"i686-linux-android","x86_64-linux-android":"x86_64-linux-android"};
 const clang=path.join(tool,prefixes[target]+"28-clang");
 if(!existsSync(clang)||!existsSync(path.join(tool,"llvm-ar"))) throw Error("MINIMUM_ANDROID_COMPILER_MISSING");
 const key=target.replaceAll("-","_");
 env["CC_"+key]=clang;env["AR_"+key]=path.join(tool,"llvm-ar");env["RANLIB_"+key]=path.join(tool,"llvm-ranlib");
 env["CARGO_TARGET_"+key.toUpperCase()+"_LINKER"]=clang;
 console.log(JSON.stringify({ndkVersion:readFileSync(path.join(ndk,"source.properties"),"utf8").match(/^Pkg.Revision\s*=\s*(.+)$/m)?.[1]??"UNKNOWN",androidApi:28}));
}
const command=["+1.90.0",target==="x86_64-pc-windows-msvc"?"test":"check","--locked","--manifest-path",manifest,"--target",target,"--lib"];
const startUtc=new Date().toISOString(),start=performance.now();
console.log(JSON.stringify({evidence:"MINIMUM_COMPILER_COMPATIBILITY_ONLY",source,target,profile:"production",compiler:"1.90.0",command:["cargo",...command],lockSha256:before}));
process.stdout.write(rustc);process.stdout.write(cargo);
let result,dependencyCleanup="NOT_EXECUTED",dependencyCleanupFailure=null;
if(target==="x86_64-pc-windows-msvc"){
 let prepared;
 try{prepared=await withPreparedWindowsSodium(readFileSync(lock,"utf8"),env,(childEnv,files)=>{
  console.log(JSON.stringify({evidence:"MINIMUM_SIGNED_DEPENDENCY_PREPARATION",source,target,crate:"libsodium-sys-stable",version:"1.24.0",crateChecksum:sodiumChecksum,files,status:"ACQUIRED_SIGNATURE_VERIFICATION_PENDING",verification:"UNCHANGED_UPSTREAM_BUILD_SCRIPT"}));
  return spawnSync("cargo",command,{env:childEnv,stdio:"inherit",windowsHide:true,timeout:2100000});
 });}catch(error){const cause=sodiumCause(error);console.log(JSON.stringify({evidence:"MINIMUM_SIGNED_DEPENDENCY_PREPARATION",source,target,stage:"OFFICIAL_ARCHIVE_ACQUISITION",status:"FAIL",cause,cleanupFailure:sodiumCauses.has(error?.cleanupCause)?error.cleanupCause:null}));throw Error(cause);}
 dependencyCleanup=prepared.dependencyCleanup;dependencyCleanupFailure=prepared.dependencyCleanupFailure;
 if(prepared.compilation.status==="THREW"){
  console.log(JSON.stringify({evidence:"MINIMUM_COMPILER_COMPATIBILITY_ONLY",source,target,stage:"COMPILER_START",status:"FAIL",cause:"MINIMUM_COMPILER_CALLBACK_FAILED",dependencyCleanup,dependencyCleanupFailure,applicationExecuted:false,artifactAdmission:false}));
  throw prepared.compilation.error;
 }
 result=prepared.compilation.value;
}else result=spawnSync("cargo",command,{env,stdio:"inherit",windowsHide:true,timeout:2100000});
const after=hash();
console.log(JSON.stringify({evidence:"MINIMUM_COMPILER_COMPATIBILITY_ONLY",source,target,profile:"production",compiler:"1.90.0",startUtc,endUtc:new Date().toISOString(),elapsedMs:Math.round(performance.now()-start),exitCode:result.status,signal:result.signal,errorCode:result.error?.code??null,lockBefore:before,lockAfter:after,dependencyCleanup,dependencyCleanupFailure,applicationExecuted:false,artifactAdmission:false}));
if(before!==after) throw Error("MINIMUM_LOCKFILE_CHANGED");
process.exitCode=minimumCompilerExitCode(result,dependencyCleanup);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await minimumCompile();
