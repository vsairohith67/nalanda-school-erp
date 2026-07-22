import { Prisma, type PrismaClient } from "@prisma/client";
import { localDate, moneyDecimal } from "@/lib/expenses";

export const LIBRARY_ACQUISITION_TYPES = ["PURCHASED", "DONATED", "TRANSFERRED", "OTHER"] as const;
export const LIBRARY_COPY_CONDITIONS = ["NEW", "GOOD", "FAIR", "POOR", "DAMAGED"] as const;
export const LIBRARY_COPY_STATUSES = ["AVAILABLE", "UNDER_REPAIR", "MISSING", "WITHDRAWN"] as const;
export const LIBRARY_COPY_EVENT_TYPES = ["ACCESSIONED", "DETAILS_UPDATED", "CONDITION_UPDATED", "SHELF_CHANGED", "MARKED_MISSING", "SENT_FOR_REPAIR", "RETURNED_FROM_REPAIR", "WITHDRAWN", "CORRECTION"] as const;

function text(value: unknown, label: string, max: number, required = false) {
  const result = String(value ?? "").trim().replace(/\s+/g, " ");
  if (required && !result) throw new Error(`${label} is required`);
  if (result.length > max) throw new Error(`${label} must be at most ${max} characters`);
  return result || null;
}

function oneOf<T extends readonly string[]>(value: unknown, values: T, label: string): T[number] {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (!values.includes(normalized)) throw new Error(`${label} is not supported`);
  return normalized as T[number];
}

function dateOnly(value: unknown, label: string) {
  if (value instanceof Date) return value;
  return localDate(value, label);
}

export function normalizeAccessionNumber(value: unknown) {
  const raw = text(value, "Accession number", 60, true)!;
  const normalized = raw.toUpperCase().replace(/\s+/g, "-").replace(/[^A-Z0-9_/-]/g, "").replace(/-+/g, "-").replace(/-?\/-?/g, "/").replace(/^-|-$/g, "");
  if (!normalized) throw new Error("Accession number must contain letters or numbers");
  return normalized;
}

export function normalizeLibraryBarcode(value: unknown) {
  const raw = text(value, "Barcode", 100);
  if (!raw) return null;
  const normalized = raw.toUpperCase().replace(/\s+/g, "").replace(/[^A-Z0-9_.:/-]/g, "");
  if (!normalized) throw new Error("Barcode must contain letters or numbers");
  return normalized;
}

export function validateLibraryCopyInput(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Library copy details are required");
  const row = input as Record<string, unknown>;
  const status = oneOf(row.status ?? "AVAILABLE", LIBRARY_COPY_STATUSES, "Copy status");
  const withdrawalReason = text(row.withdrawalReason, "Withdrawal reason", 1000);
  const withdrawnDate = row.withdrawnDate ? dateOnly(row.withdrawnDate, "Withdrawal date") : null;
  if (status === "WITHDRAWN" && !withdrawalReason) throw new Error("Withdrawal reason is required for a withdrawn copy");
  return {
    titleId: text(row.titleId, "Library title", 80, true)!,
    accessionNumber: normalizeAccessionNumber(row.accessionNumber),
    barcodeValue: normalizeLibraryBarcode(row.barcodeValue),
    acquisitionDate: row.acquisitionDate ? dateOnly(row.acquisitionDate, "Acquisition date") : null,
    acquisitionType: oneOf(row.acquisitionType ?? "OTHER", LIBRARY_ACQUISITION_TYPES, "Acquisition type"),
    acquisitionCost: String(row.acquisitionCost ?? "").trim() ? moneyDecimal(row.acquisitionCost, "Acquisition cost") : null,
    vendorId: text(row.vendorId, "Vendor", 80),
    expenseRecordId: text(row.expenseRecordId, "Expense record", 80),
    donorName: text(row.donorName, "Donor name", 180),
    invoiceNumberSnapshot: text(row.invoiceNumberSnapshot ?? row.invoiceNumber, "Invoice number", 120),
    condition: oneOf(row.condition ?? "GOOD", LIBRARY_COPY_CONDITIONS, "Copy condition"),
    status,
    shelfCode: text(row.shelfCode, "Shelf code", 80)?.toUpperCase() ?? null,
    notes: text(row.notes, "Notes", 2000),
    withdrawnDate: status === "WITHDRAWN" ? withdrawnDate ?? new Date() : null,
    withdrawalReason: status === "WITHDRAWN" ? withdrawalReason : null
  };
}

type CopyClient = Pick<PrismaClient | Prisma.TransactionClient, "libraryTitle" | "libraryCopy" | "libraryCopyEvent" | "vendor" | "expenseRecord">;

