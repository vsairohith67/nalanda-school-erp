import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {parseReferenceObservation,type ReferenceObservation} from "../../lib/native-app/reference-observation";
import type {RefreshState} from "../../apps/nalanda-cross-platform/src/reference-refresh";
import type {NativeWebDriver} from "./native-webdriver";
export function assertReferenceStored(value:unknown,previous:string|null):RefreshState&{observation:ReferenceObservation;profile:string}{
 const v=value as RefreshState;
 assert(v&&typeof v.operationId==="string"&&/^[a-f0-9-]{36}$/.test(v.operationId)&&v.operationId!==previous,"WINDOWS_REFERENCE_ACTION_MISSING");
 assert(v.source==="MANUAL"&&v.stage==="STORED","WINDOWS_REFERENCE_STORAGE_NOT_PROVEN");
 parseReferenceObservation(v.observation);assert(typeof v.profile==="string"&&v.profile.length<=256,"WINDOWS_REFERENCE_PROFILE_REQUIRED");
 return v as RefreshState&{observation:ReferenceObservation;profile:string};
}
export function assertReferenceCorrelated(local:ReturnType<typeof assertReferenceStored>,server:ReferenceObservation|null|undefined,expected:{userId:string;sessionId:string;deviceId:string;publicDeviceId:string;profile:string;students:string[]}){
 assert(server,"WINDOWS_REFERENCE_RESPONSE_NOT_OBSERVED");parseReferenceObservation(server);
 assert.deepEqual(local.observation,server,"WINDOWS_REFERENCE_SNAPSHOT_MISMATCH");assert.equal(local.profile,expected.profile,"WINDOWS_REFERENCE_PROFILE_MISMATCH");
 for(const k of ["userId","sessionId","deviceId","publicDeviceId"] as const)assert.equal(server[k],expected[k],"WINDOWS_REFERENCE_IDENTITY_MISMATCH");
 assert.equal(server.studentCount,expected.students.length,"WINDOWS_REFERENCE_POPULATION");
 assert.equal(server.populationHash,createHash("sha256").update(JSON.stringify([...expected.students].sort())).digest("hex"),"WINDOWS_REFERENCE_SCOPE");
}
export async function refreshWindowsReferences(app:NativeWebDriver,expected:string[]){
 await app.clickText("Security");
 const read=async()=>{const raw=await app.command("POST","/execute/sync",{script:"return document.querySelector('[data-reference-refresh]')?.getAttribute('data-reference-refresh') ?? null",args:[]});return raw===null?null:JSON.parse(raw);};
 const previous=(await read())?.operationId??null;
 // Initial or historical cache need not contain any Students or completion text.
 const button=await app.element("xpath","//button[normalize-space(.)='Refresh encrypted reference data' or normalize-space(.)='Download encrypted reference data']");
 await app.command("POST",`/element/${button}/click`,{});
 let receipt:ReturnType<typeof assertReferenceStored>|undefined;
 for(let i=0;i<30;i++){
  const state=await read();
  if(state&&state.operationId!==previous&&state.source==="MANUAL"){
   assert(!["FAILED","CANCELLED"].includes(state.stage),"WINDOWS_REFERENCE_REFRESH_FAILED");
   if(state.stage==="STORED"){receipt=assertReferenceStored(state,previous);break;}
  }
  await new Promise(resolve=>setTimeout(resolve,500));
 }
 assert(receipt,"WINDOWS_REFERENCE_ACTION_NOT_COMPLETED");await app.clickText("Workspace");
 const values=await app.command("POST","/execute/sync",{script:"const label=Array.from(document.querySelectorAll('label')).find(e=>e.textContent.startsWith('Student reference'));return label?.querySelector('select') ? Array.from(label.querySelector('select').options).map(o=>o.value).filter(Boolean) : null",args:[]});
 assert.deepEqual(values?.sort(),[...expected].sort(),"WINDOWS_RENDERED_REFERENCE_SCOPE");return receipt;
}
