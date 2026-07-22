import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { TimetableNav } from "@/components/timetable-nav";
import { TimetableMasterData } from "@/components/timetable-master-data";
export default async function Page() {
  await requirePermission("MANAGE_TIMETABLE_MASTER");
  const rows = await prisma.timetableSubject.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }] });
  return <div className="page"><PageHeader title="Subjects" description="Maintain subject codes and rules such as lab, activity, and consecutive-period eligibility." /><TimetableNav /><TimetableMasterData kind="subjects" rows={rows} /></div>;
}
