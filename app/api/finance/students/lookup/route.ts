import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/auth";
import {
  financeStudentCalculationSelect,
  financeStudentIdentity,
  privateFinanceJson
} from "@/lib/finance-privacy";
import { getFeeStructures } from "@/lib/data";
import { allocateFees } from "@/lib/fee-allocation";
import { effectiveActiveSelectedReceiptPayments } from "@/lib/receipt-integrity";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("CREATE_PAYMENTS");
  if (auth.response) return auth.response;
  const admissionNo = request.nextUrl.searchParams.get("admissionNo")?.trim();
  if (!admissionNo || admissionNo.length > 80) {
    return privateFinanceJson({ error: "A valid admission number is required" }, { status: 400 });
  }
  const student = await prisma.student.findUnique({
    where: { admissionNo },
    select: financeStudentCalculationSelect
  });
  if (!student || student.deletedAt) {
    return privateFinanceJson({ error: "Student not found" }, { status: 404 });
  }
  const [fees, receiptRows] = await Promise.all([
    getFeeStructures(student.academicYear),
    prisma.payment.findMany({
      where: { admissionNo, deletedAt: null },
      select: {
        id: true,
        receiptNo: true,
        amountPaid: true,
        feeType: true,
        isCancelled: true,
        deletedAt: true,
        updatedAt: true
      }
    })
  ]);
  const fee = fees.find((row) => row.className === student.className);
  const feeAllocation = fee
    ? allocateFees(
        student,
        fee,
        await effectiveActiveSelectedReceiptPayments(prisma, receiptRows)
      )
    : null;
  return privateFinanceJson({
    ...financeStudentIdentity(student),
    feeAllocation
  });
}
