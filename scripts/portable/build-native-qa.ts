import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {copyFileSync,readFileSync,writeFileSync,mkdirSync,readdirSync,existsSync,lstatSync,realpathSync,unlinkSync,constants} from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";
import {readNativeQaInput,validateNativeQaProfile} from "./native-qa-profile";
import {hashBytes} from "./artifact-handoff";
import {createPrivateWindowsChannel,validateWindowsPrivateTransport,assertPrivateWindowsAcl,type WindowsPrivateTransport} from "./windows-private-transport";
import {privateWindowsOs} from "./windows-webdriver-host";
import {createProducerRoot,cleanupProducerRoot,validateProducerRoot,producerPaths,type ProducerIdentity} from "./synthetic-build-lifecycle";
import {NATIVE_INPUTS,NATIVE_OUTPUTS,inventoryNativeFile,nativeOwnedPath,validateNativeScratch,removeNativeScratch,verifyNativeOutputs,verifyNativeSecurity,verifyNativeReceipt,type NativeInventory} from "./native-artifact";
import {requestNativeBuildToken} from "./native-build-origin";

const git=(...args:string[])=>execFileSync("git",args,{encoding:"utf8",stdio:["ignore","pipe","pipe"],timeout:30000}).trim();
export function nativeSourceInputs(source:string){
 assert.equal(git("rev-parse","HEAD"),source);assert.equal(git("status","--porcelain","--untracked-files=normal"),"","NATIVE_QA_CLEAN_SOURCE_REQUIRED");
 return Object.fromEntries(NATIVE_INPUTS.map(name=>{const blob=git("rev-parse",`${source}:${name}`);assert.equal(git("hash-object",`--path=${name}`,name),blob,"NATIVE_INPUT_CHANGED");return [name,{gitBlob:blob,sha256:hashBytes(readFileSync(name))}];}));
}
export function cleanupNativeBuild(config:WindowsPrivateTransport){
 validateWindowsPrivateTransport(config,config);assert.equal(process.platform,"win32");assert.equal(process.env.GITHUB_ACTIONS,"true");assert.equal(process.env.RUNNER_ENVIRONMENT,"github-hosted");assert.equal(process.env.PORTABLE_CI_EXCEPTION,"OWNER_AUTHORIZED");
 assert.equal(config.source,process.env.EXPECTED_SHA);assert.equal(config.runId,process.env.GITHUB_RUN_ID);assert.equal(config.attempt,process.env.GITHUB_RUN_ATTEMPT);
 assert.equal(git("rev-parse","HEAD"),config.source,"NATIVE_CLEANUP_SOURCE_CHANGED");
 assert.equal(git("hash-object","--path=scripts/portable/windows-host.ps1","scripts/portable/windows-host.ps1"),git("rev-parse",`${config.source}:scripts/portable/windows-host.ps1`),"WINDOWS_HOST_SOURCE_CHANGED");
 assertPrivateWindowsAcl(privateWindowsOs({operation:"file-security",file:config.root}),config.userSid);
 const id:ProducerIdentity={source:config.source,runId:config.runId,attempt:config.attempt,architecture:"amd64"};
 // A timed-out synchronous build may have surviving compiler descendants.
 // Preserve ambiguous residue for the disposable runner's teardown, not rm.
 assert(!existsSync(path.join(producerPaths(config.root,id).work,"process-unreconciled")),"NATIVE_BUILD_PROCESS_STATE_UNRECONCILED");
 const work=producerPaths(config.root,id).work;if(existsSync(work)){validateProducerRoot(config.root,id,"work");if(existsSync(path.join(work,"cargo")))removeNativeScratch(work);}
 return cleanupProducerRoot(config.root,id,"work");
}
/** Real same-job producer. No package is uploaded, installed or executed.
 * The private controller supplies the independent anchor and authenticates the
 * hosted build before the retained run-owned Ed25519 signer seals its outputs. */
