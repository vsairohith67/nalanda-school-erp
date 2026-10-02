import {createHash} from "node:crypto";
import {readFileSync,writeFileSync,lstatSync,realpathSync,mkdirSync,existsSync,readdirSync,chmodSync,statfsSync} from "node:fs";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {hashBytes,verifyImageSecurityReports,type EvidenceFiles} from "./artifact-handoff";
import {assertVerifiedInputs,boundedJson,requireInput,safeRelative,productionInputPolicy,verifyInputs,TOOL_NAMES,type VerifiedInputs,type BlobReader,type SourceFile} from "./product-input-contract";
import {createProducerRoot,validateProducerRoot,cleanupProducerRoot,producerPaths,type ProducerIdentity} from "./synthetic-build-lifecycle";
import {captureProductProcess,productEnvironment,type ProductProcessReceipt} from "./producer-process";
import {productionBuildCommand,bindProductionSources} from "./rootless-build-command";
import {runRootlessBuild,cleanupRootlessBuild,type RootlessOptions} from "./qa-rootless-build";
import type {ProducerCommand} from "./qa-artifact-producer";

export type ProductHarness={classification:"HARNESS_ONLY";command:(command:ProducerCommand,root:string)=>ProducerCommand;signal?:AbortSignal};
export function privateFile(file:string,max=1024*1024*1024){const s=lstatSync(file);requireInput(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&realpathSync(file)===file&&s.size<=max,"PRODUCT_FILE_UNSAFE");const b=readFileSync(file),after=lstatSync(file);requireInput(b.length===s.size&&s.ino===after.ino&&s.mtimeMs===after.mtimeMs&&s.ctimeMs===after.ctimeMs,"PRODUCT_FILE_CHANGED");return b;}
export function evidenceReader(root:string):BlobReader {requireInput(path.isAbsolute(root)&&realpathSync(root)===root&&!lstatSync(root).isSymbolicLink(),"PRODUCT_EVIDENCE_ROOT_UNSAFE");return id=>{requireInput(/^[a-f0-9]{64}$/.test(id),"PRODUCT_BLOB_NAME");return privateFile(path.join(root,id));};}
function write(file:string,bytes:Buffer|string){mkdirSync(path.dirname(file),{recursive:true,mode:0o700});writeFileSync(file,bytes,{flag:"wx",mode:0o600});}
function objectHash(kind:string,bytes:Buffer){return createHash("sha1").update(`${kind} ${bytes.length}\0`).update(bytes).digest("hex");}
export function sourceTree(files:SourceFile[]):string {
 const tree=(prefix:string):string=>{const entries=new Map<string,{mode:string;hash:string;dir:boolean}>();for(const f of files){if(!f.path.startsWith(prefix))continue;const rest=f.path.slice(prefix.length),slash=rest.indexOf("/");if(slash<0){requireInput(!entries.has(rest),"PRODUCT_TREE_COLLISION");entries.set(rest,{mode:f.mode.replace(/^0/,""),hash:f.gitBlob,dir:false});}else{const dir=rest.slice(0,slash);if(!entries.has(dir))entries.set(dir,{mode:"40000",hash:tree(prefix+dir+"/"),dir:true});else requireInput(entries.get(dir)!.dir,"PRODUCT_TREE_COLLISION");}}
 const parts=[...entries].sort(([a,x],[b,y])=>Buffer.compare(Buffer.from(a+(x.dir?"/":"")),Buffer.from(b+(y.dir?"/":"")))).map(([name,e])=>Buffer.concat([Buffer.from(`${e.mode} ${name}\0`),Buffer.from(e.hash,"hex")]));return objectHash("tree",Buffer.concat(parts));};return tree("");
}
function sourceBytes(workspace:string,files:SourceFile[],expectedTree:string,copy?:string){
 requireInput(sourceTree(files)===expectedTree,"PRODUCT_SOURCE_TREE_MISMATCH");let total=0;
 for(const f of files){safeRelative(f.path);const file=path.join(workspace,f.path),bytes=privateFile(file,128*1024*1024);total+=bytes.length;requireInput(total<=512*1024*1024&&hashBytes(bytes)===f.sha256&&objectHash("blob",bytes)===f.gitBlob,"PRODUCT_SOURCE_BYTES_CHANGED");if(copy){write(path.join(copy,f.path),bytes);chmodSync(path.join(copy,f.path),f.mode==="100755"?0o500:0o400);}}
 if(copy){const trust=readFileSync(path.join(copy,"config/synthetic-build-trust.json"),"utf8");requireInput(JSON.parse(trust)===null,"PRODUCT_QA_TRUST_FORBIDDEN");}
}
function contextGuard(root:string,files:SourceFile[],tree:string){sourceBytes(root,files,tree);const expected=new Set(files.map(f=>f.path));const walk=(dir:string)=>{for(const name of readdirSync(dir)){const file=path.join(dir,name),s=lstatSync(file);requireInput(!s.isSymbolicLink()&&realpathSync(file)===file,"PRODUCT_CONTEXT_LINK");if(s.isDirectory())walk(file);else requireInput(expected.delete(path.relative(root,file).split(path.sep).join("/")),"PRODUCT_CONTEXT_EXTRA_FILE");}};walk(root);requireInput(expected.size===0,"PRODUCT_CONTEXT_INCOMPLETE");}
function code(error:unknown){if((error as NodeJS.ErrnoException)?.code==="ENOSPC")return "PRODUCT_DISK_CAPACITY_EXHAUSTED";const s=error instanceof Error?error.message:"";return /^[A-Z][A-Z0-9_]{3,90}$/.test(s)?s:"PRODUCT_PHASE_FAILED";}
function okay(r:ProductProcessReceipt){return r.exit===0&&!r.signal&&!r.startupFailed&&!r.timedOut&&!r.interrupted&&!r.ioFailed&&r.settled;}
export function assertProductionHost(identity:ProducerIdentity,environment:NodeJS.ProcessEnv=process.env){requireInput(process.platform==="linux"&&process.getuid?.()!==0&&!environment.DOCKER_HOST&&!environment.DOCKER_CONTEXT&&environment.GITHUB_ACTIONS==="true"&&environment.RUNNER_ENVIRONMENT==="github-hosted"&&environment.RUNNER_OS==="Linux"&&environment.PORTABLE_CI_EXCEPTION==="OWNER_AUTHORIZED"&&environment.EXPECTED_SHA===identity.source&&environment.GITHUB_RUN_ID===identity.runId&&environment.GITHUB_RUN_ATTEMPT===identity.attempt&&environment.GITHUB_JOB==="backend-build-scan"&&environment.GITHUB_REPOSITORY==="vsairohith67/nalanda-school-erp"&&process.arch===(identity.architecture==="amd64"?"x64":"arm64"),"PRODUCT_HOST_OR_AUTHORIZATION_REFUSED");}

