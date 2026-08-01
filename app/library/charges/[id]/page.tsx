import Link from "next/link";
import { notFound } from "next/navigation";
import { ChargeActions } from "@/components/library-accountability-forms";
import { LibraryNav } from "@/components/library-nav";
import { PageHeader, PageShell, StatusBadge } from "@/components/ui";
import { requirePermission, getCurrentUserEffectivePermissions } from "@/lib/auth";
import { displayDate } from "@/lib/format";
import { chargeInclude } from "@/lib/library-accountability-api";
import { prisma } from "@/lib/prisma";
import { permissionSetCan } from "@/lib/role-permissions";
import { getSchoolSettings } from "@/lib/school-settings";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("VIEW_LIBRARY_CHARGES");
  const [row, permissions, settings] = await Promise.all([
    prisma.libraryCharge.findUnique({ where: { id: (await params).id }, include: chargeInclude }),
    getCurrentUserEffectivePermissions(),
    getSchoolSettings(prisma),
  ]);
  if (!row) notFound();

  const p = {
    assess: permissionSetCan(permissions, "ASSESS_LIBRARY_CHARGES"),
    approve: permissionSetCan(permissions, "APPROVE_LIBRARY_CHARGES"),
    waive: permissionSetCan(permissions, "WAIVE_LIBRARY_CHARGES"),
    collect: permissionSetCan(permissions, "COLLECT_LIBRARY_CHARGES"),
    cancel: permissionSetCan(permissions, "CANCEL_LIBRARY_CHARGES"),
  };
  // Client components must receive plain data, never Prisma Decimal instances or the full record graph.
  const chargeActionPayload = {
    id: row.id,
    status: row.status,
    payableAmount: row.payableAmount.toFixed(2),
  };

  return (
    <PageShell className="library-page">
      <PageHeader title={row.chargeNumber} description="Approval, waiver, and collection are separate, transactionally guarded actions." />
      <LibraryNav current="charges" />
      <section className="card card-pad">
        <dl className="detail-grid">
          <div><dt>Borrower</dt><dd>{row.member.student?.studentName ?? row.member.staffMember?.fullName}</dd></div>
          <div><dt>Type / status</dt><dd>{row.chargeType} / <StatusBadge status={row.status} /></dd></div>
          <div><dt>Assessed</dt><dd>{displayDate(row.assessedDate)}</dd></div>
          <div><dt>Rule snapshot</dt><dd>{row.ruleCodeSnapshot ?? "Manual"}{row.rateSnapshot ? ` @ ₹${row.rateSnapshot.toFixed(2)}/day` : ""}</dd></div>
          <div><dt>Original</dt><dd>₹{row.originalAmount.toFixed(2)}</dd></div>
          <div><dt>Waived</dt><dd>₹{row.waivedAmount.toFixed(2)}</dd></div>
          <div><dt>Payable</dt><dd>₹{row.payableAmount.toFixed(2)}</dd></div>
          <div className="wide"><dt>Assessment reason</dt><dd>{row.assessmentReason}</dd></div>
          <div><dt>Loan</dt><dd>{row.loan?.loanNumber ?? "—"}</dd></div>
          <div><dt>Incident</dt><dd>{row.incident ? <Link href={`/library/incidents/${row.incident.id}`}>{row.incident.incidentNumber}</Link> : "—"}</dd></div>
          <div><dt>Miscellaneous Income receipt</dt><dd>{row.miscIncomeReceipt ? <Link href={`/misc-income/${row.miscIncomeReceipt.id}`}>{row.miscIncomeReceipt.receiptNumber}</Link> : "Not collected"}</dd></div>
          <div><dt>Receipt reconciliation</dt><dd>{row.miscIncomeReceipt?.status === "CANCELLED" ? <span className="badge danger">Cancelled receipt; compensating correction required</span> : row.miscIncomeReceipt?.status ?? "—"}</dd></div>
        </dl>
        <p className="notice"><strong>Library Charge Receipt.</strong> Not a school-fee receipt; no fee Payment, dues, or student ledger entry is created.</p>
      </section>
      <ChargeActions charge={chargeActionPayload} permissions={p} academicYear={settings.academicYear} />
      <section className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Event</th><th>Status</th><th>Amount</th><th>Reason / note</th><th>Actor</th></tr></thead>
            <tbody>{row.events.map((event) => <tr key={event.id}><td>{displayDate(event.eventDate)}</td><td>{event.eventType}</td><td>{event.previousStatus ?? "—"} → {event.newStatus ?? "—"}</td><td>{event.amountSnapshot ? `₹${event.amountSnapshot.toFixed(2)}` : "—"}</td><td>{event.reason ?? event.notes ?? "—"}</td><td>{event.recordedBy?.name ?? "System"}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </PageShell>
  );
}
