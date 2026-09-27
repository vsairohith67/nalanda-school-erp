import {it,expect} from "vitest";
import {buildSync} from "esbuild";
import {spawnSync} from "node:child_process";
import {mkdirSync,mkdtempSync,lstatSync,unlinkSync,rmdirSync,readdirSync} from "node:fs";
import path from "node:path";

it("emitted controller executable cannot run an imported CLI entrypoint or expose raw errors",()=>{
 const parent=path.resolve("tmp");mkdirSync(parent,{recursive:true});
 const root=mkdtempSync(path.join(parent,"windows-controller-bundle-")),owned=lstatSync(root),file=path.join(root,"windows-controller.mjs");
 try{
  buildSync({entryPoints:["scripts/portable/windows-controller.ts"],outfile:file,bundle:true,packages:"external",platform:"node",target:"node24",format:"esm",tsconfig:"tsconfig.json",logLevel:"silent"});
  for(const args of [["--controller-worker"],["--discover"],["--off","/private/not-an-input"]]){
   // Malformed input is rejected before artifact admission, credentials, Docker
   // or any DB client. Real Node/bundler execution, not an application server.
   const result=spawnSync(process.execPath,[file,...args],{input:"{}",encoding:"utf8",timeout:10_000,windowsHide:true});
   expect(result.error).toBeUndefined();expect(result.status).toBe(1);expect(result.stdout).toBe("");
   expect(result.stderr).toBe("WINDOWS_CONTROLLER_REFUSED_PRIVATE_DETAILS_WITHHELD\n");
  }
  expect(readdirSync(root)).toEqual(["windows-controller.mjs"]);
 }finally{
  const actual=lstatSync(root);expect(actual.isSymbolicLink()).toBe(false);expect(actual.ino).toBe(owned.ino);expect(actual.dev).toBe(owned.dev);
  const entries=readdirSync(root);expect(entries.every(n=>n==="windows-controller.mjs")).toBe(true);
  if(entries.length){expect(lstatSync(file).isSymbolicLink()).toBe(false);unlinkSync(file);}rmdirSync(root);
 }
});
