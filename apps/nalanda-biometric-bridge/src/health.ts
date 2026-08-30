import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
export function writeLocalHealth(file:string,input:{status:string;queueDepth:number;configuredDevices:number;lastPollAt?:string;lastSyncAt?:string;lastErrorCode?:string}){mkdirSync(path.dirname(file),{recursive:true});const temp=`${file}.${process.pid}.partial`;writeFileSync(temp,JSON.stringify({schemaVersion:1,...input,updatedAt:new Date().toISOString()},null,2),{encoding:"utf8",mode:0o600});renameSync(temp,file);}
