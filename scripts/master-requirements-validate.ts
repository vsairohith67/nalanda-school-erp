import { readFileSync } from "node:fs";
import { repositorySourceReader, validateMasterRequirements } from "../lib/master-requirements";

const register = JSON.parse(readFileSync("config/master-requirements-register.json", "utf8"));
const errors = validateMasterRequirements(register, repositorySourceReader());
if (errors.length) { console.error(JSON.stringify({ result: "MASTER_REGISTER_INVALID", errors })); process.exitCode = 1; }
else console.log(JSON.stringify({ result: "MASTER_REGISTER_VALID", requirementCount: register.requirementCount, statusCounts: register.statusCounts, nextPrompt: register.generatedNextPrompt.state }));
