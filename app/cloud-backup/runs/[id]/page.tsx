import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, StatusBadge } from "@/components/ui";
import { requirePermission, getCurrentUserEffectivePermissions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { CloudBackupActionPanel } from "@/components/cloud-backup-ui";

export default async function CloudBackupRunDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("VERIFY_CLOUD_BACKUP");
  const [run, permissions] = await Promise.all([
    prisma.cloudBackupRun.findUnique({ where: { id: (await params).id }, include: { profile: { include: { retentionPolicy: true } }, artifacts: { include: { verifications: { orderBy: { checkedAt: "asc" } } }, orderBy: { createdAt: "asc" } }, events: { orderBy: { eventDate: "asc" } }, restoreRehearsals: true } }),
    getCurrentUserEffectivePermissions()
  ]);
  if (!run) notFound();
  const artifact = run.artifacts[0];
  return <div className="page cloud-backup-page"><PageHeader title={run.runNumber} description="Immutable run, artifact, hash, verification and append-only event metadata." action={<Link className="button secondary" href="/cloud-backup/runs">All runs</Link>} />
    <div className="stats-grid"><article className="stat-card"><span>Status</span><strong><StatusBadge status={run.status} /></strong></article><article className="stat-card"><span>Provider</span><strong>{run.profile.providerKind}</strong></article><article className="stat-card"><span>Backup version</span><strong>{run.sourceBackupVersion ?? "—"}</strong></article><article className="stat-card"><span>Key version</span><strong>{run.encryptionKeyVersion ?? "—"}</strong></article><article className="stat-card"><span>Plain / gzip / encrypted</span><strong>{run.plaintextBytes ?? 0} / {run.compressedBytes ?? 0} / {run.encryptedBytes ?? 0}</strong></article><article className="stat-card"><span>Failure</span><strong>{run.failureCode ?? "None"}</strong></article></div>
    <CloudBackupActionPanel profile={run.profile} artifact={artifact} pendingRun={run.status === "PENDING" ? run : null} policy={run.profile.retentionPolicy} permissions={[...permissions]} />
    {artifact ? <section className="card card-pad"><h2>Encrypted database artifact</h2><dl><div><dt>Artifact status</dt><dd>{artifact.status}</dd></div><div><dt>Safe object key</dt><dd><code>{artifact.objectKeySafe}</code></dd></div><div><dt>Plaintext SHA-256</dt><dd><code>{artifact.plaintextSha256}</code></dd></div><div><dt>Ciphertext SHA-256</dt><dd><code>{artifact.ciphertextSha256}</code></dd></div><div><dt>Coverage</dt><dd>Database payload included; OCR/private uploaded assets excluded.</dd></div></dl></section> : null}
    <section className="card"><div className="table-wrap"><table><thead><tr><th>Check</th><th>Status</th><th>Checked</th><th>Safe summary</th><th>Failure</th></tr></thead><tbody>{artifact?.verifications.map((row) => <tr key={row.id}><td>{row.verificationType}</td><td><StatusBadge status={row.status} /></td><td>{row.checkedAt.toLocaleString("en-IN")}</td><td>{row.safeSummary}</td><td>{row.failureCode ?? "—"}</td></tr>)}</tbody></table></div></section>
    <section className="card"><div className="table-wrap"><table><thead><tr><th>Event</th><th>Time</th><th>Reason</th></tr></thead><tbody>{run.events.map((row) => <tr key={row.id}><td>{row.eventType}</td><td>{row.eventDate.toLocaleString("en-IN")}</td><td>{row.reason ?? "—"}</td></tr>)}</tbody></table></div></section>
  </div>;
}
