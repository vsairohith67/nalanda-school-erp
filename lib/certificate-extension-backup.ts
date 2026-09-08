import { createHash } from "node:crypto";
export const CERTIFICATE_EXTENSION_KEYS = ["certificateRequestCharges", "certificateBulkBatches", "certificateIssueArtifacts"] as const;
const hex = (value: unknown) => /^[a-f0-9]{64}$/.test(String(value ?? ""));
const hash = (value: Uint8Array | string) => createHash("sha256").update(value).digest("hex");
export function validateCertificateExtensionBackup(root: Record<string, any>) {
  const result: Record<string, any[]> = {};
  for (const key of CERTIFICATE_EXTENSION_KEYS) {
    const rows = root[key] ?? [];
    if (!Array.isArray(rows) || rows.length > 100000 || rows.some(r => !r || typeof r !== "object" || typeof r.id !== "string" || !r.id)) throw new Error(`Invalid ${key}`);
    if (new Set(rows.map(r => r.id)).size !== rows.length) throw new Error(`Duplicate ${key}`);
    result[key] = rows;
  }
  const requests = new Map((root.studentCertificateRequests ?? []).map((r: any) => [r.id, r]));
  const certificates = new Map((root.studentCertificates ?? []).map((r: any) => [r.id, r]));
  const versions = new Map((root.studentCertificateVersions ?? []).map((r: any) => [r.id, r]));
  const templates = new Set((root.certificateTemplates ?? []).map((r: any) => r.id));
  const receipts = new Map((root.miscIncomeReceipts ?? []).map((r: any) => [r.id, r]));
  const seenRequests = new Set(), seenReceipts = new Set(), seenTokens = new Set(), seenVersions = new Set();
  for (const charge of result.certificateRequestCharges) {
    const request: any = requests.get(charge.requestId), receipt: any = receipts.get(charge.receiptId);
    if (!request || request.studentId !== charge.studentId || request.academicYear !== charge.academicYear || seenRequests.has(charge.requestId)) throw new Error("Certificate charge ownership invalid");
    seenRequests.add(charge.requestId);
    if (charge.receiptId && (!receipt || receipt.studentId !== charge.studentId || receipt.academicYear !== charge.academicYear || seenReceipts.has(charge.receiptId))) throw new Error("Certificate receipt ownership invalid");
    if (charge.receiptId) seenReceipts.add(charge.receiptId);
    const s = JSON.parse(charge.snapshotJson);
    if (!s.rateId || !s.itemId || !/^\d+(?:\.\d{1,2})?$/.test(s.amount) || !["PENDING_APPROVAL", "APPROVED", "PAID", "NO_CHARGE", "WAIVED"].includes(charge.status)) throw new Error("Certificate charge snapshot invalid");
  }
  for (const artifact of result.certificateIssueArtifacts) {
    const version: any = versions.get(artifact.versionId);
    if (!certificates.has(artifact.certificateId) || !version || version.certificateId !== artifact.certificateId || version.snapshotHash !== artifact.snapshotHash || hash(version.snapshotJson) !== artifact.snapshotHash || !hex(artifact.tokenHash) || seenTokens.has(artifact.tokenHash) || seenVersions.has(artifact.versionId)) throw new Error("Certificate artifact provenance invalid");
    seenTokens.add(artifact.tokenHash); seenVersions.add(artifact.versionId);
    if (typeof artifact.pdfBase64 !== "string" || artifact.pdfBase64.length > 2800000 || hash(Buffer.from(artifact.pdfBase64, "base64")) !== artifact.pdfHash) throw new Error("Certificate artifact hash invalid");
  }
  for (const batch of result.certificateBulkBatches) {
    if (!templates.has(batch.templateId) || !hex(batch.uploadDigest) || !hex(batch.batchKey) || batch.mappingVersion !== "certificate-xlsx-v1") throw new Error("Certificate batch identity invalid");
    const rows = JSON.parse(batch.rowsJson);
    if (!Array.isArray(rows) || rows.length > 100 || rows.some(r => r.requestId && !requests.has(r.requestId))) throw new Error("Certificate batch ownership invalid");
    if (batch.approvalJson) {
      const approval = JSON.parse(batch.approvalJson);
      if (approval.uploadDigest !== batch.uploadDigest || approval.rowsHash !== hash(JSON.stringify(rows))) throw new Error("Certificate batch approval digest invalid");
    }
  }
  return result as { certificateRequestCharges: any[]; certificateBulkBatches: any[]; certificateIssueArtifacts: any[] };
}

