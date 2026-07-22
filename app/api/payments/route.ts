import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validatePaymentPayload } from "@/lib/validation";
import { requireApiPermission } from "@/lib/auth";
import {
  assertReceiptStudentMatchInDatabase,
  normalizePaymentComponents
} from "@/lib/payment-controls";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_PAYMENTS");
  if (auth.response) return auth.response;
  const searchParams = request.nextUrl.searchParams;
  const payments = await prisma.payment.findMany({
    where: {
      deletedAt: null,
      ...(searchParams.get("date") ? { date: dayRange(searchParams.get("date")!) } : {}),
      ...(searchParams.get("admissionNo") ? { admissionNo: searchParams.get("admissionNo")! } : {}),
      ...(searchParams.get("receiptNo") ? { receiptNo: searchParams.get("receiptNo")! } : {}),
      ...(searchParams.get("paymentMode") ? { paymentMode: searchParams.get("paymentMode")! } : {}),
      ...(searchParams.get("receivedAccount") ? { receivedAccount: searchParams.get("receivedAccount")! } : {})
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 500
  });
  return NextResponse.json(payments);
}

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("CREATE_PAYMENTS");
  if (auth.response) return auth.response;
  try {
    const body = await request.json();
    const components = normalizePaymentComponents(body);
    const payloads = components
      ? components.map((component) => validatePaymentPayload({ ...body, ...component }))
      : [validatePaymentPayload(body)];
    const firstPayload = payloads[0];
    if (payloads.some((payload) =>
      payload.receiptNo !== firstPayload.receiptNo ||
      payload.admissionNo !== firstPayload.admissionNo ||
      payload.date.getTime() !== firstPayload.date.getTime() ||
      payload.feeType !== firstPayload.feeType ||
      payload.termHint !== firstPayload.termHint
    )) {
      throw new Error("All payment components must use the same receipt, student, date, fee type, and term");
    }
    const student = await prisma.student.findUnique({ where: { admissionNo: firstPayload.admissionNo } });
    if (!student || student.deletedAt) throw new Error("Admission number not found in Student Master");
    const payments = await prisma.$transaction(async (tx) => {
      await assertReceiptStudentMatchInDatabase(tx, {
        receiptNo: firstPayload.receiptNo,
        admissionNo: firstPayload.admissionNo
      });
      const createdRows = [];
      for (const payload of payloads) {
        const created = await tx.payment.create({
          data: {
            ...payload,
            enteredBy: auth.user.name,
            editedBy: null,
            studentId: student.id,
            studentName: student.studentName,
            className: student.className,
            section: student.section
          }
        });
        await tx.paymentAudit.create({
          data: {
            paymentId: created.id,
            action: "CREATED",
            newValueJson: JSON.stringify(created),
            changedByUserId: auth.user.id,
            changedByName: auth.user.name,
            reason: payloads.length > 1 ? "Split receipt component created" : "Payment entry created"
          }
        });
        createdRows.push(created);
      }
      return createdRows;
    });
    return NextResponse.json({
      receiptNo: firstPayload.receiptNo,
      split: payments.length > 1,
      total: payments.reduce((sum, payment) => sum + payment.amountPaid, 0),
      payments
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: safeClientError(error, "Unable to save payment") }, { status: 400 });
  }
}

function dayRange(dateText: string) {
  const start = new Date(`${dateText}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { gte: start, lt: end };
}
