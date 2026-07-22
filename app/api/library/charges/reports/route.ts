import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { loadLibraryChargeReports } from "@/lib/library-charge-reports";
import { prisma } from "@/lib/prisma";
export async function GET() { const auth = await requireApiPermission("VIEW_LIBRARY_CHARGE_REPORTS"); if (auth.response) return auth.response; return NextResponse.json(await loadLibraryChargeReports(prisma, auth.user.role === "VIEWER")); }
