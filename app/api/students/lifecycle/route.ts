import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/auth";
import { getSchoolSettings } from "@/lib/school-settings";
import { ACADEMIC_ENROLLMENT_STATUSES, lifecycleOverview, lifecycleOverviewApiResponse } from "@/lib/student-lifecycle";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_STUDENT_LIFECYCLE");
  if (auth.response) return auth.response;
  const sp = request.nextUrl.searchParams;
  const settings = await getSchoolSettings(prisma);
  const status = sp.get("status") || undefined;
  const data = await lifecycleOverview(prisma, {
    academicYear: sp.get("academicYear") || settings.academicYear,
    className: sp.get("className") || undefined,
    section: sp.get("section") || undefined,
    status: ACADEMIC_ENROLLMENT_STATUSES.includes(status as never) ? status : undefined
  });
  return NextResponse.json(lifecycleOverviewApiResponse(data));
}
