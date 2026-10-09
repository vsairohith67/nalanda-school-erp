import { CertificateWorkflowError } from "@/lib/certificate-requests";
import { createMiscReceiptInTransaction } from "@/lib/misc-income";
import { assertGraduationEnabled } from "@/lib/certificate-graduation-policy";

export const GRADUATION_ITEM_CODE = "GRADUATION";
export async function prepareCertificateCharge(client: any, requestId: string, actorId: string) {
  assertGraduationEnabled("GRADUATION");
  return client.$transaction(async (tx: any) => {
    const request = await tx.studentCertificateRequest.findUnique({ where: { id: requestId } });
    if (!request || request.certificateType !== "GRADUATION" || !["UNDER_REVIEW", "APPROVED"].includes(request.status)) throw new CertificateWorkflowError("A reviewed Graduation request is required.", 409);
    const prior = await tx.certificateRequestCharge.findUnique({ where: { requestId } });
    if (prior) return prior;
    const item = await tx.miscIncomeItem.findUnique({ where: { itemCode: GRADUATION_ITEM_CODE }, include: { rates: { where: { academicYear: request.academicYear, status: "ACTIVE" } } } });
    if (!item || item.status !== "ACTIVE" || item.category !== "CERTIFICATE" || item.studentLinkPolicy !== "REQUIRED") throw new CertificateWorkflowError("Configure the designated Student-linked Graduation certificate item.", 409);
    const now = new Date();
    const rates = item.rates.filter((r: any) => (!r.effectiveFrom || r.effectiveFrom <= now) && (!r.effectiveTo || r.effectiveTo >= now));
    if (rates.length !== 1) throw new CertificateWorkflowError("Configure exactly one applicable academic-year Graduation rate. Unconfigured is not zero or waived.", 409);
    const rate = rates[0];
    return tx.certificateRequestCharge.create({ data: { requestId, studentId: request.studentId, academicYear: request.academicYear, preparedBy: actorId, snapshotJson: JSON.stringify({ itemId: item.id, itemCode: item.itemCode, itemName: item.name, rateId: rate.id, rateVersion: rate.updatedAt.toISOString(), amount: rate.amount.toString(), currency: "INR", quantity: 1 }) } });
  }, { isolationLevel: "Serializable" });
}

export async function approveCertificateCharge(client: any, requestId: string, actorId: string, expectedUpdatedAt: string, waiverReason?: string) {
  assertGraduationEnabled("GRADUATION");
  return client.$transaction(async (tx: any) => {
    const charge = await tx.certificateRequestCharge.findUnique({ where: { requestId } });
    if (!charge || charge.status !== "PENDING_APPROVAL" || charge.updatedAt.toISOString() !== expectedUpdatedAt) throw new CertificateWorkflowError("Charge is missing or changed; refresh its review.", 409);
    if (charge.preparedBy === actorId) throw new CertificateWorkflowError("A different authorized finance approver must approve the charge.", 403);
    const snapshot = JSON.parse(charge.snapshotJson);
    if (waiverReason !== undefined && (!waiverReason.trim() || waiverReason.length > 500)) throw new CertificateWorkflowError("A bounded waiver reason is required.");
    const status = waiverReason ? "WAIVED" : Number(snapshot.amount) === 0 ? "NO_CHARGE" : "APPROVED";
    const result = await tx.certificateRequestCharge.updateMany({ where: { id: charge.id, updatedAt: charge.updatedAt, status: "PENDING_APPROVAL" }, data: { status, approvedBy: actorId, approvedAt: new Date(), snapshotJson: JSON.stringify({ ...snapshot, ...(waiverReason ? { waiverReason } : {}) }) } });
    if (result.count !== 1) throw new CertificateWorkflowError("Charge changed concurrently.", 409);
    return tx.certificateRequestCharge.findUnique({ where: { requestId } });
  }, { isolationLevel: "Serializable" });
}

export async function collectCertificateCharge(client: any, requestId: string, actorId: string, payment: any) {
  assertGraduationEnabled("GRADUATION");
  return client.$transaction(async (tx: any) => {
    const charge = await tx.certificateRequestCharge.findUnique({ where: { requestId } });
    if (!charge) throw new CertificateWorkflowError("An approved charge is required.", 409);
    const request = await tx.studentCertificateRequest.findUnique({ where: { id: requestId } });
    if (!request || !["APPROVED", "COMPLETED"].includes(request.status)) throw new CertificateWorkflowError("Request is not approved for collection.", 409);
    if (charge.receiptId) return charge; // A lost acknowledgement never posts again.
    if (charge.status !== "APPROVED" || !charge.approvedBy) throw new CertificateWorkflowError("Charge is not approved for collection.", 409);
    const s = JSON.parse(charge.snapshotJson);
    // The authoritative service validates its current rate against this approval.
    // A changed rate requires correction, never silent repricing or a second ledger.
    const receipt = await createMiscReceiptInTransaction(tx, {
      receiptDate: payment.receiptDate, academicYear: charge.academicYear, studentId: charge.studentId,
      paymentMethod: payment.paymentMethod, receivedAccount: payment.receivedAccount,
      transactionReference: payment.transactionReference, chequeNumber: payment.chequeNumber, chequeDate: payment.chequeDate,
      lines: [{ itemId: s.itemId, quantity: 1, discountAmount: 0, expectedRateId: s.rateId, expectedRateVersion: s.rateVersion }]
    }, actorId, { requireExpectedRate: true });
    if (receipt.netAmount.toString() !== s.amount) throw new CertificateWorkflowError("Approved charge and receipt amount differ.", 409);
    const changed = await tx.certificateRequestCharge.updateMany({ where: { id: charge.id, receiptId: null, status: "APPROVED", updatedAt: charge.updatedAt }, data: { receiptId: receipt.id, status: "PAID" } });
    if (changed.count !== 1) throw new CertificateWorkflowError("Collection changed concurrently; retry to retrieve the existing receipt.", 409);
    return tx.certificateRequestCharge.findUnique({ where: { requestId } });
  }, { isolationLevel: "Serializable" });
}

export async function certificateChargeProof(tx: any, requestId: string, studentId: string, academicYear: string) {
  const charge = await tx.certificateRequestCharge.findUnique({ where: { requestId } });
  if (!charge || charge.studentId !== studentId || charge.academicYear !== academicYear || !charge.approvedBy || !["PAID", "NO_CHARGE", "WAIVED"].includes(charge.status)) throw new CertificateWorkflowError("The optional recognition charge needs approved payment, zero rate or waiver.", 409);
  if (charge.status === "PAID") {
    const receipt = await tx.miscIncomeReceipt.findUnique({ where: { id: charge.receiptId }, include: { lines: true } });
    const s = JSON.parse(charge.snapshotJson);
    if (!receipt || receipt.status !== "ACTIVE" || receipt.studentId !== studentId || receipt.academicYear !== academicYear || receipt.lines.length !== 1 || receipt.lines[0].itemId !== s.itemId || receipt.netAmount.toString() !== s.amount) throw new CertificateWorkflowError("Linked receipt requires finance correction.", 409);
  }
  return { chargeId: charge.id, receiptId: charge.receiptId, status: charge.status, rate: JSON.parse(charge.snapshotJson), approvedBy: charge.approvedBy, approvedAt: charge.approvedAt };
}
