import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { getEffectivePermissions, permissionSetCan } from "@/lib/role-permissions";
import { buildStaffSearchWhere, STAFF_STATUSES, STAFF_TYPES } from "@/lib/staff";
import { PageHeader } from "@/components/ui";
import { StaffCreateForm } from "@/components/staff-create-form";

export default async function StaffPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePermission("VIEW_STAFF"); const search = await searchParams;
  const permissions = await getEffectivePermissions(prisma, user.role); const canManage = permissionSetCan(permissions, "MANAGE_STAFF");
  const staff = await prisma.staffMember.findMany({ where: buildStaffSearchWhere({ query: search.q, staffType: search.type, status: search.status, designation: search.designation, subject: search.subject }), include: { user: { select: { username: true, isActive: true } } }, orderBy: [{ status: "asc" }, { fullName: "asc" }] });
  return <div className="page"><PageHeader title="Staff / Teachers" description="Staff master profiles, optional teacher logins, and safe timetable links." action={permissionSetCan(permissions, "IMPORT_STAFF") ? <Link className="button" href="/import-export#staff-import">Import Staff</Link> : undefined} />
    <form className="card card-pad filter-row"><label>Search<input name="q" defaultValue={search.q} placeholder="Name, code, mobile, email, subject..." /></label><label>Type<select name="type" defaultValue={search.type}><option value="">All types</option>{STAFF_TYPES.map((v) => <option key={v}>{v}</option>)}</select></label><label>Status<select name="status" defaultValue={search.status}><option value="">All statuses</option>{STAFF_STATUSES.map((v) => <option key={v}>{v}</option>)}</select></label><label>Designation<input name="designation" defaultValue={search.designation} /></label><label>Subject<input name="subject" defaultValue={search.subject} /></label><button>Search</button></form>
    <section className="card"><div className="table-wrap"><table><thead><tr><th>Code</th><th>Name</th><th>Designation</th><th>Type</th><th>Subject</th><th>Mobile</th><th>Login</th><th>Status</th></tr></thead><tbody>{staff.map((row) => <tr key={row.id}><td>{row.staffCode ?? "-"}</td><td><Link href={`/staff/${row.id}`}>{row.displayName ?? row.fullName}</Link></td><td>{row.designation}</td><td>{row.staffType}</td><td>{row.primarySubject ?? "-"}</td><td>{row.mobile ?? "-"}</td><td>{row.user ? `${row.user.username} (${row.user.isActive ? "Active" : "Inactive"})` : "Not linked"}</td><td><span className={`badge ${row.status === "ACTIVE" ? "success" : ""}`}>{row.status}</span></td></tr>)}{!staff.length ? <tr><td colSpan={8}>No staff profiles match these filters.</td></tr> : null}</tbody></table></div></section>
    {canManage ? <StaffCreateForm /> : null}</div>;
}
