import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPendingDues } from "@/lib/data";
import { toCsv } from "@/lib/format";
import { requireApiPermission } from "@/lib/auth";
import { buildDetailedReminder } from "@/lib/reminders";
import { maskPhone } from "@/lib/privacy";
import { getSchoolSettings } from "@/lib/school-settings";

export async function GET(request: NextRequest, context: { params: Promise<{ type: string }> }) {
  const { type } = await context.params;
  const permission =
    type === "students" ? "EXPORT_STUDENTS" :
    type === "payments" ? "EXPORT_PAYMENTS" :
    type === "whatsapp-reminders" ? "EXPORT_REMINDERS" :
    "EXPORT_REPORTS";
  const auth = await requireApiPermission(permission);
  if (auth.response) return auth.response;
  const sp = request.nextUrl.searchParams;
  const settings = await getSchoolSettings(prisma);
  let rows: Record<string, unknown>[] = [];
  if (type === "students") {
    rows = await prisma.student.findMany({ where: { deletedAt: null }, orderBy: { studentName: "asc" }, take: 10_000 });
  } else if (type === "payments") {
    rows = await prisma.payment.findMany({ where: { deletedAt: null }, orderBy: [{ date: "desc" }], take: 10_000 });
  } else if (type === "pending-dues") {
    const pendingRows = await getPendingDues({
      academicYear: sp.get("academicYear") || undefined,
      className: sp.get("className") || undefined,
      status: sp.get("status") || undefined,
      only: (sp.get("only") as "pending" | "paid" | null) || undefined
    });
    rows = pendingRows.slice(0, 10_000).map((row) =>
      auth.user.role === "VIEWER" && row
        ? { ...row, phone1: maskPhone(row.phone1), phone2: maskPhone(row.phone2), whatsappNumber: "" }
        : row
    ) as Record<string, unknown>[];
  } else if (type === "daily-collection") {
    const date = sp.get("date") ?? new Date().toISOString().slice(0, 10);
    rows = await prisma.payment.findMany({
      where: { deletedAt: null, isCancelled: false, date: dayRange(date) },
      orderBy: [{ receiptNo: "asc" }],
      take: 10_000
    });
  } else if (type === "whatsapp-reminders") {
    const pending = await getPendingDues({
      academicYear: sp.get("academicYear") || undefined,
      className: sp.get("className") || undefined,
      section: sp.get("section") || undefined,
      status: sp.get("status") || "Active",
      only: "pending"
    });
    rows = pending
      .filter((row) => row && row.totalPending > 0)
      .slice(0, 10_000)
      .map((row) => {
        if (!row) return {};
        const input = {
          academicYear: sp.get("academicYear") || settings.academicYear,
          studentName: row.studentName,
          className: row.className,
          section: row.section,
          totalPending: row.totalPending,
          term1Due: row.term1Due,
          term2Due: row.term2Due,
          term3Due: row.term3Due,
          term4Due: row.term4Due,
          footer: settings.whatsappReminderFooter
        };
        return {
          admissionNo: row.admissionNo,
          studentName: row.studentName,
          className: row.className,
          section: row.section,
          fatherName: row.fatherName,
          whatsappNumber: row.whatsappNumber,
          phone1: row.phone1,
          totalPending: row.totalPending,
          term1Due: row.term1Due,
          term2Due: row.term2Due,
          term3Due: row.term3Due,
          term4Due: row.term4Due,
          message: buildDetailedReminder(input)
        };
      });
  } else {
    return NextResponse.json({ error: "Unknown export type" }, { status: 404 });
  }
  const csv = toCsv(rows);
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${type}.csv"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff"
    }
  });
}

function dayRange(dateText: string) {
  const start = new Date(`${dateText}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { gte: start, lt: end };
}
