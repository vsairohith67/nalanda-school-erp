import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { TimetableNav } from "@/components/timetable-nav";
import { TimetableMasterData } from "@/components/timetable-master-data";
export default async function Page() {
  await requirePermission("MANAGE_TIMETABLE_MASTER");
  const rows = await prisma.timetableTeacher.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }] });
  return <div className="page"><PageHeader title="Teachers" description="Add teachers and define the weekly and daily teaching load limits that preserve free periods." /><TimetableNav /><TimetableMasterData kind="teachers" rows={rows} /></div>;
}
