import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { parsePositiveIntegerPathParameter } from "@/lib/path-parameters";
import { prisma } from "@/lib/prisma";
import { parseIdentityCardSnapshot } from "@/lib/id-card-snapshots";

export async function GET(_: Request, { params }: { params: Promise<{ id: string; version: string }> }) {
  const auth = await requireApiPermission("VIEW_ID_CARDS"); if (auth.response) return auth.response;
  const p = await params, versionNumber = parsePositiveIntegerPathParameter(p.version);
  if (versionNumber === null) return NextResponse.json({ error: "Version must be a positive integer." }, { status: 400 });
  const row = await prisma.identityCardVersion.findUnique({ where: { identityCardId_versionNumber: { identityCardId: p.id, versionNumber } } });
  return row ? NextResponse.json({ version: { versionNumber: row.versionNumber, versionType: row.versionType, cardNumber: row.cardNumber, issuedAt: row.issuedAt, correctionReason: row.correctionReason, snapshot: parseIdentityCardSnapshot(row.snapshotJson) } }) : NextResponse.json({ error: "ID-card version not found." }, { status: 404 });
}
