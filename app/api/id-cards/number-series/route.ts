import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateIdentityCardSeriesInput } from "@/lib/id-card-numbering";
import { idCardApiError } from "@/lib/id-card-api";

export async function GET() {
  const auth = await requireApiPermission("VIEW_ID_CARDS"); if (auth.response) return auth.response;
  return NextResponse.json({ series: await prisma.identityCardNumberSeries.findMany({ orderBy: [{ cardType: "asc" }, { seriesCode: "asc" }] }) });
}
export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("MANAGE_ID_CARD_NUMBER_SERIES"); if (auth.response) return auth.response;
  try {
    const data = validateIdentityCardSeriesInput(await request.json());
    const series = await prisma.$transaction(async (tx) => {
      if (data.isDefault && data.status === "ACTIVE") await tx.identityCardNumberSeries.updateMany({ where: { cardType: data.cardType, academicYear: data.academicYear, status: "ACTIVE", isDefault: true }, data: { isDefault: false } });
      return tx.identityCardNumberSeries.create({ data: { ...data, createdByUserId: auth.user.id } });
    });
    return NextResponse.json({ series }, { status: 201 });
  } catch (error) { return idCardApiError(error); }
}
