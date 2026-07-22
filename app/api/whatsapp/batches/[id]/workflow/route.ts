import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import type { Permission } from "@/lib/permissions";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { approveWhatsAppBatch, cancelWhatsAppBatch, overrideWhatsAppCostCap, queueWhatsAppBatch, retryWhatsAppBatchFailures, submitWhatsAppBatch } from "@/lib/whatsapp-batches";

const PERMISSION: Record<string, Permission> = {
  submit: "CREATE_WHATSAPP_BATCHES", approve: "APPROVE_WHATSAPP_BATCHES", send: "SEND_WHATSAPP_BATCHES",
  schedule: "SCHEDULE_WHATSAPP_BATCHES", cancel: "CANCEL_WHATSAPP_BATCHES", retry: "RETRY_WHATSAPP_DELIVERIES"
  , "override-cost-cap": "OVERRIDE_WHATSAPP_COST_CAP"
};
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const body = await request.json(), action = String(body.action ?? ""), permission = PERMISSION[action];
  if (!permission) return NextResponse.json({ error: "Unsupported batch action." }, { status: 400 });
  const auth = await requireApiPermission(permission);
  if (auth.response) return auth.response;
  try {
    const id = (await params).id;
    const result = action === "submit" ? await submitWhatsAppBatch(prisma, id)
      : action === "override-cost-cap" ? await overrideWhatsAppCostCap(prisma, id, auth.user, body.reason)
      : action === "approve" ? await approveWhatsAppBatch(prisma, id, auth.user, body.notes)
      : action === "send" ? await queueWhatsAppBatch(prisma, id, auth.user, body)
      : action === "schedule" ? await queueWhatsAppBatch(prisma, id, auth.user, body)
      : action === "cancel" ? await cancelWhatsAppBatch(prisma, id, auth.user, body.reason)
      : await retryWhatsAppBatchFailures(prisma, id);
    return NextResponse.json({ result });
  } catch (error) { return NextResponse.json({ error: safeClientError(error, "Batch action failed.") }, { status: 400 }); }
}
