import type { PrismaClient } from "@prisma/client";
import { normalizeCode } from "@/lib/certificate-templates";
import { allocateIdentityCardNumber } from "@/lib/id-card-numbering";
import { buildIdentityCardSourceSnapshot } from "@/lib/id-card-snapshots";
import { snapshotHash } from "@/lib/certificate-snapshots";
import { isIdentityCardType, parseIdentityCardTemplate, type IdentityCardType } from "@/lib/id-card-templates";
import { schoolDateKey } from "@/lib/format";
import { IdentityCardWorkflowError } from "@/lib/identity-cards";

function calendarDate(value: unknown, label: string) {
  const raw = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new IdentityCardWorkflowError(`${label} must be a calendar date.`);
  const date = new Date(`${raw}T00:00:00.000Z`);
  if (date.toISOString().slice(0, 10) !== raw) throw new IdentityCardWorkflowError(`${label} is invalid.`);
  return date;
}

export async function createIdentityCardBatch(client: PrismaClient, input: any, actorId: string) {
  const cardType = String(input?.cardType ?? "").toUpperCase();
  if (!isIdentityCardType(cardType)) throw new IdentityCardWorkflowError("Card type must be STUDENT or STAFF.");
  const scopeType = String(input?.scopeType ?? "");
  const allowed = cardType === "STUDENT" ? ["CLASS_SECTION", "ACTIVE_STUDENTS", "CUSTOM"] : ["ACTIVE_STAFF", "STAFF_DESIGNATION", "CUSTOM"];
  if (!allowed.includes(scopeType)) throw new IdentityCardWorkflowError("Choose a supported scope for this card type.");
  const className = String(input?.className ?? "").trim();
  const section = String(input?.section ?? "").trim();
  const staffDesignation = String(input?.staffDesignation ?? "").trim();
  if (scopeType === "CLASS_SECTION" && (!className || !section)) throw new IdentityCardWorkflowError("Exact class and section are required for this scope.");
  if (scopeType === "STAFF_DESIGNATION" && !staffDesignation) throw new IdentityCardWorkflowError("Exact staff designation is required for this scope.");
  const academicYear = String(input?.academicYear ?? "").trim() || null;
  const validFrom = calendarDate(input?.validFrom, "Valid from"), validUntil = calendarDate(input?.validUntil, "Valid until");
  if (validUntil < validFrom) throw new IdentityCardWorkflowError("Valid-until date cannot precede valid-from date.");
  const suffix = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const batchNumber = input?.batchNumber ? normalizeCode(input.batchNumber, "Batch number") : `IDB-${cardType}-${suffix}`;
  return client.$transaction(async (tx) => {
    const template = await tx.identityCardTemplate.findUnique({ where: { id: String(input?.templateId ?? "") } });
    if (!template || template.status !== "ACTIVE" || template.cardType !== cardType || (template.academicYear && template.academicYear !== academicYear)) throw new IdentityCardWorkflowError("Choose an applicable active template.");
    const row = await tx.identityCardBatch.create({ data: { batchNumber, cardType, academicYear, templateId: template.id, scopeType, className: className || null, section: section || null, staffDesignation: staffDesignation || null, validFrom, validUntil, notes: String(input?.notes ?? "").trim() || null, createdByUserId: actorId } });
    await tx.identityCardEvent.create({ data: { batchId: row.id, eventType: "BATCH_CREATED", newStatus: "DRAFT", recordedByUserId: actorId } });
    return row;
  });
}

async function batchCandidates(client: PrismaClient | any, batch: any) {
  if (batch.cardType === "STUDENT") {
    const enrollments = await client.academicYearEnrollment.findMany({
      where: {
        academicYear: batch.academicYear,
        ...(batch.scopeType === "CLASS_SECTION" ? { className: batch.className, section: batch.section } : {})
      },
      select: { studentId: true, className: true, section: true, status: true, student: { select: { studentName: true, admissionNo: true, deletedAt: true } } },
      orderBy: [{ className: "asc" }, { section: "asc" }, { student: { studentName: "asc" } }]
    });
    return enrollments.map((row: any) => {
      const reason = row.student.deletedAt ? "Student is deleted" : row.status !== "ACTIVE" ? `Enrollment is ${row.status}` : null;
      return { key: row.studentId, studentId: row.studentId, label: row.student.studentName, code: row.student.admissionNo, className: row.className, section: row.section, eligible: !reason, reason };
    });
  }
  const rows = await client.staffMember.findMany({
    where: { ...(batch.scopeType === "STAFF_DESIGNATION" ? { designation: batch.staffDesignation } : {}) },
    select: { id: true, fullName: true, staffCode: true, designation: true, status: true },
    orderBy: { fullName: "asc" }
  });
  return rows.map((row: any) => ({ key: row.id, staffMemberId: row.id, label: row.fullName, code: row.staffCode, designation: row.designation, eligible: row.status === "ACTIVE", reason: row.status === "ACTIVE" ? null : `Staff status is ${row.status}` }));
}

