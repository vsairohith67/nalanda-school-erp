import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { TimetableNav } from "@/components/timetable-nav";
import { TimetableBuilder } from "@/components/timetable-builder";

export default async function TimetableBuilderPage() {
  await requirePermission("MANAGE_TIMETABLE_BUILDER");
  const [settings, teachers, subjects, classes, assignments, templates, unavailability, fixedPeriods, drafts] = await Promise.all([
    prisma.schoolSettings.findUnique({ where: { id: "school" } }),
    prisma.timetableTeacher.findMany({ orderBy: { name: "asc" } }),
    prisma.timetableSubject.findMany({ orderBy: { name: "asc" } }),
    prisma.timetableClassSection.findMany({ orderBy: [{ className: "asc" }, { section: "asc" }] }),
    prisma.timetableAssignment.findMany({ include: { teacher: true, subject: true }, orderBy: [{ classSectionId: "asc" }, { subject: { name: "asc" } }] }),
    prisma.timetablePeriodTemplate.findMany({ orderBy: [{ dayOfWeek: "asc" }, { sortOrder: "asc" }] }),
    prisma.timetableTeacherUnavailability.findMany(),
    prisma.timetableFixedPeriod.findMany(),
    prisma.timetableDraft.findMany({ include: { entries: true }, orderBy: [{ status: "asc" }, { updatedAt: "desc" }] })
  ]);
  return <div className="page">
    <PageHeader title="Manual Timetable Builder" description="Build class timetables one period at a time, see conflicts immediately, and keep safe drafts before automatic generation." />
    <TimetableNav />
    <TimetableBuilder
      academicYear={settings?.academicYear ?? "2026-27"}
      teachers={teachers}
      subjects={subjects}
      classes={classes}
      assignments={assignments}
      templates={templates}
      unavailability={unavailability}
      fixedPeriods={fixedPeriods}
      initialDrafts={drafts}
    />
  </div>;
}
