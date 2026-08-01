import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { requirePermission, hasUserPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { feeRegisterOcrReportData } from "@/lib/fee-register-ocr-reports";


export default async function FeeRegisterOcrReportsPage() {
  const user = await requirePermission("VIEW_FEE_REGISTER_OCR_REPORTS");
  const [report, canExport, canViewBatches] = await Promise.all([
    feeRegisterOcrReportData(prisma),
    hasUserPermission(user, "EXPORT_FEE_REGISTER_OCR_REPORTS"),
    hasUserPermission(user, "VIEW_FEE_REGISTER_OCR")
  ]);
  return <div className="page fee-register-ocr-page"><PageHeader title="Fee Register OCR Reports" description="Privacy-safe operational, duplicate, confidence, retention and OCR-to-Payment reconciliation aggregates." action={<div className="page-actions">{canViewBatches ? <Link className="button secondary" href="/fee-register-ocr">OCR batches</Link> : null}{canExport ? <a className="button" href="/api/fee-register-ocr/reports/export">Export aggregate CSV</a> : null}</div>} />
    <div className="stats-grid"><article className="stat-card"><span>Batches / pages / rows</span><strong>{report.totals.batches} / {report.totals.pages} / {report.totals.rows}</strong></article><article className="stat-card"><span>Verified amount</span><strong>₹{(report.totals.verifiedAmountMinor / 100).toFixed(2)}</strong></article><article className="stat-card"><span>Posted amount</span><strong>₹{(report.totals.postedAmountMinor / 100).toFixed(2)}</strong></article><article className="stat-card"><span>Unlinked / duplicate Payment links</span><strong>{report.totals.unlinkedPostedRows} / {report.totals.duplicatePaymentLinks}</strong><small>Expected 0 / 0</small></article><article className="stat-card"><span>Purged / missing sources</span><strong>{report.totals.pagesPurged} / {report.totals.pagesMissing}</strong></article><article className="stat-card"><span>Posting failures</span><strong>{report.totals.postingFailures}</strong></article></div>
    <div className="ocr-report-grid">{Object.entries({ "Batches by status": report.batchesByStatus, "Pages by status": report.pagesByStatus, "Rows by status": report.rowsByStatus, "Duplicate classifications": report.duplicateClassifications, "Student match methods": report.matchingMethods, "Field confidence": report.fieldConfidence, "Provider modes": report.providerModes }).map(([title, values]) => <section className="card card-pad" key={title}><h2>{title}</h2><dl>{Object.entries(values).map(([key, value]) => <div key={key}><dt>{key.replaceAll("_", " ")}</dt><dd>{String(value)}</dd></div>)}</dl></section>)}</div>
  </div>;
}
