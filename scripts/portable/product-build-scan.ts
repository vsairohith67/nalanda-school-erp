import {packageMaterials} from "./material-package";
import {downloadPreparation,verifyPreparation} from "./material-source";
import {acquisitionPreparation,verifyAcquisitionPlan,assertAcquisition,stageAcquisition,type VerifiedAcquisition} from "./material-acquisition";
import {retainProductEvidence} from "./product-custody";
import {loadProductionInputPolicy} from "./product-trust-policy";
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

export type ProductHarness={classification:"HARNESS_ONLY";command:(command:ProducerCommand,root:string)=>ProducerCommand;signal?:AbortSignal;debianTrust?:{debianKeyringSha256:string;debianSigners:string[]}};
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
export async function runProductBuildScan(workspace:string,input:VerifiedInputs,blobs:BlobReader,harness?:ProductHarness,productionSignal?:AbortSignal,custody?:{directory:string;guard:()=>void;debianKeyringSha256:string;debianSigners:string[]},acquisition?:VerifiedAcquisition){
 assertVerifiedInputs(input);if(acquisition){assertAcquisition(acquisition);}const d=input.document,identity:ProducerIdentity={source:d.source,runId:d.runId,attempt:d.attempt,architecture:d.architecture};
 requireInput((input.classification==="HARNESS_ONLY")===!!harness&&(!harness||harness.classification==="HARNESS_ONLY"),"PRODUCT_HARNESS_BOUNDARY");if(!harness){assertProductionHost(identity);requireInput(custody,"PRODUCT_PRIVATE_CUSTODY_REQUIRED");custody.guard();}
 workspace=path.resolve(workspace);sourceBytes(workspace,d.files,d.tree);
 const root=producerPaths(workspace,identity,"production").work,unsettled=new Set<number>(),processes:ProductProcessReceipt[]=[],states:string[]=[],failures:string[]=[],cleanupFailures:string[]=[],initialReportHashes:Record<string,string>={},partialOutput:Record<string,{sha256:string;bytes:number}>={};
 const signal=harness?.signal??productionSignal,materialHashes=new Map<string,string>();
 let retained=false,materialQualification:any=null;
 let owned=false,ownerHash="",stage="inputs",sequence=0,output:any=null,reportCapture:any=null,rootless:RootlessOptions|undefined;
 const guard=()=>{if(acquisition)assertAcquisition(acquisition);custody?.guard();assertVerifiedInputs(input);if(signal?.aborted)throw Error("PRODUCT_INTERRUPTED");sourceBytes(workspace,d.files,d.tree);if(owned){requireInput(hashBytes(privateFile(path.join(root,"owner.json"),4096))===ownerHash,"PRODUCT_OWNER_SUBSTITUTED");validateProducerRoot(workspace,identity,"work","production");if(existsSync(path.join(root,"context")))contextGuard(path.join(root,"context"),d.files,d.tree);}};
 const tools=()=>{for(const [file,expected] of materialHashes)requireInput(hashBytes(privateFile(file))===expected,"PRODUCT_MATERIAL_SUBSTITUTED");for(const name of TOOL_NAMES){const t=d.tools[name];requireInput(hashBytes(privateFile(path.join(root,t.file)))===t.sha256,"PRODUCT_TOOL_SUBSTITUTED");}return {work:root,bin:path.join(root,"tools/buildkit/bin"),rootless:path.join(root,d.tools.rootlesskit.file)};};
 const processCommand=async(command:ProducerCommand,required=true)=>{stage=command.stage;requireInput(unsettled.size===0,"PRODUCT_PROCESS_UNSETTLED");guard();tools();for(const db of Object.values(d.databases))requireInput(hashBytes(privateFile(path.join(root,db.file)))===db.sha256,"PRODUCT_DATABASE_SUBSTITUTED");const actual=harness?harness.command(command,root):command;if(harness){guard();tools();}const r=await captureProductProcess(actual,root,++sequence,unsettled,signal);r.stage=command.stage;processes.push(r);if(!okay(r)){if(command.stage!=="rootless-ready"||!r.settled||r.interrupted)failures.push(`PRODUCT_${command.stage.toUpperCase().replace(/[^A-Z0-9]/g,"_")}_PROCESS_FAILED`);if(required)throw Error(failures.at(-1)??"PRODUCT_READINESS_PENDING");}states.push(command.stage);return {receipt:r,stdout:privateFile(path.join(root,`process-${sequence}.stdout`),64*1024*1024)};};
 const adapter=async(action:string,subject?:string)=>{const result=await processCommand({stage:action,tool:path.join(root,d.tools.python.file),args:["-B",path.join(root,"context/scripts/portable/product-scan-adapter.py"),action,root,d.architecture,d.source,...(subject?[subject]:[])]});return boundedJson(result.stdout);};
 const recheckOutput=async()=>{requireInput(hashBytes(privateFile(path.join(root,"product.oci.tar")))===output.archiveSha256,"PRODUCT_OUTPUT_SUBSTITUTED");const layout=path.join(root,"product-oci"),seen=new Set<string>();const walk=(dir:string)=>{for(const name of readdirSync(dir)){const file=path.join(dir,name),stat=lstatSync(file);requireInput(!stat.isSymbolicLink()&&realpathSync(file)===file,"PRODUCT_LAYOUT_SUBSTITUTED");if(stat.isDirectory())walk(file);else{const relative=path.relative(layout,file).split(path.sep).join("/");requireInput(output.files[relative]===hashBytes(privateFile(file)),"PRODUCT_LAYOUT_SUBSTITUTED");seen.add(relative);}}};walk(layout);requireInput(seen.size===Object.keys(output.files).length,"PRODUCT_LAYOUT_INCOMPLETE");};
 try{
  stage="create-root";guard();const space=statfsSync(workspace);requireInput(space.bavail*space.bsize>= (harness?8*1024*1024:6*1024**3),"PRODUCT_DISK_CAPACITY_MISSING");createProducerRoot(workspace,identity,"work","production");owned=true;ownerHash=hashBytes(privateFile(path.join(root,"owner.json"),4096));
  for(const dir of ["home","temp","cache"])mkdirSync(path.join(root,dir),{mode:0o700});
  stage="bind-context";sourceBytes(workspace,d.files,d.tree,path.join(root,"context"));
  let dockerfile=readFileSync(path.join(root,"context/Dockerfile"),"utf8");requireInput(dockerfile.includes("ARG NODE_IMAGE="+d.images.builder.reference)&&dockerfile.includes("ARG RUNTIME_IMAGE="+d.images.runtime.reference),"PRODUCT_RECIPE_BASE_MISMATCH");
  for(const name of TOOL_NAMES){const t=d.tools[name];requireInput(t.file.startsWith("tools/")&&!d.files.some(f=>f.path===t.file),"PRODUCT_TOOL_PATH_INVALID");write(path.join(root,t.file),blobs(t.sha256));chmodSync(path.join(root,t.file),0o500);}
  requireInput(d.tools.buildctl.file==="tools/buildkit/bin/buildctl"&&d.tools.buildkitd.file==="tools/buildkit/bin/buildkitd"&&d.tools.runc.file==="tools/buildkit/bin/buildkit-runc","PRODUCT_BUILDKIT_PATH_MISMATCH");
  for(const db of Object.values(d.databases))for(const f of db.files){const file=path.join(root,f.file);write(file,blobs(f.sha256));materialHashes.set(file,f.sha256);}
  const binsFile=path.join(root,"scanner-bins.json");write(binsFile,JSON.stringify({trivy:path.join(root,d.tools.trivy.file),grype:path.join(root,d.tools.grype.file)}));materialHashes.set(binsFile,hashBytes(privateFile(binsFile)));
  if(acquisition){for(const [file,hash] of stageAcquisition(acquisition,blobs,root))materialHashes.set(file,hash);const file=path.join(root,"offline-recipe/Dockerfile");write(file,acquisition.recipe);materialHashes.set(file,hashBytes(acquisition.recipe));dockerfile=acquisition.recipe.toString();}
  if(input.materials){
   const recipeFile=path.join(root,"offline-recipe/Dockerfile");write(recipeFile,input.materials.recipe);materialHashes.set(recipeFile,hashBytes(input.materials.recipe));dockerfile=input.materials.recipe.toString();
  }
  // No mutable acquisition is silently authorized by a recipe review. Current
  // retained apt/corepack/pnpm-install recipe fails this finite offline contract.
  requireInput(!!acquisition||!/\b(?:apt-get|apt|corepack|curl|wget)\b|\b(?:pnpm|npm|yarn)\s+(?:install|add|fetch)\b/i.test(dockerfile),"PRODUCT_OFFLINE_RECIPE_MATERIALS_UNQUALIFIED");
  const staged=(file:string,bytes:Buffer|string)=>{write(file,bytes);materialHashes.set(file,hashBytes(Buffer.from(bytes)));};
  const inspection:any={images:{},tools:[],...(acquisition?{pnpmMaterial:{archiveSha256:acquisition.plan.pnpmArchive,files:acquisition.plan.files.filter(f=>f.path.startsWith("pnpm/"))}}:{})};
  for(const [name,image] of Object.entries(d.images)){
   const layout=path.join(root,"inputs",name),manifest=boundedJson(blobs(image.manifest));
   staged(path.join(layout,"index.json"),blobs(image.index));staged(path.join(layout,"oci-layout"),JSON.stringify({imageLayoutVersion:"1.0.0"}));
   for(const id of new Set([image.index,image.manifest,image.config,...manifest.layers.map((l:any)=>l.digest.slice(7))] as string[]))staged(path.join(layout,"blobs/sha256",id),blobs(id));
   const node=image.node?boundedJson(blobs(image.node)):null;
   if(name==="runtime"||name==="builder")requireInput(node.path===(name==="runtime"?"nodejs/bin/node":"usr/local/bin/node"),"PRODUCT_NODE_PATH_MISMATCH");
   inspection.images[name]={manifest:image.manifest,nodePath:node?.path??null,nodeSha256:node?.binarySha256??null};
   if(name==="builder"&&acquisition?.preparation)inspection.images[name].materialFiles=[{path:"var/lib/dpkg/status",sha256:acquisition.preparation.baseInstalledStatus,native:false}];
   if(name==="builder"&&input.materials)inspection.images[name].materialFiles=[{path:"var/lib/dpkg/status",sha256:boundedJson(blobs(input.materials.manifest.acquisition.nativeInventory)).baseInstalledStatus,native:false}];
   if(name==="dependencies"&&input.materials){const n=boundedJson(blobs(input.materials.manifest.acquisition.nativeInventory));inspection.images[name].materialFiles=[...n.files.map((f:any)=>({path:f.path,sha256:f.sha256,native:true})),{path:"var/lib/dpkg/status",sha256:n.installedStatus,native:false}];}
  }
  for(const tool of Object.values(d.tools)){const origin=boundedJson(blobs(tool.archive));const file=path.join(root,"input-archives",origin.archiveSha256);if(!materialHashes.has(file))staged(file,blobs(origin.archiveSha256));inspection.tools.push(origin);}
  staged(path.join(root,"input-inspection.json"),JSON.stringify(inspection));
  staged(path.join(root,"source-policy.json"),JSON.stringify({rules:[{action:"DENY",selector:{identifier:"*"}},...["local://context","local://dockerfile",...(acquisition?["local://material-inputs"]:[]),"oci-layout://runtime@sha256:"+d.images.runtime.index,"oci-layout://builder@sha256:"+d.images.builder.index,"oci-layout://frontend@sha256:"+d.images.frontend.index,...(d.images.dependencies?["oci-layout://dependencies@sha256:"+d.images.dependencies.index]:[])].map(identifier=>({action:"ALLOW",selector:{identifier}}))]}));
  await adapter("inputs");
  const getMaterial:BlobReader=id=>{const f=path.join(root,"material-output/blobs",id);return existsSync(f)?privateFile(f):blobs(id);};
  const verifyDebian=async(inv:any,base:string,installed:string,phase:"archives"|"installed")=>{
   const debianTrust=custody??harness?.debianTrust;requireInput(debianTrust,"MATERIAL_DEBIAN_TRUST_REQUIRED");const aptRoot=path.join(root,"apt-proof-"+phase);
   staged(path.join(aptRoot,"installed-status"),getMaterial(installed));staged(path.join(aptRoot,"base-installed-status"),getMaterial(base));
   for(let i=0;i<inv.aptReleaseFiles.length;i++){const release=inv.aptReleaseFiles[i];requireInput(release.keyring===debianTrust.debianKeyringSha256,"MATERIAL_DEBIAN_KEYRING_NOT_REGISTERED");const dir=path.join(aptRoot,String(i));for(const [name,id] of [["InRelease",release.inRelease],["Packages.gz",release.packages],["keyring.gpg",release.keyring]])staged(path.join(dir,name),getMaterial(id));const r=await processCommand({stage:"material-gpgv-"+phase+"-"+i,tool:path.join(root,d.tools.gpgv.file),args:["--homedir",path.join(root,"home"),"--keyring",path.join(dir,"keyring.gpg"),"--status-fd","1","--output",path.join(dir,"Release"),path.join(dir,"InRelease")]});staged(path.join(dir,"gpgv-status"),r.stdout);materialHashes.set(path.join(dir,"Release"),hashBytes(privateFile(path.join(dir,"Release"))));}
   for(const p of inv.packages)if(!materialHashes.has(path.join(aptRoot,"debs",p.sha256)))staged(path.join(aptRoot,"debs",p.sha256),getMaterial(p.sha256));
   staged(path.join(aptRoot,"proof.json"),JSON.stringify({architecture:d.architecture,snapshot:inv.snapshot,phase,releases:inv.aptReleaseFiles,packages:inv.packages,signers:debianTrust.debianSigners}));
   await processCommand({stage:"material-debian-"+phase,tool:path.join(root,d.tools.python.file),args:["-B",path.join(root,"context/scripts/portable/material-provenance.py"),aptRoot]});
  };
  const originals=(prep:ReturnType<typeof verifyPreparation>)=>{for(const o of prep.origins){const file=path.join(root,"material-originals",o.archiveSha256);if(!materialHashes.has(file))staged(file,blobs(o.archiveSha256));}staged(path.join(root,"material-origin-check.json"),JSON.stringify({architecture:d.architecture,origins:prep.origins}));};
  const origins=async()=>processCommand({stage:"material-origins",tool:path.join(root,d.tools.python.file),args:["-B",path.join(root,"context/scripts/portable/material-collector.py"),"origins",root]});
  if(input.materials){const m=input.materials.manifest,n=boundedJson(blobs(m.acquisition.nativeInventory)),prep=verifyPreparation(blobs(m.acquisition.preparation),m.acquisition.preparation,d,blobs);originals(prep);await origins();await verifyDebian(boundedJson(blobs(m.acquisition.inventory)),n.baseInstalledStatus,n.installedStatus,"installed");staged(path.join(root,"material-collection.json"),JSON.stringify({architecture:d.architecture,origins:prep.origins,baseInstalledStatus:prep.baseInstalledStatus,manifest:m.image.manifest,nodeSha256:boundedJson(blobs(d.images.builder.node!)).binarySha256,replay:[...prep.tarballs,...prep.metadata]}));const c=await processCommand({stage:"material-consume",tool:path.join(root,d.tools.python.file),args:["-B",path.join(root,"context/scripts/portable/material-collector.py"),"consume",root]});requireInput(boundedJson(c.stdout).nativeInventory===m.acquisition.nativeInventory,"MATERIAL_COLLECTED_INVENTORY_MISMATCH");}
  if(acquisition?.preparation){const p=acquisition.preparation;originals(p);await origins();await verifyDebian(boundedJson(blobs(p.inventory)),p.baseInstalledStatus,p.baseInstalledStatus,"archives");}
  const trivyStatus=boundedJson((await processCommand({stage:"trivy-db-status",tool:path.join(root,d.tools.trivy.file),args:["--cache-dir",path.join(root,"trivy-db"),"--version","--format","json"]})).stdout);
  const grypeStatus=boundedJson((await processCommand({stage:"grype-db-status",tool:path.join(root,d.tools.grype.file),args:["db","status","-o","json"],env:{GRYPE_DB_CACHE_DIR:path.join(root,"grype-db"),GRYPE_DB_AUTO_UPDATE:"false",GRYPE_CHECK_FOR_APP_UPDATE:"false"}})).stdout);
  requireInput(trivyStatus.Version===d.tools.trivy.version&&trivyStatus.VulnerabilityDB?.Version===2&&Date.parse(trivyStatus.VulnerabilityDB.UpdatedAt)===Date.parse(d.databases.trivy.updatedAt),"PRODUCT_TRIVY_DATABASE_STATUS");
  requireInput(grypeStatus.valid===true&&grypeStatus.schemaVersion==="6.1.4"&&grypeStatus.path===path.join(root,d.databases.grype.file)&&Date.parse(grypeStatus.built)===Date.parse(d.databases.grype.updatedAt),"PRODUCT_GRYPE_DATABASE_STATUS");tools();
  states.push("INPUTS_VERIFIED_FOR_BUILD");
  let build=bindProductionSources(productionBuildCommand(root,identity,d.configuration.epoch,d.configuration.frontend),root,d.images);
  if(input.materials||acquisition)build={...build,args:build.args.map(a=>a===`dockerfile=${path.join(root,"context")}`?`dockerfile=${path.join(root,"offline-recipe")}`:a)};
  if(acquisition){build={...build,args:build.args.map(a=>a==="target=production-runtime"?"target=dependencies":a).concat(["--local",`material-inputs=${path.join(root,"material-inputs")}`,"--opt","context:material-inputs=local:material-inputs","--opt","add-hosts=registry.npmjs.org=127.0.0.1,cdn.sheetjs.com=127.0.0.1"])};}
  if(harness)await processCommand(build);
  else{rootless={profile:"production",tools,daemonSequence:++sequence,daemonOutcome:r=>{if(r){processes.push(r);if(!r.settled)unsettled.add(-1);if(!r.intentionalShutdown)failures.push("PRODUCT_DAEMON_PREMATURE_OR_FAILED");}else unsettled.add(-1);},environment:{...productEnvironment(root),PATH:path.join(root,"tools/buildkit/bin")+path.delimiter+productEnvironment(root).PATH},run:async command=>{const r=await processCommand(command);return r.stdout.toString();}};stage="rootless-build";await runRootlessBuild(build,workspace,identity,signal,rootless);}
  guard();output=await adapter(acquisition?"inspect-materials":"inspect");
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
  if(acquisition?.preparation){const p=acquisition.preparation;staged(path.join(root,"material-collection.json"),JSON.stringify({architecture:d.architecture,origins:p.origins,baseInstalledStatus:p.baseInstalledStatus,manifest:output.manifestDigest.slice(7),nodeSha256:boundedJson(blobs(d.images.builder.node!)).binarySha256,replay:[...p.tarballs,...p.metadata]}));
   const collection=boundedJson((await processCommand({stage:"material-collect",tool:path.join(root,d.tools.python.file),args:["-B",path.join(root,"context/scripts/portable/material-collector.py"),"collect",root]})).stdout);
   await verifyDebian(boundedJson(blobs(p.inventory)),p.baseInstalledStatus,collection.installedStatus,"installed");
   materialQualification=packageMaterials(root,d,acquisition,blobs,output,processes,collection);
  }
  await recheckOutput();guard();states.push(acquisition?"MATERIAL_BUILD_SCAN_ONLY_NOT_PRODUCT":"BUILD_SCAN_ONLY_NOT_ADMITTED");
 }catch(error){failures.push(code(error));}
 finally{
  if(owned){
   if(unsettled.size===0)for(const name of ["product.oci.tar","build-metadata.json"]){try{if(existsSync(path.join(root,name))){const raw=privateFile(path.join(root,name));partialOutput[name]={sha256:hashBytes(raw),bytes:raw.length};}}catch{cleanupFailures.push("PRODUCT_PARTIAL_OUTPUT_CAPTURE_UNAVAILABLE");}}
   // Capture partial independent reports even when an earlier phase interrupted.
   if(!reportCapture&&unsettled.size===0){try{if(output)reportCapture=await adapter("capture",output.configDigest);}catch{cleanupFailures.push("PRODUCT_PARTIAL_CAPTURE_UNAVAILABLE");}}
   if(unsettled.size)cleanupFailures.push("PRODUCT_UNSETTLED_CHILD_ROOT_RETAINED");
   else if(cleanupFailures.length)cleanupFailures.push("PRODUCT_UNCAPTURED_DIAGNOSTICS_ROOT_RETAINED");
   else try{requireInput(hashBytes(privateFile(path.join(root,"owner.json"),4096))===ownerHash,"PRODUCT_OWNER_SUBSTITUTED");validateProducerRoot(workspace,identity,"work","production");if(rootless)await cleanupRootlessBuild(workspace,identity,rootless);requireInput(unsettled.size===0,"PRODUCT_UNSETTLED_CHILD_ROOT_RETAINED");if(custody){custody.guard();retainProductEvidence(root,custody.directory,identity,acquisition?"materials":"product");retained=true;}
cleanupProducerRoot(workspace,identity,"work","production");}catch(error){cleanupFailures.push(code(error));}
  }else if(existsSync(root))cleanupFailures.push("PRODUCT_UNOWNED_RESIDUE_PRESERVED");
 }
 return {contract:"NALANDA_PRODUCT_BUILD_SCAN_RESULT_V1",classification:harness?"HARNESS_ONLY":acquisition?"MATERIAL_BUILD_SCAN_ONLY_NOT_PRODUCT":"BUILD_SCAN_ONLY_NOT_ADMITTED",product:acquisition?"NOT_BUILT":undefined,materialQualification:acquisition?(materialQualification??"INCOMPLETE_PROVENANCE_COLLECTION"):undefined,source:d.source,tree:d.tree,architecture:d.architecture,runId:d.runId,attempt:d.attempt,job:d.job,inputManifestSha256:input.manifestSha256,inputDecision:states.includes("INPUTS_VERIFIED_FOR_BUILD")?"INPUTS_VERIFIED_FOR_BUILD":"REFUSED",productDecision:acquisition?"NOT_BUILT":states.includes("BUILD_SCAN_ONLY_NOT_ADMITTED")&&failures.length===0?"BUILD_SCAN_ONLY_NOT_ADMITTED":"FAILED",materialDecision:acquisition?(states.includes("MATERIAL_BUILD_SCAN_ONLY_NOT_PRODUCT")&&failures.length===0?"MATERIAL_BUILD_SCAN_ONLY_NOT_PRODUCT":"FAILED"):undefined,runtimeAdmission:"EXTERNAL_RUNTIME_BLOCKED",admitted:false,releaseCleared:false,stage,states,failures:[...new Set(failures)],cleanupFailures,cleanupComplete:owned&&!existsSync(root)&&cleanupFailures.length===0,complete:states.includes(acquisition?"MATERIAL_BUILD_SCAN_ONLY_NOT_PRODUCT":"BUILD_SCAN_ONLY_NOT_ADMITTED")&&!failures.length&&!cleanupFailures.length,output:output?{archiveSha256:output.archiveSha256,indexSha256:output.indexSha256,manifestDigest:output.manifestDigest,configDigest:output.configDigest}:null,reports:reportCapture?.reports??{},reportHashes:reportCapture?.reportHashes??{},processes,partialOutput,rawRetention:retained?"OWNER_MANAGED_REGISTERED_CUSTODY":custody?"CUSTODY_NOT_COMPLETED_ROOT_RETAINED":"UNTIL_OWNED_CLEANUP"};
}

