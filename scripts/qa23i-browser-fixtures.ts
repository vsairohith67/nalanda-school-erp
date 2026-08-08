import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/password";
import { fileSha256 } from "./migration-check-utils";

const independent = process.argv.includes("--independent");
const prefix = independent ? "PAY23IQA" : "PAY23I";
const rootName = independent ? "pay23iqa-browser" : "pay23i-browser";
const workspace = path.resolve(".");
const operational = path.join(workspace, "prisma", "dev.db");
const root = path.join(workspace, "tmp", rootName);
const database = path.join(root, `${rootName}.db`);
const credentialsPath = path.join(root, "credentials.json");
const runtimePath = path.join(root, "runtime-env.json");
const port = independent ? 3242 : 3241;
const databaseUrl = (file: string) => `file:${file.replaceAll("\\", "/")}`;

function checkedRoot() {
  const resolved = path.resolve(root);
  if (resolved !== path.join(path.resolve(workspace), "tmp", rootName)) throw new Error("PAY23I_BROWSER_CLEANUP_SCOPE_REFUSED");
  return resolved;
}

function migrate(environment: NodeJS.ProcessEnv) {
  const pnpm = path.join(process.env.APPDATA ?? "", "npm", "node_modules", "pnpm", "bin", "pnpm.mjs");
  const result = spawnSync(process.execPath, [pnpm, "exec", "prisma", "migrate", "deploy", "--schema", "prisma/schema.prisma"], { cwd: workspace, env: environment, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, windowsHide: true });
  if (result.error || result.status !== 0) throw new Error(`PAY23I_BROWSER_MIGRATION_FAILED:${result.error?.message ?? `${result.stdout}\n${result.stderr}`}`);
}

async function createUser(client: PrismaClient, role: "DIRECTOR" | "ACCOUNTANT" | "TEACHER", password: string, parent = false) {
  const username = `${prefix.toLowerCase()}-browser-${role.toLowerCase()}`;
  const user = await client.user.create({ data: { iamPublicKey: randomUUID(), name: `${prefix} Browser ${role}`, designation: role === "TEACHER" ? "Senior Teacher" : `${role} synthetic QA`, username, passwordHash: await hashPassword(password), role, isActive: true, lifecycleStatus: "ACTIVE" } });
  await client.authLoginAlias.create({ data: { userId: user.id, type: "USERNAME", normalizedValue: username, displayMasked: username, status: "VERIFIED", isSchoolGoverned: true, verifiedAt: new Date() } });
  await client.userRoleAssignment.create({ data: { publicKey: randomUUID(), userId: user.id, role, status: "ACTIVE", reason: `${prefix} isolated Browser fixture`, assignedByUserId: user.id, activeKey: `${user.id}:${role}` } });
  if (parent) await client.userRoleAssignment.create({ data: { publicKey: randomUUID(), userId: user.id, role: "PARENT", status: "ACTIVE", reason: `${prefix} Staff and Parent context boundary`, assignedByUserId: user.id, activeKey: `${user.id}:PARENT` } });
  return user;
}

