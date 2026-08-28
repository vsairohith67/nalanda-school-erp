import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission, getCurrentUserEffectivePermissions } from "@/lib/auth";
import { permissionSetCan } from "@/lib/role-permissions";
import { PageHeader, PageShell, StatusBadge } from "@/components/ui";
import { StaffDetail } from "@/components/staff-detail";
import type { CanonicalPermission } from "@/lib/permissions";

type StaffSection = "profile" | "assignments" | "attendance" | "leave" | "documents" | "account" | "payroll" | "biometric";
const LABELS: Record<StaffSection, string> = { profile: "Profile", assignments: "Assignments", attendance: "Attendance", leave: "Leave", documents: "Documents", account: "Account & security", payroll: "Payroll", biometric: "Biometric mapping" };

export default async function StaffDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ section?: string }> }) {
  const user = await requirePermission("VIEW_STAFF");
  const [{ id }, query, permissions] = await Promise.all([params, searchParams, getCurrentUserEffectivePermissions()]);
  const canManage = permissionSetCan(permissions, "MANAGE_STAFF");
  const staff = await prisma.staffMember.findUnique({
    where: { id },
    select: {
      id: true, staffCode: true, fullName: true, displayName: true, staffType: true, designation: true,
      department: true, primarySubject: true, additionalSubjects: true, qualification: true,
      experienceYears: true, dateOfJoining: true, status: true, timetableTeacherId: true,
      timetableTeacher: { select: { name: true, shortName: true } },
      createdAt: true, updatedAt: true
    }
  });
  if (!staff) notFound();
  const sections = (Object.keys(LABELS) as StaffSection[]).filter((section) => {
    if (["profile", "assignments", "account", "biometric"].includes(section)) return true;
    if (section === "attendance") return permissionSetCan(permissions, "VIEW_STAFF_ATTENDANCE") || permissionSetCan(permissions, "VIEW_STAFF_ATTENDANCE_REPORTS");
    if (section === "leave") return permissionSetCan(permissions, "VIEW_STAFF_LEAVE");
    if (section === "documents") return permissionSetCan(permissions, "VIEW_ID_CARDS") || permissionSetCan(permissions, "VIEW_LIBRARY_CIRCULATION") || permissionSetCan(permissions, "VIEW_LIBRARY_CHARGES");
    return permissionSetCan(permissions, "VIEW_PAYROLL");
  });
  const requested = query.section as StaffSection | undefined;
  const section = requested && sections.includes(requested) ? requested : "profile";
  const [privateStaff, timetableTeachers] = await Promise.all([
    canManage ? prisma.staffMember.findUnique({ where: { id }, select: { mobile: true, alternateMobile: true, email: true, address: true, emergencyContactName: true, emergencyContactMobile: true, notes: true, user: { select: { username: true, role: true, isActive: true } } } }) : null,
    section === "profile" && canManage ? prisma.timetableTeacher.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, shortName: true } }) : []
  ]);
  const account = privateStaff?.user ?? null;
  const value = { ...staff, ...(privateStaff ?? {}), user: account, dateOfJoining: staff.dateOfJoining?.toISOString() ?? null, createdAt: staff.createdAt.toISOString(), updatedAt: staff.updatedAt.toISOString() };
  return <PageShell className="staff-workspace-page">
    <PageHeader title={staff.displayName ?? staff.fullName} description={`${staff.designation} · ${staff.staffType}`} action={<Link className="button secondary" href="/staff">Back to staff</Link>} />
    <section className="workspace-identity card" aria-label="Staff identity and current status"><div><span>Staff code</span><strong>{staff.staffCode || "Not assigned"}</strong></div><div><span>Department</span><strong>{staff.department || "Not recorded"}</strong></div><div><span>Primary subject</span><strong>{staff.primarySubject || "Not recorded"}</strong></div><div><span>Status</span><StatusBadge status={staff.status} /></div></section>
    <nav className="workspace-tabs" aria-label="Staff workspace sections">{sections.map((item) => <Link key={item} href={`/staff/${staff.id}?section=${item}`} aria-current={item === section ? "page" : undefined} className={item === section ? "active" : ""}>{LABELS[item]}</Link>)}</nav>
    <p className="workspace-privacy-note">Only the selected bounded section is loaded. Payroll and private HR data remain hidden unless the current role has the exact owning permission.</p>
    {section === "profile" ? <StaffDetail staff={value} canManage={canManage} canCreateLogin={["SUPER_ADMIN", "DIRECTOR", "ADMIN"].includes(user.role)} timetableTeachers={timetableTeachers} /> : <StaffSectionView section={section} permissions={permissions} canManage={canManage} staff={{ id: staff.id, user: account, timetableTeacherId: staff.timetableTeacherId, timetableTeacher: staff.timetableTeacher }} />}
  </PageShell>;
}

