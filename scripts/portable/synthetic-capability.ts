import { generateKeyPairSync, randomBytes, sign, createPrivateKey, createPublicKey } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, lstatSync, realpathSync, chmodSync } from "node:fs";
import path from "node:path";
import { assertEphemeralCi } from "./operator-adapter";
import { admitSyntheticArtifact } from "./admit-artifact";
import { inspectTarget } from "./integrated-acceptance";
import { hashBytes } from "./artifact-handoff";
import { releaseFeatureFlags } from "../../lib/release-feature-flags";
import { verifySyntheticCapability, type SyntheticBuildTrust, type SyntheticCapability } from "../../lib/portable-runtime/synthetic-capability";

function privateFile(file:string,root:string){
 if(!file.startsWith(root+path.sep)||realpathSync(file)!==file)throw Error("CAPABILITY_FILE_OUTSIDE_RUN");
 const stat=lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>16384||(stat.mode&0o022))throw Error("CAPABILITY_FILE_UNSAFE");return readFileSync(file);
}
function main(){
 assertEphemeralCi();const source=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim();if(source!==process.env.EXPECTED_SHA)throw Error("EXACT_HEAD_REQUIRED");
 const root=path.resolve("tmp/portable-staging",`nalanda-ci-${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}-capability`);
 if(process.argv[2]==="prepare-build"){
  mkdirSync(path.dirname(root),{recursive:true,mode:0o700});if(realpathSync(path.dirname(root))!==path.dirname(root))throw Error("CAPABILITY_PARENT_UNSAFE");mkdirSync(root,{mode:0o700});
  const pair=generateKeyPairSync("ed25519");const trust:SyntheticBuildTrust={contract:"NALANDA_SYNTHETIC_BUILD_V1",buildId:randomBytes(32).toString("hex"),source,runId:process.env.GITHUB_RUN_ID!,attempt:process.env.GITHUB_RUN_ATTEMPT!,publicKey:pair.publicKey.export({format:"pem",type:"spki"}).toString()};
  writeFileSync(path.join(root,"private-key.pem"),pair.privateKey.export({format:"pem",type:"pkcs8"}),{flag:"wx",mode:0o600});
  writeFileSync(path.join(root,"trust.json"),JSON.stringify(trust),{flag:"wx",mode:0o400});
  console.log(JSON.stringify({state:"SYNTHETIC_BUILD_INPUT_PREPARED",source,buildId:trust.buildId,productionAcceptance:false}));return;
 }
 if(process.argv[2]!=="issue"||!/^[a-f0-9]{64}$/.test(process.argv[3]??""))throw Error("CAPABILITY_ARGUMENT_INVALID");
 if(realpathSync(root)!==root||lstatSync(root).isSymbolicLink())throw Error("CAPABILITY_ROOT_UNSAFE");
 const trustBytes=privateFile(path.join(root,"trust.json"),root),trust=JSON.parse(trustBytes.toString()) as SyntheticBuildTrust;
 const artifact=admitSyntheticArtifact(path.resolve("artifact-evidence-synthetic"),trustBytes); // before Docker, credential access or any capability write
 const target=inspectTarget(artifact,process.argv[3]);
 const key=createPrivateKey(privateFile(path.join(root,"private-key.pem"),root));
 if(createPublicKey(key).export({type:"spki",format:"pem"}).toString()!==trust.publicKey)throw Error("CAPABILITY_SIGNER_MISMATCH");
 const projectRoot=path.resolve("tmp/portable-staging",target.target.project);
 const networkIds=[...new Set(target.target.replicas.flatMap((r:any)=>Object.values(r.NetworkSettings.Networks).map((n:any)=>n.NetworkID)))];
 for(const network of JSON.parse(target.docker(["network","inspect",...networkIds as string[]])))if(network.Internal!==true)throw Error("SYNTHETIC_EGRESS_FORBIDDEN");
 const ca=target.docker(["exec",target.target.proxy.Id,"cat","/data/caddy/pki/authorities/local/root.crt"]);
 if(!ca.startsWith("-----BEGIN CERTIFICATE-----")||ca.length>16384)throw Error("SYNTHETIC_CA_INVALID");
 const caFile=path.join(projectRoot,"qa-ca","root.crt");if(privateFile(caFile,projectRoot).length)throw Error("SYNTHETIC_CA_ALREADY_SET");
 chmodSync(caFile,0o600);writeFileSync(caFile,ca);chmodSync(caFile,0o444);
 const features=releaseFeatureFlags().filter(f=>new Set(["certificate-graduation-exit-1a","certificate-bulk-issue-1a","certificate-verification-1a","student-linked-items-1a","prior-year-concessions-1a","real-data-imports","bulk-exports","real-user-access-readiness-1a"]).has(f.key)).map(f=>({key:f.key,version:f.version,environment:f.environment,activationRole:"SUPER_ADMIN"}));
 for(const replica of target.target.replicas){
  const mount=replica.Mounts.find((m:any)=>m.Destination==="/run/qa-capability/capability.json"),database=replica.Mounts.find((m:any)=>m.Destination==="/run/secrets/database_url");
  if(!mount||mount.RW||!database||database.RW||replica.Config.Hostname!==replica.Id.slice(0,12))throw Error("CAPABILITY_TARGET_MOUNT_INVALID");
  const previous=privateFile(mount.Source,projectRoot);if(previous.toString().trim()!=="{}")throw Error("CAPABILITY_ALREADY_ISSUED");
  const databaseSha256=hashBytes(privateFile(database.Source,projectRoot).toString().replace(/[\r\n]+$/,"")),now=Date.now();
  const capability:SyntheticCapability={contract:"NALANDA_SYNTHETIC_FEATURE_CAPABILITY_V1",purpose:"RELEASE_ACCEPTANCE_FEATURES",buildId:trust.buildId,source,runId:trust.runId,attempt:trust.attempt,hostname:replica.Config.Hostname,databaseSha256,origin:"https://portable-staging.localhost:8443",issuedAt:now,expiresAt:now+3600_000,features};
  const payload=Buffer.from(JSON.stringify(capability)),envelope={payload:payload.toString("base64url"),signature:sign(null,payload,key).toString("base64url")};
  if(!verifySyntheticCapability(trust,envelope,{hostname:capability.hostname,databaseSha256,origin:capability.origin,provider:"postgresql",deploymentEnvironment:"synthetic-staging",nodeEnvironment:"production"},now))throw Error("CAPABILITY_SELF_VERIFICATION_FAILED");
  // Keep the existing inode mounted read-only in the container. A partial read
  // during this one-time write fails closed under signature verification.
  chmodSync(mount.Source,0o600);writeFileSync(mount.Source,JSON.stringify(envelope));chmodSync(mount.Source,0o444);
  if(readFileSync(mount.Source,"utf8")!==JSON.stringify(envelope))throw Error("CAPABILITY_WRITE_READBACK_FAILED");
 }
 target.bind();console.log(JSON.stringify({state:"SYNTHETIC_FEATURE_CAPABILITIES_ISSUED",source,imageConfigDigest:artifact.imageConfigDigest,replicas:target.target.replicas.length,productionAcceptance:false,authenticationBypassed:false}));
}
try{main();}catch{console.error("SYNTHETIC_CAPABILITY_FAILED");process.exitCode=1;}
