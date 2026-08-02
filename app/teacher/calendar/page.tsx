import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import { AcademicCalendarView } from "@/components/academic-calendar-view";
import { PageHeader } from "@/components/ui";
import { loadPublishedSchoolCalendar } from "@/lib/academic-calendar";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSchoolSettings } from "@/lib/school-settings";

export const dynamic = "force-dynamic";
export default async function TeacherCalendarPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) { noStore(); const user = await requirePermission("VIEW_STAFF_CALENDAR"); if (user.role !== "TEACHER") redirect("/unauthorized"); const [settings, query] = await Promise.all([getSchoolSettings(prisma), searchParams]); const month = query.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(query.month) ? query.month : new Date().toISOString().slice(0, 7); const [year, value] = month.split("-").map(Number); const data = await loadPublishedSchoolCalendar(prisma, user, { academicYear: settings.academicYear, from: `${month}-01`, to: new Date(Date.UTC(year, value, 0)).toISOString().slice(0, 10) }); return <div className="page teacher-calendar-page"><PageHeader title="School Calendar" description="Published school-wide, Staff-authorised and exact assigned-class events, holidays and examination references." /><AcademicCalendarView data={data} month={month} mode={query.view === "list" ? "list" : "month"} basePath="/teacher/calendar" printPath="/teacher/calendar/print" description="Published Teacher calendar" /></div>; }
