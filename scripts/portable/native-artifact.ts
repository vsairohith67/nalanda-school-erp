import assert from "node:assert/strict";
import {createPublicKey,sign,verify,type KeyObject} from "node:crypto";
import {lstatSync,readFileSync,realpathSync,readdirSync,rmSync} from "node:fs";
import path from "node:path";
import {hashBytes} from "./artifact-handoff";
import {validateNativeQaProfile,type NativeQaEnvelope} from "./native-qa-profile";
import type {SyntheticBuildTrust} from "../../lib/portable-runtime/synthetic-capability";

const digest=/^[a-f0-9]{64}$/,sha=/^[a-f0-9]{40}$/;
export const NATIVE_INPUTS=["pnpm-lock.yaml","pnpm-workspace.yaml","package.json","apps/nalanda-cross-platform/package.json","apps/nalanda-cross-platform/src-tauri/Cargo.lock","apps/nalanda-cross-platform/src-tauri/Cargo.toml","apps/nalanda-cross-platform/src-tauri/tauri.conf.json","apps/nalanda-cross-platform/src-tauri/build.rs",".github/workflows/cross-platform-apps.yml"] as const;
export const NATIVE_OUTPUTS=["launch/nalanda-cross-platform.exe","package/Nalanda School_0.1.0_x64-setup.exe"] as const;
export type NativeInventory={contract:"NALANDA_WINDOWS_NATIVE_INVENTORY_V1";classification:"HOSTED_EXACT_NATIVE_BUILD"|"HARNESS_FIXTURE_ONLY";source:string;tree:string;runId:string;attempt:string;nativeBuildId:string;profile:"SYNTHETIC_QA";appId:"com.nalandaps.erp";version:"0.1.0";architecture:"x64";backendBuildId:string;backendImage:string;containerId:string;profileSha256:string;trustSha256:string;createdAt:number;expiresAt:number;inputs:Record<string,{gitBlob:string;sha256:string}>;tools:{node:string;pnpm:string;rustc:string;cargo:string;tauri:string;cargoAudit:string};toolSha256:Record<"node"|"pnpm"|"rustc"|"cargo"|"tauri"|"cargoAudit",string>;outputs:Array<{path:typeof NATIVE_OUTPUTS[number];size:number;sha256:string}>;security:{rootAudit:string;appAudit:string;rustAudit:string}};
export function nativeObject(v:unknown,fields:string[]):asserts v is Record<string,any>{assert(v&&typeof v==="object"&&!Array.isArray(v));assert.deepEqual(Object.keys(v).sort(),fields.slice().sort(),"NATIVE_UNKNOWN_OR_MISSING_FIELDS");}
const matches=(p:RegExp,v:unknown)=>typeof v==="string"&&p.test(v);
export const nativeInventorySchema={parse(value:unknown):NativeInventory{
 nativeObject(value,["contract","classification","source","tree","runId","attempt","nativeBuildId","profile","appId","version","architecture","backendBuildId","backendImage","containerId","profileSha256","trustSha256","createdAt","expiresAt","inputs","tools","toolSha256","outputs","security"]);
 const v=value as NativeInventory;
 assert(v.contract==="NALANDA_WINDOWS_NATIVE_INVENTORY_V1"&&["HOSTED_EXACT_NATIVE_BUILD","HARNESS_FIXTURE_ONLY"].includes(v.classification));
 assert(matches(sha,v.source)&&matches(sha,v.tree)&&matches(/^\d{1,20}$/,v.runId)&&matches(/^\d{1,6}$/,v.attempt));
 assert(v.profile==="SYNTHETIC_QA"&&v.appId==="com.nalandaps.erp"&&v.version==="0.1.0"&&v.architecture==="x64");
 for(const k of ["nativeBuildId","backendBuildId","containerId","profileSha256","trustSha256"] as const)assert(matches(digest,v[k]));assert(matches(/^sha256:[a-f0-9]{64}$/,v.backendImage));
 assert(Number.isSafeInteger(v.createdAt)&&Number.isSafeInteger(v.expiresAt));
 nativeObject(v.inputs,[...NATIVE_INPUTS]);for(const row of Object.values(v.inputs)){nativeObject(row,["gitBlob","sha256"]);assert(matches(sha,row.gitBlob)&&matches(digest,row.sha256));}
 nativeObject(v.tools,["node","pnpm","rustc","cargo","tauri","cargoAudit"]);
 nativeObject(v.toolSha256,["node","pnpm","rustc","cargo","tauri","cargoAudit"]);for(const h of Object.values(v.toolSha256))assert(matches(digest,h));
 assert(v.tools.node==="v24.19.0"&&v.tools.pnpm==="11.21.0"&&v.tools.tauri==="2.11.4"&&matches(/^cargo-audit(?:-audit)? 0\.22\.2$/,v.tools.cargoAudit));
 assert(matches(/^rustc 1\.97\.1 \([a-f0-9]+ [0-9-]+\)$/,v.tools.rustc)&&matches(/^cargo 1\.97\.1 \([a-f0-9]+ [0-9-]+\)$/,v.tools.cargo));
 assert(Array.isArray(v.outputs)&&v.outputs.length===2);for(const f of v.outputs){nativeObject(f,["path","size","sha256"]);assert(NATIVE_OUTPUTS.includes(f.path)&&Number.isSafeInteger(f.size)&&f.size>=256&&f.size<=256*1024*1024&&matches(digest,f.sha256));}
 nativeObject(v.security,["rootAudit","appAudit","rustAudit"]);for(const h of Object.values(v.security))assert(matches(digest,h));return v;
}};
export type NativeReceipt={payload:string;signature:string};
export type NativeContext={source:string;runId:string;attempt:string;containerId:string;imageConfigDigest:string;trust:SyntheticBuildTrust;profile:NativeQaEnvelope};

