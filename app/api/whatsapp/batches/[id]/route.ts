import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("VIEW_WHATSAPP_DELIVERIES");
  if (auth.response) return auth.response;
  const batch = await prisma.whatsAppOutboundBatch.findUnique({
    where: { id: (await params).id },
    include: {
      integrationProfile: { select: { profileCode: true, displayName: true, mode: true, status: true } },
      templateMapping: { select: { mappingCode: true, metaTemplateName: true, metaTemplateLanguage: true, metaTemplateCategory: true, providerStatus: true } },
      notificationCampaign: { select: { campaignNumber: true, category: true, priority: true, title: true, status: true } },
      deliveries: {
        select: {
          id: true, subjectType: true, safeDisplayLabel: true, phoneLast4: true, countryCode: true,
          status: true, providerErrorCategory: true, failureMessageSafe: true, attemptCount: true,
          acceptedAt: true, sentAt: true, deliveredAt: true, readAt: auth.user.role === "VIEWER" ? false : true,
          createdAt: true
        },
        orderBy: { createdAt: "asc" }
      }
    }
  });
  return batch ? NextResponse.json({ batch }) : NextResponse.json({ error: "WhatsApp batch was not found." }, { status: 404 });
}
