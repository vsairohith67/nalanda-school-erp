import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildIdentityCardSourceSnapshot } from "@/lib/id-card-snapshots";
import { previewIdentityCardNumber } from "@/lib/id-card-numbering";
import { isIdentityCardType } from "@/lib/id-card-templates";
import { idCardApiError } from "@/lib/id-card-api";

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("CREATE_ID_CARDS"); if (auth.response) return auth.response;
  try {
    const body = await request.json(), cardType = String(body.cardType ?? "").toUpperCase();
    if (!isIdentityCardType(cardType)) throw new Error("Card type must be STUDENT or STAFF.");
    const template = await prisma.identityCardTemplate.findUnique({ where: { id: String(body.templateId ?? "") } });
    if (!template || template.status !== "ACTIVE" || template.cardType !== cardType) throw new Error("Choose an active matching template.");
    const validFrom = new Date(`${String(body.validFrom)}T00:00:00.000Z`), validUntil = new Date(`${String(body.validUntil)}T00:00:00.000Z`);
    const [snapshot, numberPreview] = await Promise.all([
      buildIdentityCardSourceSnapshot(prisma, { cardType, studentId: body.studentId, staffMemberId: body.staffMemberId, academicYear: String(body.academicYear ?? "") || null, validFrom, validUntil }, template),
      previewIdentityCardNumber(prisma, cardType, String(body.academicYear ?? "") || null)
    ]);
    return NextResponse.json({ preview: snapshot, numberPreview, numberConsumed: false, photoDecision: "PLACEHOLDER_NO_MANAGED_SOURCE" });
  } catch (error) { return idCardApiError(error); }
}
