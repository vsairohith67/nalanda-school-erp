import {verifyPreparation} from "./material-source";
import {createHash} from "node:crypto";
import {mkdirSync,writeFileSync,statfsSync} from "node:fs";
import path from "node:path";
import {boundedJson,requireInput,safeRelative,type BlobReader,type InputDocument,type ImageInput} from "./product-input-contract";
import {nativeObject} from "./native-artifact";
import {hashBytes} from "./artifact-handoff";
import {downloadMaterialBytes} from "./material-download";

export type MaterialManifest={contract:"NALANDA_PREPARED_DEPENDENCIES_V1";source:string;tree:string;architecture:"amd64"|"arm64";recipeSha256:string;lockSha256:string;workspaceSha256:string;effectiveRecipeSha256:string;image:ImageInput;acquisition:{recipe:string;process:string;inventory:string;lockIntegrity:string;nativeInventory:string;preparation:string}};
const HEX=/^[a-f0-9]{64}$/;
const DEPENDENCIES_END="\nFROM dependencies AS builder\n";

/** This finite transformation replaces only the complete acquisition stage.
 * The signed manifest binds both original and effective recipes. A new source
 * layout needs review; arbitrary stages/commands cannot be smuggled through. */
export function offlineProductRecipe(original:Buffer,reference:string){
 requireInput(/^nalanda-materials:dependencies@sha256:[a-f0-9]{64}$/.test(reference),"MATERIAL_REFERENCE_INVALID");
 const text=original.toString("utf8").replaceAll("\r\n","\n"),end=text.indexOf(DEPENDENCIES_END);
 requireInput(end>0&&text.indexOf(DEPENDENCIES_END,end+1)===-1,"MATERIAL_RECIPE_LAYOUT");
 const start=text.indexOf("FROM ${NODE_IMAGE} AS dependencies\n");requireInput(start>0&&start<end,"MATERIAL_RECIPE_LAYOUT");
 const stage=text.slice(start,end);
 requireInput(stage.includes("corepack prepare pnpm@11.21.0 --activate")&&stage.includes("apt-get update")&&stage.includes("pnpm install --frozen-lockfile")&&stage.includes("COPY apps/portable-migrator/package.json"),"MATERIAL_RECIPE_LAYOUT");
 const result=text.slice(0,start)+`ARG MATERIAL_IMAGE=${reference}\nFROM ${MATERIAL_IMAGE_PLACEHOLDER} AS dependencies\n`+text.slice(end);
 requireInput(!/\b(?:apt-get|apt|corepack|curl|wget)\b|\b(?:pnpm|npm|yarn)\s+(?:install|add|fetch)\b/i.test(result),"MATERIAL_OFFLINE_RECIPE_UNSUPPORTED");
 return Buffer.from(result);
}
const MATERIAL_IMAGE_PLACEHOLDER="${MATERIAL_IMAGE}";

/** Acquisition uses the actual dependency stage, fixed Debian snapshot and
 * explicit installed versions. Package integrity/lifecycle results still need
 * original reports and authority review before its image can be consumed. */
