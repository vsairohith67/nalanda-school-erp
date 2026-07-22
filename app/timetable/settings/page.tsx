import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { TimetableNav } from "@/components/timetable-nav";
import { TimetableSettings } from "@/components/timetable-settings";
export default async function Page() {
  await requirePermission("MANAGE_TIMETABLE_MASTER");
  const [teachers, subjects, classes, unavailable, fixedPeriods, templates] = await Promise.all([
    prisma.timetableTeacher.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.timetableSubject.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.timetableClassSection.findMany({ where: { isActive: true }, orderBy: [{ className: "asc" }, { section: "asc" }] }),
    prisma.timetableTeacherUnavailability.findMany({ include: { teacher: true }, orderBy: [{ dayOfWeek: "asc" }, { periodNumber: "asc" }] }),
    prisma.timetableFixedPeriod.findMany({ include: { teacher: true, subject: true, classSection: true }, orderBy: [{ dayOfWeek: "asc" }, { periodNumber: "asc" }] }),
    prisma.timetablePeriodTemplate.findMany({ where: { academicYear: "2026-27" }, orderBy: [{ groupName: "asc" }, { dayOfWeek: "asc" }, { sortOrder: "asc" }] })
  ]);
  return <div className="page"><PageHeader title="Periods & Scheduling Rules" description="Review editable timing defaults and reserve teacher unavailability or fixed periods." /><TimetableNav /><TimetableSettings teachers={teachers} subjects={subjects} classes={classes} unavailable={unavailable} fixedPeriods={fixedPeriods} templates={templates} /></div>;
}
