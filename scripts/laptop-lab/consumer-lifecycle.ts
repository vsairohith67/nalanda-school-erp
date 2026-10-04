import assert from 'node:assert/strict';
import path from 'node:path';
import { homedir } from 'node:os';
import { readFileSync, writeFileSync, existsSync, lstatSync } from 'node:fs';
import { captureProductProcess } from '../portable/producer-process';
import { validateComposeBoundary, validateComposeFiles } from '../portable/operator-adapter';
import { assertLocalImage, assertRunningImage, hashBytes } from '../portable/artifact-handoff';
import { assertHttpTarget } from '../portable/http-target';
import { reserveOutput, writeReports } from './output.mjs';
import { consumerNames, SERVICES, NETWORKS, VOLUMES } from './consumer-plan';
import { canonicalDirectory, profileHash, LOCAL_ENDPOINT } from './consumer-profile';
import type { ConsumerProfile, ArtifactReceipt, OwnedResource, LabAdapter } from './consumer-types';
import {boundCertificateAdapter} from './consumer-operation-ports';
import {stageConsumerInputs} from './consumer-inputs';
import {prepareCertificateInputs} from './consumer-bootstrap';
export type Lifecycle={resolve():Promise<void>;reserve():Promise<void>;prepare():Promise<void>;launch():Promise<void>;bind():Promise<LabAdapter|null>;cleanup():Promise<'COMPLETE'|'RETAINED'>;record(result:any):Promise<void>;harmlessChildCaptured?():boolean};
export type DockerProcess=(stage:string,args:string[],root:string,signal?:AbortSignal,input?:Uint8Array)=>Promise<string>;
const labels=(p:ConsumerProfile)=>({'io.nps.consumer.run':p.consumer.runId,'io.nps.consumer.project':p.consumer.project,'io.nps.producer.run':p.producer.runId!,'io.nps.producer.source':p.producer.source});
const matches=(actual:any,p:ConsumerProfile)=>Object.entries(labels(p)).every(([k,v])=>actual?.[k]===v);
const rootFor=(p:ConsumerProfile)=>path.join(p.consumer.workspace,'scripts/laptop-lab/outputs',p.consumer.outputName);

