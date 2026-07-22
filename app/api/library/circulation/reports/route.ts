import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { loadCirculationReports } from "@/lib/library-circulation-reports";
import { prisma } from "@/lib/prisma";
export async function GET(request: NextRequest) { const auth = await requireApiPermission("VIEW_LIBRARY_CIRCULATION_REPORTS"); if (auth.response) return auth.response; const days = Math.min(90, Math.max(0, Number(request.nextUrl.searchParams.get("days") ?? 7) || 7)); return NextResponse.json(await loadCirculationReports(prisma, auth.user.role === "VIEWER", days)); }
