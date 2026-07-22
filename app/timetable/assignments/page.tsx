import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { TimetableNav } from "@/components/timetable-nav";
import { TimetableAssignments } from "@/components/timetable-assignments";
import { validateTimetableFoundation } from "@/lib/timetable";
export default async function Page() {
  await requirePermission("MANAGE_TIMETABLE_ASSIGNMENTS");
  const [teachers, subjects, classes, assignments] = await Promise.all([
    prisma.timetableTeacher.findMany({ orderBy: { name: "asc" } }),
    prisma.timetableSubject.findMany({ orderBy: { name: "asc" } }),
    prisma.timetableClassSection.findMany({ orderBy: [{ className: "asc" }, { section: "asc" }] }),
    prisma.timetableAssignment.findMany({ include: { teacher: true, subject: true, classSection: true }, orderBy: [{ classSection: { className: "asc" } }, { subject: { name: "asc" } }] })
  ]);
  const warnings = validateTimetableFoundation({ teachers, subjects, classSections: classes, assignments });
  return <div className="page"><PageHeader title="Assignments & Workload" description="Define who teaches each subject, for which class section, and how many periods are required each week." /><TimetableNav /><TimetableAssignments assignments={assignments} teachers={teachers} subjects={subjects} classes={classes} warnings={warnings} /></div>;
}