async function setup() {
  const before = { sha256: fileSha256(operational), size: statSync(operational).size };
  const fixtureRoot = checkedRoot();
  if (existsSync(fixtureRoot)) rmSync(fixtureRoot, { recursive: true, force: true });
  mkdirSync(fixtureRoot, { recursive: true });
  copyFileSync(operational, database);
  const secret = randomBytes(48).toString("base64url");
  const password = `${randomBytes(18).toString("base64url")}Aa1!`;
  const origin = `http://localhost:${port}`;
  const environment: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "production", DATABASE_URL: databaseUrl(database), SESSION_SECRET: secret, AUTH_SECRET: secret, APP_ORIGIN: origin, PORT: String(port) };
  migrate(environment);
  const client = new PrismaClient({ datasourceUrl: databaseUrl(database) });
  try {
    const [director, accountant, teacher] = await Promise.all([createUser(client, "DIRECTOR", password), createUser(client, "ACCOUNTANT", password), createUser(client, "TEACHER", password, true)]);
    const staff = await client.staffMember.create({ data: { iamPublicKey: randomUUID(), staffCode: `${prefix}-BROWSER-001`, fullName: `${prefix} Browser Employee With A Long Name`, displayName: `${prefix} Browser Employee`, designation: "Senior Teacher", department: "Academics", dateOfJoining: new Date("2025-06-12T00:00:00Z"), status: "ACTIVE", userId: teacher.id } });
    const policy = await client.payrollPolicyVersion.create({ data: { publicKey: randomUUID(), policyCode: `${prefix}_GENERAL`, versionNumber: 1, name: "Governed monthly payroll", status: "LOCKED", effectiveFrom: new Date("2026-01-01T00:00:00Z"), approvalReference: `${prefix}-POLICY-APPROVED`, approvedByUserId: director.id, approvedAt: new Date(), lockedAt: new Date() } });
    const structure = await client.salaryStructureVersion.create({ data: { publicKey: randomUUID(), structureCode: `${prefix}_TEACHER`, versionNumber: 2, name: "Senior Teacher Structure", description: "Effective-dated governed structure", status: "LOCKED", policyVersionId: policy.id, effectiveFrom: new Date("2026-07-01T00:00:00Z"), approvalReference: `${prefix}-STRUCTURE-APPROVED`, approvedByUserId: director.id, approvedAt: new Date(), lockedAt: new Date(), estimatedGrossPaise: 4400000 } });
    const components = await Promise.all([
      client.salaryComponentDefinition.create({ data: { publicKey: randomUUID(), structureVersionId: structure.id, componentCode: "BASIC", name: "Basic salary", classification: "EARNING", calculationMode: "FIXED", defaultAmountPaise: 4000000, prorationRule: "PRORATE_ELIGIBILITY", effectiveFrom: new Date("2026-07-01T00:00:00Z"), displayOrder: 1 } }),
      client.salaryComponentDefinition.create({ data: { publicKey: randomUUID(), structureVersionId: structure.id, componentCode: "FIXED_ALLOWANCE", name: "Fixed allowance", classification: "EARNING", calculationMode: "FIXED", defaultAmountPaise: 400000, prorationRule: "PRORATE_ELIGIBILITY", effectiveFrom: new Date("2026-07-01T00:00:00Z"), displayOrder: 2 } }),
      client.salaryComponentDefinition.create({ data: { publicKey: randomUUID(), structureVersionId: structure.id, componentCode: "ADVANCE_RECOVERY", name: "Salary advance recovery", classification: "DEDUCTION", calculationMode: "CALCULATED", calculationRule: "ADVANCE_RECOVERY", effectiveFrom: new Date("2026-07-01T00:00:00Z"), displayOrder: 3 } })
    ]);
    const assignment = await client.staffCompensationAssignment.create({ data: { publicKey: randomUUID(), staffMemberId: staff.id, structureVersionId: structure.id, effectiveFrom: new Date("2026-07-01T00:00:00Z"), payrollEligibleFrom: new Date("2026-07-01T00:00:00Z"), reason: "Approved synthetic Browser assignment", approvedByUserId: director.id, approvedAt: new Date() } });
    await client.salaryRevision.create({ data: { publicKey: randomUUID(), staffMemberId: staff.id, newAssignmentId: assignment.id, effectiveDate: new Date("2026-07-01T00:00:00Z"), status: "EFFECTIVE", oldGrossPaise: 4000000, newGrossPaise: 4400000, reason: "Approved synthetic salary revision", approverUserId: director.id, approvedAt: new Date() } });
    const period = await client.payrollPeriod.create({ data: { publicKey: randomUUID(), periodCode: `${prefix}_BROWSER_2026_07`, payrollMonth: "2026-07", startDate: new Date("2026-07-01T00:00:00Z"), endDate: new Date("2026-07-31T00:00:00Z"), status: "INPUTS_LOCKED", requiredAttendanceDatesJson: JSON.stringify(["2026-07-01", "2026-07-31"]), inputApprovalReference: `${prefix}-ATTENDANCE-LOCKED`, inputsLockedByUserId: director.id, inputsLockedAt: new Date() } });
    const run = await client.payrollRun.create({ data: { publicKey: randomUUID(), runNumber: `${prefix}-PAY-2026-07-01`, requestKey: randomUUID(), periodId: period.id, policyVersionId: policy.id, status: "PAYSLIPS_ISSUED", manualAdjustmentsJson: JSON.stringify([{ code: "ARREARS", amountPaise: 150000, reason: "Approved correction" }]), inputSnapshotJson: JSON.stringify({ attendance: "LOCKED", leave: "APPROVED" }), formulaPreviewJson: JSON.stringify({ basis: "calendar_days", policyVersion: 1 }), financePostingPreviewJson: JSON.stringify({ postingAllowed: false, reason: "Fail closed" }), totalGrossPaise: 4550000, totalDeductionPaise: 200000, totalNetPaise: 4350000, employeeCount: 1, preparedByUserId: accountant.id, submittedByUserId: accountant.id, approvedByUserId: director.id, lockedByUserId: director.id, payslipsIssuedByUserId: director.id, submittedAt: new Date(), approvedAt: new Date(), lockedAt: new Date(), payslipsIssuedAt: new Date(), reason: "Synthetic governed Browser payroll", version: 6 } });
    const result = await client.employeePayrollResult.create({ data: { publicKey: randomUUID(), payrollRunId: run.id, staffMemberId: staff.id, compensationAssignmentId: assignment.id, status: "APPROVED", eligibleDays: 31, periodDays: 31, unpaidLeaveUnits: 1, attendanceSummaryJson: JSON.stringify({ approvedPresentDays: 30, approvedUnpaidLeaveDays: 0.5, sourceStatus: "LOCKED" }), sourceVersionsJson: JSON.stringify({ policy: `${policy.policyCode}:1`, structure: `${structure.structureCode}:2`, period: `${period.periodCode}:1` }), formulaSnapshotJson: JSON.stringify({ gross: "40000.00 + 4000.00 + 1500.00", deduction: "2000.00 advance recovery", net: "45500.00 - 2000.00" }), grossPaise: 4550000, deductionPaise: 200000, netPaise: 4350000 } });
    await Promise.all([
      client.payrollComponentResult.create({ data: { employeePayrollResultId: result.id, componentDefinitionId: components[0].id, componentCode: "BASIC", componentName: "Basic salary", classification: "EARNING", amountPaise: 4000000, roundingRule: "NEAREST_PAISE", formulaText: "INR 40,000.00 fixed", sourceVersionReference: `${structure.structureCode}:2/BASIC:1`, displayOrder: 1 } }),
      client.payrollComponentResult.create({ data: { employeePayrollResultId: result.id, componentDefinitionId: components[1].id, componentCode: "FIXED_ALLOWANCE", componentName: "Fixed allowance", classification: "EARNING", amountPaise: 400000, roundingRule: "NEAREST_PAISE", formulaText: "INR 4,000.00 fixed", sourceVersionReference: `${structure.structureCode}:2/FIXED_ALLOWANCE:1`, displayOrder: 2 } }),
      client.payrollComponentResult.create({ data: { employeePayrollResultId: result.id, componentCode: "ARREARS", componentName: "Approved arrears", classification: "EARNING", amountPaise: 150000, roundingRule: "NEAREST_PAISE", formulaText: "INR 1,500.00 approved manual adjustment", sourceVersionReference: `${run.runNumber}:adjustment`, displayOrder: 3 } }),
      client.payrollComponentResult.create({ data: { employeePayrollResultId: result.id, componentDefinitionId: components[2].id, componentCode: "ADVANCE_RECOVERY", componentName: "Salary advance recovery", classification: "DEDUCTION", amountPaise: 200000, roundingRule: "NEAREST_PAISE", formulaText: "INR 2,000.00 approved recovery schedule", sourceVersionReference: `${period.periodCode}:recovery`, displayOrder: 4 } })
    ]);
    const snapshot = { schema: "NALANDA_PAYSLIP_V1", school: { name: "Nalanda Public School", address: "Synthetic QA campus" }, staff: { name: staff.fullName, designation: staff.designation, department: staff.department }, payrollMonth: period.payrollMonth, earnings: [{ code: "BASIC", name: "Basic salary", amountPaise: 4000000 }, { code: "FIXED_ALLOWANCE", name: "Fixed allowance", amountPaise: 400000 }, { code: "ARREARS", name: "Approved arrears", amountPaise: 150000 }], deductions: [{ code: "ADVANCE_RECOVERY", name: "Salary advance recovery", amountPaise: 200000 }], reimbursements: [], totals: { grossPaise: 4550000, deductionPaise: 200000, reimbursementPaise: 0, netPaise: 4350000 }, attendance: { approvedPresentDays: 30, approvedUnpaidLeaveDays: 0.5 }, formula: { net: "gross - deductions" }, sourceVersions: { policy: 1, structure: 2 }, issue: { version: 1, issueDate: "2026-08-08", runReference: run.runNumber } };
    const snapshotJson = JSON.stringify(snapshot);
    await client.payslipVersion.create({ data: { publicKey: randomUUID(), employeePayrollResultId: result.id, staffMemberId: staff.id, versionNumber: 1, reference: `${prefix}-PAYSLIP-2026-07-0001`, snapshotJson, snapshotSha256: createHash("sha256").update(snapshotJson).digest("hex"), issueDate: new Date(), issuedByUserId: director.id } });
    const advance = await client.salaryAdvance.create({ data: { publicKey: randomUUID(), advanceNumber: `${prefix}-ADV-0001`, staffMemberId: staff.id, requestedAmountPaise: 600000, requestedReason: "Approved synthetic emergency advance", status: "APPROVED", approvedAmountPaise: 600000, remainingBalancePaise: 400000, approvalReason: "Governed recovery across payroll periods", approvedByUserId: director.id, approvedAt: new Date(), version: 2 } });
    await client.advanceRecoverySchedule.create({ data: { publicKey: randomUUID(), salaryAdvanceId: advance.id, sequenceNumber: 1, payrollPeriodId: period.id, scheduledAmountPaise: 200000, recoveredAmountPaise: 200000, status: "RECOVERED", employeePayrollResultId: result.id, recoveredAt: new Date(), revisionReason: "Approved schedule" } });
    await client.payrollEvent.create({ data: { publicKey: randomUUID(), payrollRunId: run.id, entityType: "PAYROLL_RUN", entityPublicKey: run.publicKey, eventType: "PAYSLIPS_ISSUED", previousStatus: "LOCKED", newStatus: "PAYSLIPS_ISSUED", entityVersion: 6, actorUserId: director.id, actorRole: "DIRECTOR", reason: "Synthetic Browser proof" } });
    writeFileSync(credentialsPath, JSON.stringify({ director: { username: director.username, password, paths: ["/payroll", "/payroll/reports"] }, accountant: { username: accountant.username, password, paths: ["/payroll", "/payroll/reports"] }, teacherParent: { username: teacher.username, password, paths: ["/my-payroll", "/access-context"] } }));
    writeFileSync(runtimePath, JSON.stringify(environment));
    const after = { sha256: fileSha256(operational), size: statSync(operational).size };
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error("PAY23I_BROWSER_OPERATIONAL_DATABASE_CHANGED");
    console.log(JSON.stringify({ result: independent ? "PAY23IQA_BROWSER_FIXTURES_READY" : "PAY23I_BROWSER_FIXTURES_READY", copiedDatabase: true, port, roles: ["DIRECTOR", "ACCOUNTANT", "TEACHER", "PARENT"], staff: 1, payslips: 1, operationalMutation: false }));
  } finally { await client.$disconnect(); }
}

function cleanup() {
  const fixtureRoot = checkedRoot();
  if (existsSync(fixtureRoot)) rmSync(fixtureRoot, { recursive: true, force: true });
  console.log(JSON.stringify({ result: "PAY23I_BROWSER_FIXTURES_REMOVED", exists: existsSync(fixtureRoot) }));
}

const mode = process.argv.find((value) => value === "setup" || value === "cleanup");
if (mode === "setup") setup().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
else if (mode === "cleanup") cleanup();
else { console.error("Use setup or cleanup"); process.exitCode = 1; }
