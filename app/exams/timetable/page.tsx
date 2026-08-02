import Link from "next/link";
import { ExaminationTimetableCreate } from "@/components/examination-timetable-create";
import { PageHeader, StatusBadge } from "@/components/ui";
import { getCurrentUserEffectivePermissions, requirePermission } from "@/lib/auth";
import { listExaminationTimetables, listTimetableCreationOptions } from "@/lib/examination-timetables";
import { prisma } from "@/lib/prisma";
import { permissionSetCan } from "@/lib/role-permissions";

export default async function ExaminationTimetablePage() {
  await requirePermission("VIEW_EXAM_TIMETABLE");
  const [rows, options, permissions] = await Promise.all([listExaminationTimetables(prisma), listTimetableCreationOptions(prisma), getCurrentUserEffectivePermissions()]);
  const canManage = permissionSetCan(permissions, "MANAGE_EXAM_TIMETABLE");
  return <div className="page exam-timetable-page"><PageHeader title="Examination Timetable" description="Principal-governed exact-cohort timetable drafts, conflict validation, publication, replacement, withdrawal, and immutable history." />
    {canManage ? <ExaminationTimetableCreate examinations={options.map((exam) => ({ id: exam.id, label: `${exam.examCode} · ${exam.name} · ${exam.academicYear}`, status: exam.status, scopes: exam.classScopes.map((scope: any) => ({ id: scope.id, className: scope.className, section: scope.section, subjectPaperCount: scope.subjectPapers.length, versions: scope.timetableVersions })) }))} /> : null}
    <section className="card"><div className="section-title"><div><h2>Timetable versions</h2><p>Published versions remain preserved when replaced or withdrawn.</p></div></div><div className="table-wrap"><table><thead><tr><th>Examination</th><th>Cohort</th><th>Version</th><th>Rows</th><th>Status</th><th>Open</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.examination.examCode}<br />{row.examination.name}</td><td>{row.classScope.className}{row.classScope.section ? `-${row.classScope.section}` : ""}</td><td>{row.versionNumber}</td><td>{row._count.rows}</td><td><StatusBadge status={human(row.status)} /></td><td><Link href={`/exams/timetable/${encodeURIComponent(row.id)}`}>Open timetable</Link></td></tr>)}{!rows.length ? <tr><td colSpan={6}>No examination timetable versions yet.</td></tr> : null}</tbody></table></div></section>
  </div>;
}

function human(value: string) { return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
