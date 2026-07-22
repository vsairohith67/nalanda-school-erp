import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { confirmOcrStudentMatch, markOcrRowDuplicate, rejectOcrRow, resolveOcrDuplicate, updateOcrRow, verifyOcrRow } from "@/lib/fee-register-ocr";

export async function GET(_: NextRequest, { params }: { params: Promise<{ rowId: string }> }) {
  const auth = await requireApiPermission("REVIEW_FEE_REGISTER_OCR_ROWS"); if (auth.response) return auth.response;
  const row = await prisma.feeRegisterOcrRow.findUnique({ where: { id: (await params).rowId }, include: { revisions: { orderBy: { revisionNumber: "asc" } }, page: { include: { batch: true } } } });
  return row ? NextResponse.json({ row }) : NextResponse.json({ error: "OCR row not found" }, { status: 404 });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ rowId: string }> }) {
  const body = await request.json().catch(() => ({})), action = String(body.action ?? "update");
  const permission = ["resolveDuplicate", "markDuplicate"].includes(action) ? "RESOLVE_FEE_REGISTER_OCR_DUPLICATES" : "REVIEW_FEE_REGISTER_OCR_ROWS";
  const auth = await requireApiPermission(permission); if (auth.response) return auth.response;
  try {
    const rowId = (await params).rowId;
    if (action === "update") return NextResponse.json({ row: await updateOcrRow(prisma, rowId, body, auth.user.id) });
    if (action === "match") return NextResponse.json({ row: await confirmOcrStudentMatch(prisma, rowId, String(body.studentId ?? ""), auth.user.id) });
    if (action === "verify") return NextResponse.json({ row: await verifyOcrRow(prisma, rowId, body.checklist ?? {}, auth.user.id) });
    if (action === "reject") { await rejectOcrRow(prisma, rowId, body.reason, auth.user.id); return NextResponse.json({ ok: true }); }
    if (action === "markDuplicate") return NextResponse.json({ row: await markOcrRowDuplicate(prisma, rowId, body.reason, auth.user.id) });
    if (action === "resolveDuplicate") return NextResponse.json({ duplicate: await resolveOcrDuplicate(prisma, rowId, body, auth.user.id) });
    throw new Error("Unsupported OCR row action");
  } catch (error) { return NextResponse.json({ error: safeClientError(error, "OCR row update failed safely") }, { status: 400 }); }
}
