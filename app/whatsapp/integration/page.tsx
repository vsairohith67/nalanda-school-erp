import { PageHeader, StatusBadge } from "@/components/ui";
import { WhatsAppProfileActions, WhatsAppProfileCreateForm } from "@/components/whatsapp-forms";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEffectivePermissions, permissionSetCan } from "@/lib/role-permissions";

export default async function WhatsAppIntegrationPage() {
  const user = await requirePermission("VIEW_WHATSAPP_CENTRE"), permissions = await getEffectivePermissions(prisma, user.role);
  const rows = await prisma.whatsAppIntegrationProfile.findMany({ orderBy: { createdAt: "desc" } });
  const manage = permissionSetCan(permissions, "MANAGE_WHATSAPP_INTEGRATION");
  return <div className="page whatsapp-page"><PageHeader title="WhatsApp Integration" description="Non-secret Meta Cloud API metadata and supervised activation. No credential input or display fields exist." />
    <div className="notice"><strong>Environment readiness:</strong> Graph version, business account, phone-number ID, token, webhook verify token, app secret, phone-hash pepper, feature flag, approved mapping, and successful health check are required for LIVE.</div>
    {manage ? <WhatsAppProfileCreateForm /> : null}
    <section className="card"><div className="table-wrap"><table><thead><tr><th>Profile</th><th>Mode / status</th><th>Version</th><th>Country / quiet hours</th><th>Cost cap</th><th>Live gate</th><th>Health</th><th>Actions</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.displayName}<br /><small>{row.profileCode}</small></td><td><StatusBadge status={row.mode} /> <StatusBadge status={row.status} /></td><td>{row.graphApiVersion}</td><td>{row.defaultCountryCode ?? "Explicit only"}<br /><small>{row.quietHoursStart && row.quietHoursEnd ? `${row.quietHoursStart}-${row.quietHoursEnd} IST` : "Not configured"}</small></td><td>{row.costCapEnabled && row.maximumEstimatedBatchCostMinor != null ? `INR ${(row.maximumEstimatedBatchCostMinor / 100).toFixed(2)}` : "Disabled"}</td><td>{row.liveSendingEnabled ? "Enabled" : "Disabled"}</td><td>{row.lastHealthCheckStatus ?? "Not checked"}<br /><small>{row.lastHealthCheckMessage ?? ""}</small></td><td>{manage ? <WhatsAppProfileActions id={row.id} code={row.profileCode} status={row.status} costCapEnabled={row.costCapEnabled} maximumEstimatedBatchCostMinor={row.maximumEstimatedBatchCostMinor} /> : "View only"}</td></tr>)}</tbody></table></div></section>
  </div>;
}
