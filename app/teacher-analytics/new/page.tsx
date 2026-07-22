import { PageHeader } from "@/components/ui";
import { TeacherAnalyticsCycleForm } from "@/components/teacher-analytics-forms";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { teacherAnalyticsReadiness } from "@/lib/teacher-analytics";

export default async function NewTeacherAnalyticsCyclePage() {
  await requirePermission("MANAGE_TEACHER_ANALYTICS_CYCLES");
  const readiness = await teacherAnalyticsReadiness(prisma, { academicYear: "2026-27", periodStart: new Date("2026-04-01T00:00:00+05:30"), periodEnd: new Date("2027-03-31T23:59:59+05:30") });
  return <div className="page teacher-analytics-page"><PageHeader title="New Teacher Analytics Review Cycle" description="Preview source coverage before creating a preserved leadership review period."/><TeacherAnalyticsCycleForm readiness={readiness}/></div>;
}
