import {createPublicKey,verify} from "node:crypto";
import {execFileSync} from "node:child_process";
import {existsSync,readFileSync,lstatSync,realpathSync,openSync,writeSync,fsyncSync,closeSync} from "node:fs";
import path from "node:path";
import {boundedJson,requireInput,TOOL_NAMES,type InputPolicy,type InputDocument,type InputIdentity} from "./product-input-contract";
import {nativeObject} from "./native-artifact";
import {hashBytes} from "./artifact-handoff";

const HEX=/^[a-f0-9]{64}$/;
const REPOSITORY="vsairohith67/nalanda-school-erp";
const WORKFLOW=".github/workflows/portable-staging-foundation.yml";
type Key={id:string;algorithm:"Ed25519";publicKey:string;notBefore:number;notAfter:number;revoked:boolean};
export type TrustRegistration={contract:"NALANDA_BUILD_AUTHORITY_V1";namespace:"PRODUCTION";generation:number;validUntil:number;ownerApproval:string;authority:Key;attestors:Key[];custodyDirectory:string;custodyApproval:string;debianKeyringSha256:string;debianSigners:string[];bootstrap:{nodeSha256:string;bundleSha256:string;manifestSha256:string}};
export type ObservedSubject={identity:InputIdentity;workflowRef:string;workflowSha:string;recipeSha256:string;lockSha256:string};
export type ResolvedInputPolicy=InputPolicy & {authorizationSha256:string;materialsSha256:string;expiresAt:number;debianKeyringSha256:string;debianSigners:string[];checkDocument:(d:InputDocument)=>void};

function key(value:Key,now:number){
 nativeObject(value,["id","algorithm","publicKey","notBefore","notAfter","revoked"]);
 requireInput(value.algorithm==="Ed25519"&&typeof value.publicKey==="string"&&value.publicKey.length<=256&&HEX.test(value.id)&&typeof value.revoked==="boolean","PRODUCTION_KEY_INVALID");
 const parsed=createPublicKey(value.publicKey);
 requireInput(parsed.asymmetricKeyType==="ed25519"&&hashBytes(parsed.export({format:"der",type:"spki"}))===value.id,"PRODUCTION_KEY_ID_MISMATCH");
 requireInput(Number.isSafeInteger(value.notBefore)&&Number.isSafeInteger(value.notAfter)&&value.notBefore<=now&&now<value.notAfter&&!value.revoked,"PRODUCTION_KEY_INACTIVE");
 return parsed;
}

/** Pure cryptographic resolver. Tests use isolated generated keys, never the
 * production entrypoint or registration. No key is selected by evidence bytes. */
