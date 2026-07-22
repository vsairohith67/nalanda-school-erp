import { notFound } from "next/navigation";
import { IdentityCardView } from "@/components/identity-card-view";
import { PrintButton } from "@/components/print-button";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { safeIdentityCardPayload } from "@/lib/identity-cards";
import { renderCode39Svg } from "@/lib/library-barcode-svg";

export default async function IdentityCardPrintPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ mode?: string; tone?: string; version?: string }> }) {
  await requirePermission("VIEW_ID_CARDS");
  const card = await prisma.identityCard.findUnique({ where: { id: (await params).id } });
  if (!card?.currentVersionNumber) notFound();
  const query = await searchParams;
  const requestedVersion = Number(query.version);
  const versionNumber = Number.isInteger(requestedVersion) && requestedVersion > 0 ? requestedVersion : card.currentVersionNumber;
  const version = await prisma.identityCardVersion.findUnique({ where: { identityCardId_versionNumber: { identityCardId: card.id, versionNumber } } });
  if (!version) notFound();
  const currentPayload = safeIdentityCardPayload(card, version);
  const payload = { ...currentPayload, effectiveStatus: version.versionNumber === card.currentVersionNumber ? currentPayload.effectiveStatus : "SUPERSEDED", currentVersionNumber: version.versionNumber };
  const barcodeSvg = payload.cardNumber && payload.snapshot.barcodeEnabled ? renderCode39Svg(payload.cardNumber) : null;
  const requested = query.mode, mode = requested === "front" || requested === "back" ? requested : "pair";
  const templatePrefersColour = payload.snapshot.template?.definition?.print?.colour !== false;
  const tone = query.tone === "bw" ? "bw" : query.tone === "colour" ? "colour" : templatePrefersColour ? "colour" : "bw";
  const href = (nextMode: string, nextTone = tone) => `?mode=${nextMode}&tone=${nextTone}&version=${version.versionNumber}`;
  return <div className={`page identity-card-print-page ${tone === "bw" ? "identity-card-print-bw" : ""}`}><div className="no-print"><div className="page-actions"><a className="button secondary" href={href("front")}>Single Front</a><a className="button secondary" href={href("back")}>Single Back</a><a className="button secondary" href={href("pair")}>Front / Back Pair</a><a className="button secondary" href={href(mode, "colour")}>Colour Output</a><a className="button secondary" href={href(mode, "bw")}>Black &amp; White Output</a><PrintButton auditUrl={`/api/id-cards/${card.id}/print`} auditBody={{ version: version.versionNumber }}/></div><p>Print at 100% / actual size. Verify one physical CR80 test print before mass printing.</p></div><IdentityCardView payload={{ ...payload, barcodeSvg }} printMode={mode}/><p className="print-only id-card-print-note">CR80 85.60 mm × 53.98 mm · verify printer alignment with one physical test print.</p></div>;
}
