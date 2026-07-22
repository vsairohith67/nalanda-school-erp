import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { idCardApiError } from "@/lib/id-card-api";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("MANAGE_ID_CARD_NUMBER_SERIES");
  if (auth.response) return auth.response;
  try {
    const status = String((await request.json()).status ?? "");
    if (!["ACTIVE", "INACTIVE"].includes(status)) throw new Error("Number-series status must be ACTIVE or INACTIVE.");
    const series = await prisma.identityCardNumberSeries.update({
      where: { id: (await params).id },
      data: { status, ...(status === "INACTIVE" ? { isDefault: false } : {}) }
    });
    return NextResponse.json({ series });
  } catch (error) {
    return idCardApiError(error);
  }
}
