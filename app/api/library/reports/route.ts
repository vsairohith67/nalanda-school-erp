import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { loadLibraryReports, serializeLibraryReportPayload } from "@/lib/library-reports";
import { prisma } from "@/lib/prisma";
export async function GET() { const auth = await requireApiPermission("VIEW_LIBRARY_REPORTS"); if (auth.response) return auth.response; const report = await loadLibraryReports(prisma); return NextResponse.json({ report: serializeLibraryReportPayload(report, auth.user.role === "VIEWER") }); }
