import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { displayDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function ParentFamilyReceiptsPage() {
  const user = await requirePermission("VIEW_OWN_FAMILY_RECEIPTS");
  if (!user.guardianId) return <div className="page"><PageHeader title="Family Fee Receipts" description="No active Guardian profile is linked to this Parent account." /></div>;
  const links = await prisma.studentGuardian.findMany({ where: { guardianId: user.guardianId, canViewFees: true, guardian: { status: "Active" } }, select: { studentId: true, student: { select: { admissionNo: true } } } });
  const authorizedStudentIds = links.map((row) => row.studentId);
  const rows = authorizedStudentIds.length ? await prisma.familyCollection.findMany({
    where: { status: { in: ["ISSUED", "REVERSED", "SUPERSEDED"] }, allocations: { some: { studentId: { in: authorizedStudentIds } } } },
    select: { publicReference: true, collectionDate: true, status: true, totalPaise: true, allocations: { select: { studentId: true, admissionNoSnapshot: true, studentNameSnapshot: true } } },
    orderBy: [{ collectionDate: "desc" }, { createdAt: "desc" }],
    take: 200
  }) : [];
  const authorized = new Set(authorizedStudentIds);
  return <div className="page"><PageHeader title="Family Fee Receipts" description="Issued receipts are limited to actively linked children. Full-family view is available only when every included Student is linked." /><section className="card"><div className="table-wrap"><table><thead><tr><th>Date</th><th>Receipt</th><th>Authorised children</th><th>Total / extract</th><th>Status</th></tr></thead><tbody>{rows.map((row) => { const all = row.allocations.every((allocation) => authorized.has(allocation.studentId)); const child = row.allocations.find((allocation) => authorized.has(allocation.studentId)); const href = `/family-collections/${encodeURIComponent(row.publicReference)}${all ? "" : `?child=${encodeURIComponent(child!.admissionNoSnapshot)}`}`; return <tr key={row.publicReference}><td>{displayDate(row.collectionDate)}</td><td><Link href={href}>{row.publicReference}</Link></td><td>{Array.from(new Set(row.allocations.filter((allocation) => authorized.has(allocation.studentId)).map((allocation) => allocation.studentNameSnapshot))).join(", ")}</td><td>{all ? formatPaise(row.totalPaise) : "Child-specific extract"}</td><td>{row.status}</td></tr>; })}{!rows.length ? <tr><td colSpan={5}>No issued family fee receipt is available.</td></tr> : null}</tbody></table></div></section></div>;
}

function formatPaise(value: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(value / 100); }
