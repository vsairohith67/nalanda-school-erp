import {describe,it,expect} from "vitest";
import {spawnSync} from "node:child_process";
import {mkdtempSync,mkdirSync,lstatSync,writeFileSync,readFileSync,existsSync,rmSync,symlinkSync,unlinkSync} from "node:fs";
import path from "node:path";
import {tmpdir} from "node:os";
import {OpenSslFixture,validateOpenSslMetadata,safeProcessError} from "./helpers/openssl-fixture";
import {finalizeOpenSsl} from "../scripts/qa-recovery-service-traces";
const owner={contract:"NALANDA_SERVICE_TRACE_V1",source:"a".repeat(40),run:"1",attempt:"1",job:"HARNESS_ONLY",provider:"sqlite",node:process.version,image:"unavailable",runner:"unavailable"};
function owned(){return mkdtempSync(path.join(tmpdir(),"nalanda-native-inventory-contract-"));}
function record(){const root=owned();const saved=process.env.NALANDA_OPENSSL_TRACE_DIR;delete process.env.NALANDA_OPENSSL_TRACE_DIR;try{const fixture=new OpenSslFixture(root);const result=structuredClone(fixture.record);fixture.cleanup();return result;}finally{if(saved!==undefined)process.env.NALANDA_OPENSSL_TRACE_DIR=saved;}}
describe("HARNESS_ONLY OpenSSL fixture diagnostics, not historical timeout reproduction",()=>{
 it.each(["timeout","failure"])("retains %s child nonzero status and verified partial cleanup",mode=>{
  const root=owned(),file=path.join(root,"receipt.json");
  try{
   const env:NodeJS.ProcessEnv={...process.env,OPENSSL_CHILD_FILE:file,OPENSSL_CHILD_MODE:mode};delete env.NALANDA_OPENSSL_TRACE_DIR;
   const child=spawnSync(process.execPath,["--import","tsx","tests/fixtures/openssl-child.fixture.ts"],{env,stdio:"pipe",timeout:5000,windowsHide:true});
   expect(child.error).toBeUndefined();expect(child.signal).toBeNull();expect(child.status).toBe(1);
   const v=JSON.parse(readFileSync(file,"utf8"));validateOpenSslMetadata(v);
   expect(v.process.state).toBe("ERROR");expect(v.process.code).toBe(mode==="timeout"?"ETIMEDOUT":"OTHER");expect(v.cleanup).toBe("REMOVED");
   expect(v.process.exitStatus).toBe(mode==="timeout"?null:7);expect(v.process.signal).toBe(mode==="timeout"?"SIGTERM":null);
   expect(v.outputs.key.state).toBe("REGULAR");expect(v.outputs.certificate.state).toBe("MISSING");expect(v.cases.every((c:any)=>c.state==="NOT_EXECUTED")).toBe(true);
   expect(JSON.stringify(v)).not.toMatch(/PRIVATE_TOKEN|PRIVATE KEY|ca-key|\.pem|AppData|password/);
  }finally{const s=lstatSync(root);expect(s.isSymbolicLink()).toBe(false);rmSync(root,{recursive:true});expect(existsSync(root)).toBe(false);}
 });
 it("projects process error without raw error/stdout/stderr/arguments or PID",()=>{
  const v=safeProcessError({code:"ETIMEDOUT",status:null,signal:"SIGTERM",stdout:Buffer.from("private"),stderr:Buffer.from("PRIVATE_TOKEN_"+Math.random()),pid:123456,spawnargs:["secret"],message:"private"});
  expect(v).toEqual({code:"ETIMEDOUT",exitStatus:null,signal:"SIGTERM",stdoutBytes:7,stderrBytes:expect.any(Number),stderrClass:"OTHER_PRIVATE_OUTPUT"});expect(JSON.stringify(v)).not.toContain("PRIVATE_TOKEN");
  expect(safeProcessError({stderr:Buffer.from("...+++++*-----\n")} ).stderrClass).toBe("PROGRESS_ONLY");
 });
 it("rejects unknown/private, malformed, oversized and weakened property fields",()=>{
  const v=record();validateOpenSslMetadata(v);
  for(const altered of [{...v,stderr:"secret"},{...v,tool:{...v.tool,version:"PRIVATE"}},{...v,process:{...v.process,elapsedMs:-1}},{...v,outputs:{...v.outputs,key:{state:"REGULAR",bytes:1048577}}},{...v,properties:{rsaBits:1024,ca:true,selfSigned:true,keyMatches:true,validityMs:86400000}},{...v,cases:[]},{...v,owner:{...owner,secret:"private"}}])expect(()=>validateOpenSslMetadata(altered)).toThrow();
 });
 it("keeps fixed generation arguments and deadlines at the delegated boundary",()=>{
  const root=owned(),saved=process.env.NALANDA_OPENSSL_TRACE_DIR;delete process.env.NALANDA_OPENSSL_TRACE_DIR;const fixture=new OpenSslFixture(root);
  try{expect(()=>fixture.generate((exe,args,options)=>{expect(args).toEqual(["req","-x509","-newkey","rsa:2048","-nodes","-keyout",path.join(root,"ca-key.pem"),"-out",path.join(root,"ca.pem"),"-days","1","-subj","/CN=Synthetic native contract CA","-addext","basicConstraints=critical,CA:TRUE"]);expect(options).toEqual({stdio:"pipe",timeout:20000});throw Object.assign(Error("private"),{code:"ENOENT"});})).toThrow("OPENSSL_FIXTURE_GENERATION_FAILED:ENOENT");}
  finally{fixture.cleanup();if(saved!==undefined)process.env.NALANDA_OPENSSL_TRACE_DIR=saved;}expect(existsSync(root)).toBe(false);
 });
 it("retains missing executable preflight without inventing a process or leaking its path",()=>{
  const root=owned(),saved=process.env.NALANDA_OPENSSL_TRACE_DIR;delete process.env.NALANDA_OPENSSL_TRACE_DIR;const fixture=new OpenSslFixture(root,path.join(root,"missing.exe"));
  try{expect(()=>fixture.generate()).toThrow("OPENSSL_FIXTURE_PREFLIGHT_FAILED:ENOENT");expect(fixture.record.stage).toBe("PREFLIGHT");expect(fixture.record.process.state).toBe("NOT_ATTEMPTED");expect(fixture.record.tool.sha256).toBeNull();expect(JSON.stringify(fixture.record)).not.toContain(root);}
  finally{fixture.cleanup();if(saved!==undefined)process.env.NALANDA_OPENSSL_TRACE_DIR=saved;}expect(fixture.record.cleanup).toBe("REMOVED");
 });
 it("refuses foreign linked cleanup targets and preserves their contents",()=>{
  const root=owned(),foreign=owned(),saved=process.env.NALANDA_OPENSSL_TRACE_DIR;delete process.env.NALANDA_OPENSSL_TRACE_DIR;const fixture=new OpenSslFixture(root);
  const linked=path.join(root,"linked");symlinkSync(foreign,linked,process.platform==="win32"?"junction":"dir");
  try{expect(()=>fixture.cleanup()).toThrow("OPENSSL_FIXTURE_CLEANUP_REFUSED");expect(fixture.record.cleanup).toBe("REFUSED");expect(existsSync(foreign)).toBe(true);}
  finally{unlinkSync(linked);rmSync(root,{recursive:true});rmSync(foreign,{recursive:true});if(saved!==undefined)process.env.NALANDA_OPENSSL_TRACE_DIR=saved;}
 });
 it("finalizes exact allowlisted bytes and refuses foreign/private/truncated input before publication",()=>{
  const root=owned(),input=path.join(root,"input"),out=path.join(root,"public");mkdirSync(input);
  const v=record();v.owner=owner;
  const save=(r:any)=>writeFileSync(path.join(input,"openssl.json"),JSON.stringify(r)+"\n");
  try{
   writeFileSync(path.join(input,"ownership.json"),JSON.stringify(owner)+"\n");save(v);
   const files=finalizeOpenSsl(input,out,owner);expect(files.map(f=>f.file)).toEqual(["openssl.json"]);expect(JSON.parse(readFileSync(path.join(out,"manifest.json"),"utf8")).files).toEqual(files);
   const refused=path.join(root,"refused");
   for(const r of [{...v,owner:{...owner,source:"b".repeat(40)}},{...v,rawKey:"private"}]){save(r);expect(()=>finalizeOpenSsl(input,refused,owner)).toThrow();expect(existsSync(refused)).toBe(false);}
   writeFileSync(path.join(input,"openssl.json"),"{");expect(()=>finalizeOpenSsl(input,refused,owner)).toThrow();expect(existsSync(refused)).toBe(false);
   save(v);writeFileSync(path.join(input,"foreign.pem"),"private");expect(()=>finalizeOpenSsl(input,refused,owner)).toThrow();expect(existsSync(refused)).toBe(false);
  }finally{rmSync(root,{recursive:true});}
 });
});
