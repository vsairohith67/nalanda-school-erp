import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { TimetableNav } from "@/components/timetable-nav";
import { TimetableGenerator } from "@/components/timetable-generator";

export default async function TimetableGeneratePage() {
  await requirePermission("RUN_TIMETABLE_GENERATOR");
  const [settings, classes, drafts] = await Promise.all([
    prisma.schoolSettings.findUnique({ where: { id: "school" } }),
    prisma.timetableClassSection.findMany({
      orderBy: [{ academicYear: "desc" }, { className: "asc" }, { section: "asc" }]
    }),
    prisma.timetableDraft.findMany({
      select: { id: true, academicYear: true, name: true, status: true, updatedAt: true },
      orderBy: [{ academicYear: "desc" }, { updatedAt: "desc" }]
    })
  ]);
  return <div className="page">
    <PageHeader
      title="Automatic Timetable Generator"
      description="Generate a safe new draft from workload, availability, fixed periods, and optional locked manual work."
    />
    <TimetableNav />
    <TimetableGenerator
      currentAcademicYear={settings?.academicYear ?? "2026-27"}
      classes={classes}
      drafts={drafts}
    />
  </div>;
}
