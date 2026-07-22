import { notFound } from "next/navigation";
import { IdentityCardView } from "@/components/identity-card-view";
import { PrintButton } from "@/components/print-button";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { safeIdentityCardPayload } from "@/lib/identity-cards";
import { renderCode39Svg } from "@/lib/library-barcode-svg";

export default async function IdentityCardBatchPrintPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tone?: string; guides?: string }> }) {
  await requirePermission("VIEW_ID_CARDS");
  const batch = await prisma.identityCardBatch.findUnique({ where: { id: (await params).id }, include: { template: true, cards: { where: { currentVersionNumber: { gt: 0 } }, orderBy: { cardNumber: "asc" } } } });
  if (!batch) notFound();
  const payloads = await Promise.all(batch.cards.map(async (card) => { const version = await prisma.identityCardVersion.findUnique({ where: { identityCardId_versionNumber: { identityCardId: card.id, versionNumber: card.currentVersionNumber } } }); if (!version) return null; const payload = safeIdentityCardPayload(card, version); return { card, version, payload: { ...payload, barcodeSvg: payload.cardNumber && payload.snapshot.barcodeEnabled ? renderCode39Svg(payload.cardNumber) : null } }; }));
  const query = await searchParams;
  const printSettings = batch.template.printSettingsJson ? JSON.parse(batch.template.printSettingsJson) : { colour: true, cutGuides: true };
  const tone = query.tone === "bw" ? "bw" : query.tone === "colour" ? "colour" : printSettings.colour === false ? "bw" : "colour";
  const guides = query.guides === "off" ? false : query.guides === "on" ? true : printSettings.cutGuides !== false;
  return <div className={`page identity-card-batch-print ${tone === "bw" ? "identity-card-print-bw" : ""} ${guides ? "" : "identity-card-no-cut-guides"}`}><div className="no-print"><div className="page-actions"><a className="button secondary" href="?tone=colour&guides=on">Colour + Guides</a><a className="button secondary" href="?tone=colour&guides=off">Colour, No Guides</a><a className="button secondary" href="?tone=bw&guides=on">B&amp;W + Guides</a><a className="button secondary" href="?tone=bw&guides=off">B&amp;W, No Guides</a><PrintButton auditUrl={`/api/id-cards/batches/${batch.id}/print`} auditBody={{ tone, guides }}/></div><p>A4 sheet with optional cut guides. Print at 100% and test one physical sheet before mass printing.</p></div><div className="identity-card-a4-sheet">{payloads.filter(Boolean).map((row: any) => <div className="identity-card-cut-cell" key={row.card.id}><IdentityCardView payload={row.payload} printPair/></div>)}</div></div>;
}
