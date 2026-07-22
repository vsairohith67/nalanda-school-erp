import type { Prisma, PrismaClient } from "@prisma/client";
import { createLibraryCopyInTransaction, normalizeAccessionNumber, normalizeLibraryBarcode, validateLibraryCopyInput } from "@/lib/library-accession";
import { normalizeIsbn, normalizeLibraryTitleCode, validateLibraryTitleInput } from "@/lib/library-catalog";
import { csvCell } from "@/lib/expenses";

type ImportClient = Pick<PrismaClient | Prisma.TransactionClient, "libraryTitle" | "libraryCopy" | "libraryCopyEvent" | "vendor" | "expenseRecord">;
export type LibraryImportRow = { rowNumber: number; action: "CREATE" | "SKIP" | "ERROR"; normalized: Record<string, any>; errors: string[]; warnings: string[] };
export type LibraryImportPreview = { kind: "titles" | "copies"; counts: { total: number; ready: number; skipped: number; errors: number; warnings: number }; rows: LibraryImportRow[] };

function preview(kind: "titles" | "copies", rows: LibraryImportRow[]): LibraryImportPreview {
  return { kind, counts: { total: rows.length, ready: rows.filter((r) => r.action === "CREATE").length, skipped: rows.filter((r) => r.action === "SKIP").length, errors: rows.filter((r) => r.action === "ERROR").length, warnings: rows.reduce((n, r) => n + r.warnings.length, 0) }, rows };
}

export async function buildLibraryTitleImportPreview(client: ImportClient, source: unknown[]): Promise<LibraryImportPreview> {
  if (!Array.isArray(source) || !source.length) throw new Error("No library title rows were supplied");
  if (source.length > 5000) throw new Error("Library title imports are limited to 5,000 rows at a time");
  const seenCodes = new Set<string>(), seenIsbns = new Set<string>();
  const rows: LibraryImportRow[] = [];
  for (const [index, raw] of source.entries()) {
    const errors: string[] = [], warnings: string[] = [];
    const input = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
    let normalized: Record<string, any> = {};
    try {
      const publisherVendorCode = String(input.publisherVendorCode ?? "").trim().toUpperCase();
      const vendor = publisherVendorCode ? await client.vendor.findUnique({ where: { vendorCode: publisherVendorCode }, select: { id: true, status: true } }) : null;
      if (publisherVendorCode && (!vendor || vendor.status !== "ACTIVE")) errors.push(`Vendor code ${publisherVendorCode} was not found as an active Vendor`);
      normalized = validateLibraryTitleInput({ ...input, publisherVendorId: vendor?.id ?? null });
      if (seenCodes.has(normalized.titleCode)) errors.push(`Duplicate normalized title code ${normalized.titleCode} appears in this file`);
      seenCodes.add(normalized.titleCode);
      if (normalized.isbn) {
        if (seenIsbns.has(normalized.isbn)) errors.push(`Duplicate normalized ISBN ${normalized.isbn} appears in this file`);
        seenIsbns.add(normalized.isbn);
      }
      const [existingCode, existingIsbn] = await Promise.all([
        client.libraryTitle.findUnique({ where: { titleCode: normalized.titleCode }, select: { id: true, isbn: true } }),
        normalized.isbn ? client.libraryTitle.findUnique({ where: { isbn: normalized.isbn }, select: { id: true, titleCode: true } }) : null
      ]);
      if (existingIsbn && existingIsbn.titleCode !== normalized.titleCode) errors.push(`ISBN ${normalized.isbn} already belongs to title ${existingIsbn.titleCode}`);
      if (existingCode && !errors.length) warnings.push(`Title ${normalized.titleCode} already exists and will be skipped; existing data is not overwritten`);
    } catch (error) { errors.push(error instanceof Error ? error.message : "Invalid title row"); }
    rows.push({ rowNumber: index + 2, action: errors.length ? "ERROR" : warnings.some((w) => w.includes("already exists")) ? "SKIP" : "CREATE", normalized, errors, warnings });
  }
  return preview("titles", rows);
}

export async function applyLibraryTitleImport(client: ImportClient, checked: LibraryImportPreview, actorId: string) {
  if (checked.kind !== "titles") throw new Error("A title preview is required");
  let created = 0, skipped = 0;
  for (const row of checked.rows) {
    if (row.action !== "CREATE") { skipped += 1; continue; }
    await client.libraryTitle.create({ data: { ...row.normalized, createdByUserId: actorId } as any });
    created += 1;
  }
  return { created, skipped, errors: checked.rows.filter((r) => r.action === "ERROR").flatMap((r) => r.errors.map((reason) => `CSV Row ${r.rowNumber}: ${reason}`)) };
}