/** One actual state machine for production and the explicitly classified harness.
 * Harness substitution supplies executable stand-ins, never verifier decisions.
 * The production CLI cannot supply this port or obtain a test trust policy. */
export async function runProductBuildScan(workspace:string,input:VerifiedInputs,blobs:BlobReader,harness?:ProductHarness,productionSignal?:AbortSignal){
 assertVerifiedInputs(input);const d=input.document,identity:ProducerIdentity={source:d.source,runId:d.runId,attempt:d.attempt,architecture:d.architecture};
 requireInput((input.classification==="HARNESS_ONLY")===!!harness&&(!harness||harness.classification==="HARNESS_ONLY"),"PRODUCT_HARNESS_BOUNDARY");if(!harness)assertProductionHost(identity);
 workspace=path.resolve(workspace);sourceBytes(workspace,d.files,d.tree);
 const root=producerPaths(workspace,identity,"production").work,unsettled=new Set<number>(),processes:ProductProcessReceipt[]=[],states:string[]=[],failures:string[]=[],cleanupFailures:string[]=[],initialReportHashes:Record<string,string>={},partialOutput:Record<string,{sha256:string;bytes:number}>={};
 const signal=harness?.signal??productionSignal,materialHashes=new Map<string,string>();
 let owned=false,ownerHash="",stage="inputs",sequence=0,output:any=null,reportCapture:any=null,rootless:RootlessOptions|undefined;
 const guard=()=>{assertVerifiedInputs(input);if(signal?.aborted)throw Error("PRODUCT_INTERRUPTED");sourceBytes(workspace,d.files,d.tree);if(owned){requireInput(hashBytes(privateFile(path.join(root,"owner.json"),4096))===ownerHash,"PRODUCT_OWNER_SUBSTITUTED");validateProducerRoot(workspace,identity,"work","production");if(existsSync(path.join(root,"context")))contextGuard(path.join(root,"context"),d.files,d.tree);}};
 const tools=()=>{for(const [file,expected] of materialHashes)requireInput(hashBytes(privateFile(file))===expected,"PRODUCT_MATERIAL_SUBSTITUTED");for(const name of TOOL_NAMES){const t=d.tools[name];requireInput(hashBytes(privateFile(path.join(root,t.file)))===t.sha256,"PRODUCT_TOOL_SUBSTITUTED");}return {work:root,bin:path.join(root,"tools/buildkit/bin"),rootless:path.join(root,d.tools.rootlesskit.file)};};
 const processCommand=async(command:ProducerCommand,required=true)=>{stage=command.stage;requireInput(unsettled.size===0,"PRODUCT_PROCESS_UNSETTLED");guard();tools();for(const db of Object.values(d.databases))requireInput(hashBytes(privateFile(path.join(root,db.file)))===db.sha256,"PRODUCT_DATABASE_SUBSTITUTED");const actual=harness?harness.command(command,root):command;if(harness){guard();tools();}const r=await captureProductProcess(actual,root,++sequence,unsettled,signal);r.stage=command.stage;processes.push(r);if(!okay(r)){if(command.stage!=="rootless-ready"||!r.settled||r.interrupted)failures.push(`PRODUCT_${command.stage.toUpperCase().replace(/[^A-Z0-9]/g,"_")}_PROCESS_FAILED`);if(required)throw Error(failures.at(-1)??"PRODUCT_READINESS_PENDING");}states.push(command.stage);return {receipt:r,stdout:privateFile(path.join(root,`process-${sequence}.stdout`),64*1024*1024)};};
 const adapter=async(action:string,subject?:string)=>{const result=await processCommand({stage:action,tool:path.join(root,d.tools.python.file),args:["-B",path.join(root,"context/scripts/portable/product-scan-adapter.py"),action,root,d.architecture,d.source,...(subject?[subject]:[])]});return boundedJson(result.stdout);};
 const recheckOutput=async()=>{requireInput(hashBytes(privateFile(path.join(root,"product.oci.tar")))===output.archiveSha256,"PRODUCT_OUTPUT_SUBSTITUTED");const layout=path.join(root,"product-oci"),seen=new Set<string>();const walk=(dir:string)=>{for(const name of readdirSync(dir)){const file=path.join(dir,name),stat=lstatSync(file);requireInput(!stat.isSymbolicLink()&&realpathSync(file)===file,"PRODUCT_LAYOUT_SUBSTITUTED");if(stat.isDirectory())walk(file);else{const relative=path.relative(layout,file).split(path.sep).join("/");requireInput(output.files[relative]===hashBytes(privateFile(file)),"PRODUCT_LAYOUT_SUBSTITUTED");seen.add(relative);}}};walk(layout);requireInput(seen.size===Object.keys(output.files).length,"PRODUCT_LAYOUT_INCOMPLETE");};
 try{
  stage="create-root";guard();const space=statfsSync(workspace);requireInput(space.bavail*space.bsize>= (harness?8*1024*1024:6*1024**3),"PRODUCT_DISK_CAPACITY_MISSING");createProducerRoot(workspace,identity,"work","production");owned=true;ownerHash=hashBytes(privateFile(path.join(root,"owner.json"),4096));
  for(const dir of ["home","temp","cache"])mkdirSync(path.join(root,dir),{mode:0o700});
  stage="bind-context";sourceBytes(workspace,d.files,d.tree,path.join(root,"context"));
  const dockerfile=readFileSync(path.join(root,"context/Dockerfile"),"utf8");requireInput(dockerfile.includes("ARG NODE_IMAGE="+d.images.builder.reference)&&dockerfile.includes("ARG RUNTIME_IMAGE="+d.images.runtime.reference),"PRODUCT_RECIPE_BASE_MISMATCH");
  for(const name of TOOL_NAMES){const t=d.tools[name];requireInput(t.file.startsWith("tools/")&&!d.files.some(f=>f.path===t.file),"PRODUCT_TOOL_PATH_INVALID");write(path.join(root,t.file),blobs(t.sha256));chmodSync(path.join(root,t.file),0o500);}
  requireInput(d.tools.buildctl.file==="tools/buildkit/bin/buildctl"&&d.tools.buildkitd.file==="tools/buildkit/bin/buildkitd"&&d.tools.runc.file==="tools/buildkit/bin/buildkit-runc","PRODUCT_BUILDKIT_PATH_MISMATCH");
  for(const db of Object.values(d.databases))for(const f of db.files){const file=path.join(root,f.file);write(file,blobs(f.sha256));materialHashes.set(file,f.sha256);}
  const binsFile=path.join(root,"scanner-bins.json");write(binsFile,JSON.stringify({trivy:path.join(root,d.tools.trivy.file),grype:path.join(root,d.tools.grype.file)}));materialHashes.set(binsFile,hashBytes(privateFile(binsFile)));
  // No mutable acquisition is silently authorized by a recipe review. Current
  // retained apt/corepack/pnpm-install recipe fails this finite offline contract.
  requireInput(!/\b(?:apt-get|apt|corepack|curl|wget)\b|\b(?:pnpm|npm|yarn)\s+(?:install|add|fetch)\b/i.test(dockerfile),"PRODUCT_OFFLINE_RECIPE_MATERIALS_UNQUALIFIED");
  const staged=(file:string,bytes:Buffer|string)=>{write(file,bytes);materialHashes.set(file,hashBytes(Buffer.from(bytes)));};
  const inspection:any={images:{},tools:[]};
  for(const [name,image] of Object.entries(d.images)){
   const layout=path.join(root,"inputs",name),manifest=boundedJson(blobs(image.manifest));
   staged(path.join(layout,"index.json"),blobs(image.index));staged(path.join(layout,"oci-layout"),JSON.stringify({imageLayoutVersion:"1.0.0"}));
   for(const id of new Set([image.index,image.manifest,image.config,...manifest.layers.map((l:any)=>l.digest.slice(7))] as string[]))staged(path.join(layout,"blobs/sha256",id),blobs(id));
   const node=image.node?boundedJson(blobs(image.node)):null;
   if(name==="runtime"||name==="builder")requireInput(node.path===(name==="runtime"?"nodejs/bin/node":"usr/local/bin/node"),"PRODUCT_NODE_PATH_MISMATCH");
   inspection.images[name]={manifest:image.manifest,nodePath:node?.path??null,nodeSha256:node?.binarySha256??null};
  }
  for(const tool of Object.values(d.tools)){const origin=boundedJson(blobs(tool.archive));const file=path.join(root,"input-archives",origin.archiveSha256);if(!materialHashes.has(file))staged(file,blobs(origin.archiveSha256));inspection.tools.push(origin);}
  staged(path.join(root,"input-inspection.json"),JSON.stringify(inspection));
  staged(path.join(root,"source-policy.json"),JSON.stringify({rules:[{action:"DENY",selector:{identifier:"*"}},...["local://context","local://dockerfile","oci-layout://runtime@sha256:"+d.images.runtime.index,"oci-layout://builder@sha256:"+d.images.builder.index,"oci-layout://frontend@sha256:"+d.images.frontend.index].map(identifier=>({action:"ALLOW",selector:{identifier}}))]}));
  await adapter("inputs");
  const trivyStatus=boundedJson((await processCommand({stage:"trivy-db-status",tool:path.join(root,d.tools.trivy.file),args:["--cache-dir",path.join(root,"trivy-db"),"--version","--format","json"]})).stdout);
  const grypeStatus=boundedJson((await processCommand({stage:"grype-db-status",tool:path.join(root,d.tools.grype.file),args:["db","status","-o","json"],env:{GRYPE_DB_CACHE_DIR:path.join(root,"grype-db"),GRYPE_DB_AUTO_UPDATE:"false",GRYPE_CHECK_FOR_APP_UPDATE:"false"}})).stdout);
  requireInput(trivyStatus.Version===d.tools.trivy.version&&trivyStatus.VulnerabilityDB?.Version===2&&Date.parse(trivyStatus.VulnerabilityDB.UpdatedAt)===Date.parse(d.databases.trivy.updatedAt),"PRODUCT_TRIVY_DATABASE_STATUS");
  requireInput(grypeStatus.valid===true&&grypeStatus.schemaVersion==="6.1.4"&&grypeStatus.path===path.join(root,d.databases.grype.file)&&Date.parse(grypeStatus.built)===Date.parse(d.databases.grype.updatedAt),"PRODUCT_GRYPE_DATABASE_STATUS");tools();
  states.push("INPUTS_VERIFIED_FOR_BUILD");
  const build=bindProductionSources(productionBuildCommand(root,identity,d.configuration.epoch,d.configuration.frontend),root,d.images);
  if(harness)await processCommand(build);
  else{rootless={profile:"production",tools,daemonSequence:++sequence,daemonOutcome:r=>{if(r){processes.push(r);if(!r.settled)unsettled.add(-1);if(!r.intentionalShutdown)failures.push("PRODUCT_DAEMON_PREMATURE_OR_FAILED");}else unsettled.add(-1);},environment:{...productEnvironment(root),PATH:path.join(root,"tools/buildkit/bin")+path.delimiter+productEnvironment(root).PATH},run:async command=>{const r=await processCommand(command);return r.stdout.toString();}};stage="rootless-build";await runRootlessBuild(build,workspace,identity,signal,rootless);}
  guard();output=await adapter("inspect");
  requireInput(output.configDigest!==d.images.runtime.subject&&output.configDigest!==d.images.builder.subject,"PRODUCT_DISTINCT_OUTPUT_REQUIRED");
  const env={SYFT_CHECK_FOR_APP_UPDATE:"false",SYFT_CACHE_DIR:path.join(root,"syft-cache"),GRYPE_CHECK_FOR_APP_UPDATE:"false",GRYPE_DB_CACHE_DIR:path.join(root,"grype-db"),GRYPE_DB_AUTO_UPDATE:"false"};
  // Independent scanners continue after a settled required failure, retaining
  // each original output. An unsettled child forbids further work and cleanup.
  const scans:Record<string,ProductProcessReceipt>={};
  const scan=async(command:ProducerCommand)=>{await recheckOutput();const r=await processCommand(command,false);scans[command.stage]=r.receipt;requireInput(unsettled.size===0,"PRODUCT_PROCESS_UNSETTLED");const name=command.stage==="syft"?"sbom.json":command.stage+".json";if(existsSync(path.join(root,name))){initialReportHashes[name]=hashBytes(privateFile(path.join(root,name),64*1024*1024));write(path.join(root,name+".process-receipt.json"),JSON.stringify({subject:output.configDigest,sha256:initialReportHashes[name],process:r.receipt}));}await recheckOutput();};
  await scan({stage:"syft",tool:path.join(root,d.tools.syft.file),args:["oci-dir:"+path.join(root,"product-oci"),"-o","spdx-json="+path.join(root,"sbom.json")],env});
  const commands=await adapter("commands");for(const name of ["trivy","grype"]){requireInput(Array.isArray(commands[name])&&commands[name][0]===path.join(root,d.tools[name as "trivy"|"grype"].file),"PRODUCT_SCANNER_COMMAND_INVALID");await scan({stage:name,tool:commands[name][0],args:commands[name].slice(1),env});}
  const metadata=Object.fromEntries((["trivy","grype"] as const).map(name=>[name,{version:d.databases[name].version,databaseUpdatedAt:d.databases[name].updatedAt,databaseSha256:d.databases[name].sha256,ignoreUnfixed:false,severityThreshold:"HIGH",exitCode:scans[name].exit}]));
  write(path.join(root,"scanner-metadata.json"),JSON.stringify(metadata));
  reportCapture=await adapter("capture",output.configDigest);requireInput(!reportCapture.failure,"PRODUCT_REPORT_CAPTURE_FAILED");
  const reports:EvidenceFiles={};for(const name of ["trivy.json","grype.json","sbom.json","scanner-metadata.json"]){reports[name]=privateFile(path.join(root,name),64*1024*1024);requireInput(hashBytes(reports[name])===reportCapture.reportHashes[name]&&(name==="scanner-metadata.json"||hashBytes(reports[name])===initialReportHashes[name]),"PRODUCT_REPORT_SUBSTITUTED");boundedJson(reports[name]);}
  stage="report-policy";verifyImageSecurityReports(reports,output.configDigest,Date.now(),d.tools.trivy.version);requireInput(!boundedJson(reports["grype.json"]).ignoredMatches?.length,"PRODUCT_SUPPRESSED_FINDINGS");requireInput(Object.values(scans).every(okay),"PRODUCT_SCANNER_PROCESS_FAILED");
  await recheckOutput();guard();states.push("BUILD_SCAN_ONLY_NOT_ADMITTED");
 }catch(error){failures.push(code(error));}
 finally{
  if(owned){
   if(unsettled.size===0)for(const name of ["product.oci.tar","build-metadata.json"]){try{if(existsSync(path.join(root,name))){const raw=privateFile(path.join(root,name));partialOutput[name]={sha256:hashBytes(raw),bytes:raw.length};}}catch{cleanupFailures.push("PRODUCT_PARTIAL_OUTPUT_CAPTURE_UNAVAILABLE");}}
   // Capture partial independent reports even when an earlier phase interrupted.
   if(!reportCapture&&unsettled.size===0){try{if(output)reportCapture=await adapter("capture",output.configDigest);}catch{cleanupFailures.push("PRODUCT_PARTIAL_CAPTURE_UNAVAILABLE");}}
   if(unsettled.size)cleanupFailures.push("PRODUCT_UNSETTLED_CHILD_ROOT_RETAINED");
   else if(cleanupFailures.length)cleanupFailures.push("PRODUCT_UNCAPTURED_DIAGNOSTICS_ROOT_RETAINED");
   else try{requireInput(hashBytes(privateFile(path.join(root,"owner.json"),4096))===ownerHash,"PRODUCT_OWNER_SUBSTITUTED");validateProducerRoot(workspace,identity,"work","production");if(rootless)await cleanupRootlessBuild(workspace,identity,rootless);requireInput(unsettled.size===0,"PRODUCT_UNSETTLED_CHILD_ROOT_RETAINED");cleanupProducerRoot(workspace,identity,"work","production");}catch(error){cleanupFailures.push(code(error));}
  }else if(existsSync(root))cleanupFailures.push("PRODUCT_UNOWNED_RESIDUE_PRESERVED");
 }
 return {contract:"NALANDA_PRODUCT_BUILD_SCAN_RESULT_V1",classification:harness?"HARNESS_ONLY":"BUILD_SCAN_ONLY_NOT_ADMITTED",source:d.source,tree:d.tree,architecture:d.architecture,runId:d.runId,attempt:d.attempt,job:d.job,inputManifestSha256:input.manifestSha256,inputDecision:states.includes("INPUTS_VERIFIED_FOR_BUILD")?"INPUTS_VERIFIED_FOR_BUILD":"REFUSED",productDecision:states.includes("BUILD_SCAN_ONLY_NOT_ADMITTED")&&failures.length===0?"BUILD_SCAN_ONLY_NOT_ADMITTED":"FAILED",runtimeAdmission:"EXTERNAL_RUNTIME_BLOCKED",admitted:false,releaseCleared:false,stage,states,failures:[...new Set(failures)],cleanupFailures,cleanupComplete:owned&&!existsSync(root)&&cleanupFailures.length===0,complete:states.includes("BUILD_SCAN_ONLY_NOT_ADMITTED")&&!failures.length&&!cleanupFailures.length,output:output?{archiveSha256:output.archiveSha256,indexSha256:output.indexSha256,manifestDigest:output.manifestDigest,configDigest:output.configDigest}:null,reports:reportCapture?.reports??{},reportHashes:reportCapture?.reportHashes??{},processes,partialOutput,rawRetention:"UNTIL_OWNED_CLEANUP"};
}

