import {copyFileSync,lstatSync,realpathSync,mkdirSync,readdirSync,readFileSync,writeFileSync,openSync,fsyncSync,closeSync,constants,existsSync,chmodSync} from "node:fs";
import path from "node:path";
import {hashBytes} from "./artifact-handoff";
import {requireInput} from "./product-input-contract";
import type {ProducerIdentity} from "./synthetic-build-lifecycle";

/** Complete raw product/report/process bytes go to registered private custody
 * before cleanup. Failure retains the owned producer root. No public upload. */
export function retainProductEvidence(root:string,custody:string,identity:ProducerIdentity,operation:"product"|"materials"="product"){
 const parent=lstatSync(custody);requireInput(parent.isDirectory()&&!parent.isSymbolicLink()&&realpathSync.native(custody)===custody&&parent.uid===process.getuid?.()&&(parent.mode&0o077)===0,"PRODUCT_CUSTODY_UNSAFE");
 const destination=path.join(custody,`${operation}-${identity.runId}-${identity.attempt}-${identity.architecture}`);mkdirSync(destination,{mode:0o700});
 const names=readdirSync(root).filter(n=>/^(?:product\.oci\.tar|build-metadata\.json|scanner-metadata\.json|(?:trivy|grype|sbom)\.json(?:\.process-receipt\.json)?|process-[0-9]+\.(?:stdout|stderr|json))$/.test(n));
 if(operation==="materials"&&existsSync(path.join(root,"material-output"))){for(const dir of ["material-output","material-output/blobs"]){const s=lstatSync(path.join(root,dir));requireInput(s.isDirectory()&&!s.isSymbolicLink()&&realpathSync.native(path.join(root,dir))===path.join(root,dir),"PRODUCT_CUSTODY_SOURCE_UNSAFE");mkdirSync(path.join(destination,dir),{mode:0o700});}for(const name of readdirSync(path.join(root,"material-output")))requireInput(name==="blobs"||name==="material-manifest.json","PRODUCT_CUSTODY_EXTRA_MATERIAL");if(existsSync(path.join(root,"material-output/material-manifest.json")))names.push("material-output/material-manifest.json");const ids=readdirSync(path.join(root,"material-output/blobs"));requireInput(ids.length<=50000&&ids.every(id=>/^[a-f0-9]{64}$/.test(id)),"PRODUCT_CUSTODY_MATERIAL_BOUND");names.push(...ids.map(id=>"material-output/blobs/"+id));}
 const files=[];
 for(const name of names){const source=path.join(root,name),s=lstatSync(source);requireInput(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&realpathSync.native(source)===source&&s.size<=4*1024**3,"PRODUCT_CUSTODY_SOURCE_UNSAFE");const target=path.join(destination,name);copyFileSync(source,target,constants.COPYFILE_EXCL);const before=hashBytes(readFileSync(source)),after=hashBytes(readFileSync(target));requireInput(before===after&&lstatSync(source).mtimeMs===s.mtimeMs,"PRODUCT_CUSTODY_COPY_MISMATCH");const fd=openSync(target,"r");try{fsyncSync(fd);}finally{closeSync(fd);}files.push({name,sha256:after,bytes:s.size});}
 writeFileSync(path.join(destination,"manifest.json"),JSON.stringify({contract:"NALANDA_PRIVATE_PRODUCT_RETENTION_V1",operation,identity,files,retention:"OWNER_MANAGED_REGISTERED_CUSTODY"}),{flag:"wx",mode:0o600});
 for(const f of files)chmodSync(path.join(destination,f.name),0o600);
 for(const file of [path.join(destination,"manifest.json"),...(existsSync(path.join(destination,"material-output"))?[path.join(destination,"material-output/blobs"),path.join(destination,"material-output")]:[]),destination,custody]){const fd=openSync(file,"r");try{fsyncSync(fd);}finally{closeSync(fd);}}return {files:files.length,retention:"OWNER_MANAGED_REGISTERED_CUSTODY"};
}