export async function buildLibraryCopyImportPreview(client: ImportClient, source: unknown[]): Promise<LibraryImportPreview> {
  if (!Array.isArray(source) || !source.length) throw new Error("No physical-copy rows were supplied");
  if (source.length > 10000) throw new Error("Physical-copy imports are limited to 10,000 rows at a time");
  const seenAccessions = new Set<string>(), seenBarcodes = new Set<string>();
  const rows: LibraryImportRow[] = [];
  for (const [index, raw] of source.entries()) {
    const errors: string[] = [], warnings: string[] = [];
    const input = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
    let normalized: Record<string, any> = {};
    try {
      const titleCode = normalizeLibraryTitleCode(input.titleCode);
      const vendorCode = String(input.vendorCode ?? "").trim().toUpperCase();
      const expenseNumber = String(input.expenseNumber ?? "").trim().toUpperCase();
      const [title, vendor, expense] = await Promise.all([
        client.libraryTitle.findUnique({ where: { titleCode }, select: { id: true, status: true } }),
        vendorCode ? client.vendor.findUnique({ where: { vendorCode }, select: { id: true, status: true } }) : null,
        expenseNumber ? client.expenseRecord.findUnique({ where: { expenseNumber }, select: { id: true, vendorId: true } }) : null
      ]);
      if (!title) errors.push(`Exact title code ${titleCode} was not found`);
      else if (title.status !== "ACTIVE") errors.push(`Exact title code ${titleCode} is inactive and cannot receive new accessions`);
      if (vendorCode && (!vendor || vendor.status !== "ACTIVE")) errors.push(`Exact Vendor code ${vendorCode} was not found as active`);
      if (expenseNumber && !expense) errors.push(`Exact Expense number ${expenseNumber} was not found`);
      if (vendor?.id && expense?.vendorId && vendor.id !== expense.vendorId) errors.push("Vendor and Expense references do not belong to the same Vendor");
      normalized = validateLibraryCopyInput({ ...input, titleId: title?.id ?? "missing", vendorId: vendor?.id ?? null, expenseRecordId: expense?.id ?? null, invoiceNumberSnapshot: input.invoiceNumber });
      if (seenAccessions.has(normalized.accessionNumber)) errors.push(`Duplicate accession number ${normalized.accessionNumber} appears in this file`);
      seenAccessions.add(normalized.accessionNumber);
      if (normalized.barcodeValue) {
        if (seenBarcodes.has(normalized.barcodeValue)) errors.push(`Duplicate barcode ${normalized.barcodeValue} appears in this file`);
        seenBarcodes.add(normalized.barcodeValue);
      }
      const [existingAccession, existingBarcode] = await Promise.all([
        client.libraryCopy.findUnique({ where: { accessionNumber: normalized.accessionNumber }, select: { id: true, barcodeValue: true } }),
        normalized.barcodeValue ? client.libraryCopy.findUnique({ where: { barcodeValue: normalized.barcodeValue }, select: { id: true, accessionNumber: true } }) : null
      ]);
      if (existingBarcode && existingBarcode.accessionNumber !== normalized.accessionNumber) errors.push(`Barcode ${normalized.barcodeValue} already belongs to accession ${existingBarcode.accessionNumber}`);
      if (existingAccession && !errors.length) warnings.push(`Accession ${normalized.accessionNumber} already exists and will be skipped; accession numbers are never reused or overwritten`);
    } catch (error) { errors.push(error instanceof Error ? error.message : "Invalid physical-copy row"); }
    rows.push({ rowNumber: index + 2, action: errors.length ? "ERROR" : warnings.some((w) => w.includes("already exists")) ? "SKIP" : "CREATE", normalized, errors, warnings });
  }
  return preview("copies", rows);
}

export async function applyLibraryCopyImport(client: ImportClient, checked: LibraryImportPreview, actorId: string) {
  if (checked.kind !== "copies") throw new Error("A physical-copy preview is required");
  let created = 0, skipped = 0;
  for (const row of checked.rows) {
    if (row.action !== "CREATE") { skipped += 1; continue; }
    await createLibraryCopyInTransaction(client, row.normalized, actorId, `Created by confirmed copy import from CSV Row ${row.rowNumber}`);
    created += 1;
  }
  return { created, skipped, errors: checked.rows.filter((r) => r.action === "ERROR").flatMap((r) => r.errors.map((reason) => `CSV Row ${r.rowNumber}: ${reason}`)) };
}

export const LIBRARY_TITLE_TEMPLATE_HEADERS = ["titleCode", "title", "subtitle", "authors", "isbn", "edition", "publisherName", "publisherVendorCode", "publicationYear", "language", "subject", "category", "classificationNumber", "defaultShelfCode", "status"];
export const LIBRARY_COPY_TEMPLATE_HEADERS = ["accessionNumber", "titleCode", "barcodeValue", "acquisitionDate", "acquisitionType", "acquisitionCost", "vendorCode", "expenseNumber", "donorName", "invoiceNumber", "condition", "status", "shelfCode", "notes"];
export function libraryImportTemplate(kind: "titles" | "copies") {
  const headers = kind === "titles" ? LIBRARY_TITLE_TEMPLATE_HEADERS : LIBRARY_COPY_TEMPLATE_HEADERS;
  const example = kind === "titles" ? ["LIB-TITLE-001", "Example title", "", "Example author", "9780000000002", "1st", "Example publisher", "", "2026", "English", "General", "Reference", "000", "A-01", "ACTIVE"] : ["LIB-2026-00001", "LIB-TITLE-001", "", "2026-07-15", "PURCHASED", "250.00", "", "", "", "INV-001", "GOOD", "AVAILABLE", "A-01", "Example only"];
  return [headers, example].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
