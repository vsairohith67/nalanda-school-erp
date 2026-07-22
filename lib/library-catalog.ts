import type { Prisma, PrismaClient } from "@prisma/client";

export const LIBRARY_TITLE_STATUSES = ["ACTIVE", "INACTIVE"] as const;

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

export function normalizeLibraryTitleCode(value: unknown) {
  const raw = text(value, "Title code", 50, true)!;
  const code = raw.toUpperCase().replace(/\s+/g, "-").replace(/[^A-Z0-9_-]/g, "").replace(/[-_]+/g, "-").replace(/^-|-$/g, "");
  if (!code) throw new Error("Title code must contain letters or numbers");
  return code;
}

export function normalizeIsbn(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const isbn = raw.toUpperCase().replace(/[^0-9X]/g, "");
  if (![10, 13].includes(isbn.length) || (isbn.includes("X") && !(isbn.length === 10 && isbn.endsWith("X")))) {
    throw new Error("ISBN must contain 10 or 13 digits (ISBN-10 may end in X)");
  }
  return isbn;
}

export function validateLibraryTitleInput(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Library title details are required");
  const row = input as Record<string, unknown>;
  const yearText = String(row.publicationYear ?? "").trim();
  const publicationYear = yearText ? Number(yearText) : null;
  if (publicationYear !== null && (!Number.isInteger(publicationYear) || publicationYear < 1000 || publicationYear > new Date().getFullYear() + 1)) {
    throw new Error("Publication year must be a valid four-digit year");
  }
  return {
    titleCode: normalizeLibraryTitleCode(row.titleCode),
    title: text(row.title, "Title", 240, true)!,
    subtitle: text(row.subtitle, "Subtitle", 240),
    authors: text(row.authors, "Authors", 500, true)!,
    isbn: normalizeIsbn(row.isbn),
    edition: text(row.edition, "Edition", 80),
    publisherName: text(row.publisherName, "Publisher name", 180),
    publisherVendorId: text(row.publisherVendorId, "Publisher Vendor", 80),
    publicationYear,
    language: text(row.language, "Language", 80),
    subject: text(row.subject, "Subject", 120),
    category: text(row.category, "Category", 120),
    classificationNumber: text(row.classificationNumber, "Classification number", 80),
    defaultShelfCode: text(row.defaultShelfCode, "Default shelf code", 80)?.toUpperCase() ?? null,
    description: text(row.description, "Description", 2000),
    status: oneOf(row.status ?? "ACTIVE", LIBRARY_TITLE_STATUSES, "Title status")
  };
}

type CatalogClient = Pick<PrismaClient | Prisma.TransactionClient, "libraryTitle" | "vendor">;

export async function validateLibraryPublisherLink(client: CatalogClient, publisherVendorId: string | null) {
  if (!publisherVendorId) return;
  const vendor = await client.vendor.findFirst({ where: { id: publisherVendorId, status: "ACTIVE" }, select: { id: true } });
  if (!vendor) throw new Error("Publisher Vendor must be an active Vendor");
}

export async function createLibraryTitle(client: CatalogClient, input: unknown, actorId?: string | null) {
  const data = validateLibraryTitleInput(input);
  await validateLibraryPublisherLink(client, data.publisherVendorId);
  try {
    return await client.libraryTitle.create({ data: { ...data, createdByUserId: actorId ?? null }, include: libraryTitleInclude });
  } catch (error: any) {
    if (error?.code === "P2002") throw new Error(String(error?.meta?.target ?? "").includes("isbn") ? "This normalized ISBN already belongs to another library title" : "This normalized title code already exists");
    throw error;
  }
}

export async function updateLibraryTitle(client: CatalogClient, id: string, input: unknown) {
  const current = await client.libraryTitle.findUnique({ where: { id } });
  if (!current) throw new Error("Library title not found");
  const data = validateLibraryTitleInput({ ...current, ...(input as object) });
  await validateLibraryPublisherLink(client, data.publisherVendorId);
  try {
    return await client.libraryTitle.update({ where: { id }, data, include: libraryTitleInclude });
  } catch (error: any) {
    if (error?.code === "P2002") throw new Error(String(error?.meta?.target ?? "").includes("isbn") ? "This normalized ISBN already belongs to another library title" : "This normalized title code already exists");
    throw error;
  }
}

export async function assertLibraryTitleCanDelete(client: CatalogClient, id: string) {
  const title = await client.libraryTitle.findUnique({ where: { id }, select: { _count: { select: { copies: true } } } });
  if (!title) throw new Error("Library title not found");
  if (title._count.copies) throw new Error("Linked library titles cannot be deleted; mark the title inactive instead");
  throw new Error("Library titles are retained for audit safety; mark the title inactive instead");
}

export const libraryTitleInclude = {
  publisherVendor: { select: { id: true, vendorCode: true, name: true } },
  _count: { select: { copies: true } }
};

export function serializeLibraryTitle(row: any) {
  return {
    id: row.id,
    titleCode: row.titleCode,
    title: row.title,
    subtitle: row.subtitle,
    authors: row.authors,
    isbn: row.isbn,
    edition: row.edition,
    publisherName: row.publisherName,
    publisherVendor: row.publisherVendor ? { id: row.publisherVendor.id, vendorCode: row.publisherVendor.vendorCode, name: row.publisherVendor.name } : null,
    publicationYear: row.publicationYear,
    language: row.language,
    subject: row.subject,
    category: row.category,
    classificationNumber: row.classificationNumber,
    defaultShelfCode: row.defaultShelfCode,
    description: row.description,
    status: row.status,
    copyCount: row._count?.copies ?? row.copies?.length ?? 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export function libraryTitleWhere(search: Record<string, string | undefined>) {
  const q = search.q?.trim();
  return {
    ...(q ? { OR: ["titleCode", "title", "authors", "isbn", "publisherName", "subject"].map((field) => ({ [field]: { contains: q } })) } : {}),
    ...(search.status ? { status: search.status } : {}),
    ...(search.language ? { language: search.language } : {}),
    ...(search.subject ? { subject: search.subject } : {}),
    ...(search.category ? { category: search.category } : {})
  };
}
