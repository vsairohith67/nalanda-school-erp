// Fixed, bounded synthetic file helper. No networking or external dependencies.
import { createHash } from 'node:crypto';
export const D3_PAYLOAD_BYTES = 65536;
export function payloadFor(token) {
  if (!/^[a-f0-9]{32}$/.test(token)) throw Error('D3_TOKEN_INVALID');
  const bytes=Buffer.alloc(D3_PAYLOAD_BYTES);
  for(let i=0;i<bytes.length;i++)bytes[i]=(i*17+31)%251;
  Buffer.from(`NPS-D3-SYNTHETIC\nrun=${token}\n`).copy(bytes);
  return bytes;
}
export const expectedFor = token => ({bytes:D3_PAYLOAD_BYTES,sha256:createHash('sha256').update(payloadFor(token)).digest('hex')});

// Passed directly as a node -e argument. No host directory is mounted.
export function helperProgram(){return `
const fs=require('node:fs'),crypto=require('node:crypto');
const token=process.argv[1],phase=process.argv[2];
const check=(ok,code)=>{if(!ok)throw Error(code)};
check(/^[a-f0-9]{32}$/.test(token),'TOKEN_INVALID');
check(['init','writer','reader'].includes(phase),'PHASE_INVALID');
process.umask(0o077);
const root='/lab',p=root+'/payload.bin',m=root+'/manifest.json';
const rootStat=fs.lstatSync(root);check(rootStat.isDirectory()&&!rootStat.isSymbolicLink(),'ROOT_INVALID');
if(phase==='init'){
 check(process.getuid()===0&&fs.readdirSync(root).length===0,'INIT_NOT_EMPTY');
 fs.chmodSync(root,0o700);fs.chownSync(root,65532,65532);
 const stat=fs.statSync(root);check(stat.uid===65532&&stat.gid===65532&&(stat.mode&0o777)===0o700,'INIT_OWNER_INVALID');
 console.log(JSON.stringify({phase,token,uid:stat.uid,gid:stat.gid,mode:stat.mode&0o777}));
}else{
 check(process.getuid()===65532&&process.getgid()===65532&&rootStat.uid===65532&&rootStat.gid===65532,'NONROOT_OWNER_INVALID');
 const expected=Buffer.alloc(65536);for(let i=0;i<expected.length;i++)expected[i]=(i*17+31)%251;
 Buffer.from('NPS-D3-SYNTHETIC\\nrun='+token+'\\n').copy(expected);
 const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
 const write=(file,bytes)=>{const fd=fs.openSync(file,'wx',0o600);try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd)}};
 if(phase==='writer'){
  check(fs.readdirSync(root).length===0,'WRITER_NOT_EMPTY');
  write(p,expected);
  write(m,Buffer.from(JSON.stringify({token,bytes:expected.length,sha256:hash(expected)})));
  const fd=fs.openSync(root,'r');try{fs.fsyncSync(fd)}finally{fs.closeSync(fd)};
 }
 check(fs.readdirSync(root).sort().join(',')==='manifest.json,payload.bin','FILE_SET_INVALID');
 for(const f of [p,m]){const s=fs.lstatSync(f);check(s.isFile()&&!s.isSymbolicLink()&&s.uid===65532&&s.gid===65532&&(s.mode&0o777)===0o600&&s.nlink===1&&s.size<=1048576,'FILE_METADATA_INVALID')}
 const actual=fs.readFileSync(p),manifest=JSON.parse(fs.readFileSync(m,'utf8'));
 check(actual.equals(expected)&&actual.length===65536&&manifest.token===token&&manifest.bytes===actual.length&&manifest.sha256===hash(actual),'CONTENT_INVALID');
 let readOnlyFailure=null;
 if(phase==='reader'){
  const probe=root+'/readonly-probe-'+token;let opened=false;
  try{const fd=fs.openSync(probe,'wx',0o600);opened=true;fs.closeSync(fd)}catch(e){readOnlyFailure=e.code}
  check(!opened&&readOnlyFailure==='EROFS'&&!fs.existsSync(probe),'READONLY_NOT_ENFORCED');
 }
 const stat=fs.statfsSync(root,{bigint:true});
 console.log(JSON.stringify({phase,token,bytes:actual.length,sha256:hash(actual),contentMatches:true,uid:process.getuid(),gid:process.getgid(),payloadMode:fs.statSync(p).mode&0o777,readOnlyFailure,readOnlyProbeAbsent:phase==='reader'?true:null,fsyncExecuted:phase==='writer',filesystem:{type:stat.type.toString(),blockSize:stat.bsize.toString(),blocks:stat.blocks.toString(),availableBlocks:stat.bavail.toString(),availableBytes:(stat.bavail*stat.bsize).toString()}}));
}
`}
