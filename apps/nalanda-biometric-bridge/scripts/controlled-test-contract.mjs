import assert from 'node:assert/strict';
export const lifecycleEvidence='BRIDGE_PRIVATE_REPORT_LIFECYCLE_V1';
export const requiredTitles={create:'explicit non-synthetic transport-disabled review creates an exclusive private report without queue or health',reuse:'retained private capture proves a same-file exact append while exposing operator discrepancies'};
// Independently reviewed 3A aggregate composition, not individual case limits.
// The original 60-second failed command remains retained as historical evidence.
export function suiteBudget(mode){
 assert(['focused','full'].includes(mode),'EXACT_ORIGINAL_SUITE_MODE_REQUIRED');
 return Object.freeze({aggregateMs:mode==='focused'?155000:175000,launchMs:mode==='focused'?215000:235000,softReserveMs:15000,hardReserveMs:12000});
}
export function completionAdmitted(entered,deadline,now,reserveMs=0){
 return [entered,deadline,now,reserveMs].every(Number.isSafeInteger)&&entered<=now&&reserveMs>=0&&now+reserveMs<deadline;
}
export function acceptStart(row,entered,now,mode='focused'){
 const budget=suiteBudget(mode);
 assert.equal(row.evidence,lifecycleEvidence);assert.equal(row.stage,'START');
 assert(Number.isSafeInteger(row.startUnixMs)&&row.startUnixMs>=entered&&row.startUnixMs<=now,'FRESH_ACTUAL_START_REQUIRED');
 assert(Array.isArray(row.taskIds)&&row.taskIds.length===2&&new Set(row.taskIds).size===2&&row.taskIds.every(x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(x)),'EXACT_TWO_TASK_IDS_REQUIRED');
 return row.startUnixMs+budget.aggregateMs;
}
export function validateActualReport(report,start,finish,mode){
 const expected=mode==='focused'?44:127;
 assert.equal(report.success,true);assert.equal(report.numTotalTests,expected);assert.equal(report.numFailedTests,0);assert.equal(report.numPendingTests,0);
 const all=report.testResults.flatMap(f=>f.assertionResults);
 assert.equal(all.length,expected);assert.equal(report.numPassedTests,expected);
 assert(report.testResults.every(f=>f.status==='passed')&&all.every(a=>a.status==='passed'),'ALL_ORIGINAL_FILES_AND_CASES_REQUIRED');
 assert.equal(finish.evidence,lifecycleEvidence);assert.equal(finish.stage,'FINISHED');
 assert.deepEqual(finish.taskIds,start.taskIds);assert.equal(finish.startUnixMs,start.startUnixMs);
 assert.equal(finish.declaredResult,'PASS');assert(Number.isFinite(finish.totalObservedMs)&&finish.totalObservedMs>=0&&finish.totalObservedMs<=60000);
 assert.deepEqual(finish.contract,{state:'TEST_CONTRACT_CHANGED',setupMs:5000,createBodyMs:45000,reuseBodyMs:5000,teardownMs:5000});
 const phase=(row,max)=>{assert(row?.returned&&Number.isFinite(row.startMs)&&Number.isFinite(row.endMs)&&row.startMs>=0&&row.endMs>=row.startMs&&row.endMs-row.startMs<=max);};
 phase(finish.setup,5000);phase(finish.teardown,5000);
 assert(Array.isArray(finish.actions)&&finish.actions.length===2);
 assert.deepEqual(finish.actions.map(r=>r.caseId),['create','reuse']);
 assert.deepEqual(finish.actions.map(r=>r.taskId),start.taskIds);
 assert(finish.setup.endMs<=finish.actions[0].startMs&&finish.actions[0].endMs<=finish.actions[1].startMs&&finish.actions[1].endMs<=finish.teardown.startMs&&finish.teardown.endMs<=finish.totalObservedMs);
 const files=report.testResults.filter(f=>f.name.replaceAll('\\','/').endsWith('/src/export-integration.test.ts'));
 assert.equal(files.length,1);assert.equal(files[0].status,'passed');
 const assertions=files[0].assertionResults;
 const bound=[];
 for(const [caseId,title]of Object.entries(requiredTitles)){
  const matches=assertions.filter(a=>a.title===title);assert.equal(matches.length,1);const a=matches[0];assert.equal(a.status,'passed');
  const meta=a.meta?.bridgePrivateReportLifecycle;
  assert(meta&&meta.evidence===lifecycleEvidence&&meta.stage==='BODY_FINISHED'&&meta.caseId===caseId,'ACTUAL_BODY_METADATA_REQUIRED');
  assert(start.taskIds.includes(meta.taskId)&&!bound.includes(meta.taskId));bound.push(meta.taskId);
  assert.equal(meta.action?.assertionsReturned,true);assert.equal(meta.testAbortObserved,false);
  assert.equal(meta.startUnixMs,start.startUnixMs);
  const action=finish.actions.find(r=>r.caseId===caseId);assert(action&&action.taskId===meta.taskId&&action.frameworkState==='pass'&&action.assertionsReturned&&!action.testAbortObserved);
  phase({...action,returned:action.assertionsReturned},caseId==='create'?45000:5000);
  assert.deepEqual(meta.action,{startMs:action.startMs,endMs:action.endMs,assertionsReturned:true});assert.deepEqual(meta.setup,finish.setup);
 }
 assert.equal(assertions.filter(a=>a.title==='bounds directory enumeration and cleans private atomic-write residue after failed rename').length,1);
 assert(assertions.every(a=>a.status==='passed'),'EVERY_ORIGINAL_EXPORT_CASE_REQUIRED');
 return {tests:expected,passed:report.numPassedTests,failed:0,pending:0,taskIds:bound};
}
