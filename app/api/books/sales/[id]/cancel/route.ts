import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { cancelBookSaleReceipt, serializeBookReceipt } from "@/lib/books-finance";
import { prisma } from "@/lib/prisma";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const auth = await requireApiPermission("CANCEL_BOOK_SALES"); if (auth.response) return auth.response; try { const body = await request.json(); const receipt = await cancelBookSaleReceipt(prisma, (await params).id, body.reason, auth.user.id); return NextResponse.json({ receipt: serializeBookReceipt(receipt) }); } catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to cancel book-sale receipt") }, { status: 400 }); } }
