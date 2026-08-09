import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createOperationalIncident } from "@/lib/operational-workflows";
import { parseTechnicalOperationsJson, technicalOperationsError, technicalOperationsJson } from "@/lib/technical-operations-api";

export async function GET() {
  const auth = await requireApiPermission("VIEW_TECHNICAL_EVIDENCE"); if (auth.response) return auth.response;
  return technicalOperationsJson({ incidents: await prisma.operationalIncident.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { events: { orderBy: { occurredAt: "desc" }, take: 50 } } }) });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("MANAGE_OPERATIONAL_INCIDENTS"); if (auth.response) return auth.response;
  try { return technicalOperationsJson({ incident: await createOperationalIncident(prisma, await parseTechnicalOperationsJson(request), auth.user.id) }, 201); }
  catch (error) { return technicalOperationsError(error); }
}
