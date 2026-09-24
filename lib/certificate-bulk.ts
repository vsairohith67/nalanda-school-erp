import { snapshotHash } from "@/lib/certificate-snapshots";
import { CertificateWorkflowError } from "@/lib/certificate-requests";
import { CERTIFICATE_BULK_FEATURE, requireGraduationReadiness } from "@/lib/certificate-graduation-policy";
import { assertOperationalReleaseFeature } from "@/lib/release-feature-flag-runtime";
import { CERTIFICATE_MAPPING_VERSION, parseCertificateWorkbook } from "@/lib/certificate-workbooks";
import { sha256Bytes } from "@/lib/certificate-pdf";
import { certificateChargeProof } from "@/lib/certificate-charges";
import { createStudentCertificateDraft, issueCertificate, transitionCertificate } from "@/lib/student-certificates";

type BulkRow = { number: number; values: string[]; requestId?: string; targetHash?: string; errors: string[] };
async function target(client: any, values: string[], templateId: string) {
  const [requestNumber, admissionNo, studentName, academicYear, className] = values;
  const request = await client.studentCertificateRequest.findUnique({ where: { requestNumber } });
  const student = await client.student.findFirst({ where: { admissionNo, deletedAt: null }, select: { id: true, studentName: true, updatedAt: true } });
  if (!request || !student || request.studentId !== student.id || request.academicYear !== academicYear || request.status !== "APPROVED" || request.certificateType !== "GRADUATION" || student.studentName !== studentName) throw new CertificateWorkflowError("Exact approved request, Student name/admission and academic year must agree; correct the source or workbook.", 409);
  const enrollment = await client.academicYearEnrollment.findUnique({ where: { studentId_academicYear: { studentId: student.id, academicYear } } });
  const template = await client.certificateTemplate.findUnique({ where: { id: templateId } });
  if (!enrollment || enrollment.className !== className || !template || template.status !== "ACTIVE" || template.certificateType !== request.certificateType || template.academicYear && template.academicYear !== academicYear) throw new CertificateWorkflowError("Exact class/year and active template must agree.", 409);
  const graduation = request.certificateType === "GRADUATION" ? await requireGraduationReadiness(client, student.id, academicYear) : null;
  const charge = graduation ? await certificateChargeProof(client, request.id, student.id, academicYear) : null;
  const school = await client.schoolSettings.findUnique({ where: { id: "school" } });
  return { request, targetHash: snapshotHash({ request, student, enrollment, template, graduation, charge, school }) };
}

export async function uploadCertificateBatch(client: any, bytes: Uint8Array, templateId: string, actorId: string) {
  assertOperationalReleaseFeature(CERTIFICATE_BULK_FEATURE);
  const rows = await parseCertificateWorkbook(bytes), uploadDigest = sha256Bytes(bytes);
  const batchKey = snapshotHash({ uploadDigest, templateId, mapping: CERTIFICATE_MAPPING_VERSION, actorId });
  const old = await client.certificateBulkBatch.findUnique({ where: { batchKey } });
  if (old) return old;
  const checked: BulkRow[] = [];
  const seen = new Set<string>();
  for (const [index, values] of rows.entries()) {
    const row: BulkRow = { number: index + 2, values, errors: [] };
    try {
      if (values.length !== 5 || values.some(v => !v)) throw new Error("All five fields are required.");
      if (seen.has(values[0])) throw new Error("Duplicate request in workbook.");
      seen.add(values[0]);
      const t = await target(client, values, templateId);
      row.requestId = t.request.id; row.targetHash = t.targetHash;
    } catch (error) { row.errors = [error instanceof CertificateWorkflowError ? error.message : "Invalid or duplicate row. Check all five required fields."]; }
    checked.push(row);
  }
  return client.certificateBulkBatch.create({ data: { batchKey, uploadDigest, templateId, mappingVersion: CERTIFICATE_MAPPING_VERSION, rowsJson: JSON.stringify(checked), preparedBy: actorId } });
}

export async function approveCertificateBatch(client: any, id: string, actorId: string, input: any) {
  assertOperationalReleaseFeature(CERTIFICATE_BULK_FEATURE);
  return client.$transaction(async (tx: any) => {
    const batch = await tx.certificateBulkBatch.findUnique({ where: { id } });
    if (!batch || batch.status !== "VALIDATED" || batch.updatedAt.toISOString() !== input.expectedUpdatedAt || batch.uploadDigest !== input.uploadDigest || batch.mappingVersion !== CERTIFICATE_MAPPING_VERSION) throw new CertificateWorkflowError("Batch approval is stale. Upload and validate again.", 409);
    if (batch.preparedBy === actorId) throw new CertificateWorkflowError("A different authorized reviewer must approve selected rows.", 403);
    if (!Array.isArray(input.selected) || !input.selected.length || input.selected.length > 100 || new Set(input.selected).size !== input.selected.length) throw new CertificateWorkflowError("Select distinct valid rows.");
    const rows: BulkRow[] = JSON.parse(batch.rowsJson);
    for (const number of input.selected) {
      const row = rows.find(r => r.number === number);
      if (!row || row.errors.length || !row.requestId || (await target(tx, row.values, batch.templateId)).targetHash !== row.targetHash) throw new CertificateWorkflowError("A selected row is invalid or its authoritative records changed.", 409);
    }
    const changed = await tx.certificateBulkBatch.updateMany({ where: { id, updatedAt: batch.updatedAt, status: "VALIDATED" }, data: { status: "APPROVED", approvedBy: actorId, approvalJson: JSON.stringify({ uploadDigest: batch.uploadDigest, mappingVersion: batch.mappingVersion, rowsHash: snapshotHash(rows), selected: input.selected, approvedAt: new Date() }) } });
    if (changed.count !== 1) throw new CertificateWorkflowError("Batch changed concurrently.", 409);
    return tx.certificateBulkBatch.findUnique({ where: { id } });
  }, { timeout: 15000, isolationLevel: "Serializable" });
}

