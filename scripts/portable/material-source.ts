import {createHash} from "node:crypto";
import {gunzipSync} from "node:zlib";
import {mkdirSync,writeFileSync,readFileSync,existsSync,statfsSync} from "node:fs";
import path from "node:path";
import {boundedJson,requireInput,safeRelative,type BlobReader,type InputDocument} from "./product-input-contract";
import {nativeObject} from "./native-artifact";
import {hashBytes} from "./artifact-handoff";
import {downloadMaterialBytes,materialDownloadURL} from "./material-download";

export type Download={url:string;sha256:string;bytes:number};
export type Preparation={contract:"NALANDA_OFFLINE_MATERIAL_SOURCE_V1";source:string;tree:string;architecture:"amd64"|"arm64";lockSha256:string;snapshot:string;baseInstalledStatus:string;inventory:string;tarballs:(Download&{integrity:string})[];metadata:Download[];origins:{path:string;role:"query"|"schema"|"esbuild"|"sharp"|"libvips";sha256:string;archiveSha256:string;url:string;member:string;format:"gzip"|"tar";checksum:string|null}[];downloads:Download[]};
const HEX=/^[a-f0-9]{64}$/;
const sameDownload=(a:Download|undefined,b:Download)=>a?.url===b.url&&a.sha256===b.sha256&&a.bytes===b.bytes;
export function lockedPackages(lock:Buffer){
 requireInput(lock.length<=4*1024**2,"MATERIAL_LOCK_BOUND");const text=lock.toString("utf8").replaceAll("\r\n","\n"),section=text.split("\npackages:\n")[1]?.split("\nsnapshots:\n")[0];requireInput(section&&text.startsWith("lockfileVersion: '9.0'"),"MATERIAL_LOCK_VERSION_UNSUPPORTED");
 let key="";const entries:{name:string;version:string;url:string;integrity:string;registry:boolean}[]=[];
 for(const line of section.split("\n")){
  if(/^  \S/.test(line)){requireInput(line.endsWith(":"),"MATERIAL_LOCK_KEY_INVALID");key=line.slice(2,-1).replace(/^'(.*)'$/,"$1");}
  if(!/^    resolution:/.test(line))continue;
  const m=line.match(/^    resolution: \{integrity: (sha512-[A-Za-z0-9+/]{86}==)(?:, tarball: (https:\/\/cdn\.sheetjs\.com\/xlsx-0\.20\.3\/xlsx-0\.20\.3\.tgz))?\}$/);requireInput(m,"MATERIAL_LOCK_SOURCE_UNSUPPORTED");
  if(m[2]){requireInput(key==="xlsx@"+m[2],"MATERIAL_LOCK_KEY_INVALID");entries.push({name:"xlsx",version:"0.20.3",url:m[2],integrity:m[1],registry:false});continue;}
  const split=key.lastIndexOf("@"),name=key.slice(0,split),version=key.slice(split+1);
  requireInput(/^(?:@[a-z0-9_.-]+\/)?[a-z0-9_.-]+$/.test(name)&&/^[0-9]+\.[0-9]+\.[0-9]+(?:-[A-Za-z0-9.-]+)?$/.test(version),"MATERIAL_LOCK_KEY_INVALID");
  entries.push({name,version,url:"https://registry.npmjs.org/"+name+"/-/"+name.split("/").at(-1)+"-"+version+".tgz",integrity:m[1],registry:true});
 }
 requireInput(entries.length>0&&entries.length<=10000&&new Set(entries.map(e=>e.url)).size===entries.length,"MATERIAL_LOCK_COVERAGE");return entries;
}
function checkedBlob(read:BlobReader,id:string,max=64*1024**2){requireInput(HEX.test(id),"MATERIAL_HASH_INVALID");const raw=read(id);requireInput(raw.length<=max&&hashBytes(raw)===id,"MATERIAL_BYTES_SUBSTITUTED");return raw;}

export function preparationHeader(raw:Buffer,expected:string,d:InputDocument){
 requireInput(hashBytes(raw)===expected,"MATERIAL_PREPARATION_SUBSTITUTED");const p=boundedJson(raw,8*1024**2) as Preparation;
 nativeObject(p,["contract","source","tree","architecture","lockSha256","snapshot","baseInstalledStatus","inventory","tarballs","metadata","origins","downloads"]);
 requireInput(p.contract==="NALANDA_OFFLINE_MATERIAL_SOURCE_V1"&&p.source===d.source&&p.tree===d.tree&&p.architecture===d.architecture&&p.lockSha256===d.files.find(f=>f.path==="pnpm-lock.yaml")?.sha256&&HEX.test(p.baseInstalledStatus)&&HEX.test(p.inventory)&&/^20[0-9]{6}T[0-9]{6}Z$/.test(p.snapshot),"MATERIAL_PREPARATION_SUBJECT");
 requireInput(Array.isArray(p.downloads)&&p.downloads.length>0&&p.downloads.length<=30000,"MATERIAL_DOWNLOAD_COVERAGE");let total=0;const urls=new Set<string>();
 for(const e of p.downloads){nativeObject(e,["url","sha256","bytes"]);materialDownloadURL(e.url);requireInput(HEX.test(e.sha256)&&Number.isSafeInteger(e.bytes)&&e.bytes>0&&e.bytes<=64*1024**2&&!urls.has(e.url),"MATERIAL_DOWNLOAD_INVALID");urls.add(e.url);total+=e.bytes;}
 requireInput(total<=2*1024**3,"MATERIAL_DOWNLOAD_BOUND");return p;
}

