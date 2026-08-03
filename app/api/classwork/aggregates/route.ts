import { NextRequest, NextResponse } from "next/server";
import { hasUserPermission, requireApiPermission } from "@/lib/auth";
import { classworkApiError, classworkJson } from "@/lib/classwork-api";
import { classworkAggregateCsv, loadClassworkAggregates } from "@/lib/classwork";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_CLASSWORK_AGGREGATES"); if (auth.response || !auth.user) return auth.response;
  try {
    const rows = await loadClassworkAggregates(prisma, auth.user, request.nextUrl.searchParams.get("academicYear") ?? undefined);
    if (request.nextUrl.searchParams.get("format") !== "csv") return classworkJson({ aggregates: rows });
    if (!(await hasUserPermission(auth.user, "EXPORT_CLASSWORK_AGGREGATES"))) return classworkJson({ error: "Aggregate export permission is required." }, 403);
    return new NextResponse(classworkAggregateCsv(rows), { headers: { "Cache-Control": "private, no-store", "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=classwork-aggregate-report.csv", "X-Content-Type-Options": "nosniff", "Vary": "Cookie" } });
  } catch (error) { return classworkApiError(error); }
}
