import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("VERIFY_CLOUD_BACKUP"); if (auth.response) return auth.response;
  const run = await prisma.cloudBackupRun.findUnique({
    where: { id: (await params).id },
    include: { profile: true, schedule: true, artifacts: { include: { verifications: { orderBy: { checkedAt: "asc" } } } }, events: { orderBy: { eventDate: "asc" } }, restoreRehearsals: true }
  });
  if (!run) return NextResponse.json({ error: "Cloud backup run not found." }, { status: 404 });
  return NextResponse.json({ run }, { headers: { "Cache-Control": "private, no-store" } });
}
