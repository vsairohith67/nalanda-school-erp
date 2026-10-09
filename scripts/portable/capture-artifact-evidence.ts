import { producerIdentity, producerPaths, validateProducerRoot, readSigningRoot } from "./synthetic-build-lifecycle";
// Same-runner only. This script creates no public image/archive and grants no admission.
import { execFileSync } from "node:child_process";
import { readFileSync,writeFileSync,mkdirSync,lstatSync,realpathSync } from "node:fs";
import path from "node:path";
import { ARTIFACT_CONTRACT,EVIDENCE_NAMES,hashBytes,verifyArtifactEvidence,resolveBaseImages } from "./artifact-handoff";
import { assertEphemeralCi } from "./operator-adapter";
assertEphemeralCi();
const source=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim();
if(source!==process.env.EXPECTED_SHA)throw Error("EXACT_HEAD_REQUIRED");
const architecture=process.env.TARGET_ARCHITECTURE;
if(architecture!=="amd64"&&architecture!=="arm64")throw Error("ARCHITECTURE_REQUIRED");
const synthetic=process.argv[2]==="--synthetic";
if(process.argv[2]&&!synthetic)throw Error("CAPTURE_ARGUMENT_INVALID");
const work=synthetic?validateProducerRoot(process.cwd(),producerIdentity(),"work"):process.cwd();
const root=synthetic?path.join(work,"evidence"):path.resolve("artifact-evidence");mkdirSync(root,{mode:0o700}); // no overwrite/reuse of another run
const files:Record<string,Buffer>={};
const raw=(relative:string)=>{const file=path.join(work,relative),stat=lstatSync(file);if(!file.startsWith(work+path.sep)||!stat.isFile()||stat.isSymbolicLink()||realpathSync(file)!==file||stat.size>32*1024*1024)throw Error("CAPTURE_INPUT_UNSAFE");return readFileSync(file);};
const input=(file:string)=>synthetic?execFileSync("git",["show",`${source}:${file}`],{maxBuffer:8*1024*1024}):readFileSync(file);
const copy=(name:string,bytes:Buffer)=>{files[name]=bytes;writeFileSync(path.join(root,name),bytes,{flag:"wx",mode:0o600});};
const blob=(descriptor:any)=>{if(!/^sha256:[a-f0-9]{64}$/.test(descriptor.digest??""))throw Error("OCI_DESCRIPTOR_INVALID");const file=path.join(work,"oci-layout/blobs/sha256",descriptor.digest.slice(7)),stat=lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||realpathSync(file)!==file||stat.size!==descriptor.size)throw Error("OCI_BLOB_UNSAFE");const bytes=readFileSync(file);if("sha256:"+hashBytes(bytes)!==descriptor.digest)throw Error("OCI_BLOB_SUBSTITUTED");return bytes;};
const indexBytes=raw("oci-layout/index.json"),index=JSON.parse(indexBytes.toString());if(index.manifests?.length!==1)throw Error("SINGLE_ARCH_REQUIRED");
const manifestBytes=blob(index.manifests[0]),manifest=JSON.parse(manifestBytes.toString()),configBytes=blob(manifest.config);
for(const layer of manifest.layers)blob(layer);
copy("index.json",indexBytes);copy("manifest.json",manifestBytes);copy("config.json",configBytes);
for(const [name,file] of [["trivy.json","trivy-results.json"],["grype.json","grype-results.json"],["sbom.json","sbom.spdx.json"],["scanner-metadata.json","scanner-metadata.json"]])copy(name,raw(file));
const probe=JSON.parse(raw("native-dependencies.json").toString());
if(probe.nativeLoad!=="PASSED"||probe.platform!=="linux"||(probe.architecture==="x64"?"amd64":probe.architecture)!==architecture||probe.emulationUsed!==false)throw Error("NATIVE_PROBE_FAILED");
if(synthetic&&probe.imageConfigDigest!==manifest.config.digest)throw Error("NATIVE_IMAGE_SUBSTITUTED");
copy("native.json",Buffer.from(JSON.stringify({architecture,imageConfigDigest:manifest.config.digest,result:probe.nativeLoad,rawProbeSha256:hashBytes(raw("native-dependencies.json"))})));
const inputs=Object.fromEntries(["Dockerfile","pnpm-lock.yaml","package.json","pnpm-workspace.yaml","deploy/portable/compose.yml"].map(file=>[file,hashBytes(input(file))]));
if(synthetic){
 const file=path.resolve(process.argv[3]??"");
 if(!file.startsWith(path.resolve("tmp/portable-staging")+path.sep)||lstatSync(file).isSymbolicLink()||realpathSync(file)!==file)throw Error("SYNTHETIC_TRUST_FILE_UNSAFE");
 if(file!==path.join(producerPaths().signing,"trust.json"))throw Error("SYNTHETIC_TRUST_FILE_UNSAFE");
 const {bytes,trust}=readSigningRoot(process.cwd(),producerIdentity());
 if(trust.source!==source||trust.runId!==process.env.GITHUB_RUN_ID||trust.attempt!==process.env.GITHUB_RUN_ATTEMPT)throw Error("SYNTHETIC_TRUST_CONTEXT_MISMATCH");
 inputs["synthetic-build-trust.json"]=hashBytes(bytes);
  inputs["config/qa-build-tools.json"]=hashBytes(input("config/qa-build-tools.json"));
}
const baseImages=resolveBaseImages(input("Dockerfile").toString());
const metadata=JSON.parse(files['scanner-metadata.json'].toString());
copy("provenance.json",Buffer.from(JSON.stringify({contract:ARTIFACT_CONTRACT,classification:"HOSTED_EXACT_IMAGE_EVIDENCE",source,architecture,runId:process.env.GITHUB_RUN_ID,attempt:process.env.GITHUB_RUN_ATTEMPT,generatedAt:new Date().toISOString(),inputs,baseImages,scannerVersions:{trivy:metadata.trivy?.version},receipts:EVIDENCE_NAMES.filter(name=>name!=="provenance.json").map(name=>({name,sha256:hashBytes(files[name])}))})));
verifyArtifactEvidence(files,{source,architecture,runId:process.env.GITHUB_RUN_ID!,attempt:process.env.GITHUB_RUN_ATTEMPT!,now:Date.now(),inputs,baseImages,...(synthetic?{purpose:"SYNTHETIC_ACCEPTANCE_ONLY" as const}:{})});
console.log("ARTIFACT_BYTES_BOUND_NOT_RUNTIME_ADMISSION");
