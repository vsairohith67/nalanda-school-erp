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
const root=path.resolve("artifact-evidence");mkdirSync(root); // no overwrite/reuse of another run
const files:Record<string,Buffer>={};
const copy=(name:string,bytes:Buffer)=>{files[name]=bytes;writeFileSync(path.join(root,name),bytes,{flag:"wx",mode:0o600});};
const blob=(descriptor:any)=>{if(!/^sha256:[a-f0-9]{64}$/.test(descriptor.digest??""))throw Error("OCI_DESCRIPTOR_INVALID");const file=path.resolve("oci-layout/blobs/sha256",descriptor.digest.slice(7)),stat=lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||realpathSync(file)!==file||stat.size!==descriptor.size)throw Error("OCI_BLOB_UNSAFE");const bytes=readFileSync(file);if("sha256:"+hashBytes(bytes)!==descriptor.digest)throw Error("OCI_BLOB_SUBSTITUTED");return bytes;};
const indexBytes=readFileSync("oci-layout/index.json"),index=JSON.parse(indexBytes.toString());if(index.manifests?.length!==1)throw Error("SINGLE_ARCH_REQUIRED");
const manifestBytes=blob(index.manifests[0]),manifest=JSON.parse(manifestBytes.toString()),configBytes=blob(manifest.config);
for(const layer of manifest.layers)blob(layer);
copy("index.json",indexBytes);copy("manifest.json",manifestBytes);copy("config.json",configBytes);
for(const [name,file] of [["trivy.json","trivy-results.json"],["grype.json","grype-results.json"],["sbom.json","sbom.spdx.json"],["scanner-metadata.json","scanner-metadata.json"]])copy(name,readFileSync(file));
const probe=JSON.parse(readFileSync("native-dependencies.json","utf8"));
if(probe.nativeLoad!=="PASSED"||probe.platform!=="linux"||(probe.architecture==="x64"?"amd64":probe.architecture)!==architecture||probe.emulationUsed!==false)throw Error("NATIVE_PROBE_FAILED");
copy("native.json",Buffer.from(JSON.stringify({architecture,imageConfigDigest:manifest.config.digest,result:probe.nativeLoad,rawProbeSha256:hashBytes(readFileSync("native-dependencies.json"))})));
const inputs=Object.fromEntries(["Dockerfile","pnpm-lock.yaml","package.json","pnpm-workspace.yaml","deploy/portable/compose.yml"].map(file=>[file,hashBytes(readFileSync(file))]));
const baseImages=resolveBaseImages(readFileSync("Dockerfile","utf8"));
const metadata=JSON.parse(files['scanner-metadata.json'].toString());
copy("provenance.json",Buffer.from(JSON.stringify({contract:ARTIFACT_CONTRACT,classification:"HOSTED_EXACT_IMAGE_EVIDENCE",source,architecture,runId:process.env.GITHUB_RUN_ID,attempt:process.env.GITHUB_RUN_ATTEMPT,generatedAt:new Date().toISOString(),inputs,baseImages,scannerVersions:{trivy:metadata.trivy?.version},receipts:EVIDENCE_NAMES.filter(name=>name!=="provenance.json").map(name=>({name,sha256:hashBytes(files[name])}))})));
verifyArtifactEvidence(files,{source,architecture,runId:process.env.GITHUB_RUN_ID!,attempt:process.env.GITHUB_RUN_ATTEMPT!,now:Date.now(),inputs,baseImages});
console.log("ARTIFACT_BYTES_BOUND_NOT_RUNTIME_ADMISSION");
