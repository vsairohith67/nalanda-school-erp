import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { assertNoBookRateOverlap, validateBookRateInput } from "@/lib/books-finance";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) { const auth = await requireApiPermission("MANAGE_BOOK_RATES"); if (auth.response) return auth.response; try { const data = validateBookRateInput(await request.json()); if (!(await prisma.bookCatalogItem.findFirst({ where: { id: data.itemId, status: "ACTIVE" }, select: { id: true } }))) throw new Error("Catalog item must be active"); await assertNoBookRateOverlap(prisma, data); const rate = await prisma.bookCatalogRate.create({ data }); return NextResponse.json({ rate: { ...rate, amount: rate.amount.toString() } }, { status: 201 }); } catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to create book rate") }, { status: 400 }); } }

export async function PATCH(request: NextRequest) { const auth = await requireApiPermission("MANAGE_BOOK_RATES"); if (auth.response) return auth.response; try { const body = await request.json(); const id = String(body.id ?? ""); const current = await prisma.bookCatalogRate.findUnique({ where: { id } }); if (!current) throw new Error("Book rate not found"); const data = validateBookRateInput({ ...current, ...body }); await assertNoBookRateOverlap(prisma, data, id); const rate = await prisma.bookCatalogRate.update({ where: { id }, data }); return NextResponse.json({ rate: { ...rate, amount: rate.amount.toString() } }); } catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to update book rate") }, { status: 400 }); } }
