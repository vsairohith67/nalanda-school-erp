// HARNESS_ONLY event-path controls for the actual shared implementation.
// Injected non-closing handles never stand in for device or custody execution.
import {EventEmitter} from "node:events";
import {PassThrough} from "node:stream";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
const adapter=vi.hoisted(()=>({spawn:vi.fn()}));
vi.mock("node:child_process",()=>({spawn:adapter.spawn}));
import {producerProcess,type ProducerProcessObservation} from "@/scripts/portable/producer-process";
let child:any;
beforeEach(()=>{
 vi.useFakeTimers();
 child=Object.assign(new EventEmitter(),{pid:undefined,stdout:new PassThrough(),stderr:new PassThrough(),kill:vi.fn(()=>true),unref:vi.fn()});
 adapter.spawn.mockReturnValue(child);
});
afterEach(()=>{vi.useRealTimers();vi.clearAllMocks();});
const command={stage:"native-boundary-harness",tool:process.execPath,args:[],timeoutMs:100};
it.each(["missing-close","kill-false","kill-throws"])("refuses a %s without waiting indefinitely or manufacturing closure",async kind=>{
 if(kind==="kill-false")child.kill.mockReturnValue(false);
 if(kind==="kill-throws")child.kill.mockImplementation(()=>{throw Error("synthetic-private-denial");});
 const rows:ProducerProcessObservation[]=[];
 const pending=producerProcess(command,process.cwd(),undefined,row=>{rows.push(row);});
 const failure=expect(pending).rejects.toThrow(/^QA_PROCESS_GROUP_UNRECONCILED$/);
 await vi.advanceTimersByTimeAsync(2600);await failure;
 expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({exit:null,timedOut:true,closed:false,terminationFailed:true});
 expect(child.stdout.destroyed&&child.stderr.destroyed).toBe(true);expect(child.unref).toHaveBeenCalledTimes(1);
 child.emit("close",0,null);child.stdout.emit("data",Buffer.from("late-private"));await vi.advanceTimersByTimeAsync(10);
 expect(rows).toHaveLength(1);expect(rows[0].stdout.length).toBe(0);
});
it.each(["cancel","overflow"])("retains %s as a failed unclosed outcome",async kind=>{
  const rows:ProducerProcessObservation[]=[];const controller=new AbortController();
  const pending=producerProcess({...command,timeoutMs:10000},process.cwd(),controller.signal,row=>{rows.push(row);});
  const failure=expect(pending).rejects.toThrow(/^QA_PROCESS_GROUP_UNRECONCILED$/);
  if(kind==="cancel")controller.abort();else child.stdout.emit("data",Buffer.alloc(64*1024*1024+1));
  await vi.advanceTimersByTimeAsync(2500);await failure;
  expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({closed:false,terminationFailed:true,cancelled:kind==="cancel",outputLimit:kind==="overflow"});
  expect(rows[0].stdout.length).toBe(0);
});
