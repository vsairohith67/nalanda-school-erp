import { NextResponse } from "next/server";
import { getCurrentUserEffectivePermissions, requireApiPermission } from "@/lib/auth";
import { getDashboardCommandCenter } from "@/lib/dashboard";
import { prisma } from "@/lib/prisma";

import { getSchoolSettings } from "@/lib/school-settings";

export async function GET() {
  const auth = await requireApiPermission("VIEW_DASHBOARD");
  if (auth.response) return auth.response;
  const [permissions, settings] = await Promise.all([
    getCurrentUserEffectivePermissions(),
    getSchoolSettings(prisma)
  ]);
  return NextResponse.json(await getDashboardCommandCenter(
    prisma,
    permissions,
    settings.academicYear,
    auth.user.role,
    new Date(),
    auth.user
  ));
}
