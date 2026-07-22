import { IncidentCreateForm } from "@/components/library-accountability-forms";
import { LibraryNav } from "@/components/library-nav";
import { PageHeader, PageShell } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function Page() {
  await requirePermission("MANAGE_LIBRARY_INCIDENTS");
  const loans = await prisma.libraryLoan.findMany({
    where: { status: { in: ["ISSUED", "RETURNED"] } },
    include: {
      member: true,
      copy: { include: { title: true } },
      incidents: { where: { status: { notIn: ["RESOLVED", "CANCELLED"] } }, select: { id: true } }
    },
    orderBy: { issueDate: "desc" }
  });
  const loanOptions = loans.filter((row) => !row.incidents.length).map((row) => ({
    id: row.id,
    loanNumber: row.loanNumber,
    status: row.status,
    member: { memberCode: row.member.memberCode },
    copy: { accessionNumber: row.copy.accessionNumber }
  }));
  return <PageShell className="library-page"><PageHeader title="Report Lost or Damaged Library Item" description="Preview the exact loan/member/copy/title link. Saving creates no financial charge." /><LibraryNav current="incidents" /><IncidentCreateForm loans={loanOptions} /></PageShell>;
}
