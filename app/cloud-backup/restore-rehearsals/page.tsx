import Link from "next/link";
import { PageHeader, StatusBadge } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEffectivePermissions } from "@/lib/role-permissions";
import { CloudBackupActionPanel } from "@/components/cloud-backup-ui";

export default async function CloudBackupRestoreRehearsalsPage() {
  const user = await requirePermission("RUN_CLOUD_BACKUP_RESTORE_REHEARSAL");
  const [rehearsals, artifact, profile, permissions] = await Promise.all([
    prisma.cloudBackupRestoreRehearsal.findMany({ include: { run: { select: { runNumber: true } } }, orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.cloudBackupArtifact.findFirst({ where: { status: "VERIFIED", run: { status: "VERIFIED" } }, orderBy: { verifiedAt: "desc" } }),
    prisma.cloudBackupProfile.findFirst({ where: { status: "ACTIVE" }, include: { retentionPolicy: true } }),
    getEffectivePermissions(prisma, user.role)
  ]);
  return <div className="page cloud-backup-page"><PageHeader title="Isolated Restore Rehearsals" description="Recovery proof in a copied temporary database. The operational ERP is never a restore destination." action={<Link className="button secondary" href="/cloud-backup">Backup health</Link>} />
    <div className="notice warning"><strong>Isolation guarantee.</strong><span>This verifies recovery in a temporary database. It does not restore or change the operational ERP.</span></div>
    <CloudBackupActionPanel profile={profile} artifact={artifact} policy={profile?.retentionPolicy} permissions={[...permissions]} />
    <section className="card"><div className="table-wrap"><table><thead><tr><th>Rehearsal</th><th>Source run</th><th>Status</th><th>Backup version</th><th>First/second digest</th><th>Source unchanged</th><th>Temp removed</th></tr></thead><tbody>{rehearsals.map((row) => <tr key={row.id}><td>{row.rehearsalNumber}</td><td>{row.run.runNumber}</td><td><StatusBadge status={row.status} /></td><td>{row.backupVersion ?? "—"}</td><td>{row.countDigestAfterFirst?.slice(0, 12) ?? "—"} / {row.countDigestAfterSecond?.slice(0, 12) ?? "—"}</td><td>{row.sourceDatabaseUnchangedHash ? "Verified" : "—"}</td><td>{row.temporaryDatabaseRemoved ? "Yes" : "No"}</td></tr>)}</tbody></table></div>{!rehearsals.length ? <p className="empty-state">No restore rehearsal has run yet; backup health cannot be fully proven.</p> : null}</section>
  </div>;
}