/** Narrow overlay over Docker's resolved existing recipe; no alternative stack. */
export function localCompose(p:ConsumerProfile,r:ArtifactReceipt,base:any){
  const config=structuredClone(base);config.name=p.consumer.project;
  assert(config.services&&config.networks&&config.volumes&&config.secrets,'LOCAL_COMPOSE_INCOMPLETE');
  const trackedSecrets=new Set(Object.keys(config.secrets));
  config.services=Object.fromEntries(SERVICES.map(name=>{
    const s=config.services[name];assert(s,'LOCAL_SERVICE_MISSING');
    s.container_name=p.consumer.project+'-'+name;s.labels={...(s.labels??{}),...labels(p)};
    s.pull_policy='never';s.restart='no';s.cpus=p.scope.cpu;s.mem_limit=p.scope.memoryBytes;s.memswap_limit=p.scope.memoryBytes;s.pids_limit=p.scope.pids;
    if(String(s.image).startsWith('${PORTABLE_IMAGE_ID'))s.image=r.imageConfigDigest;
    assert(s.image===r.imageConfigDigest||/^[^\s]+@sha256:[a-f0-9]{64}$/.test(s.image),'LOCAL_IMAGE_UNPINNED');
    if(s.environment?.NALANDA_DEPLOYMENT_ID)s.environment.NALANDA_DEPLOYMENT_ID='portable-synthetic-'+r.source;
    if(name==='web-1'){s.environment.PORTABLE_UPSTREAMS=undefined;delete s.environment.PORTABLE_UPSTREAMS;s.depends_on={migrator:{condition:'service_completed_successfully'}};
      assert(trackedSecrets.has('synthetic_director_password'),'LOCAL_SYNTHETIC_FOUNDATION_OPERAND_REQUIRED');
      s.secrets=[...new Set([...s.secrets,'synthetic_director_password'])];s.environment.STAGING_SYNTHETIC_DIRECTOR_PASSWORD_FILE='/run/secrets/synthetic_director_password';}
    if(name==='reverse-proxy'){s.environment={...(s.environment??{}),PORTABLE_UPSTREAMS:'web-1:3000'};s.depends_on={'web-1':{condition:'service_healthy'}};}
    assert(!Object.keys(s.depends_on??{}).some(k=>!SERVICES.includes(k as any)),'LOCAL_FOREIGN_DEPENDENCY');
    return [name,s];
  }));
  config.networks=Object.fromEntries(NETWORKS.map(key=>{const n=config.networks[key];assert(n?.internal&&!n.external&&!n.driver_opts,'LOCAL_NETWORK_BOUNDARY');return [key,{...n,name:p.consumer.project+'_'+key,labels:labels(p)}];}));
  config.volumes=Object.fromEntries(VOLUMES.map(key=>{const v=config.volumes[key];assert(v&&!v.external&&!v.driver_opts,'LOCAL_VOLUME_BOUNDARY');return [key,{...v,name:p.consumer.project+'_'+key,labels:labels(p)}];}));
  config.secrets=Object.fromEntries([...trackedSecrets].map(key=>{assert(/^[a-z][a-z0-9_]+$/.test(key),'LOCAL_SECRET_NAME_INVALID');return [key,{file:path.join(rootFor(p),'secrets',key)}];}));
  validateComposeBoundary(config,p.consumer.workspace,rootFor(p));return config;
}
export class LocalLifecycle implements Lifecycle {
  root='';resources:OwnedResource[]=[];private config:any;private images=new Map<string,any>();private reserved=false;private mutationAttempted=false;private settled=true;private snapshot=0;private commandRecords:{stage:string;args:string[];outputSha256:string}[]=[];
  constructor(private p:ConsumerProfile,private r:ArtifactReceipt,private process:DockerProcess,private signal?:AbortSignal,private adapterFactory:(...args:Parameters<typeof boundCertificateAdapter>)=>LabAdapter|null|Promise<LabAdapter>=boundCertificateAdapter,private inputStager:typeof stageConsumerInputs=stageConsumerInputs,private inputProvisioner:typeof prepareCertificateInputs=prepareCertificateInputs){}
  private async run(stage:string,args:string[],operationSignal?:AbortSignal,input?:Uint8Array){
    assert(!this.signal?.aborted||stage.startsWith('cleanup'),'LOCAL_CONSUMER_CANCELLED');
    // The process port is settled on success. Failed/partial child capture is
    // unreconciled until the production process seam proves settlement.
    const signal=operationSignal&&this.signal?AbortSignal.any([operationSignal,this.signal]):operationSignal??this.signal;
    const output=await this.process(stage,['--context',this.p.consumer.context,...args],this.root,stage.startsWith('cleanup')?undefined:signal,input);
    assert(Buffer.byteLength(output)<=this.p.scope.outputLimitBytes,'LOCAL_CHILD_OUTPUT_LIMIT');
    this.commandRecords.push({stage,args,outputSha256:hashBytes(output)});return output;
  }
  private json=(stage:string,args:string[])=>this.run(stage,args).then(JSON.parse);
  private compose(args:string[]){return ['compose','--project-name',this.p.consumer.project,'--file',path.join(this.root,'compose.json'),...args];}
  private assertOutput(){canonicalDirectory(this.root);const file=path.join(this.root,'.owner'),s=lstatSync(file);assert(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&readFileSync(file,'utf8')==='NPS-LAPTOP-LAB-D1P','LOCAL_OUTPUT_OWNER_MISMATCH');}
  private save(){if(this.reserved){this.assertOutput();writeFileSync(path.join(this.root,'runtime-private-'+(++this.snapshot)+'.json'),JSON.stringify({profileSha256:profileHash(this.p),resources:this.resources,commands:this.commandRecords,settled:this.settled}),{flag:'wx',mode:0o600});}}
  async resolve(){
    // Queries are after admission but before output reservation. Capture uses
    // a read-only, bounded query port for this phase; no child logs are written.
    const context=await this.json('resolve-context',['context','inspect',this.p.consumer.context]);
    assert.equal(context[0]?.Endpoints?.docker?.Host,LOCAL_ENDPOINT,'LOCAL_EFFECTIVE_ENDPOINT_MISMATCH');
    const info=await this.json('resolve-engine',['info','--format','{"os":{{json .OSType}},"architecture":{{json .Architecture}}}']);
    assert(info.os==='linux'&&info.architecture==='x86_64','LOCAL_ENGINE_ARCHITECTURE_MISMATCH');
  }
  async reserve(){this.root=await reserveOutput(this.p.consumer.outputName);assert.equal(this.root,rootFor(this.p));this.reserved=true;this.save();}
  async prepare(){
    for(const [kind,names] of [['container',consumerNames(this.p).containers.map(x=>x.name)],['network',consumerNames(this.p).networks],['volume',consumerNames(this.p).volumes]] as const){
      for(const name of names){const args=kind==='container'?['container','ls','--all','--filter','name=^/'+name+'$','--format','{{.Names}}']:[kind,'ls','--filter','name=^'+name+'$','--format','{{.Name}}'];assert.equal((await this.run('collision-'+kind,args)).trim(),'','LOCAL_RESOURCE_COLLISION');}
    }
    const raw=await this.json('compose-config',['compose','--project-name',this.p.consumer.project,'--file',path.join(this.p.consumer.workspace,'deploy/portable/compose.yml'),'config','--no-interpolate','--format','json']);
    assert.equal(hashBytes(readFileSync(path.join(this.p.consumer.workspace,'deploy/portable/compose.yml'))),this.r.inputs['deploy/portable/compose.yml'],'LOCAL_COMPOSE_SOURCE_MISMATCH');
    this.config=localCompose(this.p,this.r,raw);
    this.inputStager(this.p,this.r,this.root,Object.keys(this.config.secrets));
    await validateComposeFiles(this.config,this.p.consumer.workspace,this.root);
    for(const reference of new Set<string>(Object.values(this.config.services).map((s:any)=>s.image))){
      const image=(await this.json('image-inspect',['image','inspect',reference]))[0];
      if(reference===this.r.imageConfigDigest)assertLocalImage(this.r,image);
      else assert(image.Os==='linux'&&image.Architecture==='amd64'&&image.RepoDigests?.some((d:string)=>d.endsWith(reference.slice(reference.indexOf('@')))),'LOCAL_INFRASTRUCTURE_IMAGE_MISMATCH');
      this.images.set(reference,image);
    }
    this.assertOutput();writeFileSync(path.join(this.root,'compose.json'),JSON.stringify(this.config),{flag:'wx',mode:0o600});this.save();
  }
  private async inventory(cleanup=false){
    const prefix=cleanup?'cleanup-':'';
    const inspected:any[]=[];
    const raw=await this.run(prefix+'owned-container-ids',['container','ls','--all','--no-trunc','--filter','label=io.nps.consumer.project='+this.p.consumer.project,'--format','{{.ID}}']);
    const ids=raw.trim()?raw.trim().split(/\s+/):[];
    for(const id of ids){assert(/^[a-f0-9]{64}$/.test(id),'LOCAL_CONTAINER_ID_INVALID');const c=(await this.json(prefix+'owned-container-inspect',['container','inspect',id]))[0];
      assert(matches(c.Config?.Labels,this.p)&&consumerNames(this.p).containers.some(n=>'/'+n.name===c.Name),'LOCAL_RESOURCE_OWNER_MISMATCH');
      if(!this.resources.some(x=>x.id===id)){this.resources.push({kind:'container',id,name:c.Name.slice(1)});this.save();}
      if(!cleanup)this.verifyContainer(c);
      inspected.push(c);
    }
    for(const [kind,names] of [['network',consumerNames(this.p).networks],['volume',consumerNames(this.p).volumes]] as const){
      const list=(await this.run(prefix+'owned-'+kind+'-list',[kind,'ls','--filter','label=io.nps.consumer.project='+this.p.consumer.project,'--format','{{.Name}}'])).trim();
      for(const name of list?list.split(/\r?\n/):[]){
      assert(names.includes(name),'LOCAL_RESOURCE_NAME_FOREIGN');const v=(await this.json(prefix+'owned-'+kind+'-inspect',[kind,'inspect',name]))[0];assert(matches(v.Labels,this.p)&&v.Name===name,'LOCAL_RESOURCE_OWNER_MISMATCH');
      const id=kind==='network'?v.Id:v.Name;if(!this.resources.some(x=>x.kind===kind&&x.id===id)){this.resources.push({kind,id,name});this.save();}
      if(!cleanup)assert(kind==='network'?v.Internal===true&&v.Driver==='bridge':v.Driver==='local'&&!Object.keys(v.Options??{}).length,'LOCAL_EFFECTIVE_RESOURCE_BOUNDARY');
    }}
    if(!cleanup)inspected.forEach(c=>this.verifyNetworkIds(c));
  }
  private verifyNetworkIds(c:any){for(const [name,n] of Object.entries(c.NetworkSettings?.Networks??{}) as [string,any][]){if(name==='none'&&c.HostConfig.NetworkMode==='none')continue;const owned=this.resources.find(r=>r.kind==='network'&&r.name===name);assert(owned&&n.NetworkID===owned.id,'LOCAL_EFFECTIVE_NETWORK_OWNER_MISMATCH');}}
  private verifyContainer(c:any){
    const service=c.Config.Labels['com.docker.compose.service'],s=this.config.services[service];assert(s,'LOCAL_SERVICE_FOREIGN');
    assert.equal(c.Name,'/'+s.container_name);assert.equal(c.Config.Labels['com.docker.compose.project'],this.p.consumer.project,'LOCAL_PROJECT_FOREIGN');
    const image=this.images.get(s.image);assert(image&&c.Image===image.Id&&c.Config.Image===s.image,'LOCAL_SERVING_IMAGE_MISMATCH');
    const h=c.HostConfig;assert(h.NanoCpus===this.p.scope.cpu*1e9&&h.Memory===this.p.scope.memoryBytes&&h.MemorySwap===this.p.scope.memoryBytes&&h.PidsLimit===this.p.scope.pids&&h.RestartPolicy.Name==='no'&&!h.Privileged&&h.PidMode!=='host'&&h.IpcMode!=='host'&&!h.Devices?.length,'LOCAL_EFFECTIVE_LIMIT_MISMATCH');
    const attached=Object.keys(c.NetworkSettings?.Networks??{}).sort();
    if(s.network_mode==='none')assert(h.NetworkMode==='none'&&attached.length<=1&&attached.every(n=>n==='none'),'LOCAL_EFFECTIVE_NETWORK_MISMATCH');
    else{const configured=Array.isArray(s.networks)?s.networks:Object.keys(s.networks??{});assert.deepEqual(attached,configured.map((n:string)=>this.p.consumer.project+'_'+n).sort(),'LOCAL_EFFECTIVE_NETWORK_MISMATCH');}
    assert(!h.ExtraHosts?.length&&!h.Dns?.length&&!h.DnsSearch?.length&&!h.DnsOptions?.length,'LOCAL_EFFECTIVE_DNS_OVERRIDE');
    const caps=(values:string[]=[])=>values.map(v=>v.replace(/^CAP_/,'')).sort();assert.deepEqual(caps(h.CapDrop??[]),caps(s.cap_drop??[]),'LOCAL_EFFECTIVE_CAPABILITY_MISMATCH');assert.deepEqual(caps(h.CapAdd??[]),caps(s.cap_add??[]),'LOCAL_EFFECTIVE_CAPABILITY_MISMATCH');
    assert.equal(h.ReadonlyRootfs,!!s.read_only,'LOCAL_EFFECTIVE_ROOTFS_MISMATCH');assert(h.SecurityOpt?.includes('no-new-privileges')||h.SecurityOpt?.includes('no-new-privileges:true'),'LOCAL_EFFECTIVE_SECURITY_MISMATCH');
    for(const m of c.Mounts??[])assert(s.volumes?.some((v:any)=>v.target===m.Destination&&m.RW===!v.read_only&&(v.type==='volume'?m.Type==='volume'&&m.Name===this.p.consumer.project+'_'+v.source:m.Type==='bind'&&m.Source===v.source))||Object.entries(this.config.secrets).some(([key,v]:[string,any])=>m.Source===v.file&&m.RW===false&&m.Destination==='/run/secrets/'+key),'LOCAL_EFFECTIVE_MOUNT_ESCAPE');
  }
  async launch(){
    this.mutationAttempted=true;
    try{
      await this.run('create',this.compose(['create','--no-build','--pull','never',...SERVICES]));await this.inventory();
      await this.run('dependencies',this.compose(['up','--detach','--no-recreate','--no-build','--pull','never',...SERVICES.slice(0,6)]));
      await this.run('migrate',this.compose(['start','--attach','migrator']));
      const migrator=this.resources.find(r=>r.name.endsWith('-migrator'))!;const c=(await this.json('migrator-exit',['container','inspect',migrator.id]))[0];assert(!c.State.Running&&c.State.ExitCode===0&&!c.State.OOMKilled,'LOCAL_MIGRATION_INCOMPLETE');
      await this.run('start',this.compose(['up','--detach','--no-recreate','--no-deps','--no-build','--pull','never','web-1','reverse-proxy']));await this.inventory();
      await this.run('readiness',this.compose(['exec','-T','web-1','/nodejs/bin/node','dist/portable/runtime-command.mjs','health-probe']));
    }finally{this.save();}
  }
  private async servingTarget(signal?:AbortSignal){
    const ids=this.resources.filter(r=>r.kind==='container').map(r=>r.id);assert(ids.length===SERVICES.length,'LOCAL_RESOURCE_INVENTORY_INCOMPLETE');
    const all=JSON.parse(await this.run('serving-target',['container','inspect',...ids],signal));all.forEach((c:any)=>{this.verifyContainer(c);this.verifyNetworkIds(c);});
    const web=all.find((c:any)=>c.Config.Labels['com.docker.compose.service']==='web-1');assertRunningImage(this.r,web);
    const pin=(service:string)=>{const reference=this.config.services[service].image;return {reference,imageConfigDigest:this.images.get(reference).Id};};
    assertHttpTarget(all,web.Id,this.r.runId,this.p.consumer.workspace,{proxy:pin('reverse-proxy'),postgres:pin('postgres')},{kind:'LOCAL_LAPTOP',runId:this.p.consumer.runId,project:this.p.consumer.project,secretRoot:this.root});
    return String(web.Id);
  }
  async bind():Promise<LabAdapter|null>{
    const containerId=await this.servingTarget();
    const rebind=async(signal:AbortSignal)=>assert.equal(await this.servingTarget(signal),containerId,'CERTIFICATE_SERVING_TARGET_CHANGED');
    const readback=async(probe:string,signal:AbortSignal)=>JSON.parse(await this.run('certificate-readback',['exec','-e','PORTABLE_ACCEPTANCE_READBACK=true',containerId,'/nodejs/bin/node','dist/portable/acceptance-readback.mjs',probe],signal));
    const signal=this.signal??new AbortController().signal;
    await this.inputProvisioner(this.p,this.r,this.root,containerId,{rebind,readback,
      fixture:async(input,signal)=>JSON.parse(await this.run('certificate-fixture',['exec','-i','-e','PORTABLE_ACCEPTANCE_FIXTURE=production-OFF','-e','STAGING_SYNTHETIC_SEED_OPT_IN=true',containerId,'/nodejs/bin/node','dist/portable/acceptance-fixture.mjs'],signal,input)),
      ca:async signal=>{await rebind(signal);const proxy=this.resources.find(r=>r.name===this.p.consumer.project+'-reverse-proxy');assert(proxy,'CERTIFICATE_PROXY_REQUIRED');return this.run('certificate-ca',['exec',proxy.id,'cat','/data/caddy/pki/authorities/local/root.crt'],signal);}},signal);
    return this.adapterFactory(this.p,this.r,this.root,containerId,rebind,readback);
  }
  async cleanup(){
    if(!this.reserved||!this.mutationAttempted)return 'COMPLETE' as const;
    if(!this.settled)return 'RETAINED' as const;
    // Reconcile after every settled mutation, including partial failed creation.
    // A label mismatch retains everything rather than deleting a stale inventory.
    try{await this.inventory(true);}catch{return 'RETAINED' as const;}
    let failed=false;
    for(const r of [...this.resources].sort((a,b)=>['container','network','volume'].indexOf(a.kind)-['container','network','volume'].indexOf(b.kind))){
      try{
        const v=(await this.json('cleanup-owner',[r.kind,'inspect',r.id]))[0];assert(matches(r.kind==='container'?v.Config?.Labels:v.Labels,this.p),'LOCAL_CLEANUP_FOREIGN');
        if(r.kind==='container'){
          assert.equal(v.Id,r.id);if(v.State.Running)await this.run('cleanup-stop',['container','stop','--time','5',r.id]);
          const stopped=(await this.json('cleanup-settled',['container','inspect',r.id]))[0];assert(!stopped.State.Running);await this.run('cleanup-remove',['container','rm',r.id]);
        }else if(r.kind==='network'){assert.equal(v.Id,r.id);assert.equal(Object.keys(v.Containers??{}).length,0);await this.run('cleanup-remove',['network','rm',r.id]);}
        else{assert.equal(v.Name,r.name);assert.equal((await this.run('cleanup-volume-refs',['container','ls','--all','--filter','volume='+r.name,'--format','{{.ID}}'])).trim(),'');await this.run('cleanup-remove',['volume','rm',r.name]);}
      }catch{failed=true;} // deletion denial is retained, never retried through another wrapper
    }
    if(!failed)try{for(const kind of ['container','network','volume'])assert.equal((await this.run('cleanup-absence-'+kind,[kind,'ls',...(kind==='container'?['--all']:[]),'--filter','label=io.nps.consumer.project='+this.p.consumer.project,'--format',kind==='container'?'{{.ID}}':'{{.Name}}'])).trim(),'','LOCAL_CLEANUP_RESIDUE');}catch{failed=true;}
    this.save();return failed?'RETAINED' as const:'COMPLETE' as const;
  }
  async record(result:any){if(!this.reserved)return;this.assertOutput();if(result.report)await writeReports(this.root,result.report);writeFileSync(path.join(this.root,'connection-result.json'),JSON.stringify({...result,report:undefined}),{flag:'wx',mode:0o600});}
  markUnsettled(){this.settled=false;this.save();}
}

