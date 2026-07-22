import { PageHeader, StatusBadge } from "@/components/ui";
import { IdentityCardConfigurationForms, IdentityCardConfigurationStatusAction } from "@/components/identity-card-forms";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEffectivePermissions, permissionSetCan } from "@/lib/role-permissions";
import { getSchoolSettings } from "@/lib/school-settings";

export default async function IdentityCardTemplatesPage() {
  const user = await requirePermission("VIEW_ID_CARDS");
  const permissions = await getEffectivePermissions(prisma, user.role);
  const settings = await getSchoolSettings(prisma);
  const [templates, series] = await Promise.all([
    prisma.identityCardTemplate.findMany({ orderBy: [{ cardType: "asc" }, { templateCode: "asc" }] }),
    prisma.identityCardNumberSeries.findMany({ orderBy: [{ cardType: "asc" }, { seriesCode: "asc" }] })
  ]);
  const manageTemplates = permissionSetCan(permissions, "MANAGE_ID_CARD_TEMPLATES");
  const manageSeries = permissionSetCan(permissions, "MANAGE_ID_CARD_NUMBER_SERIES");
  return <div className="page identity-card-page"><PageHeader title="ID Card Templates and Number Series" description="Strict Student/Staff allowlists, local school branding, photo placeholders, and issue-time number allocation."/>
    <div className="notice">There is no managed Student/Staff photo source. Photo-required templates are rejected; arbitrary image URLs and file paths are never accepted.</div>
    {manageTemplates || manageSeries ? <IdentityCardConfigurationForms academicYear={settings.academicYear}/> : <p className="notice">Configuration is read-only for your role.</p>}
    <div className="two-column">
      <section className="card"><div className="table-wrap"><table><thead><tr><th>Template</th><th>Type</th><th>Status</th><th>Photo</th><th>Barcode</th><th>Manage</th></tr></thead><tbody>{templates.map((row) => <tr key={row.id}><td>{row.name}<br/><small>{row.templateCode} · v{row.versionNumber}</small></td><td>{row.cardType}</td><td><StatusBadge status={row.status}/></td><td>{row.photoRequired ? "Required" : "Placeholder allowed"}</td><td>{row.barcodeEnabled ? "Code 39 card number" : "Disabled"}</td><td>{manageTemplates ? <IdentityCardConfigurationStatusAction kind="template" id={row.id} status={row.status}/> : "Read only"}</td></tr>)}</tbody></table></div></section>
      <section className="card"><div className="table-wrap"><table><thead><tr><th>Series</th><th>Type/year</th><th>Next</th><th>Status</th><th>Manage</th></tr></thead><tbody>{series.map((row) => <tr key={row.id}><td>{row.seriesCode}</td><td>{row.cardType}<br/><small>{row.academicYear ?? "Never reset"}</small></td><td>{row.prefix}{String(row.nextNumber).padStart(row.paddingLength, "0")}{row.suffix}</td><td><StatusBadge status={row.status}/></td><td>{manageSeries ? <IdentityCardConfigurationStatusAction kind="number-series" id={row.id} status={row.status}/> : "Read only"}</td></tr>)}</tbody></table></div></section>
    </div>
  </div>;
}
