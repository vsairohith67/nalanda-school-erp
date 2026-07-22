import type { Prisma, PrismaClient } from "@prisma/client";
import { allocateIdentityCardNumber } from "@/lib/id-card-numbering";
import { buildIdentityCardSourceSnapshot, parseIdentityCardSnapshot } from "@/lib/id-card-snapshots";
import { snapshotHash } from "@/lib/certificate-snapshots";
import { isIdentityCardType, parseIdentityCardTemplate, type IdentityCardType } from "@/lib/id-card-templates";
import { schoolDateKey } from "@/lib/format";

type Client = PrismaClient | Prisma.TransactionClient;
export class IdentityCardWorkflowError extends Error { constructor(message: string, public status = 400) { super(message); } }

function dateInput(value: unknown, label: string) {
  const raw = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new IdentityCardWorkflowError(`${label} must be a calendar date.`);
  const date = new Date(`${raw}T00:00:00.000Z`);
  if (date.toISOString().slice(0, 10) !== raw) throw new IdentityCardWorkflowError(`${label} is invalid.`);
  return date;
}

export function effectiveIdentityCardStatus(card: { status: string; validUntil: Date | string }, now = new Date()) {
  if (["REVOKED", "CANCELLED", "SUPERSEDED"].includes(card.status)) return card.status;
  if (card.status === "ISSUED") return schoolDateKey(card.validUntil) < schoolDateKey(now) ? "EXPIRED" : "ACTIVE";
  if (card.status === "READY_FOR_REVIEW") return "DRAFT";
  return card.status;
}

export async function createIdentityCardDraft(client: PrismaClient, input: any, actorId: string, batchId?: string | null) {
  const cardType = String(input?.cardType ?? "").toUpperCase();
  if (!isIdentityCardType(cardType)) throw new IdentityCardWorkflowError("Card type must be STUDENT or STAFF.");
  const studentId = String(input?.studentId ?? "").trim() || null, staffMemberId = String(input?.staffMemberId ?? "").trim() || null;
  if ((studentId ? 1 : 0) + (staffMemberId ? 1 : 0) !== 1 || cardType === "STUDENT" !== Boolean(studentId)) throw new IdentityCardWorkflowError("Choose exactly one matching Student or StaffMember.");
  const templateId = String(input?.templateId ?? ""), academicYear = String(input?.academicYear ?? "").trim() || null;
  const validFrom = dateInput(input?.validFrom, "Valid from"), validUntil = dateInput(input?.validUntil, "Valid until");
  return client.$transaction(async (tx) => {
    const template = await tx.identityCardTemplate.findUnique({ where: { id: templateId } });
    if (!template || template.status !== "ACTIVE" || template.cardType !== cardType || (template.academicYear && template.academicYear !== academicYear)) throw new IdentityCardWorkflowError("Choose an applicable active ID-card template.");
    const parsedTemplate = parseIdentityCardTemplate(template);
    const snapshot = await buildIdentityCardSourceSnapshot(tx, { cardType, studentId, staffMemberId, academicYear, validFrom, validUntil }, template);
    const existing = await tx.identityCard.findFirst({ where: { cardType, studentId, staffMemberId, academicYear, status: "ISSUED", validUntil: { gte: new Date(`${schoolDateKey()}T00:00:00.000Z`) } } });
    if (existing) throw new IdentityCardWorkflowError("This person already has an active issued ID card for the selected year.", 409);
    const row = await tx.identityCard.create({ data: { cardType, batchId: batchId ?? null, templateId, studentId, staffMemberId, academicYear, validFrom, validUntil, draftDataJson: JSON.stringify(snapshot), templateSnapshotJson: JSON.stringify(parsedTemplate), issueReason: String(input?.issueReason ?? "").trim() || null, createdByUserId: actorId } });
    await tx.identityCardEvent.create({ data: { batchId: batchId ?? null, identityCardId: row.id, eventType: "CARD_CREATED", newStatus: "DRAFT", recordedByUserId: actorId } });
    return row;
  });
}

