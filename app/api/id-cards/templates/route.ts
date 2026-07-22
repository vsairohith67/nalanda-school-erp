import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateIdentityCardTemplateInput } from "@/lib/id-card-templates";
import { idCardApiError } from "@/lib/id-card-api";

export async function GET() {
  const auth = await requireApiPermission("VIEW_ID_CARDS"); if (auth.response) return auth.response;
  return NextResponse.json({ templates: await prisma.identityCardTemplate.findMany({ orderBy: [{ cardType: "asc" }, { templateCode: "asc" }] }) });
}
export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("MANAGE_ID_CARD_TEMPLATES"); if (auth.response) return auth.response;
  try { const data = validateIdentityCardTemplateInput(await request.json()); return NextResponse.json({ template: await prisma.identityCardTemplate.create({ data: { ...data, createdByUserId: auth.user.id, activatedByUserId: data.status === "ACTIVE" ? auth.user.id : null } }) }, { status: 201 }); }
  catch (error) { return idCardApiError(error); }
}
