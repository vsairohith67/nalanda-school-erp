import type { Prisma, PrismaClient } from "@prisma/client";
import { normalizeAccessionNumber } from "@/lib/library-accession";

export const CODE39_BASIC_PATTERN = /^[0-9A-Z .$/+%\-]+$/;
export function normalizeBarcodeValue(value: unknown) {
  // Code 39 permits an internal space. Only scanner/paste padding is removed.
  const normalized = String(value ?? "").trim().toUpperCase();
  if (!normalized) throw new Error("Barcode is required");
  if (normalized.length > 80) throw new Error("Barcode must be at most 80 characters");
  if (!CODE39_BASIC_PATTERN.test(normalized)) throw new Error("Barcode supports Code 39 characters only: A-Z, 0-9, space, - . $ / + %");
  return normalized;
}
export function generatedBarcodeForAccession(accessionNumber: unknown) { return normalizeBarcodeValue(`NPS-LIB-${normalizeAccessionNumber(accessionNumber)}`); }

type Client = PrismaClient | Prisma.TransactionClient;
const copySelect = { id: true, accessionNumber: true, barcodeValue: true, status: true, condition: true, shelfCode: true, title: { select: { titleCode: true, title: true } } };

export async function assignLibraryBarcode(client: Client, copyId: string, rawValue: unknown, actorId: string, correction = false, reason?: unknown) {
  const barcodeValue = normalizeBarcodeValue(rawValue); const correctionReason = String(reason ?? "").trim();
  return (client as PrismaClient).$transaction(async (tx) => {
    const copy = await tx.libraryCopy.findUnique({ where: { id: copyId }, select: copySelect });
    if (!copy) throw new Error("Library copy not found");
    if (copy.barcodeValue === barcodeValue) return { copy, idempotent: true };
    if (copy.barcodeValue && !correction) throw new Error("This copy already has a barcode. Use explicit correction mode with a reason.");
    if (copy.barcodeValue && (!correction || !correctionReason)) throw new Error("Barcode correction requires a reason");
    const conflict = await tx.libraryCopy.findUnique({ where: { barcodeValue }, select: { id: true } });
    if (conflict && conflict.id !== copy.id) throw new Error("This normalized barcode already belongs to another copy and can never be reused");
    const historical = await tx.libraryCopyEvent.findMany({ where: { eventType: { in: ["BARCODE_ASSIGNED", "BARCODE_CORRECTED"] }, notes: { contains: barcodeValue } }, select: { copyId: true, notes: true } });
    const previouslyAssignedElsewhere = historical.some((event) => event.copyId !== copy.id && (event.notes === `Barcode assigned: ${barcodeValue}` || event.notes?.endsWith(` to ${barcodeValue}`)));
    if (previouslyAssignedElsewhere) throw new Error("This barcode was previously assigned to another copy and cannot be reused");
    const updated = await tx.libraryCopy.update({ where: { id: copy.id }, data: { barcodeValue, updatedByUserId: actorId }, select: copySelect });
    await tx.libraryCopyEvent.create({ data: { copyId: copy.id, eventType: copy.barcodeValue ? "BARCODE_CORRECTED" : "BARCODE_ASSIGNED", eventDate: new Date(), reason: copy.barcodeValue ? correctionReason : null, notes: copy.barcodeValue ? `Barcode corrected from ${copy.barcodeValue} to ${barcodeValue}` : `Barcode assigned: ${barcodeValue}`, recordedByUserId: actorId } });
    return { copy: updated, idempotent: false };
  });
}

export async function barcodeCoverage(client: Pick<PrismaClient, "libraryCopy" | "libraryCopyEvent">) {
  const [copies, events] = await Promise.all([client.libraryCopy.findMany({ select: copySelect, orderBy: { accessionNumber: "asc" } }), client.libraryCopyEvent.findMany({ where: { eventType: { in: ["BARCODE_ASSIGNED", "BARCODE_CORRECTED"] } }, include: { copy: { select: { accessionNumber: true, title: { select: { title: true } } } }, recordedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 30 })]);
  const invalid = copies.filter((copy) => copy.barcodeValue && !CODE39_BASIC_PATTERN.test(copy.barcodeValue));
  return { copies, summary: { total: copies.length, assigned: copies.filter((c) => c.barcodeValue).length, missing: copies.filter((c) => !c.barcodeValue).length, conflicts: 0, invalid: invalid.length, withdrawn: copies.filter((c) => c.status === "WITHDRAWN").length }, recentEvents: events.map((e) => ({ accessionNumber: e.copy.accessionNumber, title: e.copy.title.title, eventType: e.eventType, reason: e.reason, notes: e.notes, eventDate: e.eventDate, actorLabel: e.recordedBy?.name ?? "System / restored record" })) };
}

export function barcodeBulkPreview(copies: Array<{ id: string; accessionNumber: string; barcodeValue: string | null }>) {
  const proposed = new Set<string>();
  return copies.map((copy) => { if (copy.barcodeValue) return { copyId: copy.id, accessionNumber: copy.accessionNumber, barcodeValue: copy.barcodeValue, status: "SKIPPED", message: "Already assigned" }; const barcodeValue = generatedBarcodeForAccession(copy.accessionNumber); if (proposed.has(barcodeValue)) return { copyId: copy.id, accessionNumber: copy.accessionNumber, barcodeValue, status: "ERROR", message: "Duplicate generated value" }; proposed.add(barcodeValue); return { copyId: copy.id, accessionNumber: copy.accessionNumber, barcodeValue, status: "READY", message: "Ready for confirmation" }; });
}
