import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, StatusBadge } from "@/components/ui";
import { StudentProgressionForm } from "@/components/student-progression-form";
import { requirePermission } from "@/lib/auth";
import { displayDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getEffectivePermissions, permissionSetCan } from "@/lib/role-permissions";
import { decisionLabel, progressionInclude } from "@/lib/student-progression";

export default async function ProgressionDecisionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("VIEW_STUDENT_PROGRESSION"); const { id } = await params;
  const [decision, permissions, students] = await Promise.all([
    prisma.studentProgressionDecision.findUnique({ where: { id }, include: progressionInclude }),
    getEffectivePermissions(prisma, user.role),
    prisma.student.findMany({ where: { deletedAt: null }, select: { id: true, admissionNo: true, studentName: true, academicYearEnrollments: { orderBy: [{ academicYear: "desc" }], select: { id: true, academicYear: true, className: true, section: true, status: true } } }, orderBy: [{ studentName: "asc" }] })
  ]);
  if (!decision) notFound();
  const generatedEvent = decision.status === "FINALIZED" ? await prisma.studentLifecycleEvent.findFirst({ where: { studentId: decision.studentId, eventType: decision.decisionType === "TRANSFER_OUT" ? "TRANSFERRED_OUT" : decision.decisionType, effectiveDate: decision.effectiveDate, createdAt: { gte: decision.createdAt } }, select: { eventType: true, effectiveDate: true } }) : null;
  const access = { manage: permissionSetCan(permissions, "MANAGE_STUDENT_PROGRESSION"), approve: permissionSetCan(permissions, "APPROVE_STUDENT_PROGRESSION"), finalize: permissionSetCan(permissions, "FINALIZE_STUDENT_PROGRESSION") };
  return <div className="page"><PageHeader title={`${decision.student.studentName} - ${decisionLabel(decision.decisionType)}`} description={`Admission ${decision.student.admissionNo}. Decision records and audit fields are preserved.`} action={<Link className="button secondary" href="/students/progression">Back to decisions</Link>} />
    <section className="card card-pad progression-summary"><div><span>Status</span><StatusBadge status={decision.status} /></div><div><span>Source</span><strong>{decision.academicYear} / {decision.fromClass}{decision.fromSection ? `-${decision.fromSection}` : ""} / {decisionLabel(decision.fromStatus || "-")}</strong></div><div><span>Preview target</span><strong>{decision.toAcademicYear ? `${decision.toAcademicYear} / ` : ""}{decision.toClass || "No target enrollment"}{decision.toSection ? `-${decision.toSection}` : ""}</strong></div><div><span>Effective date</span><strong>{displayDate(decision.effectiveDate)}</strong></div></section>
    {decision.status !== "DRAFT" ? <section className="card card-pad"><h3>Decision record</h3><dl className="audit-grid"><dt>Reason</dt><dd>{decision.reason || "-"}</dd><dt>Evidence</dt><dd>{decision.evidenceNotes || "-"}</dd><dt>Parent acknowledgement</dt><dd>{decision.parentAcknowledgementNotes || "-"}</dd><dt>Fee warning</dt><dd>{decision.feeWarningNotes || "None (informational only)"}</dd><dt>Submitted</dt><dd>{auditValue(decision.submittedBy?.name, decision.submittedAt)}</dd><dt>Approved</dt><dd>{auditValue(decision.approvedBy?.name, decision.approvedAt)}</dd><dt>Rejected reason</dt><dd>{decision.rejectionReason || "-"}</dd><dt>Cancelled</dt><dd>{auditValue(decision.cancelledBy?.name, decision.cancelledAt)}{decision.cancellationReason ? ` — ${decision.cancellationReason}` : ""}</dd><dt>Finalized</dt><dd>{auditValue(decision.finalizedBy?.name, decision.finalizedAt)}</dd><dt>Lifecycle result</dt><dd>{generatedEvent ? `${decisionLabel(generatedEvent.eventType)} event recorded on ${displayDate(generatedEvent.effectiveDate)}. View the student lifecycle for history.` : decision.status === "FINALIZED" ? "Finalized lifecycle history is recorded." : "Not generated before finalization."}</dd></dl></section> : null}
    <StudentProgressionForm students={students} decision={decision as any} permissions={access} />
  </div>;
}
function auditValue(name: string | undefined, date: Date | null) { return name && date ? `${name} on ${displayDate(date)}` : "-"; }
