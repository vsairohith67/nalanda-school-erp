export class VirtualClock {
  kind:'VIRTUAL'; time:number;
  now():number; iso():string; sleep(ms:number,signal?:AbortSignal):Promise<void>;
  drive<T>(promise:Promise<T>):Promise<T>;
}
