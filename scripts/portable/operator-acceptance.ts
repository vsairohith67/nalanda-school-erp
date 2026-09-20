import {execFileSync} from "node:child_process";
import {mkdirSync,readFileSync,writeFileSync,existsSync,readdirSync,rmSync,lstatSync,realpathSync,copyFileSync,chmodSync} from "node:fs";
import {randomBytes} from "node:crypto";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {admitArtifact} from "./admit-artifact";
import {admitHistoricalArtifact} from "./admit-artifact";
import {interruptPublicInitialise} from "./operator-interruption";
import {hashBytes,assertRunningImage} from "./artifact-handoff";
import {operatorPlan,type OperatorCommand,type OperatorManifest} from "../../lib/portable-runtime/operator";

export const OPERATOR_SCENARIOS=Object.freeze([
 {id:"preflight",command:"preflight",apply:false},
 {id:"install-dry-run",command:"install",apply:false},
 {id:"install",command:"install",apply:true},
 {id:"doctor",command:"doctor",apply:false},
 {id:"migrate",command:"migrate",apply:true},
 {id:"backup",command:"backup",apply:true},
 {id:"uninstall-preserves-resources",command:"uninstall",apply:true},
] as const);
/** Real subprocess entrypoint. No process adapter or qualification override is exposed. */
export function invokePublicOperator(command:OperatorCommand,manifestPath:string,target:string,apply:boolean,resume=false){
 const args=["--import","tsx",path.resolve("scripts/portable/operator.ts"),command,"--manifest",manifestPath,"--target",target,...(apply?["--apply"]:[]),...(resume?["--resume"]:[])];
 const output=execFileSync(process.execPath,args,{encoding:"utf8",timeout:18*60_000,maxBuffer:1024*1024,windowsHide:true,stdio:["ignore","pipe","pipe"]});
 return JSON.parse(output.trim().split(/\r?\n/).at(-1)!);
}
export async function operatorAcceptance(){
 const artifact=admitArtifact(path.resolve("artifact-evidence")); // before filesystem/deployment mutations
 process.env.PORTABLE_IMAGE_ID=artifact.imageConfigDigest;
 const project=`nalanda-ci-${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}-operator`;
 const target=path.resolve("tmp/portable-operator",project),root=path.resolve("tmp/recovery-1c-operator",project);
 if(existsSync(target)||existsSync(root))throw Error("OPERATOR_ACCEPTANCE_TARGET_NOT_FRESH");
 mkdirSync(root,{recursive:true,mode:0o700});
 const base:OperatorManifest={schemaVersion:1,classification:"INTEGRATION_TEST_ENVIRONMENT",profile:"local-single-node",project,target,image:artifact.imageConfigDigest,releaseCommit:artifact.source,composeSha256:hashBytes(readFileSync("deploy/portable/compose.yml")),architecture:artifact.architecture,operationId:randomBytes(8).toString("hex"),postgresMajor:17,backupVersion:48,migration:readdirSync("prisma/postgresql/migrations").filter(x=>/^\d{14}_/.test(x)).sort().at(-1)!};
 const records:unknown[]=[];let cleanup="NOT_STARTED";
 const docker=(args:string[])=>execFileSync("docker",["--context","default",...args],{encoding:"utf8",timeout:120_000,maxBuffer:2*1024*1024});
 const volumes=()=>docker(["volume","ls","-q","--filter",`label=com.docker.compose.project=${project}`]).trim().split(/\s+/).filter(Boolean).sort();
 const privateRoot=path.resolve("tmp/portable-staging",project);
 const projects:{project:string;target:string;privateRoot:string}[]=[];
 const activate=(entry:{project:string;privateRoot:string})=>{process.env.PORTABLE_CI_ROOT=entry.privateRoot;process.env.PORTABLE_SOURCE_SHA=artifact.source;};
 const bootstrap=(name:string)=>{
  const entry={project:name,target:path.resolve("tmp/portable-operator",name),privateRoot:path.resolve("tmp/portable-staging",name)};
  if(existsSync(entry.privateRoot)||existsSync(entry.target))throw Error("PROJECT_NOT_FRESH");
  for(const kind of ["container","network","volume"])if(docker([kind,"ls",...(kind==="container"?["--all"]:[]),"-q","--filter",`label=com.docker.compose.project=${name}`]).trim())throw Error("PROJECT_RESOURCES_EXIST");
  mkdirSync(entry.privateRoot,{recursive:true,mode:0o700});if(realpathSync(entry.privateRoot)!==entry.privateRoot)throw Error("PROJECT_ROOT_UNSAFE");
  writeFileSync(path.join(entry.privateRoot,"owner.json"),JSON.stringify({project:name,source:artifact.source,runId:process.env.GITHUB_RUN_ID,attempt:process.env.GITHUB_RUN_ATTEMPT}),{flag:"wx",mode:0o600});projects.push(entry);activate(entry);
  execFileSync(process.execPath,["scripts/portable/generate-synthetic-secrets.mjs"],{env:{...process.env,NALANDA_SYNTHETIC_STAGING:"true",PORTABLE_SYNTHETIC_SECRET_ROOT:path.join(entry.privateRoot,"secrets")},stdio:"pipe",timeout:30_000});return entry;
 };
 const compose=(entry:typeof projects[number],args:string[])=>{activate(entry);return docker(["compose","--project-name",entry.project,"-f",path.join(entry.target,"compose.json"),...args]);};
 const keyIdentity=(entry:typeof projects[number])=>hashBytes(readFileSync(path.join(entry.privateRoot,"secrets","backup_encryption_key")));
 let backupManifest:any,backupResult:any,backupOperation:string|undefined;
 const inspect=(entry:typeof projects[number])=>JSON.parse(compose(entry,["run","--pull","never","--rm","--no-deps","-e","PORTABLE_OPERATOR_CI=true","backup-qa","dist/portable/operator-recovery.mjs","inspect",randomBytes(8).toString("hex"),Buffer.from(JSON.stringify(backupManifest)).toString("base64url")]).trim().split(/\r?\n/).at(-1)!);
 try{
  const source=bootstrap(project);
  for(const scenario of OPERATOR_SCENARIOS){
   const manifest={...base,operationId:randomBytes(8).toString("hex")},file=path.join(root,scenario.id+".json");writeFileSync(file,JSON.stringify(manifest),{flag:"wx",mode:0o600});
   const beforeVolumes=volumes(),existed=existsSync(target);
   const beforePreserved=scenario.command==="uninstall"?{database:inspect(source),key:keyIdentity(source)}:null;
   const result=invokePublicOperator(scenario.command,file,target,scenario.apply);
   if(result.state!==(scenario.apply?"COMPLETE":"DRY_RUN"))throw Error("OPERATOR_RESULT_STATE");
   if(!scenario.apply){if(existsSync(target)!==existed||JSON.stringify(volumes())!==JSON.stringify(beforeVolumes))throw Error("DRY_RUN_MUTATED_RESOURCES");}
   else{
    const receiptFile=path.join(target,`${manifest.operationId}.${scenario.command}.receipt.json`),receipt=JSON.parse(readFileSync(receiptFile,"utf8"));
    if(receipt.state!=="COMPLETE"||receipt.planHash!==operatorPlan(scenario.command,manifest).planHash)throw Error("OPERATOR_DURABLE_RECEIPT_MISMATCH");
    const before=hashBytes(readFileSync(receiptFile));invokePublicOperator(scenario.command,file,target,true,true);if(hashBytes(readFileSync(receiptFile))!==before)throw Error("OPERATOR_REPEAT_CHANGED_RECEIPT");
    if(scenario.command==="install"||scenario.command==="migrate"){
     const ids=docker(["ps","-q","--filter",`label=com.docker.compose.project=${project}`,"--filter","label=com.docker.compose.service=web-1"]).trim().split(/\s+/).filter(Boolean);if(ids.length!==1)throw Error("OPERATOR_WEB_IDENTITY_MISSING");assertRunningImage(artifact,JSON.parse(docker(["inspect",ids[0]]))[0]);
    }
    if(scenario.command==="uninstall"&&(JSON.stringify(volumes())!==JSON.stringify(beforeVolumes)||!existsSync(path.join(target,"owner.json"))))throw Error("UNINSTALL_REMOVED_PRESERVED_RESOURCES");
    if(scenario.command==="install"){
     // Supported explicit seed path establishes the actor, private backup
     // profile and synthetic records before migrate's mandatory backup.
     docker(["compose","--project-name",project,"-f",path.resolve("deploy/portable/compose.yml"),"run","--pull","never","--rm","--no-deps","seed"]);
    }
    if(scenario.command==="backup"){
     backupOperation=manifest.operationId;backupResult=JSON.parse(readFileSync(path.join(target,`${backupOperation}.backup.result.json`),"utf8"));
     backupManifest=JSON.parse(readFileSync(path.join(privateRoot,`backup-${backupOperation}`,"manifest.json"),"utf8"));
    }
    if(beforePreserved&&JSON.stringify(beforePreserved)!==JSON.stringify({database:inspect(source),key:keyIdentity(source)}))throw Error("UNINSTALL_CHANGED_DATA_BACKUP_OR_KEY");
   }
   records.push({scenario:scenario.id,state:"PASSED",classification:"PUBLIC_CLI_DEPLOYED_ACCEPTANCE",repeat:scenario.apply?"PASSED":"NOT_APPLICABLE"});
  }
  if(!backupOperation)throw Error("SOURCE_BACKUP_REQUIRED");
  const sourceSnapshot=inspect(source),destination=bootstrap(`${project}-destination`),destinationKey=keyIdentity(destination);
  if(destinationKey===keyIdentity(source))throw Error("RECOVERY_PROJECT_KEYS_NOT_DISTINCT");
  const fresh={...base,project:destination.project,target:destination.target,operationId:randomBytes(8).toString("hex")};
  const freshFile=path.join(root,"destination-initialise.json");writeFileSync(freshFile,JSON.stringify(fresh),{flag:"wx",mode:0o600});
  invokePublicOperator("initialise",freshFile,destination.target,true);invokePublicOperator("initialise",freshFile,destination.target,true,true);
  compose(destination,["stop","web-1","web-2","reverse-proxy","backup-worker"]);
  mkdirSync(path.join(destination.privateRoot,"handoff"),{mode:0o700});mkdirSync(path.join(destination.privateRoot,"recovery-key"),{mode:0o700});
  for(const name of ["backup.npsbackup","manifest.json"]){const output=path.join(destination.privateRoot,"handoff",name);copyFileSync(path.join(source.privateRoot,`backup-${backupOperation}`,name),output);chmodSync(output,0o444);}
  const recoveryKey=path.join(destination.privateRoot,"recovery-key","recovery-key");copyFileSync(path.join(source.privateRoot,"secrets","backup_encryption_key"),recoveryKey);chmodSync(recoveryKey,0o444);
  const restore={...fresh,operationId:randomBytes(8).toString("hex"),restoreArtifact:{id:backupResult.id,ciphertextSha256:backupResult.ciphertextSha256},recoveryTransfer:{sourceProject:project,destinationProject:destination.project,sourceCommit:artifact.source,runId:process.env.GITHUB_RUN_ID,attempt:process.env.GITHUB_RUN_ATTEMPT,artifactId:backupResult.id,objectSha256:backupResult.objectSha256,manifestSha256:backupResult.manifestSha256}};
  const restoreFile=path.join(root,"independent-restore.json");writeFileSync(restoreFile,JSON.stringify(restore),{flag:"wx",mode:0o600});activate(destination);
  invokePublicOperator("restore",restoreFile,destination.target,true);invokePublicOperator("restore",restoreFile,destination.target,true,true);
  if(keyIdentity(destination)!==destinationKey||JSON.stringify(inspect(source))!==JSON.stringify(sourceSnapshot))throw Error("INDEPENDENT_RESTORE_MUTATED_SOURCE_OR_KEY");
  const sourceVolumes=docker(["volume","ls","-q","--filter",`label=com.docker.compose.project=${project}`]).trim().split(/\s+/),destVolumes=docker(["volume","ls","-q","--filter",`label=com.docker.compose.project=${destination.project}`]).trim().split(/\s+/);
  if(!sourceVolumes.length||!destVolumes.length||sourceVolumes.some(v=>destVolumes.includes(v)))throw Error("RECOVERY_VOLUMES_NOT_INDEPENDENT");
  records.push({scenario:"initialise-independent-project-encrypted-restore",state:"PASSED",classification:"PUBLIC_CLI_DEPLOYED_ACCEPTANCE",sourcePreserved:true,destinationOwnKeyPreserved:true});
  // Each refusal owns a separate disposable destination. A failed durable
  // operation is never erased or retried under a different identity.
  for(const fault of ["wrong-key","corrupted-object","missing-object","mismatched-manifest"]){
   const broken=bootstrap(`${project}-${fault}`),m={...base,project:broken.project,target:broken.target,operationId:randomBytes(8).toString("hex")};
   const initFile=path.join(root,`${fault}-initialise.json`);writeFileSync(initFile,JSON.stringify(m),{flag:"wx",mode:0o600});invokePublicOperator("initialise",initFile,broken.target,true);compose(broken,["stop","web-1","web-2","reverse-proxy","backup-worker"]);
   mkdirSync(path.join(broken.privateRoot,"handoff"),{mode:0o700});mkdirSync(path.join(broken.privateRoot,"recovery-key"),{mode:0o700});
   for(const name of ["backup.npsbackup","manifest.json"]){if(fault==="missing-object"&&name==="backup.npsbackup")continue;const bytes=readFileSync(path.join(source.privateRoot,`backup-${backupOperation}`,name));
    if(fault==="corrupted-object"&&name==="backup.npsbackup")bytes[bytes.length-1]^=1;
    if(fault==="mismatched-manifest"&&name==="manifest.json"){const value=JSON.parse(bytes.toString());value.sourceProject=broken.project;writeFileSync(path.join(broken.privateRoot,"handoff",name),JSON.stringify(value),{flag:"wx",mode:0o444});}
    else writeFileSync(path.join(broken.privateRoot,"handoff",name),bytes,{flag:"wx",mode:0o444});
   }
   writeFileSync(path.join(broken.privateRoot,"recovery-key","recovery-key"),fault==="wrong-key"?randomBytes(32).toString("base64"):readFileSync(path.join(source.privateRoot,"secrets","backup_encryption_key")),{flag:"wx",mode:0o444});
   const brokenRestore={...restore,project:broken.project,target:broken.target,operationId:randomBytes(8).toString("hex"),recoveryTransfer:{...restore.recoveryTransfer,destinationProject:broken.project}};
   const file=path.join(root,`${fault}-restore.json`);writeFileSync(file,JSON.stringify(brokenRestore),{flag:"wx",mode:0o600});activate(broken);
   let refused=false;try{invokePublicOperator("restore",file,broken.target,true);}catch{refused=true;}if(!refused)throw Error("INVALID_RECOVERY_WAS_ACCEPTED");
   const resultFile=path.join(broken.target,`${brokenRestore.operationId}.restore.result.json`);if(existsSync(resultFile))throw Error("FAILED_RESTORE_APPEARED_COMPLETE");
   const empty=JSON.parse(compose(broken,["run","--pull","never","--rm","--no-deps","-e","PORTABLE_OPERATOR_CI=true","backup-qa","dist/portable/operator-recovery.mjs","empty",randomBytes(8).toString("hex"),Buffer.from(JSON.stringify(backupManifest)).toString("base64url")]).trim().split(/\r?\n/).at(-1)!);
   if(empty.state!=="EMPTY_DATABASE_AND_OBJECT_ABSENT"||JSON.stringify(inspect(source))!==JSON.stringify(sourceSnapshot))throw Error("REJECTED_RESTORE_MUTATED_DATA");
   records.push({scenario:fault,state:"PASSED",classification:"PUBLIC_CLI_DEPLOYED_NEGATIVE_ACCEPTANCE",businessWrites:0});
  }
  const destinationBefore={database:inspect(destination),key:keyIdentity(destination)};
  const uninstall={...fresh,operationId:randomBytes(8).toString("hex")},uninstallFile=path.join(root,"destination-uninstall.json");writeFileSync(uninstallFile,JSON.stringify(uninstall),{flag:"wx",mode:0o600});activate(destination);
  invokePublicOperator("uninstall",uninstallFile,destination.target,true);
  if(JSON.stringify(destinationBefore)!==JSON.stringify({database:inspect(destination),key:keyIdentity(destination)}))throw Error("RESTORED_UNINSTALL_CHANGED_DATA");
  const interrupted=bootstrap(`${project}-interrupted`),interruptedManifest={...base,project:interrupted.project,target:interrupted.target,operationId:randomBytes(8).toString("hex")},interruptedFile=path.join(root,"interrupted.json");
  writeFileSync(interruptedFile,JSON.stringify(interruptedManifest),{flag:"wx",mode:0o600});await interruptPublicInitialise(interruptedManifest,interruptedFile);
  invokePublicOperator("initialise",interruptedFile,interrupted.target,true,true);invokePublicOperator("initialise",interruptedFile,interrupted.target,true,true);
  const stale=readdirSync(path.dirname(interrupted.target)).filter(n=>n.startsWith(interrupted.project+".lock.")&&n.endsWith(".stale"));
  if(stale.length!==1)throw Error("STALE_LOCK_RECONCILIATION_MISSING");
  const lock=JSON.parse(readFileSync(path.join(path.dirname(interrupted.target),stale[0]),"utf8"));if(lock.project!==interrupted.project||lock.operationId!==interruptedManifest.operationId)throw Error("STALE_LOCK_IDENTITY_MISMATCH");
  compose(interrupted,["stop","web-1","web-2","reverse-proxy","backup-worker"]);
  records.push({scenario:"deployed-interruption-durable-resume-stale-lock",state:"PASSED",classification:"PUBLIC_CLI_DEPLOYED_ACCEPTANCE"});
  // The historical pair has independent raw scans and source-bound inputs.
  // Missing artifacts are explicit execution prerequisites, never tag aliases.
  const historicalRoot=path.resolve("artifact-evidence-history"),historicalSource=JSON.parse(readFileSync(path.join(historicalRoot,"provenance.json"),"utf8")).source;
  const historical=admitHistoricalArtifact(historicalRoot,historicalSource);
  if(historical.imageConfigDigest===artifact.imageConfigDigest)throw Error("DISTINCT_HISTORICAL_TARGET_REQUIRED");
  const history=bootstrap(`${project}-history`),old={...base,image:historical.imageConfigDigest,releaseCommit:historical.source,project:history.project,target:history.target,operationId:randomBytes(8).toString("hex")};
  const oldFile=path.join(root,"historical-install.json");writeFileSync(oldFile,JSON.stringify(old),{flag:"wx",mode:0o600});invokePublicOperator("install",oldFile,history.target,true);
  process.env.PORTABLE_IMAGE_ID=historical.imageConfigDigest;
  docker(["compose","--project-name",history.project,"-f",path.resolve("deploy/portable/compose.yml"),"run","--pull","never","--rm","--no-deps","seed"]);
  const upgrade={...old,image:artifact.imageConfigDigest,releaseCommit:artifact.source,operationId:randomBytes(8).toString("hex"),previous:{image:historical.imageConfigDigest,releaseCommit:historical.source,migration:base.migration,backupVersion:48 as const}};
  const upgradeFile=path.join(root,"historical-upgrade.json");writeFileSync(upgradeFile,JSON.stringify(upgrade),{flag:"wx",mode:0o600});invokePublicOperator("upgrade",upgradeFile,history.target,true);invokePublicOperator("upgrade",upgradeFile,history.target,true,true);
  const rollback={...upgrade,operationId:randomBytes(8).toString("hex")},rollbackFile=path.join(root,"historical-rollback.json");writeFileSync(rollbackFile,JSON.stringify(rollback),{flag:"wx",mode:0o600});invokePublicOperator("rollback",rollbackFile,history.target,true);invokePublicOperator("rollback",rollbackFile,history.target,true,true);
  records.push({scenario:"distinct-qualified-historical-upgrade-compatible-rollback",state:"PASSED",classification:"PUBLIC_CLI_DEPLOYED_ACCEPTANCE",historicalSource:historical.source,historicalImage:historical.imageConfigDigest});
 }finally{
  const cleanupFailures:string[]=[];
  for(const owned of [...projects].reverse()){
  const {project,target,privateRoot}=owned;activate(owned);
  try{
  // Intentionally separate from data-preserving uninstall. Never tear down an unowned target.
  if(existsSync(path.join(target,"owner.json"))){
   const owner=JSON.parse(readFileSync(path.join(target,"owner.json"),"utf8"));if(owner.project!==project||owner.classification!=="INTEGRATION_TEST_ENVIRONMENT"||lstatSync(target).isSymbolicLink()||realpathSync(target)!==target)throw Error("OPERATOR_TEARDOWN_OWNERSHIP_MISMATCH");
   const config=path.join(target,"compose.json");
   if(existsSync(config)){if(lstatSync(config).isSymbolicLink()||realpathSync(config)!==config)throw Error("OPERATOR_TEARDOWN_CONFIG_UNSAFE");docker(["compose","--project-name",project,"-f",config,"down","--volumes","--remove-orphans"]);}
   for(const kind of ["container","network","volume"]){if(docker([kind,"ls",...(kind==="container"?["--all"]:[]),"-q","--filter",`label=com.docker.compose.project=${project}`]).trim())throw Error("OPERATOR_TEARDOWN_RESIDUE");}
   for(const name of readdirSync(path.dirname(target)).filter(n=>n.startsWith(project+".lock.")&&n.endsWith(".stale"))){
    const file=path.join(path.dirname(target),name),info=lstatSync(file);if(!info.isFile()||info.isSymbolicLink()||info.size>1024||realpathSync(file)!==file)throw Error("STALE_LOCK_CLEANUP_UNSAFE");
    const lock=JSON.parse(readFileSync(file,"utf8"));if(lock.project!==project||lock.operationId!==owner.operationId||!Number.isSafeInteger(lock.pid)||lock.pid<1)throw Error("STALE_LOCK_CLEANUP_OWNERSHIP");
    try{process.kill(lock.pid,0);throw Error("STALE_LOCK_PID_ACTIVE");}catch(error){if((error as NodeJS.ErrnoException).code!=="ESRCH")throw error;}
    rmSync(file);if(existsSync(file))throw Error("STALE_LOCK_CLEANUP_RESIDUE");
   }
   if(!target.startsWith(path.resolve("tmp/portable-operator")+path.sep))throw Error("OPERATOR_TEARDOWN_PATH");rmSync(target,{recursive:true});if(existsSync(target))throw Error("OPERATOR_TEARDOWN_FILES_REMAIN");cleanup="VERIFIED";
  }else if(existsSync(target))throw Error("OPERATOR_TEARDOWN_UNOWNED_RESIDUE");else cleanup="NO_TARGET_CREATED";
  const owner=JSON.parse(readFileSync(path.join(privateRoot,"owner.json"),"utf8"));
  if(owner.project!==project||owner.source!==artifact.source||owner.runId!==process.env.GITHUB_RUN_ID||owner.attempt!==process.env.GITHUB_RUN_ATTEMPT||lstatSync(privateRoot).isSymbolicLink()||realpathSync(privateRoot)!==privateRoot||!privateRoot.startsWith(path.resolve("tmp/portable-staging")+path.sep))throw Error("SECRET_CLEANUP_OWNERSHIP_MISMATCH");
  rmSync(privateRoot,{recursive:true});if(existsSync(privateRoot))throw Error("SECRET_CLEANUP_RESIDUE");
  }catch{cleanupFailures.push(project);}
  }
  writeFileSync(path.join(root,"result.json"),JSON.stringify({source:artifact.source,records,cleanup:cleanupFailures.length?"FAILED":cleanup,cleanupFailures,pending:["certificate-concession-nonempty-operator-fixture","historical-business-readback-and-incompatible-rollback-subprocess"]},null,2),{flag:"wx"});
  if(cleanupFailures.length)throw Error("OPERATOR_TEARDOWN_INCOMPLETE");
 }
 // Partial scenario coverage cannot accidentally satisfy the canonical operator gate.
 throw Error("OPERATOR_ACCEPTANCE_SCENARIOS_PENDING");
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){if(process.argv[2]==="--discover")console.log(JSON.stringify(OPERATOR_SCENARIOS));else void operatorAcceptance().catch(()=>{console.error("OPERATOR_ACCEPTANCE_FAILED");process.exitCode=1;});}
