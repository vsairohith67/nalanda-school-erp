import { Prisma } from "@prisma/client";
import Link from "next/link";
import { PageHeader, PageShell, StatusBadge } from "@/components/ui";
import { requirePermission, hasUserPermission } from "@/lib/auth";
import { budgetDetailInclude, getBudgetMetrics } from "@/lib/budgets";
import { moneyExact } from "@/lib/format";
import { prisma } from "@/lib/prisma";


type AggregateRow = {
  label: string;
  allocated: Prisma.Decimal;
  committed: Prisma.Decimal;
  paid: Prisma.Decimal;
  utilized: Prisma.Decimal;
  available: Prisma.Decimal;
};

export default async function BudgetReportsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission("VIEW_BUDGET_REPORTS");
  const params = await searchParams;
  const planId = typeof params.planId === "string" ? params.planId : "";
  const [plans, selected, canExport] = await Promise.all([
    prisma.budgetPlan.findMany({
      where: { status: { in: ["APPROVED", "LOCKED"] } },
      select: { id: true, budgetNumber: true, academicYear: true, title: true },
      orderBy: [{ academicYear: "desc" }, { approvedAt: "desc" }]
    }),
    prisma.budgetPlan.findFirst({
      where: { ...(planId ? { id: planId } : {}), status: { in: ["APPROVED", "LOCKED"] } },
      include: budgetDetailInclude,
      orderBy: { approvedAt: "desc" }
    }),
    hasUserPermission(user, "EXPORT_BUDGET_REPORTS")
  ]);
  const metrics = selected ? await getBudgetMetrics(prisma, selected) : null;

  const aggregate = (key: "category" | "department") => {
    const map = new Map<string, AggregateRow>();
    for (const row of metrics?.allocations ?? []) {
      const label = row[key]?.name ?? `All ${key === "category" ? "categories" : "departments"}`;
      const current = map.get(label) ?? {
        label,
        allocated: new Prisma.Decimal(0),
        committed: new Prisma.Decimal(0),
        paid: new Prisma.Decimal(0),
        utilized: new Prisma.Decimal(0),
        available: new Prisma.Decimal(0)
      };
      current.allocated = current.allocated.add(row.allocated);
      current.committed = current.committed.add(row.committed);
      current.paid = current.paid.add(row.paid);
      current.utilized = current.utilized.add(row.utilized);
      current.available = current.available.add(row.available);
      map.set(label, current);
    }
    return [...map.values()];
  };

  return (
    <PageShell>
      <PageHeader
        title="Budget Reports"
        description="Read-only approved budget versus actual expense spending. Forecasting is not included."
        action={selected && canExport ? <a className="button" href={`/api/budgets/reports/export?planId=${selected.id}`}>Export CSV</a> : undefined}
      />
      <form className="card filter-grid" method="get">
        <label>
          Official Budget
          <select name="planId" defaultValue={selected?.id ?? ""}>
            {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.academicYear} — {plan.budgetNumber} — {plan.title}</option>)}
          </select>
        </label>
        <button type="submit">Open Report</button>
        <Link className="button secondary" href="/budgets">Back to Budgets</Link>
      </form>
      {selected && metrics ? (
        <>
          <div className="stats">
            <div className="card stat"><span>Allocated</span><strong>{moneyExact(Number(metrics.totals.allocated))}</strong></div>
            <div className="card stat"><span>Committed</span><strong>{moneyExact(Number(metrics.totals.committed))}</strong></div>
            <div className="card stat"><span>Paid actual</span><strong>{moneyExact(Number(metrics.totals.paid))}</strong></div>
            <div className="card stat"><span>Available</span><strong>{moneyExact(Number(metrics.totals.available))}</strong></div>
          </div>
          <ReportTable title="Category-wise Budget versus Actual" rows={aggregate("category")} />
          <ReportTable title="Department-wise Budget versus Actual" rows={aggregate("department")} />
          <section className="card card-pad">
            <h3>Category + Department Allocation Detail</h3>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Category</th><th>Department</th><th>Allocated</th><th>Committed</th><th>Paid</th><th>Available</th><th>State</th></tr></thead>
                <tbody>
                  {metrics.allocations.map((row) => (
                    <tr key={row.id}>
                      <td>{row.category?.name ?? "All categories"}</td>
                      <td>{row.department?.name ?? "All departments"}</td>
                      <td>{moneyExact(Number(row.allocated))}</td>
                      <td>{moneyExact(Number(row.committed))}</td>
                      <td>{moneyExact(Number(row.paid))}</td>
                      <td>{moneyExact(Number(row.available))}</td>
                      <td><StatusBadge status={row.thresholdState} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <ReportSubset title="Under-budget Allocations" rows={metrics.allocations.filter((row) => row.available.gte(0) && row.thresholdState === "NORMAL")} />
          <ReportSubset title="Warning-threshold Allocations" rows={metrics.allocations.filter((row) => row.thresholdState === "WARNING")} />
          <ReportSubset title="Over-budget / Critical Allocations" rows={metrics.allocations.filter((row) => row.thresholdState === "CRITICAL" || row.available.lt(0))} />
        </>
      ) : <div className="empty-state">No approved or locked budget is available.</div>}
    </PageShell>
  );
}

function ReportTable({ title, rows }: { title: string; rows: AggregateRow[] }) {
  return (
    <section className="card card-pad">
      <h3>{title}</h3>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Group</th><th>Allocated</th><th>Committed</th><th>Paid</th><th>Utilized</th><th>Available</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                <td>{moneyExact(Number(row.allocated))}</td>
                <td>{moneyExact(Number(row.committed))}</td>
                <td>{moneyExact(Number(row.paid))}</td>
                <td>{moneyExact(Number(row.utilized))}</td>
                <td>{moneyExact(Number(row.available))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ReportSubset({ title, rows }: { title: string; rows: any[] }) {
  return (
    <section className="card card-pad">
      <h3>{title}</h3>
      {rows.length ? (
        <div className="report-list">
          {rows.map((row) => (
            <div key={row.id}>
              <span>{row.category?.name ?? "All categories"} / {row.department?.name ?? "All departments"}</span>
              <strong>{row.utilizationPercent == null ? "—" : `${row.utilizationPercent.toFixed(1)}%`} · {moneyExact(Number(row.available))} available</strong>
            </div>
          ))}
        </div>
      ) : <p className="muted-text">No allocations in this state.</p>}
    </section>
  );
}
