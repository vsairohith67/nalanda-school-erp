import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSchoolSettings } from "@/lib/school-settings";
import {
  attendanceDateRange,
  attendanceReportData,
  localDateText,
  optionalAttendanceFilter
} from "@/lib/student-attendance";
import {
  AttendanceScopeError,
  attendanceScopeWhere,
  requireAttendanceReportFilter,
  resolveTeacherAttendanceScope
} from "@/lib/teacher-attendance-scope";
import { PageHeader } from "@/components/ui";

export default async function StudentAttendanceReportsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requirePermission("VIEW_STUDENT_ATTENDANCE_REPORTS");
  const sp = await searchParams;
  const settings = await getSchoolSettings(prisma);
  const today = localDateText();
  const fromText = sp.from ?? `${today.slice(0, 8)}01`;
  const toText = sp.to ?? today;
  try {
    const { from, to } = attendanceDateRange(fromText, toText);
    const resolved = await resolveTeacherAttendanceScope(prisma, user, {
      academicYear: settings.academicYear,
      from,
      to
    });
    const options = user.role === "TEACHER"
      ? uniqueReportOptions(resolved.targets)
      : (await prisma.student.findMany({
        where: { academicYear: settings.academicYear, status: "Active", deletedAt: null },
        select: { className: true, section: true },
        distinct: ["className", "section"],
        orderBy: [{ className: "asc" }, { section: "asc" }]
      })).map((row) => ({ className: row.className, section: row.section ?? "" }));
    const selected = sp.scope
      ? options.find((option) => scopeKey(option) === sp.scope)
      : null;
    if (sp.scope && !selected) throw new AttendanceScopeError();
    const className = selected?.className ?? optionalAttendanceFilter(sp.className);
    const section = selected?.section ?? optionalAttendanceFilter(sp.section);
    requireAttendanceReportFilter(resolved, {
      academicYear: settings.academicYear,
      className,
      section
    });
    const data = await attendanceReportData(prisma, {
      from,
      to,
      academicYear: settings.academicYear,
      className,
      section,
      scopeWhere: attendanceScopeWhere(resolved)
    });
    const exportQuery = new URLSearchParams({
      from: fromText,
      to: toText,
      academicYear: settings.academicYear,
      ...(className ? { className } : {}),
      ...(section !== undefined ? { section } : {})
    });
    const canExport = user.role !== "TEACHER" || resolved.targets.length > 0;
    return <div className="page attendance-page">
      <PageHeader
        title="Student Attendance Reports"
        description="Review submitted or locked attendance only inside the same server-authorised scope used for daily entry."
        action={canExport
          ? <Link className="button" href={`/api/attendance/students/reports/export?${exportQuery}`}>Export CSV</Link>
          : undefined}
      />
      <div className="subnav">
        <Link href="/attendance/students">Take Attendance</Link>
        <Link className="active" href="/attendance/students/reports">Reports</Link>
      </div>
      <form className="card card-pad attendance-report-filters">
        <label>From<input name="from" type="date" defaultValue={fromText} /></label>
        <label>To<input name="to" type="date" defaultValue={toText} /></label>
        <label>Authorised class / section
          <select name="scope" defaultValue={selected ? scopeKey(selected) : ""}>
            <option value="">All authorised classes / sections</option>
            {options.map((option) =>
              <option key={scopeKey(option)} value={scopeKey(option)}>
                {option.className}{option.section ? `-${option.section}` : " (no section)"}
              </option>
            )}
          </select>
        </label>
        <button>Apply Filters</button>
      </form>
      {user.role === "TEACHER" && !resolved.targets.length
        ? <section className="card empty-state">
          <h3>No authorised attendance report scope</h3>
          <p>{resolved.reason || "No exact active timetable or confirmed dated substitute assignment is available for this report range."}</p>
        </section>
        : null}
      <p className="notice">Official totals include submitted and locked attendance only. Draft work is excluded.</p>
      <div className="grid stats">
        <div className="stat"><span>Marked</span><strong>{data.totals.total}</strong></div>
        <div className="stat"><span>Present</span><strong>{data.totals.PRESENT}</strong></div>
        <div className="stat"><span>Absent</span><strong>{data.totals.ABSENT}</strong></div>
        <div className="stat"><span>Late</span><strong>{data.totals.LATE}</strong></div>
      </div>
      <section className="card">
        <div className="section-title"><h3>Date-wise Class / Section Report</h3></div>
        <div className="table-wrap"><table>
          <thead><tr><th>Date</th><th>Class</th><th>Status</th><th>Students</th><th>Present</th><th>Absent</th><th>Late</th><th>Half Day</th><th>Excused</th></tr></thead>
          <tbody>{data.sessions.map((session) => {
            const totals = { PRESENT: 0, ABSENT: 0, LATE: 0, HALF_DAY: 0, EXCUSED: 0 };
            session.records.forEach((row) => {
              if (row.status in totals) totals[row.status as keyof typeof totals] += 1;
            });
            return <tr key={session.id}>
              <td>{session.attendanceDate.toISOString().slice(0, 10)}</td>
              <td>{session.className}{session.section ? `-${session.section}` : ""}</td>
              <td>{session.status}</td>
              <td>{session.records.length}</td>
              <td>{totals.PRESENT}</td><td>{totals.ABSENT}</td><td>{totals.LATE}</td><td>{totals.HALF_DAY}</td><td>{totals.EXCUSED}</td>
            </tr>;
          })}
          {!data.sessions.length ? <tr><td colSpan={9}>No authorised attendance sessions match these filters.</td></tr> : null}
          </tbody>
        </table></div>
      </section>
      <div className="grid two">
        <ReportList title="Absent List" rows={data.rows.filter((row) => row.status === "ABSENT")} />
        <ReportList title="Late List" rows={data.rows.filter((row) => row.status === "LATE")} />
      </div>
      <section className="card">
        <div className="section-title"><h3>Monthly Summary by Student</h3></div>
        <div className="table-wrap"><table>
          <thead><tr><th>Admission No.</th><th>Student</th><th>Class</th><th>Marked Days</th><th>Present</th><th>Absent</th><th>Late</th><th>Half Day</th><th>Excused</th></tr></thead>
          <tbody>{data.byStudent.map((row) =>
            <tr key={row.admissionNo}>
              <td>{row.admissionNo}</td><td>{row.studentName}</td><td>{row.className}{row.section ? `-${row.section}` : ""}</td>
              <td>{row.total}</td><td>{row.present}</td><td>{row.absent}</td><td>{row.late}</td><td>{row.halfDay}</td><td>{row.excused}</td>
            </tr>
          )}
          {!data.byStudent.length ? <tr><td colSpan={9}>No authorised student attendance records match these filters.</td></tr> : null}
          </tbody>
        </table></div>
      </section>
    </div>;
  } catch {
    notFound();
  }
}

