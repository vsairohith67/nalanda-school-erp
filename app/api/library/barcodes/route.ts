import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { barcodeCoverage } from "@/lib/library-barcodes";
import { prisma } from "@/lib/prisma";
export async function GET() { const auth = await requireApiPermission("VIEW_LIBRARY_BARCODES"); if (auth.response) return auth.response; const data = await barcodeCoverage(prisma); return NextResponse.json({ summary: data.summary, copies: data.copies.map((c) => ({ accessionNumber: c.accessionNumber, barcodeValue: c.barcodeValue, status: c.status, condition: c.condition, shelfCode: c.shelfCode, title: c.title })), recentEvents: data.recentEvents }); }
