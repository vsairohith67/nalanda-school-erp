import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { requirePermission, hasUserPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cloudBackupAggregateReport } from "@/lib/cloud-backup-reports";


export default async function CloudBackupReportsPage() {
  const user = await requirePermission("VIEW_CLOUD_BACKUP_REPORTS");
  const [report, canExport] = await Promise.all([cloudBackupAggregateReport(prisma), hasUserPermission(user, "EXPORT_CLOUD_BACKUP_REPORTS")]);
  return <div className="page cloud-backup-page"><PageHeader title="Cloud Backup and Recovery Reports" description="Aggregate, formula-safe and privacy-safe backup operations. No school records, database IDs, raw actor IDs, credentials, keys, paths or provider payloads." action={<div className="page-actions"><Link className="button secondary" href="/cloud-backup">Backup health</Link>{canExport ? <a className="button" href="/api/cloud-backup/reports/export">Export aggregate CSV</a> : null}</div>} />
    <div className="notice warning"><strong>Private assets:</strong><span>Database backup verified. Private uploaded assets are not included in this backup.</span></div>
    <div className="stats-grid"><article className="stat-card"><span>Verified backups</span><strong>{report.verifiedBackups}</strong></article><article className="stat-card"><span>Successful uploads</span><strong>{report.successfulUploads}</strong></article><article className="stat-card"><span>Latest verified age</span><strong>{report.latestVerifiedAgeHours ?? "—"} h</strong></article><article className="stat-card"><span>Average duration</span><strong>{report.averageDurationMs ?? "—"} ms</strong></article><article className="stat-card"><span>Average encrypted size</span><strong>{report.averageEncryptedBytes ?? "—"} bytes</strong></article><article className="stat-card"><span>Compression ratio</span><strong>{report.averageCompressionRatio ?? "—"}</strong></article><article className="stat-card"><span>Retries / failures</span><strong>{report.retryCount} / {report.consecutiveFailures}</strong></article><article className="stat-card"><span>Pruned artifacts</span><strong>{report.prunedArtifacts}</strong></article></div>
    <div className="report-grid">{Object.entries({ "Profiles by mode/status": report.profilesByModeStatus, "Runs by status": report.runsByStatus, "Runs by trigger": report.runsByTrigger, "Restore rehearsals": report.restoreRehearsals, "Encryption key versions": report.keyVersions }).map(([title, values]) => <section className="card card-pad" key={title}><h2>{title}</h2><dl>{Object.entries(values).map(([key, value]) => <div key={key}><dt>{key.replaceAll("_", " ")}</dt><dd>{value}</dd></div>)}</dl></section>)}</div>
  </div>;
}
