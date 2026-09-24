import { createHash, createPublicKey, verify } from "node:crypto";
import { hostname } from "node:os";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import immutableTrust from "../../config/synthetic-build-trust.json";
import { readPortableSecret } from "./secrets";

export type SyntheticBuildTrust = { contract:"NALANDA_SYNTHETIC_BUILD_V1"; buildId:string; source:string; runId:string; attempt:string; publicKey:string };
export type SyntheticCapability = {
  contract:"NALANDA_SYNTHETIC_FEATURE_CAPABILITY_V1"; purpose:"RELEASE_ACCEPTANCE_FEATURES";
  buildId:string; source:string; runId:string; attempt:string; hostname:string;
  databaseSha256:string; origin:string; issuedAt:number; expiresAt:number;
  features:Array<{key:string;version:number;environment:string;activationRole:string}>;
};
export type SyntheticBinding = {hostname:string;databaseSha256:string;origin:string;deploymentEnvironment:string;provider:string;nodeEnvironment:string};
const sha=/^[a-f0-9]{64}$/, id=/^[a-f0-9]{40}$/;
const allowed=new Set(["certificate-graduation-exit-1a","certificate-bulk-issue-1a","certificate-verification-1a","student-linked-items-1a","prior-year-concessions-1a","real-data-imports","bulk-exports","real-user-access-readiness-1a"]);
export function verifySyntheticCapability(trust:SyntheticBuildTrust|null, envelope:unknown, binding:SyntheticBinding, now=Date.now()):SyntheticCapability|null {
  try {
    if(!trust||trust.contract!=="NALANDA_SYNTHETIC_BUILD_V1"||!sha.test(trust.buildId)||!id.test(trust.source)||!/^\d+$/.test(trust.runId)||!/^\d+$/.test(trust.attempt))return null;
    if(binding.nodeEnvironment!=="production"||binding.deploymentEnvironment!=="synthetic-staging"||binding.provider!=="postgresql"||binding.origin!=="https://portable-staging.localhost:8443"||!sha.test(binding.databaseSha256)||!/^[a-f0-9]{12,64}$/.test(binding.hostname))return null;
    const e=envelope as {payload:string;signature:string};
    if(!e||Object.keys(e).sort().join()!=="payload,signature"||typeof e.payload!=="string"||e.payload.length>8192||!/^[A-Za-z0-9_-]+$/.test(e.payload)||typeof e.signature!=="string"||!/^[A-Za-z0-9_-]{86}$/.test(e.signature))return null;
    const key=createPublicKey(trust.publicKey);if(key.asymmetricKeyType!=="ed25519"||!verify(null,Buffer.from(e.payload,"base64url"),key,Buffer.from(e.signature,"base64url")))return null;
    const c=JSON.parse(Buffer.from(e.payload,"base64url").toString()) as SyntheticCapability;
    if(Object.keys(c).sort().join()!=="attempt,buildId,contract,databaseSha256,expiresAt,features,hostname,issuedAt,origin,purpose,runId,source"||c.contract!=="NALANDA_SYNTHETIC_FEATURE_CAPABILITY_V1"||c.purpose!=="RELEASE_ACCEPTANCE_FEATURES")return null;
    if(["buildId","source","runId","attempt"].some(k=>c[k as keyof SyntheticCapability]!==trust[k as keyof SyntheticBuildTrust]))return null;
    if(c.hostname!==binding.hostname||c.databaseSha256!==binding.databaseSha256||c.origin!==binding.origin||!Number.isSafeInteger(c.issuedAt)||!Number.isSafeInteger(c.expiresAt)||c.issuedAt>now||c.expiresAt<=now||c.expiresAt-c.issuedAt>3600_000||c.expiresAt<=c.issuedAt)return null;
    if(!Array.isArray(c.features)||c.features.length===0||c.features.length>allowed.size||new Set(c.features.map(f=>f.key)).size!==c.features.length)return null;
    for(const f of c.features)if(!f||Object.keys(f).sort().join()!=="activationRole,environment,key,version"||!allowed.has(f.key)||f.version!==1||f.activationRole!=="SUPER_ADMIN"||f.environment!==(f.key==="bulk-exports"?"STAGING":"PRODUCTION"))return null;
    return c;
  }catch{return null;}
}

/** Only this runtime wrapper is used by routes. No request, header, role or
 * environment variable supplies a trust key. Ordinary builds inline null. */
export function syntheticFeatureCapability(environment:NodeJS.ProcessEnv=process.env) {
  if(!immutableTrust)return null;
  try {
    const file="/run/qa-capability/capability.json",stat=lstatSync(file);
    if(!stat.isFile()||stat.isSymbolicLink()||realpathSync(file)!==file||stat.size>12288||(stat.mode&0o022))return null;
    const database=readPortableSecret("DATABASE_URL",environment,{required:true});
    const url=new URL(database);
    if(url.protocol!=="postgresql:"||url.hostname!=="postgres"||url.pathname!=="/nalanda_portable_synthetic"||url.searchParams.get("schema")!=="public")return null;
    return verifySyntheticCapability(immutableTrust as SyntheticBuildTrust,JSON.parse(readFileSync(file,"utf8")),{
      hostname:hostname(),databaseSha256:createHash("sha256").update(database).digest("hex"),origin:environment.APP_ORIGIN??"",
      deploymentEnvironment:environment.NALANDA_ENVIRONMENT??"",provider:environment.DATABASE_PROVIDER??"",nodeEnvironment:environment.NODE_ENV??""
    });
  }catch{return null;}
}
