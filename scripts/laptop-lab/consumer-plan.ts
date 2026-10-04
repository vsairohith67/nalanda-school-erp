import path from 'node:path';
import { RUNTIME_ADMISSION_HOLD } from '../portable/artifact-handoff';
import { validateConsumerProfile, profileHash, assertLocalEnvironment } from './consumer-profile';
import {codeIdentity} from './consumer-identity';
import type { ConsumerProfile } from './consumer-types';
export const SERVICES=['postgres','valkey','object-store-permissions','object-store','object-bootstrap','object-init','migrator','web-1','reverse-proxy'] as const;
export const NETWORKS=['edge','application','data','backup-data'] as const;
export const VOLUMES=['postgres-data','object-data'] as const;
export function consumerNames(p:ConsumerProfile){
  return {containers:SERVICES.map(service=>({service,name:p.consumer.project+'-'+service})),networks:NETWORKS.map(key=>p.consumer.project+'_'+key),volumes:VOLUMES.map(key=>p.consumer.project+'_'+key)};
}
export function planConsumer(raw:unknown,workspace:string,env:Record<string,string|undefined>=process.env){
  assertLocalEnvironment(env);const p=validateConsumerProfile(raw,workspace),names=consumerNames(p);
  return {contract:'NPS_LAPTOP_CONSUMER_PLAN_V1',classification:'PLANNED_NOT_EXECUTED',runtimeSideEffects:0,
    code:codeIdentity(workspace),profileSha256:profileHash(p),producer:p.producer,consumer:p.consumer,
    effectiveEndpoint:{state:'UNPROBED_UNTIL_ADMISSION',expected:p.consumer.endpoint},
    requiredInputs:[...(!p.producer.runId||!p.producer.attempt||!p.producer.provenanceSha256?['PRODUCER_RAW_CI_EVIDENCE']:[]),'PRODUCER_WITH_REVIEWED_OPERATION_HELPERS','QUALIFIED_ARTIFACT_ADMISSION','LOCAL_CONSUMER_PROFILE_AUTHORIZATION','TASK_BOUND_PRIVATE_FIXTURE_AND_SECRET_BUNDLE','ISSUED_SESSION_AND_CA_AND_SERVED_DATABASE_IDENTITY'],
    enforcementPoints:['PRODUCER_OPERATION_SOURCE_REQUIRED',RUNTIME_ADMISSION_HOLD,'LOCAL_CONSUMER_PROFILE_NOT_AUTHORIZED','CERTIFICATE_SESSION_INPUT_REQUIRED'],
    resources:names,scope:p.scope,exposure:{host:'127.0.0.1',port:8443,origin:p.scope.origin},
    lifecycle:['verify raw producer evidence','unchanged runtime admission','consumer authorization','resolve exact local endpoint','reserve owned output','refuse resource collisions','inspect exact local images','render and validate existing portable recipe','create and record owned resources','start owned dependencies/migrator/web/proxy','bind serving image/database/fixture','existing scenario runner','existing JSON/CSV/HTML','settle exact owned containers then networks/volumes'],
    scenarios:p.scope.operations.map(operation=>({operation,harnessAdapter:'CONTROLLED_TRANSPORT_SOURCE_TEST',realAdapter:'AUTHENTICATED_OPERATION_ADAPTER',status:'IMPLEMENTED_EXECUTION_GATED',fallback:false})),
    reports:{writer:'existing laptop-lab report/output',root:path.join(workspace,'scripts/laptop-lab/outputs',p.consumer.outputName),measurement:'NOT_EXECUTED',hostCapacityClaim:false},
    cleanup:{exactNewResourcesOnly:true,requireOwnership:true,requireSettledProcesses:true,force:false,prune:false,retainOnRefusal:true},
    profileApproved:false,artifactAdmitted:false,erpExecuted:false};
}
