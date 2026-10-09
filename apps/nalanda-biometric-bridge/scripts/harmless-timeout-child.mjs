// Fixed synthetic process-control fixture. No bridge/device/helper acceptance.
// A reviewed source file preserves exact JavaScript across PowerShell5.1 argv.
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const args=process.argv.slice(2);
if(args.length===1&&args[0]==='grandchild'){
  setTimeout(()=>{},30000);
}else if(args.length===0){
  const child=spawn(process.execPath,[fileURLToPath(import.meta.url),'grandchild'],{stdio:'ignore',windowsHide:true});
  child.on('error',()=>{process.exitCode=1;});
  process.stdout.write('OWNED_HARMLESS_CHILDREN_READY\n');
  setTimeout(()=>{},30000);
}else{
  throw Error('EXACT_HARMLESS_CHILD_MODE_REQUIRED');
}
