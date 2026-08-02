import { NextRequest } from "next/server";
import { getCurrentAuthContext, requireApiPermission } from "@/lib/auth";
import { parentAcademicApiError, parentAcademicJson, optionalContextVersion } from "@/lib/parent-academics-api";
import { loadParentAttendance } from "@/lib/parent-academics";
import { prisma } from "@/lib/prisma";
import { getSchoolSettings } from "@/lib/school-settings";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_OWN_ATTENDANCE");
  if (auth.response || !auth.user) return auth.response;
  try {
    const context = await getCurrentAuthContext();
    if (!context || context.user.id !== auth.user.id) return parentAcademicJson({ error: "Authentication required" }, 401);
    const settings = await getSchoolSettings(prisma);
    return parentAcademicJson(await loadParentAttendance(prisma, {
      userId: context.user.id,
      sessionId: context.sessionId,
      roleAssignmentId: context.user.roleAssignmentId
    }, {
      academicYear: settings.academicYear,
      month: request.nextUrl.searchParams.get("month"),
      childHandle: request.nextUrl.searchParams.get("childContext"),
      expectedContextVersion: optionalContextVersion(request.nextUrl.searchParams.get("contextVersion"))
    }));
  } catch (error) {
    return parentAcademicApiError(error);
  }
}
