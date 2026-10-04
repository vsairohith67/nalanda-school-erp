import { readFile,lstat } from 'node:fs/promises';
import { exampleConfig,hash,preflight,runtimePreflight,fail } from './config.mjs';
import { VirtualClock,fixture } from './fixture.mjs';
import { runScenario } from './runner.mjs';
import { reports } from './report.mjs';
import { reserveOutput,writeReports } from './output.mjs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
const [command,...args]=process.argv.slice(2);
try{
  if(command==='plan'||command==='runtime'&&args.length){
    const options={};for(let i=0;i<args.length;i+=2){if(!['--profile','--expected-profile'].includes(args[i])||Object.hasOwn(options,args[i])||!args[i+1])fail('CONSUMER_ARGUMENT_INVALID');options[args[i]]=args[i+1];}
    // The loader's default disk cache can prune unrelated stale cache files.
    // This process uses its in-memory cache; plan performs no storage mutation.
    process.env.TSX_DISABLE_CACHE='1';
    const {tsImport}=await import('tsx/esm/api');
    const {planConsumer,loadConsumerProfile,executeConsumer}=await tsImport('./consumer-connection.ts',import.meta.url);
    const {exampleConsumerProfile,profileHash}=await tsImport('./consumer-profile.ts',import.meta.url);
    const workspace=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
    const profile=options['--profile']?loadConsumerProfile(options['--profile'],workspace):exampleConsumerProfile(workspace,randomUUID().replaceAll('-',''));
    if(options['--expected-profile']&&(!options['--profile']||profileHash(profile)!==options['--expected-profile']))fail('LOCAL_PROFILE_IDENTITY_MISMATCH');
    if(command==='plan')console.log(JSON.stringify(planConsumer(profile,workspace)));
    else{if(!options['--profile']||!options['--expected-profile'])fail('EXPLICIT_PROFILE_IDENTITY_REQUIRED');const controller=new AbortController(),cancel=()=>controller.abort();process.on('SIGINT',cancel);process.on('SIGTERM',cancel);
      try{const result=await executeConsumer(profile,workspace,options['--expected-profile'],controller.signal);console.log(JSON.stringify({...result,report:undefined}));if(result.state!=='COMPLETE')process.exitCode=1;}finally{process.off('SIGINT',cancel);process.off('SIGTERM',cancel);}}
  }else{
  if(command==='runtime')runtimePreflight();
  if(!['preflight','sample','report'].includes(command)||args.length%2)fail('USAGE_PREFLIGHT_SAMPLE_OR_REPORT_REQUIRED');
  const options={};for(let i=0;i<args.length;i+=2){if(!['--config','--expected-config','--target','--output','--input'].includes(args[i])||Object.hasOwn(options,args[i]))fail('ARGUMENT_INVALID');options[args[i]]=args[i+1];}
  if(command==='report'){
    if(Object.keys(options).sort().join()!=='--input,--output')fail('ARGUMENT_INVALID');
    const stat=await lstat(options['--input']);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>2**20)fail('RESULT_FILE_REFUSED');
    const report=reports(JSON.parse(await readFile(options['--input'],'utf8')));
    const dir=await reserveOutput(options['--output']);await writeReports(dir,report);
    console.log(JSON.stringify({state:'HARNESS_ONLY',operation:'OFFLINE_REPORT',outputName:options['--output']}));
  } else {
  let config=exampleConfig('disposable-mutation');
  if(options['--config']){const stat=await lstat(options['--config']);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>8192)fail('CONFIG_FILE_REFUSED');config=JSON.parse(await readFile(options['--config'],'utf8'));}
  if(options['--target']!==config.target)fail('EXPLICIT_TARGET_REQUIRED');
  const identity={expectedConfigHash:options['--config']?options['--expected-config']:hash(config)};
  const admitted=preflight(config,identity);
  if(command==='preflight')console.log(JSON.stringify({state:'CONFIGURATION_VALIDATED',evidence:admitted.evidence,configHash:admitted.configHash,localHarnessExecution:'PENDING_SEPARATE_PREFLIGHT',erpMeasurement:'NOT_ADMITTED'}));
  else {
    const dir=await reserveOutput(options['--output']);
    const clock=new VirtualClock();
    const result=await clock.drive(runScenario(config,{clock,...fixture(clock),identity}));
    const report=reports(result);await writeReports(dir,report);
    console.log(JSON.stringify({state:'HARNESS_ONLY',actions:result.actions.length,virtualDurationMs:result.elapsedMs,stopReason:result.stopReason,outputName:options['--output']}));
  }
  }
  }
}catch(error) {const safe=/^[A-Z][A-Z0-9_]{1,100}$/.test(error?.message??'')?error.message:'INVALID_INPUT_OR_PERMISSION';console.error('D1P_REFUSED: '+safe+'; invalid input, ownership, identity, or runtime permission; no runtime launched.');process.exitCode=1;}
