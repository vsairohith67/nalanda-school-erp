import {verifyPreparation,preparationHeader,type Preparation} from "./material-source";
import {readFileSync,mkdirSync,writeFileSync,lstatSync,realpathSync,statfsSync} from "node:fs";
import path from "node:path";
import {boundedJson,requireInput,safeRelative,type InputDocument,type BlobReader} from "./product-input-contract";
import {nativeObject} from "./native-artifact";
import {hashBytes} from "./artifact-handoff";
import {materialAcquisitionRecipe} from "./product-materials";

export type AcquisitionPlan={contract:"NALANDA_MATERIAL_ACQUISITION_V1";source:string;tree:string;architecture:string;recipeSha256:string;lockSha256:string;effectiveRecipeSha256:string;snapshot:string;packages:{name:string;version:string}[];environmentApproval:string;pnpmArchive:string;preparation:string|null;files:{path:string;sha256:string;bytes:number}[]};
export type VerifiedAcquisition={plan:AcquisitionPlan;recipe:Buffer;preparation:Preparation|null;guard:()=>void};
const receipts=new WeakSet<object>();
/** The signed plan digest must be checked before selecting any downloadable
 * material, not merely when the fully acquired plan is later verified. */
export function acquisitionPreparation(bytes:Buffer,expected:string,d:InputDocument,read:BlobReader){
 requireInput(hashBytes(bytes)===expected,"MATERIAL_ACQUISITION_PLAN_SUBSTITUTED");const plan=boundedJson(bytes,8*1024**2);
 requireInput(plan.contract==="NALANDA_MATERIAL_ACQUISITION_V1"&&plan.source===d.source&&plan.tree===d.tree&&plan.architecture===d.architecture&&typeof plan.preparation==="string","MATERIAL_ACQUISITION_SUBJECT");
 return preparationHeader(read(plan.preparation),plan.preparation,d);
}
export function assertAcquisition(value:VerifiedAcquisition){requireInput(receipts.has(value),"MATERIAL_ACQUISITION_RECEIPT_REQUIRED");value.guard();}

/** Input bytes come from the independently authorized manifest, not an env
 * enable flag. This stage creates dependency material only, never ERP output. */