/** Canonical bounded JSON also rejects duplicate keys, including nested ones.
 * Producers deliberately emit this representation; arbitrary JSON is not accepted. */
export function nativeJson(bytes:Buffer,max=65536):unknown {
 assert(bytes.length>0&&bytes.length<=max,"NATIVE_EVIDENCE_BOUND");const v=JSON.parse(bytes.toString("utf8"));
 assert.equal(JSON.stringify(v),bytes.toString("utf8"),"NATIVE_EVIDENCE_NONCANONICAL_OR_DUPLICATE");return v;
}
export function validateNativeInventory(value:unknown,context:NativeContext,now=Date.now()) {
 const v=nativeInventorySchema.parse(value),p=validateNativeQaProfile(context.trust,context.profile,now);
 for(const k of ["source","runId","attempt","nativeBuildId","appId","architecture"] as const)assert.equal(v[k],p[k],"NATIVE_BUILD_BINDING");
 for(const k of ["source","runId","attempt","containerId"] as const)assert.equal(v[k],context[k],"NATIVE_TARGET_BINDING");
 assert.equal(v.backendImage,context.imageConfigDigest);assert.equal(v.backendBuildId,p.buildId);
 assert.equal(v.profileSha256,hashBytes(JSON.stringify(context.profile)));assert.equal(v.trustSha256,hashBytes(JSON.stringify(context.trust)));
 assert(v.createdAt>=p.issuedAt&&v.createdAt<=now&&v.expiresAt===p.expiresAt&&v.expiresAt>now,"NATIVE_EVIDENCE_STALE");
 assert.deepEqual(Object.keys(v.inputs).sort(),[...NATIVE_INPUTS].sort(),"NATIVE_INPUT_SET");
 assert.deepEqual(v.outputs.map(f=>f.path),[...NATIVE_OUTPUTS],"NATIVE_OUTPUT_SET");
 return v;
}
/** No private key is supplied by Windows. Only the admitted Linux controller
 * calls this after authenticating the exact inventory's hosted build context. */
export function signNativeInventory(v:NativeInventory,context:NativeContext,key:KeyObject,now=Date.now()):NativeReceipt {
 validateNativeInventory(v,context,now);assert.equal(v.classification,"HOSTED_EXACT_NATIVE_BUILD","HARNESS_FIXTURE_CANNOT_QUALIFY_NATIVE");
 assert.equal(key.asymmetricKeyType,"ed25519");assert.equal(createPublicKey(key).export({type:"spki",format:"pem"}).toString(),context.trust.publicKey);
 const bytes=Buffer.from(JSON.stringify(v));return {payload:bytes.toString("base64url"),signature:sign(null,bytes,key).toString("base64url")};
}
export function verifyNativeReceipt(receipt:unknown,context:NativeContext,now=Date.now()) {
 nativeObject(receipt,["payload","signature"]);const e=receipt as NativeReceipt;assert(matches(/^[\w-]+$/,e.payload)&&e.payload.length<=65536&&matches(/^[\w-]{86}$/,e.signature));
 const key=createPublicKey(context.trust.publicKey),bytes=Buffer.from(e.payload,"base64url");
 assert.equal(key.asymmetricKeyType,"ed25519");assert(verify(null,bytes,key,Buffer.from(e.signature,"base64url")),"NATIVE_SIGNATURE_REJECTED");
 const v=validateNativeInventory(nativeJson(bytes),context,now);
 assert.equal(v.classification,"HOSTED_EXACT_NATIVE_BUILD","HARNESS_FIXTURE_CANNOT_QUALIFY_NATIVE");return v;
}
export function nativeOwnedPath(root:string,relative:string,directory=false) {
 assert(path.isAbsolute(root)&&relative&&!relative.includes("\\")&&!relative.includes(":")&&!relative.split("/").some(p=>!p||p==="."||p===".."),"NATIVE_PATH_INVALID");
 const resolved=path.resolve(root),file=path.resolve(resolved,relative);assert(file.startsWith(resolved+path.sep));
 let cursor=file;
 while(true){const s=lstatSync(cursor);assert(!s.isSymbolicLink()&&realpathSync(cursor)===cursor,"NATIVE_REPARSE_REFUSED");if(cursor===file)assert(directory?s.isDirectory():s.isFile()&&s.nlink===1,"NATIVE_LINK_OR_TYPE_REFUSED");else assert(s.isDirectory());const parent=path.dirname(cursor);if(parent===cursor)break;cursor=parent;}
 return file;
}
export function inventoryNativeFile(root:string,relative:typeof NATIVE_OUTPUTS[number]) {
 const file=nativeOwnedPath(root,relative),s=lstatSync(file);assert(s.size>=256&&s.size<=256*1024*1024,"NATIVE_OUTPUT_SIZE");
 const bytes=readFileSync(file);assert.equal(bytes.length,s.size);assert.equal(bytes.toString("ascii",0,2),"MZ","NATIVE_PE_REQUIRED");
 const pe=bytes.readUInt32LE(0x3c);assert(pe>=64&&pe+26<=bytes.length&&bytes.readUInt32LE(pe)===0x4550,"NATIVE_PE_INVALID");
 const machine=bytes.readUInt16LE(pe+4);assert(relative.startsWith("launch/")?machine===0x8664:[0x8664,0x14c].includes(machine),"NATIVE_PE_ARCHITECTURE");
 return {path:relative,size:bytes.length,sha256:hashBytes(bytes)};
}
/** Cargo may hardlink deps into release/. Every peer must be accounted for in
 * this fresh owned scratch tree. Launch/package outputs still require nlink=1. */
