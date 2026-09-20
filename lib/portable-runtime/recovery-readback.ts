import assert from "node:assert/strict";
import { Prisma, type PrismaClient } from "@prisma/client";
import type { ValidatedBackup } from "../restore";
import { recoveryHash } from "./recovery-handoff";
import {decryptMfaSecret} from "../real-user-access/crypto";

/** Check decryptability before any database/object-store writes. Equality of
 * ciphertext alone cannot establish usable recovery of private income data. */
export function assertRecoveryPrivacyKeys(backup:ValidatedBackup){
 for(const row of backup.priorYearIncomeSupports){
  if(!row.exactAmountEnvelope)continue;
  try{assert(typeof row.exactAmountEnvelope==="string");const amount=decryptMfaSecret(row.exactAmountEnvelope,`prior-year-income:${row.caseId}`);const number=new Prisma.Decimal(amount);assert(number.isFinite()&&number.gte(0)&&number.decimalPlaces()<=2);}
  catch{throw Error("RECOVERY_PRIVATE_DATA_KEY_CUSTODY_REQUIRED");}
 }
}

export async function assertEmptyRecoveryDatabase(db: PrismaClient) {
  // PostgreSQL migrations create no reference rows. Inspect every model, not
  // merely students; an orphan audit or authority row also refuses restoration.
  for (const model of Prisma.dmmf.datamodel.models) {
    const delegate = model.name[0].toLowerCase() + model.name.slice(1);
    if (await (db as any)[delegate].count() !== 0) throw Error("RECOVERY_DESTINATION_NOT_EMPTY");
  }
}

