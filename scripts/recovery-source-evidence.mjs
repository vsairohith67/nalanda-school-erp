import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, lstatSync } from 'node:fs';
import { createHash } from 'node:crypto';
const base = '104aacc7bd314cae82e60bb02b5c8a965c7ffedd';
const heads = ['5bf70e4c4be07b706224debe01a27c54fd0af096','67c504be6230f763663cf19faf50d9bc46dc6902','d784262ccc78ae431a72a3934ced45198e4bfb4c','283718fb5bedbc505302e55d7bc5214d8fa4d553'];
const ledgerPath = 'config/recovery-integration-source-delta.json';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore','pipe','pipe'] });
const hash = value => createHash('sha256').update(value.replaceAll('\r\n','\n')).digest('hex');
const sourceCaches=new Map();
const blob=(head,path)=>{
 if(!sourceCaches.has(head)){
  if(git('cat-file','-t',head).trim()!=='commit')throw Error('RECOVERY_SOURCE_COMMIT_UNAVAILABLE:'+head);
  const entries=git('ls-tree','-r','-z',head).split('\0').filter(Boolean).map(row=>{const tab=row.indexOf('\t');return {path:row.slice(tab+1),id:row.slice(0,tab).split(' ')[2]};}).filter(row=>protectedPath(row.path));
  const cache=new Map();
  for(let offset=0;offset<entries.length;offset+=100){
   const batch=entries.slice(offset,offset+100);
   const output=execFileSync('git',['cat-file','--batch'],{input:batch.map(e=>e.id).join('\n')+'\n',maxBuffer:128*1024*1024});
   let position=0;
   for(const entry of batch){const end=output.indexOf(10,position),header=output.subarray(position,end).toString().split(' ');if(header[1]!=='blob')throw Error('RECOVERY_SOURCE_BLOB_REQUIRED');const length=Number(header[2]);position=end+1;cache.set(entry.path,hash(output.subarray(position,position+length).toString('utf8')));position+=length+1;}
  }
  sourceCaches.set(head,cache);
 }
 return sourceCaches.get(head).get(path)??null;
};
const protectedPath = p => /^(app|components|prisma|deploy|lib|scripts|\.github\/workflows)\//.test(p) || ['config/release-feature-flags.json','Dockerfile','package.json','pnpm-lock.yaml','pnpm-workspace.yaml','middleware.ts','next.config.ts'].includes(p);
const files = [...new Set(git('ls-files','--cached','--others','--exclude-standard').trim().split(/\r?\n/))].filter(protectedPath).sort();
if (process.argv[2] === '--write') {
  const historical = JSON.parse(readFileSync('config/master-requirements-audit-evidence.json','utf8'));
  const records = [];
  for (const path of files) {
    const currentSha256 = hash(readFileSync(path,'utf8'));
    const baseSha256 = blob(base,path);
    if (currentSha256 === baseSha256) continue;
    const sources = heads.map(head => ({ head, sha256: blob(head,path) }));
    const historicalSha256 = historical.inventory.find(f => f.path === path)?.sha256 ?? null;
    records.push({ path, baseSha256, historicalSha256, sources, currentSha256,
      reconciliation: sources.some(s => s.sha256 === currentSha256) ? 'ADMITTED_COMMITTED_SOURCE' : 'RECOVERY_RECONCILIATION_REQUIRES_INDEPENDENT_REVIEW' });
  }
  writeFileSync(ledgerPath, JSON.stringify({ version:1, date:'2026-09-12', base, heads, files:records },null,2)+'\n');
  console.log(JSON.stringify({status:'GENERATED_NOT_REVIEW_CLEARANCE',files:records.length}));
} else {
  const ledger = JSON.parse(readFileSync(ledgerPath,'utf8'));
  if (ledger.base !== base || JSON.stringify(ledger.heads) !== JSON.stringify(heads)) throw Error('RECOVERY_SOURCE_HEADS_MISMATCH');
  const entries = new Map(ledger.files.map(f=>[f.path,f]));
  if (entries.size !== ledger.files.length) throw Error('RECOVERY_SOURCE_DUPLICATE');
  for (const path of files) {
    if (!existsSync(path) || !lstatSync(path).isFile() || lstatSync(path).isSymbolicLink()) throw Error('RECOVERY_SOURCE_UNSAFE:'+path);
    const baseline = blob(base,path), current = hash(readFileSync(path,'utf8')), entry=entries.get(path);
    if (current !== baseline && (!entry || entry.currentSha256 !== current || entry.baseSha256 !== baseline)) throw Error('RECOVERY_SOURCE_DRIFT:'+path);
    if (entry) for (const source of entry.sources) if (!heads.includes(source.head) || blob(source.head,path) !== source.sha256) throw Error('RECOVERY_SOURCE_PROVENANCE:'+path);
  }
  for (const path of entries.keys()) if (!files.includes(path)) throw Error('RECOVERY_SOURCE_MISSING:'+path);
  const contracts=JSON.parse(readFileSync('config/recovery-source-contracts.json','utf8'));
  for(const [version,source] of Object.entries(contracts.sources)) {
    const read=p=>version==='48'?readFileSync(p,'utf8'):git('show',`${source.sourceHead}:${p}`);
    for(const provider of ['sqlite','postgresql']) if(hash(read(provider==='sqlite'?'prisma/schema.prisma':'prisma/postgresql/schema.prisma'))!==source.schemaFingerprint[provider]) throw Error('BACKUP_SOURCE_SCHEMA_DRIFT:'+version+':'+provider);
    for(const migration of source.migrations) if(hash(read(migration.path))!==migration.sha256)throw Error('BACKUP_MIGRATION_DRIFT:'+version+':'+migration.path);
  }
  console.log(JSON.stringify({status:'PASS',files:ledger.files.length,sourceHeads:heads.length,backupSourceContracts:4}));
}
