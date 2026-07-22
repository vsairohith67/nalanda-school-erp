import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("VIEW_ID_CARDS"); if (auth.response) return auth.response;
  const body = await request.json().catch(() => null);
  if (
    !body ||
    !["colour", "bw"].includes(body.tone) ||
    typeof body.guides !== "boolean"
  ) {
    return NextResponse.json({ error: "Valid print settings are required." }, { status: 400 });
  }
  const batch = await prisma.identityCardBatch.findUnique({ where: { id: (await params).id } });
  if (!batch) return NextResponse.json({ error: "ID-card batch not found." }, { status: 404 });
  await prisma.identityCardEvent.create({
    data: {
      batchId: batch.id,
      eventType: "PRINT_ACCESSED",
      notes: `A4 batch sheet · ${body.tone} · cut guides ${body.guides ? "on" : "off"}`,
      recordedByUserId: auth.user.id
    }
  });
  return NextResponse.json({ ok: true });
}
