// An event clock, not compressed wall-time measurement. No sockets or sleeps.
export class VirtualClock {
  kind='VIRTUAL'; time=0; queue=[];
  now(){return this.time;}
  iso(){return new Date(Date.UTC(2000,0,1)+this.time).toISOString();}
  sleep(ms,signal){
    return new Promise((resolve,reject)=>{
      if(signal?.aborted){reject(new Error('CANCELLED'));return;}
      const event={at:this.time+ms,resolve,reject,signal};
      event.abort=()=>{this.queue=this.queue.filter(e=>e!==event);reject(new Error('CANCELLED'));};
      signal?.addEventListener('abort',event.abort,{once:true});this.queue.push(event);
    });
  }
  async drive(promise){
    let finished=false,result,failure;
    promise.then(v=>{result=v;finished=true;},e=>{failure=e;finished=true;});
    for(let step=0;step<100000&&!finished;step++){
      // Drain Promise.race/transport continuations before advancing time.
      for(let turn=0;turn<20;turn++)await Promise.resolve();
      if(finished)break;
      this.queue.sort((a,b)=>a.at-b.at);const event=this.queue.shift();
      if(!event)throw new Error('CLOCK_DEADLOCK');
      this.time=event.at;event.signal?.removeEventListener('abort',event.abort);event.resolve();
    }
    if(!finished)throw new Error('CLOCK_STEP_BOUND');
    if(failure)throw failure;return result;
  }
}
export function fixture(clock){
  const rows=new Map(['INVENTED-ROW-A','INVENTED-ROW-B'].map(id=>[id,{id,status:'SUBMITTED'}]));
  const read=()=>[...rows.values()].reverse().map(row=>({...row}));
  return {
    expected:(operation,ordinal)=>operation==='certificate_list'?{ids:read().map(r=>r.id)}:{id:`INVENTED-REQUEST-${ordinal}`,studentId:'INVENTED-SUBJECT'},
    transport:async({operation,ordinal,signal})=>{
      await clock.sleep(20,signal);
      if(operation==='certificate_list')return {status:200,contentType:'application/json',body:{requests:read()}};
      const row={id:`INVENTED-REQUEST-${ordinal}`,studentId:'INVENTED-SUBJECT',status:'SUBMITTED'};
      if(rows.has(row.id))throw new Error('DUPLICATE_FIXTURE_EFFECT');rows.set(row.id,{...row});
      const saved=read().filter(r=>r.id===row.id);
      return {status:201,contentType:'application/json',body:{request:row},readback:{id:saved[0].id,status:saved[0].status,effectCount:saved.length}};
    },
    // Invented adapter inputs only; never host observations.
    sample:()=>({portableMetrics:`nalanda_requests_total ${Math.floor(clock.now()/50)}`,freeMemoryBytes:{value:2**30,unit:'bytes'},diskFreeBytes:{value:10*2**30,unit:'bytes'},generatorMemoryBytes:{value:2**20,unit:'bytes'}}),
  };
}
