import Link from "next/link";
import { notFound } from "next/navigation";
import { ExamForm } from "@/components/exam-form";
import { ExamWorkflowActions } from "@/components/exam-workflow-actions";
import { PageHeader, StatusBadge } from "@/components/ui";
import { requirePermission, getCurrentUserEffectivePermissions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { displayDate } from "@/lib/format";
import { permissionSetCan } from "@/lib/role-permissions";
import { marksScopeWhere, resolveMarksScope } from "@/lib/marks-scope";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("VIEW_EXAMS");
  const id = (await params).id;
  const [permissions, scope] = await Promise.all([getCurrentUserEffectivePermissions(), resolveMarksScope(prisma, user)]);
  const assessmentWhere = marksScopeWhere(scope);
  const exam = await prisma.examCycle.findFirst({ where: { id, ...(!scope.broad ? { assessments: { some: assessmentWhere } } : {}) }, include: { assessments: { where: assessmentWhere, orderBy: [{ className: "asc" }, { section: "asc" }, { subjectName: "asc" }] } } });
  if (!exam) notFound();
  const canManage = permissionSetCan(permissions, "MANAGE_EXAMS");
  return <div className="page exams-page">
    <PageHeader title={`${exam.examCode} — ${exam.name}`} description={`${displayDate(exam.startDate)} to ${displayDate(exam.endDate)} · ${exam.examType.replaceAll("_", " ")}`} action={<div className="page-actions"><StatusBadge status={exam.status} /><Link className="button secondary" href={`/exams/${encodeURIComponent(exam.id)}/assessments`}>Assessments</Link></div>} />
    <section className="card card-pad"><div className="detail-grid"><div><dt>Academic year</dt><dd>{exam.academicYear}</dd></div><div><dt>Assessment sheets</dt><dd>{exam.assessments.length}</dd></div><div><dt>Status</dt><dd>{exam.status.replaceAll("_", " ")}</dd></div><div><dt>Description</dt><dd>{exam.description ?? "—"}</dd></div></div></section>
    {exam.status === "DRAFT" && canManage ? <ExamForm academicYear={exam.academicYear} examId={exam.id} initial={{ examCode: exam.examCode, academicYear: exam.academicYear, name: exam.name, examType: exam.examType, startDate: exam.startDate.toISOString().slice(0, 10), endDate: exam.endDate.toISOString().slice(0, 10), description: exam.description ?? "", updatedAt: exam.updatedAt.toISOString() }} /> : null}
    <ExamWorkflowActions exam={{ id: exam.id, name: exam.name, status: exam.status, updatedAt: exam.updatedAt.toISOString() }} canManage={canManage} canApprove={permissionSetCan(permissions, "APPROVE_MARKS")} canLock={permissionSetCan(permissions, "LOCK_EXAMS")} />
    <section className="card"><div className="table-wrap"><table><thead><tr><th>Class</th><th>Subject / component</th><th>Marks</th><th>Sheet status</th><th>Entry</th></tr></thead><tbody>{exam.assessments.map((row) => <tr key={row.id}><td>{row.className}-{row.section || "Class-wide"}</td><td>{row.subjectName}{row.componentName ? ` · ${row.componentName}` : ""}</td><td>{row.maxMarks.toString()}{row.passMarks ? ` / pass ${row.passMarks.toString()}` : ""}</td><td><StatusBadge status={row.entryStatus} /></td><td><Link href={`/marks/entry/${encodeURIComponent(row.id)}`}>Open Sheet</Link></td></tr>)}{!exam.assessments.length ? <tr><td colSpan={5}>No authorised assessments are configured.</td></tr> : null}</tbody></table></div></section>
  </div>;
}
