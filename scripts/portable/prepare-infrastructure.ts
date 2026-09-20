import {execFileSync} from "node:child_process";
import {mkdirSync,readFileSync,writeFileSync} from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {admitArtifact,admitSyntheticArtifact} from "./admit-artifact";
import {hashBytes} from "./artifact-handoff";
// No application rebuild/pull. Only the inherited exact infrastructure references are loaded.
const synthetic=process.argv[2]==="--synthetic";
if(process.argv[2]&&!synthetic)throw Error("INFRASTRUCTURE_PHASE_INVALID");
const receipt=synthetic?admitSyntheticArtifact(path.resolve("artifact-evidence-synthetic"),readFileSync(path.resolve("tmp/portable-staging",`nalanda-ci-${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}-capability`,"trust.json"))):admitArtifact(path.resolve("artifact-evidence"));
const run=(tool:string,args:string[])=>execFileSync(tool,args,{encoding:"utf8",timeout:10*60_000,maxBuffer:32*1024*1024,stdio:["ignore","pipe","pipe"]});
const config=JSON.parse(run("docker",["--context","default","compose","-f","deploy/portable/compose.yml","config","--format","json"]));
const references=[...new Set<string>(Object.values(config.services).map((s:any)=>s.image))].filter(image=>image!==receipt.imageConfigDigest);
assert.equal(references.length,5);
const root=path.resolve(synthetic?"artifact-evidence-synthetic/infrastructure":"artifact-evidence/infrastructure");mkdirSync(root,{mode:0o700});
const results=[];
for(const reference of references){
 assert(/^[^\s]+@sha256:[a-f0-9]{64}$/.test(reference));
 run("docker",["--context","default","pull","--platform",`linux/${receipt.architecture}`,reference]);
 const image=JSON.parse(run("docker",["--context","default","image","inspect",reference]))[0];assert.equal(image.Architecture,receipt.architecture);assert.equal(image.Os,"linux");assert(image.RepoDigests.some((d:string)=>d.endsWith(reference.slice(reference.indexOf("@")))));
 const key=hashBytes(reference),trivy=path.join(root,key+".trivy.json"),grype=path.join(root,key+".grype.json");
 run("trivy",["image","--cache-dir",path.resolve(".cache/trivy"),"--format","json","--output",trivy,"--list-all-pkgs","--severity","HIGH,CRITICAL","--ignore-unfixed=false","--exit-code","1",image.Id]);
 run("grype",[image.Id,"--output","json","--file",grype,"--fail-on","high","--only-fixed=false"]);
 const t=JSON.parse(readFileSync(trivy,"utf8")),g=JSON.parse(readFileSync(grype,"utf8"));
 assert.equal(t.Metadata?.ImageID,image.Id);assert(Array.isArray(t.Results)&&t.Results.some((r:any)=>r.Class==="os-pkgs"));
 for(const r of t.Results){assert(!r.ModifiedFindings?.length);for(const v of r.Vulnerabilities??[])assert(["LOW","MEDIUM","NEGLIGIBLE"].includes(v.Severity));}
 assert.equal(g.source?.target?.imageID,image.Id);assert(Array.isArray(g.matches));for(const m of [...g.matches,...(g.ignoredMatches??[])])assert(["Low","Medium","Negligible"].includes(m.vulnerability?.severity));
 const metadataFile=path.join(root,key+".scanner-metadata.json");
 execFileSync(process.execPath,["scripts/portable/scanner-metadata.mjs",metadataFile,grype],{encoding:"utf8",timeout:60_000,env:{...process.env,TRIVY_CACHE_DIR:path.resolve(".cache/trivy"),TRIVY_ACTION_OUTCOME:"success",GRYPE_ACTION_OUTCOME:"success"}}); // both immediately preceding scanner processes exited zero
 const metadata=JSON.parse(readFileSync(metadataFile,"utf8"));
 for(const name of ["trivy","grype"]){const m=metadata[name],age=Date.now()-Date.parse(m.databaseUpdatedAt);assert(age>=0&&age<=72*3600_000);assert(/^[a-f0-9]{64}$/.test(m.databaseSha256));assert(typeof m.version==="string"&&m.version);assert.equal(m.exitCode,0);assert.equal(m.ignoreUnfixed,false);assert.equal(m.severityThreshold,"HIGH");}
 assert.equal(metadata.grype.version,g.descriptor.version);
 results.push({reference,scannerMetadataSha256:hashBytes(readFileSync(metadataFile)),imageConfigDigest:image.Id,architecture:receipt.architecture,trivySha256:hashBytes(readFileSync(trivy)),grypeSha256:hashBytes(readFileSync(grype))});
}
writeFileSync(path.join(root,"receipt.json"),JSON.stringify({source:receipt.source,results}),{flag:"wx",mode:0o600});
