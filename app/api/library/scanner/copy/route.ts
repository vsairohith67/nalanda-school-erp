import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { normalizeBarcodeValue } from "@/lib/library-barcodes";
import { deriveOverdue } from "@/lib/library-circulation";
import { prisma } from "@/lib/prisma";

const copyInclude = { title: { select: { titleCode: true, title: true } }, loans: { where: { status: "ISSUED" as const }, include: { member: { select: { memberCode: true, memberType: true } } } }, incidents: { where: { status: { not: "RESOLVED" as const } }, select: { incidentNumber: true, incidentType: true, status: true } } };

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("USE_LIBRARY_SCANNER");
  if (auth.response) return auth.response;
  const raw = request.nextUrl.searchParams.get("value") ?? "";
  const fallback = request.nextUrl.searchParams.get("accessionFallback") === "true";
  try {
    let copy = null;
    try { copy = await prisma.libraryCopy.findUnique({ where: { barcodeValue: normalizeBarcodeValue(raw) }, include: copyInclude }); } catch (error) { if (!fallback) throw error; }
    if (!copy && fallback) copy = await prisma.libraryCopy.findUnique({ where: { accessionNumber: raw.trim().toUpperCase() }, include: copyInclude });
    if (!copy) return NextResponse.json({ error: "No exact barcode or enabled accession-number match" }, { status: 404 });
    const loan = copy.loans[0];
    return NextResponse.json({ copy: { accessionNumber: copy.accessionNumber, barcodeValue: copy.barcodeValue, titleCode: copy.title.titleCode, title: copy.title.title, status: copy.status, condition: copy.condition, shelfCode: copy.shelfCode, availability: copy.status === "AVAILABLE" && !loan ? "AVAILABLE" : loan ? "ON_LOAN" : "BLOCKED", activeLoan: loan ? { memberCode: loan.member.memberCode, dueDate: loan.dueDate, ...deriveOverdue(loan) } : null, incidents: copy.incidents.map((i) => ({ incidentNumber: i.incidentNumber, type: i.incidentType, status: i.status })) } });
  } catch (error) { return NextResponse.json({ error: safeClientError(error, "Invalid barcode") }, { status: 400 }); }
}
