import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { CODE39_BASIC_PATTERN } from "@/lib/library-barcodes";
import { renderCode39Svg } from "@/lib/library-barcode-svg";
import { prisma } from "@/lib/prisma";
export async function GET(request: NextRequest) { const auth = await requireApiPermission("PRINT_LIBRARY_BARCODE_LABELS"); if (auth.response) return auth.response; const values = request.nextUrl.searchParams.getAll("accession").map((v) => v.trim().toUpperCase()).filter(Boolean).slice(0, 200); const copies = await prisma.libraryCopy.findMany({ where: { accessionNumber: { in: values } }, select: { accessionNumber: true, barcodeValue: true, shelfCode: true, title: { select: { title: true } } }, orderBy: { accessionNumber: "asc" } }); return NextResponse.json({ labels: copies.filter((c) => c.barcodeValue && CODE39_BASIC_PATTERN.test(c.barcodeValue)).map((c) => ({ accessionNumber: c.accessionNumber, barcodeValue: c.barcodeValue!, shelfCode: c.shelfCode, title: c.title.title, svg: renderCode39Svg(c.barcodeValue) })) }); }
