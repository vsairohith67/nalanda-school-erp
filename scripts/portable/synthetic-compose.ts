import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {readFileSync,writeFileSync,mkdirSync,realpathSync,lstatSync} from "node:fs";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {admitSyntheticArtifact} from "./admit-artifact";
import {validateComposeFiles} from "./operator-adapter";

/** A separately scanned test image gets two distinct kernel-bound capabilities.
 * This changes no operational Compose defaults and starts no services. */
export function syntheticCompose(base:any,root:string,image:string){
 assert(/^sha256:[a-f0-9]{64}$/.test(image));
 const config=structuredClone(base);
 // QA fixtures are prepared out of band against the serving database. The
 // production load-test seed would violate that fresh-target prerequisite.
 delete config.services.seed;
 for(const service of Object.values(config.services) as any[]){
  if(service.depends_on?.seed){delete service.depends_on.seed;service.depends_on.migrator={condition:"service_completed_successfully"};}
 }
 for(const name of ["application","data","backup-data"])assert.equal(config.networks[name].internal,true,"PRIVATE_NETWORK_REQUIRED");
 for(const name of ["web-1","web-2"]){
  const service=config.services[name];assert(service);assert.equal(service.read_only,true);
  service.image=image;service.pull_policy="never";
  service.environment.AUTH_MFA_KEYRING_JSON_FILE="/run/secrets/auth_mfa_keyring_json";
  service.environment.CERTIFICATE_GEORGIA_BOLD_PATH="/run/qa-font/georgiab.ttf";
  service.secrets.push({source:"auth_mfa_keyring_json",target:"auth_mfa_keyring_json"});
  service.volumes=[...(service.volumes??[]),...[[path.join(root,name,"capability.json"),"/run/qa-capability/capability.json"],[path.join(root,"qa-ca","root.crt"),"/run/qa-ca/root.crt"],[path.join(root,"qa-font","georgiab.ttf"),"/run/qa-font/georgiab.ttf"]].map(([source,target])=>({type:"bind",source,target,read_only:true,bind:{create_host_path:false}}))];
 }
 config.secrets.auth_mfa_keyring_json={file:path.join(root,"secrets","auth_mfa_keyring_json")};
 return config;
}
async function main(){
 const root=path.resolve(process.env.PORTABLE_CI_ROOT??"");
 const expected=path.resolve("tmp/portable-staging",`nalanda-ci-${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}-qaon`);
 assert.equal(root,expected);assert.equal(realpathSync(root),root);assert(!lstatSync(root).isSymbolicLink());
 const trust=readFileSync(path.resolve("tmp/portable-staging",`nalanda-ci-${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}-capability`,"trust.json"));
 const artifact=admitSyntheticArtifact(path.resolve("artifact-evidence-synthetic"),trust);
 const base=JSON.parse(execFileSync("docker",["--context","default","compose","-f","deploy/portable/compose.yml","config","--format","json"],{encoding:"utf8",env:{...process.env,PORTABLE_IMAGE_ID:artifact.imageConfigDigest},stdio:"pipe"}));
 for(const name of ["web-1","web-2"]){mkdirSync(path.join(root,name),{mode:0o700});writeFileSync(path.join(root,name,"capability.json"),"{}",{flag:"wx",mode:0o444});}
 mkdirSync(path.join(root,"qa-ca"),{mode:0o700});writeFileSync(path.join(root,"qa-ca","root.crt"),"",{flag:"wx",mode:0o444});
 const result=syntheticCompose(base,root,artifact.imageConfigDigest);
 await validateComposeFiles(result,process.cwd(),root);
 writeFileSync(path.join(root,"synthetic-compose.json"),JSON.stringify(result),{flag:"wx",mode:0o600});
 console.log(JSON.stringify({state:"SYNTHETIC_COMPOSE_PREPARED",source:artifact.source,productionImageAcceptance:false}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)void main().catch(()=>{console.error("SYNTHETIC_COMPOSE_FAILED");process.exitCode=1;});
