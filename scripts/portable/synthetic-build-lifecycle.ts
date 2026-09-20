import { generateKeyPairSync, randomBytes, createPrivateKey, createPublicKey } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { hashBytes } from "./artifact-handoff";
import type { SyntheticBuildTrust } from "../../lib/portable-runtime/synthetic-capability";

export type ProducerIdentity = {source:string;runId:string;attempt:string;architecture:"amd64"|"arm64"};
export function producerIdentity(env:NodeJS.ProcessEnv=process.env):ProducerIdentity {
 const {EXPECTED_SHA:source,GITHUB_RUN_ID:runId,GITHUB_RUN_ATTEMPT:attempt,TARGET_ARCHITECTURE:architecture}=env;
 if(!/^[a-f0-9]{40}$/.test(source??"")||!/^\d+$/.test(runId??"")||!/^\d+$/.test(attempt??"")||!['amd64','arm64'].includes(architecture??""))throw Error("QA_PRODUCER_IDENTITY_INVALID");
 return {source:source!,runId:runId!,attempt:attempt!,architecture:architecture as ProducerIdentity['architecture']};
}
export function producerPaths(workspace=process.cwd(),identity=producerIdentity()) {
 const parent=path.resolve(workspace,"tmp/portable-staging"),prefix=`nalanda-ci-${identity.runId}-${identity.attempt}`;
 return {parent,signing:path.join(parent,`${prefix}-capability`),work:path.join(parent,`${prefix}-qa-producer`),project:`${prefix}-qaon`};
}
export const syntheticEvidenceRoot=()=>path.join(producerPaths().work,"evidence");
function safe(file:string, directory:boolean, checkPermissions=true) {
 const s=lstatSync(file);
 if(s.isSymbolicLink()||realpathSync(file)!==file||(directory?!s.isDirectory():!s.isFile()||s.nlink!==1))throw Error("QA_PRODUCER_PATH_UNSAFE");
 if(checkPermissions&&process.platform!=="win32"&&(s.mode&0o022))throw Error("QA_PRODUCER_PERMISSIONS_UNSAFE");
 return s;
}
function present(file:string){try{lstatSync(file);return true;}catch(error){if((error as NodeJS.ErrnoException).code==="ENOENT")return false;throw error;}}
function safeAncestors(file:string) {
 let current=path.resolve(file);
 while(true){if(present(current))safe(current,true,false);const parent=path.dirname(current);if(parent===current)break;current=parent;}
}
function owner(workspace:string,identity:ProducerIdentity,kind:"signing"|"work",nonce:string) {
 return {contract:"NALANDA_QA_PRODUCER_ROOT_V1",workspaceSha256:hashBytes(path.resolve(workspace)),...identity,phase:"synthetic-ON",project:producerPaths(process.cwd(),identity).project,target:"synthetic-qa",kind,nonce};
}
export function createProducerRoot(workspace:string,identity:ProducerIdentity,kind:"signing"|"work") {
 const paths=producerPaths(workspace,identity),root=paths[kind];safeAncestors(paths.parent);
 mkdirSync(paths.parent,{recursive:true,mode:0o700});safe(paths.parent,true);
 // Never adopt, overwrite or clean an existing root, including same-run residue.
 mkdirSync(root,{mode:0o700});
 const manifest=owner(workspace,identity,kind,randomBytes(32).toString("hex"));
 try{writeFileSync(path.join(root,"owner.json"),JSON.stringify(manifest),{flag:"wx",mode:0o600});}
 catch{throw Error("QA_PRODUCER_OWNER_WRITE_FAILED_RECONCILIATION_REQUIRED");}
 return root;
}
export function validateProducerRoot(workspace:string,identity:ProducerIdentity,kind:"signing"|"work") {
 const root=producerPaths(workspace,identity)[kind];safeAncestors(root);safe(root,true);
 const file=path.join(root,"owner.json");if(safe(file,false).size>4096)throw Error("QA_PRODUCER_OWNER_INVALID");
 const actual=JSON.parse(readFileSync(file,"utf8"));
 if(!/^[a-f0-9]{64}$/.test(actual.nonce??"")||JSON.stringify(actual)!==JSON.stringify(owner(workspace,identity,kind,actual.nonce)))throw Error("QA_PRODUCER_OWNER_MISMATCH");
 return root;
}
export function prepareSigningRoot(workspace:string,identity:ProducerIdentity) {
 const root=validateProducerRoot(workspace,identity,"signing"),pair=generateKeyPairSync("ed25519");
 const trust:SyntheticBuildTrust={contract:"NALANDA_SYNTHETIC_BUILD_V1",buildId:randomBytes(32).toString("hex"),source:identity.source,runId:identity.runId,attempt:identity.attempt,publicKey:pair.publicKey.export({format:"pem",type:"spki"}).toString()};
 writeFileSync(path.join(root,"private-key.pem"),pair.privateKey.export({format:"pem",type:"pkcs8"}),{flag:"wx",mode:0o600});
 writeFileSync(path.join(root,"trust.json"),JSON.stringify(trust),{flag:"wx",mode:0o400});
 return readSigningRoot(workspace,identity).trust;
}
export function readSigningRoot(workspace:string,identity:ProducerIdentity) {
 const root=validateProducerRoot(workspace,identity,"signing");
 for(const name of ["trust.json","private-key.pem"]){const stat=safe(path.join(root,name),false);if(stat.size>8192||(process.platform!=="win32"&&(stat.mode&0o077)))throw Error("QA_SIGNING_FILE_UNSAFE");}
 const bytes=readFileSync(path.join(root,"trust.json")),trust=JSON.parse(bytes.toString()) as SyntheticBuildTrust;
 const key=createPrivateKey(readFileSync(path.join(root,"private-key.pem")));
 if(key.asymmetricKeyType!=="ed25519"||Object.keys(trust).sort().join()!=="attempt,buildId,contract,publicKey,runId,source"||trust.contract!=="NALANDA_SYNTHETIC_BUILD_V1"||trust.source!==identity.source||trust.runId!==identity.runId||trust.attempt!==identity.attempt||!/^[a-f0-9]{64}$/.test(trust.buildId)||createPublicKey(key).export({format:"pem",type:"spki"}).toString()!==trust.publicKey)throw Error("QA_SIGNING_TRUST_MISMATCH");
 return {trust,bytes,sha256:hashBytes(bytes)};
}
export function cleanupProducerRoot(workspace:string,identity:ProducerIdentity,kind:"signing"|"work") {
 const root=producerPaths(workspace,identity)[kind];
 if(!present(root)){safeAncestors(path.dirname(root));return "ABSENT" as const;}
 validateProducerRoot(workspace,identity,kind);
 const visit=(dir:string)=>{safe(dir,true);for(const name of readdirSync(dir)){const file=path.join(dir,name),s=lstatSync(file);if(s.isSymbolicLink())throw Error("QA_CLEANUP_SYMLINK_REFUSED");if(s.isDirectory())visit(file);else safe(file,false);}};
 visit(root);
 if(kind==="signing"&&readdirSync(root).some(n=>!["owner.json","trust.json","private-key.pem"].includes(n)))throw Error("QA_CLEANUP_FOREIGN_FILE_REFUSED");
 // Resolved exact task root checked above, with no symlink or hardlink descendants.
 rmSync(root,{recursive:true});if(existsSync(root))throw Error("QA_CLEANUP_RESIDUE");return "REMOVED" as const;
}
