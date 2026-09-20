import { readFile, lstat, realpath } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { OPERATOR_COMMANDS, runPortableOperator, validateOperatorManifest, type OperatorCommand, type OperatorAdapter, type OperatorManifest } from "../../lib/portable-runtime/operator";
import { CiOperatorAdapter } from "./operator-adapter";
import { admitArtifact } from "./admit-artifact";

type CliDependencies = { qualify: (manifest:OperatorManifest)=>void; adapter:(workspace:string,manifest:OperatorManifest,command:OperatorCommand,resume:boolean)=>OperatorAdapter };
const productionDependencies:CliDependencies={qualify(manifest){
  const receipt=admitArtifact(path.resolve("artifact-evidence"));
  if(manifest.image!==receipt.imageConfigDigest||manifest.releaseCommit!==receipt.source||manifest.architecture!==receipt.architecture)throw Error("OPERATOR_ARTIFACT_MISMATCH");
  process.env.PORTABLE_IMAGE_ID=receipt.imageConfigDigest;
  if(manifest.previous){if(manifest.previous.image===manifest.image||manifest.previous.releaseCommit===manifest.releaseCommit)throw Error("DISTINCT_HISTORICAL_TARGET_REQUIRED");throw Error("QUALIFIED_HISTORICAL_PAIR_NOT_AVAILABLE");}
},adapter:(workspace,manifest,command,resume)=>new CiOperatorAdapter(workspace,manifest,path.join(workspace,"deploy","portable","compose.yml"),command,undefined,resume)};
// The public parser and dispatcher share this entrypoint with in-process adapter tests.
// There is deliberately no command-line/environment option for injecting an adapter.
export async function runOperatorCli(argv:string[], dependencies:CliDependencies=productionDependencies) {
  const [command, ...args] = argv;
  if (!OPERATOR_COMMANDS.includes(command as OperatorCommand)) throw new Error("OPERATOR_COMMAND_INVALID");
  const options = new Map<string, string>();
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (!["--manifest", "--target", "--apply", "--resume"].includes(key) || options.has(key)) throw new Error("OPERATOR_ARGUMENT_INVALID");
    options.set(key, key === "--apply" || key === "--resume" ? "true" : args[++i] ?? "");
  }
  const input = options.get("--manifest");
  const target = options.get("--target");
  if (!input || !target || !path.isAbsolute(input) || !path.isAbsolute(target)) throw new Error("EXPLICIT_ABSOLUTE_TARGET_REQUIRED");
  const stat = await lstat(input);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 65536 || await realpath(input) !== input || !input.endsWith(".json")) throw new Error("MANIFEST_FILE_INVALID");
  const manifest = validateOperatorManifest(JSON.parse(await readFile(input, "utf8")));
  if (manifest.target !== target) throw new Error("TARGET_MANIFEST_MISMATCH");
  dependencies.qualify(manifest);
  const workspace = path.resolve(".");
  const result = await runPortableOperator(command as OperatorCommand, manifest, dependencies.adapter(workspace,manifest,command as OperatorCommand,options.has("--resume")), { apply: options.has("--apply"), resume: options.has("--resume") });
  return { state: result.state, command, dryRun: !options.has("--apply"), preserveData: true, classification: "INTEGRATION_TEST_ENVIRONMENT", receipt: "receipt" in result ? result.receipt : undefined };
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)runOperatorCli(process.argv.slice(2)).then(result=>console.log(JSON.stringify(result))).catch(() => { console.error(JSON.stringify({ state: "FAILED", safeCode: "OPERATOR_COMMAND_FAILED", automaticRollback: false })); process.exitCode = 1; });
