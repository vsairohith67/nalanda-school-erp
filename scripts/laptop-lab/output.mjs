import { mkdir,lstat,realpath,open,readFile,readdir,unlink,rmdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { fail } from './config.mjs';
export const ROOT=path.join(path.dirname(fileURLToPath(import.meta.url)),'outputs');
const OWNER='NPS-LAPTOP-LAB-D1P';
const digest=s=>createHash('sha256').update(s).digest('hex');
async function safeAncestors(p){
  for(let cursor=path.resolve(p);;cursor=path.dirname(cursor)){
    const stat=await lstat(cursor);
    if(stat.isSymbolicLink()||!stat.isDirectory()||path.resolve(await realpath(cursor)).toLowerCase()!==cursor.toLowerCase())fail('OUTPUT_LINK_REFUSED');
    if(path.dirname(cursor)===cursor)break;
  }
}
async function writeNew(p,s){const f=await open(p,'wx',0o600);try{await f.writeFile(s);}finally{await f.close();}}
export async function reserveOutput(name){
  if(typeof name!=='string'||!/^[a-z][a-z0-9-]{0,39}$/.test(name)||/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:-|$)/i.test(name))fail('OUTPUT_NAME_INVALID');
  await safeAncestors(path.dirname(ROOT));
  try {await mkdir(ROOT);await writeNew(path.join(ROOT,'.owner'),OWNER);}catch(e){if(e.code!=='EEXIST')throw e;}
  await safeAncestors(ROOT);
  const marker=await lstat(path.join(ROOT,'.owner'));if(!marker.isFile()||marker.isSymbolicLink()||marker.size!==OWNER.length||await readFile(path.join(ROOT,'.owner'),'utf8')!==OWNER)fail('OUTPUT_OWNER_MISMATCH');
  const dir=path.join(ROOT,name);await mkdir(dir);await writeNew(path.join(dir,'.owner'),OWNER);
  return dir;
}
export async function writeReports(dir, report){
  if(path.dirname(dir)!==ROOT)fail('OUTPUT_PATH_INVALID');await safeAncestors(dir);
  const marker=await lstat(path.join(dir,'.owner'));if(!marker.isFile()||marker.isSymbolicLink()||await readFile(path.join(dir,'.owner'),'utf8')!==OWNER)fail('OUTPUT_OWNER_MISMATCH');
  const files={'result.json':report.json,'operations.csv':report.csv,'summary.html':report.html};
  for(const [name,data] of Object.entries(files))await writeNew(path.join(dir,name),data);
  await writeNew(path.join(dir,'manifest.json'),JSON.stringify({owner:OWNER,files:Object.fromEntries(Object.entries(files).map(([n,v])=>[n,digest(v)]))}));
}
// No recursive deletion. Unknown entries, links, changed bytes or foreign owner
// require reconciliation and remain intact. Only a complete owned report is removed.
export async function cleanupOutput(dir){
  if(path.dirname(dir)!==ROOT)fail('OUTPUT_PATH_INVALID');await safeAncestors(dir);
  const names=['.owner','manifest.json','operations.csv','result.json','summary.html'];
  if((await readdir(dir)).sort().join()!==names.sort().join())fail('CLEANUP_FOREIGN_ENTRY');
  for(const name of names){const stat=await lstat(path.join(dir,name));if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size>2**20)fail('CLEANUP_FILE_REFUSED');}
  if(await readFile(path.join(dir,'.owner'),'utf8')!==OWNER)fail('OUTPUT_OWNER_MISMATCH');
  const manifest=JSON.parse(await readFile(path.join(dir,'manifest.json'),'utf8'));
  if(manifest.owner!==OWNER||Object.keys(manifest.files??{}).sort().join()!=='operations.csv,result.json,summary.html')fail('CLEANUP_MANIFEST_INVALID');
  for(const name of ['result.json','operations.csv','summary.html'])if(digest(await readFile(path.join(dir,name)))!==manifest.files[name])fail('CLEANUP_CHANGED_FILE');
  for(const name of names)await unlink(path.join(dir,name));await rmdir(dir);
}