function uniqueReportOptions(targets: Array<{ className: string; section: string }>) {
  return [...new Map(targets.map((target) => [
    scopeKey(target),
    { className: target.className, section: target.section }
  ])).values()].sort((a, b) => a.className.localeCompare(b.className) || a.section.localeCompare(b.section));
}

function scopeKey(scope: { className: string; section: string }) {
  return `${scope.className}|${scope.section}`;
}

function ReportList({
  title,
  rows
}: {
  title: string;
  rows: Array<{
    attendanceDate: Date;
    admissionNo: string;
    studentName: string;
    className: string;
    section: string;
    remarks: string | null;
  }>;
}) {
  return <section className="card">
    <div className="section-title"><h3>{title}</h3></div>
    <div className="table-wrap"><table>
      <thead><tr><th>Date</th><th>Student</th><th>Class</th><th>Remarks</th></tr></thead>
      <tbody>{rows.map((row, index) =>
        <tr key={`${row.admissionNo}-${row.attendanceDate.toISOString()}-${index}`}>
          <td>{row.attendanceDate.toISOString().slice(0, 10)}</td>
          <td>{row.studentName}<small className="muted-text"> {row.admissionNo}</small></td>
          <td>{row.className}{row.section ? `-${row.section}` : ""}</td>
          <td>{row.remarks ?? "-"}</td>
        </tr>
      )}
      {!rows.length ? <tr><td colSpan={4}>No students in this authorised list.</td></tr> : null}
      </tbody>
    </table></div>
  </section>;
}
