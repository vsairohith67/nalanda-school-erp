import {
  formatDeploymentEnvironmentResult,
  validateDeploymentEnvironment
} from "../lib/deployment-environment";

const result = validateDeploymentEnvironment(process.env);
console.log(formatDeploymentEnvironmentResult(result));
if (!result.ok) process.exitCode = 1;
