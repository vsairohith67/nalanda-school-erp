import Link from "next/link";
import { notFound } from "next/navigation";
import { ExaminationTimetableEditor } from "@/components/examination-timetable-editor";
import { PageHeader, StatusBadge } from "@/components/ui";
import { getCurrentUserEffectivePermissions, requirePermission } from "@/lib/auth";
import { ExaminationTimetableError, getExaminationTimetable, inspectExaminationTimetable } from "@/lib/examination-timetables";
import { prisma } from "@/lib/prisma";
import { permissionSetCan } from "@/lib/role-permissions";

export default async function ExaminationTimetableDetail({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("VIEW_EXAM_TIMETABLE");
  const id = (await params).id;
  const [row, validation, permissions] = await Promise.all([getExaminationTimetable(prisma, id), inspectExaminationTimetable(prisma, id), getCurrentUserEffectivePermissions()]).catch((error) => { if (error instanceof ExaminationTimetableError && error.status === 404) notFound(); throw error; });
  const timetable = {
    id: row.id, examinationId: row.examinationId, classScopeId: row.classScopeId, versionNumber: row.versionNumber, version: row.version, status: row.status, replacesVersionId: row.replacesVersionId, parentInstructions: row.parentInstructions,
    examination: { name: row.examination.name, examCode: row.examination.examCode, startDate: row.examination.startDate.toISOString().slice(0, 10), endDate: row.examination.endDate.toISOString().slice(0, 10) },
    cohort: `${row.className}${row.section ? `-${row.section}` : ""} · ${row.academicYear}`,
    rows: row.rows.map((item: any) => ({ subjectPaperId: item.subjectPaperId, examDate: item.examDate.toISOString().slice(0, 10), startTime: item.startTime, endTime: item.endTime, reportingTime: item.reportingTime ?? "", venue: item.venue ?? "", parentInstructions: item.parentInstructions ?? "", displayOrder: item.displayOrder }))
  };
  const papers = row.classScope.subjectPapers.map((paper: any) => ({ id: paper.id, label: `${paper.subjectNameSnapshot} · ${paper.paperName} (${paper.paperCode})`, subject: paper.subjectNameSnapshot, paperCode: paper.paperCode, paperName: paper.paperName }));
  return <div className="page exam-timetable-page"><PageHeader title={`${row.examination.examCode} · ${row.examination.name}`} description={`${timetable.cohort} · Timetable version ${row.versionNumber}`} action={<div className="page-actions"><StatusBadge status={human(row.status)} /><Link className="button secondary" href="/exams/timetable">All Timetables</Link></div>} />
    <ExaminationTimetableEditor timetable={timetable} papers={papers} initialValidation={validation} canManage={permissionSetCan(permissions, "MANAGE_EXAM_TIMETABLE")} canPublish={permissionSetCan(permissions, "PUBLISH_EXAM_TIMETABLE")} />
    <section className="card"><div className="section-title"><div><h2>Version and publication history</h2><p>Append-only actor, reason, status, and timestamp evidence.</p></div></div><div className="table-wrap"><table><thead><tr><th>When</th><th>Event</th><th>Status change</th><th>Actor</th><th>Reason</th></tr></thead><tbody>{row.events.map((event: any) => <tr key={event.id}><td>{event.eventDate.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</td><td>{human(event.eventType)}</td><td>{event.previousStatus ? human(event.previousStatus) : "Created"} → {event.newStatus ? human(event.newStatus) : "—"}</td><td>{event.actorLabel}</td><td>{event.reason ?? "Not required"}</td></tr>)}</tbody></table></div></section>
  </div>;
}

function human(value: string) { return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
