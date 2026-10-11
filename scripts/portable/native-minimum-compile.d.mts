import type {EventEmitter} from "node:events";
import type {IncomingMessage} from "node:http";

export type SodiumResponse = Pick<IncomingMessage,"statusCode"|"headers"> & Pick<EventEmitter,"on"> & {destroy():unknown};
export type SodiumRequest = Pick<EventEmitter,"on"> & {end():unknown;destroy():unknown};
export type SodiumRequestFactory = (url:string,options:{method:"GET";agent:false;headers:{Accept:string}},response:(incoming:SodiumResponse)=>void)=>SodiumRequest;
export type SodiumFileReceipt = {name:string;bytes:number;sha256:string};
export type SodiumDownload = (name:string,destination:string)=>Promise<SodiumFileReceipt>;
export function sodiumArchiveDownload(name:string,destination:string,request?:SodiumRequestFactory):Promise<SodiumFileReceipt>;
export function prepareWindowsSodium(lockText:string,environment:Readonly<Record<string,string|undefined>>,download?:SodiumDownload):Promise<{directory:string;files:SodiumFileReceipt[];cleanup:()=>void}>;
export type SodiumCompilation<T> = {status:"RETURNED";value:T}|{status:"THREW";error:unknown};
export type SodiumCompilationReceipt<T> = {compilation:SodiumCompilation<T>;files:SodiumFileReceipt[];dependencyCleanup:"VERIFIED"|"UNRECONCILED";dependencyCleanupFailure:string|null};
export function withPreparedWindowsSodium<T>(lockText:string,environment:Readonly<Record<string,string|undefined>>,compile:(environment:Record<string,string|undefined>,files:SodiumFileReceipt[])=>T|Promise<T>,download?:SodiumDownload):Promise<SodiumCompilationReceipt<T>>;
export function minimumCompilerExitCode(result:{status:number|null;signal?:string|null;error?:unknown},dependencyCleanup:"NOT_EXECUTED"|"VERIFIED"|"UNRECONCILED"):number;
export function minimumCompile():Promise<void>;
