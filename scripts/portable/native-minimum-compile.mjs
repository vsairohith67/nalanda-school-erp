/** DRAFT Rust minimum compatibility only. No artifact production or admission. */
import {execFileSync, spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import {readFileSync, existsSync} from "node:fs";
import path from "node:path";
import {performance} from "node:perf_hooks";

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
const result=spawnSync("cargo",command,{env,stdio:"inherit",windowsHide:true,timeout:2100000});
const after=hash();
console.log(JSON.stringify({evidence:"MINIMUM_COMPILER_COMPATIBILITY_ONLY",source,target,profile:"production",compiler:"1.90.0",startUtc,endUtc:new Date().toISOString(),elapsedMs:Math.round(performance.now()-start),exitCode:result.status,signal:result.signal,errorCode:result.error?.code??null,lockBefore:before,lockAfter:after,applicationExecuted:false,artifactAdmission:false}));
if(before!==after) throw Error("MINIMUM_LOCKFILE_CHANGED");
process.exitCode=result.status??1;
