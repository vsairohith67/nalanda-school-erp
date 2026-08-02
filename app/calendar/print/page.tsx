import { unstable_noStore as noStore } from "next/cache";
import { AcademicCalendarView } from "@/components/academic-calendar-view";
import { loadPublishedSchoolCalendar } from "@/lib/academic-calendar";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSchoolSettings } from "@/lib/school-settings";
export const dynamic = "force-dynamic";
export default async function ManagementCalendarPrint({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) { noStore(); const user = await requirePermission("VIEW_CALENDAR_MANAGEMENT"); const [settings, query] = await Promise.all([getSchoolSettings(prisma), searchParams]); const month = query.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(query.month) ? query.month : new Date().toISOString().slice(0, 7); const [year, value] = month.split("-").map(Number); const data = await loadPublishedSchoolCalendar(prisma, user, { academicYear: settings.academicYear, from: `${month}-01`, to: new Date(Date.UTC(year, value, 0)).toISOString().slice(0, 10) }); return <main className="print-page"><AcademicCalendarView data={data} month={month} mode="list" basePath="/calendar" title="Academic Calendar Summary" description="Authenticated leadership print view of current published operational days and events" print /></main>; }
