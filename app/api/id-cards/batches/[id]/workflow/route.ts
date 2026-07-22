import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { approveIdentityCardBatch, cancelIdentityCardBatch, issueIdentityCardBatch, previewIdentityCardBatch } from "@/lib/id-card-batches";
import { idCardApiError } from "@/lib/id-card-api";

const PERMISSION: Record<string, string> = { preview: "MANAGE_ID_CARD_BATCHES", approve: "APPROVE_ID_CARDS", issue: "ISSUE_ID_CARDS", cancel: "MANAGE_ID_CARD_BATCHES" };
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json(), action = String(body.action ?? ""), permission = PERMISSION[action];
    if (!permission) throw new Error("Unsupported batch action.");
    const auth = await requireApiPermission(permission as any); if (auth.response) return auth.response;
    const id = (await params).id;
    const result = action === "preview" ? await previewIdentityCardBatch(prisma, id, auth.user.id)
      : action === "approve" ? await approveIdentityCardBatch(prisma, id, auth.user.id, body.expectedUpdatedAt)
      : action === "issue" ? await issueIdentityCardBatch(prisma, id, auth.user.id)
      : await cancelIdentityCardBatch(prisma, id, auth.user.id, body.reason);
    return NextResponse.json({ result });
  } catch (error) { return idCardApiError(error); }
}
