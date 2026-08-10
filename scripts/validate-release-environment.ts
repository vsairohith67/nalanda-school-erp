import { validateReleaseEnvironmentContract } from "../lib/deployment-environment";

const result = validateReleaseEnvironmentContract(process.env);
if (!result.ok) {
  console.error(JSON.stringify({ ok: false, environment: result.environment, issues: result.issues.map(({ code, variable, message }) => ({ code, variable, message })) }));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ ok: true, environment: result.environment, classifications: result.classifications.map(({ name, classification }) => ({ name, classification })), secretValuesPrinted: false }));
}
