import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createIdentityCardBatch } from "@/lib/id-card-batches";
import { idCardApiError } from "@/lib/id-card-api";

export async function GET() {
  const auth = await requireApiPermission("VIEW_ID_CARDS"); if (auth.response) return auth.response;
  return NextResponse.json({ batches: await prisma.identityCardBatch.findMany({ include: { template: { select: { name: true } } }, orderBy: { createdAt: "desc" } }) });
}
export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("MANAGE_ID_CARD_BATCHES"); if (auth.response) return auth.response;
  try { return NextResponse.json({ batch: await createIdentityCardBatch(prisma, await request.json(), auth.user.id) }, { status: 201 }); }
  catch (error) { return idCardApiError(error); }
}