export async function transitionIdentityCard(client: PrismaClient, id: string, action: "review" | "approve", actorId: string, expectedUpdatedAt?: string) {
  return client.$transaction(async (tx) => {
    const row = await tx.identityCard.findUnique({ where: { id } });
    if (!row) throw new IdentityCardWorkflowError("ID card not found.", 404);
    const rule = action === "review" ? { from: "DRAFT", to: "READY_FOR_REVIEW", event: "CARD_UPDATED" } : { from: "READY_FOR_REVIEW", to: "APPROVED", event: "CARD_APPROVED" };
    if (row.status !== rule.from) throw new IdentityCardWorkflowError(`ID card cannot ${action} from ${row.status}.`, 409);
    if (expectedUpdatedAt && row.updatedAt.toISOString() !== expectedUpdatedAt) throw new IdentityCardWorkflowError("ID card changed since it was opened.", 409);
    const result = await tx.identityCard.updateMany({ where: { id, status: rule.from, updatedAt: row.updatedAt }, data: { status: rule.to, ...(action === "approve" ? { approvedByUserId: actorId, approvedAt: new Date() } : {}) } });
    if (result.count !== 1) throw new IdentityCardWorkflowError("ID card changed concurrently.", 409);
    await tx.identityCardEvent.create({ data: { identityCardId: id, eventType: rule.event, previousStatus: rule.from, newStatus: rule.to, recordedByUserId: actorId } });
    return tx.identityCard.findUnique({ where: { id } });
  });
}

async function validateCurrentIdentity(tx: Prisma.TransactionClient, row: any) {
  const template = await (tx as any).identityCardTemplate.findUnique({ where: { id: row.templateId } });
  if (!template || template.status !== "ACTIVE") throw new IdentityCardWorkflowError("The ID-card template is inactive.", 409);
  const fresh = await buildIdentityCardSourceSnapshot(tx, { cardType: row.cardType as IdentityCardType, studentId: row.studentId, staffMemberId: row.staffMemberId, academicYear: row.academicYear, validFrom: row.validFrom, validUntil: row.validUntil }, template);
  return { template, fresh };
}

export async function issueIdentityCard(prisma: PrismaClient, id: string, actorId: string, expectedUpdatedAt?: string) {
  return prisma.$transaction(async (tx) => {
    const row = await tx.identityCard.findUnique({ where: { id } });
    if (!row) throw new IdentityCardWorkflowError("ID card not found.", 404);
    if (row.status === "ISSUED") return row;
    if (row.status !== "APPROVED") throw new IdentityCardWorkflowError("Only an approved ID card can be issued.", 409);
    if (expectedUpdatedAt && row.updatedAt.toISOString() !== expectedUpdatedAt) throw new IdentityCardWorkflowError("ID card changed since it was opened.", 409);
    const existing = await tx.identityCard.findFirst({ where: { id: { not: id }, cardType: row.cardType, studentId: row.studentId, staffMemberId: row.staffMemberId, academicYear: row.academicYear, status: "ISSUED", validUntil: { gte: new Date(`${schoolDateKey()}T00:00:00.000Z`) } } });
    if (existing) throw new IdentityCardWorkflowError("Another active issued ID card already exists for this person.", 409);
    const { template, fresh } = await validateCurrentIdentity(tx, row);
    const allocation = await allocateIdentityCardNumber(tx, row.cardType as IdentityCardType, row.academicYear);
    const now = new Date();
    const snapshot = { ...fresh, cardNumber: allocation.cardNumber, status: "ACTIVE", versionNumber: 1, versionType: "ORIGINAL", barcodeEnabled: template.barcodeEnabled };
    const version = await tx.identityCardVersion.create({ data: { identityCardId: id, versionNumber: 1, versionType: "ORIGINAL", cardNumber: allocation.cardNumber, snapshotJson: JSON.stringify(snapshot), issuedAt: now, issuedByUserId: actorId, snapshotHash: snapshotHash(snapshot) } });
    const changed = await tx.identityCard.updateMany({ where: { id, status: "APPROVED", updatedAt: row.updatedAt }, data: { status: "ISSUED", cardNumber: allocation.cardNumber, numberSeriesId: allocation.seriesId, currentVersionNumber: 1, draftDataJson: JSON.stringify(fresh), issuedAt: now, issuedByUserId: actorId } });
    if (changed.count !== 1) throw new IdentityCardWorkflowError("ID card changed concurrently.", 409);
    await tx.identityCardEvent.create({ data: { batchId: row.batchId, identityCardId: id, versionId: version.id, eventType: "CARD_ISSUED", previousStatus: "APPROVED", newStatus: "ISSUED", recordedByUserId: actorId } });
    return tx.identityCard.findUnique({ where: { id } });
  });
}

