import { readFile, lstat, realpath } from "node:fs/promises";
import path from "node:path";
import { OPERATOR_COMMANDS, runPortableOperator, validateOperatorManifest, type OperatorCommand } from "../../lib/portable-runtime/operator";
import { CiOperatorAdapter } from "./operator-adapter";

async function main() {
  const [command, ...args] = process.argv.slice(2);
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
  const workspace = path.resolve(".");
  const result = await runPortableOperator(command as OperatorCommand, manifest, new CiOperatorAdapter(workspace, manifest, path.join(workspace, "deploy", "portable", "compose.yml"), command as OperatorCommand, undefined, options.has("--resume")), { apply: options.has("--apply"), resume: options.has("--resume") });
  console.log(JSON.stringify({ state: result.state, command, dryRun: !options.has("--apply"), preserveData: true, classification: "INTEGRATION_TEST_ENVIRONMENT", receipt: "receipt" in result ? result.receipt : undefined }));
}
main().catch(() => { console.error(JSON.stringify({ state: "FAILED", safeCode: "OPERATOR_COMMAND_FAILED", automaticRollback: false })); process.exitCode = 1; });
