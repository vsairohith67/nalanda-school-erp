import Link from "next/link";
import { PageHeader, PageShell, StatusBadge } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { calculateCashSources } from "@/lib/cash-book";
import { displayDate, moneyExact, schoolDateKey } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { hasRolePermission } from "@/lib/role-permissions";

export default async function CashBookPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = await requirePermission("VIEW_CASH_BOOK");
  const { status = "" } = await searchParams;
  const today = schoolDateKey();
  const todayDate = new Date(`${today}T00:00:00.000Z`);
  const [rows, todayRow, latest, canManage] = await Promise.all([
    prisma.cashBookDay.findMany({ where: status ? { status } : undefined, orderBy: { cashDate: "desc" }, take: 180 }),
    prisma.cashBookDay.findUnique({ where: { cashDate: todayDate } }),
    prisma.cashBookDay.findFirst({ orderBy: { cashDate: "desc" } }),
    hasRolePermission(prisma, user.role, "MANAGE_CASH_BOOK")
  ]);
  const live = todayRow ? await calculateCashSources(prisma, todayRow.cashDate, todayRow.openingBalance, todayRow.id) : null;
  return <PageShell>
    <PageHeader title="Daily Cash Book" description="Physical-cash control built from authoritative fee cash, miscellaneous-income cash, book-sale cash, cash expenses, and documented movements." action={<div className="page-actions"><Link className="button secondary" href="/cash-book/reports">Reports</Link>{canManage ? <Link className="button" href={`/cash-book/${today}`}>{todayRow ? "Open today" : "Create today"}</Link> : null}</div>} />
    {!todayRow ? <div className="alert warning"><strong>Missing-day warning:</strong> no cash book exists for today ({displayDate(today)}).</div> : null}
    <div className="stats"><div className="card stat"><span>Current expected cash on hand</span><strong>{live ? moneyExact(Number(live.expectedClosing)) : "Not opened"}</strong></div><div className="card stat"><span>Today&apos;s status</span><strong>{todayRow?.status ?? "MISSING"}</strong></div><div className="card stat"><span>Latest locked closing</span><strong>{latest?.status === "LOCKED" && latest.countedClosingBalance != null ? moneyExact(Number(latest.countedClosingBalance)) : "—"}</strong></div></div>
    <form className="card filter-grid"><label>Status<select name="status" defaultValue={status}><option value="">All</option>{["DRAFT", "SUBMITTED", "APPROVED", "LOCKED", "REJECTED", "CANCELLED"].map((value) => <option key={value}>{value}</option>)}</select></label><button>Apply</button><Link className="button secondary" href="/cash-book">Clear</Link></form>
    <section className="card"><div className="table-wrap"><table><thead><tr><th>Date</th><th>Status</th><th>Opening</th><th>Fee cash</th><th>Misc. cash</th><th>Book cash</th><th>Cash expenses</th><th>Deposited</th><th>Director handover</th><th>Expected closing</th><th>Counted closing</th><th>Variance</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><Link href={`/cash-book/${row.cashDate.toISOString().slice(0, 10)}`}>{displayDate(row.cashDate)}</Link></td><td><StatusBadge status={row.status} /></td><td>{moneyExact(Number(row.openingBalance))}</td><td>{moneyExact(Number(row.feeCashSnapshot))}</td><td>{moneyExact(Number(row.miscIncomeCashSnapshot))}</td><td>{moneyExact(Number(row.bookSalesCashSnapshot))}</td><td>{moneyExact(Number(row.cashExpenseSnapshot))}</td><td>{moneyExact(Number(row.bankDepositSnapshot))}</td><td>{moneyExact(Number(row.directorHandoverSnapshot))}</td><td>{moneyExact(Number(row.calculatedClosingBalance))}</td><td>{row.countedClosingBalance == null ? "—" : moneyExact(Number(row.countedClosingBalance))}</td><td>{row.varianceAmount == null ? "—" : moneyExact(Number(row.varianceAmount))}</td></tr>)}</tbody></table></div>{!rows.length ? <p className="empty-state">No cash-book days match this status.</p> : null}</section>
  </PageShell>;
}
