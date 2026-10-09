import {describe,it,expect,vi} from "vitest";
import {readFileSync} from "node:fs";
import type {SpawnSyncReturns} from "node:child_process";
import {runWindowsCompilerCommands} from "../scripts/portable/windows-compiler-ci.mjs";
type Runner=NonNullable<Parameters<typeof runWindowsCompilerCommands>[1]>;
const result=(status:number|null,error?:NodeJS.ErrnoException):SpawnSyncReturns<Buffer>=>({pid:12345,output:[],stdout:Buffer.alloc(0),stderr:Buffer.alloc(0),status,signal:null,error});
describe("SOURCE_ONLY fixed hosted Windows compiler sequencing",()=>{
 it("keeps all three original commands ordered and gives each child a copied environment",()=>{
  const env=Object.freeze({RUSTUP_TOOLCHAIN:"1.97.1",SODIUM_DIST_DIR:"INVENTED_OWNED_FIXTURE"});
  const run=vi.fn<Runner>(()=>result(0)),observe=vi.fn();
  expect(runWindowsCompilerCommands(env,run,observe).passed).toBe(true);
  expect(run.mock.calls.map(x=>x[0])).toEqual(["pwsh","pwsh","pwsh"]);
  expect(run.mock.calls.map(x=>x[1])).toEqual([
   ["-NoLogo","-NoProfile","-NonInteractive","-Command","$ErrorActionPreference='Stop'; & pnpm app:rust:test --locked; if ($null -eq $LASTEXITCODE) { throw 'WINDOWS_COMPILER_EXIT_MISSING' }; exit $LASTEXITCODE"],
   ["-NoLogo","-NoProfile","-NonInteractive","-Command","$ErrorActionPreference='Stop'; & pnpm exec tsx scripts/portable/qa-native-profile-compile.ts --integration-test; if ($null -eq $LASTEXITCODE) { throw 'WINDOWS_COMPILER_EXIT_MISSING' }; exit $LASTEXITCODE"],
   ["-NoLogo","-NoProfile","-NonInteractive","-Command","$ErrorActionPreference='Stop'; & pnpm app:windows:build -- --locked; if ($null -eq $LASTEXITCODE) { throw 'WINDOWS_COMPILER_EXIT_MISSING' }; exit $LASTEXITCODE"]
  ]);
  for(const call of run.mock.calls){expect(call[2].env).toEqual(env);expect(call[2].env).not.toBe(env);expect(call[2].timeout).toBe(2700000);}
  expect(observe).toHaveBeenCalledTimes(3);
 });
 it.each([0,1,2])("stops after command %i fails, without rerun or later compilation",index=>{
  let calls=0;const run=vi.fn<Runner>(()=>result(calls++===index?17:0));
  const output=runWindowsCompilerCommands({},run);
  expect(output.passed).toBe(false);expect(run).toHaveBeenCalledTimes(index+1);expect(output.phases.at(-1)?.exitCode).toBe(17);
 });
 it("retains a launch failure without emitting its private message or invoking a later command",()=>{
  const error=Object.assign(Error("PRIVATE_SYNTHETIC_PATH"),{code:"ENOENT"}),run=vi.fn<Runner>(()=>result(null,error));
  const output=runWindowsCompilerCommands({},run);
  expect(output).toEqual({passed:false,phases:[{command:"pnpm app:rust:test --locked",exitCode:null,signal:null,errorCode:"ENOENT"}]});
  expect(run).toHaveBeenCalledTimes(1);expect(JSON.stringify(output)).not.toContain(error.message);
 });
 it("keeps the existing workflow job/toolchain/cap and invokes the reviewed wrapper before package checksums",()=>{
  const workflow=readFileSync(".github/workflows/cross-platform-apps.yml","utf8").split("\n  windows:")[1].split("\n  android:")[0];
  expect(workflow).toContain("timeout-minutes: 45");expect(workflow).toContain('RUSTUP_TOOLCHAIN: "1.97.1"');
  expect(workflow.indexOf("node scripts/portable/windows-compiler-ci.mjs")).toBeLessThan(workflow.indexOf("Write Windows package checksum"));
  expect(workflow).not.toMatch(/ExecutionPolicy|Bypass|Unrestricted|Unblock-File/);
 });
});
