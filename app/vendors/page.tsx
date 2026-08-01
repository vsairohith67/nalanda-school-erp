import Link from "next/link";
import { Prisma } from "@prisma/client";
import { PageHeader, PageShell, StatusBadge } from "@/components/ui";
import { requirePermission, hasUserPermission } from "@/lib/auth";
import { money } from "@/lib/format";
import { prisma } from "@/lib/prisma";

import { vendorWhere } from "@/lib/vendors";

export default async function VendorsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission("VIEW_VENDORS"); const params = await searchParams; const manage = await hasUserPermission(user, "MANAGE_VENDORS");
  const search = typeof params.search === "string" ? params.search : ""; const status = typeof params.status === "string" ? params.status : "";
  const rows = await prisma.vendor.findMany({ where: vendorWhere(search, status, manage), include: { _count: { select: { expenses: true } }, expenses: { where: { approvalStatus: { not: "CANCELLED" } }, select: { netAmount: true } } }, orderBy: [{ name: "asc" }, { vendorCode: "asc" }] });
  return <PageShell><PageHeader title="Vendors" description="Vendor master records. Full bank account numbers are not stored." action={manage ? <Link className="button" href="/vendors/new">Create Vendor</Link> : undefined} />
    <form className="card filter-grid" method="get"><label>Search<input name="search" defaultValue={search} placeholder={manage ? "Code, name, contact, mobile, or GSTIN" : "Code, name, contact, or mobile"} /></label><label>Status<select name="status" defaultValue={status}><option value="">All statuses</option><option>ACTIVE</option><option>INACTIVE</option><option>BLOCKED</option></select></label><button type="submit">Apply Filters</button><Link className="button secondary" href="/vendors">Clear</Link></form>
    <section className="card"><div className="table-wrap"><table><thead><tr><th>Code</th><th>Vendor</th><th>Contact</th><th>Status</th><th>Expenses</th><th>Active Spend</th>{manage ? <th>Sensitive Details</th> : null}<th>Action</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.vendorCode}</td><td><strong>{row.name}</strong><br /><span className="muted-text">{row.email || "No email"}</span></td><td>{row.contactPerson || "—"}<br /><span className="muted-text">{row.mobile || "No mobile"}</span></td><td><StatusBadge status={row.status} /></td><td>{row._count.expenses}</td><td>{money(Number(row.expenses.reduce((sum, expense) => sum.add(expense.netAmount), new Prisma.Decimal(0))))}</td>{manage ? <td>{row.gstin ? `GSTIN ${row.gstin}` : "No GSTIN"}<br /><span className="muted-text">{row.accountLastFour ? `Account ending ${row.accountLastFour}` : "No bank digits"}</span></td> : null}<td><Link href={`/vendors/${row.id}`}>{manage ? "View / Edit" : "View"}</Link></td></tr>)}</tbody></table></div>{!rows.length ? <div className="empty-state"><h3>No vendors found</h3><p>Adjust the filters or create an approved vendor master record.</p></div> : null}</section>
  </PageShell>;
}
