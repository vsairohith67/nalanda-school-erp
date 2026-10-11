// Finite, job-local archive replay. No forwarding, publishing or resolution API.
// The production caller verifies index/blob provenance before the network-none RUN.
import https from 'node:https';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,rmSync,lstatSync,readdirSync} from 'node:fs';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {networkInterfaces} from 'node:os';

const hash=b=>createHash('sha256').update(b).digest('hex');
const check=(v,c)=>{if(!v)throw Error(c);};
export async function replayServer(entries,read,tls,port=443){
 check(Array.isArray(entries)&&entries.length>0&&entries.length<=20000,'REPLAY_INDEX_BOUND');
 const routes=new Map();let total=0;
 for(const e of entries){const u=new URL(e.url);check(u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&!u.search&&!u.hash&&['registry.npmjs.org','cdn.sheetjs.com'].includes(u.hostname)&&/^[a-f0-9]{64}$/.test(e.sha256),'REPLAY_ROUTE_INVALID');
  total+=e.bytes;check(Number.isSafeInteger(e.bytes)&&e.bytes>0&&e.bytes<=64*1024*1024&&total<=2*1024**3&&!routes.has(e.url),'REPLAY_BYTES_INVALID');routes.set(e.url,e);
  // pnpm encodes the slash in scoped metadata names. This one alias has the
  // same already-authenticated resource; arbitrary URL normalization is refused.
  if(/^\/@[^/]+\/[^/]+$/.test(u.pathname))for(const slash of ['%2f','%2F']){const alias='https://'+u.host+u.pathname.replace(/\/(?!@)/,slash);check(!routes.has(alias),'REPLAY_ROUTE_CONFLICT');routes.set(alias,e);}
 }
 const requests=[];let denied=0;
 const server=https.createServer(tls,(req,res)=>{const key='https://'+req.headers.host+req.url,found=routes.get(key);
  if(req.method!=='GET'||!found||req.headers.authorization||req.headers.cookie||requests.length>=100000){denied++;res.writeHead(403);res.end();return;}
  try {const bytes=read(found.sha256);check(bytes.length===found.bytes&&hash(bytes)===found.sha256,'REPLAY_BYTES_INVALID');requests.push({url:key,sha256:found.sha256});res.writeHead(200,{'Content-Length':bytes.length,'Content-Type':key.endsWith('.tgz')?'application/octet-stream':'application/json','Cache-Control':'no-store'});res.end(bytes);}catch{denied++;res.writeHead(403);res.end();}
 });
 server.maxConnections=4;server.requestTimeout=30000;server.headersTimeout=10000;server.maxRequestsPerSocket=1000;
 server.on('connect',(_req,socket)=>socket.destroy());server.on('clientError',(_e,socket)=>socket.destroy());
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
 return {port:server.address().port,requests,denials:()=>denied,close:()=>new Promise((resolve,reject)=>{server.closeAllConnections();server.close(e=>e?reject(e):resolve());})};
}

export async function processReceipt(tool,args,cwd,env,destination){
 let child,stdout=Buffer.alloc(0),stderr=Buffer.alloc(0),timedOut=false,killFailed=false;
 const result=await new Promise((resolve,reject)=>{child=spawn(tool,args,{cwd,env,stdio:['ignore','pipe','pipe'],windowsHide:true,detached:process.platform==='linux'});
  // Same owned-group reconciliation as captureProductProcess. The production
  // entrypoint is Linux-only; a failed Windows harness cannot attest teardown.
  const send=()=>{try{if(process.platform==='linux'&&child.pid)process.kill(-child.pid,'SIGKILL');else child.kill('SIGKILL');}catch(e){if(e.code!=='ESRCH')killFailed=true;}};
  const timer=setTimeout(()=>{timedOut=true;send();},300000);
  const add=(name,b)=>{if(stdout.length+stderr.length+b.length>64*1024*1024){timedOut=true;send();return;}if(name==='stdout')stdout=Buffer.concat([stdout,b]);else stderr=Buffer.concat([stderr,b]);};
  child.stdout.on('data',b=>add('stdout',b));child.stderr.on('data',b=>add('stderr',b));child.once('error',e=>{clearTimeout(timer);reject(e);});child.once('close',async(exit,signal)=>{clearTimeout(timer);if(process.platform==='linux'&&child.pid){send();await new Promise(r=>setTimeout(r,30));try{for(const id of readdirSync('/proc'))if(/^\d+$/.test(id)){try{const f=readFileSync('/proc/'+id+'/stat','utf8').split(') ')[1].split(' ');if(Number(f[2])===child.pid&&f[0]!=='Z')killFailed=true;}catch(e){if(e.code!=='ENOENT')killFailed=true;}}}catch{killFailed=true;}}resolve({exit,signal,timedOut,settled:!killFailed&&!(process.platform==='win32'&&timedOut)});});
 });
 writeFileSync(destination+'.stdout',stdout,{flag:'wx',mode:0o600});writeFileSync(destination+'.stderr',stderr,{flag:'wx',mode:0o600});
 const receipt={...result,stdout:hash(stdout),stderr:hash(stderr)};writeFileSync(destination+'.json',JSON.stringify(receipt),{flag:'wx',mode:0o600});check(result.exit===0&&!result.signal&&!result.timedOut&&result.settled,'MATERIAL_PREPARATION_PROCESS_FAILED');return receipt;
}

