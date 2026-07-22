import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { idCardApiError } from "@/lib/id-card-api";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("MANAGE_ID_CARD_TEMPLATES"); if (auth.response) return auth.response;
  try {
    const body = await request.json(), status = String(body.status ?? "");
    if (!["ACTIVE", "INACTIVE"].includes(status)) throw new Error("Template status must be ACTIVE or INACTIVE.");
    return NextResponse.json({ template: await prisma.identityCardTemplate.update({ where: { id: (await params).id }, data: { status, ...(status === "ACTIVE" ? { activatedByUserId: auth.user.id } : {}) } }) });
  } catch (error) { return idCardApiError(error); }
}
