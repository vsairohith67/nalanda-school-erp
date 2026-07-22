import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { updateBoardDocument } from "@/lib/class-x-document-items";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const auth = await requireApiPermission("MANAGE_CLASS_X_DOCUMENT_CUSTODY"); if (auth.response) return auth.response;
  try { const p = await params, body = await request.json(), action = String(body.action ?? "").toLowerCase(); if (!["request", "receive", "verify", "not_applicable"].includes(action)) throw new Error("Document action is not supported"); return NextResponse.json({ item: await updateBoardDocument(prisma, p.id, p.itemId, action as never, body, auth.user.id) }); }
  catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to update Board document custody") }, { status: 400 }); }
}
