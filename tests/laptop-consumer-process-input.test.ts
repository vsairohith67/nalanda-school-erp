import {it,expect} from 'vitest';
import {mkdtempSync,readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {captureProductProcess} from '../scripts/portable/producer-process';
const root=()=>mkdtempSync(path.join(process.cwd(),'tmp/laptop-stdin-'));
it('harmless Node child receives bounded private stdin without operand bytes in argv or receipt',async()=>{
 const dir=root(),input=Buffer.from(JSON.stringify({label:'invented synthetic operand'})),pending=new Set<number>();
 const command={stage:'HARNESS_ONLY_STDIN',tool:process.execPath,args:['-e',"let bytes=0;process.stdin.on('data',b=>bytes+=b.length);process.stdin.on('end',()=>process.stdout.write(String(bytes)))"],timeoutMs:5000};
 const receipt=await captureProductProcess(command,dir,1,pending,undefined,{stdin:input});
 expect(receipt.exit).toBe(0);expect(receipt.settled).toBe(true);expect(receipt.ioFailed).toBe(false);expect(pending.size).toBe(0);expect(readFileSync(path.join(dir,'process-1.stdout'),'utf8')).toBe(String(input.length));
 expect(JSON.stringify(command)+readFileSync(path.join(dir,'process-1.json'),'utf8')).not.toContain(input.toString());
});
it.each([0,2049])('refuses invalid private stdin size %s before creating output or child',async size=>{
 const dir=root();await expect(captureProductProcess({stage:'HARNESS_ONLY_STDIN_BOUND',tool:process.execPath,args:['-e','process.exit(99)'],timeoutMs:5000},dir,1,new Set(),undefined,{stdin:Buffer.alloc(size)})).rejects.toThrow('PRODUCT_PROCESS_INPUT_LIMIT_INVALID');expect(readdirSync(dir)).toEqual([]);
});
it('an already-cancelled private input starts no child and records honest interruption',async()=>{
 const dir=root(),controller=new AbortController();controller.abort();
 const receipt=await captureProductProcess({stage:'HARNESS_ONLY_STDIN_CANCELLED',tool:process.execPath,args:['-e','process.exit(99)'],timeoutMs:5000},dir,1,new Set(),controller.signal,{stdin:Buffer.from('synthetic')});
 expect(receipt.interrupted).toBe(true);expect(receipt.exit).toBeNull();expect(receipt.stdoutBytes).toBe(0);expect(receipt.settled).toBe(true);
});

it('expired pre-spawn authorization starts no child after tool hashing',async()=>{
 const dir=root(),pending=new Set<number>();let checks=0,children=0;
 const receipt=await captureProductProcess({stage:'HARNESS_ONLY_DEADLINE',tool:process.execPath,args:['-e','process.exit(99)'],timeoutMs:5000},dir,1,pending,undefined,{beforeSpawn:()=>{checks++;return 0;},onChild:()=>children++});
 expect(checks).toBe(1);expect(children).toBe(0);expect(receipt.startupFailed).toBe(true);expect(receipt.exit).toBeNull();expect(receipt.settled).toBe(true);expect(pending.size).toBe(0);expect(receipt.toolSha256).toMatch(/^[a-f0-9]{64}$/);
});
