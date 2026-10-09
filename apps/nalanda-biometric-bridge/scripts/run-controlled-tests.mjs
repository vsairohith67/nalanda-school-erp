// Minimum connection of the existing owned job/finite observer to real bridge
// commands. Private captures are never uploaded or streamed to public logs.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';import {randomUUID,createHash} from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';import {StringDecoder} from 'node:string_decoder';
import {observeOwnedChild} from './owned-test-observer.mjs';
import {acceptStart,validateActualReport,lifecycleEvidence,completionAdmitted,suiteBudget} from './controlled-test-contract.mjs';
import {admittedWindowsQaPolicy} from '../../../scripts/portable/windows-qa-window.mjs';
const entered=Date.now(),mode=process.argv[2]??'full';
assert(process.argv.length<=3&&['focused','full','control-success','control-timeout'].includes(mode));
assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');
const root=fs.realpathSync.native(fileURLToPath(new URL('../../../',import.meta.url)));
assert.equal(fs.realpathSync.native(process.cwd()),root);
const diagnostic=mode.startsWith('control-'),budget=diagnostic?null:suiteBudget(mode),wholeDeadline=entered+(diagnostic?20000:budget.launchMs);
let finalDeadline=wholeDeadline;
const remaining=()=>Math.floor(finalDeadline-Date.now());
const boundedTimeout=cap=>{const ms=Math.min(cap,remaining()-1000);assert(ms>0,'CONTROL_INTERVAL_EXPIRED');return ms;};
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',windowsHide:true,timeout:boundedTimeout(3000),maxBuffer:1000000}).trim();
const head=git('rev-parse','HEAD'),tree=git('show','-s','--format=%T','HEAD');
assert(/^[a-f0-9]{40}$/.test(head)&&/^[a-f0-9]{40}$/.test(tree));assert.equal(git('status','--porcelain'),'');
const readBytes=(file,max=8000000)=>{const st=fs.lstatSync(file);assert(st.isFile()&&!st.isSymbolicLink()&&st.nlink===1&&st.size<=max);return fs.readFileSync(file);};
const readJson=(file,max=8000000)=>JSON.parse(readBytes(file,max).toString('utf8').replace(/^\uFEFF/,''));
if(process.env.GITHUB_ACTIONS==='true'){
 assert.equal(process.env.RUNNER_ENVIRONMENT,'github-hosted');
 const event=readJson(process.env.GITHUB_EVENT_PATH,2000000);
 const window=readJson(path.join(root,'config/release-blocker-removal-2a-window.json'));
 assert.equal(admittedWindowsQaPolicy(event,process.env,head,window).reason,'EXACT_REVIEWED_PUBLICATION_EVENT');
}
const dir=path.join(root,'tmp','bridge-owned-test-controls',randomUUID());
fs.mkdirSync(path.dirname(dir),{recursive:true});fs.mkdirSync(dir,{mode:0o700});
assert.equal(fs.realpathSync.native(dir),dir);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const pinned=['owned-test-job.cs','owned-test-observer.mjs','controlled-tests.ps1','controlled-test-contract.mjs','run-controlled-tests.mjs','harmless-timeout-child.mjs'].map(f=>path.join(root,'apps/nalanda-biometric-bridge/scripts',f));
pinned.push(path.join(root,'apps/nalanda-biometric-bridge/src/export-integration.test.ts'));
const inputs=Object.fromEntries(pinned.map(f=>[path.relative(root,f).replaceAll('\\','/'),sha(fs.readFileSync(f))]));
fs.writeFileSync(path.join(dir,'input.json'),JSON.stringify({head,tree,mode,enteredUtc:new Date(entered).toISOString(),wholeDeadlineUtc:new Date(wholeDeadline).toISOString(),inputs},null,2)+'\n',{flag:'wx',mode:0o600});
// Hosted uses its existing managed PowerShell; local uses the approved 5.1
// descendant context. Neither invocation contains a policy-changing argument.
const executable=process.env.GITHUB_ACTIONS==='true'?'pwsh.exe':path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe');
const child=spawn(executable,['-NoProfile','-NonInteractive','-File',path.join(root,'apps/nalanda-biometric-bridge/scripts/controlled-tests.ps1'),'-Mode',mode,'-OutputDirectory',dir,'-ExpectedHead',head,'-ExpectedTree',tree],{windowsHide:true,stdio:['ignore','pipe','pipe']});
const log=path.join(dir,'private-command.log');fs.writeFileSync(log,'',{flag:'wx',mode:0o600});
let start=null,finish=null,bound=null,markerError=null,buffer='',observing;
const decoder=new StringDecoder('utf8');
function line(text){
 if(!text.includes(lifecycleEvidence)&&!text.includes('BRIDGE_TEST_COMMAND_OWNERSHIP_V1'))return;
 const row=JSON.parse(text.trim());
 if(row.evidence==='BRIDGE_TEST_COMMAND_OWNERSHIP_V1'){
  assert(!bound&&row.stage==='JOB_BOUND'&&row.head===head&&row.tree===tree&&row.initialActive===1);bound=row;return;
 }
 assert(!diagnostic&&bound,'OWNED_JOB_BEFORE_ACTUAL_CASE_REQUIRED');
 if(row.stage==='START'){
  assert(!start&&!finish,'DUPLICATE_OR_OUT_OF_ORDER_START');
  finalDeadline=Math.min(wholeDeadline,acceptStart(row,entered,Date.now(),mode));start=row;
  observing.shortenDeadline(finalDeadline);
 }else if(row.stage==='FINISHED'){
  assert(start&&!finish,'MATCHED_ONE_FINISH_REQUIRED');assert.equal(row.startUnixMs,start.startUnixMs);assert.deepEqual(row.taskIds,start.taskIds);finish=row;
  // Do not cancel or reset the START-bound enclosing clock. Final report,
  // source checks and actual process settlement remain inside this interval.
 }else throw Error('UNEXPECTED_LIFECYCLE_MARKER');
}
observing=observeOwnedChild(child,{deadlineMs:wholeDeadline,softReserveMs:15000,hardReserveMs:12000,onBytes:bytes=>{
 fs.appendFileSync(log,bytes);buffer+=decoder.write(bytes);
 if(buffer.length>65536&&!buffer.includes('\n'))throw Error('BOUNDED_LINE_CAPTURE_FAILED');
 let index;while((index=buffer.indexOf('\n'))>=0){const row=buffer.slice(0,index);buffer=buffer.slice(index+1);try{line(row);}catch(error){markerError='STRICT_ACTUAL_MARKER_INVALID';throw error;}}
}});
const observed=await observing;
let passed=false,error=null,counts=null,settlement=null,job=null,reportHash=null;
try{
 assert(observed.closeObserved&&bound&&!observed.captureError&&!observed.startupError&&!observed.terminationError,'ACTUAL_OWNED_CLOSE_AND_CAPTURE_REQUIRED');
 buffer+=decoder.end();if(buffer.trim())line(buffer);assert(!markerError);
 const raw=readBytes(path.join(dir,'owned-identities.tsv'),4000000).toString('utf8');assert(raw.endsWith('\n'));
 const identityRows=raw.trim().split(/\r?\n/);assert(identityRows.length<=32768);
 const known=new Map();for(const row of identityRows){const cols=row.split('\t');assert.equal(cols.length,3);const [pid,createdUtc,name]=cols;assert(/^\d+$/.test(pid)&&Number.isSafeInteger(Number(pid))&&Number(pid)>0&&Number(pid)<=4294967295&&Number.isFinite(Date.parse(createdUtc))&&/^[^\t\r\n]{1,260}$/.test(name));const key=Number(pid)+':'+Date.parse(createdUtc);assert(!known.has(key),'DUPLICATE_OR_AMBIGUOUS_OWNED_IDENTITY');known.set(key,{pid:Number(pid),createdUtc});}
 assert(known.size>0);
 // One finite passive identity read, never foreign termination or a PID-only
 // survival conclusion. The job's initial membership and final accounting are
 // separate from its 25ms sampled identity capture.
 const command="$ErrorActionPreference='Stop';ConvertTo-Json -Compress -InputObject @(Get-CimInstance Win32_Process|ForEach-Object{@{pid=$_.ProcessId;createdUtc=if($_.CreationDate){$_.CreationDate.ToUniversalTime().ToString('o')}else{$null}}})";
 const actual=JSON.parse(execFileSync(executable,['-NoProfile','-NonInteractive','-Command',command],{encoding:'utf8',windowsHide:true,timeout:boundedTimeout(5000),maxBuffer:2000000}));
 const rows=Array.isArray(actual)?actual:[actual];const knownPids=new Set([...known.values()].map(r=>r.pid));
 const survivors=rows.filter(r=>known.has(r.pid+':'+Date.parse(r.createdUtc)));
 const unavailable=rows.filter(r=>knownPids.has(r.pid)&&!Number.isFinite(Date.parse(r.createdUtc)));
 settlement={observedIdentities:known.size,survivors:survivors.length,unavailableIdentities:unavailable.length,samplingIsNotExhaustive:true};assert.equal(survivors.length,0);assert.equal(unavailable.length,0);
 assert.equal(git('rev-parse','HEAD'),head);assert.equal(git('show','-s','--format=%T','HEAD'),tree);assert.equal(git('status','--porcelain'),'');
 for(const f of pinned)assert.equal(sha(fs.readFileSync(f)),inputs[path.relative(root,f).replaceAll('\\','/')]);
 if(mode==='control-timeout'){
  assert(observed.timedOut&&(Number.isInteger(observed.exit)&&observed.exit!==0||typeof observed.signal==='string'&&observed.signal.length>0)&&observed.terminationRequested&&known.size>=3,'ACTUAL_SHORT_DEADLINE_DESCENDANT_CONTROL_REQUIRED');
  passed=true;
 }else{
  assert.equal(observed.exit,0);assert(!observed.signal&&!observed.timedOut);
  job=readJson(path.join(dir,'job-receipt.json'),100000);
  assert(job.jobBound&&job.head===head&&job.tree===tree&&job.mode===mode&&job.captureComplete&&job.activeBeforeExit===1&&job.activeAtFinally===1&&job.commandExit===0&&!job.failure);
  if(!diagnostic){
   assert(start&&finish);const reportBytes=readBytes(path.join(dir,'vitest.json'));reportHash=sha(reportBytes);
   counts=validateActualReport(JSON.parse(reportBytes.toString('utf8').replace(/^\uFEFF/,'')),start,finish,mode);
  }
  passed=true;
 }
 assert(completionAdmitted(entered,finalDeadline,Date.now(),3000),'FINITE_REPORTING_RESERVE_REQUIRED');
}catch{passed=false;error='ACTUAL_RESULT_SOURCE_OR_SETTLEMENT_NOT_QUALIFIED';}
const ended=Date.now();
const publicRow={contract:'BRIDGE_CONTROLLED_TEST_COMMAND_V1',source:head,tree,mode,scope:diagnostic?'DECLARED_HARMLESS_CHILD_CONTROL_NOT_FEATURE_ACCEPTANCE':'ACTUAL_SYNTHETIC_BRIDGE_ASSERTIONS',validationPassedAtReceipt:passed,requiresActualSuccessfulCallerExit:true,error,startedUtc:new Date(entered).toISOString(),validatedBeforeReportingUtc:new Date(ended).toISOString(),elapsedAtValidationMs:ended-entered,requiredCallerDeadlineUtc:new Date(finalDeadline).toISOString(),launchMaximumMs:diagnostic?20000:budget.launchMs,startToFullValidationAndSettlementMaximumMs:diagnostic?null:budget.aggregateMs,aggregateContract:diagnostic?null:'TEST_CONTRACT_CHANGED_AGGREGATE_ONLY_3A',retainedCoupledLifecycleMaximumMs:diagnostic?null:60000,startToValidationAndSettlementMs:start?ended-start.startUnixMs:null,observed:{exit:observed.exit,signal:observed.signal,closeObserved:observed.closeObserved,timedOut:observed.timedOut,captureError:observed.captureError,terminationError:observed.terminationError},settlement,counts,reportSha256:reportHash,lifecycleObservedMs:finish?.totalObservedMs??null,caseDescendantSettlement:'UNKNOWN',runtimeExecuted:false,realDataAccessed:false};
fs.writeFileSync(path.join(dir,'command-receipt.json'),JSON.stringify({publicRow,observed,job,inputs,markerError},null,2)+'\n',{flag:'wx',mode:0o600});
// Only this allowlisted aggregate projection is publishable. Raw task JSON,
// fixture traces, process identities and streams remain in the private root.
const publicRoot=path.join(root,'tmp','bridge-owned-test-public',path.basename(dir));fs.mkdirSync(path.dirname(publicRoot),{recursive:true});fs.mkdirSync(publicRoot,{mode:0o700});
const projection=Buffer.from(JSON.stringify(publicRow,null,2)+'\n');fs.writeFileSync(path.join(publicRoot,'report.json'),projection,{flag:'wx'});
fs.writeFileSync(path.join(publicRoot,'manifest.json'),JSON.stringify({classification:'FINITE_SYNTHETIC_TEST_OBSERVATION_NOT_RUNTIME_ADMISSION',files:[{name:'report.json',bytes:projection.length,sha256:sha(projection)}]})+'\n',{flag:'wx'});
// A projection sampled before output is not its own future caller-close proof.
// Actual nonzero exit/job failure must remain failed even if validation passed.
console.log(JSON.stringify(publicRow));process.exitCode=passed&&completionAdmitted(entered,finalDeadline,Date.now())?0:1;