export async function productionMain(){
 // This resolver throws before file acquisition, downloads or any child. There
 // is no operational enable flag. Future registration must supply expected
 // identity and subject independently of the private evidence directory.
 const controller=new AbortController(),abort=()=>controller.abort();process.once("SIGINT",abort);process.once("SIGTERM",abort);
 let result:any;
 try{const policy=productionInputPolicy();
 const root=path.resolve("private-prebuild-evidence"),reader=evidenceReader(path.join(root,"blobs"));
 const input=verifyInputs(privateFile(path.join(root,"envelope.json"),12*1024*1024),reader,policy);
 result=await runProductBuildScan(process.cwd(),input,reader,undefined,controller.signal);
 }catch(error){result={contract:"NALANDA_PRODUCT_BUILD_SCAN_RESULT_V1",classification:"BUILD_SCAN_ONLY_NOT_ADMITTED",complete:false,inputDecision:"REFUSED",product:"NOT_BUILT",runtimeAdmission:"EXTERNAL_RUNTIME_BLOCKED",admitted:false,releaseCleared:false,failure:code(error),processes:[]};}
 finally{process.removeListener("SIGINT",abort);process.removeListener("SIGTERM",abort);}
 write(path.resolve("backend-build-scan-result.json"),JSON.stringify(result));
 write(path.resolve("backend-build-scan-public-manifest.json"),JSON.stringify({classification:"BUILD_SCAN_ONLY_NOT_ADMITTED",files:[{name:"backend-build-scan-result.json",sha256:hashBytes(readFileSync("backend-build-scan-result.json")),bytes:readFileSync("backend-build-scan-result.json").length}]}));
 return result.complete?0:1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)void productionMain().then(code=>{process.exitCode=code;}).catch(()=>{console.error("BUILD_SCAN_ONLY_NOT_ADMITTED_PUBLICATION_REFUSED");process.exitCode=1;});
