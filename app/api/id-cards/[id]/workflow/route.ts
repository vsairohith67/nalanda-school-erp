import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cancelIdentityCard, correctIdentityCard, issueIdentityCard, replaceIdentityCard, revokeIdentityCard, transitionIdentityCard } from "@/lib/identity-cards";
import { idCardApiError } from "@/lib/id-card-api";
import { NextResponse } from "next/server";

const PERMISSION: Record<string, string> = { review: "CREATE_ID_CARDS", approve: "APPROVE_ID_CARDS", issue: "ISSUE_ID_CARDS", correct: "CORRECT_ISSUED_ID_CARDS", replace: "REPLACE_ID_CARDS", revoke: "REVOKE_ID_CARDS", cancel: "CREATE_ID_CARDS" };
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json(), action = String(body.action ?? ""), permission = PERMISSION[action];
    if (!permission) throw new Error("Unsupported ID-card action.");
    const auth = await requireApiPermission(permission as any); if (auth.response) return auth.response;
    const id = (await params).id;
    const result = action === "review" || action === "approve" ? await transitionIdentityCard(prisma, id, action, auth.user.id, body.expectedUpdatedAt)
      : action === "issue" ? await issueIdentityCard(prisma, id, auth.user.id, body.expectedUpdatedAt)
      : action === "correct" ? await correctIdentityCard(prisma, id, auth.user.id, body.reason)
      : action === "replace" ? await replaceIdentityCard(prisma, id, auth.user.id, body.reason)
      : action === "revoke" ? await revokeIdentityCard(prisma, id, auth.user.id, body.reason)
      : await cancelIdentityCard(prisma, id, auth.user.id, body.reason);
    return NextResponse.json({ result });
  } catch (error) { return idCardApiError(error); }
}
