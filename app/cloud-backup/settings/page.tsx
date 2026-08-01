import Link from "next/link";
import { PageHeader, StatusBadge } from "@/components/ui";
import { requirePermission, getCurrentUserEffectivePermissions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissionSetCan } from "@/lib/role-permissions";
import { CloudBackupActionPanel, CloudBackupHealthCheckButton, CloudBackupProfileForm, CloudBackupScheduleForm } from "@/components/cloud-backup-ui";

export default async function CloudBackupSettingsPage() {
  const user = await requirePermission("MANAGE_CLOUD_BACKUP_PROFILES");
  const [profiles, permissions] = await Promise.all([
    prisma.cloudBackupProfile.findMany({ include: { schedules: true, retentionPolicy: true }, orderBy: { profileCode: "asc" } }),
    getCurrentUserEffectivePermissions()
  ]);
  const active = profiles.find((row) => row.status === "ACTIVE")
    ?? profiles.find((row) => ["MOCK", "LOCAL_FOLDER"].includes(row.providerKind))
    ?? profiles[0]
    ?? null;
  return <div className="page cloud-backup-page"><PageHeader title="Cloud Backup Settings" description="Non-secret profile metadata, provider mode, key-version reference and database schedules. Credentials and encryption key material are environment-only." action={<Link className="button secondary" href="/cloud-backup">Backup health</Link>} />
    <div className="notice warning"><strong>LIVE disabled.</strong><span>OBJECT_STORAGE and GOOGLE_DRIVE are visible foundations only. No endpoint, bucket, folder, OAuth, credential or key fields exist.</span></div>
    {active ? <CloudBackupActionPanel profile={active} policy={active.retentionPolicy} permissions={[...permissions]} /> : null}
    {active && permissionSetCan(permissions, "MANAGE_CLOUD_BACKUP_PROFILES") ? <CloudBackupHealthCheckButton profileId={active.id} /> : null}
    <section className="card"><div className="table-wrap"><table><thead><tr><th>Profile</th><th>Provider</th><th>Status</th><th>Destination label</th><th>Key version</th><th>LIVE</th><th>Health</th></tr></thead><tbody>{profiles.map((profile) => <tr key={profile.id}><td>{profile.profileCode}<br /><small>{profile.name}</small></td><td>{profile.providerKind}</td><td><StatusBadge status={profile.status} /></td><td>{profile.destinationLabel}</td><td>{profile.encryptionKeyVersion}</td><td>Disabled</td><td>{profile.lastHealthCheckStatus ?? "Not checked"}<br /><small>{profile.lastHealthCheckMessage ?? "—"}</small></td></tr>)}</tbody></table></div></section>
    {permissionSetCan(permissions, "MANAGE_CLOUD_BACKUP_PROFILES") ? <CloudBackupProfileForm /> : null}
    {permissionSetCan(permissions, "MANAGE_CLOUD_BACKUP_SCHEDULES") ? <CloudBackupScheduleForm profiles={profiles} /> : null}
    <section className="card"><div className="table-wrap"><table><thead><tr><th>Schedule</th><th>Profile</th><th>Frequency</th><th>Enabled</th><th>Next due</th><th>Failures</th></tr></thead><tbody>{profiles.flatMap((profile) => profile.schedules.map((schedule) => <tr key={schedule.id}><td>{schedule.scheduleCode}</td><td>{profile.profileCode}</td><td>{schedule.frequency}</td><td>{schedule.enabled ? "Enabled" : "Disabled"}</td><td>{schedule.nextRunAt?.toLocaleString("en-IN") ?? "—"}</td><td>{schedule.consecutiveFailureCount}</td></tr>))}</tbody></table></div></section>
  </div>;
}
