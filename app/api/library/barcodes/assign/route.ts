import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { assignLibraryBarcode } from "@/lib/library-barcodes";
import { prisma } from "@/lib/prisma";
export async function POST(request: NextRequest) { const auth = await requireApiPermission("MANAGE_LIBRARY_BARCODES"); if (auth.response) return auth.response; try { const body = await request.json(); const result = await assignLibraryBarcode(prisma, String(body.copyId ?? ""), body.barcodeValue, auth.user.id, Boolean(body.correction), body.reason); return NextResponse.json({ copy: { accessionNumber: result.copy.accessionNumber, barcodeValue: result.copy.barcodeValue }, idempotent: result.idempotent }); } catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to assign barcode") }, { status: 400 }); } }
