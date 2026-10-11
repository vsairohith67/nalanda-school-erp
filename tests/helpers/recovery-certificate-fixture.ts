import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { randomBytes, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PDFDocument } from "pdf-lib";
import * as XLSX from "xlsx";
import { defaultTemplateDefinition } from "../../lib/certificate-templates";
import { createCertificateRequest, transitionCertificateRequest } from "../../lib/certificate-requests";
import { createStudentCertificateDraft, transitionCertificate, issueCertificate, createCertificateVersion, cancelIssuedCertificate } from "../../lib/student-certificates";
import { prepareCertificateCharge, approveCertificateCharge, collectCertificateCharge } from "../../lib/certificate-charges";
import { graduationReadiness } from "../../lib/certificate-graduation-policy";
import { editCertificateTemplate } from "../../lib/certificate-template-workflow";
import { renderCertificatePdf, sha256Bytes } from "../../lib/certificate-pdf";
import { issuedCertificatePdf, verifyCertificateReference } from "../../lib/certificate-authenticity";
import { certificateWorkbookTemplate } from "../../lib/certificate-workbooks";
import { uploadCertificateBatch, approveCertificateBatch, processCertificateBatchRow, certificateBatchResults } from "../../lib/certificate-bulk";
import { generateFullBackup, createBackupDocument } from "../../lib/backup";
import { parseAndValidateBackup } from "../../lib/restore";
import { restoreValidatedBackup } from "../../lib/restore-database";
import { createPersistedSession } from "../../lib/auth-sessions";
import { assertParentOwnsStudent } from "../../lib/certificate-scope";
import { restoreCertificateExtensions } from "../../lib/certificate-extension-backup";
import { hashPassword } from "../../lib/password";


