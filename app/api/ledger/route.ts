import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { maskPhone } from "@/lib/privacy";
import { getStudentLedgerData } from "@/lib/ledger-data";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_LEDGER");
  if (auth.response) return auth.response;
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "Search is required" }, { status: 400 });
  const ledger = await getStudentLedgerData(q);
  if (!ledger) return NextResponse.json({ error: "Student or fee structure not found" }, { status: 404 });
  const { student, fee, payments, allocation, shortMessage, detailedMessage, whatsappLink } = ledger;
  const visibleStudent =
    auth.user.role === "VIEWER"
      ? {
          ...student,
          phone1: maskPhone(student.phone1),
          phone2: maskPhone(student.phone2),
          whatsappNumber: maskPhone(student.whatsappNumber)
        }
      : student;
  return NextResponse.json({
    student: visibleStudent,
    fee,
    payments,
    allocation,
    whatsappMessage: shortMessage,
    shortMessage,
    detailedMessage,
    whatsappLink
  });
}
