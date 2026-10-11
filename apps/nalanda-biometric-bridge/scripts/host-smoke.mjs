import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, existsSync, lstatSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const [dotnet,dllArgument]=process.argv.slice(2);
if(!dotnet||!dllArgument||process.platform!=='win32')throw new Error('Windows dotnet and compiled DLL required');
const dll=path.resolve(dllArgument);
const dir=mkdtempSync(path.join(tmpdir(),'Nalanda companion synthetic '));
const children=new Set();
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function start(args){const p=spawn(dotnet,[dll,...args],{cwd:dir,windowsHide:true,stdio:['pipe','pipe','pipe'],env:{...process.env,DOTNET_CLI_TELEMETRY_OPTOUT:'1',DOTNET_GENERATE_ASPNET_CERTIFICATE:'false'}});children.add(p);p.output='';p.stdout.on('data',b=>p.output+=b);p.stderr.on('data',b=>p.output+=b);p.done=new Promise(r=>p.once('exit',code=>{children.delete(p);r(code);}));return p;}
async function ready(p,occurrences=1){const deadline=Date.now()+20000;while(Date.now()<deadline){if(p.output.split('HOST_CHILD_READY').length-1>=occurrences)return;if(p.exitCode!==null)throw new Error(p.output);await delay(50);}throw new Error('Host startup timed out');}
async function exit(p){return Promise.race([p.done,delay(20000).then(()=>{throw new Error('Owned process stop timed out')})]);}
function workers(){const raw=execFileSync('powershell.exe',['-NoProfile','-Command',`Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -eq '${process.execPath.replaceAll("'","''")}' -and $_.CommandLine -like '*${dir.replaceAll("'","''")}*' } | Select-Object -ExpandProperty ProcessId | ConvertTo-Json -Compress`],{encoding:'utf8',windowsHide:true}).trim();if(!raw)return [];const ids=JSON.parse(raw);return Array.isArray(ids)?ids:[ids];}
async function noChildren(){for(let i=0;i<30;i++){if(workers().length===0)return;await delay(100);}throw new Error('Orphaned task child');}
mkdirSync(path.join(dir,'private'));mkdirSync(path.join(dir,'data'));
const config=path.join(dir,'bridge.json'),hostConfig=path.join(dir,'host.json'),secret=path.join(dir,'private','secrets.dpapi'),agent=path.join(root,'dist','agent.js');
writeFileSync(config,JSON.stringify({bridgeId:'00000000-0000-4000-8000-000000000001',erpUrl:'https://erp.example.invalid',privateKeyPath:'private/unused.jwk',queuePath:'data/queue.enc',healthPath:'data/health.json',pollIntervalMs:60000,transportEnabled:false,syntheticOnly:true,devices:[{deviceId:'00000000-0000-4000-8000-000000000002',host:'127.0.0.1',port:1,profile:'SIMULATOR'}]}));
const hash=f=>createHash('sha256').update(readFileSync(f)).digest('hex');
// An absolute noncanonical spelling must be normalized before queue containment checks.
const configSpelling=dir+path.sep+'private'+path.sep+'..'+path.sep+'bridge.json';
writeFileSync(hostConfig,JSON.stringify({serviceName:'NalandaBiometricSynthetic',nodeExe:process.execPath,agentPath:agent,bridgeConfig:configSpelling,secretPath:secret,workingDirectory:path.dirname(agent),nodeSha256:hash(process.execPath),agentSha256:hash(agent),startupMs:10000,stopMs:3000,maxRestarts:2}));
try{
  const provision=start(['--provision',secret]);provision.stdin.end(JSON.stringify({queueKey:randomBytes(32).toString('base64url'),keyVersion:1})+'\n');assert.equal(await exit(provision),0);assert(!readFileSync(secret).includes(Buffer.from('queueKey')));
  const replacement=start(['--provision',secret]);replacement.stdin.end('{}\n');assert.equal(await exit(replacement),1);
  const p=start(['--console',hostConfig]);await ready(p);assert.equal(workers().length,1);
  const duplicate=start(['--console',hostConfig]);duplicate.stdin.end();assert.equal(await exit(duplicate),1);
  assert.equal(workers().length,1);
  process.kill(workers()[0]);await ready(p,2);assert.equal(workers().length,1);
  p.stdin.end('STOP\n');assert.equal(await exit(p),0);await noChildren();
  assert.equal(JSON.parse(readFileSync(config)).pollIntervalMs,60000);
  const q=readFileSync(path.join(dir,'data','queue.enc'));const restarted=start(['--console',hostConfig]);await ready(restarted);restarted.stdin.end('STOP\n');assert.equal(await exit(restarted),0);await noChildren();assert(readFileSync(path.join(dir,'data','queue.enc')).length>=q.length);
  const crash=start(['--console',hostConfig]);await ready(crash);crash.kill();await exit(crash);await noChildren();
  const damaged=readFileSync(secret);writeFileSync(secret,Buffer.from('wrong DPAPI data'));const wrong=start(['--console',hostConfig]);assert.equal(await exit(wrong),1);await noChildren();writeFileSync(secret,damaged);
  console.log(JSON.stringify({result:'PASS',category:'WINDOWS_CONSOLE_NOT_SCM',tests:['DPAPI-machine-scope-same-identity','no-secret-replacement','duplicate-host-denied','single-owned-child','child-crash-restart','graceful-stop-during-60s-wait','queue-restart','host-crash-job-cleanup','wrong-DPAPI-fails-closed'],syntheticDirectory:dir}));
}finally{
  const hosts=[...children];for(const p of hosts)p.kill();await Promise.all(hosts.map(exit));await noChildren();
  const target=path.resolve(dir),anchor=path.resolve(tmpdir());
  if(path.dirname(target)!==anchor || !/^Nalanda companion synthetic [A-Za-z0-9]{6}$/.test(path.basename(target)))throw new Error('HOST_FIXTURE_OWNERSHIP_GATE');
  function noLinks(file){const stat=lstatSync(file);if(stat.isSymbolicLink())throw new Error('HOST_FIXTURE_REPARSE_GATE');if(stat.isDirectory())for(const child of readdirSync(file))noLinks(path.join(file,child));}
  noLinks(target);rmSync(target,{recursive:true,force:true});if(existsSync(target))throw new Error('HOST_FIXTURE_CLEANUP_FAILED');
  console.log('CONSOLE_HOST_WORKERS_AND_SYNTHETIC_FIXTURE_CLEANUP_VERIFIED');
}
