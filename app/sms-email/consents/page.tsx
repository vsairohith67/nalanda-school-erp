import { ClearSuppressionButton, SmsEmailConsentOfficeForm } from "@/components/sms-email-forms";
import { PageHeader, StatusBadge } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function SmsEmailConsentsPage() {
  await requirePermission("MANAGE_SMS_EMAIL_CONSENTS");
  const [consents, suppressions] = await Promise.all([
    prisma.smsEmailConsent.findMany({ take: 100, orderBy: { createdAt: "desc" } }),
    prisma.smsEmailSuppression.findMany({ take: 100, orderBy: { createdAt: "desc" } })
  ]);
  return <div className="page sms-email-page"><PageHeader title="SMS and Email Consent and Suppression" description="Independent channel consent bound to an exact masked authoritative contact. Full contacts are not duplicated here." />
    <SmsEmailConsentOfficeForm />
    <section className="card"><div className="section-title"><div><h3>Recent consent history</h3><p>Append-only events preserve opt-in, opt-out and contact-change invalidation.</p></div></div><div className="table-wrap"><table><thead><tr><th>Channel</th><th>Subject</th><th>Masked contact</th><th>Status</th><th>Source</th></tr></thead><tbody>{consents.map((row) => <tr key={row.id}><td>{row.channel}</td><td>{row.subjectType}</td><td>{row.contactMasked}</td><td><StatusBadge status={row.status} /></td><td>{row.consentSource}</td></tr>)}{!consents.length ? <tr><td colSpan={5}>No SMS/Email consent records.</td></tr> : null}</tbody></table></div></section>
    <section className="card"><div className="section-title"><div><h3>Email suppressions</h3><p>Hard bounce, complaint, provider suppression or invalid address blocks later sends.</p></div></div><div className="table-wrap"><table><thead><tr><th>Channel</th><th>Masked contact</th><th>Reason</th><th>Status</th><th>Review</th></tr></thead><tbody>{suppressions.map((row) => <tr key={row.id}><td>{row.channel}</td><td>{row.contactMasked}</td><td>{row.reason}</td><td><StatusBadge status={row.status} /></td><td>{row.status === "ACTIVE" ? <ClearSuppressionButton id={row.id} /> : row.reviewReason ?? "Cleared"}</td></tr>)}{!suppressions.length ? <tr><td colSpan={5}>No suppressions.</td></tr> : null}</tbody></table></div></section>
  </div>;
}
