import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { communicationRoleCapabilities, requireCommunicationFeatureForApi } from "@/lib/communication-policy";
import { loadCommunicationOperations } from "@/lib/communication-service";

export async function GET() {
  const feature = requireCommunicationFeatureForApi(); if (feature) return feature;
  const auth = await requireApiPermission("VIEW_NOTIFICATION_REPORTS"); if (auth.response) return auth.response;
  if (!communicationRoleCapabilities(auth.user!.role).viewOperations) return NextResponse.json({ error: "You do not have permission for communication operations." }, { status: 403 });
  return NextResponse.json(await loadCommunicationOperations(prisma));
}