export function verifyPreparation(raw:Buffer,expected:string,d:InputDocument,read:BlobReader){
 const p=preparationHeader(raw,expected,d),lock=lockedPackages(checkedBlob(read,p.lockSha256));
 checkedBlob(read,p.baseInstalledStatus);const inventory=boundedJson(checkedBlob(read,p.inventory));
 requireInput(inventory.snapshot===p.snapshot,"MATERIAL_SNAPSHOT_MISMATCH");
 const downloads=new Map(p.downloads.map(e=>[e.url,e]));
 for(const e of p.downloads)requireInput(checkedBlob(read,e.sha256).length===e.bytes,"MATERIAL_DOWNLOAD_SIZE");
 requireInput(Array.isArray(p.tarballs)&&p.tarballs.length===lock.length&&Array.isArray(p.metadata),"MATERIAL_LOCK_COVERAGE");
 const byURL=new Map(p.tarballs.map(t=>[t.url,t]));requireInput(byURL.size===p.tarballs.length,"MATERIAL_LOCK_DUPLICATE");
 for(const e of lock){const t=byURL.get(e.url);requireInput(t,"MATERIAL_LOCK_TARBALL_MISSING");nativeObject(t,["url","sha256","bytes","integrity"]);requireInput(t.integrity===e.integrity&&sameDownload(downloads.get(t.url),t)&&"sha512-"+createHash("sha512").update(checkedBlob(read,t.sha256)).digest("base64")===e.integrity,"MATERIAL_LOCK_INTEGRITY_MISMATCH");}
 const names=new Set(lock.filter(e=>e.registry).map(e=>e.name));requireInput(p.metadata.length===names.size,"MATERIAL_REGISTRY_METADATA_COVERAGE");
 for(const m of p.metadata){nativeObject(m,["url","sha256","bytes"]);const name=m.url.slice("https://registry.npmjs.org/".length);requireInput(m.url==="https://registry.npmjs.org/"+name&&names.delete(name)&&sameDownload(downloads.get(m.url),m),"MATERIAL_REGISTRY_METADATA_COVERAGE");const meta=boundedJson(checkedBlob(read,m.sha256),64*1024**2);requireInput(meta.name===name,"MATERIAL_REGISTRY_METADATA_SUBJECT");for(const e of lock.filter(e=>e.name===name)){const v=meta.versions?.[e.version];requireInput(v?.name===name&&v.version===e.version&&v.dist?.integrity===e.integrity&&v.dist?.tarball===e.url&&Number.isFinite(Date.parse(meta.time?.[e.version])),"MATERIAL_REGISTRY_METADATA_SUBJECT");}}
 const revision=checkedBlob(read,p.lockSha256).toString().match(/'@prisma\/engines-version@[0-9][^']*\.([a-f0-9]{40})':/g);requireInput(revision&&new Set(revision).size===1,"MATERIAL_ENGINE_REVISION");const engineRevision=revision[0].match(/\.([a-f0-9]{40})':/)![1];
 requireInput(Array.isArray(p.origins)&&p.origins.length>=5&&p.origins.length<=1000,"MATERIAL_NATIVE_ORIGIN_COVERAGE");const paths=new Set<string>(),roles=new Set<string>();
 for(const o of p.origins){nativeObject(o,["path","role","sha256","archiveSha256","url","member","format","checksum"]);safeRelative(o.path);requireInput(!paths.has(o.path)&&HEX.test(o.sha256)&&HEX.test(o.archiveSha256)&&["query","schema","esbuild","sharp","libvips"].includes(o.role),"MATERIAL_NATIVE_ORIGIN_INVALID");paths.add(o.path);roles.add(o.role);const download=downloads.get(o.url);requireInput(download?.sha256===o.archiveSha256,"MATERIAL_NATIVE_ORIGIN_DOWNLOAD");
  if(o.role==="query"||o.role==="schema"){const platform=d.architecture==="amd64"?"debian-openssl-3.0.x":"linux-arm64-openssl-3.0.x",filename=o.role==="query"?"libquery_engine.so.node":"schema-engine";requireInput(o.format==="gzip"&&o.member===""&&(o.path==="opt/nalanda-engines/"+(o.role==="query"?"query-engine.node":"schema-engine")||o.path.startsWith("app/node_modules/"))&&o.url===`https://binaries.prisma.sh/all_commits/${engineRevision}/${platform}/${filename}.gz`,"MATERIAL_ENGINE_ORIGIN");const checksum=downloads.get(o.url+'.sha256');requireInput(o.checksum&&checksum?.sha256===o.checksum&&checkedBlob(read,o.checksum,4096).toString().trim().split(/\s+/)[0]===o.archiveSha256,"MATERIAL_ENGINE_SUPPLIER_CHECKSUM_UNPROVEN");const native=gunzipSync(checkedBlob(read,o.archiveSha256),{maxOutputLength:256*1024**2});requireInput(hashBytes(native)===o.sha256&&hashBytes(checkedBlob(read,o.sha256,256*1024**2))===o.sha256,"MATERIAL_ENGINE_ARCHIVE_ASSOCIATION");}
  else {safeRelative(o.member);const pkg=lock.find(t=>t.url===o.url),arch=d.architecture==="amd64"?"x64":"arm64",expectedName=o.role==="esbuild"?"@esbuild/linux-"+arch:o.role==="sharp"?"@img/sharp-linux-"+arch:"@img/sharp-libvips-linux-"+arch;requireInput(o.checksum===null&&o.format==="tar"&&o.member.startsWith("package/")&&o.path.startsWith("app/node_modules/")&&pkg?.name===expectedName&&p.tarballs.some(t=>t.url===o.url&&t.sha256===o.archiveSha256),"MATERIAL_NATIVE_ARCHIVE_ASSOCIATION");}
 }
 requireInput(["query","schema","esbuild","sharp","libvips"].every(r=>roles.has(r)),"MATERIAL_NATIVE_ORIGIN_COVERAGE");
 const required=new Set([...p.tarballs,...p.metadata].map(x=>x.url));for(const o of p.origins){required.add(o.url);if(o.checksum)required.add(o.url+'.sha256');}
 // Debian signature/Release association is established by the qualified gpgv
 // process and offline verifier before installation. Bind every original to its
 // immutable snapshot URL here; no moving package endpoint is accepted.
 for(const release of inventory.aptReleaseFiles){for(const [field,suffix] of [["inRelease","InRelease"],["packages",release.path]] as const){const match=p.downloads.filter(e=>e.sha256===release[field]);requireInput(match.length===1&&match[0].url.startsWith(`https://snapshot.debian.org/archive/`)&&match[0].url.includes('/'+p.snapshot+'/dists/')&&match[0].url.endsWith('/'+suffix),"MATERIAL_DEBIAN_SOURCE");required.add(match[0].url);}}
 for(const deb of inventory.packages){const match=p.downloads.filter(e=>e.sha256===deb.sha256);requireInput(match.length===1&&match[0].url.startsWith('https://snapshot.debian.org/archive/')&&match[0].url.includes('/'+p.snapshot+'/')&&match[0].url.endsWith('/'+deb.filename),"MATERIAL_DEBIAN_SOURCE");required.add(match[0].url);}
 requireInput(p.downloads.every(x=>required.has(x.url)),"MATERIAL_UNDECLARED_DOWNLOAD");
 return p;
}