async function StaffSectionView({ section, staff, permissions, canManage }: { section: StaffSection; permissions: Set<CanonicalPermission>; canManage: boolean; staff: { id: string; user: { username: string; role: string; isActive: boolean } | null; timetableTeacherId: string | null; timetableTeacher: { name: string; shortName: string } | null } }) {
  if (section === "assignments") return <section className="card card-pad workspace-section"><h2>Assignments and timetable</h2><dl className="detail-grid"><div><dt>Timetable teacher</dt><dd>{staff.timetableTeacher ? `${staff.timetableTeacher.name} (${staff.timetableTeacher.shortName})` : "Not linked"}</dd></div><div><dt>Assignment state</dt><dd><StatusBadge status={staff.timetableTeacherId ? "AVAILABLE" : "UNAVAILABLE"} /></dd></div></dl><p>Class, subject and timetable changes remain in the governed timetable module.</p><Link className="button secondary" href="/timetable/teachers">Open teacher timetable</Link></section>;
  if (section === "attendance") {
    const rows = await prisma.staffAttendanceRecord.findMany({ where: { staffMemberId: staff.id }, include: { session: { select: { attendanceDate: true, status: true } } }, orderBy: { session: { attendanceDate: "desc" } }, take: 90 });
    return <StaffTable title="Attendance" headers={["Date", "Attendance", "Check in", "Check out", "Late", "Source", "Session"]} rows={rows.map((row) => [display(row.session.attendanceDate), <StatusBadge key="status" status={row.status} />, row.checkInTime || "—", row.checkOutTime || "—", row.lateMinutes ? `${row.lateMinutes} min` : "—", row.source, <StatusBadge key="session" status={row.session.status} />])} empty="No staff attendance is recorded." />;
  }
  if (section === "leave") {
    const rows = await prisma.staffLeaveRequest.findMany({ where: { staffMemberId: staff.id }, orderBy: { createdAt: "desc" }, take: 30 });
    return <StaffTable title="Leave" headers={["Type", "From", "To", "Days", "Status", "Reason"]} rows={rows.map((row) => [row.leaveType.replaceAll("_", " "), display(row.startDate), display(row.endDate), String(row.totalDays), <StatusBadge key="status" status={row.status} />, row.reason])} empty="No leave request is recorded." />;
  }
  if (section === "documents") {
    const canCards = permissionSetCan(permissions, "VIEW_ID_CARDS");
    const canCirculation = permissionSetCan(permissions, "VIEW_LIBRARY_CIRCULATION");
    const canCharges = permissionSetCan(permissions, "VIEW_LIBRARY_CHARGES");
    const [cards, circulation, charges] = await Promise.all([
      canCards ? prisma.identityCard.count({ where: { staffMemberId: staff.id } }) : null,
      canCirculation ? prisma.libraryMember.findUnique({ where: { staffMemberId: staff.id }, select: { memberCode: true, status: true, _count: { select: { loans: true } } } }) : null,
      canCharges ? prisma.libraryMember.findUnique({ where: { staffMemberId: staff.id }, select: { _count: { select: { charges: true } } } }) : null
    ]);
    return <section className="card card-pad workspace-section"><h2>Governed documents</h2><dl className="detail-grid">{cards !== null ? <div><dt>ID card records</dt><dd>{cards}</dd></div> : null}{circulation ? <><div><dt>Library member</dt><dd>{circulation.memberCode}</dd></div><div><dt>Library status</dt><dd><StatusBadge status={circulation.status} /></dd></div><div><dt>Library loans</dt><dd>{circulation._count.loans}</dd></div></> : null}{charges ? <div><dt>Library charges</dt><dd>{charges._count.charges}</dd></div> : null}</dl><p>Each summary is queried only with its owning permission. Private file content is not prefetched and owning download routes re-authorise requests.</p></section>;
  }
  if (section === "account") return <section className="card card-pad workspace-section"><h2>Account and security</h2>{!canManage ? <p>Account linkage details require Staff management permission.</p> : staff.user ? <dl className="detail-grid"><div><dt>Username</dt><dd>{staff.user.username}</dd></div><div><dt>Role</dt><dd>{staff.user.role.replaceAll("_", " ")}</dd></div><div><dt>Account state</dt><dd><StatusBadge status={staff.user.isActive ? "ACTIVE" : "DISABLED"} /></dd></div></dl> : <p>No login account is linked.</p>}<p>Password, credential, session and audit details remain in the governed User and Account Security modules.</p></section>;
  if (section === "payroll") {
    const [assignments, payslips] = await Promise.all([prisma.staffCompensationAssignment.count({ where: { staffMemberId: staff.id } }), prisma.payslipVersion.count({ where: { staffMemberId: staff.id } })]);
    return <section className="card card-pad workspace-section"><h2>Payroll and payslips</h2><dl className="detail-grid"><div><dt>Governed compensation assignments</dt><dd>{assignments}</dd></div><div><dt>Payslip versions</dt><dd>{payslips}</dd></div></dl><p>Salary amounts are intentionally not duplicated into Staff 360. Open the payroll owner for authorised financial detail.</p><Link className="button secondary" href="/payroll">Open payroll</Link></section>;
  }
  return <section className="card card-pad workspace-section"><h2>Future biometric mapping</h2><p><StatusBadge status="DISABLED" /></p><p>No biometric template, image, card secret, device password or vendor database is stored here. Provider-neutral mapping remains a later, default-off governed phase and requires separate software and hardware gates.</p></section>;
}

function StaffTable({ title, headers, rows, empty }: { title: string; headers: string[]; rows: React.ReactNode[][]; empty: string }) { return <section className="card workspace-section"><div className="section-title"><h2>{title}</h2></div><div className="table-wrap"><table aria-label={title}><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}{!rows.length ? <tr><td colSpan={headers.length}>{empty}</td></tr> : null}</tbody></table></div></section>; }
function display(value: Date) { return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata" }).format(value); }
