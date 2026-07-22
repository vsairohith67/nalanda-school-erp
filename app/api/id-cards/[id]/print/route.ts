import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { safeIdentityCardPayload } from "@/lib/identity-cards";
import { renderCode39Svg } from "@/lib/library-barcode-svg";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("VIEW_ID_CARDS"); if (auth.response) return auth.response;
  const card = await prisma.identityCard.findUnique({ where: { id: (await params).id } });
  if (!card || !card.currentVersionNumber) return NextResponse.json({ error: "Issued ID card not found." }, { status: 404 });
  const requestedVersion = Number(new URL(request.url).searchParams.get("version"));
  const versionNumber = Number.isInteger(requestedVersion) && requestedVersion > 0 ? requestedVersion : card.currentVersionNumber;
  const version = await prisma.identityCardVersion.findUnique({ where: { identityCardId_versionNumber: { identityCardId: card.id, versionNumber } } });
  if (!version) return NextResponse.json({ error: "Issued ID-card version not found." }, { status: 404 });
  const currentPayload = safeIdentityCardPayload(card, version);
  const payload = { ...currentPayload, effectiveStatus: version.versionNumber === card.currentVersionNumber ? currentPayload.effectiveStatus : "SUPERSEDED", currentVersionNumber: version.versionNumber };
  return NextResponse.json({ payload: { ...payload, barcodeSvg: payload.cardNumber && payload.snapshot.barcodeEnabled ? renderCode39Svg(payload.cardNumber) : null, dimensionsMm: { width: 85.6, height: 53.98 } } });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("VIEW_ID_CARDS"); if (auth.response) return auth.response;
  const body = await request.json().catch(() => null);
  if (!body || !Number.isInteger(body.version) || body.version < 1) {
    return NextResponse.json({ error: "A valid issued version is required." }, { status: 400 });
  }
  const card = await prisma.identityCard.findUnique({ where: { id: (await params).id } });
  if (!card?.currentVersionNumber) return NextResponse.json({ error: "Issued ID card not found." }, { status: 404 });
  const version = await prisma.identityCardVersion.findUnique({
    where: { identityCardId_versionNumber: { identityCardId: card.id, versionNumber: body.version } }
  });
  if (!version) return NextResponse.json({ error: "Issued ID-card version not found." }, { status: 404 });
  await prisma.identityCardEvent.create({
    data: {
      identityCardId: card.id,
      versionId: version.id,
      eventType: "PRINT_ACCESSED",
      notes: version.versionNumber === card.currentVersionNumber ? "Current version" : `Historical superseded v${version.versionNumber}`,
      recordedByUserId: auth.user.id
    }
  });
  return NextResponse.json({ ok: true });
}
