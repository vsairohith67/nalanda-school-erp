import Link from "next/link";
import { PageHeader, StatusBadge } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { previewCloudBackupRetention } from "@/lib/cloud-backup-retention";
import { getEffectivePermissions } from "@/lib/role-permissions";
import { CloudBackupActionPanel } from "@/components/cloud-backup-ui";

export default async function CloudBackupRetentionPage() {
  const user = await requirePermission("MANAGE_CLOUD_BACKUP_RETENTION");
  const [profile, permissions] = await Promise.all([
    prisma.cloudBackupProfile.findFirst({ where: { status: "ACTIVE" }, include: { retentionPolicy: true } }),
    getEffectivePermissions(prisma, user.role)
  ]);
  const preview = profile ? await previewCloudBackupRetention(prisma, profile.id) : null;
  return <div className="page cloud-backup-page"><PageHeader title="Cloud Backup Retention" description="Dry-run first, exact-object deletion only, latest-good and rehearsal-source protection, and preserved PRUNED metadata." action={<Link className="button secondary" href="/cloud-backup">Backup health</Link>} />
    {profile ? <CloudBackupActionPanel profile={profile} policy={profile.retentionPolicy} permissions={[...permissions]} /> : null}
    <div className="stats-grid"><article className="stat-card"><span>Auto prune</span><strong>{preview?.policy.autoPruneEnabled ? "Enabled" : "Disabled"}</strong></article><article className="stat-card"><span>Latest protected</span><strong>{preview?.policy.keepLatestVerifiedCount ?? 2}</strong></article><article className="stat-card"><span>Daily days</span><strong>{preview?.policy.keepDailyDays ?? 0}</strong></article><article className="stat-card"><span>Weekly weeks</span><strong>{preview?.policy.keepWeeklyWeeks ?? 0}</strong></article><article className="stat-card"><span>Monthly months</span><strong>{preview?.policy.keepMonthlyMonths ?? 0}</strong></article><article className="stat-card"><span>Minimum verified</span><strong>{preview?.policy.minimumVerifiedCopies ?? 2}</strong></article><article className="stat-card"><span>Post-prune verified</span><strong>{preview?.postPruneVerifiedCopyCount ?? 0}</strong></article></div>
    <section className="card"><div className="table-wrap"><table><thead><tr><th>Run</th><th>Provider</th><th>Created</th><th>Verified</th><th>Rehearsal source</th><th>Decision</th></tr></thead><tbody>{preview?.rows.map((row) => <tr key={row.artifactId}><td>{row.runNumber}</td><td>{row.providerKind}</td><td>{row.createdAt.toLocaleString("en-IN")}</td><td><StatusBadge status={row.verified ? "VERIFIED" : "UNVERIFIED"} /></td><td>{row.rehearsalSource ? "Protected" : "No"}</td><td>{row.eligible ? `Eligible: ${row.eligibleReason}` : `Retain: ${row.retainedReason}`}</td></tr>)}</tbody></table></div>{!preview?.rows.length ? <p className="empty-state">No encrypted artifacts are available for retention preview.</p> : null}</section>
  </div>;
}
