import Link from "next/link";
import { Prisma } from "@prisma/client";
import { PageHeader, PageShell, StatusBadge } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { calculateCashSources, effectiveCashSources, hasSourceDrift, missingCashBookDateKeys } from "@/lib/cash-book";
import { displayDate, moneyExact, schoolDateKey } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { hasRolePermission } from "@/lib/role-permissions";

export default async function CashBookReportsPage() {
  const user = await requirePermission("VIEW_CASH_BOOK_REPORTS");
  const rows = await prisma.cashBookDay.findMany({ orderBy: { cashDate: "desc" } });
  const data = await Promise.all(rows.map(async (row) => {
    const live = await calculateCashSources(prisma, row.cashDate, row.openingBalance, row.id);
    return { row, sources: effectiveCashSources(row, live), drift: row.status !== "DRAFT" && hasSourceDrift(row.sourceSummarySnapshot, live) };
  }));
  const canExport = await hasRolePermission(prisma, user.role, "EXPORT_CASH_BOOK_REPORTS");
  const active = data.filter(({ row }) => row.status !== "CANCELLED");
  const sum = (field: "feeCash" | "miscIncomeCash" | "bookSalesCash" | "cashExpense" | "bankDeposit" | "directorHandover") => active.reduce((total, row) => total.add(row.sources[field]), new Prisma.Decimal(0));
  const unlocked = active.filter(({ row }) => row.status !== "LOCKED").length;
  const variances = active.filter(({ row }) => row.varianceAmount && !row.varianceAmount.isZero()).length;
  const missingDates = missingCashBookDateKeys(rows, schoolDateKey());
  return <PageShell>
    <PageHeader title="Cash Book Reports" description="Date-wise physical-cash sources, dispositions, variance, unlocked and missing days, and source drift." action={<div className="page-actions"><Link className="button secondary" href="/cash-book">Back</Link>{canExport ? <a className="button" href="/api/cash-book/reports/export">Export CSV</a> : null}</div>} />
    <div className="stats">{[["Fee cash", sum("feeCash")], ["Miscellaneous cash", sum("miscIncomeCash")], ["Book-sale cash", sum("bookSalesCash")], ["Cash expenses", sum("cashExpense")], ["Deposited", sum("bankDeposit")], ["Director handovers", sum("directorHandover")], ["Unlocked / pending days", unlocked], ["Missing days", missingDates.length], ["Non-zero variances", variances]].map(([label, amount]) => <div className="card stat" key={String(label)}><span>{String(label)}</span><strong>{typeof amount === "number" ? amount : moneyExact(Number(amount))}</strong></div>)}</div>
    <section className="card"><div className="table-wrap"><table><thead><tr><th>Date</th><th>Status</th><th>Opening</th><th>Inflows</th><th>Outflows</th><th>Expected</th><th>Counted</th><th>Variance</th><th>Reconciliation</th></tr></thead><tbody>{data.map(({ row, sources, drift }) => {
      const inflows = sources.feeCash.add(sources.miscIncomeCash).add(sources.bookSalesCash).add(sources.manualInflow);
      const outflows = sources.cashExpense.add(sources.manualOutflow).add(sources.bankDeposit).add(sources.directorHandover);
      return <tr key={row.id}><td><Link href={`/cash-book/${row.cashDate.toISOString().slice(0, 10)}`}>{displayDate(row.cashDate)}</Link></td><td><StatusBadge status={row.status} /></td><td>{moneyExact(Number(row.openingBalance))}</td><td>{moneyExact(Number(inflows))}</td><td>{moneyExact(Number(outflows))}</td><td>{moneyExact(Number(sources.expectedClosing))}</td><td>{row.countedClosingBalance == null ? "—" : moneyExact(Number(row.countedClosingBalance))}</td><td>{row.varianceAmount == null ? "—" : moneyExact(Number(row.varianceAmount))}</td><td>{drift ? <strong className="danger-text">Source drift</strong> : row.status === "LOCKED" ? "Locked" : "Unlocked / pending"}</td></tr>;
    })}</tbody></table></div></section>
    <section className="card"><h2>Missing-day report</h2><p>Calendar dates with no preserved cash-book record, from the first recorded cash day through today.</p><div className="table-wrap"><table><thead><tr><th>Date</th><th>Finding</th></tr></thead><tbody>{missingDates.map((date) => <tr key={date}><td><Link href={`/cash-book/${date}`}>{displayDate(date)}</Link></td><td>Missing cash-book day</td></tr>)}</tbody></table></div>{!missingDates.length ? <p className="empty-state">No missing cash-book dates in the reported range.</p> : null}</section>
  </PageShell>;
}
