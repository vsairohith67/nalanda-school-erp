import type {EventEmitter} from "node:events";
import type {IncomingMessage} from "node:http";

export type SodiumResponse = Pick<IncomingMessage,"statusCode"|"headers"> & Pick<EventEmitter,"on"> & {destroy():unknown};
export type SodiumRequest = Pick<EventEmitter,"on"> & {end():unknown;destroy():unknown};
export type SodiumRequestFactory = (url:string,options:{method:"GET";agent:false;headers:{Accept:string}},response:(incoming:SodiumResponse)=>void)=>SodiumRequest;
export type SodiumFileReceipt = {name:string;bytes:number;sha256:string};
export type SodiumDownload = (name:string,destination:string)=>Promise<SodiumFileReceipt>;
export function sodiumArchiveDownload(name:string,destination:string,request?:SodiumRequestFactory):Promise<SodiumFileReceipt>;
export function prepareWindowsSodium(lockText:string,environment:Readonly<Record<string,string|undefined>>,download?:SodiumDownload):Promise<{directory:string;files:SodiumFileReceipt[];cleanup:()=>void}>;
export function minimumCompile():Promise<void>;