export async function restoreCertificateExtensions(client: any, backup: any, studentMap: Map<string, string>, result: any) {
  const rows = validateCertificateExtensionBackup(backup);
  const models = { certificateRequestCharges: "certificateRequestCharge", certificateBulkBatches: "certificateBulkBatch", certificateIssueArtifacts: "certificateIssueArtifact" } as const;
  for (const key of CERTIFICATE_EXTENSION_KEYS) for (const source of rows[key]) {
    try {
      const data = { ...source };
      if (key === "certificateRequestCharges") {
        const mapped = studentMap.get(source.studentId);
        const request = await client.studentCertificateRequest.findUnique({ where: { id: source.requestId } });
        if (!mapped || request?.studentId !== mapped) throw new Error("Restored charge ownership mismatch");
        data.studentId = mapped;
        if (source.receiptId) {
          const receipt = await client.miscIncomeReceipt.findUnique({ where: { id: source.receiptId } });
          const original = backup.miscIncomeReceipts.find((r: any) => r.id === source.receiptId);
          if (!receipt || receipt.studentId !== mapped || receipt.academicYear !== source.academicYear || receipt.receiptNumber !== original?.receiptNumber || ["netAmount", "grossAmount", "discountAmount"].some(field => String(receipt[field]) !== String(original?.[field])) || receipt.status !== original?.status) throw new Error("Restored receipt ownership/content mismatch");
          const actualLines = await client.miscIncomeReceiptLine.findMany({where:{receiptId:source.receiptId}});
          const expectedLines = backup.miscIncomeReceiptLines.filter((line:any)=>line.receiptId===source.receiptId);
          if (actualLines.length !== expectedLines.length || expectedLines.some((line:any)=>!actualLines.some((target:any)=>["id","itemId","rateId","itemNameSnapshot","quantity","unitAmount","discountAmount","lineTotal"].every(field=>String(target[field])===String(line[field]))))) throw new Error("Restored receipt lines mismatch");
        }
      }
      if (key === "certificateIssueArtifacts") {
        const certificate = await client.studentCertificate.findUnique({ where: { id: source.certificateId } });
        const version = await client.studentCertificateVersion.findUnique({ where: { id: source.versionId } });
        const original = backup.studentCertificates.find((r: any) => r.id === source.certificateId);
        const originalVersion = backup.studentCertificateVersions.find((r: any) => r.id === source.versionId);
        if (!certificate || !original || certificate.studentId !== studentMap.get(original.studentId) || certificate.certificateType !== original.certificateType || certificate.academicYear !== original.academicYear || certificate.certificateNumber !== original.certificateNumber || certificate.status !== original.status || !version || version.certificateId !== source.certificateId || version.snapshotHash !== source.snapshotHash || version.snapshotJson !== originalVersion?.snapshotJson || version.supersedesVersionId !== (originalVersion?.supersedesVersionId ?? null)) throw new Error("Restored artifact ownership/content mismatch");
      }
      if (key === "certificateBulkBatches" && !(await client.certificateTemplate.findUnique({ where: { id: source.templateId } }))) throw new Error("Restored batch template missing");
      for (const name of ["createdAt", "updatedAt", "approvedAt", "expiresAt"]) if (data[name]) data[name] = new Date(data[name]);
      const model = client[models[key]], old = await model.findUnique({ where: { id: data.id } });
      if (old) {
        for (const field of Object.keys(data)) if (JSON.stringify(old[field]) !== JSON.stringify(data[field])) throw new Error("Existing certificate extension requires reconciliation");
        result[key].skipped++; continue;
      }
      await model.create({ data }); result[key].created++;
    } catch (e) { result[key].errors.push(e instanceof Error ? e.message : "Certificate extension restore failed"); }
  }
}
