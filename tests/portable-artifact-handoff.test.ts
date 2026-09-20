import { describe, expect, it } from "vitest";
import { ARTIFACT_CONTRACT, EVIDENCE_NAMES, hashBytes, verifyArtifactEvidence, assertRuntimeAdmission, assertLocalImage, assertRunningImage, resolveBaseImages, type ArtifactContext, type EvidenceFiles } from "../scripts/portable/artifact-handoff";
const now=Date.parse("2026-09-20T00:00:00Z");
const context:ArtifactContext={source:"a".repeat(40),architecture:"amd64",runId:"123",attempt:"1",now,baseImages:["fixture-build@sha256:"+"a".repeat(64),"fixture-runtime@sha256:"+"b".repeat(64)],inputs:{"Dockerfile":"b".repeat(64),"pnpm-lock.yaml":"c".repeat(64),"package.json":"d".repeat(64)}};
function fixture(){
 const files:EvidenceFiles={};const put=(name:string,value:unknown)=>files[name]=Buffer.from(JSON.stringify(value));
 put("config.json",{architecture:"amd64",os:"linux",config:{User:"65532:65532",Labels:{"org.opencontainers.image.revision":context.source}}});
 const image=`sha256:${hashBytes(files['config.json'])}`;
 put("manifest.json",{schemaVersion:2,config:{digest:image,size:files['config.json'].length},layers:[{digest:"sha256:"+"e".repeat(64),size:27}]});
 put("index.json",{schemaVersion:2,manifests:[{digest:`sha256:${hashBytes(files['manifest.json'])}`,size:files['manifest.json'].length}]});
 put("sbom.json",{spdxVersion:"SPDX-2.3",packages:[{name:"HARNESS_FIXTURE_ONLY"}]});
 put("trivy.json",{SchemaVersion:2,Metadata:{ImageID:image},Results:[{Target:"HARNESS_FIXTURE_ONLY",Class:"os-pkgs",Type:"fixture-os",Vulnerabilities:[]},{Target:"app",Class:"lang-pkgs",Type:"node-pkg",Vulnerabilities:[]}]});
 put("grype.json",{source:{target:{imageID:image}},descriptor:{version:"fixture-1"},matches:[]});
 const scanner={version:"fixture-1",databaseUpdatedAt:new Date(now).toISOString(),databaseSha256:"f".repeat(64),ignoreUnfixed:false,severityThreshold:"HIGH",exitCode:0};
 put("scanner-metadata.json",{trivy:scanner,grype:scanner});put("native.json",{architecture:"amd64",imageConfigDigest:image,result:"PASSED"});
 put("provenance.json",{contract:ARTIFACT_CONTRACT,classification:"HARNESS_FIXTURE_ONLY",source:context.source,architecture:"amd64",runId:"123",attempt:"1",generatedAt:new Date(now).toISOString(),inputs:context.inputs,baseImages:["fixture-build@sha256:"+"a".repeat(64),"fixture-runtime@sha256:"+"b".repeat(64)],scannerVersions:{trivy:"fixture-1"},receipts:EVIDENCE_NAMES.filter(n=>n!=="provenance.json").map(name=>({name,sha256:hashBytes(files[name])}))});
 return {files,image,edit:(name:string,change:(v:any)=>void,rehash=false)=>{const value=JSON.parse(files[name].toString());change(value);put(name,value);if(rehash&&name!=="provenance.json"){const p=JSON.parse(files['provenance.json'].toString());p.receipts.find((r:any)=>r.name===name).sha256=hashBytes(files[name]);put("provenance.json",p);}}};
}
import {readFileSync} from "node:fs";
it("resolves the actual pinned ARG-based Dockerfile",()=>{expect(resolveBaseImages(readFileSync("Dockerfile","utf8"))).toHaveLength(2);});
describe("immutable raw-evidence boundary; fixtures never qualify runtime",()=>{
 it("binds separate config, manifest, index, SBOM, source/lock and provenance identities",()=>{const f=fixture(),r=verifyArtifactEvidence(f.files,context);expect(r.imageConfigDigest).toBe(f.image);expect(r.architectureManifestDigest).not.toBe(r.architectureIndexDigest);expect(()=>assertRuntimeAdmission(r)).toThrow("HARNESS_FIXTURE_CANNOT_QUALIFY_RUNTIME");});
 it.each(["source","architecture","stale","contract","duplicate","conflicting","missing-provenance","missing-scan","malformed","changed-image","finding","unknown-severity","missing-db","stale-db","changed-lock","retarget","suppressed-high","irrelevant-report","filtered-trivy"])("fails closed: %s",mode=>{
  const f=fixture();
  if(mode==="source")f.edit("provenance.json",p=>p.source="b".repeat(40));
  if(mode==="architecture")f.edit("provenance.json",p=>p.architecture="arm64");
  if(mode==="stale")f.edit("provenance.json",p=>p.generatedAt="2020-01-01T00:00:00Z");
  if(mode==="contract")f.edit("provenance.json",p=>p.contract="UNSUPPORTED");
  if(mode==="duplicate"||mode==="conflicting")f.edit("provenance.json",p=>p.receipts[1]={...p.receipts[0],...(mode==="conflicting"?{sha256:"0".repeat(64)}:{})});
  if(mode==="missing-provenance")delete f.files['provenance.json'];
  if(mode==="missing-scan")delete f.files['trivy.json'];
  if(mode==="malformed")f.files['grype.json']=Buffer.from('{');
  if(mode==="changed-image")f.edit("config.json",p=>p.architecture="arm64",true);
  if(mode==="finding"||mode==="unknown-severity")f.edit("trivy.json",p=>p.Results[0].Vulnerabilities=[{Severity:mode==="finding"?"HIGH":"UNKNOWN"}],true);
  if(mode==="missing-db")f.edit("scanner-metadata.json",p=>delete p.trivy.databaseSha256,true);
  if(mode==="stale-db")f.edit("scanner-metadata.json",p=>p.grype.databaseUpdatedAt="2020-01-01",true);
  if(mode==="changed-lock")f.edit("provenance.json",p=>p.inputs['pnpm-lock.yaml']="0".repeat(64));
  if(mode==="retarget")f.edit("trivy.json",p=>p.Metadata.ImageID="sha256:"+"0".repeat(64),true);
  if(mode==="suppressed-high")f.edit("grype.json",p=>p.ignoredMatches=[{vulnerability:{severity:"High"}}],true);
  if(mode==="irrelevant-report")f.edit("trivy.json",p=>p.Results=[{Target:"irrelevant",Class:"config"}],true);
  if(mode==="filtered-trivy")f.edit("trivy.json",p=>p.Results[0].ModifiedFindings=[{Severity:"HIGH"}],true);
  expect(()=>verifyArtifactEvidence(f.files,context)).toThrow();
 });
 it("retains the external runtime hold even with syntactically complete non-fixture evidence",()=>{const f=fixture();f.edit("provenance.json",p=>p.classification="HOSTED_EXACT_IMAGE_EVIDENCE");expect(()=>assertRuntimeAdmission(verifyArtifactEvidence(f.files,context))).toThrow("EXTERNAL_RUNTIME_BLOCKED");});
 it("rejects retargeted local and running images and mounted source replacement",()=>{const f=fixture(),r=verifyArtifactEvidence(f.files,context),image={Id:f.image,Architecture:"amd64",Os:"linux",Config:{User:"65532:65532",Labels:{"org.opencontainers.image.revision":context.source}}};expect(()=>assertLocalImage(r,image)).not.toThrow();expect(()=>assertLocalImage(r,{...image,Id:"sha256:"+"0".repeat(64)})).toThrow();const container={Image:f.image,Config:{Image:f.image},State:{Running:true},Mounts:[]};expect(()=>assertRunningImage(r,container)).not.toThrow();expect(()=>assertRunningImage(r,{...container,Config:{Image:"mutable:latest"}})).toThrow();expect(()=>assertRunningImage(r,{...container,Mounts:[{Destination:"/app"}]})).toThrow();});
});
