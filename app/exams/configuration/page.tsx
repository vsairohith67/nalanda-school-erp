import Link from "next/link";
import { PageHeader, StatCard, StatusBadge } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { examTypeLabel } from "@/lib/exam-configuration-labels";
import { listExaminationConfigurations } from "@/lib/exam-configurations";
import { prisma } from "@/lib/prisma";
import { getEffectivePermissions, permissionSetCan } from "@/lib/role-permissions";
import { displayDate } from "@/lib/format";

export default async function Page() {
  const user = await requirePermission("VIEW_EXAM_CONFIGURATION");
  const [rows, permissions] = await Promise.all([
    listExaminationConfigurations(prisma),
    getEffectivePermissions(prisma, user.role)
  ]);
  const count = (status: string) => rows.filter((row) => row.status === status).length;
  return (
    <div className="page exam-configuration-page">
      <PageHeader
        title="Principal Examination Setup"
        description="Configure versioned class schemes and exact Teacher ownership. Marks entry, result calculation, publication, and bulk PDF generation remain outside this phase."
        action={permissionSetCan(permissions, "MANAGE_EXAM_CONFIGURATION") ? (
          <Link className="button" href="/exams/configuration/new">Create Examination</Link>
        ) : undefined}
      />
      <div className="grid three">
        <StatCard label="Draft" value={String(count("DRAFT"))} />
        <StatCard label="Active" value={String(count("ACTIVE"))} />
        <StatCard label="Archived" value={String(count("ARCHIVED"))} />
      </div>
      <section className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Code</th><th>Examination</th><th>Dates</th><th>Scope</th><th>Schemes</th><th>Assignments</th><th>Status</th><th>Open</th></tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.examCode}</td>
                  <td>{row.name}<br /><small>{examTypeLabel(row.examType)}</small></td>
                  <td>{displayDate(row.startDate)} – {displayDate(row.endDate)}</td>
                  <td>{row._count.classScopes}</td>
                  <td>{row._count.schemeVersions}</td>
                  <td>{row._count.teacherAssignments}</td>
                  <td><StatusBadge status={row.status} /></td>
                  <td><Link href={`/exams/configuration/${encodeURIComponent(row.id)}`}>View configuration</Link></td>
                </tr>
              ))}
              {!rows.length ? <tr><td colSpan={8}>No examination configurations have been created.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
