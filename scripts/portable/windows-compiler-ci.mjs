/** Existing hosted Windows compiler commands with signed dependency preparation. No runtime admission. */
import {execFileSync,spawnSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {withPreparedWindowsSodium} from "./native-minimum-compile.mjs";

const commands=Object.freeze([
 "pnpm app:rust:test --locked",
 "pnpm exec tsx scripts/portable/qa-native-profile-compile.ts --integration-test",
 "pnpm app:windows:build -- --locked"
]);
export function runWindowsCompilerCommands(environment,run=spawnSync,observe=()=>{}) {
 const phases=[];
 for(const command of commands){
  // Same hosted pwsh execution as the original workflow steps. Fixed source
  // commands only, no profile or execution-policy change, no ambient interpolation.
  const result=run("pwsh",["-NoLogo","-NoProfile","-NonInteractive","-Command",`$ErrorActionPreference='Stop'; & ${command}; if ($null -eq $LASTEXITCODE) { throw 'WINDOWS_COMPILER_EXIT_MISSING' }; exit $LASTEXITCODE`],
   {env:{...environment},stdio:"inherit",windowsHide:true,timeout:45*60*1000});
  const row={command,exitCode:result.status,signal:result.signal??null,errorCode:result.error?.code??null};
  phases.push(row);observe(row);
  if(result.status!==0||result.error)return {passed:false,phases};
 }
 return {passed:true,phases};
}
export async function windowsCompilerCi(){
 if(process.platform!=="win32"||process.env.GITHUB_ACTIONS!=="true"||process.env.RUNNER_ENVIRONMENT!=="github-hosted"||process.env.RUNNER_OS!=="Windows"||process.env.RUSTUP_TOOLCHAIN!=="1.97.1")throw Error("WINDOWS_COMPILER_HOST_REQUIRED");
 const command=(name,args)=>execFileSync(name,args,{encoding:"utf8",windowsHide:true,timeout:30000});
 if(!/^rustc 1\.97\.1\s/.test(command("rustc",["--version"]))||!/^cargo 1\.97\.1\s/.test(command("cargo",["--version"])))throw Error("WINDOWS_COMPILER_IDENTITY_MISMATCH");
 const lock="apps/nalanda-cross-platform/src-tauri/Cargo.lock",hash=()=>createHash("sha256").update(readFileSync(lock)).digest("hex");
 const before=hash(),source=command("git",["rev-parse","HEAD"]).trim();
 const result=await withPreparedWindowsSodium(readFileSync(lock,"utf8"),{...process.env},environment=>runWindowsCompilerCommands(environment,spawnSync,row=>console.log(JSON.stringify({evidence:"WINDOWS_COMPILER_PHASE",source,...row}))));
 const after=hash(),outcome=result.compilation;
 console.log(JSON.stringify({evidence:"WINDOWS_SIGNED_DEPENDENCY_COMPILER",source,compiler:"1.97.1",files:result.files,verification:"UNCHANGED_UPSTREAM_BUILD_SCRIPT",compilation:outcome.status==="RETURNED"?outcome.value:{passed:false,cause:"WINDOWS_COMPILER_CALLBACK_FAILED"},dependencyCleanup:result.dependencyCleanup,dependencyCleanupFailure:result.dependencyCleanupFailure,lockBefore:before,lockAfter:after,applicationExecuted:false,artifactAdmission:false}));
 if(outcome.status!=="RETURNED"||!outcome.value.passed){process.exitCode=outcome.status==="RETURNED"?(outcome.value.phases.at(-1)?.exitCode||1):1;return;}
 if(before!==after)throw Error("WINDOWS_COMPILER_LOCK_CHANGED");
 if(result.dependencyCleanup!=="VERIFIED")throw Error("WINDOWS_COMPILER_DEPENDENCY_CLEANUP_UNRECONCILED");
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{if(process.argv.length!==2)throw Error("WINDOWS_COMPILER_ARGUMENTS_REFUSED");await windowsCompilerCi();}
 catch(error){console.log(JSON.stringify({evidence:"WINDOWS_COMPILER_REFUSED",cause:error instanceof Error&&/^(WINDOWS_COMPILER|MINIMUM_SODIUM)_[A-Z_]+$/.test(error.message)?error.message:"WINDOWS_COMPILER_FAILED",cleanupCause:/^MINIMUM_SODIUM_[A-Z_]+$/.test(error?.cleanupCause??"")?error.cleanupCause:null}));process.exitCode=1;}
}
