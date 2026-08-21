import { NextResponse } from "next/server";
import { requireApiRolePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSchoolSettings } from "@/lib/school-settings";
import { getSuperAdminCommandCenter } from "@/lib/super-admin-command-center";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireApiRolePermission("VIEW_DASHBOARD", "SUPER_ADMIN");
  if (auth.response || !auth.user) return auth.response;
  try {
    const settings = await getSchoolSettings(prisma);
    return privateResponse(await getSuperAdminCommandCenter(prisma, settings.academicYear, auth.user.id));
  } catch {
    return privateResponse({ error: "Command Center is temporarily unavailable." }, 503);
  }
}

function privateResponse(body: unknown, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set("cache-control", "private, no-store, max-age=0");
  response.headers.set("vary", "Cookie");
  return response;
}
