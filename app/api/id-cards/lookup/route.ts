import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { exactIdentityCardLookup } from "@/lib/id-card-lookup";
import { idCardApiError } from "@/lib/id-card-api";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("USE_ID_CARD_LOOKUP"); if (auth.response) return auth.response;
  try {
    const result = await exactIdentityCardLookup(prisma, request.nextUrl.searchParams.get("cardNumber"), auth.user.id);
    return result ? NextResponse.json({ result }) : NextResponse.json({ error: "No exact ID-card number matched." }, { status: 404 });
  } catch (error) { return idCardApiError(error); }
}
