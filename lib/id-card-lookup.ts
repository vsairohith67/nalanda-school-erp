import type { PrismaClient } from "@prisma/client";
import { normalizeBarcodeValue } from "@/lib/library-barcodes";
import { safeIdentityCardPayload } from "@/lib/identity-cards";

export async function exactIdentityCardLookup(client: PrismaClient, value: unknown, actorId?: string) {
  const cardNumber = normalizeBarcodeValue(value);
  const card = await client.identityCard.findUnique({ where: { cardNumber }, include: { student: { select: { studentName: true } }, staffMember: { select: { fullName: true, designation: true } } } });
  if (!card) return null;
  const version = await client.identityCardVersion.findUnique({ where: { identityCardId_versionNumber: { identityCardId: card.id, versionNumber: card.currentVersionNumber } } });
  if (!version) return null;
  if (actorId) await client.identityCardEvent.create({ data: { identityCardId: card.id, versionId: version.id, eventType: "LOOKUP_PERFORMED", recordedByUserId: actorId } });
  const safe = safeIdentityCardPayload(card, version);
  return { cardType: safe.cardType, cardStatus: safe.effectiveStatus, cardNumber: safe.cardNumber, name: card.student?.studentName ?? card.staffMember?.fullName ?? "Identity unavailable", className: safe.snapshot.identity?.className ?? null, section: safe.snapshot.identity?.section ?? null, designation: card.staffMember?.designation ?? null, validUntil: safe.validUntil, photo: "PLACEHOLDER", warning: ["REVOKED", "EXPIRED"].includes(safe.effectiveStatus) ? `WARNING: ${safe.effectiveStatus}` : null };
}