export async function correctIdentityCard(prisma: PrismaClient, id: string, actorId: string, reason: string) {
  if (!String(reason).trim()) throw new IdentityCardWorkflowError("Correction reason is required.");
  return prisma.$transaction(async (tx) => {
    const row = await tx.identityCard.findUnique({ where: { id } });
    if (!row || row.status !== "ISSUED" || !row.cardNumber) throw new IdentityCardWorkflowError("Only an issued ID card can be corrected.", 409);
    const prior = await tx.identityCardVersion.findFirst({ where: { identityCardId: id }, orderBy: { versionNumber: "desc" } });
    if (!prior) throw new IdentityCardWorkflowError("Issued version history is missing.", 409);
    const { template, fresh } = await validateCurrentIdentity(tx, row);
    const next = prior.versionNumber + 1, now = new Date();
    const snapshot = { ...fresh, cardNumber: row.cardNumber, status: effectiveIdentityCardStatus(row), versionNumber: next, versionType: "CORRECTION", correctionReason: String(reason).trim(), barcodeEnabled: template.barcodeEnabled };
    const version = await tx.identityCardVersion.create({ data: { identityCardId: id, versionNumber: next, versionType: "CORRECTION", cardNumber: row.cardNumber, snapshotJson: JSON.stringify(snapshot), correctionReason: String(reason).trim(), issuedAt: now, issuedByUserId: actorId, supersedesVersionId: prior.id, snapshotHash: snapshotHash(snapshot) } });
    await tx.identityCard.update({ where: { id }, data: { currentVersionNumber: next, draftDataJson: JSON.stringify(fresh) } });
    await tx.identityCardEvent.create({ data: { identityCardId: id, versionId: version.id, eventType: "CARD_CORRECTED", reason: String(reason).trim(), recordedByUserId: actorId } });
    return version;
  });
}

export async function revokeIdentityCard(client: PrismaClient, id: string, actorId: string, reason: string) {
  if (!String(reason).trim()) throw new IdentityCardWorkflowError("Revocation reason is required.");
  return client.$transaction(async (tx) => {
    const row = await tx.identityCard.findUnique({ where: { id } });
    if (!row || row.status !== "ISSUED") throw new IdentityCardWorkflowError("Only an issued ID card can be revoked.", 409);
    const changed = await tx.identityCard.updateMany({ where: { id, status: "ISSUED", updatedAt: row.updatedAt }, data: { status: "REVOKED", revocationReason: String(reason).trim(), revokedByUserId: actorId, revokedAt: new Date() } });
    if (changed.count !== 1) throw new IdentityCardWorkflowError("ID card changed concurrently.", 409);
    await tx.identityCardEvent.create({ data: { identityCardId: id, eventType: "CARD_REVOKED", previousStatus: "ISSUED", newStatus: "REVOKED", reason: String(reason).trim(), recordedByUserId: actorId } });
    return tx.identityCard.findUnique({ where: { id } });
  });
}