export async function productionMain(operation:"BUILD_SCAN_ONLY_NOT_ADMITTED"|"ACQUIRE_DEPENDENCIES_ONLY"="BUILD_SCAN_ONLY_NOT_ADMITTED"){
 // This resolver throws before file acquisition, downloads or any child. There
 // is no operational enable flag. Future registration must supply expected
 // identity and subject independently of the private evidence directory.
 const controller=new AbortController(),abort=()=>controller.abort();process.once("SIGINT",abort);process.once("SIGTERM",abort);
 let result:any;
 try{const authority=loadProductionInputPolicy(process.cwd(),operation),policy=authority.policy;
 const root=path.resolve("private-prebuild-evidence"),initialReader=evidenceReader(path.join(root,"blobs"));let reader=initialReader;
 const input=verifyInputs(privateFile(path.join(root,"envelope.json"),12*1024*1024),reader,policy);
 authority.policy.checkDocument(input.document);authority.guard();assertProductionHost(input.document);let preparation;
 if(operation==="ACQUIRE_DEPENDENCIES_ONLY")preparation=acquisitionPreparation(reader(policy.materialsSha256),policy.materialsSha256,input.document,reader);
 authority.claim();
 if(preparation){const acquired=path.join(authority.custodyDirectory,`acquired-${input.document.runId}-${input.document.attempt}-${input.document.architecture}`);await downloadPreparation(preparation,acquired,authority.guard);const downloaded=evidenceReader(path.join(acquired,"blobs"));reader=id=>existsSync(path.join(acquired,"blobs",id))?downloaded(id):initialReader(id);}
 const acquisition=operation==="ACQUIRE_DEPENDENCIES_ONLY"?verifyAcquisitionPlan(reader(policy.materialsSha256),policy.materialsSha256,input.document,reader):undefined;
 result=await runProductBuildScan(process.cwd(),input,reader,undefined,controller.signal,{directory:authority.custodyDirectory,guard:authority.guard,debianKeyringSha256:policy.debianKeyringSha256,debianSigners:policy.debianSigners},acquisition);
 }catch(error){result={contract:"NALANDA_PRODUCT_BUILD_SCAN_RESULT_V1",classification:"BUILD_SCAN_ONLY_NOT_ADMITTED",complete:false,inputDecision:"REFUSED",product:"NOT_BUILT",runtimeAdmission:"EXTERNAL_RUNTIME_BLOCKED",admitted:false,releaseCleared:false,failure:code(error),processes:[]};}
 finally{process.removeListener("SIGINT",abort);process.removeListener("SIGTERM",abort);}
 write(path.resolve("backend-build-scan-result.json"),JSON.stringify(result));
 write(path.resolve("backend-build-scan-public-manifest.json"),JSON.stringify({classification:"BUILD_SCAN_ONLY_NOT_ADMITTED",files:[{name:"backend-build-scan-result.json",sha256:hashBytes(readFileSync("backend-build-scan-result.json")),bytes:readFileSync("backend-build-scan-result.json").length}]}));
 return result.complete?0:1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)void (async()=>{requireInput(process.argv.length===2||(process.argv.length===3&&process.argv[2]==="--acquire-materials"),"PRODUCT_ARGUMENTS_INVALID");return productionMain(process.argv[2]==="--acquire-materials"?"ACQUIRE_DEPENDENCIES_ONLY":"BUILD_SCAN_ONLY_NOT_ADMITTED");})().then(code=>{process.exitCode=code;}).catch(()=>{console.error("BUILD_SCAN_ONLY_NOT_ADMITTED_PUBLICATION_REFUSED");process.exitCode=1;});
