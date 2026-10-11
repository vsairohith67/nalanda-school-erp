// Explicit test command takes already verified pnpm and OpenSSL paths. No fetch,
// global CA/hosts/firewall/config edits. Synthetic TLS key exists only in temp.
import {replayServer,processReceipt} from '../scripts/portable/material-replay.mjs';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync,spawn} from 'node:child_process';
import {request} from 'node:https';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';

const [pnpm,openssl]=process.argv.slice(2);assert(pnpm&&openssl,'verified local pnpm and OpenSSL paths required');
assert.equal(createHash('sha256').update(readFileSync(path.resolve(pnpm,'../../../../pnpm-11.21.0.tgz'))).digest('hex'),'87237d37eadb79dc626a0576eb3a52d23d70422c323ae5e00fc05c91f4323780');
const root=mkdtempSync(path.join(os.tmpdir(),'NPS-HARNESS_ONLY-replay-')),hash=b=>createHash('sha256').update(b).digest('hex');let server;let assertions=0;
try{
 const key=path.join(root,'key.pem'),cert=path.join(root,'cert.pem');execFileSync(openssl,['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=HARNESS_ONLY','-addext','subjectAltName=DNS:registry.npmjs.org,DNS:cdn.sheetjs.com'],{windowsHide:true,stdio:'ignore',env:{...process.env,MSYS_NO_PATHCONV:'1'}});
 const name='@fixture/scoped',version='1.0.0',url='https://registry.npmjs.org/@fixture/scoped/-/scoped-1.0.0.tgz';
 // Tiny tar written directly; no package installation, archive tools or hooks.
 const payload=Buffer.from(JSON.stringify({name,version,main:'index.js'})),parts=[];
 for(const [file,data] of [['package/package.json',payload],['package/index.js',Buffer.from('module.exports=42;')]]){const h=Buffer.alloc(512);h.write(file);h.write('0000644\0',100);h.write('0000000\0',108);h.write('0000000\0',116);h.write(data.length.toString(8).padStart(11,'0')+'\0',124);h.write('00000000000\0',136);h.fill(32,148,156);h[156]=48;h.write('ustar\0',257);h.write('00',263);h.write(h.reduce((a,b)=>a+b,0).toString(8).padStart(6,'0')+'\0 ',148);parts.push(h,data,Buffer.alloc((512-data.length%512)%512));}
 const archive=Buffer.concat([...parts,Buffer.alloc(1024)]),integrity='sha512-'+createHash('sha512').update(archive).digest('base64'),metadata=Buffer.from(JSON.stringify({name,'dist-tags':{latest:version},versions:{[version]:{name,version,dist:{tarball:url,integrity}}},time:{[version]:'2026-01-01T00:00:00.000Z'}}));
 const blobs=new Map([[hash(archive),archive],[hash(metadata),metadata]]),entries=[{url,sha256:hash(archive),bytes:archive.length},{url:'https://registry.npmjs.org/'+name,sha256:hash(metadata),bytes:metadata.length}];
 server=await replayServer(entries,id=>blobs.get(id),{key:readFileSync(key),cert:readFileSync(cert)},0);
 const query=(route,method='GET',host='registry.npmjs.org')=>new Promise((resolve,reject)=>{const r=request({host:'127.0.0.1',port:server.port,servername:'registry.npmjs.org',ca:readFileSync(cert),path:route,method,headers:{Host:host}},res=>{const chunks=[];res.on('data',b=>chunks.push(b));res.on('end',()=>resolve({code:res.statusCode,body:Buffer.concat(chunks)}));});r.on('error',reject);r.end();});
 for(const route of ['/@fixture/scoped','/@fixture%2fscoped','/@fixture%2Fscoped']){assert.equal((await query(route)).code,200);assertions++;}
 for(const [route,method,host] of [['/missing','GET','registry.npmjs.org'],['/@fixture/scoped','POST','registry.npmjs.org'],['/@fixture/scoped','GET','169.254.169.254']]){assert.equal((await query(route,method,host)).code,403);assertions++;}
 blobs.set(hash(archive),Buffer.from('substituted'));assert.equal((await query('/@fixture/scoped/-/scoped-1.0.0.tgz')).code,403);assertions++;blobs.set(hash(archive),archive);
 await server.close();server=await replayServer(entries,id=>blobs.get(id),{key:readFileSync(key),cert:readFileSync(cert)},0);
 const work=path.join(root,'work');mkdirSync(work);for(const d of ['home','store','cache'])mkdirSync(path.join(root,d));
 writeFileSync(path.join(work,'package.json'),JSON.stringify({name:'HARNESS_ONLY',private:true,dependencies:{[name]:version}}));writeFileSync(path.join(work,'pnpm-workspace.yaml'),'packages: []\nminimumReleaseAge: 0\n');
 writeFileSync(path.join(work,'pnpm-lock.yaml'),`lockfileVersion: '9.0'\nsettings:\n  autoInstallPeers: true\n  excludeLinksFromLockfile: false\nimporters:\n  .:\n    dependencies:\n      '${name}':\n        specifier: ${version}\n        version: ${version}\npackages:\n  '${name}@${version}':\n    resolution: {integrity: ${integrity}}\nsnapshots:\n  '${name}@${version}': {}\n`);
 // Explicit HARNESS transport: only this child maps these two names to the
 // owned loopback listener. Every other DNS/TLS target fails. Production has
 // no hook: it uses Linux network=none plus source-bound BuildKit add-hosts.
 const hook=path.join(root,'HARNESS_ONLY_transport.cjs');writeFileSync(hook,`const dns=require('node:dns'),tls=require('node:tls');const allowed=h=>['registry.npmjs.org','cdn.sheetjs.com'].includes(h);dns.lookup=(h,o,cb)=>{if(typeof o==='function'){cb=o;o={};}if(!allowed(h))return cb(Error('HARNESS_DNS_DENIED'));cb(null,o?.all?[{address:'127.0.0.1',family:4}]:'127.0.0.1',4);};const original=tls.connect;tls.connect=function(o,...a){if(!allowed(o.servername||o.host))throw Error('HARNESS_TLS_DENIED');return original.call(this,{...o,port:${server.port}},...a);};`);
 const env={...process.env,HOME:path.join(root,'home'),USERPROFILE:path.join(root,'home'),CI:'true',NODE_OPTIONS:'--require="'+hook.replaceAll('\\','/')+'"',NODE_EXTRA_CA_CERTS:cert,COREPACK_ENABLE_NETWORK:'0'};
 const run=args=>new Promise((resolve,reject)=>{let output='';const child=spawn(process.execPath,[pnpm,...args],{cwd:work,env,windowsHide:true,stdio:['ignore','pipe','pipe']});const t=setTimeout(()=>child.kill(),30000);for(const s of [child.stdout,child.stderr])s.on('data',b=>{output+=b.toString();if(output.length>100000)child.kill();});child.on('error',reject);child.on('close',code=>{clearTimeout(t);code===0?resolve(output):reject(Error('HARNESS_PNPM_FAILED '+code+' '+output));});});
 const dirs=['--store-dir='+path.join(root,'store'),'--cache-dir='+path.join(root,'cache')];
 await run(['fetch','--frozen-lockfile','--ignore-scripts','--ignore-pnpmfile','--fetch-retries=0','--registry=https://registry.npmjs.org',...dirs]);assert.equal(server.denials(),0);assert(server.requests.some(r=>r.url===url));assertions+=2;
 const requests=server.requests.map(r=>r.url);await server.close();server=undefined;
 await run(['install','--offline','--frozen-lockfile','--ignore-scripts','--ignore-pnpmfile','--verify-store-integrity',...dirs]);await run(['store','status',dirs[0]]);assert.equal(readFileSync(path.join(work,'node_modules/@fixture/scoped/index.js'),'utf8'),'module.exports=42;');assertions++;
 await assert.rejects(processReceipt(process.execPath,['-e','process.exit(7)'],root,env,path.join(root,'failed')));assert.equal(JSON.parse(readFileSync(path.join(root,'failed.json'))).exit,7);assertions++;
 console.log(JSON.stringify({classification:'HARNESS_ONLY',assertions,pinnedPnpm:'11.21.0',fetchReplayRequests:requests,offlineInstall:true,storeStatus:true,realAcquisition:false}));
}finally{if(server)await server.close();rmSync(root,{recursive:true,force:true});}
