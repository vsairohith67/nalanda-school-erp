import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { GuardianCreateForm } from "@/components/guardian-create-form";
import { requirePermission } from "@/lib/auth";
import { guardianSearchWhere } from "@/lib/guardians";
import { prisma } from "@/lib/prisma";
import { getEffectivePermissions, permissionSetCan } from "@/lib/role-permissions";

export default async function GuardiansPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const user = await requirePermission("VIEW_GUARDIANS");
  const permissions = await getEffectivePermissions(prisma, user.role);
  const canManage = permissionSetCan(permissions, "MANAGE_GUARDIANS");
  const q = sp.q;
  const guardians = await prisma.guardian.findMany({
    where: guardianSearchWhere(q),
    include: {
      _count: { select: { students: true } },
      users: { select: { id: true, username: true, role: true, isActive: true } }
    },
    orderBy: [{ displayName: "asc" }, { primaryMobile: "asc" }]
  });

  return (
    <div className="page">
      <PageHeader
        title="Parents / Guardians"
        description="Link one guardian to one or more students for future parent login and sibling grouping."
        action={permissionSetCan(permissions, "IMPORT_GUARDIANS") ? <Link className="button" href="/import-export">Import Guardian Links</Link> : undefined}
      />
      <section className="notice">
        Parent portal is being prepared. These records are for safe account linking and sibling grouping only; they do not expose fee ledgers or payment entry to parents.
      </section>
      <form className="card card-pad filters">
        <label>Search<input name="q" defaultValue={sp.q ?? ""} placeholder="Name, mobile, email, adm no, student" /></label>
        <button>Apply</button>
      </form>
      <section className="card">
        <div className="section-title"><h3>{guardians.length} Guardians</h3></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Mobile</th><th>Email</th><th>Children</th><th>Status</th><th>Login</th><th></th></tr></thead>
            <tbody>
              {guardians.map((guardian) => {
                const parentUser = guardian.users.find((row) => row.role === "PARENT");
                return (
                  <tr key={guardian.id}>
                    <td>{guardian.displayName}</td>
                    <td>{guardian.primaryMobile}</td>
                    <td>{guardian.email ?? "-"}</td>
                    <td>{guardian._count.students}</td>
                    <td><span className={`badge ${guardian.status === "Active" ? "success" : "danger"}`}>{guardian.status}</span></td>
                    <td>{parentUser ? <span className="badge">{parentUser.username}</span> : <span className="muted-text">Not created</span>}</td>
                    <td><Link href={`/guardians/${guardian.id}`}>Open</Link></td>
                  </tr>
                );
              })}
              {!guardians.length ? (
                <tr>
                  <td colSpan={7}>
                    {q?.trim()
                      ? "No guardians match this search. Try a guardian name, mobile, email, admission number, or student name."
                      : "No guardians have been added yet. Use Add Guardian or Import Guardian Links when the school is ready to prepare parent login grouping."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
      {canManage ? <GuardianCreateForm /> : null}
    </div>
  );
}
