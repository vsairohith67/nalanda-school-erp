import {describe,it,expect} from "vitest";
import {generateKeyPairSync,sign} from "node:crypto";
import {readFileSync} from "node:fs";
import path from "node:path";
import {hashBytes} from "../scripts/portable/artifact-handoff";
import {resolveInputPolicy,type TrustRegistration,type ObservedSubject} from "../scripts/portable/product-trust-policy";
import {TOOL_NAMES,productionInputPolicy} from "../scripts/portable/product-input-contract";
import {offlineProductRecipe,materialAcquisitionRecipe,acquireMaterialBlob} from "../scripts/portable/product-materials";

// TEST ONLY: ephemeral generated keys, no authority registration or production files.
function setup(){
 const now=Date.now(),root=generateKeyPairSync("ed25519"),attestor=generateKeyPairSync("ed25519");
 const entry=(pair:typeof root)=>({id:hashBytes(pair.publicKey.export({format:"der",type:"spki"})),algorithm:"Ed25519" as const,publicKey:pair.publicKey.export({format:"pem",type:"spki"}).toString(),notBefore:now-10000,notAfter:now+600000,revoked:false});
 const identity={source:"a".repeat(40),tree:"b".repeat(40),architecture:"amd64" as const,repository:"vsairohith67/nalanda-school-erp",workflow:".github/workflows/portable-staging-foundation.yml",runId:"123",attempt:"1",job:"backend-build-scan"};
 const observed:ObservedSubject={identity,workflowRef:identity.repository+"/"+identity.workflow+"@refs/heads/release/recovery-integration-1a",workflowSha:identity.source,recipeSha256:"1".repeat(64),lockSha256:"2".repeat(64)};
 const registration:TrustRegistration={contract:"NALANDA_BUILD_AUTHORITY_V1",namespace:"PRODUCTION",generation:1,validUntil:now+600000,ownerApproval:"https://example.invalid/TEST-ONLY-owner",custodyApproval:"https://example.invalid/TEST-ONLY-custody",debianKeyringSha256:"c".repeat(64),debianSigners:["A".repeat(40)],custodyDirectory:path.resolve("TEST-ONLY-NEVER-CREATED"),authority:entry(root),attestors:[entry(attestor)],bootstrap:{nodeSha256:"3".repeat(64),bundleSha256:"4".repeat(64),manifestSha256:"b".repeat(64)}};
 const grant:any={contract:"NALANDA_BUILD_AUTHORIZATION_V1",namespace:"PRODUCTION",generation:1,authorityId:registration.authority.id,attestorId:registration.attestors[0].id,operation:"BUILD_SCAN_ONLY_NOT_ADMITTED",issuedAt:now-1000,expiresAt:now+60000,identity:{...identity},workflowRef:observed.workflowRef,workflowSha:observed.workflowSha,subjectSha256:"5".repeat(64),recipeSha256:observed.recipeSha256,lockSha256:observed.lockSha256,materialsSha256:"6".repeat(64),toolPins:Object.fromEntries(TOOL_NAMES.map(n=>[n,{sha256:"7".repeat(64),archiveSha256:"8".repeat(64),version:"TEST-ONLY"}])),imagesSha256:"9".repeat(64),databasesSha256:"0".repeat(64)};
 const envelope=()=>{const bytes=Buffer.from(JSON.stringify(grant));return Buffer.from(JSON.stringify({payload:bytes.toString("base64url"),signature:sign(null,bytes,root.privateKey).toString("base64url")}));};
 return {now,root,attestor,registration,grant,observed,envelope,resolve:()=>resolveInputPolicy(registration,envelope(),observed,now)};
}
describe("production resolver, isolated TEST ONLY authority",()=>{
 it("resolves independently signed exact subject without trusting evidence",()=>{const f=setup(),p=f.resolve();expect(p.subjectSha256).toBe(f.grant.subjectSha256);expect(p.publicKey).toBe(f.registration.attestors[0].publicKey);expect(p.classification).toBe("HOSTED_PREBUILD_INPUTS");});
 it("normal production remains unregistered",()=>expect(()=>productionInputPolicy()).toThrow("PRODUCTION_INPUT_TRUST_UNREGISTERED"));
 it.each(["source","tree","architecture","repository","workflow","runId","attempt","job"])("rejects independently signed wrong %s",field=>{const f=setup();f.grant.identity[field]="wrong";expect(f.resolve).toThrow();});
 it.each(["expired-grant","future-grant","long-grant","expired-registration","generation","revoked-root","revoked-attestor","expired-key","key-id","wrong-root","unknown-attestor","role-collision","test-namespace","operation","recipe","lock","workflow-ref","workflow-sha","extra-field","missing-tool","bad-tool","algorithm"])("rejects %s",scenario=>{const f=setup(),r=f.registration,g=f.grant;
  if(scenario==="expired-grant")g.expiresAt=f.now;if(scenario==="future-grant")g.issuedAt=f.now+1;if(scenario==="long-grant")g.expiresAt=f.now+7*3600000;if(scenario==="expired-registration")r.validUntil=f.now;
  if(scenario==="generation")g.generation=2;if(scenario==="revoked-root")r.authority.revoked=true;if(scenario==="revoked-attestor")r.attestors[0].revoked=true;if(scenario==="expired-key")r.attestors[0].notAfter=f.now;
  if(scenario==="key-id")r.authority.id="0".repeat(64);if(scenario==="wrong-root")r.authority.publicKey=f.attestor.publicKey.export({format:"pem",type:"spki"}).toString();if(scenario==="unknown-attestor")g.attestorId="f".repeat(64);if(scenario==="role-collision")r.attestors.push(r.authority);
  if(scenario==="test-namespace")g.namespace="HARNESS_ONLY";if(scenario==="operation")g.operation="RUN";if(scenario==="recipe")g.recipeSha256="0".repeat(64);if(scenario==="lock")g.lockSha256="0".repeat(64);
  if(scenario==="workflow-ref")g.workflowRef+="other";if(scenario==="workflow-sha")g.workflowSha="d".repeat(40);if(scenario==="extra-field")g.approved=true;if(scenario==="missing-tool")delete g.toolPins.node;if(scenario==="bad-tool")g.toolPins.node.sha256="bad";if(scenario==="algorithm")r.authority.algorithm="RSA" as any;
  expect(f.resolve).toThrow();
 });
 it("rejects changed signature and duplicate fields",()=>{const f=setup(),e=JSON.parse(f.envelope().toString());e.signature="A".repeat(86);expect(()=>resolveInputPolicy(f.registration,Buffer.from(JSON.stringify(e)),f.observed,f.now)).toThrow();expect(()=>resolveInputPolicy(f.registration,Buffer.from('{"payload":"x","payload":"y","signature":"z"}'),f.observed,f.now)).toThrow();});
});
describe("finite prepared material recipes",()=>{
 const original=readFileSync("Dockerfile"),ref="nalanda-materials:dependencies@sha256:"+"a".repeat(64);
 it("binds prepared dependency image and preserves product operations",()=>{const recipe=offlineProductRecipe(original,ref).toString();expect(recipe).toContain("FROM ${MATERIAL_IMAGE} AS dependencies");expect(recipe).toContain("pnpm db:generate:postgres");expect(recipe).not.toContain("apt-get");expect(recipe).not.toContain("corepack");expect(recipe).not.toContain("pnpm install");expect(recipe).toContain("USER 65532:65532");});
 it("requires reviewed immutable material reference",()=>expect(()=>offlineProductRecipe(original,"nalanda-materials:latest")).toThrow());
 it("refuses a new network command outside removed dependency stage",()=>expect(()=>offlineProductRecipe(Buffer.concat([original,Buffer.from("\nRUN curl https://example.invalid\n")]),ref)).toThrow());
 it("creates finite snapshot acquisition with signature verification and no shared cache",()=>{const result=materialAcquisitionRecipe(original,{snapshot:"20261001T000000Z",packages:[{name:"ca-certificates",version:"1"},{name:"openssl",version:"1"}]}).toString();expect(result).toContain("RUN --network=none apt-get --no-download");expect(result).toContain("material-replay.mjs");expect(result).not.toContain("apt-get update");expect(result.split("\n").filter(x=>x.startsWith("RUN ")).every(x=>x.startsWith("RUN --network=none "))).toBe(true);expect(result).not.toContain("type=cache");expect(result).not.toContain("allow-unauthenticated");});
 it.each(["latest","20261001;curl"])("rejects unpinned/injected snapshot %s",snapshot=>expect(()=>materialAcquisitionRecipe(original,{snapshot,packages:[]})).toThrow());
 it("rejects external URL acquisition before network",async()=>{await expect(acquireMaterialBlob("https://example.invalid/a","a".repeat(64),10,path.resolve("."))).rejects.toThrow("MATERIAL_DOWNLOAD_INVALID");});
});
