import { CertificateWorkflowError } from "@/lib/certificate-requests";
import { validateCertificateTemplateDefinition } from "@/lib/certificate-templates";
import { assertGraduationEnabled } from "@/lib/certificate-graduation-policy";

export async function editCertificateTemplate(client: any, id: string, input: any, actorId: string) {
  return client.$transaction(async (tx: any) => {
    const old = await tx.certificateTemplate.findUnique({ where: { id } });
    if (!old) throw new CertificateWorkflowError("Template not found.", 404);
    assertGraduationEnabled(old.certificateType);
    if (!input.expectedUpdatedAt || old.updatedAt.toISOString() !== input.expectedUpdatedAt) throw new CertificateWorkflowError("Template changed. Refresh before editing.", 409);
    const definition = validateCertificateTemplateDefinition(old.certificateType, input.definition ?? JSON.parse(old.templateDefinitionJson));
    const name = String(input.name ?? old.name).trim();
    if (!name || name.length > 120) throw new CertificateWorkflowError("A template name of at most 120 characters is required.");
    const priorPrint = JSON.parse(old.printSettingsJson ?? "{}");
    const historicallyApproved = old.activatedByUserId || old.status === "ACTIVE" || priorPrint.approvalProvenance;
    const contentChanged = JSON.stringify(definition) !== old.templateDefinitionJson || name !== old.name;
    if ((historicallyApproved || await tx.studentCertificate.findFirst({ where: { templateId: id } })) && contentChanged) {
      const next = old.versionNumber + 1;
      const root = old.templateCode.replace(/-V\d+$/, "");
      return tx.certificateTemplate.create({ data: { templateCode: `${root}-V${next}`, certificateType: old.certificateType, name, academicYear: old.academicYear, status: "DRAFT", versionNumber: next, templateDefinitionJson: JSON.stringify(definition), printSettingsJson: JSON.stringify({ ...priorPrint, approvalProvenance: null, restoredNeedsPreparation: false }), createdByUserId: actorId } });
    }
    const status = input.status ?? old.status;
    if (status === "ACTIVE" && priorPrint.restoredNeedsPreparation) throw new CertificateWorkflowError("Restored draft requires fresh preparation before independent activation.", 409);
    if (contentChanged && status === "ACTIVE") throw new CertificateWorkflowError("Save wording as a draft before independent activation.", 409);
    if (!["DRAFT", "ACTIVE", "INACTIVE"].includes(status)) throw new CertificateWorkflowError("Unsupported template status.");
    if (status === "ACTIVE" && old.certificateType === "GRADUATION" && old.createdByUserId === actorId) throw new CertificateWorkflowError("A different authorized reviewer must activate the template.", 403);
    if (historicallyApproved && status === "DRAFT") throw new CertificateWorkflowError("Approved templates cannot return to draft; create a new version.", 409);
    const changed = await tx.certificateTemplate.updateMany({ where: { id, updatedAt: old.updatedAt }, data: { ...(contentChanged ? { createdByUserId: actorId } : {}), printSettingsJson: JSON.stringify({ ...priorPrint, restoredNeedsPreparation: contentChanged ? false : priorPrint.restoredNeedsPreparation, approvalProvenance: priorPrint.approvalProvenance ?? ((historicallyApproved || status === "ACTIVE") ? { approvedBy: old.activatedByUserId ?? actorId, preservedAt: new Date() } : null) }), name, templateDefinitionJson: JSON.stringify(definition), status, activatedByUserId: status === "ACTIVE" ? old.activatedByUserId ?? actorId : old.activatedByUserId } });
    if (changed.count !== 1) throw new CertificateWorkflowError("Template changed concurrently.", 409);
    return tx.certificateTemplate.findUnique({ where: { id } });
  }, { isolationLevel: "Serializable" });
}
