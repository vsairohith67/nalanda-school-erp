import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireCommunicationFeatureForApi } from "@/lib/communication-policy";
import { saveOwnCommunicationPreference } from "@/lib/communication-service";
import { safeClientError } from "@/lib/client-errors";

export async function GET() {
  const feature = requireCommunicationFeatureForApi(); if (feature) return feature;
  const auth = await requireApiPermission("VIEW_OWN_NOTIFICATIONS"); if (auth.response) return auth.response;
  const preferences = await prisma.communicationPreference.findMany({ where: { userId: auth.user!.id }, select: { id: true, category: true, channel: true, optionalEnabled: true, preferred: true, locale: true, quietHoursStart: true, quietHoursEnd: true, timezone: true, digestFrequency: true, version: true, updatedAt: true }, orderBy: [{ category: "asc" }, { channel: "asc" }] });
  const contacts = await prisma.communicationContactPoint.findMany({ where: { identityKey: auth.user!.id }, select: { channel: true, status: true, destinationMasked: true, version: true }, orderBy: [{ channel: "asc" }, { version: "desc" }], take: 20 });
  const consents = await prisma.communicationConsent.findMany({ where: { identityKey: auth.user!.id }, select: { channel: true, purpose: true, status: true, capturedAt: true, revokedAt: true, expiresAt: true }, orderBy: { createdAt: "desc" }, take: 50 });
  return NextResponse.json({ preferences, contacts, consents, mandatoryPurposeNotice: "Security-critical and safety-critical notices follow separately approved policy and cannot be disabled through an optional preference." });
}
export async function PUT(request: NextRequest) {
  const feature = requireCommunicationFeatureForApi(); if (feature) return feature;
  const auth = await requireApiPermission("VIEW_OWN_NOTIFICATIONS"); if (auth.response) return auth.response;
  try { return NextResponse.json({ preference: await saveOwnCommunicationPreference(prisma, auth.user!.id, await request.json()) }); }
  catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to save communication preference.") }, { status: 400 }); }
}
