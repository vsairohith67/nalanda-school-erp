import test from 'node:test';
import assert from 'node:assert/strict';
import { payloadFor,expectedFor,helperProgram,D3_PAYLOAD_BYTES } from './container-persistence-helper.mjs';
import { createHash, randomUUID } from 'node:crypto';
import vm from 'node:vm';
test('bounded deterministic payload binds run token and host expectation',()=>{
 // Same fresh run-identifier convention as the executed probe. These are
 // future fixture bytes; the retained D3 execution bytes/hash stay unchanged.
 const token=randomUUID().replaceAll('-',''),bytes=payloadFor(token);
 assert.equal(bytes.length,D3_PAYLOAD_BYTES);assert.ok(bytes.subarray(0,64).toString().includes(token));
 assert.equal(expectedFor(token).sha256,createHash('sha256').update(bytes).digest('hex'));
 assert.deepEqual(bytes,payloadFor(token));
 const other=randomUUID().replaceAll('-','');assert.notEqual(token,other);
 assert.notDeepEqual(bytes,payloadFor(other));
});
test('malformed tokens refuse rather than becoming file names or code',()=>{
 for(const token of ['','../foreign','a'.repeat(31),'x'.repeat(32),null])assert.throws(()=>payloadFor(token));
});
test('inline helper parses as a single Node program without shell interpolation',()=>{
 assert.doesNotThrow(()=>new vm.Script(helperProgram()));
});
