import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadTimetablePrintSource } from "@/lib/timetable-print-data";
import {
  classTimetableCsvRows,
  formatTimetableCsv,
  freePeriodCsvRows,
  teacherTimetableCsvRows,
  TIMETABLE_PRINT_PERMISSION,
  workloadCsvRows
} from "@/lib/timetable-print";

export async function GET(request: NextRequest, context: { params: Promise<{ type: string }> }) {
  const auth = await requireApiPermission(TIMETABLE_PRINT_PERMISSION);
  if (auth.response) return auth.response;
  const { type } = await context.params;
  const draftId = request.nextUrl.searchParams.get("draftId")?.trim();
  if (!draftId) return NextResponse.json({ error: "Draft is required" }, { status: 400 });
  const source = await loadTimetablePrintSource(prisma, draftId);
  if (!source) return NextResponse.json({ error: "Draft not found" }, { status: 404 });

  const classSectionId = request.nextUrl.searchParams.get("classSectionId") || undefined;
  const teacherId = request.nextUrl.searchParams.get("teacherId") || undefined;
  const rows = type === "class" ? classTimetableCsvRows(source, classSectionId)
    : type === "teacher" ? teacherTimetableCsvRows(source, teacherId)
    : type === "workload" ? workloadCsvRows(source)
    : type === "free" ? freePeriodCsvRows(source)
    : null;
  if (!rows) return NextResponse.json({ error: "Unknown timetable export type" }, { status: 404 });

  return new NextResponse(formatTimetableCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="timetable-${type}-${safeFilename(source.draft.name)}.csv"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff"
    }
  });
}

function safeFilename(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "draft";
}
