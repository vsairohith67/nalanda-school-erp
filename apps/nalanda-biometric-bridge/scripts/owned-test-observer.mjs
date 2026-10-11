// A finite observer of one already-owned child. No process enumeration, policy
// mutation, foreign PID termination, or inference of descendant settlement.
export const fullyClosed=(session,policy)=>session.closeObserved===true&&policy?.closeObserved===true;
export function observeOwnedChild(child,{deadlineMs,softReserveMs=15000,hardReserveMs=5000,maxBytes=64*1024*1024,onBytes=()=>{}}){
 let shortenDeadline;
 const observation=new Promise(resolve=>{
  let finalized=false,bytes=0,timedOut=false,captureError=null,startupError=null,terminationRequested=false,terminationError=null;
  let soft,hard;
  const terminate=()=>{try{terminationRequested=child.kill();if(!terminationRequested)terminationError='OWNED_TERMINATION_NOT_REQUESTED';}catch{terminationError='OWNED_TERMINATION_FAILED';}};
  const finish=(exit,signal,closeObserved)=>{
   if(finalized)return;finalized=true;clearTimeout(soft);clearTimeout(hard);
   resolve({ownedPid:child.pid??null,exit,signal,closeObserved,closedUtc:closeObserved?new Date().toISOString():null,observedUtc:new Date().toISOString(),timedOut,captureError,startupError,terminationRequested,terminationError,bytes});
  };
  const capture=data=>{if(finalized||captureError)return;try{bytes+=data.length;if(bytes>maxBytes)throw Error('BOUND');onBytes(data);}catch{captureError='BOUNDED_PRIVATE_CAPTURE_FAILED';terminate();}};
  child.stdout.on('data',capture);child.stderr.on('data',capture);
  child.on('error',()=>{startupError='OWNED_STARTUP_FAILED';terminate();});
  child.on('close',(exit,signal)=>finish(exit,signal,true));
  const arm=()=>{
   clearTimeout(soft);clearTimeout(hard);
   soft=setTimeout(()=>{timedOut=true;terminate();},Math.max(1,deadlineMs-Date.now()-softReserveMs));
   hard=setTimeout(()=>{timedOut=true;terminate();child.stdout.destroy();child.stderr.destroy();child.unref();finish(child.exitCode??null,child.signalCode??null,false);},Math.max(1,deadlineMs-Date.now()-hardReserveMs));
  };
  shortenDeadline=next=>{
   if(finalized)throw Error('CLOSED_OWNED_OBSERVER_NOT_REUSABLE');
   if(!Number.isSafeInteger(next)||next>deadlineMs)throw Error('OWNED_DEADLINE_EXTENSION_REFUSED');
   deadlineMs=next;arm();
  };
  arm();
 });
 // A phase can only shorten the original enclosing deadline. The same observer
 // and cleanup reserves remain active through actual close or bounded failure.
 Object.defineProperty(observation,'shortenDeadline',{value:next=>shortenDeadline(next)});
 return observation;
}
