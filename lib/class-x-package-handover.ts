import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { schoolDateKey } from "@/lib/format";

const RECIPIENT_TYPES = ["STUDENT", "GUARDIAN", "AUTHORISED_REPRESENTATIVE"] as const;
const IDENTITY_METHODS = ["SCHOOL_RECORD_MATCH", "SCHOOL_ID_CHECK", "AUTHORISATION_LETTER_CHECK", "KNOWN_GUARDIAN_CONFIRMATION", "OTHER_APPROVED_CATEGORY"] as const;

function text(value: unknown, label: string, max: number) {
  const result = String(value ?? "").trim();
  if (!result || result.length > max) throw new Error(`${label} is required and must be at most ${max} characters`);
  return result;
}

function handoverNumber(date = new Date(), qaPrefix = false) {
  return `${qaPrefix ? "QA18B-" : ""}CXP-HO-${schoolDateKey(date).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

export async function recordClassXHandover(client: PrismaClient, packageId: string, input: Record<string, unknown>, actorId: string) {
  const itemIds = Array.isArray(input.itemIds) ? [...new Set(input.itemIds.map(String))] : [];
  if (!itemIds.length || itemIds.length > 30) throw new Error("Select at least one and at most 30 ready documents");
  const recipientType = String(input.recipientType ?? "").toUpperCase();
  if (!RECIPIENT_TYPES.includes(recipientType as never)) throw new Error("Recipient type is not supported");
  const recipientName = text(input.recipientName, "Recipient name", 120);
  const relationship = String(input.relationship ?? "").trim() || null;
  const acknowledgement = text(input.recipientAcknowledgementText ?? "I acknowledge physical receipt of the listed documents.", "Acknowledgement text", 1000);
  const identityChecked = input.identityChecked === true;
  const identityCheckMethod = String(input.identityCheckMethod ?? "").toUpperCase();
  if (!identityChecked || !IDENTITY_METHODS.includes(identityCheckMethod as never)) throw new Error("Select a safe identity-check category and confirm the check");
  const combined = `${recipientName} ${relationship ?? ""} ${acknowledgement}`;
  if (/\b\d{8,}\b/.test(combined) || /aadhaar|passport number|voter id number/i.test(combined)) throw new Error("Do not store Aadhaar or government identity numbers in handover records");
  const handoverDate = new Date(`${String(input.handoverDate ?? schoolDateKey())}T00:00:00.000Z`);
  if (Number.isNaN(handoverDate.getTime())) throw new Error("Handover date is invalid");
  return client.$transaction(async (tx) => {
    const pkg = await tx.classXDocumentPackage.findUnique({ where: { id: packageId }, include: { charge: true } });
    if (!pkg || !["APPROVED", "READY_FOR_HANDOVER", "PARTIALLY_HANDED_OVER"].includes(pkg.status)) throw new Error("Package must be approved before handover");
    if (pkg.paymentRequired && !["PAID", "WAIVED", "NOT_REQUIRED"].includes(pkg.charge?.status ?? "")) throw new Error("Required package charge must be resolved before handover");
    const items = await tx.classXPackageDocumentItem.findMany({ where: { id: { in: itemIds }, packageId } });
    if (items.length !== itemIds.length || items.some((item) => item.status !== "READY_FOR_HANDOVER")) throw new Error("Every selected document must belong to this package and be ready for handover");
    const snapshot = items.map((item) => ({ itemKey: item.itemKey, displayName: item.displayName, issuerType: item.issuerType }));
    const handover = await tx.classXPackageHandover.create({ data: { packageId, handoverNumber: handoverNumber(handoverDate, pkg.packageNumber.startsWith("QA18B-")), handoverDate, recipientType, recipientName, relationship, recipientAcknowledgementText: acknowledgement, identityChecked, identityCheckMethod, itemSnapshotJson: JSON.stringify(snapshot), handedOverByUserId: actorId } });
    const changed = await tx.classXPackageDocumentItem.updateMany({ where: { id: { in: itemIds }, packageId, status: "READY_FOR_HANDOVER" }, data: { status: "HANDED_OVER", handoverDate, handedOverByUserId: actorId } });
    if (changed.count !== itemIds.length) throw new Error("A selected document changed during handover; no partial handover was saved");
    for (const item of items) await tx.classXPackageEvent.create({ data: { packageId, documentItemId: item.id, handoverId: handover.id, eventType: "DOCUMENT_HANDED_OVER", previousStatus: "READY_FOR_HANDOVER", newStatus: "HANDED_OVER", recordedByUserId: actorId } });
    const remaining = await tx.classXPackageDocumentItem.count({ where: { packageId, handoverRequired: true, status: "READY_FOR_HANDOVER" } });
    const unresolvedHandoverItems = await tx.classXPackageDocumentItem.count({ where: { packageId, handoverRequired: true, status: { notIn: ["HANDED_OVER", "NOT_APPLICABLE"] } } });
    const handedOverItems = await tx.classXPackageDocumentItem.count({ where: { packageId, status: "HANDED_OVER" } });
    const next = unresolvedHandoverItems > 0 ? "PARTIALLY_HANDED_OVER" : "READY_FOR_HANDOVER";
    await tx.classXDocumentPackage.update({ where: { id: packageId }, data: { status: next, handedOverItems, readyItems: remaining } });
    return { handover, packageStatus: next };
  });
}

export function parseHandoverItems(value: string) {
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}
