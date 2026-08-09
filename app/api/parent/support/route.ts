import { NextRequest } from "next/server";
import { getCurrentAuthContext, requireApiRolePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSchoolSettings } from "@/lib/school-settings";
import { createAuthenticatedSupportRequest, listOwnSupportRequests, validateAuthenticatedSupportInput } from "@/lib/support";
import { parseJsonBody, supportActor, supportApiError, supportJson } from "@/lib/support-api";

export async function GET() {
  const auth = await requireApiRolePermission("VIEW_OWN_SUPPORT", "PARENT"); if (auth.response || !auth.user) return auth.response;
  try { return supportJson({ requests: await listOwnSupportRequests(prisma, await supportActor(auth.user)) }); } catch (error) { return supportApiError(error); }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiRolePermission("CREATE_OWN_SUPPORT", "PARENT"); if (auth.response || !auth.user) return auth.response;
  const context = await getCurrentAuthContext(); if (!context) return supportJson({ error: "Authentication required" }, 401);
  try { const settings = await getSchoolSettings(prisma); const created = await createAuthenticatedSupportRequest(prisma, await supportActor(auth.user), { sessionId: context.sessionId, academicYear: settings.academicYear }, validateAuthenticatedSupportInput(await parseJsonBody(request))); return supportJson({ request: created }, 201); } catch (error) { return supportApiError(error); }
}
