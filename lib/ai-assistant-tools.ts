import type { Role } from "@/lib/permissions";
import type { RetrievedEvidence } from "@/lib/ai-assistant-types";

type ToolClient = any;
type ToolDefinition = {
  key: string;
  displayName: string;
  description: string;
  allowedRoles: Role[];
  allowedModes: ["AGGREGATE_OPERATIONS"];
  maximumRows: number;
  aggregationThreshold: number;
  freshness: string;
  run: (client: ToolClient, now: Date) => Promise<Record<string, unknown>>;
};

const LEADERSHIP: Role[] = ["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL"];
const ADMIN_DOC_ONLY: Role[] = ["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL"];
const safeCount = async (delegate: any, where?: any) => delegate?.count ? delegate.count({ ...(where ? { where } : {}) }) : null;

export const AI_TOOL_REGISTRY: Record<string, ToolDefinition> = {
  "school.overview": tool("School operational overview", "Counts active operational records by module.", async (db) => ({
    activeStudents: await safeCount(db.student, { status: { in: ["Active", "ACTIVE"] }, deletedAt: null }),
    activeStaff: await safeCount(db.staffMember, { status: "ACTIVE" }),
    activeGuardians: await safeCount(db.guardian, { status: "ACTIVE" })
  })),
  "students.enrollment_summary": tool("Enrollment aggregate", "Active Student and academic-year enrollment totals.", async (db) => ({
    activeStudents: await safeCount(db.student, { status: { in: ["Active", "ACTIVE"] }, deletedAt: null }),
    activeEnrollments: await safeCount(db.academicYearEnrollment, { status: "ACTIVE" })
  })),
  "fees.collection_summary": tool("Fee collection aggregate", "Non-cancelled collection and dues-input totals without receipt or Student detail.", async (db) => {
    const collection = await db.payment.aggregate({ where: { isCancelled: false, deletedAt: null }, _sum: { amountPaid: true }, _count: true });
    return { paymentRows: collection._count, collectedAmount: collection._sum.amountPaid ?? null, note: "Dues interpretation requires the configured fee schedule and remains an operational estimate." };
  }),
  "attendance.student_summary": tool("Student attendance aggregate", "Aggregate attendance session and record counts.", async (db) => ({
    sessions: await safeCount(db.studentAttendanceSession), records: await safeCount(db.studentAttendanceRecord),
    present: await safeCount(db.studentAttendanceRecord, { status: "PRESENT" }), absent: await safeCount(db.studentAttendanceRecord, { status: "ABSENT" })
  })),
  "attendance.staff_summary": tool("Staff attendance and leave aggregate", "Aggregate Staff attendance and approved-leave counts.", async (db) => ({
    sessions: await safeCount(db.staffAttendanceSession), records: await safeCount(db.staffAttendanceRecord),
    approvedLeave: await safeCount(db.staffLeaveRequest, { status: "APPROVED" })
  })),
  "homework.summary": tool("Homework aggregate", "Assignment workflow totals without Teacher or Student detail.", async (db) => ({
    total: await safeCount(db.homeworkAssignment), published: await safeCount(db.homeworkAssignment, { status: "PUBLISHED" }), draft: await safeCount(db.homeworkAssignment, { status: "DRAFT" })
  })),
  "exams.workflow_summary": tool("Exams workflow aggregate", "Exam and assessment workflow totals; no Student marks.", async (db) => ({
    exams: await safeCount(db.examCycle), assessments: await safeCount(db.examAssessment), approvedExams: await safeCount(db.examCycle, { status: "APPROVED" })
  })),
  "report_cards.completion_summary": tool("Report-card completion aggregate", "Report-card workflow totals; no individual grades or rubrics.", async (db) => ({
    total: await safeCount(db.studentReportCard), issued: await safeCount(db.studentReportCard, { status: "ISSUED" }), approved: await safeCount(db.studentReportCard, { status: "APPROVED" })
  })),
  "library.summary": tool("Library aggregate", "Catalogue, copy and active-loan totals.", async (db) => ({
    titles: await safeCount(db.libraryTitle), copies: await safeCount(db.libraryCopy), activeLoans: await safeCount(db.libraryLoan, { status: "ISSUED" })
  })),
  "certificates.summary": tool("Certificate and Class X aggregate", "Aggregate request, issue and package totals.", async (db) => ({
    certificateRequests: await safeCount(db.studentCertificateRequest), issuedCertificates: await safeCount(db.studentCertificate, { status: "ISSUED" }), classXPackages: await safeCount(db.classXDocumentPackage)
  })),
  "communications.summary": tool("Communication-channel aggregate", "In-app, WhatsApp, SMS and Email workflow totals without recipient detail.", async (db) => ({
    notificationCampaigns: await safeCount(db.notificationCampaign), whatsappBatches: await safeCount(db.whatsAppOutboundBatch), smsEmailBatches: await safeCount(db.smsEmailOutboundBatch)
  })),
  "system.release_checkpoint": tool("System release checkpoint", "Current registered route/test/backup checkpoint from the Prompt 20A baseline.", async () => ({
    pageRoutes: 234, apiRoutes: 341, tests: 1210, testFiles: 128, backupVersion: 34, checkpointDate: "2026-07-19", status: "Prompt 20A read-only AI assistant QA checkpoint."
  }))
};

