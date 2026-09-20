import { createHash } from "node:crypto";
import { readFileSync, lstatSync, realpathSync } from "node:fs";
import path from "node:path";

export const RUNTIME_ADMISSION_HOLD = "EXTERNAL_RUNTIME_BLOCKED" as const;
export const ARTIFACT_CONTRACT = "NALANDA_SCANNED_ARTIFACT_V1";
const sha = /^[a-f0-9]{64}$/;
const digest = /^sha256:[a-f0-9]{64}$/;
export const hashBytes = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
export type EvidenceFiles = Record<string, Buffer>;
export type ArtifactContext = {source: string; architecture: "amd64"|"arm64"; runId: string; attempt: string; now: number; inputs: Record<string,string>; baseImages:string[]};
export function resolveBaseImages(dockerfile:string){
 const args=Object.fromEntries([...dockerfile.matchAll(/^ARG ([A-Z_]+)=(\S+)\s*$/gm)].map(m=>[m[1],m[2]])),stages=new Set<string>(),bases:string[]=[];
 for(const match of dockerfile.matchAll(/^FROM (\S+)(?: AS (\S+))?\s*$/gmi)){const raw=match[1],reference=raw.replace(/^\$\{([A-Z_]+)\}$/,(_s,key)=>args[key]??"UNRESOLVED");if(!stages.has(reference)){check(/^[^\s]+@sha256:[a-f0-9]{64}$/.test(reference),"BUILD_BASE_UNPINNED");bases.push(reference);}if(match[2])stages.add(match[2]);}
 check(bases.length>=2,"BUILD_BASES_MISSING");return bases;
}
export const EVIDENCE_NAMES = ["provenance.json","sbom.json","trivy.json","grype.json","scanner-metadata.json","native.json","index.json","manifest.json","config.json"] as const;
export function loadEvidence(root: string): EvidenceFiles {
  const resolved=realpathSync(root);
  return Object.fromEntries(EVIDENCE_NAMES.map(name=>{const file=path.join(resolved,name),stat=lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||realpathSync(file)!==file||stat.size>32*1024*1024)throw Error("EVIDENCE_FILE_UNSAFE");return [name,readFileSync(file)];}));
}
function check(value: unknown, code: string): asserts value { if(!value)throw Error(code); }
/** Validates raw report bytes. A receipt flag is never used as scan evidence. */
export function verifyArtifactEvidence(files: EvidenceFiles, context: ArtifactContext) {
  check(/^[a-f0-9]{40}$/.test(context.source)&&/^\d+$/.test(context.runId)&&/^\d+$/.test(context.attempt),"ARTIFACT_CONTEXT_INVALID");
  for(const name of EVIDENCE_NAMES)check(Buffer.isBuffer(files[name]),"ARTIFACT_EVIDENCE_MISSING");
  const read=(name:string)=>JSON.parse(files[name].toString("utf8"));
  const p=read("provenance.json"),index=read("index.json"),manifest=read("manifest.json"),config=read("config.json"),metadata=read("scanner-metadata.json"),trivy=read("trivy.json"),grype=read("grype.json"),sbom=read("sbom.json"),native=read("native.json");
  check(p.contract===ARTIFACT_CONTRACT,"ARTIFACT_CONTRACT_UNSUPPORTED");
  check(p.source===context.source&&p.architecture===context.architecture&&p.runId===context.runId&&p.attempt===context.attempt,"ARTIFACT_CONTEXT_MISMATCH");
  check(p.classification==="HOSTED_EXACT_IMAGE_EVIDENCE"||p.classification==="HARNESS_FIXTURE_ONLY","ARTIFACT_CLASSIFICATION_INVALID");
  const generated=Date.parse(p.generatedAt);check(Number.isFinite(generated)&&generated<=context.now&&context.now-generated<=6*3600_000,"ARTIFACT_EVIDENCE_STALE");
  check(Array.isArray(p.receipts)&&p.receipts.length===EVIDENCE_NAMES.length-1,"ARTIFACT_RECEIPT_COUNT");
  for(const name of EVIDENCE_NAMES.filter(n=>n!=="provenance.json")){const entries=p.receipts.filter((r:any)=>r.name===name);check(entries.length===1&&entries[0].sha256===hashBytes(files[name]),"ARTIFACT_RECEIPT_CONFLICT");}
  check(Object.keys(context.inputs).length>=3&&Object.hasOwn(context.inputs,"pnpm-lock.yaml")&&Object.hasOwn(context.inputs,"Dockerfile")&&Object.hasOwn(context.inputs,"package.json"),"ARTIFACT_INPUTS_MISSING");
  check(JSON.stringify(Object.keys(p.inputs??{}).sort())===JSON.stringify(Object.keys(context.inputs).sort()),"ARTIFACT_INPUTS_MISMATCH");
  for(const [name,hash] of Object.entries(context.inputs))check(sha.test(hash)&&p.inputs[name]===hash,"ARTIFACT_INPUTS_MISMATCH");
  check(Array.isArray(p.baseImages)&&p.baseImages.length>=2&&p.baseImages.every((x:string)=>typeof x==="string"&&/@sha256:[a-f0-9]{64}$/.test(x)),"ARTIFACT_BASE_UNPINNED");
  check(JSON.stringify(p.baseImages)===JSON.stringify(context.baseImages),"ARTIFACT_BASE_MISMATCH");
  check(index.schemaVersion===2&&Array.isArray(index.manifests)&&index.manifests.length===1,"ARTIFACT_INDEX_INVALID");
  check(index.manifests[0].digest===`sha256:${hashBytes(files['manifest.json'])}`&&index.manifests[0].size===files['manifest.json'].length,"ARTIFACT_MANIFEST_SUBSTITUTED");
  check(manifest.schemaVersion===2&&manifest.config?.digest===`sha256:${hashBytes(files['config.json'])}`&&manifest.config.size===files['config.json'].length&&Array.isArray(manifest.layers)&&manifest.layers.length>0,"ARTIFACT_CONFIG_SUBSTITUTED");
  check(manifest.layers.every((l:any)=>digest.test(l.digest)&&Number.isSafeInteger(l.size)&&l.size>=0),"ARTIFACT_LAYER_INVALID");
  check(config.os==="linux"&&config.architecture===context.architecture&&config.config?.User==="65532:65532"&&config.config?.Labels?.["org.opencontainers.image.revision"]===context.source,"ARTIFACT_CONFIG_IDENTITY");
  const configDigest=manifest.config.digest;
  check(trivy.SchemaVersion===2&&trivy.Metadata?.ImageID===configDigest&&Array.isArray(trivy.Results)&&trivy.Results.length>0,"TRIVY_REPORT_INVALID");
  check(trivy.Results.some((r:any)=>r.Class==="os-pkgs"&&typeof r.Type==="string")&&trivy.Results.some((r:any)=>r.Class==="lang-pkgs"&&r.Type==="node-pkg"),"TRIVY_COVERAGE_MISSING");
  for(const result of trivy.Results){check(!result.ModifiedFindings?.length,"TRIVY_SUPPRESSED_FINDINGS");check(typeof result.Target==="string"&&typeof result.Class==="string","TRIVY_RESULT_INVALID");check(result.Vulnerabilities===undefined||Array.isArray(result.Vulnerabilities),"TRIVY_FINDINGS_INVALID");for(const finding of result.Vulnerabilities??[])check(["LOW","MEDIUM","NEGLIGIBLE"].includes(finding.Severity),"UNRESOLVED_SCAN_FINDING");}
  check(grype.source?.target?.imageID===configDigest&&Array.isArray(grype.matches)&&typeof grype.descriptor?.version==="string","GRYPE_REPORT_INVALID");
  check(grype.ignoredMatches===undefined||Array.isArray(grype.ignoredMatches),"GRYPE_IGNORED_INVALID");
  for(const match of [...grype.matches,...(grype.ignoredMatches??[])])check(["Low","Medium","Negligible"].includes(match.vulnerability?.severity),"UNRESOLVED_SCAN_FINDING");
  check(sbom.spdxVersion?.startsWith("SPDX-")&&Array.isArray(sbom.packages)&&sbom.packages.length>0,"SBOM_INVALID");
  check(native.architecture===context.architecture&&native.imageConfigDigest===configDigest&&native.result==="PASSED","NATIVE_EVIDENCE_INVALID");
  for(const tool of ["trivy","grype"]){const m=metadata[tool];const updated=Date.parse(m?.databaseUpdatedAt);check(m&&typeof m.version==="string"&&m.version.length>0&&sha.test(m.databaseSha256??"")&&Number.isFinite(updated)&&updated<=context.now&&context.now-updated<=72*3600_000&&m.ignoreUnfixed===false&&m.severityThreshold==="HIGH"&&m.exitCode===0,"SCANNER_METADATA_INVALID");}
  check(metadata.trivy.version===trivy.ArtifactTypeVersion||metadata.trivy.version===p.scannerVersions?.trivy,"TRIVY_VERSION_MISMATCH");
  check(metadata.grype.version===grype.descriptor.version,"GRYPE_VERSION_MISMATCH");
  return Object.freeze({contract:ARTIFACT_CONTRACT,classification:p.classification,source:context.source,architecture:context.architecture,runId:context.runId,attempt:context.attempt,imageConfigDigest:configDigest,architectureManifestDigest:index.manifests[0].digest,architectureIndexDigest:`sha256:${hashBytes(files['index.json'])}`,provenanceSha256:hashBytes(files['provenance.json']),sbomSha256:hashBytes(files['sbom.json']),scanSha256:{trivy:hashBytes(files['trivy.json']),grype:hashBytes(files['grype.json'])},baseImages:p.baseImages,inputs:p.inputs});
}
export function assertRuntimeAdmission(receipt: ReturnType<typeof verifyArtifactEvidence>) {
  check(receipt.classification!=="HARNESS_FIXTURE_ONLY","HARNESS_FIXTURE_CANNOT_QUALIFY_RUNTIME");
  // Deliberately no environment override. Reopening requires reviewed source plus vendor evidence.
  throw Error(RUNTIME_ADMISSION_HOLD);
}
export function assertLocalImage(receipt: ReturnType<typeof verifyArtifactEvidence>, image: any) {
  check(image.Id===receipt.imageConfigDigest&&image.Architecture===receipt.architecture&&image.Os==="linux"&&image.Config?.User==="65532:65532"&&image.Config?.Labels?.["org.opencontainers.image.revision"]===receipt.source,"LOCAL_IMAGE_SUBSTITUTED");
}
export function assertRunningImage(receipt: ReturnType<typeof verifyArtifactEvidence>, container: any) {
  check(container.Image===receipt.imageConfigDigest&&container.Config?.Image===receipt.imageConfigDigest&&container.State?.Running===true,"RUNNING_IMAGE_SUBSTITUTED");
  check(!(container.Mounts??[]).some((m:any)=>/^\/app(?:\/|$)|^\/nodejs(?:\/|$)/.test(m.Destination)),"RUNNING_CODE_MOUNT_FORBIDDEN");
}
