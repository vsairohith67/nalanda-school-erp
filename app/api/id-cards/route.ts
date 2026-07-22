import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createIdentityCardDraft, effectiveIdentityCardStatus } from "@/lib/identity-cards";
import { idCardApiError } from "@/lib/id-card-api";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_ID_CARDS"); if (auth.response) return auth.response;
  const q = request.nextUrl.searchParams;
  const cards = await prisma.identityCard.findMany({ where: { ...(q.get("type") ? { cardType: q.get("type")! } : {}), ...(q.get("status") ? { status: q.get("status")! } : {}), ...(q.get("academicYear") ? { academicYear: q.get("academicYear")! } : {}) }, include: { student: { select: { studentName: true, admissionNo: true } }, staffMember: { select: { fullName: true, staffCode: true, designation: true } } }, orderBy: { createdAt: "desc" }, take: 300 });
  return NextResponse.json({ cards: cards.map((card) => ({ ...card, createdByUserId: undefined, approvedByUserId: undefined, issuedByUserId: undefined, revokedByUserId: undefined, cancelledByUserId: undefined, effectiveStatus: effectiveIdentityCardStatus(card) })) });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("CREATE_ID_CARDS"); if (auth.response) return auth.response;
  try { return NextResponse.json({ card: await createIdentityCardDraft(prisma, await request.json(), auth.user.id) }, { status: 201 }); }
  catch (error) { return idCardApiError(error); }
}