export async function validateLibraryCopyLinks(client: CopyClient, data: { titleId: string; vendorId: string | null; expenseRecordId: string | null }) {
  const [title, vendor, expense] = await Promise.all([
    client.libraryTitle.findUnique({ where: { id: data.titleId }, select: { id: true, status: true } }),
    data.vendorId ? client.vendor.findFirst({ where: { id: data.vendorId, status: "ACTIVE" }, select: { id: true } }) : null,
    data.expenseRecordId ? client.expenseRecord.findUnique({ where: { id: data.expenseRecordId }, select: { id: true, vendorId: true } }) : null
  ]);
  if (!title) throw new Error("Selected library title was not found");
  if (title.status !== "ACTIVE") throw new Error("Select an active library title before accessioning or correcting a copy");
  if (data.vendorId && !vendor) throw new Error("Selected Vendor must be active");
  if (data.expenseRecordId && !expense) throw new Error("Selected Expense record was not found");
  if (data.vendorId && expense?.vendorId && expense.vendorId !== data.vendorId) throw new Error("Vendor and Expense references do not belong to the same Vendor");
}

export async function createLibraryCopyInTransaction(client: CopyClient, input: unknown, actorId?: string | null, eventNotes?: string | null) {
  const data = validateLibraryCopyInput(input);
  await validateLibraryCopyLinks(client, data);
  try {
    const copy = await client.libraryCopy.create({ data: { ...data, createdByUserId: actorId ?? null, updatedByUserId: actorId ?? null } });
    await client.libraryCopyEvent.create({ data: { copyId: copy.id, eventType: "ACCESSIONED", eventDate: new Date(), newStatus: copy.status, newCondition: copy.condition, newShelfCode: copy.shelfCode, reason: copy.status === "WITHDRAWN" ? copy.withdrawalReason : null, notes: eventNotes ?? null, recordedByUserId: actorId ?? null } });
    return client.libraryCopy.findUniqueOrThrow({ where: { id: copy.id }, include: libraryCopyInclude });
  } catch (error: any) {
    if (error?.code === "P2002") throw new Error(String(error?.meta?.target ?? "").includes("barcode") ? "This normalized barcode already belongs to another copy" : "This accession number already exists and can never be reused");
    throw error;
  }
}

export async function createLibraryCopy(client: PrismaClient, input: unknown, actorId?: string | null, eventNotes?: string | null) {
  return client.$transaction((tx) => createLibraryCopyInTransaction(tx, input, actorId, eventNotes));
}

function changedSummary(before: any, after: Record<string, unknown>, keys: string[]) {
  return keys.filter((key) => String(before[key] ?? "") !== String(after[key] ?? "")).map((key) => `${key}: ${String(before[key] ?? "—")} -> ${String(after[key] ?? "—")}`).join("; ");
}

export async function updateLibraryCopyDetails(client: PrismaClient, id: string, input: unknown, actorId: string, correctionReason?: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Copy details are required");
  const row = input as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(row, "accessionNumber")) throw new Error("Accession number is permanent and cannot be edited");
  if (Object.prototype.hasOwnProperty.call(row, "barcodeValue")) throw new Error("Use the Barcode & Scanner correction workflow to change a barcode");
  return client.$transaction(async (tx) => {
    const current = await tx.libraryCopy.findUnique({ where: { id } });
    if (!current) throw new Error("Library copy not found");
    const data = validateLibraryCopyInput({ ...current, ...row, accessionNumber: current.accessionNumber, status: current.status, condition: current.condition, shelfCode: current.shelfCode, withdrawnDate: current.withdrawnDate?.toISOString().slice(0, 10), withdrawalReason: current.withdrawalReason });
    await validateLibraryCopyLinks(tx, data);
    const safe = { titleId: data.titleId, barcodeValue: data.barcodeValue, acquisitionDate: data.acquisitionDate, acquisitionType: data.acquisitionType, acquisitionCost: data.acquisitionCost, vendorId: data.vendorId, expenseRecordId: data.expenseRecordId, donorName: data.donorName, invoiceNumberSnapshot: data.invoiceNumberSnapshot, notes: data.notes };
    const summary = changedSummary(current, safe, Object.keys(safe));
    if (!summary) return tx.libraryCopy.findUniqueOrThrow({ where: { id }, include: libraryCopyInclude });
    const reason = correctionReason ? text(correctionReason, "Correction reason", 1000, true) : null;
    const updated = await tx.libraryCopy.update({ where: { id }, data: { ...safe, updatedByUserId: actorId } });
    await tx.libraryCopyEvent.create({ data: { copyId: id, eventType: reason ? "CORRECTION" : "DETAILS_UPDATED", eventDate: new Date(), reason, notes: summary, recordedByUserId: actorId } });
    return tx.libraryCopy.findUniqueOrThrow({ where: { id: updated.id }, include: libraryCopyInclude });
  });
}

