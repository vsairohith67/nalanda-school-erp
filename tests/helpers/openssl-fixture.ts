// Test-only synchronous CA diagnostics. No raw output, paths, PEM or environment values.
import { execFileSync } from "node:child_process";
import { createHash, createPrivateKey, X509Certificate } from "node:crypto";
import { existsSync, lstatSync, readFileSync, realpathSync, readdirSync, rmSync, openSync, writeSync, ftruncateSync, closeSync } from "node:fs";
import { performance } from "node:perf_hooks";
import path from "node:path";
import { tmpdir } from "node:os";
import { checkedDirectory } from "./service-trace";

export const opensslTraceRoot = path.resolve("tmp/ci-openssl-fixture");
export const opensslPublicRoot = path.resolve("tmp/ci-openssl-fixture-public");
const exact = (v:any, keys:string[]) => { if (!v || typeof v!=="object" || Array.isArray(v) || Object.keys(v).sort().join()!==[...keys].sort().join()) throw Error("OPENSSL_METADATA_INVALID"); };
const finite = (n:any, max=1e9) => { if (!Number.isFinite(n) || n<0 || n>max) throw Error("OPENSSL_METADATA_INVALID"); };
const one = (v:any, choices:any[]) => { if (!choices.includes(v)) throw Error("OPENSSL_METADATA_INVALID"); };
export type FileState = { state:string; bytes:number|null };
export type OpenSslRun = (executable:string,args:string[],options:{stdio:"pipe";timeout:20000}) => Buffer|string;
export function fileState(file:string):FileState {
 try { const s=lstatSync(file); return s.isFile()&&!s.isSymbolicLink()&&s.nlink===1 ? {state:"REGULAR",bytes:s.size} : {state:"UNSAFE",bytes:null}; }
 catch(e:any) { return {state:e.code==="ENOENT"?"MISSING":"UNREADABLE",bytes:null}; }
}
const codes=["ETIMEDOUT","ENOENT","EACCES","ENOBUFS","OTHER"] as const;
export function safeProcessError(error:any) {
 const b=(v:any)=>Buffer.isBuffer(v)?Math.min(v.length,1048576):null;
 const stderr=Buffer.isBuffer(error?.stderr)?error.stderr:null;
 return {code:codes.includes(error?.code)?error.code:"OTHER",exitStatus:Number.isInteger(error?.status)&&error.status>=0&&error.status<=255?error.status:null,signal:["SIGTERM","SIGKILL"].includes(error?.signal)?error.signal:error?.signal?"OTHER":null,stdoutBytes:b(error?.stdout),stderrBytes:b(stderr),stderrClass:stderr===null?"UNAVAILABLE":stderr.length===0?"EMPTY":/^[.+*\-\r\n ]+$/.test(stderr.toString("ascii"))?"PROGRESS_ONLY":"OTHER_PRIVATE_OUTPUT"};
}
export function validateOpenSslMetadata(v:any) {
 exact(v,["contract","owner","invocation","timeoutMs","hookTimeoutMs","stage","preflightMs","tool","process","outputs","properties","cases","cleanup"]);
 if(v.contract!=="NALANDA_OPENSSL_FIXTURE_V1"||v.invocation!=="REQ_X509_RSA2048_CA"||v.timeoutMs!==20000||v.hookTimeoutMs!==30000)throw Error("OPENSSL_METADATA_INVALID");
 if(v.owner!==null) {
 exact(v.owner,["contract","source","run","attempt","job","provider","node","image","runner"]);
 if(v.owner.contract!=="NALANDA_SERVICE_TRACE_V1"||!/^([a-f0-9]{40})$/.test(v.owner.source)||!/^\d{1,20}$/.test(v.owner.run)||!/^\d{1,20}$/.test(v.owner.attempt)||!/^[a-zA-Z0-9_-]{1,100}$/.test(v.owner.job)||!/^v\d+\.\d+\.\d+$/.test(v.owner.node)||!/^[a-zA-Z0-9._-]{1,80}$/.test(v.owner.image))throw Error("OPENSSL_METADATA_INVALID");
 one(v.owner.provider,["sqlite","postgresql"]);one(v.owner.runner,["Windows","Linux","macOS","unavailable"]);
 }
 exact(v.tool,["sha256","version","versionStatus","configOverride","modulesOverride"]);
 one(v.stage,["PREFLIGHT","GENERATION","VALIDATION","READY"]);if(v.preflightMs!==null)finite(v.preflightMs);
 if(v.tool.sha256!==null&&!/^[a-f0-9]{64}$/.test(v.tool.sha256)||v.tool.version!==null&&!/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(v.tool.version))throw Error("OPENSSL_METADATA_INVALID");
 one(v.tool.versionStatus,["OK","UNAVAILABLE"]);if((v.tool.versionStatus==="OK")!==(v.tool.version!==null))throw Error("OPENSSL_METADATA_INVALID");one(v.tool.configOverride,["PRESENT","ABSENT"]);one(v.tool.modulesOverride,["PRESENT","ABSENT"]);
 exact(v.process,["state","elapsedMs","code","exitStatus","signal","stdoutBytes","stderrBytes","stderrClass"]);
 one(v.process.state,["NOT_ATTEMPTED","IN_PROGRESS","SUCCESS","ERROR"]);
 if(v.process.elapsedMs!==null)finite(v.process.elapsedMs);
 if(v.process.code!==null)one(v.process.code,[...codes]);if(v.process.exitStatus!==null){finite(v.process.exitStatus,255);if(!Number.isInteger(v.process.exitStatus))throw Error("OPENSSL_METADATA_INVALID");}
 one(v.process.signal,[null,"SIGTERM","SIGKILL","OTHER"]);one(v.process.stderrClass,["UNAVAILABLE","EMPTY","PROGRESS_ONLY","OTHER_PRIVATE_OUTPUT"]);
 for(const k of ["stdoutBytes","stderrBytes"])if(v.process[k]!==null){finite(v.process[k],1048576);if(!Number.isInteger(v.process[k]))throw Error("OPENSSL_METADATA_INVALID");}
 exact(v.outputs,["key","certificate"]);for(const s of Object.values(v.outputs) as any[]){exact(s,["state","bytes"]);one(s.state,["MISSING","REGULAR","UNSAFE","UNREADABLE"]);if((s.state==="REGULAR")!==(s.bytes!==null))throw Error("OPENSSL_METADATA_INVALID");if(s.bytes!==null){finite(s.bytes,1048576);if(!Number.isInteger(s.bytes))throw Error("OPENSSL_METADATA_INVALID");}}
 if(v.properties!==null){exact(v.properties,["rsaBits","ca","selfSigned","keyMatches","validityMs"]);one(v.properties.rsaBits,[2048]);one(v.properties.ca,[true]);one(v.properties.selfSigned,[true]);one(v.properties.keyMatches,[true]);one(v.properties.validityMs,[86400000]);}
 if(!Array.isArray(v.cases)||v.cases.length!==10)throw Error("OPENSSL_METADATA_INVALID");
 v.cases.forEach((c:any,i:number)=>{exact(c,["label","state"]);if(c.label!==`case-${i+1}`)throw Error("OPENSSL_METADATA_INVALID");one(c.state,["NOT_EXECUTED","PASS","FAIL","UNKNOWN"]);});
 if(v.stage==="READY"&&(v.properties===null||v.process.state!=="SUCCESS")||v.cases.some((c:any)=>c.state==="PASS")&&v.stage!=="READY")throw Error("OPENSSL_METADATA_INVALID");
 one(v.cleanup,["NOT_ATTEMPTED","REMOVED","REFUSED","FAILED"]);
 if(Buffer.byteLength(JSON.stringify(v))>16000)throw Error("OPENSSL_METADATA_INVALID");
 return v;
}
export function resolveOpenSsl() {
 if(process.platform==="win32")return "C:/Program Files/Git/usr/bin/openssl.exe";
 for(const d of (process.env.PATH??"").split(path.delimiter)){const f=path.join(d,"openssl");try{if(lstatSync(f).isFile()||lstatSync(f).isSymbolicLink())return realpathSync(f);}catch{}}
 throw Error("OPENSSL_EXECUTABLE_UNAVAILABLE");
}
export class OpenSslFixture {
 readonly record:any; private identity; private fd:number|undefined; private journal:string|undefined; private journalIdentity:any;
 constructor(readonly root:string, readonly executable?:string) {
 this.identity=lstatSync(root);
 this.assertRoot();
 let owner=null;
 if(process.env.NALANDA_OPENSSL_TRACE_DIR){
 if(path.resolve(process.env.NALANDA_OPENSSL_TRACE_DIR)!==opensslTraceRoot)throw Error("OPENSSL_TRACE_OWNER_MISMATCH");
 checkedDirectory(opensslTraceRoot);const f=path.join(opensslTraceRoot,"ownership.json"),s=lstatSync(f);if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1||s.size>2048)throw Error("OPENSSL_TRACE_OWNER_MISMATCH");
 owner=JSON.parse(readFileSync(f,"utf8"));if(owner.source!==process.env.EXPECTED_SHA||owner.run!==process.env.GITHUB_RUN_ID||owner.attempt!==process.env.GITHUB_RUN_ATTEMPT||owner.job!==process.env.GITHUB_JOB)throw Error("OPENSSL_TRACE_OWNER_MISMATCH");
 }
 this.record={contract:"NALANDA_OPENSSL_FIXTURE_V1",owner,invocation:"REQ_X509_RSA2048_CA",timeoutMs:20000,hookTimeoutMs:30000,stage:"PREFLIGHT",preflightMs:null,tool:{sha256:null,version:null,versionStatus:"UNAVAILABLE",configOverride:process.env.OPENSSL_CONF?"PRESENT":"ABSENT",modulesOverride:process.env.OPENSSL_MODULES?"PRESENT":"ABSENT"},process:{state:"NOT_ATTEMPTED",elapsedMs:null,code:null,exitStatus:null,signal:null,stdoutBytes:null,stderrBytes:null,stderrClass:"UNAVAILABLE"},outputs:{key:fileState(path.join(root,"ca-key.pem")),certificate:fileState(path.join(root,"ca.pem"))},properties:null,cases:Array.from({length:10},(_,i)=>({label:`case-${i+1}`,state:"NOT_EXECUTED"})),cleanup:"NOT_ATTEMPTED"};
 validateOpenSslMetadata(this.record);
 if(owner){this.journal=path.join(opensslTraceRoot,"openssl.json");this.fd=openSync(this.journal,"wx",0o600);this.journalIdentity=lstatSync(this.journal);}this.persist();
 }
 private assertRoot(){const s=lstatSync(this.root);if(path.dirname(path.resolve(this.root))!==path.resolve(tmpdir())||!path.basename(this.root).startsWith("nalanda-native-inventory-contract-")||!s.isDirectory()||s.isSymbolicLink()||s.ino!==this.identity.ino||s.dev!==this.identity.dev)throw Error("OPENSSL_FIXTURE_CLEANUP_REFUSED");checkedDirectory(this.root);}
 private persist(){
 validateOpenSslMetadata(this.record);
 if(this.fd!==undefined){const s=lstatSync(this.journal!);if(s.ino!==this.journalIdentity.ino||s.dev!==this.journalIdentity.dev||s.nlink!==1||s.isSymbolicLink())throw Error("OPENSSL_TRACE_OWNER_MISMATCH");const b=Buffer.from(JSON.stringify(this.record)+"\n");ftruncateSync(this.fd,0);writeSync(this.fd,b,0,b.length,0);}
 }
 generate(run:OpenSslRun=execFileSync) {
 const preflight=performance.now();let executable:string;
 try{this.assertRoot();executable=this.executable??resolveOpenSsl();if(lstatSync(executable).size>20000000)throw Error("OPENSSL_EXECUTABLE_BOUND_EXCEEDED");this.record.tool.sha256=createHash("sha256").update(readFileSync(executable)).digest("hex");
 try{const text=execFileSync(executable,["version"],{stdio:"pipe",timeout:2000,maxBuffer:4096}).toString();this.record.tool.version=text.match(/^OpenSSL (\d{1,3}\.\d{1,3}\.\d{1,3})\b/)?.[1]??null;this.record.tool.versionStatus=this.record.tool.version?"OK":"UNAVAILABLE";}catch{}
 this.record.preflightMs=performance.now()-preflight;
 }catch(e){this.record.preflightMs=performance.now()-preflight;this.record.process={...this.record.process,...safeProcessError(e)};this.persist();throw Error("OPENSSL_FIXTURE_PREFLIGHT_FAILED:"+this.record.process.code);}
 this.record.stage="GENERATION";this.record.process.state="IN_PROGRESS";this.persist();const start=performance.now();
 try {
 const output=run(executable,["req","-x509","-newkey","rsa:2048","-nodes","-keyout",path.join(this.root,"ca-key.pem"),"-out",path.join(this.root,"ca.pem"),"-days","1","-subj","/CN=Synthetic native contract CA","-addext","basicConstraints=critical,CA:TRUE"],{stdio:"pipe",timeout:20000});
 this.record.process={...this.record.process,state:"SUCCESS",elapsedMs:performance.now()-start,exitStatus:0,stdoutBytes:Buffer.byteLength(output)};
 }catch(e){
 this.record.process={state:"ERROR",elapsedMs:performance.now()-start,...safeProcessError(e)};this.snapshot();this.persist();
 // Never let Vitest serialize the original stderr/paths or a future secret-bearing output.
 throw Error("OPENSSL_FIXTURE_GENERATION_FAILED:"+this.record.process.code);
 }
 this.snapshot();this.record.stage="VALIDATION";this.persist();
 try {
 const cert=new X509Certificate(readFileSync(path.join(this.root,"ca.pem"))),key=createPrivateKey(readFileSync(path.join(this.root,"ca-key.pem")));
 const props={rsaBits:key.asymmetricKeyDetails?.modulusLength,ca:cert.ca,selfSigned:cert.verify(cert.publicKey),keyMatches:cert.checkPrivateKey(key),validityMs:Date.parse(cert.validTo)-Date.parse(cert.validFrom)};
 validateOpenSslMetadata({...this.record,properties:props});this.record.properties=props;this.record.stage="READY";this.persist();return cert;
 }catch{this.persist();throw Error("OPENSSL_FIXTURE_PROPERTIES_REJECTED");}
 }
 private snapshot(){this.record.outputs={key:fileState(path.join(this.root,"ca-key.pem")),certificate:fileState(path.join(this.root,"ca.pem"))};}
 caseResult(index:number,state:string|undefined){if(index<0||index>=10)throw Error("OPENSSL_CASE_BOUND_EXCEEDED");this.record.cases[index].state=state==="pass"?"PASS":state==="fail"?"FAIL":"UNKNOWN";this.persist();}
 cleanup() {
 try {
 const s=lstatSync(this.root);
 if(path.dirname(path.resolve(this.root))!==path.resolve(tmpdir())||!path.basename(this.root).startsWith("nalanda-native-inventory-contract-")||s.isSymbolicLink()||s.ino!==this.identity.ino||s.dev!==this.identity.dev){this.record.cleanup="REFUSED";throw Error("OPENSSL_FIXTURE_CLEANUP_REFUSED");}
 let count=0;const walk=(d:string,depth=0)=>{if(depth>8)throw Error("OPENSSL_FIXTURE_CLEANUP_REFUSED");for(const n of readdirSync(d)){if(++count>100)throw Error("OPENSSL_FIXTURE_CLEANUP_REFUSED");const f=path.join(d,n),st=lstatSync(f);if(st.isSymbolicLink()||!st.isDirectory()&&(!st.isFile()||st.nlink!==1))throw Error("OPENSSL_FIXTURE_CLEANUP_REFUSED");if(st.isDirectory())walk(f,depth+1);}};walk(this.root);
 rmSync(this.root,{recursive:true});if(existsSync(this.root))throw Error("OPENSSL_FIXTURE_CLEANUP_FAILED");this.record.cleanup="REMOVED";
 }catch(e){this.record.cleanup=e instanceof Error&&e.message==="OPENSSL_FIXTURE_CLEANUP_REFUSED"?"REFUSED":"FAILED";throw Error("OPENSSL_FIXTURE_CLEANUP_"+this.record.cleanup);}
 finally{this.persist();if(this.fd!==undefined){closeSync(this.fd);this.fd=undefined;}}
 }
}