export function resolveInputPolicy(registration:unknown,authorization:Buffer,observed:ObservedSubject,now:number,operation:"BUILD_SCAN_ONLY_NOT_ADMITTED"|"ACQUIRE_DEPENDENCIES_ONLY"="BUILD_SCAN_ONLY_NOT_ADMITTED"):ResolvedInputPolicy {
 requireInput(registration!==null,"PRODUCTION_INPUT_TRUST_UNREGISTERED");
 const r=registration as TrustRegistration;
 nativeObject(r,["contract","namespace","generation","validUntil","ownerApproval","authority","attestors","custodyDirectory","custodyApproval","debianKeyringSha256","debianSigners","bootstrap"]);
 requireInput(r.contract==="NALANDA_BUILD_AUTHORITY_V1"&&r.namespace==="PRODUCTION"&&Number.isSafeInteger(now)&&Number.isSafeInteger(r.generation)&&r.generation>0&&Number.isSafeInteger(r.validUntil)&&now<r.validUntil,"PRODUCTION_REGISTRATION_INVALID");
 for(const approval of [r.ownerApproval,r.custodyApproval])requireInput(typeof approval==="string"&&/^https:\/\/[^\s]{1,500}$/.test(approval),"PRODUCTION_APPROVAL_REFERENCE_REQUIRED");
 requireInput(typeof r.custodyDirectory==="string"&&path.isAbsolute(r.custodyDirectory)&&path.normalize(r.custodyDirectory)===r.custodyDirectory,"PRODUCTION_CUSTODY_INVALID");
 nativeObject(r.bootstrap,["nodeSha256","bundleSha256","manifestSha256"]);requireInput(HEX.test(r.bootstrap.nodeSha256)&&HEX.test(r.bootstrap.bundleSha256)&&HEX.test(r.bootstrap.manifestSha256),"PRODUCTION_BOOTSTRAP_INVALID");
 requireInput(HEX.test(r.debianKeyringSha256)&&Array.isArray(r.debianSigners)&&r.debianSigners.length>0&&r.debianSigners.length<=10&&r.debianSigners.every(s=>/^[A-F0-9]{40,64}$/.test(s)),"PRODUCTION_DEBIAN_TRUST_REQUIRED");
 const authority=key(r.authority,now);
 requireInput(Array.isArray(r.attestors)&&r.attestors.length>0&&r.attestors.length<=8,"PRODUCTION_ATTESTORS_INVALID");
 const ids=new Set([r.authority.id]);
 for(const k of r.attestors){requireInput(!ids.has(k.id),"PRODUCTION_KEY_ROLE_COLLISION");ids.add(k.id);}
 const signed=boundedJson(authorization,65536);nativeObject(signed,["payload","signature"]);
 requireInput(typeof signed.payload==="string"&&/^[A-Za-z0-9_-]+$/.test(signed.payload)&&typeof signed.signature==="string"&&/^[A-Za-z0-9_-]{86}$/.test(signed.signature),"PRODUCTION_AUTHORIZATION_INVALID");
 const payload=Buffer.from(signed.payload,"base64url");requireInput(payload.toString("base64url")===signed.payload&&verify(null,payload,authority,Buffer.from(signed.signature,"base64url")),"PRODUCTION_AUTHORIZATION_SIGNATURE");
 const a=boundedJson(payload,49152);
 nativeObject(a,["contract","namespace","generation","authorityId","attestorId","operation","issuedAt","expiresAt","identity","workflowRef","workflowSha","subjectSha256","recipeSha256","lockSha256","materialsSha256","toolPins","imagesSha256","databasesSha256"]);
 requireInput(a.contract==="NALANDA_BUILD_AUTHORIZATION_V1"&&a.namespace==="PRODUCTION"&&a.generation===r.generation&&a.authorityId===r.authority.id&&a.operation===operation,"PRODUCTION_AUTHORIZATION_SCOPE");
 requireInput(Number.isSafeInteger(a.issuedAt)&&Number.isSafeInteger(a.expiresAt)&&a.issuedAt>=r.authority.notBefore&&a.issuedAt<=now&&now<a.expiresAt&&a.expiresAt-a.issuedAt<=6*3600000&&a.expiresAt<=r.validUntil&&a.expiresAt<=r.authority.notAfter,"PRODUCTION_AUTHORIZATION_STALE");
 nativeObject(a.identity,["source","tree","architecture","repository","workflow","runId","attempt","job"]);
 for(const [name,value] of Object.entries(observed.identity))requireInput(a.identity[name]===value,"PRODUCTION_AUTHORIZATION_SUBJECT");
 requireInput(a.identity.repository===REPOSITORY&&a.identity.workflow===WORKFLOW&&a.identity.job==="backend-build-scan"&&/^[a-f0-9]{40}$/.test(a.identity.source)&&/^[a-f0-9]{40}$/.test(a.identity.tree)&&["amd64","arm64"].includes(a.identity.architecture)&&/^[1-9][0-9]{0,19}$/.test(a.identity.runId)&&/^[1-9][0-9]{0,5}$/.test(a.identity.attempt),"PRODUCTION_AUTHORIZATION_IDENTITY");
 requireInput(a.workflowRef===observed.workflowRef&&a.workflowRef.startsWith(REPOSITORY+"/"+WORKFLOW+"@refs/")&&a.workflowSha===observed.workflowSha&&/^[a-f0-9]{40}$/.test(a.workflowSha),"PRODUCTION_WORKFLOW_MISMATCH");
 for(const name of ["subjectSha256","recipeSha256","lockSha256","materialsSha256","imagesSha256","databasesSha256"])requireInput(HEX.test(a[name]),"PRODUCTION_AUTHORIZATION_HASH");
 requireInput(a.recipeSha256===observed.recipeSha256&&a.lockSha256===observed.lockSha256,"PRODUCTION_RECIPE_OR_LOCK_MISMATCH");
 nativeObject(a.toolPins,[...TOOL_NAMES]);for(const pin of Object.values(a.toolPins) as any[]){nativeObject(pin,["sha256","archiveSha256","version"]);requireInput(HEX.test(pin.sha256)&&HEX.test(pin.archiveSha256)&&typeof pin.version==="string"&&pin.version.length>0&&pin.version.length<=120,"PRODUCTION_TOOL_PIN_INVALID");}
 const attestor=r.attestors.find(k=>k.id===a.attestorId);requireInput(attestor,"PRODUCTION_ATTESTOR_NOT_REGISTERED");key(attestor,now);
 requireInput(a.issuedAt>=attestor.notBefore&&a.expiresAt<=attestor.notAfter,"PRODUCTION_ATTESTOR_VALIDITY");
 const policy:ResolvedInputPolicy={classification:"HOSTED_PREBUILD_INPUTS",publicKey:attestor.publicKey,identity:{...a.identity} as InputIdentity,subjectSha256:a.subjectSha256,toolPins:a.toolPins,now,authorizationSha256:hashBytes(authorization),materialsSha256:a.materialsSha256,expiresAt:a.expiresAt,debianKeyringSha256:r.debianKeyringSha256,debianSigners:[...r.debianSigners],checkDocument:d=>{
  requireInput(Date.now()<a.expiresAt&&d.issuedAt>=a.issuedAt&&d.expiresAt<=a.expiresAt,"PRODUCTION_AUTHORIZATION_STALE");
  requireInput(operation==="ACQUIRE_DEPENDENCIES_ONLY"?d.materials===undefined&&!d.images.dependencies:d.materials===a.materialsSha256&&!!d.images.dependencies,"PRODUCTION_MATERIAL_MANIFEST_REQUIRED");
  requireInput(d.recipe.sha256===a.recipeSha256&&d.files.find(f=>f.path==="pnpm-lock.yaml")?.sha256===a.lockSha256&&hashBytes(JSON.stringify(d.images))===a.imagesSha256&&hashBytes(JSON.stringify(d.databases))===a.databasesSha256,"PRODUCTION_AUTHORIZED_MATERIAL_MISMATCH");
 }};
 return Object.freeze(policy);
}

