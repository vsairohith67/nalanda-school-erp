import {it,expect} from 'vitest';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,realpathSync,rmSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
// Same isolated Git-fixture convention as windows-publication-registration.
// Exercise the unchanged complete scanner, including the exact D3 detector.
it.each(['generated-run','literal-collision','private-key','private-binary','real-like-identifier'])('actual onboarding publication CLI preserves %s enforcement',kind=>{
 const root=process.cwd(),prefix=path.join(root,'tmp');mkdirSync(prefix,{recursive:true});const dir=mkdtempSync(path.join(prefix,'lab-publication-'));
 const script=path.join(root,'scripts/qa-real-data-onboarding-preparation-1a-public-repo-scan.ts');
 const write=(file:string,text:string)=>{const p=path.join(dir,file);mkdirSync(path.dirname(p),{recursive:true});writeFileSync(p,text);};
 const git=(...args:string[])=>execFileSync('git',args,{cwd:dir,stdio:'pipe'});
 try{
  const required=readFileSync(script,'utf8').match(/const required = \[([\s\S]*?)\];/)![1];for(const match of required.matchAll(/"([^"]+)"/g))write(match[1],'synthetic required artifact\n');
  git('init','--initial-branch=main');git('add','.');git('-c','user.name=Synthetic QA','-c','user.email=qa@example.com','commit','-m','synthetic publication baseline');git('update-ref','refs/remotes/origin/main','HEAD');
  const syntheticRun=randomUUID().replaceAll('-','');expect(syntheticRun).toMatch(/^[a-f0-9]{32}$/);
  write('scripts/laptop-lab/future-fixture.mjs',"import {randomUUID} from 'node:crypto'; const token=randomUUID().replaceAll('-','');\n");
  if(kind==='literal-collision')write('scripts/laptop-lab/future-fixture.mjs',"const token='SYNTHETIC-ONLY-RUN';\n");
  if(kind==='private-key')write('scripts/laptop-lab/future-fixture.mjs',['-----BEGIN','PRIVATE KEY-----'].join(' '));
  if(kind==='private-binary')write('scripts/laptop-lab/forbidden.db','synthetic prohibited artifact');
  if(kind==='real-like-identifier')write('scripts/laptop-lab/future-fixture.mjs','9'+'1'.repeat(9));
  const result=spawnSync(process.execPath,['--import',pathToFileURL(path.join(root,'node_modules/tsx/dist/loader.mjs')).href,script],{cwd:dir,encoding:'utf8',timeout:10000,env:{...process.env,TSX_DISABLE_CACHE:'1'}});
  expect(result.error).toBeUndefined();if(kind==='generated-run'){expect(result.status,result.stderr).toBe(0);expect(result.stdout).toContain('PUBLIC_REPO_SCAN_PASSED');}
  else{expect(result.status).not.toBe(0);expect(result.stderr).toContain(kind==='private-binary'?'PRIVATE_OR_BINARY_ARTIFACT_REFUSED':kind==='real-like-identifier'?'REAL_LIKE_IDENTIFIER_REFUSED':'SECRET_LIKE_CONTENT_REFUSED');}
 }finally{const resolved=realpathSync(dir);expect(path.dirname(resolved)).toBe(realpathSync(prefix));expect(path.basename(resolved)).toMatch(/^lab-publication-/);rmSync(resolved,{recursive:true});}
});
