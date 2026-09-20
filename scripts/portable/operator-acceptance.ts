import {execFileSync} from "node:child_process";
import {mkdirSync,readFileSync,writeFileSync,existsSync,readdirSync,rmSync,lstatSync,realpathSync} from "node:fs";
import {randomBytes} from "node:crypto";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {admitArtifact} from "./admit-artifact";
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
export function operatorAcceptance(){
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
 try{
  for(const scenario of OPERATOR_SCENARIOS){
   const manifest={...base,operationId:randomBytes(8).toString("hex")},file=path.join(root,scenario.id+".json");writeFileSync(file,JSON.stringify(manifest),{flag:"wx",mode:0o600});
   const beforeVolumes=volumes(),existed=existsSync(target);
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
   }
   records.push({scenario:scenario.id,state:"PASSED",classification:"PUBLIC_CLI_DEPLOYED_ACCEPTANCE",repeat:scenario.apply?"PASSED":"NOT_APPLICABLE"});
  }
 }finally{
  // Intentionally separate from data-preserving uninstall. Never tear down an unowned target.
  if(existsSync(path.join(target,"owner.json"))){
   const owner=JSON.parse(readFileSync(path.join(target,"owner.json"),"utf8"));if(owner.project!==project||owner.classification!=="INTEGRATION_TEST_ENVIRONMENT"||lstatSync(target).isSymbolicLink()||realpathSync(target)!==target)throw Error("OPERATOR_TEARDOWN_OWNERSHIP_MISMATCH");
   const config=path.join(target,"compose.json");if(!existsSync(config)||lstatSync(config).isSymbolicLink())throw Error("OPERATOR_TEARDOWN_CONFIG_MISSING");
   docker(["compose","--project-name",project,"-f",config,"down","--volumes","--remove-orphans"]);
   for(const kind of ["container","network","volume"]){if(docker([kind,"ls",...(kind==="container"?["--all"]:[]),"-q","--filter",`label=com.docker.compose.project=${project}`]).trim())throw Error("OPERATOR_TEARDOWN_RESIDUE");}
   if(!target.startsWith(path.resolve("tmp/portable-operator")+path.sep))throw Error("OPERATOR_TEARDOWN_PATH");rmSync(target,{recursive:true});if(existsSync(target))throw Error("OPERATOR_TEARDOWN_FILES_REMAIN");cleanup="VERIFIED";
  }else if(existsSync(target))throw Error("OPERATOR_TEARDOWN_UNOWNED_RESIDUE");else cleanup="NO_TARGET_CREATED";
  writeFileSync(path.join(root,"result.json"),JSON.stringify({source:artifact.source,records,cleanup,pending:["distinct-qualified-historical-upgrade-and-rollback","independent-object-namespace-restore","deployed-interruption-resume","initialise-separate-fresh-target"]},null,2),{flag:"wx"});
 }
 // Partial scenario coverage cannot accidentally satisfy the canonical operator gate.
 throw Error("OPERATOR_ACCEPTANCE_SCENARIOS_PENDING");
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){if(process.argv[2]==="--discover")console.log(JSON.stringify(OPERATOR_SCENARIOS));else operatorAcceptance();}