export async function changeLibraryCopyCondition(client: PrismaClient, id: string, conditionInput: unknown, actorId: string, reasonInput?: unknown) {
  return client.$transaction((tx) => changeLibraryCopyConditionInTransaction(tx, id, conditionInput, actorId, reasonInput));
}

export async function changeLibraryCopyConditionInTransaction(client: CopyClient, id: string, conditionInput: unknown, actorId: string, reasonInput?: unknown) {
  const condition = oneOf(conditionInput, LIBRARY_COPY_CONDITIONS, "Copy condition");
  const reason = text(reasonInput, "Reason", 1000);
  {
    const current = await client.libraryCopy.findUnique({ where: { id } });
    if (!current) throw new Error("Library copy not found");
    if (current.status === "WITHDRAWN") throw new Error("A withdrawn copy cannot have its condition changed");
    if (current.condition === condition) throw new Error("Select a different condition");
    await client.libraryCopy.update({ where: { id }, data: { condition, updatedByUserId: actorId } });
    await client.libraryCopyEvent.create({ data: { copyId: id, eventType: "CONDITION_UPDATED", eventDate: new Date(), previousCondition: current.condition, newCondition: condition, reason, recordedByUserId: actorId } });
    return client.libraryCopy.findUniqueOrThrow({ where: { id }, include: libraryCopyInclude });
  }
}

export async function changeLibraryCopyShelf(client: PrismaClient, id: string, shelfInput: unknown, actorId: string, reasonInput?: unknown) {
  return client.$transaction((tx) => changeLibraryCopyShelfInTransaction(tx, id, shelfInput, actorId, reasonInput));
}

export async function changeLibraryCopyShelfInTransaction(client: CopyClient, id: string, shelfInput: unknown, actorId: string, reasonInput?: unknown) {
  const shelfCode = text(shelfInput, "Shelf code", 80)?.toUpperCase() ?? null;
  const reason = text(reasonInput, "Reason", 1000);
  {
    const current = await client.libraryCopy.findUnique({ where: { id } });
    if (!current) throw new Error("Library copy not found");
    if (current.status === "WITHDRAWN") throw new Error("A withdrawn copy cannot be moved to another shelf");
    if (current.shelfCode === shelfCode) throw new Error("Select a different shelf");
    await client.libraryCopy.update({ where: { id }, data: { shelfCode, updatedByUserId: actorId } });
    await client.libraryCopyEvent.create({ data: { copyId: id, eventType: "SHELF_CHANGED", eventDate: new Date(), previousShelfCode: current.shelfCode, newShelfCode: shelfCode, reason, recordedByUserId: actorId } });
    return client.libraryCopy.findUniqueOrThrow({ where: { id }, include: libraryCopyInclude });
  }
}

export async function assertNoOpenLibraryCirculation(client: Pick<PrismaClient | Prisma.TransactionClient, "libraryLoan">, copyId: string) {
  const active = await client.libraryLoan.findFirst({ where: { copyId, status: "ISSUED", activeCopyKey: copyId }, select: { loanNumber: true } });
  if (active) throw new Error(`Copy cannot be withdrawn while active loan ${active.loanNumber} is open`);
  return true;
}

export async function transitionLibraryCopy(client: PrismaClient, id: string, action: "missing" | "repair" | "available" | "withdraw", actorId: string, reasonInput?: unknown) {
  if (action === "withdraw" && !String(reasonInput ?? "").trim()) throw new Error("Reason is required");
  return client.$transaction((tx) => transitionLibraryCopyInTransaction(tx, id, action, actorId, reasonInput));
}

