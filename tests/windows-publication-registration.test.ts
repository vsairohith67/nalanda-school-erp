import {describe,it,expect} from "vitest";
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,realpathSync} from "node:fs";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {execFileSync,spawnSync} from "node:child_process";

const root=process.cwd(),prefix=path.join(root,"tmp");
const files=["src-tauri/src/qa_observation.rs","src-tauri/src/qa_privacy.js","src/App-lifecycle.test.tsx","src/vault-unlock.test.ts","src/vault-unlock.ts"];
describe.each(["real-user-access-readiness-1a","communication-delivery-foundation-1a"])("actual %s publication CLI",name=>{
 it.each(["reviewed","private-key","unregistered-neighbour","binary"])("preserves scope and content enforcement: %s",kind=>{
  mkdirSync(prefix,{recursive:true});const dir=mkdtempSync(path.join(prefix,"windows-publication-"));
  const script=path.join(root,`scripts/qa-${name}-public-repo-scan.ts`);
  const write=(file:string,value:string)=>{const p=path.join(dir,file);mkdirSync(path.dirname(p),{recursive:true});writeFileSync(p,value);};
  const git=(...args:string[])=>execFileSync("git",args,{cwd:dir,stdio:"pipe"});
  try{
   const source=readFileSync(script,"utf8"),required=source.match(/const required = \[([\s\S]*?)\];/)![1];
   for(const match of required.matchAll(/"([^"]+)"/g))write(match[1],"synthetic required artifact\n");
   git("init","--initial-branch=main");git("add",".");git("-c","user.name=Synthetic QA","-c","user.email=qa@example.com","commit","-m","synthetic publication baseline");git("update-ref","refs/remotes/origin/main","HEAD");
   for(const file of files)write(`apps/nalanda-cross-platform/${file}`,"// reviewed synthetic source\n");
   if(kind==="private-key")write(`apps/nalanda-cross-platform/${files[0]}`,["-----BEGIN ","PRIVATE KEY-----"].join(""));
   if(kind==="unregistered-neighbour")write("apps/nalanda-cross-platform/src/unreviewed.ts","// synthetic unregistered source\n");
   if(kind==="binary")write("apps/nalanda-cross-platform/output.exe","synthetic prohibited package");
   // CI's real repository base does not belong to this isolated Git fixture.
   const result=spawnSync(process.execPath,["--import",pathToFileURL(path.join(root,"node_modules/tsx/dist/loader.mjs")).href,script],{cwd:dir,encoding:"utf8",timeout:10000,env:{...process.env,COMMUNICATION_DIFF_BASE_SHA:git("rev-parse","HEAD").toString().trim()}});
   expect(result.error).toBeUndefined();
   if(kind==="reviewed"){expect(result.status,result.stderr).toBe(0);expect(result.stdout).toContain("PUBLIC_REPO_SCAN_PASSED");}
   else{expect(result.status).not.toBe(0);expect(result.stderr).toContain(kind==="private-key"?":private-key":kind==="binary"?":private-or-binary-artifact":":out-of-scope");}
  }finally{
   const resolved=realpathSync(dir);expect(path.dirname(resolved)).toBe(realpathSync(prefix));expect(path.basename(resolved)).toMatch(/^windows-publication-/);rmSync(resolved,{recursive:true});
  }
 });
});
