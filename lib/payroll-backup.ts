import type { PrismaClient } from "@prisma/client";

export const PAYROLL_BACKUP_KEYS = [
  "payrollPolicyVersions", "salaryStructureVersions", "salaryComponentDefinitions",
  "staffCompensationAssignments", "salaryRevisions", "payrollPeriods", "payrollRuns",
  "employeePayrollResults", "payrollComponentResults", "salaryAdvances",
  "advanceRecoverySchedules", "payslipVersions", "payrollEvents"
] as const;
export type PayrollBackupKey = (typeof PAYROLL_BACKUP_KEYS)[number];
export type PayrollBackup = Record<PayrollBackupKey, Record<string, unknown>[]>;

const DELEGATE: Record<PayrollBackupKey, string> = {
  payrollPolicyVersions: "payrollPolicyVersion", salaryStructureVersions: "salaryStructureVersion",
  salaryComponentDefinitions: "salaryComponentDefinition", staffCompensationAssignments: "staffCompensationAssignment",
  salaryRevisions: "salaryRevision", payrollPeriods: "payrollPeriod", payrollRuns: "payrollRun",
  employeePayrollResults: "employeePayrollResult", payrollComponentResults: "payrollComponentResult",
  salaryAdvances: "salaryAdvance", advanceRecoverySchedules: "advanceRecoverySchedule",
  payslipVersions: "payslipVersion", payrollEvents: "payrollEvent"
};
const ORDER = [...PAYROLL_BACKUP_KEYS];

export async function loadPayrollBackup(client: PrismaClient): Promise<PayrollBackup> {
  const entries = await Promise.all(ORDER.map(async key => {
    const delegate = (client as any)[DELEGATE[key]];
    return [key, delegate?.findMany ? await delegate.findMany({ orderBy: { createdAt: "asc" } }) : []] as const;
  }));
  return Object.fromEntries(entries) as PayrollBackup;
}

export function validatePayrollBackupRows(root: Record<string, unknown>): PayrollBackup {
  const result = Object.fromEntries(PAYROLL_BACKUP_KEYS.map(key => [key, rows(root[key], key)])) as PayrollBackup;
  const ids = (key: PayrollBackupKey) => new Set(result[key].map(row => String(row.id ?? "")));
  const policyIds=ids("payrollPolicyVersions"), structureIds=ids("salaryStructureVersions"), componentIds=ids("salaryComponentDefinitions"), assignmentIds=ids("staffCompensationAssignments"), periodIds=ids("payrollPeriods"), runIds=ids("payrollRuns"), resultIds=ids("employeePayrollResults"), advanceIds=ids("salaryAdvances");
  links(result.salaryStructureVersions,"policyVersionId",policyIds); links(result.salaryComponentDefinitions,"structureVersionId",structureIds);
  links(result.staffCompensationAssignments,"structureVersionId",structureIds); links(result.salaryRevisions,"previousAssignmentId",assignmentIds); links(result.salaryRevisions,"newAssignmentId",assignmentIds);
  links(result.payrollRuns,"periodId",periodIds); links(result.payrollRuns,"policyVersionId",policyIds); links(result.payrollRuns,"sourceRunId",runIds,true);
  links(result.employeePayrollResults,"payrollRunId",runIds); links(result.employeePayrollResults,"compensationAssignmentId",assignmentIds);
  links(result.payrollComponentResults,"employeePayrollResultId",resultIds); links(result.payrollComponentResults,"componentDefinitionId",componentIds,true);
  links(result.advanceRecoverySchedules,"salaryAdvanceId",advanceIds); links(result.advanceRecoverySchedules,"payrollPeriodId",periodIds); links(result.advanceRecoverySchedules,"recoveredPayrollResultId",resultIds,true);
  links(result.payslipVersions,"employeePayrollResultId",resultIds); links(result.payrollEvents,"payrollRunId",runIds,true);
  for (const component of result.salaryComponentDefinitions) if (/EPF|ESI|TDS|PENSION|PROFESSIONAL[_ -]?TAX/i.test(String(component.componentCode ?? "")) && (component.statutoryTreatment !== "MANUAL_OR_EXTERNALLY_APPROVED" || component.calculationMode !== "MANUAL")) throw new Error("Payroll backup contains an executable unapproved statutory-looking component.");
  const serialized = JSON.stringify(result).toLowerCase();
  for (const forbidden of ["passwordhash", "aadhaar", "pannumber", "uannumber", "bankaccount", "accountnumber", "ifsc"]) if (serialized.includes(forbidden)) throw new Error("Payroll backup contains prohibited credential or identity data.");
  return result;
}

export async function restorePayrollBackup(client: PrismaClient, backup: PayrollBackup) {
  const result = Object.fromEntries(PAYROLL_BACKUP_KEYS.map(key => [key, { created: 0, skipped: 0, errors: [] as string[] }])) as Record<PayrollBackupKey, { created: number; skipped: number; errors: string[] }>;
  for (const key of ORDER) {
    const delegate = (client as any)[DELEGATE[key]];
    for (const [index, row] of backup[key].entries()) try {
      const id=String(row.id??""); if(!id)throw new Error("missing preserved ID");
      if(await delegate.findUnique({where:{id},select:{id:true}})){result[key].skipped++;continue;}
      await delegate.create({data:row}); result[key].created++;
    } catch(error) { result[key].errors.push(`${key}[${index}]: ${error instanceof Error?error.message:"restore failed"}`); }
  }
  return result;
}

function rows(value: unknown, label: string) { if(value===undefined)return [];if(!Array.isArray(value)||value.length>100_000)throw new Error(`${label} must be a bounded array.`);return value.map((item,index)=>{if(!item||typeof item!=="object"||Array.isArray(item))throw new Error(`${label}[${index}] must be an object.`);const row=item as Record<string,unknown>;if(!row.id||Object.keys(row).length>100)throw new Error(`${label}[${index}] is malformed.`);return row;}); }
function links(rows: Record<string,unknown>[], field:string, allowed:Set<string>, optional=false){rows.forEach((row,index)=>{const value=row[field];if(optional&&(value==null||value===""))return;if(!allowed.has(String(value??"")))throw new Error(`Payroll backup row ${index} has an invalid ${field} relationship.`);});}
