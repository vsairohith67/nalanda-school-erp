import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/auth";
import { analyzeReceiptPayments } from "@/lib/receipt-audit";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_RECEIPT_AUDIT");
  if (auth.response) return auth.response;
  const start = Number(request.nextUrl.searchParams.get("startReceiptNo"));
  const end = Number(request.nextUrl.searchParams.get("endReceiptNo"));
  if (!Number.isInteger(start) || !Number.isInteger(end) || start > end) {
    return NextResponse.json({ error: "Valid receipt range is required" }, { status: 400 });
  }
  const [payments, notes] = await Promise.all([
    prisma.payment.findMany({ where: { deletedAt: null } }),
    prisma.receiptNote.findMany()
  ]);
  const grouped = new Map<string, typeof payments>();
  for (const payment of payments) {
    grouped.set(payment.receiptNo, [...(grouped.get(payment.receiptNo) ?? []), payment]);
  }
  const noteMap = new Map(notes.map((note) => [note.receiptNo, note]));
  const rows = [];
  for (let receipt = start; receipt <= end; receipt += 1) {
    const receiptNo = String(receipt);
    const receiptPayments = grouped.get(receiptNo) ?? [];
    const note = noteMap.get(receiptNo);
    rows.push({ receiptNo, ...analyzeReceiptPayments(receiptPayments, note) });
  }
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("MANAGE_RECEIPTS");
  if (auth.response) return auth.response;
  const body = await request.json();
  const receiptNo = String(body.receiptNo ?? "").trim();
  if (!receiptNo) return NextResponse.json({ error: "Receipt number is required" }, { status: 400 });
  const note = await prisma.receiptNote.upsert({
    where: { receiptNo },
    update: { status: String(body.status ?? "Cancelled"), remarks: String(body.remarks ?? "") },
    create: { receiptNo, status: String(body.status ?? "Cancelled"), remarks: String(body.remarks ?? "") }
  });
  return NextResponse.json(note);
}
