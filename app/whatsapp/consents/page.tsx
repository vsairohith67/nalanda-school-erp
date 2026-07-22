import { PageHeader, StatCard, StatusBadge } from "@/components/ui";
import { WhatsAppConsentOfficeForm } from "@/components/whatsapp-forms";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function WhatsAppConsentsPage() {
  await requirePermission("MANAGE_WHATSAPP_CONSENTS");
  const rows = await prisma.whatsAppConsent.findMany({ orderBy: { createdAt: "desc" }, take: 500 });
  const count = (status: string) => rows.filter((row) => row.status === status).length;
  return <div className="page whatsapp-page"><PageHeader title="WhatsApp Consent Operations" description="Explicit, phone-bound Guardian and Staff consent. A phone number alone never means consent." />
    <div className="grid three"><StatCard label="Opted in" value={String(count("OPTED_IN"))} /><StatCard label="Opted out" value={String(count("OPTED_OUT"))} /><StatCard label="Invalidated / expired" value={String(count("INVALIDATED") + count("EXPIRED"))} /></div>
    <WhatsAppConsentOfficeForm />
    <section className="card"><div className="table-wrap"><table><thead><tr><th>Subject</th><th>Masked phone</th><th>Status</th><th>Source</th><th>Evidence</th><th>Opt-in / expiry</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.subjectType}</td><td>{row.countryCode ?? ""} ******{row.phoneLast4}</td><td><StatusBadge status={row.status} /></td><td>{row.consentSource}</td><td>{row.evidenceReference ?? "Portal or office confirmation"}</td><td>{row.optedInAt?.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) ?? "—"}<br /><small>{row.expiresAt ? `Expires ${row.expiresAt.toLocaleDateString("en-IN")}` : "No configured expiry"}</small></td></tr>)}{!rows.length ? <tr><td colSpan={6}>No WhatsApp consent records. Existing contacts have not been opted in.</td></tr> : null}</tbody></table></div></section>
  </div>;
}
