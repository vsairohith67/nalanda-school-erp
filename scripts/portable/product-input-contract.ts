import {createHash, createPublicKey, verify} from "node:crypto";
import {hashBytes, verifyImageSecurityReports, type EvidenceFiles} from "./artifact-handoff";
import {nativeJson, nativeObject} from "./native-artifact";
import scannerPins from "../../config/backend-build-scan-tools.json";
import builderPins from "../../config/qa-build-tools.json";
import {loadProductionInputPolicy} from "./product-trust-policy";
import {verifyMaterialManifest,type MaterialManifest} from "./product-materials";

export const INPUT_CONTRACT = "NALANDA_PREBUILD_INPUTS_DRAFT_V1";
export const TOOL_NAMES = ["buildctl","buildkitd","runc","rootlesskit","syft","trivy","grype","python","node","git","gpgv"] as const;
export const IMAGE_NAMES = ["runtime","builder","frontend"] as const;
export type InputIdentity = {source:string;tree:string;architecture:"amd64"|"arm64";repository:string;workflow:string;runId:string;attempt:string;job:string};
export type InputPolicy = {classification:"HARNESS_ONLY"|"HOSTED_PREBUILD_INPUTS";publicKey:string;identity:InputIdentity;subjectSha256:string;now:number;toolPins:Record<typeof TOOL_NAMES[number],{sha256:string;archiveSha256:string;version:string}>};
export type BlobReader = (sha256:string)=>Buffer;
export type SourceFile = {path:string;sha256:string;gitBlob:string;mode:"100644"|"100755"};
type Security = {trivy:string;grype:string;sbom:string;metadata:string;processes:string};
type Component = {subject:string;security:Security;node:string|null};
export type ImageInput = Component & {reference:string;index:string;manifest:string;config:string};
export type ToolInput = Component & {sha256:string;version:string;file:string;archive:string};
export type InputDocument = InputIdentity & {
 contract:typeof INPUT_CONTRACT;classification:InputPolicy["classification"];issuedAt:number;expiresAt:number;
 commit:string;
 custody:{repository:string;workflow:string;source:string;runId:string;attempt:string;job:string;private:true};
 files:SourceFile[];recipe:{path:"Dockerfile";sha256:string;review:string};
 configuration:{target:"production-runtime";network:"none";syntheticTrust:null;epoch:string;frontend:string};
 materials?:string;images:Record<typeof IMAGE_NAMES[number],ImageInput> & {dependencies?:ImageInput};tools:Record<typeof TOOL_NAMES[number],ToolInput>;
 databases:Record<"trivy"|"grype",{sha256:string;file:string;updatedAt:string;version:string;files:{file:string;sha256:string;bytes:number}[]}>;
};
export function requireInput(value:unknown,code:string):asserts value {if(!value)throw Error(code);}
const sha=/^[a-f0-9]{64}$/, git=/^[a-f0-9]{40}$/;
const hash=(v:unknown)=>typeof v==="string"&&sha.test(v);
const digest=(v:unknown)=>typeof v==="string"&&/^sha256:[a-f0-9]{64}$/.test(v);
export function boundedJson(bytes:Buffer,max=8*1024*1024):any {
 requireInput(bytes.length>0&&bytes.length<=max,"INPUT_STRUCTURE_BOUND");
 const text=new TextDecoder("utf-8",{fatal:true}).decode(bytes);JSON.parse(text);
 // Scanner originals may be pretty-printed. Remove only framing whitespace;
 // canonical parser still rejects duplicate keys, invalid UTF-8 and numbers.
 let compact="",quoted=false,escaped=false,depth=0;
 for(const c of text){if(quoted){compact+=c;if(escaped)escaped=false;else if(c==="\\")escaped=true;else if(c==='"')quoted=false;}else{if(c==='"')quoted=true;if(c==='{'||c==='[')requireInput(++depth<=24,"INPUT_STRUCTURE_BOUND");if(c==='}'||c===']')depth--;if(!/[ \t\r\n]/.test(c))compact+=c;}}
 const value=nativeJson(Buffer.from(compact),max);
 let count=0;
 const visit=(v:unknown,depth:number)=>{requireInput(depth<=24&&++count<=200000,"INPUT_STRUCTURE_BOUND");if(v&&typeof v==="object")for(const [key,x] of Object.entries(v)){requireInput(!["__proto__","prototype","constructor"].includes(key),"INPUT_KEY_FORBIDDEN");visit(x,depth+1);}};
 visit(value,0);return value;
}
export function safeRelative(value:unknown):asserts value is string {
 requireInput(typeof value==="string"&&value.length<=240&&/^[A-Za-z0-9_.@+/-]+$/.test(value)&&!value.startsWith("/")&&value.split("/").every(p=>p!==""&&p!=="."&&p!=="..")&&!value.toLowerCase().split("/").some(p=>/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/.test(p)),"INPUT_PATH_INVALID");
}
function readBlob(reader:BlobReader,id:unknown,max=256*1024*1024) {
 requireInput(hash(id),"INPUT_HASH_INVALID");const bytes=reader(id as string);
 requireInput(Buffer.isBuffer(bytes)&&bytes.length>0&&bytes.length<=max&&hashBytes(bytes)===id,"INPUT_BYTES_SUBSTITUTED");return bytes;
}
function json(reader:BlobReader,id:unknown){return boundedJson(readBlob(reader,id));}
function identity(value:Record<string,any>,expected:InputIdentity){
 for(const key of ["source","tree","architecture","repository","workflow","runId","attempt","job"] as const)requireInput(value[key]===expected[key],"INPUT_IDENTITY_MISMATCH");
 requireInput(git.test(value.source)&&git.test(value.tree)&&["amd64","arm64"].includes(value.architecture)&&/^\d{1,20}$/.test(value.runId)&&/^\d{1,6}$/.test(value.attempt),"INPUT_IDENTITY_INVALID");
 requireInput(value.repository==="vsairohith67/nalanda-school-erp"&&/^\.github\/workflows\/[a-z0-9-]+\.yml$/.test(value.workflow)&&value.job==="backend-build-scan","INPUT_ORIGIN_INVALID");
}
function security(component:Component,reader:BlobReader,policy:InputPolicy,kind:"image"|"tool") {
 nativeObject(component.security,["trivy","grype","sbom","metadata","processes"]);
 const s=component.security, raw:EvidenceFiles={"trivy.json":readBlob(reader,s.trivy),"grype.json":readBlob(reader,s.grype),"sbom.json":readBlob(reader,s.sbom),"scanner-metadata.json":readBlob(reader,s.metadata)};
 const t=boundedJson(raw["trivy.json"]),g=boundedJson(raw["grype.json"]),m=boundedJson(raw["scanner-metadata.json"]),b=boundedJson(raw["sbom.json"]);
 const processes=json(reader,s.processes);nativeObject(processes,["identity","classification","subject","outcomes"]);
 nativeObject(processes.identity,["source","tree","architecture","repository","workflow","runId","attempt","job"]);identity(processes.identity,policy.identity);requireInput(processes.classification===policy.classification&&processes.subject===component.subject,"INPUT_PROCESS_SUBJECT");
 nativeObject(processes.outcomes,["trivy","grype","syft"]);
 for(const name of ["trivy","grype","syft"]){const p=processes.outcomes[name];nativeObject(p,["exit","signal","timedOut","durationMs","settled","reportSha256","toolSha256","stdoutSha256","stderrSha256"]);requireInput(p.exit===0&&p.signal===null&&p.timedOut===false&&p.settled===true&&Number.isSafeInteger(p.durationMs)&&p.durationMs>=0&&p.durationMs<=900000&&[p.toolSha256,p.stdoutSha256,p.stderrSha256].every(hash)&&p.reportSha256===s[name==="syft"?"sbom":name as "trivy"|"grype"],"INPUT_PROCESS_FAILED");for(const h of [p.stdoutSha256,p.stderrSha256]){const raw=reader(h);requireInput(Buffer.isBuffer(raw)&&raw.length<=64*1024*1024&&hashBytes(raw)===h,"INPUT_PROCESS_OUTPUT_SUBSTITUTED");}}
 requireInput(m.trivy?.version==="0.70.0"&&m.grype?.version==="0.110.0","INPUT_SCANNER_VERSION");
 if(kind==="image")verifyImageSecurityReports(raw,component.subject,policy.now,m.trivy.version);
 else {
  // File-scanner subject shapes differ from OCI reports. Validate them before
  // adapting only the subject/coverage shape into the unchanged policy evaluator.
  requireInput(t.ArtifactName===component.subject&&t.ArtifactType==="filesystem"&&g.source?.type==="file"&&g.source.target?.sha256===component.subject.slice(7),"INPUT_TOOL_REPORT_SUBJECT");
  requireInput(t.SchemaVersion===2&&Array.isArray(t.Results)&&t.Results.length>0&&b.spdxVersion?.startsWith("SPDX-")&&b.packages?.length>0,"INPUT_TOOL_REPORT_MISSING");
  const adapted={...raw,"trivy.json":Buffer.from(JSON.stringify({...t,Metadata:{ImageID:component.subject},Results:[...t.Results,{Target:"policy-shape",Class:"os-pkgs",Type:"binary"},{Target:"policy-shape",Class:"lang-pkgs",Type:"node-pkg"}]})),"grype.json":Buffer.from(JSON.stringify({...g,source:{target:{imageID:component.subject}}}))};
  verifyImageSecurityReports(adapted,component.subject,policy.now,m.trivy.version);
 }
 // No ignored/suppressed row, regardless of scanner exit or severity, is accepted.
 requireInput(!g.ignoredMatches?.length&&t.Results.every((r:any)=>!r.ModifiedFindings?.length),"INPUT_SUPPRESSED_FINDINGS");
 requireInput(component.node!==null||!b.packages.some((p:any)=>typeof p.name==="string"&&/^(node|nodejs|nodejs-bin)$/i.test(p.name)),"INPUT_NODE_EVIDENCE_MISSING");
 return processes;
}
function nodeEvidence(component:Component,reader:BlobReader,required:boolean,binary?:string) {
 if(component.node===null){requireInput(!required,"INPUT_NODE_EVIDENCE_MISSING");return;}
 const n=json(reader,component.node);nativeObject(n,["subject","path","binarySha256","sourceSha256","association","inventory","libraries"]);safeRelative(n.path);
 requireInput(n.subject===component.subject&&hash(n.binarySha256)&&hash(n.sourceSha256),"INPUT_NODE_ASSOCIATION");
 if(binary)requireInput(n.binarySha256===binary,"INPUT_NODE_EXECUTABLE_SUBSTITUTED");
 const association=json(reader,n.association);nativeObject(association,["binarySha256","sourceSha256","subject","buildProvenanceSha256"]);
 requireInput(association.binarySha256===n.binarySha256&&association.sourceSha256===n.sourceSha256&&association.subject===component.subject,"INPUT_NODE_ASSOCIATION");
 readBlob(reader,association.buildProvenanceSha256);readBlob(reader,n.sourceSha256);readBlob(reader,n.binarySha256);
 const inventory=json(reader,n.inventory);nativeObject(inventory,["binarySha256","libraries"]);
 requireInput(inventory.binarySha256===n.binarySha256&&Array.isArray(inventory.libraries)&&inventory.libraries.length>=2&&inventory.libraries.length<=40&&Array.isArray(n.libraries)&&n.libraries.length===inventory.libraries.length,"INPUT_NODE_COVERAGE");
 const names=n.libraries.map((l:any)=>l.name);requireInput(new Set(names).size===names.length&&names.includes("openssl")&&names.includes("zlib"),"INPUT_NODE_COVERAGE");
 requireInput(new Set(inventory.libraries.map((l:any)=>l.name)).size===names.length,"INPUT_NODE_COVERAGE");
 for(const l of inventory.libraries)nativeObject(l,["name","version"]);
 for(const l of n.libraries){nativeObject(l,["name","version","sourceSha256","advisories","evidence"]);requireInput(typeof l.name==="string"&&typeof l.version==="string"&&l.version.length>0&&inventory.libraries.some((x:any)=>x.name===l.name&&x.version===l.version)&&Array.isArray(l.advisories)&&l.advisories.length<=100,"INPUT_NODE_LIBRARY");readBlob(reader,l.sourceSha256);const e=json(reader,l.evidence);nativeObject(e,["binarySha256","library","version","sourceSha256","unresolved","advisories"]);requireInput(e.binarySha256===n.binarySha256&&e.library===l.name&&e.version===l.version&&e.sourceSha256===l.sourceSha256&&Array.isArray(e.unresolved)&&e.unresolved.length===0&&JSON.stringify(e.advisories)===JSON.stringify(l.advisories),"INPUT_NODE_UNRESOLVED");for(const a of l.advisories){nativeObject(a,["id","state","patchSha256"]);requireInput(/^CVE-\d{4}-\d{4,10}$/.test(a.id)&&a.state==="FIXED","INPUT_NODE_UNRESOLVED");readBlob(reader,a.patchSha256);}}
}
const verified=new WeakSet<object>();
export type VerifiedInputs={document:InputDocument;classification:InputPolicy["classification"];manifestSha256:string;materials?:{manifest:MaterialManifest;recipe:Buffer};guard:()=>void};
export function assertVerifiedInputs(input:VerifiedInputs){requireInput(verified.has(input),"INPUT_VERIFIER_RECEIPT_REQUIRED");input.guard();}

