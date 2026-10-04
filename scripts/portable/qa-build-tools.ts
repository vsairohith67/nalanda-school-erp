import path from "node:path";
import {pathToFileURL} from "node:url";
import {assertEphemeralCi} from "./operator-adapter";
import {admitArtifact} from "./admit-artifact";
import {producerIdentity} from "./synthetic-build-lifecycle";
import {prepareBuildTools} from "./qa-build-tool-core";
export {buildToolPins,verifyToolArchive,validateToolEntries,prepareBuildTools,verifiedBuildTools} from "./qa-build-tool-core";
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)void (async()=>{assertEphemeralCi();const identity=producerIdentity();admitArtifact(path.resolve("artifact-evidence"));await prepareBuildTools(process.cwd(),identity);console.log("QA_PINNED_ROOTLESS_TOOLS_PREPARED");})().catch(()=>{console.error("QA_BUILD_TOOL_OR_ROOTLESS_PREFLIGHT_FAILED");process.exitCode=1;});