function tool(displayName: string, description: string, run: ToolDefinition["run"]): ToolDefinition {
  return { key: "", displayName, description, allowedRoles: ADMIN_DOC_ONLY, allowedModes: ["AGGREGATE_OPERATIONS"], maximumRows: 100, aggregationThreshold: 5, freshness: "Calculated at request time", run };
}
for (const [key, value] of Object.entries(AI_TOOL_REGISTRY)) value.key = key;

export async function runAggregateTool(client: ToolClient, key: string, role: Role, minimumGroupSize: number, maximumRows = 100): Promise<RetrievedEvidence> {
  const definition = AI_TOOL_REGISTRY[key];
  if (!definition || !definition.allowedRoles.includes(role)) throw new Error("TOOL_ROLE_BLOCKED");
  const now = new Date();
  const rawData = await definition.run(client, now);
  const rowLimit = Math.max(1, Math.min(maximumRows, definition.maximumRows));
  const data = Object.fromEntries(Object.entries(rawData).map(([field, value]) => [
    field,
    Array.isArray(value) ? value.slice(0, rowLimit) : value
  ]));
  const numericGroups = Object.values(data).filter((value): value is number => typeof value === "number");
  const sensitiveSmallGroup = numericGroups.some((value) => value > 0 && value < Math.max(minimumGroupSize, definition.aggregationThreshold));
  const safeData = sensitiveSmallGroup ? Object.fromEntries(Object.entries(data).map(([field, value]) => typeof value === "number" && value > 0 && value < minimumGroupSize ? [field, `Below privacy threshold (${minimumGroupSize})`] : [field, value])) : data;
  return {
    sourceKey: key,
    sourceCategory: "AGGREGATE_TOOL",
    text: `${definition.displayName} calculated facts:\n${JSON.stringify(safeData, null, 2)}`,
    citation: { id: `tool-${key.replace(/\W/g, "-")}`, sourceKey: key, label: definition.displayName, sourceTimestamp: now.toISOString() },
    completeness: Object.values(data).some((value) => value === null) ? "PARTIAL" : "COMPLETE"
  };
}

export function chooseAggregateTools(question: string) {
  const q = question.toLowerCase();
  const mapping: Array<[RegExp, string]> = [
    [/fee|collection|dues/, "fees.collection_summary"], [/student attendance/, "attendance.student_summary"],
    [/staff attendance|leave/, "attendance.staff_summary"], [/enrol|student count/, "students.enrollment_summary"],
    [/homework|assignment/, "homework.summary"], [/exam|marks workflow/, "exams.workflow_summary"],
    [/report card/, "report_cards.completion_summary"], [/library|book loan/, "library.summary"],
    [/certificate|class x/, "certificates.summary"], [/notification|whatsapp|sms|email|communication/, "communications.summary"],
    [/route|test|backup|release|checkpoint/, "system.release_checkpoint"]
  ];
  const selected = mapping.filter(([pattern]) => pattern.test(q)).map(([, key]) => key);
  return selected.length ? [...new Set(selected)] : ["school.overview"];
}