export async function prepare(root){
 check(process.platform==='linux'&&root==='/opt/nalanda-materials','REPLAY_HOST_OR_ROOT');
 check(Object.values(networkInterfaces()).flat().every(i=>i.internal),'MATERIAL_NETWORK_NOT_ISOLATED');
 const read=id=>{check(/^[a-f0-9]{64}$/.test(id),'REPLAY_BLOB_NAME');const f=path.join(root,'blobs',id),s=lstatSync(f);check(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1,'REPLAY_BLOB_UNSAFE');return readFileSync(f);};
 const entries=JSON.parse(readFileSync(path.join(root,'replay-index.json'),'utf8'));
 const receipts=path.join(root,'receipts');mkdirSync(receipts,{mode:0o700});
 const certRoot=path.join(root,'temporary-tls');mkdirSync(certRoot,{mode:0o700});
 const lock=readFileSync('/app/pnpm-lock.yaml'),workspace=readFileSync('/app/pnpm-workspace.yaml');
 const env={PATH:'/usr/local/bin:/usr/bin:/bin',HOME:'/tmp/nalanda-material-home',CI:'true',PNPM_HOME:'/pnpm',COREPACK_ENABLE_NETWORK:'0'};
 let server;
 try {
  await processReceipt('/usr/bin/openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',path.join(certRoot,'key.pem'),'-out',path.join(certRoot,'cert.pem'),'-days','1','-subj','/CN=Nalanda isolated material replay','-addext','subjectAltName=DNS:registry.npmjs.org,DNS:cdn.sheetjs.com'],root,env,path.join(receipts,'temporary-tls'));
  server=await replayServer(entries,read,{key:readFileSync(path.join(certRoot,'key.pem')),cert:readFileSync(path.join(certRoot,'cert.pem'))});
  await processReceipt('/usr/local/bin/node',['/opt/pnpm/bin/pnpm.cjs','fetch','--frozen-lockfile','--ignore-scripts','--ignore-pnpmfile','--store-dir=/pnpm/store','--cache-dir=/pnpm/cache','--fetch-retries=0','--registry=https://registry.npmjs.org'], '/app',{...env,NODE_EXTRA_CA_CERTS:path.join(certRoot,'cert.pem')},path.join(receipts,'fetch'));
  check(server.denials()===0,'REPLAY_UNDECLARED_REQUEST');
  writeFileSync(path.join(receipts,'replay.json'),JSON.stringify({requests:server.requests,denied:server.denials()}),{flag:'wx',mode:0o600});
 } finally {if(server)await server.close();rmSync(certRoot,{recursive:true,force:true});}
 check(hash(readFileSync('/app/pnpm-lock.yaml'))===hash(lock)&&hash(readFileSync('/app/pnpm-workspace.yaml'))===hash(workspace),'MATERIAL_LOCK_OR_WORKSPACE_CHANGED');
 const native={...env,PRISMA_QUERY_ENGINE_LIBRARY:'/opt/nalanda-engines/query-engine.node',PRISMA_SCHEMA_ENGINE_BINARY:'/opt/nalanda-engines/schema-engine'};
 await processReceipt('/usr/local/bin/node',['/opt/pnpm/bin/pnpm.cjs','install','--offline','--frozen-lockfile','--verify-store-integrity','--ignore-pnpmfile','--store-dir=/pnpm/store','--cache-dir=/pnpm/cache'], '/app',native,path.join(receipts,'install'));
 await processReceipt('/usr/local/bin/node',['/opt/pnpm/bin/pnpm.cjs','store','status','--store-dir=/pnpm/store'], '/app',native,path.join(receipts,'store'));
 check(hash(readFileSync('/app/pnpm-lock.yaml'))===hash(lock)&&hash(readFileSync('/app/pnpm-workspace.yaml'))===hash(workspace),'MATERIAL_LOCK_OR_WORKSPACE_CHANGED');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){check(process.argv.length===3,'REPLAY_ARGUMENTS');prepare(process.argv[2]).catch(()=>{console.error('MATERIAL_OFFLINE_PREPARATION_REFUSED');process.exitCode=1;});}
