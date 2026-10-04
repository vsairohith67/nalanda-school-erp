import path from "node:path";
import type { ProducerCommand } from "./qa-artifact-producer";
import type { ProducerIdentity } from "./synthetic-build-lifecycle";

/** Pure command construction only. This neither qualifies inputs nor starts a
 * builder. The existing QA entrypoint retains its separate admission guards. */
function buildCommand(work:string, identity:ProducerIdentity, epoch:string,
 options:string[], output:string):ProducerCommand {
 return {stage:"build",tool:path.join(work,"tools/buildkit/bin/buildctl"),args:[
  "--addr",`unix://${path.join(work,"buildkit.sock")}`,"build","--frontend","dockerfile.v0",
  "--local",`context=${path.join(work,"context")}`,"--local",`dockerfile=${path.join(work,"context")}`,
  "--opt",options[0],"--opt",`platform=linux/${identity.architecture}`,
  "--opt",`build-arg:SOURCE_COMMIT=${identity.source}`,"--opt",`build-arg:SOURCE_DATE_EPOCH=${epoch}`,
  ...options.slice(1).flatMap(option=>["--opt",option]),
  "--output",output,"--metadata-file",path.join(work,"build-metadata.json")
 ]};
}

export function rootlessBuildCommand(work:string,identity:ProducerIdentity,epoch:string,
 publicTrust:string,trustHash:string):ProducerCommand {
 const project=`nalanda-ci-${identity.runId}-${identity.attempt}-qaon`;
 return buildCommand(work,identity,epoch,["target=synthetic-qa",
  `build-arg:SYNTHETIC_BUILD_TRUST=${publicTrust}`,`label:io.nalanda.qa-project=${project}`,
  `label:io.nalanda.qa-run=${identity.runId}`,`label:io.nalanda.qa-attempt=${identity.attempt}`,
  `label:io.nalanda.synthetic-trust-sha256=${trustHash}`],`type=docker,dest=${path.join(work,"image.tar")}`);
}

/** Production construction consumed only after the separate INPUT verifier.
 * A digest is a pin, not evidence of vendor clearance or permission to build.
 * No product admission/native probe is required for constructing this command.
 * The future caller must qualify source/tree, all materials and tools BEFORE
 * creating the private context or invoking the existing rootless machinery. */
export function productionBuildCommand(work:string,identity:ProducerIdentity,epoch:string,
 frontend:string):ProducerCommand {
 if(!path.isAbsolute(work)||path.normalize(work)!==work||/[\r\n,\x00]/.test(work))throw Error("PRODUCT_WORK_PATH_INVALID");
 if(!/^[a-f0-9]{40}$/.test(identity.source)||!/^\d+$/.test(identity.runId)||!/^\d+$/.test(identity.attempt)
  ||!["amd64","arm64"].includes(identity.architecture)||!/^\d+$/.test(epoch))throw Error("PRODUCT_BUILD_IDENTITY_INVALID");
 if(!/^docker\/dockerfile:[0-9]+(?:\.[0-9]+)*@sha256:[a-f0-9]{64}$/.test(frontend))throw Error("PRODUCT_FRONTEND_PIN_REQUIRED");
 return buildCommand(work,identity,epoch,["target=production-runtime",`build-arg:BUILDKIT_SYNTAX=${frontend}`,"force-network-mode=none"],
  `type=oci,dest=${path.join(work,"product.oci.tar")}`);
}

/** Verified layouts are session-local inputs. Source policy denies registry,
 * HTTP and Git fallback if an alias is not understood by the pinned frontend. */
export function bindProductionSources(command:ProducerCommand,work:string,images:Record<"runtime"|"builder"|"frontend",{reference:string;index:string}> & {dependencies?:{reference:string;index:string}}):ProducerCommand {
 const args=[...command.args,"--source-policy-file",path.join(work,"source-policy.json")];
 for(const name of ["runtime","builder","frontend",...(images.dependencies?["dependencies"]:[])] as ("runtime"|"builder"|"frontend"|"dependencies")[]){const c=images[name]!;if(!/^[a-zA-Z0-9./:_-]+@sha256:[a-f0-9]{64}$/.test(c.reference)||! /^[a-f0-9]{64}$/.test(c.index))throw Error("PRODUCT_MATERIAL_PIN_INVALID");const normalized=(!c.reference.includes("/")||(!c.reference.split("/")[0].includes(".")&&!c.reference.split("/")[0].includes(":")))?(c.reference.includes("/")?"docker.io/":"docker.io/library/")+c.reference:c.reference;
  args.push("--oci-layout",`${name}=${path.join(work,"inputs",name)}`);
  for(const ref of new Set([c.reference,normalized]))args.push("--opt",`context:${ref}=oci-layout://${name}@sha256:${c.index}`);
 }
 return {...command,args};
}
