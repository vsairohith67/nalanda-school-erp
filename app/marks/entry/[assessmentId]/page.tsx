import { notFound } from "next/navigation";
import { MarkEntryGrid } from "@/components/mark-entry-grid";
import { PageHeader } from "@/components/ui";
import { requirePermission, getCurrentUserEffectivePermissions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadScopedAssessment } from "@/lib/marks-api";
import { loadMarkEntry } from "@/lib/marks";
import { permissionSetCan } from "@/lib/role-permissions";
import { displayDate } from "@/lib/format";
import { resolveMarksWriteAuthority } from "@/lib/academic-integrity";

export default async function Page({ params }: { params: Promise<{ assessmentId: string }> }) {
  const user = await requirePermission("ENTER_MARKS");
  const id = (await params).assessmentId;
  let scoped;
  try { scoped = await loadScopedAssessment(user, id, "WRITE"); } catch { notFound(); }
  const [loaded, permissions, authority] = await Promise.all([
    loadMarkEntry(prisma, id),
    getCurrentUserEffectivePermissions(),
    resolveMarksWriteAuthority(prisma, user, { kind: "LEGACY_ASSESSMENT", assessmentId: scoped.id, examId: scoped.examCycleId, academicYear: scoped.academicYear, className: scoped.className, section: scoped.section, subjectId: scoped.timetableSubjectId, subjectName: scoped.subjectName, componentName: scoped.componentName })
  ]);
  const assessment = loaded.assessment;
  const clientAssessment = { id: assessment.id, examCycleId: assessment.examCycleId, className: assessment.className, section: assessment.section || null, subjectName: assessment.subjectName, componentName: assessment.componentName || null, maxMarks: assessment.maxMarks.toString(), passMarks: assessment.passMarks?.toString() ?? null, entryStatus: assessment.entryStatus, updatedAt: assessment.updatedAt.toISOString() };
  const rows = loaded.students.map((row) => ({ ...row, rollNo: row.rollNo ?? null }));
  const leadership = authority.mode === "LEADERSHIP";
  return <div className="page marks-page">
    <PageHeader title="Mark Entry Sheet" description="Every write is rechecked against Principal authority or the operator's exact delegated scope." />
    {authority.mode === "DELEGATED" ? <div className="notice"><strong>Delegated operator.</strong> {authority.profileName} · exact scope only. Family-link conflicts are denied and audited.</div> : null}
    <MarkEntryGrid initialRows={rows} initialAssessment={clientAssessment} exam={{ examCode: assessment.examCycle.examCode, name: assessment.examCycle.name, status: assessment.examCycle.status }} canEnter={permissionSetCan(permissions, "ENTER_MARKS")} canSubmit={permissionSetCan(permissions, "SUBMIT_MARKS")} canApprove={leadership && permissionSetCan(permissions, "APPROVE_MARKS")} canLock={leadership && permissionSetCan(permissions, "LOCK_EXAMS")} canCorrect={leadership && permissionSetCan(permissions, "CORRECT_APPROVED_MARKS")} />
    {loaded.unrelatedStoredMarks ? <div className="notice danger">{loaded.unrelatedStoredMarks} unrelated stored mark row(s) were excluded and require administrative investigation.</div> : null}
    <section className="card card-pad"><h3>Append-only Mark History</h3><div className="audit-timeline">{assessment.events.map((event) => <div key={event.id}><strong>{event.eventType.replaceAll("_", " ")}</strong><span>{displayDate(event.eventDate)} · {event.actorLabel ?? "Staff"}</span><span>{event.previousEntryStatus || event.newEntryStatus ? `${event.previousEntryStatus ?? "—"} ${event.previousMarks?.toString() ?? ""} → ${event.newEntryStatus ?? "—"} ${event.newMarks?.toString() ?? ""}` : event.reason ?? event.notes ?? "Workflow event"}</span></div>)}{!assessment.events.length ? <p className="muted-text">No mark events yet.</p> : null}</div></section>
  </div>;
}
