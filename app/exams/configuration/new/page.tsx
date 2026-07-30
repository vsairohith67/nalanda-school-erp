import { ExaminationConfigurationCreate } from "@/components/examination-configuration-create";
import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSchoolSettings } from "@/lib/school-settings";

export default async function Page() {
  const user = await requirePermission("MANAGE_EXAM_CONFIGURATION");
  const settings = await getSchoolSettings(prisma);
  const classSections = await prisma.timetableClassSection.findMany({
    where: { academicYear: settings.academicYear, isActive: true },
    select: { id: true, displayName: true, className: true, section: true },
    orderBy: [{ className: "asc" }, { section: "asc" }]
  });
  return (
    <div className="page exam-configuration-page">
      <PageHeader
        title="Create Examination"
        description="Select the academic year and exact active class/section applicability. No component maxima or historical weighting is prefilled."
      />
      <ExaminationConfigurationCreate
        academicYear={settings.academicYear}
        classSections={classSections}
        requiresInterventionReason={user.role === "SUPER_ADMIN"}
      />
    </div>
  );
}
