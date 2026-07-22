import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { CLASS_X_POST_APPROVAL_CANCEL_STATUSES, transitionClassXPackage } from "@/lib/class-x-document-packages";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const body = await request.json(), action = String(body.action ?? "").toLowerCase();
  const id = (await params).id;
  if (action === "cancel") {
    const view = await requireApiPermission("VIEW_CLASS_X_PACKAGES");
    if (view.response) return view.response;
  }
  const current = action === "cancel" ? await prisma.classXDocumentPackage.findUnique({ where: { id }, select: { status: true } }) : null;
  const postApprovalCancel = Boolean(current && (CLASS_X_POST_APPROVAL_CANCEL_STATUSES as readonly string[]).includes(current.status));
  const auth = action === "review" ? await requireApiPermission("REVIEW_CLASS_X_PACKAGES")
    : action === "approve" ? await requireApiPermission("APPROVE_CLASS_X_PACKAGES")
    : action === "complete" ? await requireApiPermission("HANDOVER_CLASS_X_DOCUMENTS")
    : action === "cancel" && postApprovalCancel ? await requireApiPermission("APPROVE_CLASS_X_PACKAGES")
    : await requireApiPermission("MANAGE_CLASS_X_PACKAGES");
  if (auth.response) return auth.response;
  if (!["submit", "review", "approve", "complete", "cancel"].includes(action)) return NextResponse.json({ error: "Package action is not supported" }, { status: 400 });
  try { const row = await transitionClassXPackage(prisma, id, action as never, auth.user.id, { ...body, postApprovalAuthorized: postApprovalCancel }); return NextResponse.json({ package: { id: row.id, packageNumber: row.packageNumber, status: row.status, updatedAt: row.updatedAt } }); }
  catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to update package") }, { status: 400 }); }
}