export function materialAcquisitionRecipe(original:Buffer,plan:{snapshot:string;packages:{name:string;version:string}[]}){
 requireInput(/^20[0-9]{6}T[0-9]{6}Z$/.test(plan.snapshot)&&plan.packages.length>=2&&plan.packages.length<=200,"MATERIAL_APT_PLAN_INVALID");
 const names=new Set<string>();for(const p of plan.packages){nativeObject(p,["name","version"]);requireInput(/^[a-z0-9][a-z0-9+.-]{0,80}$/.test(p.name)&&/^[0-9][A-Za-z0-9+:~.-]{0,100}$/.test(p.version)&&!names.has(p.name),"MATERIAL_APT_PLAN_INVALID");names.add(p.name);}
 requireInput(names.has("ca-certificates")&&names.has("openssl"),"MATERIAL_APT_CLOSURE_MISSING");
 const text=original.toString("utf8").replaceAll("\r\n","\n"),end=text.indexOf(DEPENDENCIES_END);requireInput(end>0,"MATERIAL_RECIPE_LAYOUT");
 const apt="RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl && rm -rf /var/lib/apt/lists/*";
 requireInput(text.slice(0,end).split(apt).length===2,"MATERIAL_RECIPE_LAYOUT");
 // All external material was authenticated before the build. Every RUN keeps
 // network=none, including pnpm fetch served by finite loopback byte replay.
 const replacement=`COPY --from=material-inputs /debs /opt/nalanda-materials/debs\nRUN --network=none apt-get --no-download install -y --no-install-recommends /opt/nalanda-materials/debs/*.deb`;
 return Buffer.from(text.slice(0,end).replace(apt,replacement).replace("RUN corepack enable && corepack prepare pnpm@11.21.0 --activate","COPY --from=material-inputs /pnpm /opt/pnpm\nRUN --network=none ln -sf /opt/pnpm/bin/pnpm.cjs /usr/local/bin/pnpm").replace("RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile","COPY --from=material-inputs /engines /opt/nalanda-engines\nCOPY --from=material-inputs /replay /opt/nalanda-materials\nCOPY scripts/portable/material-replay.mjs /opt/nalanda-materials/replay.mjs\nENV PRISMA_QUERY_ENGINE_LIBRARY=/opt/nalanda-engines/query-engine.node PRISMA_SCHEMA_ENGINE_BINARY=/opt/nalanda-engines/schema-engine\nRUN --network=none node /opt/nalanda-materials/replay.mjs /opt/nalanda-materials\nARG SOURCE_COMMIT\nLABEL org.opencontainers.image.revision=\"${SOURCE_COMMIT}\" io.nalanda.artifact-purpose=\"PREPARED_DEPENDENCIES_ONLY\""));
}