export function createLocalLifecycle(p:ConsumerProfile,r:ArtifactReceipt,signal?:AbortSignal):Lifecycle {
  let sequence=0;const unsettled=new Set<number>();
  const docker=path.join(process.env.ProgramFiles??'C:\\Program Files','Docker/Docker/resources/bin/docker.exe');
  const config=path.join(homedir(),'.docker');
  const processPort:DockerProcess=async(stage,args,root,signal,input)=>{
    assert(process.platform==='win32'&&existsSync(docker),'LOCAL_DOCKER_TOOL_UNAVAILABLE');canonicalDirectory(config);
    if(!root){
      // This early read-only phase has no owned output yet. Fixed query only,
      // no shell, bounded capture, and no caller-selected command.
      const {execFileSync}=await import('node:child_process');
      return execFileSync(docker,['--config',config,...args],{encoding:'utf8',timeout:p.scope.phaseTimeoutMs,maxBuffer:p.scope.outputLimitBytes,windowsHide:true,env:{NODE_ENV:'production',PATH:process.env.PATH,SystemRoot:process.env.SystemRoot}});
    }
    const receipt=await captureProductProcess({stage,tool:docker,args:['--config',config,...args],timeoutMs:p.scope.phaseTimeoutMs},root,++sequence,unsettled,signal,{maxOutputBytes:p.scope.outputLimitBytes,stdin:input});
    if(!receipt.settled){life.markUnsettled();throw Error('LOCAL_CHILD_UNSETTLED');}
    assert(receipt.exit===0&&!receipt.timedOut&&!receipt.interrupted&&!receipt.startupFailed&&!receipt.ioFailed&&receipt.stdoutBytes+receipt.stderrBytes<=p.scope.outputLimitBytes,'LOCAL_CHILD_FAILED_OR_PARTIAL');
    return readFileSync(path.join(root,'process-'+sequence+'.stdout'),'utf8');
  };
  const life=new LocalLifecycle(p,r,processPort,signal);return life;
}
