import { PageHeader } from "@/components/ui";
import { requirePermission, hasUserPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { certificateReportSummary } from "@/lib/certificate-reports";


function Breakdown({ title, values }: { title: string; values: Record<string, number> }) {
  return (
    <section className="card">
      <h3>{title}</h3>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Category</th><th>Total</th></tr></thead>
          <tbody>{Object.entries(values).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => <tr key={key}><td>{key.replaceAll("_", " ")}</td><td>{value}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}

export default async function ReportsPage() {
  const user = await requirePermission("VIEW_CERTIFICATE_REPORTS");
  const [requests, certificates, series, events, canExport] = await Promise.all([
    prisma.studentCertificateRequest.findMany(),
    prisma.studentCertificate.findMany(),
    prisma.certificateNumberSeries.findMany(),
    prisma.studentCertificateEvent.findMany({ select: { eventType: true } }),
    hasUserPermission(user, "EXPORT_CERTIFICATE_REPORTS")
  ]);
  const summary = certificateReportSummary(requests, certificates, series, events);
  const numericSummary = Object.entries(summary).filter(([, value]) => typeof value === "number");
  return (
    <div className="page certificate-page">
      <PageHeader
        title="Certificate Reports"
        description="Operational aggregates with privacy-safe export. No demographics, contacts, fees, raw IDs, or actor IDs."
        action={canExport ? <a className="button" href="/api/certificates/reports/export">Export Formula-safe CSV</a> : undefined}
      />
      <div className="stats">{numericSummary.map(([key, value]) => <div className="card stat" key={key}><span>{key.replace(/([A-Z])/g, " $1")}</span><strong>{value as number}</strong></div>)}</div>
      <div className="two-column">
        <Breakdown title="Requests by Type" values={summary.requestsByType} />
        <Breakdown title="Requests by Status" values={summary.requestsByStatus} />
      </div>
      <Breakdown title="Requests by Source" values={summary.requestsBySource} />
      <section className="card">
        <h3>Number-series Usage</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Series</th><th>Type</th><th>Last allocated</th><th>Next number</th></tr></thead>
            <tbody>{summary.seriesUsage.map((row: any) => <tr key={row.seriesCode}><td>{row.seriesCode}</td><td>{row.certificateType}</td><td>{row.lastAllocated}</td><td>{row.nextNumber}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
