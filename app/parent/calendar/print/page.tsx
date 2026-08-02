import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import { AcademicCalendarView } from "@/components/academic-calendar-view";
import { AcademicCalendarError, loadPublishedSchoolCalendar } from "@/lib/academic-calendar";
import { getCurrentAuthContext, requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSchoolSettings } from "@/lib/school-settings";

export const dynamic = "force-dynamic";
export default async function ParentCalendarPrint({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) { noStore(); const user = await requirePermission("VIEW_OWN_CALENDAR"); if (user.role !== "PARENT") redirect("/unauthorized"); const [context, settings, query] = await Promise.all([getCurrentAuthContext(), getSchoolSettings(prisma), searchParams]); if (!context) redirect("/login"); const month = query.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(query.month) ? query.month : new Date().toISOString().slice(0, 7); const [year, value] = month.split("-").map(Number); const data = await loadPublishedSchoolCalendar(prisma, { ...user, sessionId: context.sessionId }, { academicYear: settings.academicYear, from: `${month}-01`, to: new Date(Date.UTC(year, value, 0)).toISOString().slice(0, 10), childHandle: query.childContext, expectedContextVersion: query.contextVersion && /^\d+$/.test(query.contextVersion) ? Number(query.contextVersion) : null }).catch((error) => error instanceof AcademicCalendarError ? null : Promise.reject(error)); if (!data) redirect("/parent/calendar"); return <main className="print-page"><AcademicCalendarView data={data} month={month} mode="list" basePath="/parent/calendar" title="Parent School Calendar" description="Authorised published entries for the selected linked child" print /></main>; }