// Reuses the retained PR25 service acceptance fixture; this is synthetic database/PDF evidence only.
export async function populateCertificateRecoveryFixture(db: PrismaClient) {
 const root=path.resolve("tmp/recovery-certificate-fixture");mkdirSync(root,{recursive:true});const out=mkdtempSync(path.join(root,"run-"));
  let checks = 0;
  const check = (value: unknown, message: string) => { assert.ok(value, message); checks++; };
  const denied = async (work: () => Promise<unknown>, message: string) => { await assert.rejects(work, message); checks++; };
  const actors: Record<string, any> = {}, sessions: Record<string, string> = {};
  for (const role of ["SUPER_ADMIN", "ADMIN", "PRINCIPAL", "DIRECTOR", "TEACHER", "VIEWER", "PARENT"]) {
    const user = await db.user.create({ data: { username: `synthetic-graduation-${role.toLowerCase()}`, name: `SYNTHETIC ${role}`, role, passwordHash: await hashPassword(randomBytes(32).toString("hex")) } });
    await db.userRoleAssignment.create({ data: { userId: user.id, role, reason: "SYNTHETIC CERTIFICATE QA ONLY", activeKey: `${user.id}:${role}` } });
    actors[role] = user;
  }
  const prep = actors.ADMIN.id, approve = actors.PRINCIPAL.id, issue = actors.DIRECTOR.id;
  await db.schoolSettings.update({ where: { id: "school" }, data: { schoolName: "NALANDA PUBLIC SCHOOL", city: "SYNTHETIC ISSUE PLACE", addressLine1: "SYNTHETIC DOCUMENT QA ONLY", phone: "0000000000" } });
  const template = await db.certificateTemplate.create({ data: { templateCode: "SYNTHETIC-GRADUATION", certificateType: "GRADUATION", name: "SYNTHETIC Graduation Recognition", status: "ACTIVE", academicYear: "2026-27", templateDefinitionJson: JSON.stringify(defaultTemplateDefinition("GRADUATION")), createdByUserId: prep, activatedByUserId: approve } });
  await db.certificateNumberSeries.create({ data: { seriesCode: "SYNTHETIC-GRAD", certificateType: "GRADUATION", academicYear: "2026-27", prefix: "SYNTHETIC-GRAD-", nextNumber: 1 } });
  const item = await db.miscIncomeItem.create({ data: { itemCode: "GRADUATION", name: "SYNTHETIC Graduation rate", category: "CERTIFICATE", studentLinkPolicy: "REQUIRED" } });
  const rate = await db.miscIncomeRate.create({ data: { itemId: item.id, academicYear: "2026-27", amount: "125", notes: "SYNTHETIC TEST RATE ONLY - NOT SCHOOL POLICY" } });
  async function fixture(suffix: string, withEvidence = true) {
    const student = await db.student.create({ data: { admissionNo: `SYNTHETIC-GRAD-${suffix}`, studentName: `SYNTHETIC STUDENT ${suffix}`, fatherName: "SYNTHETIC GUARDIAN", phone1: "0000000000", className: "X" } });
    const enrollment = await db.academicYearEnrollment.create({ data: { studentId: student.id, academicYear: "2026-27", className: "X", status: "PASSED_OUT" } });
    if (withEvidence) await db.studentProgressionDecision.create({ data: { studentId: student.id, sourceEnrollmentId: enrollment.id, academicYear: "2026-27", decisionType: "PASSED_OUT", fromClass: "X", toStatus: "Passed Out", status: "FINALIZED", evidenceNotes: "SYNTHETIC reviewed school completion; no Board claim", finalizedByUserId: approve, finalizedAt: new Date(), effectiveDate: new Date() } });
    return student;
  }
  async function requestFor(student: any) {
    const input = { studentId: student.id, academicYear: "2026-27", certificateType: "GRADUATION", purpose: "SYNTHETIC SCHOOL RECOGNITION ONLY", idempotencyKey: randomUUID() };
    let request = await createCertificateRequest(db, input, { id: prep });
    check((await createCertificateRequest(db, input, { id: prep })).id === request.id, "Request retry idempotent");
    request = await transitionCertificateRequest(db, request.id, "review", prep);
    await denied(() => transitionCertificateRequest(db, request.id, "approve", prep), "Request self-approval denied");
    request = await transitionCertificateRequest(db, request.id, "approve", approve);
    let charge = await prepareCertificateCharge(db, request.id, prep);
    await denied(() => approveCertificateCharge(db, request.id, prep, charge.updatedAt.toISOString()), "Charge self-approval denied");
    charge = await approveCertificateCharge(db, request.id, issue, charge.updatedAt.toISOString());
    const pay = { receiptDate: new Date().toISOString().slice(0, 10), paymentMethod: "CASH" };
    const paid = await collectCertificateCharge(db, request.id, issue, pay);
    check((await collectCertificateCharge(db, request.id, issue, pay)).receiptId === paid.receiptId, "Collection retry reuses receipt");
    return request;
  }
  const missing = await fixture("NO-EVIDENCE", false);
  check(!(await graduationReadiness(db, missing.id, "2026-27")).ready, "Enrollment alone never establishes completion");
  check(!(await graduationReadiness(db, missing.id, "2025-26")).ready, "Wrong year refused");
  const student = await fixture("LONG-NAME-" + "A".repeat(100)), request = await requestFor(student);
  let cert = await createStudentCertificateDraft(db, { studentId: student.id, academicYear: "2026-27", certificateType: "GRADUATION", requestId: request.id, templateId: template.id, purpose: request.purpose }, prep);
  check((await createStudentCertificateDraft(db, { studentId: student.id, academicYear: "2026-27", certificateType: "GRADUATION", requestId: request.id, templateId: template.id, purpose: request.purpose }, prep)).id === cert.id, "Draft retry idempotent");
  const draft = await renderCertificatePdf(JSON.parse(cert.draftDataJson), "DRAFT"); writeFileSync(path.join(out, "synthetic-draft.pdf"), draft.pdf);
  check((await PDFDocument.load(draft.pdf)).getPageCount() > 0, "Draft is a parseable PDF");
  const long = JSON.parse(cert.draftDataJson); long.template.definition.body = "SYNTHETIC school completion recognition. ".repeat(90); long.template.definition.disclaimer += " Additional institutional recognition wording. ".repeat(25);
  const overflow = await renderCertificatePdf(long, "DRAFT"); writeFileSync(path.join(out, "synthetic-long-draft.pdf"), overflow.pdf); check(overflow.pages > 1, "Long wording paginates");
  const edited = await editCertificateTemplate(db, template.id, { expectedUpdatedAt: template.updatedAt.toISOString(), definition: { ...defaultTemplateDefinition("GRADUATION"), body: "School recognizes {{studentName}} in {{academicYear}}." } }, prep);
  check(edited.id !== template.id && edited.status === "DRAFT", "Approved template edit creates separate draft version");
  check((await db.certificateTemplate.findUniqueOrThrow({ where: { id: template.id } })).templateDefinitionJson === template.templateDefinitionJson, "Original template immutable");
  await denied(() => editCertificateTemplate(db, edited.id, { expectedUpdatedAt: edited.updatedAt.toISOString(), status: "ACTIVE" }, prep), "Template author activation denied");
  await denied(() => editCertificateTemplate(db, edited.id, { expectedUpdatedAt: edited.updatedAt.toISOString(), status: "ACTIVE", name: "SYNTHETIC changed by approver" }, approve), "Simultaneous edit and activation denied");
  cert = await transitionCertificate(db, cert.id, "submit", prep);
  await denied(() => transitionCertificate(db, cert.id, "approve", prep), "Draft self-approval denied");
  cert = await transitionCertificate(db, cert.id, "approve", approve);
  const receiptsBefore = await db.miscIncomeReceipt.count();
  const attempts = await Promise.allSettled([issueCertificate(db, cert.id, issue), issueCertificate(db, cert.id, issue)]);
  if (!attempts.some(r => r.status === "fulfilled")) console.error(attempts);
  check(attempts.some(r => r.status === "fulfilled"), "Concurrent issue obtains one result");
  cert = await issueCertificate(db, cert.id, issue);
  check(await db.studentCertificateVersion.count({ where: { certificateId: cert.id } }) === 1, "Concurrent/lost-ack issue stores exactly one version");
  const pdf = await issuedCertificatePdf(db, cert.id); writeFileSync(path.join(out, "synthetic-issued.pdf"), pdf);
  const artifact = await db.certificateIssueArtifact.findFirstOrThrow({ where: { certificateId: cert.id } });
  check(JSON.parse(artifact.renderProvenanceJson).fontFamily === "Georgia Bold", "Font provenance retained");
  check(sha256Bytes(await issuedCertificatePdf(db, cert.id)) === sha256Bytes(pdf), "Reprint returns identical bytes");
  check(await db.miscIncomeReceipt.count() === receiptsBefore, "PDF, issue retry and reprint create no finance rows");
  await db.miscIncomeRate.create({ data: { itemId: item.id, academicYear: "2027-28", amount: "999", notes: "SYNTHETIC NEXT YEAR ONLY" } });
  check(JSON.parse((await db.certificateRequestCharge.findUniqueOrThrow({ where: { requestId: request.id } })).snapshotJson).amount === "125", "Charged rate snapshot survives next year config");
  const revision = await createCertificateVersion(db, cert.id, "REISSUE", prep, "SYNTHETIC governed replacement");
  check(revision.status === "DRAFT" && revision.supersedesCertificateId === cert.id, "Reissue creates linked draft requiring review");
  await transitionCertificate(db, revision.id, "submit", prep); await transitionCertificate(db, revision.id, "approve", approve); await issueCertificate(db, revision.id, issue);
  check(await db.miscIncomeReceipt.count() === receiptsBefore, "Reissue reuses charge without posting");
  await cancelIssuedCertificate(db, cert.id, issue, "SYNTHETIC void acceptance");
  await denied(() => issuedCertificatePdf(db, cert.id), "Void active download denied while bytes retained");
  check(await db.certificateIssueArtifact.count({ where: { certificateId: cert.id } }) === 1, "Void retains original artifact");
  check((await verifyCertificateReference(db, "unknown")).status === "UNAVAILABLE", "Unknown token has bounded safe result");
  const fakeToken = randomBytes(32).toString("base64url"), fakeSnapshot = JSON.stringify({synthetic:true});
  const fake:any = {certificateIssueArtifact:{findUnique:async()=>({versionId:"synthetic-v1",certificateId:"synthetic-c1",snapshotHash:sha256Bytes(fakeSnapshot),expiresAt:new Date("2099-01-01")})},studentCertificate:{findUnique:async()=>({id:"synthetic-c1",status:"ISSUED",currentVersionNumber:2}),findFirst:async()=>null},studentCertificateVersion:{findUnique:async()=>({certificateId:"synthetic-c1",versionNumber:1,snapshotJson:fakeSnapshot,snapshotHash:sha256Bytes(fakeSnapshot)})}};
  check((await verifyCertificateReference(fake,fakeToken)).status === "SUPERSEDED","Older legacy version token cannot authenticate after flag-off revision");
  check((await verifyCertificateReference(fake,fakeToken,new Date("2100-01-01"))).status === "UNAVAILABLE","Expired reference has bounded safe response");
  const bulkStudent = await fixture("BULK"), bulkRequest = await requestFor(bulkStudent);
  const wb = XLSX.read(certificateWorkbookTemplate());
  XLSX.utils.sheet_add_aoa(wb.Sheets.Certificates, [[bulkRequest.requestNumber, bulkStudent.admissionNo, bulkStudent.studentName, "2026-27", "X"], ["SYNTHETIC-UNKNOWN", "SYNTHETIC-NO-MATCH", "SYNTHETIC WRONG", "2026-27", "X"]], { origin: "A2" });
  const xlsx = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }); writeFileSync(path.join(out, "synthetic-bulk.xlsx"), xlsx);
  let batch = await uploadCertificateBatch(db, xlsx, template.id, prep);
  check(JSON.parse(batch.rowsJson)[1].errors.length === 1, "Invalid row has explicit error");
  await denied(() => approveCertificateBatch(db, batch.id, approve, { selected: [3], expectedUpdatedAt: batch.updatedAt.toISOString(), uploadDigest: batch.uploadDigest }), "Invalid row cannot be approved");
  await denied(() => approveCertificateBatch(db, batch.id, approve, { selected: [2], expectedUpdatedAt: batch.updatedAt.toISOString(), uploadDigest: "stale" }), "Digest stale approval refused");
  batch = await approveCertificateBatch(db, batch.id, approve, { selected: [2], expectedUpdatedAt: batch.updatedAt.toISOString(), uploadDigest: batch.uploadDigest });
  const beforeBulk = await db.miscIncomeReceipt.count();
  const bulkResult = await processCertificateBatchRow(db, batch.id, 2, issue);
  check((await processCertificateBatchRow(db, batch.id, 2, issue)).certificateId === bulkResult.certificateId, "Bulk resume does not reissue success");
  check(await db.miscIncomeReceipt.count() === beforeBulk, "Bulk resume does not collect again");
  check((await certificateBatchResults(db, batch.id)).rows[0].result === "SUCCEEDED", "Bulk results identify approved successful row");
  async function reviewedBatch(suffix: string) {
    const candidate = await fixture(suffix), request = await requestFor(candidate);
    const workbook = XLSX.read(certificateWorkbookTemplate()); XLSX.utils.sheet_add_aoa(workbook.Sheets.Certificates, [[request.requestNumber, candidate.admissionNo, candidate.studentName, "2026-27", "X"]], {origin:"A2"});
    let batch = await uploadCertificateBatch(db, XLSX.write(workbook, {type:"buffer",bookType:"xlsx"}), template.id, prep);
    batch = await approveCertificateBatch(db,batch.id,approve,{selected:[2],expectedUpdatedAt:batch.updatedAt.toISOString(),uploadDigest:batch.uploadDigest});
    return {candidate, request, batch};
  }
  const stale = await reviewedBatch("STALE");
  await db.student.update({where:{id:stale.candidate.id},data:{studentName:"SYNTHETIC CHANGED AFTER APPROVAL"}});
  await denied(() => processCertificateBatchRow(db,stale.batch.id,2,issue), "Changed target invalidates bulk approval");
  check(await db.studentCertificate.count({where:{requestId:stale.request.id}}) === 0, "Stale approval creates no issue");
  const interrupted = await reviewedBatch("INTERRUPTED");
  const beforeFailure = {receipts:await db.miscIncomeReceipt.count(),versions:await db.studentCertificateVersion.count()};
  const originalGeorgiaPath = process.env.CERTIFICATE_GEORGIA_BOLD_PATH;
  process.env.CERTIFICATE_GEORGIA_BOLD_PATH = path.join(out,"missing-font.ttf");
  try { await denied(() => processCertificateBatchRow(db,interrupted.batch.id,2,issue), "Missing Georgia interrupts PDF without issuing"); } finally {
    if (originalGeorgiaPath === undefined) delete process.env.CERTIFICATE_GEORGIA_BOLD_PATH; else process.env.CERTIFICATE_GEORGIA_BOLD_PATH = originalGeorgiaPath;
  }
  check(await db.studentCertificateVersion.count() === beforeFailure.versions && await db.miscIncomeReceipt.count() === beforeFailure.receipts, "Failed PDF creates neither issue nor collection");
  const resumed = await processCertificateBatchRow(db,interrupted.batch.id,2,issue);
  check((await processCertificateBatchRow(db,interrupted.batch.id,2,issue)).certificateId === resumed.certificateId, "Interrupted approved draft resumes exactly once");
  for (const type of ["BONAFIDE","STUDY","CONDUCT","TRANSFER"] as const) {
    const t = await db.certificateTemplate.create({data:{templateCode:`SYNTHETIC-${type}-PDF`,name:`SYNTHETIC ${type}`,certificateType:type,status:"ACTIVE",templateDefinitionJson:JSON.stringify(defaultTemplateDefinition(type)),createdByUserId:prep,activatedByUserId:approve}});
    await db.certificateNumberSeries.create({data:{seriesCode:`SYNTHETIC-${type}`,certificateType:type,academicYear:"2026-27",prefix:`SYNTHETIC-${type}-`,nextNumber:1,paddingLength:4,status:"ACTIVE",isDefault:true}});
    let c = await createStudentCertificateDraft(db,{studentId:student.id,academicYear:"2026-27",certificateType:type,templateId:t.id,issuePurpose:"SYNTHETIC reusable PDF acceptance"},prep);
    await transitionCertificate(db,c.id,"submit",prep);await transitionCertificate(db,c.id,"approve",approve);c=await issueCertificate(db,c.id,issue);
    const bytes = await issuedCertificatePdf(db,c.id);writeFileSync(path.join(out,`synthetic-${type.toLowerCase()}.pdf`),bytes);
    check(sha256Bytes(bytes) === sha256Bytes(await issuedCertificatePdf(db,c.id)), `${type} retained PDF is byte-stable`);
  }
  const guardian = await db.guardian.create({ data: { displayName: "SYNTHETIC PARENT", primaryMobile: "0000000000" } });
  await db.studentGuardian.create({ data: { studentId: bulkStudent.id, guardianId: guardian.id } });
  actors.PARENT = await db.user.update({ where: { id: actors.PARENT.id }, data: { guardianId: guardian.id } });
  await assertParentOwnsStudent(db, { ...actors.PARENT, guardianId: guardian.id }, bulkStudent.id); checks++;
  await denied(() => assertParentOwnsStudent(db, { ...actors.PARENT, guardianId: guardian.id }, student.id), "Unrelated Parent denied");
  const pendingTemplate = await db.certificateTemplate.create({data:{templateCode:"SYNTHETIC-RESTORE-DRAFT",certificateType:"GRADUATION",name:"SYNTHETIC pending template",status:"DRAFT",templateDefinitionJson:JSON.stringify(defaultTemplateDefinition("GRADUATION")),createdByUserId:prep}});

 return {original:cert.id,replacement:revision.id,artifactId:artifact.id,checks};
}