export async function assertRecoveryReadback(db: PrismaClient, backup: ValidatedBackup) {
  assertRecoveryPrivacyKeys(backup);
  const data = backup as unknown as Record<string, any>;
  const number = (value: unknown) => new Prisma.Decimal(String(value ?? 0));
  const total = (rows: any[], key: string) => rows.reduce((sum, row) => sum.plus(number(row[key])), new Prisma.Decimal(0)).toFixed(2);
  const payments = await db.payment.findMany();
  assert.equal(payments.length, data.payments.length, "RECOVERY_PAYMENT_COUNT");
  assert.equal(total(payments, "amountPaid"), total(data.payments, "amountPaid"), "RECOVERY_PAYMENT_BALANCE");
  assert.equal(await db.student.count(), data.students.length, "RECOVERY_STUDENT_COUNT");
  for (const original of data.students) {
    const student = await db.student.findFirstOrThrow({ where: { admissionNo: original.admissionNo, academicYear: original.academicYear } });
    assert.equal(student.studentName, original.studentName);
    assert.equal(String(student.discountPercent), String(original.discountPercent ?? 0));
    for (const payment of payments.filter(p => p.admissionNo === original.admissionNo)) assert.equal(payment.studentId, student.id, "RECOVERY_PAYMENT_OWNERSHIP");
    for (const [collection,delegate] of [["studentCertificateRequests","studentCertificateRequest"],["studentCertificates","studentCertificate"],["studentItemReceiptSnapshots","studentItemReceiptSnapshot"],["priorYearLiabilities","priorYearLiability"]]) {
      for (const row of data[collection].filter((r:any)=>r.studentId===original.id)) {
        const restored=await (db as any)[delegate].findUniqueOrThrow({where:{id:row.id}});
        assert.equal(restored.studentId,student.id,"RECOVERY_STUDENT_OWNERSHIP");
        if(collection==="studentCertificateRequests")assert.equal(restored.applicantGuardianId,row.applicantGuardianId??null,"RECOVERY_GUARDIAN_OWNERSHIP");
      }
    }
  }
  const immutable = {
    certificateIssueArtifacts: ["certificateIssueArtifact", ["certificateId","versionId","pdfHash","pdfBase64","snapshotHash"]],
    studentCertificateVersions: ["studentCertificateVersion", ["certificateId","versionNumber","versionType","snapshotJson"]],
    studentCertificates: ["studentCertificate", ["status","supersedesCertificateId","certificateNumber"]],
    studentCertificateEvents: ["studentCertificateEvent", ["certificateId","versionId","eventType"]],
    certificateRequestCharges: ["certificateRequestCharge", ["requestId","status","amount","receiptId"]],
    miscIncomeReceipts: ["miscIncomeReceipt", ["receiptNumber","grossAmount","discountAmount","netAmount","academicYear","status"]],
    miscIncomeReceiptLines: ["miscIncomeReceiptLine", ["receiptId","itemId","rateId","quantity","unitAmount","lineTotal"]],
    studentItemReceiptSnapshots: ["studentItemReceiptSnapshot", ["receiptId","academicYear","admissionNo","studentName","className","section","linesJson"]],
    priorYearLiabilities: ["priorYearLiability", ["sourceYear","operatingYear","openingAmount","existingCredits","status","version"]],
    priorYearConcessionCases: ["priorYearConcessionCase", ["liabilityId","kind","status","requestedAmount","approvedAmount","appliedVersion","version","scopeJson","balanceHash","appliedBalanceHash"]],
    priorYearIncomeSupports: ["priorYearIncomeSupport", ["caseId","status","bandId","exactAmountEnvelope"]],
    priorYearPaymentAttributions: ["priorYearPaymentAttribution", ["liabilityId","sourceYear","provenance"]],
    priorYearConcessionEvents: ["priorYearConcessionEvent", ["caseId","liabilityId","eventType","previousState","newState","amount","reversesEventId","requestHash","requestKey","balanceHash"]]
  } as const;
  const counts: Record<string, number> = {};
  for (const [collection, [delegate, fields]] of Object.entries(immutable)) {
    const rows = data[collection];
    assert(Array.isArray(rows), "RECOVERY_COLLECTION_MISSING");
    assert.equal(await (db as any)[delegate].count(), rows.length, "RECOVERY_HISTORY_COUNT");
    for (const original of rows) {
      const restored = await (db as any)[delegate].findUniqueOrThrow({ where: { id: original.id } });
      const expected = collection === "priorYearIncomeSupports" && original.expiresAt && new Date(original.expiresAt) <= new Date()
        ? { ...original, status: "NOT_PROVIDED", bandId: null, exactAmountEnvelope: null } : original;
      for (const field of fields) if (Object.hasOwn(original, field)) {
        assert(Object.hasOwn(restored, field), "RECOVERY_FIELD_MISSING");
        const normalize = (v: any) => v == null ? "" : /Amount$|^amount$|^existingCredits$|^lineTotal$/.test(field) ? number(v).toFixed(2) : String(v);
        assert.equal(normalize(restored[field]), normalize(expected[field]), "RECOVERY_HISTORY_CHANGED");
      }
      if (collection === "certificateIssueArtifacts") assert.equal(recoveryHash(Buffer.from(restored.pdfBase64, "base64")), restored.pdfHash, "RECOVERY_PDF_HASH");
    }
    counts[collection] = rows.length;
  }
  assert.equal(await db.nativeSession.count({ where: { revokedAt: null } }), 0, "RECOVERY_NATIVE_SESSION_ACTIVE");
  assert.equal(await db.authSession.count({where:{revokedAt:null}}),0,"RECOVERY_AUTH_SESSION_ACTIVE");
  assert.equal(await db.user.count(),0,"RECOVERY_LOGIN_ACCOUNT_RECREATED");
  assert.equal(await db.cloudBackupProfile.count({ where: { liveUseEnabled: true } }), 0, "RECOVERY_PROVIDER_ACTIVE");
  assert.equal(await db.whatsAppIntegrationProfile.count({where:{liveSendingEnabled:true}}),0,"RECOVERY_WHATSAPP_ACTIVE");
  assert.equal(await db.smsEmailIntegrationProfile.count({where:{liveSendingEnabled:true}}),0,"RECOVERY_SMS_EMAIL_ACTIVE");
  assert.equal(await db.communicationProviderProfile.count({where:{operationalEnabled:true}}),0,"RECOVERY_COMMUNICATION_ACTIVE");
  return { students: data.students.length, payments: payments.length, paymentTotal: total(payments, "amountPaid"), counts };
}