/** Run only after authenticated grant/header checks and its one-use claim.
 * Fetch never executes downloaded code and cannot follow redirects. */
export async function downloadPreparation(p:Preparation,directory:string,guard:()=>void){
 mkdirSync(directory,{mode:0o700});mkdirSync(path.join(directory,"blobs"),{mode:0o700});const receipts=[];
 for(const e of p.downloads){guard();const free=statfsSync(directory);requireInput(free.bavail*free.bsize>=e.bytes+64*1024**2,"MATERIAL_DISK_CAPACITY_MISSING");const raw=await downloadMaterialBytes(e.url,e.sha256,e.bytes);guard();const file=path.join(directory,"blobs",e.sha256);if(!existsSync(file))writeFileSync(file,raw,{flag:"wx",mode:0o600});receipts.push({...e,receivedAt:new Date().toISOString()});
  writeFileSync(path.join(directory,"receipts.json"),JSON.stringify(receipts),{mode:0o600});
 }for(const o of p.origins)if(o.format==='gzip'){const raw=gunzipSync(checkedBlob(id=>readFileSync(path.join(directory,'blobs',id)),o.archiveSha256),{maxOutputLength:256*1024**2});requireInput(hashBytes(raw)===o.sha256,"MATERIAL_ENGINE_ARCHIVE_ASSOCIATION");const file=path.join(directory,'blobs',o.sha256);if(!existsSync(file))writeFileSync(file,raw,{flag:'wx',mode:0o600});}guard();return receipts;
}
