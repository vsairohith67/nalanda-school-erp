import assert from 'node:assert/strict';
import path from 'node:path';
import {readFileSync,lstatSync,mkdirSync,writeFileSync} from 'node:fs';
import {hashBytes} from '../portable/artifact-handoff';
import {canonicalDirectory,profileHash} from './consumer-profile';
import type {ConsumerProfile,ArtifactReceipt} from './consumer-types';
/** Fixed task-owned operands, after admission/authorization and fresh output
 * reservation. The manifest binds bytes; it grants no approval or authority. */
export function stageConsumerInputs(p:ConsumerProfile,r:ArtifactReceipt,root:string,secretNames:string[]){
 const input=path.join(p.consumer.workspace,'tmp/laptop-lab','consumer-'+p.consumer.runId);canonicalDirectory(input);canonicalDirectory(root);
 assert.equal(root,path.join(p.consumer.workspace,'scripts/laptop-lab/outputs',p.consumer.outputName),'CERTIFICATE_INPUT_OUTPUT_MISMATCH');
 const read=(file:string,max:number)=>{const absolute=path.join(input,file);canonicalDirectory(path.dirname(absolute));const s=lstatSync(absolute);assert(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.size>0&&s.size<=max,'CERTIFICATE_INPUT_FILE_UNSAFE');return readFileSync(absolute);};
 const manifest=JSON.parse(read('manifest.json',16384).toString());
 assert.equal(Object.keys(manifest).sort().join(),'consumerRunId,contract,files,imageConfigDigest,producerAttempt,producerRunId,producerSource,profileSha256','CERTIFICATE_OPERAND_MANIFEST_INVALID');
 assert(manifest.contract==='NPS_LAPTOP_OPERANDS_V1'&&manifest.consumerRunId===p.consumer.runId&&manifest.profileSha256===profileHash(p)&&manifest.producerSource===r.source&&manifest.producerRunId===r.runId&&manifest.producerAttempt===p.producer.attempt&&manifest.imageConfigDigest===r.imageConfigDigest,'CERTIFICATE_OPERAND_BINDING_MISMATCH');
 assert(secretNames.every(n=>/^[a-z][a-z0-9_]+$/.test(n)),'CERTIFICATE_INPUT_SECRET_NAME');
 const names=[...new Set(secretNames)].map(n=>'secrets/'+n).concat('fixture-password').sort();
 assert(Array.isArray(manifest.files)&&manifest.files.length===names.length&&manifest.files.map((f:{name:string})=>f.name).sort().join()===names.join(),'CERTIFICATE_INPUT_FILE_SET');
 const bytes=names.map(name=>{const entry=manifest.files.find((f:{name:string})=>f.name===name);assert(Object.keys(entry).sort().join()==='name,sha256,sizeBytes'&&Number.isSafeInteger(entry.sizeBytes)&&entry.sizeBytes>0&&entry.sizeBytes<=16384&&/^[a-f0-9]{64}$/.test(entry.sha256),'CERTIFICATE_INPUT_FILE_RECORD');const b=read(name,16384);assert(b.length===entry.sizeBytes&&hashBytes(b)===entry.sha256,'CERTIFICATE_INPUT_BYTES_MISMATCH');return {name,bytes:b};});
 // Verify the complete bundle before writing any bytes; wx never overwrites.
 mkdirSync(path.join(root,'secrets'),{mode:0o700});
 for(const file of bytes)writeFileSync(path.join(root,file.name),file.bytes,{flag:'wx',mode:0o600});
}
