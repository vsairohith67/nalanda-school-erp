import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission, getCurrentUserEffectivePermissions } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { permissionSetCan } from "@/lib/role-permissions";
import { getSchoolSettings } from "@/lib/school-settings";
import { attendanceDay, localDateText } from "@/lib/student-attendance";
import { attendanceScopeOptionsForDate, resolveTeacherAttendanceScope } from "@/lib/teacher-attendance-scope";

export default async function TeacherPage() {
  const user = await requirePermission("VIEW_TEACHER_PLACEHOLDER");
  if (user.role !== "TEACHER") redirect("/unauthorized");
  const [staff, permissions, settings] = await Promise.all([
    prisma.staffMember.findUnique({ where: { userId: user.id }, include: { timetableTeacher: { select: { name: true, shortName: true } } } }),
    getCurrentUserEffectivePermissions(),
    getSchoolSettings(prisma)
  ]);
  const today = attendanceDay(localDateText());
  const attendanceScope = await resolveTeacherAttendanceScope(prisma, user, {
    academicYear: settings.academicYear,
    date: today
  });
  const attendanceOptions = attendanceScopeOptionsForDate(attendanceScope, today);
  const canTakeAttendance = permissionSetCan(permissions, "VIEW_STUDENT_ATTENDANCE") && attendanceOptions.length > 0;
  const canViewAttendanceReports = permissionSetCan(permissions, "VIEW_STUDENT_ATTENDANCE_REPORTS") && attendanceScope.targets.length > 0;
  const canViewLeave = permissionSetCan(permissions, "VIEW_STAFF_LEAVE");
  const canViewSubstitutes = permissionSetCan(permissions, "VIEW_SUBSTITUTES");
  return <div className="page">
    <PageHeader title="Teacher Portal" description="A safe starting page for teacher access." action={canTakeAttendance ? <Link className="button" href="/attendance/students">Take Student Attendance</Link> : undefined} />
    <section className="notice"><strong>{canTakeAttendance ? "Exact-scope student attendance is available." : "No student-attendance scope is authorised today."}</strong> Permission alone never grants a cohort: the page and APIs require an active linked StaffMember, active timetable Teacher, and exact active timetable or confirmed dated substitute assignment. Substitute-duty administration stays read-only for Teachers; confirmed dated substitute attendance remains available only on its approved date.</section>
    <section className="card card-pad"><h3>My Student Attendance</h3>{attendanceOptions.length ? <><p>Open only the class and section scopes authorised for this date. Submitted corrections require a reason and append-only audit evidence.</p><div className="page-actions">{canTakeAttendance?<Link className="button" href="/attendance/students">Take Student Attendance</Link>:<p>Attendance entry permission is not enabled.</p>}{canViewAttendanceReports?<Link className="button secondary" href="/attendance/students/reports">Open My Attendance Reports</Link>:null}</div></> : <p>{attendanceScope.reason || "No exact active timetable or confirmed dated substitute scope is available."}</p>}</section>
    <section className="card card-pad"><h3>My Leave</h3>{staff ? <><p>Create and track leave requests for your linked staff profile. You cannot see other staff leave.</p>{canViewLeave?<Link className="button" href="/leave/staff">Open My Leave</Link>:<p>Leave access is not enabled for this account.</p>}</> : <p>No staff profile is linked to this Teacher login yet. Please ask an authorized administrator to link it before applying for leave.</p>}</section>
    <section className="card card-pad"><h3>My Substitute Duties</h3>{staff ? <><p>See only duties where your linked staff profile is the assigned substitute. Leadership manages all workflow actions.</p>{canViewSubstitutes?<Link className="button" href="/substitutes">Open My Substitute Duties</Link>:<p>Substitute duty access is not enabled for this account.</p>}</>:<p>No staff profile is linked to this Teacher login yet.</p>}</section>
    <section className="card card-pad"><h3>My Library Account</h3><p>Review only your own StaffMember-linked loans, reservations, cases, charges, and Library Charge Receipts.</p><Link className="button" href="/teacher/library">Open My Library Account</Link></section>
    <section className="card card-pad"><h3>My Homework</h3><p>Create, publish, and review homework only for class, section, and subject assignments linked through your timetable profile.</p><Link className="button" href="/teacher/homework">Open Homework</Link></section>
    <section className="card card-pad"><h3>My Report Cards</h3><p>Enter comments or LKG/UKG rubrics only inside your exact timetable class and section scope. Raw marks and issue actions remain read-only.</p>{permissionSetCan(permissions,"VIEW_REPORT_CARDS")?<Link className="button" href="/teacher/report-cards">Open Report Cards</Link>:<p>Report-card access is not enabled for this account.</p>}</section>
    <section className="card card-pad"><h3>My Teacher Analytics</h3><p>View only your own shared or finalised evidence categories and submit a contextual response. Draft leadership notes and peer analytics remain inaccessible.</p>{permissionSetCan(permissions,"VIEW_OWN_TEACHER_ANALYTICS")?<Link className="button" href="/teacher/analytics">Open My Analytics</Link>:<p>Teacher analytics self-view is not enabled for this account.</p>}</section>
    <section className="card card-pad"><h3>My Staff ID Card</h3><p>View only your own linked StaffMember operational ID card. It is not a government identity document.</p>{permissionSetCan(permissions,"VIEW_OWN_STAFF_ID_CARD")?<Link className="button" href="/teacher/id-card">Open My ID Card</Link>:<p>ID-card self-view is not enabled for this account.</p>}</section>
    <section className="card card-pad"><h3>Staff Profile Basics</h3>{staff ? <dl className="detail-list"><div><dt>Name</dt><dd>{staff.displayName ?? staff.fullName}</dd></div><div><dt>Staff Code</dt><dd>{staff.staffCode ?? "Not assigned"}</dd></div><div><dt>Designation</dt><dd>{staff.designation}</dd></div><div><dt>Department</dt><dd>{staff.department ?? "Not recorded"}</dd></div><div><dt>Primary Subject</dt><dd>{staff.primarySubject ?? "Not recorded"}</dd></div><div><dt>Status</dt><dd>{staff.status}</dd></div><div><dt>Timetable Master Link</dt><dd>{staff.timetableTeacher ? `${staff.timetableTeacher.name} (${staff.timetableTeacher.shortName})` : "Not linked"}</dd></div></dl> : <p>No staff profile is linked to this Teacher login yet. Please ask an authorized administrator to link it.</p>}</section>
  </div>;
}
