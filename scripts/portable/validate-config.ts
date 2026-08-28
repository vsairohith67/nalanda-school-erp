import { validatePortableRuntimeConfiguration } from "@/lib/portable-runtime/config";

const command = process.argv[2] || process.env.NALANDA_IMAGE_COMMAND || "web";
const result = validatePortableRuntimeConfiguration(process.env, command);
if (!result.ok) {
  console.error(JSON.stringify({ result: "PORTABLE_RUNTIME_CONFIGURATION_INVALID", issueCodes: [...new Set(result.issues.map((issue) => issue.code))].sort() }));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ result: "PORTABLE_RUNTIME_CONFIGURATION_VALID", environment: result.configuration.environment, command: result.configuration.command }));
}
