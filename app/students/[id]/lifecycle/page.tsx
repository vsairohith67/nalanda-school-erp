import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { requirePermission, hasUserPermission } from "@/lib/auth";
import { displayDate } from "@/lib/format";


export default async function StudentLifecycleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("VIEW_STUDENT_LIFECYCLE");
  const { id } = await params;
  const student = await prisma.student.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true, admissionNo: true, studentName: true,
      academicYearEnrollments: { orderBy: [{ academicYear: "desc" }, { createdAt: "desc" }] },
      lifecycleEvents: { orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }] }
    }
  });
  if (!student) notFound();
  const canViewProgression = await hasUserPermission(user, "VIEW_STUDENT_PROGRESSION");
  return <div className="page">
    <PageHeader title={`${student.studentName} - Lifecycle`} description={`Admission ${student.admissionNo}. History remains read-only; progression changes require an approved decision.`} action={<div className="page-actions"><Link className="button secondary" href="/students/lifecycle">Back to overview</Link>{canViewProgression ? <Link className="button secondary" href="/students/progression">Progression decisions</Link> : null}</div>} />
    <section className="card"><div className="section-title"><h3>Academic-year enrollment history</h3></div><div className="table-wrap"><table><thead><tr><th>Academic year</th><th>Class</th><th>Roll No</th><th>Status</th><th>Enrollment</th><th>Exit</th><th>Reason / notes</th></tr></thead><tbody>
      {student.academicYearEnrollments.map((row) => <tr key={row.id}><td>{row.academicYear}</td><td>{row.className}{row.section ? `-${row.section}` : ""}</td><td>{row.rollNo || "-"}</td><td>{row.status.replaceAll("_", " ")}</td><td>{row.enrollmentDate ? displayDate(row.enrollmentDate) : "-"}</td><td>{row.exitDate ? displayDate(row.exitDate) : "-"}</td><td>{row.exitReason || row.notes || "-"}</td></tr>)}
      {!student.academicYearEnrollments.length ? <tr><td colSpan={7}>No enrollment history has been recorded.</td></tr> : null}
    </tbody></table></div></section>
    <section className="card"><div className="section-title"><h3>Lifecycle events</h3><span className="muted-text">Append-only history</span></div><div className="table-wrap"><table><thead><tr><th>Effective date</th><th>Event</th><th>From</th><th>To</th><th>Reason</th><th>Evidence / acknowledgement</th></tr></thead><tbody>
      {student.lifecycleEvents.map((event) => <tr key={event.id}><td>{displayDate(event.effectiveDate)}</td><td>{event.eventType.replaceAll("_", " ")}</td><td>{historyValue(event.fromClass, event.fromSection, event.fromStatus)}</td><td>{historyValue(event.toClass, event.toSection, event.toStatus)}</td><td>{event.reason || "-"}</td><td>{[event.evidenceNotes, event.parentAcknowledgementNotes].filter(Boolean).join(" / ") || "-"}</td></tr>)}
      {!student.lifecycleEvents.length ? <tr><td colSpan={6}>No lifecycle events have been recorded.</td></tr> : null}
    </tbody></table></div></section>
  </div>;
}

function historyValue(className: string | null, section: string | null, status: string | null) {
  const place = className ? `${className}${section ? `-${section}` : ""}` : "";
  return [place, status?.replaceAll("_", " ")].filter(Boolean).join(" / ") || "-";
}
