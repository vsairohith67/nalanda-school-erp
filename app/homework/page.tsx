import Link from "next/link";
import { PageHeader, StatCard, StatusBadge } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEffectivePermissions, permissionSetCan } from "@/lib/role-permissions";
import { homeworkAccess, homeworkFilterWhere } from "@/lib/homework-api";
import { homeworkVisibleWhere } from "@/lib/homework-scope";
import { homeworkDueGroup } from "@/lib/homework-reports";
import { displayDate } from "@/lib/format";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePermission("VIEW_HOMEWORK");
  const [sp, permissions] = await Promise.all([searchParams, getEffectivePermissions(prisma, user.role)]);
  const params = new URLSearchParams(Object.entries(sp).filter((entry): entry is [string, string] => Boolean(entry[1])));
  const scope = await homeworkAccess(user, sp.academicYear);
  const rows = await prisma.homeworkAssignment.findMany({ where: { AND: [homeworkVisibleWhere(scope, user), homeworkFilterWhere(params)] }, include: { createdBy: { select: { name: true } } }, orderBy: [{ assignedDate: "desc" }, { createdAt: "desc" }] });
  const count = (value: string) => rows.filter((row) => row.status === value).length;
  const due = (value: string) => rows.filter((row) => homeworkDueGroup(row) === value).length;
  return <div className="page homework-page"><PageHeader title="Homework and Assignments" description="Create, publish, correct, archive, and report class homework with Teacher scope and linked-child Parent isolation." action={permissionSetCan(permissions, "MANAGE_HOMEWORK") ? <Link className="button" href="/homework/new">Create Homework</Link> : undefined} />
    {scope.reason ? <div className="notice">{scope.reason}</div> : null}
    <div className="grid three"><StatCard label="Drafts" value={String(count("DRAFT"))} /><StatCard label="Published" value={String(count("PUBLISHED"))} /><StatCard label="Due Today" value={String(due("DUE_TODAY"))} /><StatCard label="Upcoming" value={String(due("UPCOMING"))} /><StatCard label="Overdue" value={String(due("OVERDUE"))} /><StatCard label="Archived / Cancelled" value={String(count("ARCHIVED") + count("CANCELLED"))} /></div>
    <section className="card card-pad"><form className="form-grid homework-filter-grid"><label>Academic year<input name="academicYear" defaultValue={sp.academicYear ?? ""} /></label><label>Class<input name="class" defaultValue={sp.class ?? ""} /></label><label>Section<input name="section" defaultValue={sp.section ?? ""} /></label><label>Subject<input name="subject" defaultValue={sp.subject ?? ""} /></label><label>Status<select name="status" defaultValue={sp.status ?? ""}><option value="">All</option>{["DRAFT", "PUBLISHED", "ARCHIVED", "CANCELLED"].map((value) => <option key={value}>{value}</option>)}</select></label><label>Assigned date<input type="date" name="assignedDate" defaultValue={sp.assignedDate ?? ""} /></label><label>Due date<input type="date" name="dueDate" defaultValue={sp.dueDate ?? ""} /></label>{user.role !== "TEACHER" ? <label>Creator<input name="creator" defaultValue={sp.creator ?? ""} /></label> : null}<div className="full page-actions"><button type="submit">Apply Filters</button><Link className="button secondary" href="/homework">Clear</Link><Link className="button secondary" href="/homework/reports">Reports</Link></div></form></section>
    <section className="card"><div className="table-wrap"><table><thead><tr><th>Number</th><th>Assigned</th><th>Class</th><th>Subject</th><th>Title</th><th>Due</th><th>Status</th><th>Open</th></tr></thead><tbody>{rows.map((row) => <tr key={row.assignmentNumber}><td>{user.role === "VIEWER" ? "Masked" : row.assignmentNumber}</td><td>{displayDate(row.assignedDate)}</td><td>{row.className}{row.section ? `-${row.section}` : " / All"}</td><td>{row.subjectName}</td><td>{row.title}</td><td>{row.dueDate ? displayDate(row.dueDate) : "No due date"}</td><td><StatusBadge status={row.status} /></td><td>{user.role === "VIEWER" ? <span>Read only</span> : <Link href={`/homework/${encodeURIComponent(row.assignmentNumber)}`}>Open</Link>}</td></tr>)}{!rows.length ? <tr><td colSpan={8}>No homework matches these filters.</td></tr> : null}</tbody></table></div></section>
  </div>;
}
