import {readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
const source=process.env.EXPECTED_SHA;
if(!/^[a-f0-9]{40}$/.test(source??''))throw Error('EXACT_SOURCE_REQUIRED');
const directories=readdirSync('stack-evidence');
if(directories.length!==2)throw Error('STACK_RECEIPT_COUNT');
for(const architecture of ['amd64','arm64']){
 const name=`portable-stack-result-${source}-${architecture}`;
 if(!directories.includes(name))throw Error('STACK_ARCHITECTURE_MISSING');
 const files=readdirSync(path.join('stack-evidence',name));
 if(files.length!==1||files[0]!=='stack-result.json')throw Error('STACK_RECEIPT_UNEXPECTED_FILES');
 const r=JSON.parse(readFileSync(path.join('stack-evidence',name,files[0]),'utf8').replace(/^\uFEFF/,''));
 if(r.contract!=='NALANDA_SAME_RUNNER_STACK_V1'||r.source!==source||r.architecture!==architecture||r.state!=='PASSED'||r.cleanup!=='VERIFIED'||!/^sha256:[a-f0-9]{64}$/.test(r.imageConfigDigest))throw Error('STACK_RECEIPT_INVALID');
}
console.log('SAME_RUNNER_STACK_METADATA_VERIFIED_NOT_RELEASE_CLEARANCE');
