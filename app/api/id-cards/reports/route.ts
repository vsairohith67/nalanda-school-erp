import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { identityCardReport } from "@/lib/id-card-reports";

export async function GET() {
  const auth = await requireApiPermission("VIEW_ID_CARD_REPORTS"); if (auth.response) return auth.response;
  const report = await identityCardReport(prisma);
  return NextResponse.json({ summary: report.summary });
}
