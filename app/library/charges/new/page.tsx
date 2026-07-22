import { ChargeCreateForm } from "@/components/library-charge-create-form";
import { LibraryNav } from "@/components/library-nav";
import { PageHeader, PageShell } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { deriveOverdue } from "@/lib/library-circulation";
import { prisma } from "@/lib/prisma";

export default async function Page() {
  await requirePermission("ASSESS_LIBRARY_CHARGES");
  const [loans, incidents] = await Promise.all([
    prisma.libraryLoan.findMany({ where: { status: "ISSUED" }, include: { member: true, copy: { include: { title: true } }, charges: { where: { chargeType: "OVERDUE", status: { not: "CANCELLED" } }, select: { id: true } } }, orderBy: { dueDate: "asc" } }),
    prisma.libraryIncident.findMany({ where: { status: "APPROVED" }, include: { member: true }, orderBy: { reportedDate: "desc" } })
  ]);
  const loanOptions = loans.filter((row) => deriveOverdue(row).overdue && !row.charges.length).map((row) => ({ id: row.id, loanNumber: row.loanNumber, dueDate: row.dueDate.toISOString().slice(0, 10), member: { memberCode: row.member.memberCode } }));
  const incidentOptions = incidents.map((row) => ({ id: row.id, incidentNumber: row.incidentNumber, incidentType: row.incidentType, member: { memberCode: row.member.memberCode } }));
  return <PageShell className="library-page"><PageHeader title="Assess Library Charge" description="Preview-first and explicit. Viewing overdue reports or this preview never posts a charge." /><LibraryNav current="charges" /><ChargeCreateForm loans={loanOptions} incidents={incidentOptions} /></PageShell>;
}
