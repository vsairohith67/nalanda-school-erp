import Link from "next/link";
import { PageHeader, StatusBadge } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cloudBackupHealthSummary } from "@/lib/cloud-backup-reports";
import { getEffectivePermissions, permissionSetCan } from "@/lib/role-permissions";
import { CloudBackupActionPanel } from "@/components/cloud-backup-ui";

export default async function CloudBackupPage() {
  const user = await requirePermission("VIEW_CLOUD_BACKUP");
  const [health, profile, latestArtifact, rehearsal, permissions, pendingRun] = await Promise.all([
    cloudBackupHealthSummary(prisma),
    prisma.cloudBackupProfile.findFirst({ where: { status: "ACTIVE" }, include: { retentionPolicy: true, schedules: true } }),
    prisma.cloudBackupArtifact.findFirst({ where: { status: { not: "PRUNED" } }, include: { run: true }, orderBy: { createdAt: "desc" } }),
    prisma.cloudBackupRestoreRehearsal.findFirst({ orderBy: { createdAt: "desc" } }),
    getEffectivePermissions(prisma, user.role),
    prisma.cloudBackupRun.findFirst({ where: { status: "PENDING" }, orderBy: { createdAt: "desc" } })
  ]);
  return <div className="page cloud-backup-page"><PageHeader title="Automatic Encrypted Backup and Recovery" description="Application-side encrypted database backups with read-after-write verification, protected retention and isolated restore rehearsals." action={<div className="page-actions">{permissionSetCan(permissions, "VERIFY_CLOUD_BACKUP") ? <Link className="button secondary" href="/cloud-backup/runs">Runs</Link> : null}{permissionSetCan(permissions, "MANAGE_CLOUD_BACKUP_PROFILES") ? <Link className="button secondary" href="/cloud-backup/settings">Settings</Link> : null}{permissionSetCan(permissions, "RUN_CLOUD_BACKUP_RESTORE_REHEARSAL") ? <Link className="button secondary" href="/cloud-backup/restore-rehearsals">Rehearsals</Link> : null}{permissionSetCan(permissions, "MANAGE_CLOUD_BACKUP_RETENTION") ? <Link className="button secondary" href="/cloud-backup/retention">Retention</Link> : null}{permissionSetCan(permissions, "VIEW_CLOUD_BACKUP_REPORTS") ? <Link className="button secondary" href="/cloud-backup/reports">Reports</Link> : null}</div>} />
    <div className="notice warning"><strong>Database-only recovery boundary.</strong><span>{health.privateAssetMessage}</span></div>
    <div className="notice warning"><strong>LIVE is disabled.</strong><span>OBJECT_STORAGE and GOOGLE_DRIVE make no network calls in Prompt 20C. Environment-only keys are never sent to the Browser.</span></div>
    <div className="stats-grid"><article className="stat-card"><span>Health</span><strong><StatusBadge status={health.state} /></strong></article><article className="stat-card"><span>Provider mode</span><strong>{health.providerMode}</strong><small>LIVE disabled</small></article><article className="stat-card"><span>Latest verified age</span><strong>{health.latestVerifiedAgeHours == null ? "None" : `${health.latestVerifiedAgeHours} h`}</strong></article><article className="stat-card"><span>Consecutive failures</span><strong>{health.consecutiveFailures}</strong></article><article className="stat-card"><span>Next due</span><strong>{health.nearestDueAt ? new Date(health.nearestDueAt).toLocaleString("en-IN") : "Not scheduled"}</strong></article><article className="stat-card"><span>Restore rehearsal</span><strong>{rehearsal?.status ?? "None"}</strong></article></div>
    <CloudBackupActionPanel profile={profile} artifact={latestArtifact} pendingRun={pendingRun} policy={profile?.retentionPolicy} permissions={[...permissions]} />
    <section className="card card-pad"><h2>Recovery position</h2><p>A run becomes VERIFIED only after the existing ERP backup validates, gzip and AES-256-GCM succeed, the encrypted object is uploaded, read back, ciphertext-hashed, authenticated, decrypted, plaintext-hashed and parsed as backup version 37.</p><p><strong>External scheduler required:</strong> configure Windows Task Scheduler to invoke <code>pnpm.cmd cloud-backup:process-due</code>. A Prisma schedule alone is not automatic execution.</p></section>
  </div>;
}
