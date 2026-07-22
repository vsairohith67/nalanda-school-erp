import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { activateWhatsAppProfile, pauseWhatsAppProfile, updateWhatsAppCostCapPolicy } from "@/lib/whatsapp-profiles";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("MANAGE_WHATSAPP_INTEGRATION");
  if (auth.response) return auth.response;
  try {
    const body = await request.json(), id = (await params).id;
    const profile = body.action === "activate"
      ? await activateWhatsAppProfile(prisma, id, auth.user, String(body.confirmation ?? ""))
      : body.action === "pause"
        ? await pauseWhatsAppProfile(prisma, id, auth.user)
        : body.action === "cost-policy"
          ? await updateWhatsAppCostCapPolicy(prisma, id, body, auth.user)
        : null;
    if (!profile) throw new Error("Unsupported profile action.");
    return NextResponse.json({ profile });
  } catch (error) { return NextResponse.json({ error: safeClientError(error, "Profile update failed.") }, { status: 400 }); }
}
