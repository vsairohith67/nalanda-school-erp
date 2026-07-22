import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { getEffectivePermissions, permissionSetCan } from "@/lib/role-permissions";
import { getSchoolSettings } from "@/lib/school-settings";
import { PageHeader } from "@/components/ui";
import { StudentAttendanceEntry } from "@/components/student-attendance-entry";

export default async function StudentAttendancePage() {
  const user = await requirePermission("VIEW_STUDENT_ATTENDANCE"); const [settings, permissions, rows] = await Promise.all([
    getSchoolSettings(prisma), getEffectivePermissions(prisma, user.role),
    prisma.student.findMany({ where: { status: "Active", deletedAt: null }, select: { className: true, section: true }, distinct: ["className", "section"], orderBy: [{ className: "asc" }, { section: "asc" }] })
  ]);
  const classSections = rows.filter((row) => row.className).map((row) => ({ className: row.className, section: row.section ?? "" }));
  return <div className="page"><PageHeader title="Student Attendance" description="Take manual daily attendance by class and section. Biometric/RFID import and parent visibility are not enabled yet." />
    <StudentAttendanceEntry academicYear={settings.academicYear} classSections={classSections} canManage={permissionSetCan(permissions, "MANAGE_STUDENT_ATTENDANCE")} canSubmit={permissionSetCan(permissions, "SUBMIT_STUDENT_ATTENDANCE")} canLock={permissionSetCan(permissions, "LOCK_STUDENT_ATTENDANCE")} canViewReports={permissionSetCan(permissions, "VIEW_STUDENT_ATTENDANCE_REPORTS")} />
  </div>;
}
