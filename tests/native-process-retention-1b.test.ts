import {mkdirSync,mkdtempSync,readdirSync,readFileSync,rmSync,statSync,writeFileSync} from "node:fs";
import os from "node:os";
import path from "node:path";
import {afterAll,expect,it} from "vitest";
import {producerProcess,type ProducerProcessObservation} from "@/scripts/portable/producer-process";
import {processRecorder} from "@/apps/nalanda-cross-platform/tests/native/execute";

// Real child-process outcomes; source qualification, never native app evidence.
const root=mkdtempSync(path.join(os.tmpdir(),"native-retention-1b-"));
afterAll(()=>rmSync(root,{recursive:true,force:true}));
const command=(script:string,timeoutMs=5_000)=>({stage:"native-retention-test",tool:process.execPath,args:["-e",script],timeoutMs});

it("preserves default stdout and opaque failure with no retention files",async()=>{
 expect(await producerProcess(command('process.stdout.write("synthetic-ok");process.stderr.write("synthetic-private")'),root)).toBe("synthetic-ok");
 await expect(producerProcess(command('process.stderr.write("synthetic-private");process.exit(7)'),root)).rejects.toThrow(/^QA_PROCESS_FAILED_OR_CANCELLED$/);
 expect(readdirSync(root)).toEqual([]);
});

it("observes actual failed exit and both exact raw streams before rejecting",async()=>{
 const rows:ProducerProcessObservation[]=[];
 await expect(producerProcess(command('process.stdout.write(Buffer.from([0,255,65]));process.stderr.write("synthetic-private");process.exit(7)'),root,undefined,r=>{rows.push(r);})).rejects.toThrow(/^QA_PROCESS_FAILED_OR_CANCELLED$/);
 expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({stage:"native-retention-test",exit:7,signal:null,timedOut:false,cancelled:false,startupFailed:false,outputLimit:false,closed:true});
 expect([...rows[0].stdout]).toEqual([0,255,65]);expect(rows[0].stderr.toString()).toBe("synthetic-private");
 expect(rows[0].durationMs).toBeGreaterThanOrEqual(0);
});

it("records startup refusal without fabricating a child exit",async()=>{
 const rows:ProducerProcessObservation[]=[];
 await expect(producerProcess({...command(""),tool:path.join(root,"missing-native-tool")},root,undefined,r=>{rows.push(r);})).rejects.toThrow(/^QA_PROCESS_UNAVAILABLE$/);
 expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({exit:null,startupFailed:true,closed:true});
});

it("retains pre-start cancellation without spawning a child",async()=>{
 const controller=new AbortController();controller.abort();const rows:ProducerProcessObservation[]=[];
 await expect(producerProcess(command('require("node:fs").writeFileSync("unexpected-child", "no")'),root,controller.signal,r=>{rows.push(r);})).rejects.toThrow(/^QA_PROCESS_CANCELLED$/);
 expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({exit:null,cancelled:true,closed:false});expect(readdirSync(root)).toEqual([]);
});

it("retains actual in-flight cancellation after owned termination",async()=>{
 const controller=new AbortController();const rows:ProducerProcessObservation[]=[];
 const pending=producerProcess(command("setInterval(()=>{},100)"),root,controller.signal,r=>{rows.push(r);});
 const timer=setTimeout(()=>controller.abort(),100);
 try{await expect(pending).rejects.toThrow(/^QA_PROCESS_FAILED_OR_CANCELLED$/);}finally{clearTimeout(timer);}
 expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({cancelled:true,timedOut:false,closed:true});expect(rows[0].exit).not.toBe(0);
});

it("distinguishes actual timeout from cancellation",async()=>{
 const rows:ProducerProcessObservation[]=[];
 await expect(producerProcess(command("setInterval(()=>{},100)",100),root,undefined,r=>{rows.push(r);})).rejects.toThrow(/^QA_PROCESS_FAILED_OR_CANCELLED$/);
 expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({timedOut:true,cancelled:false,closed:true});expect(rows[0].exit).not.toBe(0);
});

it("keeps the original combined output bound and refuses overflow",async()=>{
 const rows:ProducerProcessObservation[]=[];
 await expect(producerProcess(command('process.stdout.write(Buffer.alloc(65*1024*1024,65));setInterval(()=>{},100)',15_000),root,undefined,r=>{rows.push(r);})).rejects.toThrow(/^QA_PROCESS_FAILED_OR_CANCELLED$/);
 expect(rows).toHaveLength(1);expect(rows[0].outputLimit).toBe(true);expect(rows[0].stdout.length+rows[0].stderr.length).toBeLessThanOrEqual(64*1024*1024);
},20_000);

it("refuses synchronous or asynchronous retention failure without leaking details",async()=>{
 for(const observer of [()=>{throw Error("synthetic-private-path");},async()=>{throw Error("synthetic-private-path");}]){
  await expect(producerProcess(command('process.stdout.write("ok")'),root,undefined,observer)).rejects.toThrow(/^QA_PROCESS_RETENTION_FAILED$/);
 }
});

it("writes exclusive private bytes and exposes only an allowlisted failure",async()=>{
 const output=path.join(root,"private-capture");mkdirSync(output,{mode:0o700});const capture=processRecorder(output);
 await expect(producerProcess({...command('process.stdout.write(Buffer.from([0,255]));process.stderr.write("INSTALL_FAILED_TEST_ONLY synthetic-private");process.exit(1)'),stage:"android-install"},root,undefined,capture.observe)).rejects.toThrow(/^QA_PROCESS_FAILED_OR_CANCELLED$/);
 expect([...readFileSync(path.join(output,"process-1.stdout"))]).toEqual([0,255]);
 const metadata=JSON.parse(readFileSync(path.join(output,"process-1.json"),"utf8"));expect(metadata).toMatchObject({exit:1,stdoutBytes:2,closed:true});
 expect(JSON.stringify(metadata)).not.toContain("synthetic-private");expect(capture.failure()).toEqual({stage:"android-install",cause:"INSTALL_FAILED_TEST_ONLY"});
 if(process.platform!=="win32")for(const file of readdirSync(output))expect(statSync(path.join(output,file)).mode&0o777).toBe(0o600);
});

it("refuses unowned stage or private file collision instead of overwriting",async()=>{
 const output=path.join(root,"private-collision");mkdirSync(output,{mode:0o700});writeFileSync(path.join(output,"process-1.stdout"),"preserved");
 const capture=processRecorder(output);
 await expect(producerProcess({...command('process.stdout.write("ok")'),stage:"tool-version"},root,undefined,capture.observe)).rejects.toThrow(/^QA_PROCESS_RETENTION_FAILED$/);
 expect(readFileSync(path.join(output,"process-1.stdout"),"utf8")).toBe("preserved");expect(capture.failure()).toEqual({stage:"tool-version",cause:"PRIVATE_RETENTION_FAILED"});
 const unknown=processRecorder(output);
 await expect(producerProcess(command(""),root,undefined,unknown.observe)).rejects.toThrow(/^QA_PROCESS_RETENTION_FAILED$/);
});
