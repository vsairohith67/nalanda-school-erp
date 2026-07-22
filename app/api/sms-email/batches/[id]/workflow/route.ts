import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { approveSmsEmailBatch, cancelSmsEmailBatch, overrideSmsEmailCostCap, queueSmsEmailBatch, retrySmsEmailBatch, submitSmsEmailBatch } from "@/lib/sms-email-batches";
import type { Permission } from "@/lib/permissions";

const permission: Record<string, string> = {
  submit: "CREATE_SMS_EMAIL_BATCHES", approve: "APPROVE_SMS_EMAIL_BATCHES", send: "SEND_SMS_EMAIL_BATCHES",
  schedule: "SCHEDULE_SMS_EMAIL_BATCHES", retry: "RETRY_SMS_EMAIL_DELIVERIES", cancel: "CANCEL_SMS_EMAIL_BATCHES",
  "override-cost-cap": "OVERRIDE_SMS_EMAIL_LIMITS"
};
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const body = await request.json().catch(() => ({})), action = String(body.action ?? ""), required = permission[action];
  if (!required) return NextResponse.json({ error: "Unsupported batch action." }, { status: 400 });
  const auth = await requireApiPermission(required as Permission); if (auth.response) return auth.response;
  const id = (await params).id;
  try {
    const batch = action === "submit" ? await submitSmsEmailBatch(prisma, id)
      : action === "approve" ? await approveSmsEmailBatch(prisma, id, auth.user, body.notes)
      : action === "send" || action === "schedule" ? await queueSmsEmailBatch(prisma, id, auth.user, body)
      : action === "retry" ? await retrySmsEmailBatch(prisma, id)
      : action === "cancel" ? await cancelSmsEmailBatch(prisma, id, auth.user, body.reason)
      : await overrideSmsEmailCostCap(prisma, id, auth.user, body.reason);
    return NextResponse.json({ batch });
  } catch (error) { return NextResponse.json({ error: safeClientError(error, "Batch action failed.") }, { status: 400 }); }
}
