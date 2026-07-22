import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { assertBookItemCanDelete, validateBookCatalogItemInput } from "@/lib/books-finance";
import { prisma } from "@/lib/prisma";

const serializeCatalogItem = (item: any) => ({
  id: item.id,
  itemCode: item.itemCode,
  title: item.title,
  itemType: item.itemType,
  publisherVendorId: item.publisherVendorId,
  publisherVendor: item.publisherVendor ?? null,
  className: item.className,
  subject: item.subject,
  description: item.description,
  studentLinkRequired: item.studentLinkRequired,
  status: item.status,
  rates: (item.rates ?? []).map((rate: any) => ({
    id: rate.id,
    itemId: rate.itemId,
    academicYear: rate.academicYear,
    amount: rate.amount.toString(),
    effectiveFrom: rate.effectiveFrom,
    effectiveTo: rate.effectiveTo,
    status: rate.status,
    notes: rate.notes
  }))
});

export async function GET() { const auth = await requireApiPermission("VIEW_BOOKS_FINANCE"); if (auth.response) return auth.response; const items = await prisma.bookCatalogItem.findMany({ include: { publisherVendor: { select: { id: true, vendorCode: true, name: true } }, rates: { orderBy: [{ academicYear: "desc" }, { effectiveFrom: "desc" }] } }, orderBy: { title: "asc" } }); return NextResponse.json({ items: items.map(serializeCatalogItem) }); }

export async function POST(request: NextRequest) { const auth = await requireApiPermission("MANAGE_BOOK_CATALOG"); if (auth.response) return auth.response; try { const data = validateBookCatalogItemInput(await request.json()); if (data.publisherVendorId && !(await prisma.vendor.findFirst({ where: { id: data.publisherVendorId, status: "ACTIVE" }, select: { id: true } }))) throw new Error("Publisher vendor must be active"); const item = await prisma.bookCatalogItem.create({ data: { ...data, createdByUserId: auth.user.id }, include: { publisherVendor: { select: { id: true, vendorCode: true, name: true } }, rates: true } }); return NextResponse.json({ item: serializeCatalogItem(item) }, { status: 201 }); } catch (error: any) { const message = error?.code === "P2002" ? "Book item code already exists" : safeClientError(error, "Unable to create catalog item"); return NextResponse.json({ error: message }, { status: 400 }); } }

export async function PATCH(request: NextRequest) { const auth = await requireApiPermission("MANAGE_BOOK_CATALOG"); if (auth.response) return auth.response; try { const body = await request.json(); const id = String(body.id ?? ""); if (!id) throw new Error("Catalog item is required"); const current = await prisma.bookCatalogItem.findUnique({ where: { id } }); if (!current) throw new Error("Catalog item not found"); const data = validateBookCatalogItemInput({ ...current, ...body }); const item = await prisma.bookCatalogItem.update({ where: { id }, data, include: { publisherVendor: { select: { id: true, vendorCode: true, name: true } }, rates: true } }); return NextResponse.json({ item: serializeCatalogItem(item) }); } catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to update catalog item") }, { status: 400 }); } }

export async function DELETE(request: NextRequest) { const auth = await requireApiPermission("MANAGE_BOOK_CATALOG"); if (auth.response) return auth.response; try { const id = request.nextUrl.searchParams.get("id") ?? ""; await assertBookItemCanDelete(prisma, id); await prisma.bookCatalogItem.delete({ where: { id } }); return NextResponse.json({ ok: true }); } catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to delete catalog item") }, { status: 400 }); } }
