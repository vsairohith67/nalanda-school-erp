import { readFileSync } from "node:fs";
import path from "node:path";
import { runAdmissionsQa } from "./qa23h-harness";

const root = process.cwd();
const schema = readFileSync(path.join(root, "prisma/schema.prisma"), "utf8");
const admissionsSchema = schema.slice(schema.indexOf("model AdmissionCycle"));
if (/residentialAddress|latitude|longitude|aadhaar|panNumber|medicalHistory|bankAccount/i.test(admissionsSchema)) throw new Error("ADMIT23HQA_PROHIBITED_ADMISSIONS_SCHEMA_FIELD");
const service = readFileSync(path.join(root, "lib/admissions.ts"), "utf8");
if (!service.includes("automaticMerge: false") || !service.includes("staffRanking: null")) throw new Error("ADMIT23HQA_GOVERNANCE_GUARD_MISSING");

runAdmissionsQa("independent").catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
