import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { expect, it } from "vitest";
import { syntheticFeatureCapability, verifySyntheticCapability, type SyntheticBuildTrust, type SyntheticCapability, type SyntheticBinding } from "../lib/portable-runtime/synthetic-capability";
import { isSyntheticReleaseFeatureQaMode, operationalReleaseFeatureAvailability, PRIOR_YEAR_CONCESSIONS_FEATURE } from "../lib/release-feature-flag-runtime";

const pair=generateKeyPairSync("ed25519"), now=Date.now();
const trust:SyntheticBuildTrust={contract:"NALANDA_SYNTHETIC_BUILD_V1",buildId:"b".repeat(64),source:"a".repeat(40),runId:"123",attempt:"1",publicKey:pair.publicKey.export({type:"spki",format:"pem"}).toString()};
const binding:SyntheticBinding={hostname:"c".repeat(12),databaseSha256:createHash("sha256").update("synthetic-per-project-private-database-identity").digest("hex"),origin:"https://portable-staging.localhost:8443",deploymentEnvironment:"synthetic-staging",provider:"postgresql",nodeEnvironment:"production"};
const capability:SyntheticCapability={contract:"NALANDA_SYNTHETIC_FEATURE_CAPABILITY_V1",purpose:"RELEASE_ACCEPTANCE_FEATURES",buildId:trust.buildId,source:trust.source,runId:trust.runId,attempt:trust.attempt,hostname:binding.hostname,databaseSha256:binding.databaseSha256,origin:binding.origin,issuedAt:now-1000,expiresAt:now+60000,features:[{...PRIOR_YEAR_CONCESSIONS_FEATURE,version:1}].map(({key,version,environment,activationRole})=>({key,version,environment,activationRole}))};
const signed=(c:unknown)=>{const bytes=Buffer.from(JSON.stringify(c));return {payload:bytes.toString("base64url"),signature:sign(null,bytes,pair.privateKey).toString("base64url")};};
it("verifies a genuinely signed short-lived build/container/database feature capability",()=>{
  expect(verifySyntheticCapability(trust,signed(capability),binding,now)).toEqual(capability);
  expect(verifySyntheticCapability(trust,signed(capability),binding,capability.expiresAt)).toBeNull();
});
it("rejects copied, stale, missing, tampered, future and wrongly targeted capabilities",()=>{
  for(const delta of [{buildId:"d".repeat(64)},{source:"d".repeat(40)},{runId:"124"},{attempt:"2"},{hostname:"d".repeat(12)},{databaseSha256:"d".repeat(64)},{origin:"https://production.invalid"},{issuedAt:now+1},{expiresAt:now},{expiresAt:now+3600_001},{purpose:"AUTH_BYPASS"},{features:[]},{features:[...capability.features,...capability.features]},{features:[{...capability.features[0],version:2}]},{features:[{...capability.features[0],activationRole:"TEACHER"}]},{features:[{...capability.features[0],key:"communication-channel-sms"}]}])expect(verifySyntheticCapability(trust,signed({...capability,...delta}),binding,now)).toBeNull();
  for(const delta of [{deploymentEnvironment:"production"},{provider:"sqlite"},{nodeEnvironment:"test"},{hostname:"d".repeat(12)},{databaseSha256:"d".repeat(64)}])expect(verifySyntheticCapability(trust,signed(capability),{...binding,...delta},now)).toBeNull();
  expect(verifySyntheticCapability(null,signed(capability),binding,now)).toBeNull();
  expect(verifySyntheticCapability(trust,null,binding,now)).toBeNull();
  expect(verifySyntheticCapability(trust,{...signed(capability),signature:"a".repeat(86)},binding,now)).toBeNull();
  const other=generateKeyPairSync("ed25519");
  expect(verifySyntheticCapability({...trust,publicKey:other.publicKey.export({type:"spki",format:"pem"}).toString()},signed(capability),binding,now)).toBeNull();
});
it("production source has no trust key and cannot change feature flags or the MFA/step-up QA boolean",()=>{
  const env:NodeJS.ProcessEnv={NODE_ENV:"production",NALANDA_ENVIRONMENT:"synthetic-staging",DATABASE_PROVIDER:"postgresql",DATABASE_URL:"postgresql://postgres/nalanda_portable_synthetic?schema=public",APP_ORIGIN:binding.origin,CI:"true",RELEASE_FEATURE_FLAGS_QA_MODE:"SYNTHETIC_COPY_ONLY",RELEASE_FEATURE_FLAGS_QA_ENABLED:PRIOR_YEAR_CONCESSIONS_FEATURE.key,SYNTHETIC_CAPABILITY:JSON.stringify(signed(capability))};
  expect(syntheticFeatureCapability(env)).toBeNull();
  expect(isSyntheticReleaseFeatureQaMode(env)).toBe(false);
  expect(operationalReleaseFeatureAvailability(PRIOR_YEAR_CONCESSIONS_FEATURE,{environment:env}).enabled).toBe(false);
});
