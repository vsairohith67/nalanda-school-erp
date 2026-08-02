import { requireApiPermission } from "@/lib/auth";
import { academicCalendarJson } from "@/lib/academic-calendar-api";
import { listCalendarCreationOptions } from "@/lib/academic-calendar";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireApiPermission("VIEW_CALENDAR_MANAGEMENT");
  if (auth.response) return auth.response;
  return academicCalendarJson(await listCalendarCreationOptions(prisma));
}