function privatePath(file:string,directory=false){
 const s=lstatSync(file);requireInput(realpathSync.native(file)===file&&!s.isSymbolicLink()&&(directory?s.isDirectory():s.isFile()&&s.nlink===1)&&s.uid===process.getuid?.()&&(s.mode&0o077)===0,"PRODUCTION_CUSTODY_PATH_UNSAFE");return s;
}
function privateBytes(file:string,max:number){const s=privatePath(file);requireInput(s.size<=max,"PRODUCTION_CUSTODY_BOUND");const b=readFileSync(file),after=lstatSync(file);requireInput(s.ino===after.ino&&s.mtimeMs===after.mtimeMs&&s.ctimeMs===after.ctimeMs&&b.length===s.size,"PRODUCTION_CUSTODY_CHANGED");return b;}

/** Runtime loader has fixed checked-in trust and custody paths. Environment
 * claims are observations cross-checked against the signed authorization. */
export function loadProductionInputPolicy(workspace=process.cwd(),operation:"BUILD_SCAN_ONLY_NOT_ADMITTED"|"ACQUIRE_DEPENDENCIES_ONLY"="BUILD_SCAN_ONLY_NOT_ADMITTED"){
 const registrationFile=path.join(workspace,"scripts/portable/product-trust-registration.json");
 requireInput(existsSync(registrationFile),"PRODUCTION_INPUT_TRUST_UNREGISTERED");
 const registrationBytes=readFileSync(registrationFile);requireInput(registrationBytes.length<=16384,"PRODUCTION_REGISTRATION_BOUND");
 const registration=boundedJson(registrationBytes,16384) as TrustRegistration|null;
 requireInput(registration!==null,"PRODUCTION_INPUT_TRUST_UNREGISTERED");
 requireInput(process.platform==="linux"&&process.getuid?.()!==0,"PRODUCTION_RESOLVER_HOST");
 const git=(args:string[])=>execFileSync("git",args,{cwd:workspace,encoding:"utf8",timeout:10000,maxBuffer:1024*1024,env:{NODE_ENV:"production",PATH:"/usr/bin:/bin",LANG:"C",HOME:"/nonexistent",GIT_CONFIG_NOSYSTEM:"1",GIT_CONFIG_GLOBAL:"/dev/null"}}).trim();
 const source=git(["rev-parse","HEAD"]),tree=git(["show","-s","--format=%T","HEAD"]);
 requireInput(git(["status","--porcelain","--untracked-files=no"])===""&&source===process.env.EXPECTED_SHA,"PRODUCTION_SOURCE_CHANGED");
 requireInput(git(["show",`${source}:scripts/portable/product-trust-registration.json`])===registrationBytes.toString().trim(),"PRODUCTION_REGISTRATION_CHANGED");
 privatePath(registration.custodyDirectory,true);
 const authorizationFile=path.join(registration.custodyDirectory,"authorization.json");
 const authorization=privateBytes(authorizationFile,65536);
 const identity:InputIdentity={source,tree,architecture:process.arch==="arm64"?"arm64":"amd64",repository:process.env.GITHUB_REPOSITORY??"",workflow:WORKFLOW,runId:process.env.GITHUB_RUN_ID??"",attempt:process.env.GITHUB_RUN_ATTEMPT??"",job:process.env.GITHUB_JOB??""};
 requireInput(["x64","arm64"].includes(process.arch)&&process.env.TARGET_ARCHITECTURE===identity.architecture,"PRODUCTION_ARCHITECTURE_MISMATCH");
 const observed={identity,workflowRef:process.env.GITHUB_WORKFLOW_REF??"",workflowSha:process.env.GITHUB_WORKFLOW_SHA??"",recipeSha256:hashBytes(readFileSync(path.join(workspace,"Dockerfile"))),lockSha256:hashBytes(readFileSync(path.join(workspace,"pnpm-lock.yaml")))};
 const policy=resolveInputPolicy(registration,authorization,observed,Date.now(),operation);
 const guard=()=>{requireInput(hashBytes(privateBytes(authorizationFile,65536))===policy.authorizationSha256&&hashBytes(readFileSync(registrationFile))===hashBytes(registrationBytes),"PRODUCTION_AUTHORITY_CHANGED");resolveInputPolicy(registration,authorization,observed,Date.now(),operation);};
 const claim=()=>{
  guard();privatePath(registration.custodyDirectory,true);
  // Approved custody must persist this receipt across restarts. A failed build
  // burns its authorization; a later attempt needs a newly signed grant.
  const file=path.join(registration.custodyDirectory,`consumed-${operation}-${identity.runId}-${identity.attempt}-${identity.architecture}.json`);
  let fd:number;try{fd=openSync(file,"wx",0o600);}catch{throw Error("PRODUCTION_AUTHORIZATION_REPLAY_OR_CUSTODY_FAILURE");}
  try{writeSync(fd,JSON.stringify({authorizationSha256:policy.authorizationSha256,identity,consumedAt:Date.now()}));fsyncSync(fd);}finally{closeSync(fd);}
  const dir=openSync(registration.custodyDirectory,"r");try{fsyncSync(dir);}finally{closeSync(dir);}
 };
 return {policy,guard,claim,custodyDirectory:registration.custodyDirectory};
}