/** The caller supplies policy from trusted configuration, never from this envelope.
 * Reuses the native evidence canonical parser and standard Ed25519 primitive.
 * No key, expected workflow, subject or approver is selected by untrusted bytes. */
export function verifyInputs(envelopeBytes:Buffer,reader:BlobReader,policy:InputPolicy):VerifiedInputs {
 const originalReader=reader,seen=new Map<string,string>();reader=id=>{const bytes=originalReader(id);seen.set(id,hashBytes(bytes));return bytes;};
 const envelope=boundedJson(envelopeBytes,12*1024*1024);nativeObject(envelope,["payload","signature"]);
 requireInput(typeof envelope.payload==="string"&&/^[A-Za-z0-9_-]+$/.test(envelope.payload)&&typeof envelope.signature==="string"&&/^[A-Za-z0-9_-]{86}$/.test(envelope.signature),"INPUT_ENVELOPE_INVALID");
 const payload=Buffer.from(envelope.payload,"base64url"),key=createPublicKey(policy.publicKey);
 requireInput(key.asymmetricKeyType==="ed25519"&&verify(null,payload,key,Buffer.from(envelope.signature,"base64url")),"INPUT_SIGNATURE_REJECTED");
 requireInput(hash(policy.subjectSha256)&&hashBytes(payload)===policy.subjectSha256,"INPUT_EXPECTED_SUBJECT_MISMATCH");
 const d=boundedJson(payload) as InputDocument;
 nativeObject(d,["contract","classification","source","tree","architecture","repository","workflow","runId","attempt","job","issuedAt","expiresAt","custody","files","recipe","configuration","images","tools","databases","commit",...(d.materials!==undefined?["materials"]:[])]);
 requireInput(d.contract===INPUT_CONTRACT&&d.classification===policy.classification,"INPUT_SCHEMA_OR_CLASSIFICATION");identity(d,policy.identity);
 const commit=readBlob(reader,d.commit);requireInput(createHash("sha1").update(`commit ${commit.length}\0`).update(commit).digest("hex")===d.source&&commit.toString().startsWith(`tree ${d.tree}\n`),"INPUT_COMMIT_TREE_MISMATCH");
 requireInput(Number.isSafeInteger(d.issuedAt)&&Number.isSafeInteger(d.expiresAt)&&d.issuedAt<=policy.now&&d.expiresAt>policy.now&&d.expiresAt>d.issuedAt&&d.expiresAt-d.issuedAt<=6*3600000,"INPUT_EVIDENCE_STALE");
 nativeObject(d.custody,["repository","workflow","source","runId","attempt","job","private"]);for(const k of ["repository","workflow","source","runId","attempt","job"] as const)requireInput(d.custody[k]===d[k],"INPUT_CUSTODY_MISMATCH");requireInput(d.custody.private===true,"INPUT_PRIVATE_CUSTODY_REQUIRED");
 requireInput(Array.isArray(d.files)&&d.files.length>=7&&d.files.length<=30000,"INPUT_SOURCE_COVERAGE");
 const paths=new Set<string>();for(const f of d.files){nativeObject(f,["path","sha256","gitBlob","mode"]);safeRelative(f.path);requireInput(!paths.has(f.path.toLowerCase())&&hash(f.sha256)&&git.test(f.gitBlob)&&["100644","100755"].includes(f.mode),"INPUT_SOURCE_INVALID");paths.add(f.path.toLowerCase());}
 for(const name of ["Dockerfile",".dockerignore","pnpm-lock.yaml","package.json","pnpm-workspace.yaml","config/synthetic-build-trust.json","config/backend-build-scan-tools.json"])requireInput(d.files.some(f=>f.path===name),"INPUT_SOURCE_COVERAGE");
 nativeObject(d.recipe,["path","sha256","review"]);requireInput(d.recipe.path==="Dockerfile"&&d.recipe.sha256===d.files.find(f=>f.path==="Dockerfile")?.sha256,"INPUT_RECIPE_MISMATCH");
 const review=json(reader,d.recipe.review);nativeObject(review,["source","tree","recipeSha256","configurationSha256","filesSha256"]);requireInput(review.source===d.source&&review.tree===d.tree&&review.recipeSha256===d.recipe.sha256&&review.configurationSha256===hashBytes(JSON.stringify(d.configuration))&&review.filesSha256===hashBytes(JSON.stringify(d.files)),"INPUT_REVIEW_BINDING");
 nativeObject(d.configuration,["target","network","syntheticTrust","epoch","frontend"]);requireInput(d.configuration.target==="production-runtime"&&d.configuration.network==="none"&&d.configuration.syntheticTrust===null&&/^\d{1,12}$/.test(d.configuration.epoch)&&/^docker\/dockerfile:[0-9]+(?:\.[0-9]+)*@sha256:[a-f0-9]{64}$/.test(d.configuration.frontend),"INPUT_CONFIGURATION_INVALID");
 nativeObject(d.images,[...IMAGE_NAMES,...(d.images.dependencies?["dependencies"]:[])]);nativeObject(d.tools,[...TOOL_NAMES]);
 nativeObject(d.databases,["trivy","grype"]);for(const name of ["trivy","grype"] as const){const db=d.databases[name];nativeObject(db,["sha256","file","updatedAt","version","files"]);safeRelative(db.file);requireInput(db.file.startsWith(name+"-db/")&&hash(db.sha256)&&Number.isFinite(Date.parse(db.updatedAt))&&Date.parse(db.updatedAt)<=policy.now&&policy.now-Date.parse(db.updatedAt)<=72*3600000&&db.version===(name==="trivy"?"0.70.0":"0.110.0"),"INPUT_DATABASE_INVALID");readBlob(reader,db.sha256,1024*1024*1024);
  const required=name==="trivy"?["trivy-db/db/trivy.db","trivy-db/db/metadata.json"]:["grype-db/6/vulnerability.db","grype-db/6/import.json"];
  requireInput(db.file===required[0]&&Array.isArray(db.files)&&db.files.length===required.length,"INPUT_DATABASE_FILES_INCOMPLETE");const paths=new Set<string>();
  for(const f of db.files){nativeObject(f,["file","sha256","bytes"]);safeRelative(f.file);requireInput(required.includes(f.file)&&!paths.has(f.file)&&Number.isSafeInteger(f.bytes)&&f.bytes>0&&f.bytes<=1024*1024*1024,"INPUT_DATABASE_FILE_INVALID");paths.add(f.file);requireInput(readBlob(reader,f.sha256,1024*1024*1024).length===f.bytes,"INPUT_DATABASE_FILE_BYTES");}
  requireInput(db.files.find(f=>f.file===db.file)?.sha256===db.sha256,"INPUT_DATABASE_FILE_BINDING");const meta=json(reader,db.files.find(f=>f.file===required[1])!.sha256);
  if(name==="trivy"){nativeObject(meta,["Version","UpdatedAt","NextUpdate","DownloadedAt"]);requireInput(meta.Version===2&&Date.parse(meta.UpdatedAt)===Date.parse(db.updatedAt)&&Date.parse(meta.NextUpdate)>Date.parse(meta.UpdatedAt)&&Number.isFinite(Date.parse(meta.DownloadedAt))&&Date.parse(meta.DownloadedAt)<=policy.now,"INPUT_DATABASE_METADATA");}
  else {requireInput(Object.keys(meta).every(k=>["digest","source","client_version"].includes(k))&&/^xxh64:[a-f0-9]{16}$/.test(meta.digest)&&meta.client_version==="6.1.4"&&(!meta.source||typeof meta.source==="string"),"INPUT_DATABASE_METADATA");}
 }
 nativeObject(policy.toolPins,[...TOOL_NAMES]);
 const reports:Record<string,any>={};
 for(const name of [...IMAGE_NAMES,...(d.images.dependencies?["dependencies" as const]:[])]){const c=d.images[name]!;nativeObject(c,["reference","index","manifest","config","subject","security","node"]);requireInput(digest(c.subject)&&typeof c.reference==="string"&&c.reference.endsWith("@sha256:"+c.index),"INPUT_IMAGE_PIN");const i=json(reader,c.index),m=json(reader,c.manifest),config=json(reader,c.config);requireInput(i.schemaVersion===2&&Array.isArray(i.manifests),"INPUT_IMAGE_INDEX");const matches=i.manifests.filter((x:any)=>x.platform?.os==="linux"&&x.platform?.architecture===d.architecture);requireInput(matches.length===1&&matches[0].digest==="sha256:"+c.manifest&&matches[0].size===readBlob(reader,c.manifest).length,"INPUT_PLATFORM_DESCRIPTOR");requireInput(m.schemaVersion===2&&m.config?.digest===c.subject&&c.subject==="sha256:"+c.config&&m.config.size===readBlob(reader,c.config).length&&config.os==="linux"&&config.architecture===d.architecture&&Array.isArray(m.layers)&&m.layers.length>0&&m.layers.length<=100,"INPUT_IMAGE_CONFIG");for(const layer of m.layers){requireInput(digest(layer.digest)&&Number.isSafeInteger(layer.size)&&layer.size>0&&layer.size<=1024*1024*1024,"INPUT_IMAGE_LAYER");requireInput(readBlob(reader,layer.digest.slice(7),1024*1024*1024).length===layer.size,"INPUT_IMAGE_LAYER");}if(name==="frontend")requireInput(config.config?.Labels?.["moby.buildkit.frontend.network.none"]==="true","INPUT_FRONTEND_NETWORK_NOT_DISABLED");reports[name]=security(c,reader,policy,"image");nodeEvidence(c,reader,name!=="frontend");}
 requireInput(d.configuration.frontend===d.images.frontend.reference,"INPUT_FRONTEND_MISMATCH");
 for(const name of TOOL_NAMES){const c=d.tools[name];nativeObject(c,["sha256","version","file","archive","subject","security","node"]);safeRelative(c.file);requireInput(hash(c.sha256)&&c.subject==="sha256:"+c.sha256&&typeof c.version==="string"&&c.version.length>0&&c.version.length<=120,"INPUT_TOOL_INVALID");readBlob(reader,c.sha256);const origin=json(reader,c.archive);nativeObject(origin,["archiveSha256","executableSha256","version","path"]);safeRelative(origin.path);readBlob(reader,origin.archiveSha256);requireInput(origin.executableSha256===c.sha256&&origin.version===c.version,"INPUT_TOOL_ARCHIVE_ASSOCIATION");const expected=policy.toolPins[name];nativeObject(expected,["sha256","archiveSha256","version"]);requireInput(hash(expected.sha256)&&hash(expected.archiveSha256)&&c.sha256===expected.sha256&&origin.archiveSha256===expected.archiveSha256&&c.version===expected.version,"INPUT_TOOL_POLICY_MISMATCH");
  if(policy.classification==="HOSTED_PREBUILD_INPUTS"){
   if(name==="trivy"||name==="grype"||name==="syft"){const pin=scannerPins.tools[name];requireInput(c.version===pin.version&&origin.archiveSha256===pin[d.architecture].sha256,"INPUT_EXISTING_SCANNER_PIN_MISMATCH");}
   if(["buildctl","buildkitd","runc"].includes(name))requireInput(c.version===builderPins.buildkitVersion&&origin.archiveSha256===builderPins[d.architecture].buildkit.sha256,"INPUT_EXISTING_BUILDKIT_PIN_MISMATCH");
   if(name==="rootlesskit")requireInput(c.version===builderPins.rootlesskitVersion&&origin.archiveSha256===builderPins[d.architecture].rootlesskit.sha256,"INPUT_EXISTING_ROOTLESS_PIN_MISMATCH");
  }
  reports[name]=security(c,reader,policy,"tool");nodeEvidence(c,reader,name==="node",name==="node"?c.sha256:undefined);}
 for(const c of [...Object.values(d.images),...Object.values(d.tools)]){const m=json(reader,c.security.metadata);for(const name of ["trivy","grype"] as const)requireInput(m[name].databaseSha256===d.databases[name].sha256&&m[name].databaseUpdatedAt===d.databases[name].updatedAt&&m[name].version===d.databases[name].version,"INPUT_DATABASE_BINDING");}
 for(const p of Object.values(reports))for(const name of ["trivy","grype","syft"] as const)requireInput(p.outcomes[name].toolSha256===d.tools[name].sha256,"INPUT_SCANNER_EXECUTABLE_SUBSTITUTED");
 // Do not let callers mutate the authenticated document or reuse stale bytes.
 const materials=d.materials?verifyMaterialManifest(readBlob(reader,d.materials),d.materials,d,reader):undefined;
 if(materials)requireInput(d.images.dependencies&&hashBytes(JSON.stringify(d.images.dependencies))===hashBytes(JSON.stringify(materials.manifest.image)),"INPUT_MATERIAL_IMAGE_MISMATCH");
 const snapshot=JSON.stringify(d),materialSnapshot=materials?JSON.stringify(materials.manifest):null,recipeSnapshot=materials?hashBytes(materials.recipe):null;
 const result:VerifiedInputs={document:d,classification:d.classification,manifestSha256:hashBytes(payload),materials,guard:()=>{requireInput(!materials||(JSON.stringify(materials.manifest)===materialSnapshot&&hashBytes(materials.recipe)===recipeSnapshot),"INPUT_MATERIAL_RECEIPT_MUTATED");requireInput(JSON.stringify(d)===snapshot,"INPUT_RECEIPT_MUTATED");requireInput(Date.now()<d.expiresAt,"INPUT_EVIDENCE_STALE");for(const [id,h] of seen)requireInput(hashBytes(originalReader(id))===h&&h===id,"INPUT_BYTES_SUBSTITUTED");}};
 verified.add(result);return Object.freeze(result);
}

/** Intentionally no environment/CLI key resolver. Registering a production
 * authority requires a separately reviewed configuration change. */
export function productionInputPolicy():InputPolicy {return loadProductionInputPolicy().policy;}
export function verifyProductionInputs(envelope:Buffer,reader:BlobReader){const authority=loadProductionInputPolicy();const result=verifyInputs(envelope,reader,authority.policy);authority.policy.checkDocument(result.document);return result;}
