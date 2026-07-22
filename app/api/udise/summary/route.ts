import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadUdiseChecklist } from "@/lib/udise-checklist";

export async function GET() {
  const auth = await requireApiPermission("VIEW_UDISE_CHECKLIST");
  if (auth.response) return auth.response;
  const { students: _students, staff: _staff, ...summary } = await loadUdiseChecklist(prisma);
  return NextResponse.json(summary);
}
