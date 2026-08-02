import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import { AcademicCalendarView } from "@/components/academic-calendar-view";
import { PageHeader } from "@/components/ui";
import { loadPublishedSchoolCalendar, AcademicCalendarError } from "@/lib/academic-calendar";
import { getCurrentAuthContext, requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSchoolSettings } from "@/lib/school-settings";

export const dynamic = "force-dynamic";

export default async function ParentCalendarPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  noStore(); const user = await requirePermission("VIEW_OWN_CALENDAR"); if (user.role !== "PARENT") redirect("/unauthorized");
  const [context, settings, query] = await Promise.all([getCurrentAuthContext(), getSchoolSettings(prisma), searchParams]); if (!context) redirect("/login");
  const month = calendarMonth(query.month), range = monthRange(month), contextVersion = query.contextVersion && /^\d+$/.test(query.contextVersion) ? Number(query.contextVersion) : null;
  const data = await loadPublishedSchoolCalendar(prisma, { ...user, sessionId: context.sessionId }, { academicYear: settings.academicYear, ...range, childHandle: query.childContext, expectedContextVersion: contextVersion }).catch((error) => error instanceof AcademicCalendarError ? null : Promise.reject(error));
  if (!data || !data.context) return <div className="page"><PageHeader title="School Calendar" description="Published linked-child calendar" /><section className="card card-pad empty-state"><h2>Choose an active linked child</h2><p>Removed, stale, unrelated and inactive family links fail closed. Refresh and use the linked-child selector.</p></section></div>;
  const childQuery = `childContext=${encodeURIComponent(data.context.childHandle)}&contextVersion=${data.context.contextVersion}`;
  return <div className="page parent-calendar-page"><PageHeader title="School Calendar" description="Published holidays, school-wide events, linked-child cohort events and current examination references only." /><AcademicCalendarView data={data} month={month} mode={query.view === "list" ? "list" : "month"} basePath="/parent/calendar" printPath="/parent/calendar/print" contextQuery={childQuery} description="Published Parent calendar" /></div>;
}

function calendarMonth(value?: string) { return value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : new Date().toISOString().slice(0, 7); }
function monthRange(month: string) { const [year, value] = month.split("-").map(Number); return { from: `${month}-01`, to: new Date(Date.UTC(year, value, 0)).toISOString().slice(0, 10) }; }