export function verifyAcquisitionPlan(bytes:Buffer,expected:string,d:InputDocument,reader:BlobReader):VerifiedAcquisition {
 requireInput(hashBytes(bytes)===expected,"MATERIAL_ACQUISITION_PLAN_SUBSTITUTED");const p=boundedJson(bytes,8*1024*1024) as AcquisitionPlan;
 nativeObject(p,["contract","source","tree","architecture","recipeSha256","lockSha256","effectiveRecipeSha256","snapshot","packages","environmentApproval","pnpmArchive","preparation","files"]);
 requireInput(p.contract==="NALANDA_MATERIAL_ACQUISITION_V1"&&p.source===d.source&&p.tree===d.tree&&p.architecture===d.architecture&&p.recipeSha256===d.recipe.sha256&&p.lockSha256===d.files.find(f=>f.path==="pnpm-lock.yaml")?.sha256&&typeof p.environmentApproval==="string"&&/^https:\/\/[^\s]{1,500}$/.test(p.environmentApproval),"MATERIAL_ACQUISITION_SUBJECT");
 requireInput(/^[a-f0-9]{64}$/.test(p.pnpmArchive)&&hashBytes(reader(p.pnpmArchive))===p.pnpmArchive&&(d.classification==="HARNESS_ONLY"||p.pnpmArchive==="87237d37eadb79dc626a0576eb3a52d23d70422c323ae5e00fc05c91f4323780"),"MATERIAL_PNPM_ARCHIVE_PIN_MISMATCH");
 const recipe=materialAcquisitionRecipe(reader(p.recipeSha256),p);
 requireInput(hashBytes(recipe)===p.effectiveRecipeSha256&&Array.isArray(p.files)&&p.files.length>0&&p.files.length<=50000,"MATERIAL_ACQUISITION_RECIPE_OR_FILES");
 let total=0;const names=new Set<string>();
 for(const f of p.files){nativeObject(f,["path","sha256","bytes"]);safeRelative(f.path);requireInput(!names.has(f.path.toLowerCase())&&(f.path.startsWith("engines/")||f.path.startsWith("pnpm/"))&&/^[a-f0-9]{64}$/.test(f.sha256)&&Number.isSafeInteger(f.bytes)&&f.bytes>0&&f.bytes<=256*1024*1024,"MATERIAL_ACQUISITION_FILE_INVALID");names.add(f.path.toLowerCase());const raw=reader(f.sha256);requireInput(raw.length===f.bytes&&hashBytes(raw)===f.sha256,"MATERIAL_ACQUISITION_FILE_SUBSTITUTED");if(f.path.startsWith("engines/"))requireInput(raw.length>=64&&raw.subarray(0,6).equals(Buffer.from([127,69,76,70,2,1]))&&raw.readUInt16LE(18)===(d.architecture==="amd64"?62:183),"MATERIAL_ENGINE_ARCHITECTURE");total+=f.bytes;}
 requireInput(total<=1024**3&&names.has("engines/query-engine.node")&&names.has("engines/schema-engine")&&names.has("pnpm/bin/pnpm.cjs"),"MATERIAL_ACQUISITION_ENGINES_MISSING");
 const preparation=p.preparation===null?(requireInput(d.classification==="HARNESS_ONLY","MATERIAL_PREPARATION_REQUIRED"),null):verifyPreparation(reader(p.preparation),p.preparation,d,reader);
 if(preparation){const inv=boundedJson(reader(preparation.inventory));requireInput(preparation.snapshot===p.snapshot&&inv.packages.length===p.packages.length&&p.packages.every(x=>inv.packages.some((y:any)=>y.name===x.name&&y.version===x.version)),"MATERIAL_PLAN_INVENTORY_MISMATCH");for(const role of ["query","schema"]){const o=preparation.origins.find(x=>x.role===role),f=p.files.find(x=>x.path==="engines/"+(role==="query"?"query-engine.node":"schema-engine"));requireInput(o&&f&&o.sha256===f.sha256,"MATERIAL_PLAN_ENGINE_MISMATCH");}}
 const snapshot=JSON.stringify(p),recipeHash=hashBytes(recipe),preparationSnapshot=JSON.stringify(preparation);
 const result={plan:p,recipe,preparation,guard:()=>{requireInput(JSON.stringify(p)===snapshot&&hashBytes(recipe)===recipeHash&&JSON.stringify(preparation)===preparationSnapshot,"MATERIAL_ACQUISITION_MUTATED");if(p.preparation)verifyPreparation(reader(p.preparation),p.preparation,d,reader);for(const f of p.files)requireInput(hashBytes(reader(f.sha256))===f.sha256,"MATERIAL_ACQUISITION_FILE_SUBSTITUTED");}};
 receipts.add(result);return Object.freeze(result);
}

export function stageAcquisition(input:VerifiedAcquisition,reader:BlobReader,root:string){
 assertAcquisition(input);const free=statfsSync(root);requireInput(free.bavail*free.bsize>=input.plan.files.reduce((sum,f)=>sum+f.bytes,0)+6*1024**3,"MATERIAL_DISK_CAPACITY_MISSING");
 const hashes=new Map<string,string>();const archive=path.join(root,"pnpm-material.tar.gz");writeFileSync(archive,reader(input.plan.pnpmArchive),{flag:"wx",mode:0o400});hashes.set(archive,input.plan.pnpmArchive);
 for(const f of input.plan.files){const file=path.join(root,"material-inputs",f.path);mkdirSync(path.dirname(file),{recursive:true,mode:0o700});writeFileSync(file,reader(f.sha256),{flag:"wx",mode:0o500});requireInput(lstatSync(file).nlink===1&&realpathSync.native(file)===file&&hashBytes(readFileSync(file))===f.sha256,"MATERIAL_ACQUISITION_FILE_SUBSTITUTED");hashes.set(file,f.sha256);}
 if(input.preparation){const p=input.preparation,inventory=boundedJson(reader(p.inventory));
  const stage=(name:string,raw:Buffer)=>{const file=path.join(root,"material-inputs",name);mkdirSync(path.dirname(file),{recursive:true,mode:0o700});writeFileSync(file,raw,{flag:"wx",mode:0o400});hashes.set(file,hashBytes(raw));};
  const replay=[...p.tarballs.map(({url,sha256,bytes})=>({url,sha256,bytes})),...p.metadata];
  stage("replay/replay-index.json",Buffer.from(JSON.stringify(replay)));
  for(const id of new Set(replay.map(e=>e.sha256)))stage("replay/blobs/"+id,reader(id));
  for(const deb of inventory.packages)stage("debs/"+deb.sha256+".deb",reader(deb.sha256));
 }
 return hashes;
}
