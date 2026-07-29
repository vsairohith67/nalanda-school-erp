import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { getEffectivePermissions, permissionSetCan } from "@/lib/role-permissions";
import { getSchoolSettings } from "@/lib/school-settings";
import { PageHeader } from "@/components/ui";
import { StudentAttendanceEntry } from "@/components/student-attendance-entry";
import { attendanceDay, localDateText } from "@/lib/student-attendance";
import { attendanceScopeOptionsForDate, resolveTeacherAttendanceScope } from "@/lib/teacher-attendance-scope";

export default async function StudentAttendancePage() {
  const user = await requirePermission("VIEW_STUDENT_ATTENDANCE");
  const [settings, permissions] = await Promise.all([
    getSchoolSettings(prisma),
    getEffectivePermissions(prisma, user.role)
  ]);
  const today = attendanceDay(localDateText());
  const resolved = await resolveTeacherAttendanceScope(prisma, user, {
    academicYear: settings.academicYear,
    date: today
  });
  const initialClassSections = user.role === "TEACHER"
    ? attendanceScopeOptionsForDate(resolved, today)
    : (await prisma.student.findMany({
      where: { academicYear: settings.academicYear, status: "Active", deletedAt: null },
      select: { className: true, section: true },
      distinct: ["className", "section"],
      orderBy: [{ className: "asc" }, { section: "asc" }]
    }))
      .filter((row) => row.className)
      .map((row) => ({
        className: row.className,
        section: row.section ?? "",
        source: "LEADERSHIP_PERMISSION" as const
      }));
  return <div className="page attendance-page"><PageHeader title="Student Attendance" description="Take, submit, and correct manual attendance with a recorded reason only inside the exact authorised class, section, academic year, and date scope." />
    <StudentAttendanceEntry
      academicYear={settings.academicYear}
      initialClassSections={initialClassSections}
      initialEmptyReason={resolved.reason}
      canManage={permissionSetCan(permissions, "MANAGE_STUDENT_ATTENDANCE")}
      canSubmit={permissionSetCan(permissions, "SUBMIT_STUDENT_ATTENDANCE")}
      canLock={permissionSetCan(permissions, "LOCK_STUDENT_ATTENDANCE")}
      canViewReports={permissionSetCan(permissions, "VIEW_STUDENT_ATTENDANCE_REPORTS")}
    />
  </div>;
}
