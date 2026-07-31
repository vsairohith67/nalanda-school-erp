import { NextRequest, NextResponse } from "next/server";
import { requireApiRolePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { authorizeParentReportAccess } from "@/lib/report-parent-delivery";
import { ReportPublicationError } from "@/lib/report-publication";

export async function POST(request: NextRequest) {
  const auth = await requireApiRolePermission("VIEW_OWN_REPORT_CARDS", "PARENT");
  if (auth.response || !auth.user) return auth.response;
  try {
    return NextResponse.json({
      access: await authorizeParentReportAccess(prisma, await request.json(), auth.user)
    });
  } catch (error) {
    if (error instanceof ReportPublicationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: "Unable to authorize report access." }, { status: 400 });
  }
}
