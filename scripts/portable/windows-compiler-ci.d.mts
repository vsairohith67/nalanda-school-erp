import type {SpawnSyncOptions,SpawnSyncReturns} from "node:child_process";
export type CompilerPhase={command:string;exitCode:number|null;signal:string|null;errorCode:string|null};
export function runWindowsCompilerCommands(environment:Readonly<Record<string,string|undefined>>,run?:(file:string,args:string[],options:SpawnSyncOptions)=>SpawnSyncReturns<Buffer>,observe?:(phase:CompilerPhase)=>void):{passed:boolean;phases:CompilerPhase[]};
export function windowsCompilerCi():Promise<void>;
