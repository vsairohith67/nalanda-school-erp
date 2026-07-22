import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { localSubstituteDateText, substituteDate, substituteLabel } from "@/lib/substitutes";

const DAY_NAMES = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

export default async function SubstitutePlannerPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePermission("MANAGE_SUBSTITUTES");
  const sp = await searchParams;
  const today = localSubstituteDateText();
  const fromText = sp.from ?? today;
  const toText = sp.to ?? fromText;
  const from = substituteDate(fromText, "From date");
  const to = substituteDate(toText, "To date");
  if (to < from) throw new Error("To date cannot be before From date");
  const dayOfWeek = DAY_NAMES[from.getUTCDay()];
  const [leaves, attendance, entries, templates] = await Promise.all([
    prisma.staffLeaveRequest.findMany({ where: { status: "APPROVED", startDate: { lte: to }, endDate: { gte: from } }, include: { staffMember: { include: { timetableTeacher: true } } }, orderBy: { startDate: "asc" } }),
    prisma.staffAttendanceRecord.findMany({ where: { session: { attendanceDate: { gte: from, lte: to } }, status: { in: ["ABSENT", "ON_LEAVE"] } }, include: { session: true, staffMember: { include: { timetableTeacher: true } } }, orderBy: { session: { attendanceDate: "asc" } } }),
    prisma.timetableEntry.findMany({ where: { draft: { status: "ACTIVE" }, dayOfWeek, entryType: "TEACHING", teacherId: { not: null } }, include: { assignment: true, classSection: true, subject: true, teacher: true }, orderBy: [{ periodNumber: "asc" }, { classSection: { className: "asc" } }] }),
    prisma.timetablePeriodTemplate.findMany({ where: { dayOfWeek, isTeachingPeriod: true }, orderBy: { sortOrder: "asc" } })
  ]);
  const templateFor = (entry: (typeof entries)[number]) => templates.find((template) => template.periodNumber === entry.periodNumber && template.groupName === (dayOfWeek === "FRIDAY" ? "FRIDAY" : entry.classSection.groupName));
  const coverage = new Set(leaves.map((row) => row.staffMemberId));
  for (const row of attendance) coverage.add(row.staffMemberId);
  const attendanceOnly = attendance.filter((row) => !leaves.some((leave) => leave.staffMemberId === row.staffMemberId && leave.startDate <= row.session.attendanceDate && leave.endDate >= row.session.attendanceDate));

  return <div className="page">
    <PageHeader title="Substitute Planner" description="Review approved leave and recorded absence before creating any assignment. Nothing is auto-assigned." />
    <div className="subnav"><Link href="/substitutes">Assignments</Link><Link className="active" href="/substitutes/planner">Planner</Link><Link href="/substitutes/reports">Reports</Link></div>
    <form className="card card-pad substitute-filters"><label>From<input name="from" type="date" defaultValue={fromText} /></label><label>To<input name="to" type="date" defaultValue={toText} /></label><button>Review Coverage</button></form>
    {!coverage.size ? <section className="notice"><strong>No approved leave or recorded absence found.</strong> Choose another date range, or create a manual substitute plan when leadership has confirmed an emergency.</section> : null}
    <section className="planner-grid">
      {leaves.map((leave) => {
        const periods = entries.filter((entry) => entry.teacherId && entry.teacherId === leave.staffMember.timetableTeacherId);
        return <article className={`card card-pad planner-card ${leave.substituteRequired ? "urgent-card" : ""}`} key={leave.id}>
          <div className="section-title"><h3>{leave.staffMember.displayName || leave.staffMember.fullName}</h3>{leave.substituteRequired ? <span className="badge danger">Substitute required</span> : <span className="badge">Approved leave</span>}</div>
          <p>{leave.startDate.toISOString().slice(0, 10)} to {leave.endDate.toISOString().slice(0, 10)} · {substituteLabel(leave.leaveType)}</p>
          {periods.length ? <div><strong>Active timetable periods on {fromText}</strong><ul>{periods.map((entry) => {
            const period = templateFor(entry);
            const query = new URLSearchParams({ assignmentDate: fromText, leaveRequestId: leave.id, absentStaffMemberId: leave.staffMemberId, reason: "APPROVED_LEAVE", timetableAssignmentId: entry.assignmentId ?? "", className: entry.classSection.className, section: entry.classSection.section, subject: entry.subject?.name ?? "", periodLabel: period?.label ?? entry.label ?? `Period ${entry.periodNumber}`, periodStartTime: period?.startTime ?? "", periodEndTime: period?.endTime ?? "" });
            return <li key={entry.id}>{period?.label ?? entry.label ?? `Period ${entry.periodNumber}`} · {entry.classSection.displayName} · {entry.subject?.name ?? "Subject not linked"} <Link href={`/substitutes/new?${query}`}>Plan coverage</Link></li>;
          })}</ul></div> : <div className="notice">No linked active timetable periods were found for the selected start date. Manual assignment remains available.</div>}
          <Link className="button secondary" href={`/substitutes/new?assignmentDate=${fromText}&leaveRequestId=${leave.id}&absentStaffMemberId=${leave.staffMemberId}&reason=APPROVED_LEAVE`}>Create Manual Coverage</Link>
        </article>;
      })}
      {attendanceOnly.map((row) => <article className="card card-pad planner-card" key={row.id}><div className="section-title"><h3>{row.staffMember.displayName || row.staffMember.fullName}</h3><span className="badge warn">{substituteLabel(row.status)}</span></div><p>{row.session.attendanceDate.toISOString().slice(0, 10)} · Staff attendance record</p><Link className="button secondary" href={`/substitutes/new?assignmentDate=${row.session.attendanceDate.toISOString().slice(0, 10)}&absentStaffMemberId=${row.staffMemberId}&reason=STAFF_ABSENT`}>Plan Coverage</Link></article>)}
    </section>
    <section className="notice">Approved leave explains availability; it does not create a substitute assignment. Review each class period and save or assign coverage manually.</section>
  </div>;
}
