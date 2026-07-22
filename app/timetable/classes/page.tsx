import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { TimetableNav } from "@/components/timetable-nav";
import { TimetableMasterData } from "@/components/timetable-master-data";
export default async function Page() {
  await requirePermission("MANAGE_TIMETABLE_MASTER");
  const rows = await prisma.timetableClassSection.findMany({ orderBy: [{ className: "asc" }, { section: "asc" }] });
  return <div className="page"><PageHeader title="Class Sections" description="Review the seeded 2026–27 sections and map each class to its school timing group." /><TimetableNav /><TimetableMasterData kind="classes" rows={rows} /></div>;
}
