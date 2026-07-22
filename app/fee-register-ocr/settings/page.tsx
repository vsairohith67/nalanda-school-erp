import Link from "next/link";
import { PageHeader, StatusBadge } from "@/components/ui";
import { OcrProfileActions } from "@/components/fee-register-ocr-ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureFeeRegisterOcrFoundation } from "@/lib/fee-register-ocr";

export default async function FeeRegisterOcrSettingsPage() {
  await requirePermission("MANAGE_FEE_REGISTER_OCR_PROFILES"); await ensureFeeRegisterOcrFoundation(prisma);
  const profiles = await prisma.feeRegisterOcrProfile.findMany({ orderBy: { createdAt: "asc" } });
  return <div className="page fee-register-ocr-page"><PageHeader title="Fee Register OCR Settings" description="Non-secret provider policy, bounded upload limits, retention and the fail-closed posting gate." action={<Link className="button secondary" href="/fee-register-ocr">OCR batches</Link>} />
    <p className="notice warning">MOCK and MANUAL only during Prompt 20B/20B-QA. LOCAL_HTTP is loopback-only but disabled; CLOUD_API is disabled pending provider, retention, region, contract and privacy review. No credential or endpoint is stored here.</p>
    <section className="card"><div className="table-wrap"><table><thead><tr><th>Profile</th><th>Provider / status</th><th>Limits</th><th>Retention</th><th>Payment posting</th><th>Action</th></tr></thead><tbody>{profiles.map((profile) => <tr key={profile.id}><td>{profile.name}<br /><small>{profile.profileCode}</small></td><td><StatusBadge status={profile.providerKind} /> <StatusBadge status={profile.status} /></td><td>{Math.round(profile.maximumFileBytes / 1024 / 1024)} MB/file · {profile.maximumPagesPerBatch} pages<br />{profile.maximumImagePixels.toLocaleString("en-IN")} pixels · {profile.maximumRowsPerPage} rows</td><td>{profile.retentionDays ? `${profile.retentionDays} days` : "Authorised purge only"}</td><td><StatusBadge status={profile.paymentPostingEnabled ? "ENABLED" : "DISABLED"} /><br /><small>Finance helper proof incomplete</small></td><td><OcrProfileActions profile={profile} /></td></tr>)}</tbody></table></div></section>
  </div>;
}