export function verifyMaterialManifest(bytes:Buffer,expected:string,d:InputDocument,reader:BlobReader){
 requireInput(hashBytes(bytes)===expected,"MATERIAL_MANIFEST_SUBSTITUTED");
 const m=boundedJson(bytes,262144) as MaterialManifest;
 nativeObject(m,["contract","source","tree","architecture","recipeSha256","lockSha256","workspaceSha256","effectiveRecipeSha256","image","acquisition"]);
 requireInput(m.contract==="NALANDA_PREPARED_DEPENDENCIES_V1"&&m.source===d.source&&m.tree===d.tree&&m.architecture===d.architecture&&m.recipeSha256===d.recipe.sha256&&m.lockSha256===d.files.find(f=>f.path==="pnpm-lock.yaml")?.sha256&&m.workspaceSha256===d.files.find(f=>f.path==="pnpm-workspace.yaml")?.sha256&&HEX.test(m.effectiveRecipeSha256),"MATERIAL_SUBJECT_MISMATCH");
 nativeObject(m.acquisition,["recipe","process","inventory","lockIntegrity","nativeInventory","preparation"]);
 const get=(id:string)=>{requireInput(HEX.test(id),"MATERIAL_HASH_INVALID");const b=reader(id);requireInput(b.length>0&&b.length<=64*1024*1024&&hashBytes(b)===id,"MATERIAL_BYTES_SUBSTITUTED");return boundedJson(b);};
 const prepared=verifyPreparation(reader(m.acquisition.preparation),m.acquisition.preparation,d,reader);
 requireInput(prepared.inventory===m.acquisition.inventory,"MATERIAL_PREPARATION_INVENTORY");
 const process=get(m.acquisition.process);nativeObject(process,["source","architecture","recipeSha256","imageConfig","exit","signal","timedOut","settled","stdout","stderr","environmentApproval"]);
 requireInput(process.source===d.source&&process.architecture===d.architecture&&process.recipeSha256===m.acquisition.recipe&&process.imageConfig===m.image.subject&&process.exit===0&&process.signal===null&&process.timedOut===false&&process.settled===true&&typeof process.environmentApproval==="string"&&process.environmentApproval.startsWith("https://"),"MATERIAL_ACQUISITION_FAILED");
 for(const id of [process.stdout,process.stderr]){requireInput(HEX.test(id),"MATERIAL_HASH_INVALID");const b=reader(id);requireInput(b.length<=64*1024*1024&&hashBytes(b)===id,"MATERIAL_BYTES_SUBSTITUTED");}
 const inventory=get(m.acquisition.inventory);nativeObject(inventory,["snapshot","packages","aptReleaseFiles"]);
 requireInput(Array.isArray(inventory.aptReleaseFiles)&&inventory.aptReleaseFiles.length>=1&&inventory.aptReleaseFiles.length<=4,"MATERIAL_APT_PROVENANCE_MISSING");
 for(const release of inventory.aptReleaseFiles){nativeObject(release,["inRelease","packages","keyring","path"]);safeRelative(release.path);requireInput(release.path.endsWith("/Packages.gz"),"MATERIAL_APT_INDEX_INVALID");for(const id of [release.inRelease,release.packages,release.keyring])requireInput(HEX.test(id)&&hashBytes(reader(id))===id,"MATERIAL_APT_PROVENANCE_MISSING");}
 for(const p of inventory.packages){nativeObject(p,["name","version","release","sha256","filename"]);safeRelative(p.filename);requireInput(Number.isInteger(p.release)&&p.release>=0&&p.release<inventory.aptReleaseFiles.length&&HEX.test(p.sha256)&&hashBytes(reader(p.sha256))===p.sha256,"MATERIAL_DEB_BYTES_MISSING");}
 const recipe=materialAcquisitionRecipe(reader(d.recipe.sha256),{snapshot:inventory.snapshot,packages:inventory.packages.map((p:any)=>({name:p.name,version:p.version}))});requireInput(hashBytes(recipe)===m.acquisition.recipe&&hashBytes(reader(m.acquisition.recipe))===m.acquisition.recipe,"MATERIAL_ACQUISITION_RECIPE_MISMATCH");
 const lock=get(m.acquisition.lockIntegrity);nativeObject(lock,["lockSha256","packageManager","verifyStoreIntegrity","externalSources","storeStatusExit","tarballs","storeStatusProcess"]);
 requireInput(lock.lockSha256===m.lockSha256&&lock.packageManager==="pnpm@11.21.0"&&lock.verifyStoreIntegrity===true&&lock.storeStatusExit===0&&Array.isArray(lock.externalSources)&&lock.externalSources.every((s:unknown)=>s==="https://registry.npmjs.org"||s==="https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"),"MATERIAL_LOCK_INTEGRITY_MISSING");
 const resolutions=reader(m.lockSha256).toString("utf8").split("\n").filter(line=>/^    resolution:/.test(line));
 requireInput(resolutions.length>0&&resolutions.length<=10000&&resolutions.every(line=>/^    resolution: \{integrity: sha512-[A-Za-z0-9+/]{86}==(?:, tarball: https:\/\/cdn\.sheetjs\.com\/xlsx-0\.20\.3\/xlsx-0\.20\.3\.tgz)?\}\r?$/.test(line)),"MATERIAL_LOCK_SOURCE_UNSUPPORTED");
 const integrities=new Set(resolutions.map(line=>line.match(/sha512-[A-Za-z0-9+/]{86}==/)![0]));
 requireInput(Array.isArray(lock.tarballs)&&lock.tarballs.length===integrities.size,"MATERIAL_LOCK_TARBALL_COVERAGE");
 for(const t of lock.tarballs){nativeObject(t,["sha256","integrity"]);requireInput(HEX.test(t.sha256)&&integrities.delete(t.integrity),"MATERIAL_LOCK_TARBALL_COVERAGE");const raw=reader(t.sha256);requireInput(hashBytes(raw)===t.sha256&&"sha512-"+createHash("sha512").update(raw).digest("base64")===t.integrity,"MATERIAL_LOCK_INTEGRITY_MISMATCH");}
 const store=get(lock.storeStatusProcess);nativeObject(store,["exit","signal","timedOut","settled","stdout","stderr","imageConfig","source"]);
 requireInput(store.exit===0&&store.signal===null&&store.timedOut===false&&store.settled===true&&store.imageConfig===m.image.subject&&store.source===d.source,"MATERIAL_STORE_PROCESS_FAILED");
 for(const id of [store.stdout,store.stderr])requireInput(HEX.test(id)&&hashBytes(reader(id))===id,"MATERIAL_STORE_PROCESS_BYTES");
 const native=get(m.acquisition.nativeInventory);nativeObject(native,["architecture","lifecyclePackages","files","installedStatus","baseInstalledStatus"]);
 requireInput(native.architecture===d.architecture&&Array.isArray(native.lifecyclePackages)&&["@prisma/client","@prisma/engines","esbuild","prisma","sharp"].every(p=>native.lifecyclePackages.includes(p))&&Array.isArray(native.files)&&native.files.length>0&&native.files.length<=1000,"MATERIAL_NATIVE_CLOSURE_MISSING");
 requireInput(native.baseInstalledStatus===prepared.baseInstalledStatus,"MATERIAL_BASE_STATUS_MISMATCH");
 requireInput(HEX.test(native.installedStatus)&&hashBytes(reader(native.installedStatus))===native.installedStatus,"MATERIAL_INSTALLED_STATUS_MISSING");
 for(const f of native.files){nativeObject(f,["path","sha256","origin"]);safeRelative(f.path);requireInput(HEX.test(f.sha256)&&hashBytes(reader(f.sha256))===f.sha256&&HEX.test(f.origin)&&hashBytes(reader(f.origin))===f.origin,"MATERIAL_NATIVE_BYTES_MISSING");const origin=get(f.origin);requireInput(origin.path===f.path&&origin.sha256===f.sha256&&prepared.origins.some(o=>JSON.stringify(o)===JSON.stringify(origin)),"MATERIAL_NATIVE_ORIGIN_MISMATCH");}
 requireInput(native.files.length===prepared.origins.length&&new Set(native.files.map((f:any)=>f.path)).size===native.files.length&&prepared.origins.every(o=>native.files.some((f:any)=>f.path===o.path&&f.sha256===o.sha256)),"MATERIAL_NATIVE_CLOSURE_MISSING");
 const effective=offlineProductRecipe(reader(d.recipe.sha256),m.image.reference);requireInput(hashBytes(effective)===m.effectiveRecipeSha256,"MATERIAL_EFFECTIVE_RECIPE_MISMATCH");
 return {manifest:m,recipe:effective};
}

/** Fixed HTTPS origins and independent expected bytes; redirects cannot become
 * external URL fallback. This acquisition step never executes package code. */
export async function acquireMaterialBlob(url:string,expected:string,size:number,directory:string){
 const u=new URL(url);requireInput(u.protocol==="https:"&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash&&["registry.npmjs.org","cdn.sheetjs.com","nodejs.org","snapshot.debian.org","binaries.prisma.sh"].includes(u.hostname)&&HEX.test(expected)&&Number.isSafeInteger(size)&&size>0&&size<=1024**3,"MATERIAL_DOWNLOAD_INVALID");
 const space=statfsSync(directory);requireInput(space.bavail*space.bsize>=size+64*1024**2,"MATERIAL_DISK_CAPACITY_MISSING");
 const bytes=await downloadMaterialBytes(url,expected,size);
 mkdirSync(path.join(directory,"blobs"),{recursive:true,mode:0o700});writeFileSync(path.join(directory,"blobs",expected),bytes,{flag:"wx",mode:0o600});return expected;
}