export async function previewIdentityCardBatch(client: PrismaClient, id: string, actorId: string) {
  return client.$transaction(async (tx) => {
    const batch = await tx.identityCardBatch.findUnique({ where: { id }, include: { template: true } });
    if (!batch) throw new IdentityCardWorkflowError("ID-card batch not found.", 404);
    if (!["DRAFT", "PREVIEWED"].includes(batch.status)) throw new IdentityCardWorkflowError("Only a draft batch can be previewed.", 409);
    const rows = await batchCandidates(tx, batch);
    const existing = await tx.identityCard.findMany({
      where: { cardType: batch.cardType, academicYear: batch.academicYear, status: "ISSUED", validUntil: { gte: new Date(`${schoolDateKey()}T00:00:00.000Z`) }, OR: batch.cardType === "STUDENT" ? [{ studentId: { in: rows.map((row: any) => row.studentId).filter(Boolean) } }] : [{ staffMemberId: { in: rows.map((row: any) => row.staffMemberId).filter(Boolean) } }] },
      select: { studentId: true, staffMemberId: true }
    });
    const existingKeys = new Set(existing.map((row) => row.studentId ?? row.staffMemberId));
    const preview = rows.map((row: any) => existingKeys.has(row.key) ? { ...row, eligible: false, reason: "Existing active ID card" } : row);
    const eligibleCount = preview.filter((row: any) => row.eligible).length;
    const safeSnapshot = preview.map(({ key: _key, studentId: _studentId, staffMemberId: _staffMemberId, ...row }: any) => ({ ...row, identityRef: _studentId ?? _staffMemberId }));
    const updated = await tx.identityCardBatch.update({ where: { id }, data: { status: "PREVIEWED", expectedCount: preview.length, eligibleCount, skippedCount: preview.length - eligibleCount, scopeSnapshotJson: JSON.stringify(safeSnapshot) } });
    await tx.identityCardEvent.create({ data: { batchId: id, eventType: "BATCH_PREVIEWED", previousStatus: batch.status, newStatus: "PREVIEWED", notes: `${eligibleCount} eligible; ${preview.length - eligibleCount} skipped`, recordedByUserId: actorId } });
    return { batch: updated, rows: preview.map(({ key: _key, ...row }: any) => row) };
  });
}

export async function approveIdentityCardBatch(client: PrismaClient, id: string, actorId: string, expectedUpdatedAt?: string) {
  return client.$transaction(async (tx) => {
    const row = await tx.identityCardBatch.findUnique({ where: { id } });
    if (!row) throw new IdentityCardWorkflowError("ID-card batch not found.", 404);
    if (row.status !== "PREVIEWED" || !row.scopeSnapshotJson) throw new IdentityCardWorkflowError("Preview the exact batch scope before approval.", 409);
    if (expectedUpdatedAt && row.updatedAt.toISOString() !== expectedUpdatedAt) throw new IdentityCardWorkflowError("Batch changed since it was opened.", 409);
    const changed = await tx.identityCardBatch.updateMany({ where: { id, status: "PREVIEWED", updatedAt: row.updatedAt }, data: { status: "APPROVED", approvedByUserId: actorId, approvedAt: new Date() } });
    if (changed.count !== 1) throw new IdentityCardWorkflowError("Batch changed concurrently.", 409);
    await tx.identityCardEvent.create({ data: { batchId: id, eventType: "BATCH_APPROVED", previousStatus: "PREVIEWED", newStatus: "APPROVED", recordedByUserId: actorId } });
    return tx.identityCardBatch.findUnique({ where: { id } });
  });
}