export async function cancelIdentityCard(client: PrismaClient, id: string, actorId: string, reason: string) {
  if (!String(reason).trim()) throw new IdentityCardWorkflowError("Cancellation reason is required.");
  return client.$transaction(async (tx) => {
    const row = await tx.identityCard.findUnique({ where: { id } });
    if (!row || !["DRAFT", "READY_FOR_REVIEW", "APPROVED"].includes(row.status)) throw new IdentityCardWorkflowError("Only an unissued ID card can be cancelled.", 409);
    const changed = await tx.identityCard.updateMany({ where: { id, status: row.status, updatedAt: row.updatedAt }, data: { status: "CANCELLED", cancellationReason: String(reason).trim(), cancelledByUserId: actorId, cancelledAt: new Date() } });
    if (changed.count !== 1) throw new IdentityCardWorkflowError("ID card changed concurrently.", 409);
    await tx.identityCardEvent.create({ data: { identityCardId: id, eventType: "CARD_CANCELLED", previousStatus: row.status, newStatus: "CANCELLED", reason: String(reason).trim(), recordedByUserId: actorId } });
    return tx.identityCard.findUnique({ where: { id } });
  });
}

export async function replaceIdentityCard(prisma: PrismaClient, id: string, actorId: string, reason: string) {
  if (!String(reason).trim()) throw new IdentityCardWorkflowError("Lost/damaged replacement reason is required.");
  return prisma.$transaction(async (tx) => {
    const old = await tx.identityCard.findUnique({ where: { id } });
    if (!old || old.status !== "ISSUED" || !old.cardNumber) throw new IdentityCardWorkflowError("Only an issued ID card can be replaced.", 409);
    if (await tx.identityCard.findFirst({ where: { replacesCardId: id } })) throw new IdentityCardWorkflowError("This ID card already has a replacement.", 409);
    const { template, fresh } = await validateCurrentIdentity(tx, old);
    const allocation = await allocateIdentityCardNumber(tx, old.cardType as IdentityCardType, old.academicYear);
    const now = new Date();
    await tx.identityCard.update({ where: { id }, data: { status: "REVOKED", revocationReason: `Replaced: ${String(reason).trim()}`, revokedByUserId: actorId, revokedAt: now } });
    const replacement = await tx.identityCard.create({ data: { cardType: old.cardType, templateId: old.templateId, numberSeriesId: allocation.seriesId, studentId: old.studentId, staffMemberId: old.staffMemberId, academicYear: old.academicYear, validFrom: old.validFrom, validUntil: old.validUntil, status: "ISSUED", currentVersionNumber: 1, draftDataJson: JSON.stringify(fresh), templateSnapshotJson: old.templateSnapshotJson, issueReason: String(reason).trim(), replacesCardId: id, createdByUserId: actorId, approvedByUserId: actorId, issuedByUserId: actorId, approvedAt: now, issuedAt: now, cardNumber: allocation.cardNumber } });
    const snapshot = { ...fresh, cardNumber: allocation.cardNumber, status: "ACTIVE", versionNumber: 1, versionType: "ORIGINAL", replacementReason: String(reason).trim(), barcodeEnabled: template.barcodeEnabled };
    const version = await tx.identityCardVersion.create({ data: { identityCardId: replacement.id, versionNumber: 1, versionType: "ORIGINAL", cardNumber: allocation.cardNumber, snapshotJson: JSON.stringify(snapshot), issuedAt: now, issuedByUserId: actorId, snapshotHash: snapshotHash(snapshot) } });
    await tx.identityCardEvent.createMany({ data: [
      { identityCardId: id, eventType: "CARD_REVOKED", previousStatus: "ISSUED", newStatus: "REVOKED", reason: String(reason).trim(), recordedByUserId: actorId },
      { identityCardId: replacement.id, versionId: version.id, eventType: "REPLACEMENT_CREATED", newStatus: "ISSUED", reason: String(reason).trim(), recordedByUserId: actorId }
    ] });
    return replacement;
  });
}

export function safeIdentityCardPayload(card: any, version?: any) {
  const snapshot = parseIdentityCardSnapshot(version?.snapshotJson ?? card.draftDataJson);
  return { cardNumber: card.cardNumber, cardType: card.cardType, storedStatus: card.status, effectiveStatus: effectiveIdentityCardStatus(card), validFrom: card.validFrom, validUntil: card.validUntil, currentVersionNumber: card.currentVersionNumber, snapshot };
}