export function validateNativeScratch(work:string){
 const root=nativeOwnedPath(work,"cargo",true),peers=new Map<string,{count:bigint;links:bigint}>();let count=0;const deadline=Date.now()+30000;
 const visit=(dir:string)=>{for(const name of readdirSync(dir)){
  assert(++count<=200000&&Date.now()<deadline,"NATIVE_SCRATCH_BOUND");const file=path.join(dir,name),s=lstatSync(file,{bigint:true});
  assert(!s.isSymbolicLink()&&realpathSync(file)===file,"NATIVE_SCRATCH_REPARSE");
  if(s.isDirectory())visit(file);else{assert(s.isFile()&&s.nlink>=1n);const key=`${s.dev}:${s.ino}`,seen=peers.get(key)??{count:0n,links:s.nlink};assert.equal(seen.links,s.nlink);seen.count++;peers.set(key,seen);}
 }};visit(root);for(const p of peers.values())assert.equal(p.count,p.links,"NATIVE_SCRATCH_FOREIGN_HARDLINK");return root;
}
export function removeNativeScratch(work:string){const root=validateNativeScratch(work);assert.equal(root,path.join(path.resolve(work),"cargo"));rmSync(root,{recursive:true});}
export function verifyNativeOutputs(root:string,v:NativeInventory){
 for(const folder of ["launch","package"]){nativeOwnedPath(root,folder,true);assert.deepEqual(readdirSync(path.join(root,folder)).sort(),v.outputs.filter(f=>f.path.startsWith(folder+"/")).map(f=>path.posix.basename(f.path)).sort(),"NATIVE_UNEXPECTED_SUPPORT_FILE");}
 for(const f of v.outputs)assert.deepEqual(inventoryNativeFile(root,f.path),f,"NATIVE_OUTPUT_SUBSTITUTED");
 return path.join(root,NATIVE_OUTPUTS[0]);
}
export function verifyNativeSecurity(reports:{rootAudit:Buffer;appAudit:Buffer;rustAudit:Buffer},expected:NativeInventory["security"]){
 for(const name of ["rootAudit","appAudit","rustAudit"] as const){const b=reports[name];assert(b.length>0&&b.length<=4*1024*1024&&hashBytes(b)===expected[name],"NATIVE_SECURITY_REPORT_SUBSTITUTED");const r=JSON.parse(b.toString());
  if(name!=="rustAudit"){assert(r.metadata?.vulnerabilities&&r.metadata.vulnerabilities.high===0&&r.metadata.vulnerabilities.critical===0&&!r.error,"NATIVE_DEPENDENCY_SECURITY_REJECTED");}
  else {assert(r.vulnerabilities?.found===false&&r.vulnerabilities.count===0&&Array.isArray(r.vulnerabilities.list)&&r.vulnerabilities.list.length===0&&r.database?.["last-commit"]&&r.lockfile?.["dependency-count"]>0,"NATIVE_RUST_SECURITY_REJECTED");assert(Object.values(r.warnings??{}).every(x=>Array.isArray(x)&&x.length===0),"NATIVE_RUST_WARNINGS_REQUIRE_REVIEW");}
 }
}
