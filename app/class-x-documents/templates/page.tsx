import { ClassXConfigurationForms, ClassXConfigurationStatusButton } from "@/components/class-x-package-forms";
import { PageHeader, PageShell, StatusBadge } from "@/components/ui";
import { requirePermission, getCurrentUserEffectivePermissions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissionSetCan } from "@/lib/role-permissions";
import { getSchoolSettings } from "@/lib/school-settings";

const DEFAULT_DEFINITION = JSON.stringify({ documents: [
  { itemKey: "TRANSFER-CERTIFICATE", itemType: "TRANSFER_CERTIFICATE", issuerType: "SCHOOL", displayName: "Transfer Certificate", required: true, displayOrder: 1, parentVisible: true, serialNumberRequired: false, handoverRequired: true },
  { itemKey: "STUDY-CERTIFICATE", itemType: "STUDY_CERTIFICATE", issuerType: "SCHOOL", displayName: "Study Certificate", required: true, displayOrder: 2, parentVisible: true, serialNumberRequired: false, handoverRequired: true },
  { itemKey: "CONDUCT-CERTIFICATE", itemType: "CONDUCT_CERTIFICATE", issuerType: "SCHOOL", displayName: "Conduct Certificate", required: true, displayOrder: 3, parentVisible: true, serialNumberRequired: false, handoverRequired: true },
  { itemKey: "BOARD-MARKS-MEMO", itemType: "BOARD_MARKS_MEMO", issuerType: "BOARD", displayName: "Board Marks Memo (external physical document)", required: true, displayOrder: 4, parentVisible: true, serialNumberRequired: false, handoverRequired: true },
  { itemKey: "BOARD-MIGRATION-CERTIFICATE", itemType: "BOARD_MIGRATION_CERTIFICATE", issuerType: "BOARD", displayName: "Board Migration Certificate (external physical document)", required: true, displayOrder: 5, parentVisible: true, serialNumberRequired: false, handoverRequired: true }
], allowPartialApprovalWhileAwaitingBoard: false, parentReceiptVisible: true }, null, 2);

export default async function ClassXTemplatesPage() {
  const user = await requirePermission("VIEW_CLASS_X_PACKAGES");
  const [permissions, templates, rules, settings] = await Promise.all([
    getCurrentUserEffectivePermissions(),
    prisma.classXPackageTemplate.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.classXPackageChargeRule.findMany({ orderBy: { createdAt: "desc" } }),
    getSchoolSettings(prisma)
  ]);
  const configureTemplates = permissionSetCan(permissions, "CONFIGURE_CLASS_X_PACKAGE_TEMPLATES");
  const configureCharges = permissionSetCan(permissions, "CONFIGURE_CLASS_X_PACKAGE_CHARGES");
  return <PageShell className="class-x-page"><PageHeader title="Class X Package Templates & Charges" description="Strict JSON checklist snapshots and school service-charge rules. No Board wording or fee is hard-coded as universal." />
    {configureTemplates || configureCharges ? <ClassXConfigurationForms academicYear={settings.academicYear} defaultDefinition={DEFAULT_DEFINITION} /> : null}
    <section className="card"><h3>Checklist templates</h3><div className="table-wrap"><table><thead><tr><th>Code</th><th>Name</th><th>Year / Board</th><th>Version</th><th>Status</th><th>Payment</th><th>Configuration</th></tr></thead><tbody>{templates.map((template) => <tr key={template.id}><td>{template.templateCode}</td><td>{template.name}</td><td>{template.academicYear ?? "All"} / {template.schoolBoard ?? "Configurable"}</td><td>{template.versionNumber}</td><td><StatusBadge status={template.status} /></td><td>{template.paymentRequired ? "Required by template" : "Not required"}</td><td>{configureTemplates ? <ClassXConfigurationStatusButton endpoint={`/api/class-x-documents/templates/${template.id}`} status={template.status} label="template" /> : null}</td></tr>)}</tbody></table></div></section>
    <section className="card"><h3>Charge rules</h3><div className="table-wrap"><table><thead><tr><th>Code</th><th>Name</th><th>Year</th><th>Amount</th><th>Income item</th><th>Waiver</th><th>Status</th><th>Configuration</th></tr></thead><tbody>{rules.map((rule) => <tr key={rule.id}><td>{rule.ruleCode}</td><td>{rule.name}</td><td>{rule.academicYear ?? "All"}</td><td>₹{rule.amount.toFixed(2)}</td><td>{rule.miscellaneousIncomeItemCode}</td><td>{rule.waiverAllowed ? "Allowed" : "Not allowed"}</td><td><StatusBadge status={rule.status} /></td><td>{configureCharges ? <ClassXConfigurationStatusButton endpoint={`/api/class-x-documents/charge-rules/${rule.id}`} status={rule.status} label="rule" /> : null}</td></tr>)}</tbody></table></div></section>
  </PageShell>;
}
