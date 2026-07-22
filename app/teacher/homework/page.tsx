import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader, StatusBadge } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTeacherHomeworkData } from "@/lib/homework-portals";
import { displayDate } from "@/lib/format";

export default async function Page() {
  const user = await requirePermission("VIEW_OWN_HOMEWORK_PORTAL"); if (user.role !== "TEACHER") redirect("/unauthorized");
  const data = await getTeacherHomeworkData(prisma, user as never);
  return <div className="page teacher-homework-page"><PageHeader title="Teacher Homework" description="Only timetable-linked class, section, and subject assignments are available." action={data.scopeOptions.length ? <Link className="button" href="/homework/new">Create Homework</Link> : undefined} />
    {data.staffLabel ? <div className="notice"><strong>{data.staffLabel}</strong> - {data.scopeOptions.length} authorised class/subject scope{data.scopeOptions.length === 1 ? "" : "s"}.</div> : null}{data.scopeReason ? <div className="notice">{data.scopeReason}</div> : null}
    <section className="card"><div className="table-wrap"><table><thead><tr><th>Assigned</th><th>Class</th><th>Subject</th><th>Title</th><th>Due</th><th>Status</th><th>Open</th></tr></thead><tbody>{data.assignments.map((row: any) => <tr key={row.assignmentNumber}><td>{displayDate(row.assignedDate)}</td><td>{row.className}{row.section ? `-${row.section}` : " / All"}</td><td>{row.subjectName}</td><td>{row.title}</td><td>{row.dueDate ? displayDate(row.dueDate) : "No due date"}</td><td><StatusBadge status={row.status} /></td><td><Link href={`/homework/${encodeURIComponent(row.assignmentNumber)}`}>Open</Link></td></tr>)}{!data.assignments.length ? <tr><td colSpan={7}>No homework is available in your authorised scope.</td></tr> : null}</tbody></table></div></section>
  </div>;
}
