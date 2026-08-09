import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { transitionMaintenanceWindow } from "@/lib/operational-workflows";
import { parseTechnicalOperationsJson, technicalOperationsError, technicalOperationsJson } from "@/lib/technical-operations-api";

export async function POST(request: NextRequest, { params }: { params: Promise<{ publicKey: string }> }) {
  const auth = await requireApiPermission("MANAGE_MAINTENANCE_WINDOWS"); if (auth.response) return auth.response;
  try { return technicalOperationsJson({ maintenanceWindow: await transitionMaintenanceWindow(prisma, (await params).publicKey, await parseTechnicalOperationsJson(request), auth.user.id) }); }
  catch (error) { return technicalOperationsError(error); }
}
