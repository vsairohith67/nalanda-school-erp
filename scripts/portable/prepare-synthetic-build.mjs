import { createPublicKey } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
const file="config/synthetic-build-trust.json";
if(process.argv[2]==="--production") {
  if(JSON.parse(readFileSync(file,"utf8"))!==null)throw Error("PRODUCTION_QA_TRUST_FORBIDDEN");
} else if(process.argv[2]==="--synthetic") {
  if(JSON.parse(readFileSync(file,"utf8"))!==null)throw Error("SOURCE_QA_TRUST_MUST_BE_NULL");
  const raw=process.env.SYNTHETIC_BUILD_TRUST??"";
  if(raw.length>8192||!/^[A-Za-z0-9_-]+$/.test(raw))throw Error("SYNTHETIC_BUILD_TRUST_REQUIRED");
  const trust=JSON.parse(Buffer.from(raw,"base64url").toString());
  if(Object.keys(trust).sort().join()!=="attempt,buildId,contract,publicKey,runId,source"||trust.contract!=="NALANDA_SYNTHETIC_BUILD_V1"||!/^[a-f0-9]{64}$/.test(trust.buildId)||!/^[a-f0-9]{40}$/.test(trust.source)||trust.source!==process.env.SOURCE_COMMIT||!/^\d+$/.test(trust.runId)||!/^\d+$/.test(trust.attempt)||!trust.publicKey.startsWith("-----BEGIN PUBLIC KEY-----")||createPublicKey(trust.publicKey).asymmetricKeyType!=="ed25519")throw Error("SYNTHETIC_BUILD_TRUST_INVALID");
  writeFileSync(file,JSON.stringify(trust));
  // Test-only policy is compiled into the separately identified artifact.
  // The tracked operational policy remains empty and is never activated.
  const policyFile="config/prior-year-concession-policy.json";
  const policy=JSON.parse(readFileSync(policyFile,"utf8"));
  if(policy.academicYears.length||policy.incomeBands.length||policy.scholarshipsEnabled)throw Error("OPERATIONAL_POLICY_REQUIRES_REVIEW");
  writeFileSync(policyFile,JSON.stringify({...policy,academicYears:[2024,2025,2026,2027].map((year,index)=>({id:`${year}-${String(year+1).slice(-2)}`,sequence:index+1,startsOn:`${year}-04-01`,endsOn:`${year+1}-03-31`})),incomeBands:[{id:"SYNTHETIC_ONLY",label:"Synthetic acceptance band"}],incomeRetentionDays:30}));
} else throw Error("EXPLICIT_BUILD_CLASSIFICATION_REQUIRED");