export async function processCertificateBatchRow(client: any, id: string, number: number, actorId: string) {
  assertOperationalReleaseFeature(CERTIFICATE_BULK_FEATURE);
  const batch = await client.certificateBulkBatch.findUnique({ where: { id } });
  if (!batch || batch.status !== "APPROVED" || !batch.approvedBy) throw new CertificateWorkflowError("An approved batch is required.", 409);
  const rows: BulkRow[] = JSON.parse(batch.rowsJson), approval = JSON.parse(batch.approvalJson);
  if (approval.uploadDigest !== batch.uploadDigest || approval.mappingVersion !== CERTIFICATE_MAPPING_VERSION || approval.rowsHash !== snapshotHash(rows) || !approval.selected.includes(number)) throw new CertificateWorkflowError("The selected row is outside this immutable approval.", 409);
  const row = rows.find(r => r.number === number)!;
  const request = await client.studentCertificateRequest.findUnique({ where: { id: row.requestId } });
  const workflowKey = `${request?.certificateType === "GRADUATION" ? "graduation" : "certificate-request"}:${row.requestId}`;
  let cert = await client.studentCertificate.findUnique({ where: { workflowKey } });
  if (cert) {
    const snapshot = JSON.parse(cert.draftDataJson), { bulkApproval, ...content } = snapshot;
    if (bulkApproval?.batchId !== id || bulkApproval?.targetHash !== row.targetHash || bulkApproval?.contentHash !== snapshotHash(content)) throw new CertificateWorkflowError("Existing draft is outside this batch approval or changed. Review it independently.", 409);
  }
  if (cert?.status === "ISSUED") return { number, status: "SUCCEEDED", certificateId: cert.id };
  if ((await target(client, row.values, batch.templateId)).targetHash !== row.targetHash) throw new CertificateWorkflowError("STALE_BULK_APPROVAL: correct and revalidate the row.", 409);
  if (!cert) cert = await client.$transaction(async (tx: any) => {
    if ((await target(tx, row.values, batch.templateId)).targetHash !== row.targetHash) throw new CertificateWorkflowError("STALE_BULK_APPROVAL", 409);
    const duplicate = await tx.studentCertificate.findFirst({ where: { requestId: request.id } });
    if (duplicate) throw new CertificateWorkflowError("Request already has a certificate; inspect its history.", 409);
    const created = await createStudentCertificateDraft(tx, { requestId: request.id, studentId: request.studentId, academicYear: request.academicYear, certificateType: request.certificateType, templateId: batch.templateId, issuePurpose: request.purpose }, batch.preparedBy);
    return tx.studentCertificate.update({ where: { id: created.id }, data: { workflowKey, draftDataJson: JSON.stringify({ ...JSON.parse(created.draftDataJson), bulkApproval: { batchId: id, targetHash: row.targetHash, contentHash: snapshotHash(JSON.parse(created.draftDataJson)) } }) } });
  });
  if (cert.status === "DRAFT") cert = await transitionCertificate(client, cert.id, "submit", batch.preparedBy, cert.updatedAt.toISOString());
  if (cert.status === "READY_FOR_REVIEW") cert = await transitionCertificate(client, cert.id, "approve", batch.approvedBy, cert.updatedAt.toISOString());
  cert = await issueCertificate(client, cert.id, actorId);
  return { number, status: "SUCCEEDED", certificateId: cert.id };
}

export async function certificateBatchResults(client: any, id: string) {
  const batch = await client.certificateBulkBatch.findUnique({ where: { id } });
  if (!batch) throw new CertificateWorkflowError("Batch not found.", 404);
  const rows: BulkRow[] = JSON.parse(batch.rowsJson), selected: number[] = batch.approvalJson ? JSON.parse(batch.approvalJson).selected : [];
  const certificates = await client.studentCertificate.findMany({ where: { requestId: { in: rows.flatMap(r => r.requestId ? [r.requestId] : []) } }, select: { id: true, requestId: true, status: true, workflowKey: true, draftDataJson: true } });
  const failures = await client.studentCertificateEvent.findMany({ where: { eventType: "CERTIFICATE_BULK_ROW_FAILED", notes: { startsWith: `${id}:` } }, orderBy: { createdAt: "desc" }, take: 100 });
  return { ...batch, rows: rows.map(row => { const cert = certificates.find((c: any) => c.workflowKey === `graduation:${row.requestId}` && JSON.parse(c.draftDataJson).bulkApproval?.batchId === id); return { ...row, certificateId: cert?.id, result: row.errors.length ? "INVALID" : !selected.includes(row.number) ? "NOT_SELECTED" : cert?.status === "ISSUED" ? "SUCCEEDED" : failures.some((e: any) => e.notes === `${id}:${row.number}`) ? "FAILED" : cert ? "IN_PROGRESS" : "NOT_ATTEMPTED" }; }) };
}