export async function buildNativeQa(directory:string,config:WindowsPrivateTransport) {
 assert.equal(process.platform,"win32");assert.equal(process.env.GITHUB_EVENT_NAME,"workflow_dispatch");
 for(const key of ["TAURI_CONFIG","RUSTFLAGS","CARGO_ENCODED_RUSTFLAGS","RUSTC_WRAPPER","RUSTC_WORKSPACE_WRAPPER"])assert(!process.env[key],"NATIVE_UNREVIEWED_BUILD_OVERRIDE");
 const channel=createPrivateWindowsChannel(config,config),context=channel.native().context;
 const root=path.resolve(directory),trust=readNativeQaInput(path.join(root,"trust.json")),envelope=readNativeQaInput(path.join(root,"profile.json"));
 assert.deepEqual(trust,context.trust,"NATIVE_TRUST_NOT_FROM_ADMITTED_CONTROLLER");assert.deepEqual(envelope,context.profile,"NATIVE_PROFILE_NOT_FROM_ADMITTED_CONTROLLER");
 const trustDigest=hashBytes(JSON.stringify(trust)),profileDigest=hashBytes(JSON.stringify(envelope));
 assert.equal(hashBytes(readFileSync(path.join(root,"trust.json"))),trustDigest);assert.equal(hashBytes(readFileSync(path.join(root,"profile.json"))),profileDigest);
 const p=validateNativeQaProfile(trust,envelope),source=git("rev-parse","HEAD");assert.equal(p.source,source);assert.equal(process.env.GITHUB_SHA,source);
 const inputs=nativeSourceInputs(source),id:ProducerIdentity={source,runId:p.runId,attempt:p.attempt,architecture:"amd64"};
 assert.equal(p.nativeBuildId,hashBytes(JSON.stringify({source,runId:p.runId,attempt:p.attempt,backendBuildId:p.buildId,profile:"synthetic-qa",architecture:"x64"})));
 const app=path.resolve("apps/nalanda-cross-platform"),require=createRequire(path.join(app,"package.json"));
 const cli=path.join(path.dirname(require.resolve("@tauri-apps/cli/package.json")),"tauri.js");
 const run=(tool:string,args:string[],cwd=process.cwd(),env:NodeJS.ProcessEnv=process.env,timeout=180000)=>execFileSync(tool,args,{cwd,env,stdio:["ignore","pipe","pipe"],windowsHide:true,timeout,maxBuffer:4*1024*1024});
 const version=(tool:string,args:string[])=>run(tool,args).toString().trim();
 // pnpm/action-setup may provide a cmd shim or standalone exe. These are fixed
 // literal commands: no private input, caller argument or path is interpolated.
 const pnpm=(command:"pnpm --version"|"pnpm audit --prod --audit-level high --json",cwd=process.cwd())=>run("cmd.exe",["/d","/s","/c",command],cwd);
 const tools={node:process.version,pnpm:pnpm("pnpm --version").toString().trim(),rustc:version("rustc",["--version"]),cargo:version("cargo",["--version"]),tauri:require("@tauri-apps/cli/package.json").version,cargoAudit:version("cargo",["audit","--version"])} as NativeInventory["tools"];
 const locate=(name:string)=>{const found=version("where.exe",[name]).split(/\r?\n/).filter(f=>/\.(exe|cmd)$/i.test(f));assert.equal(found.length,1,"NATIVE_TOOL_PATH_AMBIGUOUS");return found[0];};
 const toolFiles={node:process.execPath,pnpm:locate("pnpm"),rustc:version("rustup",["which","rustc"]),cargo:version("rustup",["which","cargo"]),tauri:cli,cargoAudit:locate("cargo-audit")};
 const toolHashes=()=>Object.fromEntries(Object.entries(toolFiles).map(([k,f])=>{const s=lstatSync(f);assert(s.isFile()&&!s.isSymbolicLink()&&s.size<=256*1024*1024&&realpathSync(f)===path.resolve(f));return [k,hashBytes(readFileSync(f))];})) as NativeInventory["toolSha256"];
 const toolSha256=toolHashes();
 const cfg=JSON.parse(readFileSync(path.join(app,"src-tauri/tauri.conf.json"),"utf8"));
 assert(cfg.identifier==="com.nalandaps.erp"&&cfg.version==="0.1.0"&&cfg.productName==="Nalanda School"&&!cfg.bundle.resources&&!cfg.bundle.externalBin&&!cfg.mainBinaryName,"NATIVE_SUPPORT_CONFIGURATION_UNREVIEWED");
 let owned=false,buildPending=false;
 try{
  const work=createProducerRoot(config.root,id,"work");owned=true;
  for(const folder of ["launch","package","native-qa","security"])mkdirSync(path.join(work,folder));
  for(const name of ["trust.json","profile.json"])writeFileSync(path.join(work,"native-qa",name),readFileSync(path.join(root,name)),{flag:"wx",mode:0o600});
  const cargoTarget=path.join(work,"cargo");mkdirSync(cargoTarget);
  writeFileSync(path.join(work,"process-unreconciled"),"NATIVE_BUILD_PROCESS_STATE_UNRECONCILED",{flag:"wx",mode:0o600});
  buildPending=true;
  run(process.execPath,[cli,"build","--features","synthetic-qa","--target","x86_64-pc-windows-msvc","--bundles","nsis","--","--locked"],app,{...process.env,CARGO_TARGET_DIR:cargoTarget,NALANDA_NATIVE_PROFILE:"SYNTHETIC_QA",NALANDA_QA_INPUT_DIRECTORY:path.join(work,"native-qa"),NALANDA_QA_PROFILE_SHA256:profileDigest,NALANDA_QA_TRUST_SHA256:trustDigest},1800000);
  buildPending=false;
  unlinkSync(nativeOwnedPath(work,"process-unreconciled"));
  const release="cargo/x86_64-pc-windows-msvc/release";
  const nsis=nativeOwnedPath(work,`${release}/bundle/nsis`,true);
  assert.deepEqual(readdirSync(nsis),[path.posix.basename(NATIVE_OUTPUTS[1])],"NATIVE_AMBIGUOUS_INSTALLER_OUTPUT");
  validateNativeScratch(work);
  for(const [from,to] of [[`${release}/nalanda-cross-platform.exe`,NATIVE_OUTPUTS[0]],[`${release}/bundle/nsis/${path.posix.basename(NATIVE_OUTPUTS[1])}`,NATIVE_OUTPUTS[1]]] as const){
   // Exact fixed source paths in the just-validated all-peer Cargo scratch.
   const src=path.join(work,from);assert(lstatSync(src).isFile()&&realpathSync(src)===src);copyFileSync(src,path.join(work,to),constants.COPYFILE_EXCL);assert.equal(hashBytes(readFileSync(src)),hashBytes(readFileSync(path.join(work,to))),"NATIVE_COPY_SUBSTITUTED");
  }
  assert.deepEqual(nativeSourceInputs(source),inputs,"NATIVE_BUILD_INPUTS_CHANGED");assert.deepEqual(toolHashes(),toolSha256,"NATIVE_BUILD_TOOL_CHANGED");validateNativeQaProfile(trust,envelope);
  const reports={rootAudit:pnpm("pnpm audit --prod --audit-level high --json"),appAudit:pnpm("pnpm audit --prod --audit-level high --json",app),rustAudit:run("cargo",["audit","--json","--file",path.join(app,"src-tauri/Cargo.lock")])};
  const security=Object.fromEntries(Object.entries(reports).map(([k,b])=>[k,hashBytes(b)])) as NativeInventory["security"];verifyNativeSecurity(reports,security);
  for(const [k,b] of Object.entries(reports))writeFileSync(path.join(work,"security",`${k}.json`),b,{flag:"wx",mode:0o600});
  const inventory:NativeInventory={contract:"NALANDA_WINDOWS_NATIVE_INVENTORY_V1",classification:"HOSTED_EXACT_NATIVE_BUILD",source,tree:git("show","-s","--format=%T",source),runId:p.runId,attempt:p.attempt,nativeBuildId:p.nativeBuildId,profile:"SYNTHETIC_QA",appId:p.appId,version:"0.1.0",architecture:"x64",backendBuildId:p.buildId,backendImage:context.imageConfigDigest,containerId:context.containerId,profileSha256:profileDigest,trustSha256:trustDigest,createdAt:Date.now(),expiresAt:p.expiresAt,inputs,tools,toolSha256,outputs:NATIVE_OUTPUTS.map(f=>inventoryNativeFile(work,f)),security};
  const token=await requestNativeBuildToken(inventory),sealed=channel.native(inventory,token);assert.deepEqual(verifyNativeReceipt(sealed.receipt,sealed.context),inventory);
  verifyNativeOutputs(work,inventory);validateProducerRoot(config.root,id,"work");
  writeFileSync(path.join(work,"native-receipt.json"),JSON.stringify(sealed.receipt),{flag:"wx",mode:0o600});
  return {state:"QA_NATIVE_EVIDENCE_SEALED_BACKEND_RECHECK_REQUIRED",source,nativeBuildId:p.nativeBuildId,executableSha256:inventory.outputs[0].sha256,installerSha256:inventory.outputs[1].sha256};
 }catch{
  if(owned&&buildPending)throw Error("NATIVE_BUILD_PROCESS_STATE_UNRECONCILED");
  if(owned)try{cleanupNativeBuild(config);}catch{throw Error("NATIVE_BUILD_FAILED_OWNED_CLEANUP_REFUSED");}
  throw Error("NATIVE_QA_BUILD_OR_EVIDENCE_REFUSED");
 }
}
if(/(?:^|[\\/])build-native-qa\.(?:ts|mjs)$/.test(process.argv[1]??"")){
 try{assert(process.argv.length===4);const config=readNativeQaInput(path.resolve(process.argv[3])) as WindowsPrivateTransport;
  if(process.argv[2]==="--cleanup"){
   // No backend admission is needed to clean expired same-run output. Local
   // identity and existing owner/ancestor/hardlink checks remain mandatory.
   console.log(JSON.stringify({cleanup:cleanupNativeBuild(config)}));
  }else console.log(JSON.stringify(await buildNativeQa(process.argv[2],config)));
 }catch{console.error("NATIVE_QA_BUILD_REFUSED_OR_OWNED_RESIDUE_REQUIRES_RECONCILIATION");process.exitCode=1;}
}
