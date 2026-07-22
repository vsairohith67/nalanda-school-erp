import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader, StatusBadge } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSchoolSettings } from "@/lib/school-settings";
import { getParentHomeworkData } from "@/lib/homework-portals";
import { displayDate, schoolDateKey } from "@/lib/format";

export default async function Page({ searchParams }: { searchParams: Promise<{ child?: string; history?: string }> }) {
  const user = await requirePermission("VIEW_OWN_HOMEWORK_PORTAL"); if (user.role !== "PARENT") redirect("/unauthorized");
  const [sp, settings] = await Promise.all([searchParams, getSchoolSettings(prisma)]); const index = Number(sp.child ?? 0);
  const data = await getParentHomeworkData(prisma, user.id, settings.academicYear, Number.isInteger(index) && index >= 0 ? index : 0, sp.history === "1"); const today = schoolDateKey();
  return <div className="page parent-homework-page"><PageHeader title="Homework" description="Published homework only for the selected linked child. Read-only; no submission, upload, grading, or completion claim." action={<Link className="button secondary" href="/parent">Parent home</Link>} />
    {data.children.length > 1 ? <section className="card card-pad" aria-label="Choose child"><h3>Choose Child</h3><div className="parent-child-cards">{data.children.map((child) => <Link key={child.index} className={`parent-child-card ${child.index === index ? "active" : ""}`} href={`/parent/homework?child=${child.index}${sp.history === "1" ? "&history=1" : ""}`}>{child.studentName}<span>{child.className}{child.section ? `-${child.section}` : ""}</span></Link>)}</div></section> : null}
    {data.selectedChild ? <div className="notice"><strong>{data.selectedChild.studentName}</strong> - {data.selectedChild.className}{data.selectedChild.section ? `-${data.selectedChild.section}` : ""}</div> : <div className="notice">No current academic-year enrollment is linked to this Parent account.</div>}
    <div className="page-actions"><Link className="button secondary" href={`/parent/homework?child=${index}`}>Current</Link><Link className="button secondary" href={`/parent/homework?child=${index}&history=1`}>Archived / History</Link></div>
    <section className="homework-parent-list">{data.assignments.map((row, rowIndex) => <article className="card card-pad homework-parent-card" key={`${row.title}-${row.subjectName}-${row.assignedDate}-${row.dueDate ?? "none"}-${rowIndex}`}><div className="section-title section-title-plain"><div><h3>{row.title}</h3><p>{row.subjectName} - Assigned {displayDate(row.assignedDate)}</p></div><StatusBadge status={row.status} /></div><p>{row.instructions}</p><div className="homework-meta"><span className={`badge ${row.priority === "IMPORTANT" ? "warn" : ""}`}>{row.priority}</span><strong>Due: {row.dueDate ? displayDate(row.dueDate) : "No due date"}</strong><span>{row.dueDate === today ? "Due today" : row.dueDate && row.dueDate < today ? "Overdue" : row.dueDate ? "Upcoming" : ""}</span></div>{row.publicNotes ? <div className="notice">{row.publicNotes}</div> : null}{row.resourceLink ? <a className="button secondary" href={row.resourceLink} target="_blank" rel="noopener noreferrer">Open Safe Resource</a> : null}</article>)}{!data.assignments.length ? <section className="card card-pad"><p>No homework is available in this view.</p></section> : null}</section>
  </div>;
}