export async function issueIdentityCardBatch(prisma: PrismaClient, id: string, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const batch = await tx.identityCardBatch.findUnique({ where: { id }, include: { template: true } });
    if (!batch) throw new IdentityCardWorkflowError("ID-card batch not found.", 404);
    if (batch.status === "ISSUED") return { batch, idempotent: true, issued: batch.issuedCount, skipped: batch.skippedCount };
    if (batch.status !== "APPROVED" || !batch.scopeSnapshotJson) throw new IdentityCardWorkflowError("Only an approved previewed batch can be issued.", 409);
    if (batch.template.status !== "ACTIVE") throw new IdentityCardWorkflowError("The batch template is inactive.", 409);
    const current = await batchCandidates(tx, batch);
    const approvedRefs = new Set((JSON.parse(batch.scopeSnapshotJson) as any[]).map((row) => row.identityRef));
    const currentRefs = new Set(current.map((row: any) => row.key));
    if ([...approvedRefs].some((ref) => !currentRefs.has(ref))) throw new IdentityCardWorkflowError("Batch eligibility changed after approval. Preview and approve a new batch.", 409);
    const existing = await tx.identityCard.findMany({ where: { cardType: batch.cardType, academicYear: batch.academicYear, status: "ISSUED", validUntil: { gte: new Date(`${schoolDateKey()}T00:00:00.000Z`) } }, select: { studentId: true, staffMemberId: true } });
    const existingKeys = new Set(existing.map((row) => row.studentId ?? row.staffMemberId));
    const selected = current.filter((row: any) => approvedRefs.has(row.key) && row.eligible && !existingKeys.has(row.key));
    const parsedTemplate = parseIdentityCardTemplate(batch.template);
    const results: any[] = [];
    for (const candidate of selected) {
      const fresh = await buildIdentityCardSourceSnapshot(tx, { cardType: batch.cardType as IdentityCardType, studentId: candidate.studentId, staffMemberId: candidate.staffMemberId, academicYear: batch.academicYear, validFrom: batch.validFrom, validUntil: batch.validUntil }, batch.template);
      const allocation = await allocateIdentityCardNumber(tx, batch.cardType as IdentityCardType, batch.academicYear);
      const now = new Date();
      const card = await tx.identityCard.create({ data: { cardType: batch.cardType, batchId: id, templateId: batch.templateId, numberSeriesId: allocation.seriesId, studentId: candidate.studentId ?? null, staffMemberId: candidate.staffMemberId ?? null, academicYear: batch.academicYear, cardNumber: allocation.cardNumber, validFrom: batch.validFrom, validUntil: batch.validUntil, status: "ISSUED", currentVersionNumber: 1, draftDataJson: JSON.stringify(fresh), templateSnapshotJson: JSON.stringify(parsedTemplate), createdByUserId: actorId, approvedByUserId: actorId, issuedByUserId: actorId, approvedAt: now, issuedAt: now } });
      const snapshot = { ...fresh, cardNumber: allocation.cardNumber, status: "ACTIVE", versionNumber: 1, versionType: "ORIGINAL", barcodeEnabled: batch.template.barcodeEnabled };
      const version = await tx.identityCardVersion.create({ data: { identityCardId: card.id, versionNumber: 1, versionType: "ORIGINAL", cardNumber: allocation.cardNumber, snapshotJson: JSON.stringify(snapshot), issuedAt: now, issuedByUserId: actorId, snapshotHash: snapshotHash(snapshot) } });
      await tx.identityCardEvent.create({ data: { batchId: id, identityCardId: card.id, versionId: version.id, eventType: "CARD_ISSUED", previousStatus: "APPROVED", newStatus: "ISSUED", recordedByUserId: actorId } });
      results.push({ cardNumber: allocation.cardNumber, label: candidate.label });
    }
    const skipped = current.length - results.length;
    const updated = await tx.identityCardBatch.update({ where: { id }, data: { status: "ISSUED", issuedCount: results.length, skippedCount: skipped, resultSnapshotJson: JSON.stringify(results), issuedByUserId: actorId, issuedAt: new Date() } });
    await tx.identityCardEvent.create({ data: { batchId: id, eventType: "BATCH_ISSUED", previousStatus: "APPROVED", newStatus: "ISSUED", notes: `${results.length} issued; ${skipped} skipped`, recordedByUserId: actorId } });
    return { batch: updated, idempotent: false, issued: results.length, skipped, results };
  });
}

export async function cancelIdentityCardBatch(client: PrismaClient, id: string, actorId: string, reason: string) {
  if (!String(reason).trim()) throw new IdentityCardWorkflowError("Batch cancellation reason is required.");
  return client.$transaction(async (tx) => {
    const row = await tx.identityCardBatch.findUnique({ where: { id } });
    if (!row || !["DRAFT", "PREVIEWED"].includes(row.status)) throw new IdentityCardWorkflowError("Only an unapproved batch can be cancelled.", 409);
    const changed = await tx.identityCardBatch.updateMany({ where: { id, status: row.status, updatedAt: row.updatedAt }, data: { status: "CANCELLED", cancellationReason: String(reason).trim(), cancelledByUserId: actorId, cancelledAt: new Date() } });
    if (changed.count !== 1) throw new IdentityCardWorkflowError("Batch changed concurrently.", 409);
    await tx.identityCardEvent.create({ data: { batchId: id, eventType: "BATCH_CANCELLED", previousStatus: row.status, newStatus: "CANCELLED", reason: String(reason).trim(), recordedByUserId: actorId } });
    return tx.identityCardBatch.findUnique({ where: { id } });
  });
}