export async function transitionLibraryCopyInTransaction(client: CopyClient & Pick<Prisma.TransactionClient, "libraryLoan">, id: string, action: "missing" | "repair" | "available" | "withdraw", actorId: string, reasonInput?: unknown) {
  const config = {
    missing: { to: "MISSING", eventType: "MARKED_MISSING" },
    repair: { to: "UNDER_REPAIR", eventType: "SENT_FOR_REPAIR" },
    available: { to: "AVAILABLE", eventType: "RETURNED_FROM_REPAIR" },
    withdraw: { to: "WITHDRAWN", eventType: "WITHDRAWN" }
  } as const;
  const next = config[action];
  const reason = text(reasonInput, "Reason", 1000, action === "withdraw");
  {
    const current = await client.libraryCopy.findUnique({ where: { id } });
    if (!current) throw new Error("Library copy not found");
    if (current.status === "WITHDRAWN") throw new Error("A withdrawn copy is preserved and cannot change status");
    if (current.status === next.to) throw new Error(`Copy is already ${next.to.replaceAll("_", " ").toLowerCase()}`);
    if (action === "available" && current.status !== "UNDER_REPAIR" && current.status !== "MISSING") throw new Error("Only a missing or under-repair copy can be returned to available");
    if (action === "withdraw" || action === "missing") await assertNoOpenLibraryCirculation(client, id);
    const updated = await client.libraryCopy.update({ where: { id }, data: { status: next.to, withdrawnDate: action === "withdraw" ? new Date() : null, withdrawalReason: action === "withdraw" ? reason : null, updatedByUserId: actorId } });
    await client.libraryCopyEvent.create({ data: { copyId: id, eventType: next.eventType, eventDate: new Date(), previousStatus: current.status, newStatus: next.to, reason, recordedByUserId: actorId } });
    return client.libraryCopy.findUniqueOrThrow({ where: { id: updated.id }, include: libraryCopyInclude });
  }
}

export const libraryCopyInclude = {
  title: { select: { id: true, titleCode: true, title: true, authors: true, isbn: true } },
  vendor: { select: { id: true, vendorCode: true, name: true } },
  expenseRecord: { select: { id: true, expenseNumber: true, approvalStatus: true } },
  events: { include: { recordedBy: { select: { name: true } } }, orderBy: [{ eventDate: "desc" as const }, { createdAt: "desc" as const }] }
};

export function serializeLibraryCopy(row: any, restricted = false) {
  return {
    id: row.id,
    title: row.title ? { id: row.title.id, titleCode: row.title.titleCode, title: row.title.title, authors: row.title.authors, isbn: row.title.isbn } : null,
    accessionNumber: row.accessionNumber,
    barcodeValue: row.barcodeValue,
    acquisitionDate: row.acquisitionDate,
    acquisitionType: row.acquisitionType,
    acquisitionCost: row.acquisitionCost?.toString() ?? null,
    vendor: restricted ? (row.vendor ? { linked: true, label: "Linked Vendor" } : null) : row.vendor ? { id: row.vendor.id, vendorCode: row.vendor.vendorCode, name: row.vendor.name } : null,
    expenseRecord: restricted ? (row.expenseRecord ? { linked: true, label: "Linked Expense" } : null) : row.expenseRecord ? { id: row.expenseRecord.id, expenseNumber: row.expenseRecord.expenseNumber, approvalStatus: row.expenseRecord.approvalStatus } : null,
    donorName: row.donorName,
    invoiceNumberSnapshot: restricted ? (row.invoiceNumberSnapshot ? "Recorded" : null) : row.invoiceNumberSnapshot,
    condition: row.condition,
    status: row.status,
    shelfCode: row.shelfCode,
    notes: restricted ? null : row.notes,
    withdrawnDate: row.withdrawnDate,
    withdrawalReason: row.withdrawalReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    events: (row.events ?? []).map((event: any) => ({ id: event.id, eventType: event.eventType, eventDate: event.eventDate, previousStatus: event.previousStatus, newStatus: event.newStatus, previousCondition: event.previousCondition, newCondition: event.newCondition, previousShelfCode: event.previousShelfCode, newShelfCode: event.newShelfCode, reason: event.reason, notes: restricted ? null : event.notes, actorLabel: event.recordedBy?.name ?? "System / restored record", createdAt: event.createdAt }))
  };
}

export function libraryCopyWhere(search: Record<string, string | undefined>) {
  const q = search.q?.trim();
  return {
    ...(q ? { OR: [{ accessionNumber: { contains: q } }, { barcodeValue: { contains: q } }, { title: { OR: [{ title: { contains: q } }, { titleCode: { contains: q } }] } }] } : {}),
    ...(search.condition ? { condition: search.condition } : {}),
    ...(search.status ? { status: search.status } : {}),
    ...(search.shelf ? { shelfCode: search.shelf } : {}),
    ...(search.acquisitionType ? { acquisitionType: search.acquisitionType } : {}),
    ...(search.vendor === "linked" ? { vendorId: { not: null } } : search.vendor === "unlinked" ? { vendorId: null } : {}),
    ...(search.expense === "linked" ? { expenseRecordId: { not: null } } : search.expense === "unlinked" ? { expenseRecordId: null } : {})
  };
}
