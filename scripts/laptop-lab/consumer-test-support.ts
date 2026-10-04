// Invented, explicitly HARNESS_ONLY records. No images, sockets, databases or
// secret material. This file is imported by focused tests, never the CLI.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { EVIDENCE_NAMES, ARTIFACT_CONTRACT, hashBytes, resolveBaseImages, type EvidenceFiles } from '../portable/artifact-handoff';
import { exampleConsumerProfile } from './consumer-profile';
import { SERVICES, NETWORKS, VOLUMES } from './consumer-plan';
import { LocalLifecycle, type DockerProcess } from './consumer-lifecycle';
import type { ConnectionPorts } from './consumer-connection';
import type { ConsumerProfile, LabAdapter } from './consumer-types';
import {boundCertificateAdapter} from './consumer-operation-ports';
import { VirtualClock } from './fixture.mjs';
export function evidenceFixture(workspace:string,runId:string){
  const profile=exampleConsumerProfile(workspace,runId),now=Date.parse('2026-10-04T00:00:00Z');
  const inputs=Object.fromEntries(['Dockerfile','pnpm-lock.yaml','package.json','deploy/portable/compose.yml'].map(file=>[file,hashBytes(readFileSync(path.join(workspace,file)))]));
  const baseImages=resolveBaseImages(readFileSync(path.join(workspace,'Dockerfile'),'utf8'));
  const files:EvidenceFiles={};const put=(key:string,value:unknown)=>files[key]=Buffer.from(JSON.stringify(value));
  put('config.json',{os:'linux',architecture:'amd64',config:{User:'65532:65532',Labels:{'org.opencontainers.image.revision':profile.producer.source}}});
  const image='sha256:'+hashBytes(files['config.json']);
  put('manifest.json',{schemaVersion:2,config:{digest:image,size:files['config.json'].length},layers:[{digest:'sha256:'+'e'.repeat(64),size:27}]});
  put('index.json',{schemaVersion:2,manifests:[{digest:'sha256:'+hashBytes(files['manifest.json']),size:files['manifest.json'].length}]});
  put('sbom.json',{spdxVersion:'SPDX-2.3',packages:[{name:'HARNESS_FIXTURE_ONLY'}]});
  put('trivy.json',{SchemaVersion:2,Metadata:{ImageID:image},Results:[{Target:'HARNESS_FIXTURE_ONLY',Class:'os-pkgs',Type:'fixture-os',Vulnerabilities:[]},{Target:'app',Class:'lang-pkgs',Type:'node-pkg',Vulnerabilities:[]}]});
  put('grype.json',{source:{target:{imageID:image}},descriptor:{version:'fixture-1'},matches:[]});
  const scanner={version:'fixture-1',databaseUpdatedAt:new Date(now).toISOString(),databaseSha256:'f'.repeat(64),ignoreUnfixed:false,severityThreshold:'HIGH',exitCode:0};
  put('scanner-metadata.json',{trivy:scanner,grype:scanner});put('native.json',{architecture:'amd64',imageConfigDigest:image,result:'PASSED'});
  profile.producer.runId='123';profile.producer.attempt='1';
  const refresh=()=>{
    put('provenance.json',{contract:ARTIFACT_CONTRACT,classification:'HARNESS_FIXTURE_ONLY',source:profile.producer.source,architecture:'amd64',runId:'123',attempt:'1',generatedAt:new Date(now).toISOString(),inputs,baseImages,scannerVersions:{trivy:'fixture-1'},receipts:EVIDENCE_NAMES.filter(n=>n!=='provenance.json').map(name=>({name,sha256:hashBytes(files[name])}))});
    profile.producer.provenanceSha256=hashBytes(files['provenance.json']);
  };refresh();return {profile,files,now,inputs,baseImages,image,refresh};
}
export function simulatedService():LabAdapter {
  const clock=new VirtualClock(),rows=new Map<string,any>([['SIMULATED-A',{id:'SIMULATED-A',status:'SUBMITTED'}]]);
  return {classification:'SIMULATED_SERVICE',clock,drive:promise=>clock.drive(promise),owns:()=>true,sample:()=>({}),
    expected:(op,n)=>op==='certificate_list'?{ids:[...rows.keys()]}:{id:'SIMULATED-'+n,studentId:'SIMULATED-SUBJECT'},
    transport:async({operation,ordinal,signal})=>{await clock.sleep(20,signal);if(operation==='certificate_list')return {status:200,contentType:'application/json',body:{requests:[...rows.values()]}};
      const row={id:'SIMULATED-'+ordinal,studentId:'SIMULATED-SUBJECT',status:'SUBMITTED'};rows.set(row.id,row);return {status:201,contentType:'application/json',body:{request:row},readback:{...row,effectCount:1}};}};
}
export function composeFixture(p:ConsumerProfile,image:string){
  const reference=(name:string)=>name+'@sha256:'+hashBytes(name),root=path.join(p.consumer.workspace,'scripts/laptop-lab/outputs',p.consumer.outputName);
  const config:any={name:p.consumer.project,services:{},networks:Object.fromEntries(NETWORKS.map(n=>[n,{internal:true}])),volumes:Object.fromEntries(VOLUMES.map(n=>[n,{}])),secrets:{database_url:{file:path.join(root,'secrets/database_url')},proxy_shared_secret:{file:path.join(root,'secrets/proxy_shared_secret')},synthetic_director_password:{file:path.join(root,'secrets/synthetic_director_password')}}};
  for(const name of SERVICES)config.services[name]={image:['web-1','migrator','object-init'].includes(name)?image:reference(name),environment:{},networks:['application','data'],volumes:[],secrets:[],cap_drop:['ALL'],security_opt:['no-new-privileges:true'],read_only:true};
  const web=config.services['web-1'];web.environment={DATABASE_URL_FILE:'/run/secrets/database_url',APP_ORIGIN:p.scope.origin,NODE_ENV:'production'};web.secrets=['database_url'];
  const proxy=config.services['reverse-proxy'];proxy.image=reference('caddy');proxy.entrypoint=['/bin/sh','/opt/nalanda/caddy-entrypoint.sh'];proxy.networks=['edge','application'];proxy.ports=[{target:8443,published:'8443',host_ip:'127.0.0.1'}];proxy.volumes=[{type:'bind',source:path.join(p.consumer.workspace,'deploy/portable/Caddyfile'),target:'/etc/caddy/Caddyfile',read_only:true},{type:'bind',source:path.join(p.consumer.workspace,'deploy/portable/caddy-entrypoint.sh'),target:'/opt/nalanda/caddy-entrypoint.sh',read_only:true}];
  const pg=config.services.postgres;pg.image=reference('postgres');pg.networks=['data','backup-data'];pg.volumes=[{type:'volume',source:'postgres-data',target:'/var/lib/postgresql/data'}];return config;
}
export function harnessConnection(f:ReturnType<typeof evidenceFixture>,options:{mutate?:(stage:string,state:any)=>void;response?:(stage:string,result:string)=>string|Promise<string>;adapter?:()=>LabAdapter|null;boundFactory?:typeof boundCertificateAdapter;stageInputs?:boolean;certificateReadback?:(args:string[])=>unknown;certificateFixture?:(input?:Uint8Array)=>unknown}={}){
  const calls:string[]=[],containers=new Map<string,any>(),networks=new Map<string,any>(),volumes=new Map<string,any>();let config:any,life:LocalLifecycle;
  const p=f.profile,base=composeFixture(p,f.image);const state={containers,networks,volumes};
  const dispatch:DockerProcess=async(stage,args,root,_signal,input)=>{
    calls.push(stage);options.mutate?.(stage,state);
    if(stage==='resolve-context')return JSON.stringify([{Endpoints:{docker:{Host:p.consumer.endpoint}}}]);
    if(stage==='resolve-engine')return JSON.stringify({os:'linux',architecture:'x86_64'});
    if(stage.startsWith('collision-'))return '';
    if(stage==='compose-config')return JSON.stringify(base);
    if(stage==='image-inspect'){
      const ref=args.at(-1)!;return JSON.stringify([{Id:ref===f.image?f.image:'sha256:'+hashBytes(ref),Os:'linux',Architecture:'amd64',RepoDigests:[ref],Config:{User:'65532:65532',Labels:{'org.opencontainers.image.revision':p.producer.source}}}]);
    }
    if(stage==='create'){
      config=JSON.parse(readFileSync(path.join(root,'compose.json'),'utf8'));
      for(const [name,n] of Object.entries(config.networks) as any[])networks.set(n.name,{Id:hashBytes(n.name),Name:n.name,Labels:n.labels,Containers:{},Internal:true,Driver:'bridge'});
      for(const [name,v] of Object.entries(config.volumes) as any[])volumes.set(v.name,{Name:v.name,Labels:v.labels,Driver:'local',Options:null});
      for(const [name,s] of Object.entries(config.services) as any[]){
        const id=hashBytes('container:'+s.container_name);containers.set(id,{Id:id,Name:'/'+s.container_name,Image:s.image===f.image?f.image:'sha256:'+hashBytes(s.image),State:{Running:false,ExitCode:0,OOMKilled:false},Config:{Image:s.image,User:'65532:65532',Labels:{...s.labels,'com.docker.compose.project':p.consumer.project,'com.docker.compose.service':name},Env:Object.entries(s.environment).map(([k,v])=>k+'='+v),Entrypoint:s.entrypoint??null,Cmd:null},HostConfig:{NanoCpus:p.scope.cpu*1e9,Memory:p.scope.memoryBytes,MemorySwap:p.scope.memoryBytes,PidsLimit:p.scope.pids,RestartPolicy:{Name:'no'},Privileged:false,PidMode:'',IpcMode:'private',CapDrop:s.cap_drop??[],CapAdd:s.cap_add??[],ReadonlyRootfs:!!s.read_only,SecurityOpt:s.security_opt??[]},NetworkSettings:{Ports:s.ports?{'8443/tcp':[{HostIp:'127.0.0.1',HostPort:'8443'}]}:{},Networks:Object.fromEntries(s.networks.map((n:string)=>[p.consumer.project+'_'+n,{NetworkID:hashBytes(p.consumer.project+'_'+n),Aliases:[name]}]))},Mounts:[...s.volumes.map((v:any)=>({Type:v.type,Destination:v.target,Source:v.type==='bind'?v.source:undefined,Name:v.type==='volume'?p.consumer.project+'_'+v.source:undefined,RW:v.type==='volume'})),...s.secrets.map((key:string)=>({Type:'bind',Destination:'/run/secrets/'+key,Source:config.secrets[key].file,RW:false}))]});
      }return '';
    }
    if(stage==='dependencies'||stage==='start'){for(const c of containers.values())if(['postgres','valkey','object-store','web-1','reverse-proxy'].includes(c.Config.Labels['com.docker.compose.service']))c.State.Running=true;return '';}
    if(stage==='migrate'||stage==='readiness')return '';
    if(stage==='certificate-readback'&&options.certificateReadback)return JSON.stringify(options.certificateReadback(args));
    if(stage==='certificate-fixture'&&options.certificateFixture)return JSON.stringify(options.certificateFixture(input));
    if(stage==='certificate-ca')return '-----BEGIN CERTIFICATE-----\nSYNTHETIC CA operand\n-----END CERTIFICATE-----';
    if(stage.endsWith('owned-container-ids'))return [...containers.keys()].join('\n');
    if(stage.endsWith('owned-network-list'))return [...networks.keys()].join('\n');
    if(stage.endsWith('owned-volume-list'))return [...volumes.keys()].join('\n');
    if(stage==='cleanup-volume-refs')return '';
    if(stage.startsWith('cleanup-absence-'))return stage.endsWith('container')?[...containers.keys()].join('\n'):stage.endsWith('network')?[...networks.keys()].join('\n'):[...volumes.keys()].join('\n');
    if(stage==='cleanup-stop'){containers.get(args.at(-1)!)!.State.Running=false;return '';}
    if(stage==='cleanup-remove'){const kind=args[2],id=args.at(-1)!;if(kind==='container')containers.delete(id);if(kind==='network'){for(const [name,v] of networks)if(v.Id===id)networks.delete(name);}if(kind==='volume')volumes.delete(id);return '';}
    if(args[3]==='inspect'){
      const kind=args[2],ids=args.slice(4);return JSON.stringify(ids.map(id=>kind==='container'?containers.get(id):kind==='network'?[...networks.values()].find(v=>v.Id===id||v.Name===id):volumes.get(id)));
    }
    throw Error('HARNESS_COMMAND_UNEXPECTED_'+stage);
  };
  const process:DockerProcess=async(...args)=>{const result=await dispatch(...args);return options.response?options.response(args[0],result):result;};
  const ports:ConnectionPorts={mode:'HARNESS_ONLY',environment:{},now:()=>f.now,source:()=>({source:p.producer.source,tree:p.producer.tree,inputs:f.inputs,baseImages:f.baseImages}),evidence:()=>f.files,admission:r=>{if(r.classification!=='HARNESS_FIXTURE_ONLY')throw Error('HARNESS_ONLY');},authorize:(profile,r)=>{if(r.runId===profile.consumer.runId)throw Error('IDENTITY_SWAPPED');},
    lifecycle:(profile,r,signal)=>{
      life=new LocalLifecycle(profile,r,process,signal,options.boundFactory??(()=>options.adapter?options.adapter():simulatedService()),options.stageInputs?undefined:()=>{},options.stageInputs?undefined:async()=>{});
      if(!options.stageInputs){const reserve=life.reserve.bind(life);life.reserve=async()=>{await reserve();mkdirSync(path.join(life.root,'secrets'));for(const name of Object.keys(base.secrets))writeFileSync(path.join(life.root,'secrets',name),'invented test placeholder',{flag:'wx'});};}
      return life;
    }};
  return {ports,calls,state,get life(){return life;},process,base};
}
