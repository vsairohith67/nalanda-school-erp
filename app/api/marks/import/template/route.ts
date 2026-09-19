import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { legacyImportContext, legacyContextTemplate } from "@/lib/legacy-marks-import-context";
export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("ENTER_MARKS"); if (auth.response || !auth.user) return auth.response;
  try {
    const context = await legacyImportContext(prisma, auth.user, request.nextUrl.searchParams.get("assessmentId") ?? "", request.nextUrl.searchParams.get("academicYear") ?? "");
    return new NextResponse(legacyContextTemplate(context), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": "attachment; filename=nalanda-legacy-marks-v1.csv", "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
  } catch { return NextResponse.json({ error: "Select an authorised legacy assessment context." }, { status: 403 }); }
}
