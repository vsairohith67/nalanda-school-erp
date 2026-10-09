import {existsSync,mkdirSync,readFileSync,writeFileSync} from "node:fs";
import path from "node:path";
import {hashBytes} from "./artifact-handoff";
import {boundedJson,requireInput,type BlobReader,type InputDocument,type ImageInput} from "./product-input-contract";
import {offlineProductRecipe,verifyMaterialManifest,type MaterialManifest} from "./product-materials";
import type {VerifiedAcquisition} from "./material-acquisition";
import type {ProductProcessReceipt} from "./producer-process";

/** Construct a candidate input manifest from actual captured bytes/receipts.
 * It is deliberately unsigned; the registered attestor reviews/signs it and
 * the authority independently grants the separate product operation. */
export function packageMaterials(root:string,d:InputDocument,acquisition:VerifiedAcquisition,original:BlobReader,output:{indexSha256:string;manifestDigest:string;configDigest:string},processes:ProductProcessReceipt[],collection:any){
 requireInput(acquisition.preparation&&acquisition.plan.preparation,"MATERIAL_PREPARATION_REQUIRED");
 const dir=path.join(root,"material-output"),blobs=path.join(dir,"blobs");mkdirSync(blobs,{recursive:true,mode:0o700});
 const put=(value:Buffer|object)=>{const raw=Buffer.isBuffer(value)?value:Buffer.from(JSON.stringify(value)),id=hashBytes(raw),file=path.join(blobs,id);if(!existsSync(file))writeFileSync(file,raw,{flag:"wx",mode:0o600});else requireInput(hashBytes(readFileSync(file))===id,"MATERIAL_BLOB_COLLISION");return id;};
 const read:BlobReader=id=>{const file=path.join(blobs,id);const raw=existsSync(file)?readFileSync(file):original(id);requireInput(hashBytes(raw)===id,"MATERIAL_BLOB_SUBSTITUTED");put(raw);return raw;};
 const identity=Object.fromEntries(["source","tree","architecture","repository","workflow","runId","attempt","job"].map(k=>[k,d[k as keyof InputDocument]]));
 const security:any={};for(const name of ["trivy","grype","sbom","metadata"]){const file=name==="metadata"?"scanner-metadata.json":name+".json";security[name]=put(readFileSync(path.join(root,file)));}
 const outcomes:any={};for(const name of ["trivy","grype","syft"]){const p=processes.find(x=>x.stage===name);requireInput(p&&p.exit===0&&!p.signal&&!p.timedOut&&!p.interrupted&&!p.ioFailed&&!p.startupFailed&&p.settled,"MATERIAL_SCAN_RECEIPT_MISSING");const seq=processes.indexOf(p)+1;
  // Sequence numbers include the rootless daemon. Match by recorded receipt,
  // never infer a process filename from array position.
  void seq;const capture=(which:"stdout"|"stderr")=>{for(let i=1;i<=processes.length+2;i++){const f=path.join(root,`process-${i}.${which}`);if(existsSync(f)&&hashBytes(readFileSync(f))===p[which+"Sha256" as "stdoutSha256"|"stderrSha256"])return put(readFileSync(f));}throw Error("MATERIAL_SCAN_OUTPUT_MISSING");};
  outcomes[name]={exit:p.exit,signal:p.signal,timedOut:p.timedOut,durationMs:p.durationMs,settled:p.settled,reportSha256:security[name==="syft"?"sbom":name],toolSha256:d.tools[name as "trivy"|"grype"|"syft"].sha256,stdoutSha256:capture("stdout"),stderrSha256:capture("stderr")};
 }
 security.processes=put({identity,classification:d.classification,subject:output.configDigest,outcomes});
 const image:ImageInput={reference:"nalanda-materials:dependencies@sha256:"+output.indexSha256,index:output.indexSha256,manifest:output.manifestDigest.slice(7),config:output.configDigest.slice(7),subject:output.configDigest,security,node:null};
 for(const id of [image.index,image.manifest,image.config])put(readFileSync(path.join(root,"product-oci",id===image.index?"index.json":"blobs/sha256/"+id)));
 const manifest=boundedJson(read(image.manifest));for(const layer of manifest.layers)put(readFileSync(path.join(root,"product-oci/blobs/sha256",layer.digest.slice(7))));
 const build=processes.find(p=>p.stage==="build");requireInput(build?.exit===0&&build.settled&&!build.signal&&!build.timedOut,"MATERIAL_BUILD_RECEIPT_MISSING");
 const outputBlob=(h:string)=>{for(let i=1;i<=processes.length+2;i++)for(const ext of ["stdout","stderr"]){const f=path.join(root,`process-${i}.${ext}`);if(existsSync(f)&&hashBytes(readFileSync(f))===h)return put(readFileSync(f));}throw Error("MATERIAL_BUILD_OUTPUT_MISSING");};
 const process=put({source:d.source,architecture:d.architecture,recipeSha256:put(acquisition.recipe),imageConfig:image.subject,exit:build.exit,signal:build.signal,timedOut:build.timedOut,settled:build.settled,stdout:outputBlob(build.stdoutSha256),stderr:outputBlob(build.stderrSha256),environmentApproval:acquisition.plan.environmentApproval});
 const builder=boundedJson(read(d.images.builder.node!));image.node=put({...builder,subject:image.subject,association:put({binarySha256:builder.binarySha256,sourceSha256:builder.sourceSha256,subject:image.subject,buildProvenanceSha256:process})});
 // Every inherited Node evidence byte stays identical; collector separately
 // proved the Node executable in the prepared OCI equals the builder's binary.
 read(builder.binarySha256);read(builder.sourceSha256);read(builder.inventory);for(const l of builder.libraries){read(l.sourceSha256);read(l.evidence);for(const a of l.advisories)read(a.patchSha256);}
 const p=acquisition.preparation,tarballs=[...new Map(p.tarballs.map(t=>[t.integrity,{sha256:t.sha256,integrity:t.integrity}])).values()];
 const storeStatusProcess=put({...collection.receipts.store,imageConfig:image.subject,source:d.source});
 const lockIntegrity=put({lockSha256:p.lockSha256,packageManager:"pnpm@11.21.0",verifyStoreIntegrity:true,externalSources:["https://registry.npmjs.org","https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"],storeStatusExit:collection.receipts.store.exit,tarballs,storeStatusProcess});
 const material:MaterialManifest={contract:"NALANDA_PREPARED_DEPENDENCIES_V1",source:d.source,tree:d.tree,architecture:d.architecture,recipeSha256:d.recipe.sha256,lockSha256:p.lockSha256,workspaceSha256:d.files.find(f=>f.path==="pnpm-workspace.yaml")!.sha256,effectiveRecipeSha256:hashBytes(offlineProductRecipe(read(d.recipe.sha256),image.reference)),image,acquisition:{recipe:put(acquisition.recipe),process,inventory:p.inventory,lockIntegrity,nativeInventory:collection.nativeInventory,preparation:acquisition.plan.preparation}};
 const sha256=put(material);verifyMaterialManifest(read(sha256),sha256,{...d,images:{...d.images,dependencies:image}},read);
 // Replay/download provenance is retained in full, including original metadata.
 for(const e of p.downloads)read(e.sha256);read(p.baseInstalledStatus);read(acquisition.plan.preparation);
 writeFileSync(path.join(dir,"material-manifest.json"),JSON.stringify({sha256,manifest:material,classification:"UNSIGNED_MATERIAL_QUALIFICATION_CANDIDATE",runtimeAdmission:"EXTERNAL_RUNTIME_BLOCKED"}),{flag:"wx",mode:0o600});
 return {sha256,classification:"UNSIGNED_MATERIAL_QUALIFICATION_CANDIDATE",image};
}
