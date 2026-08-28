import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader, PageShell, StatusBadge } from "@/components/ui";
import { getCurrentUserEffectivePermissions, requirePermission } from "@/lib/auth";
import { displayDate, money } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { permissionSetCan } from "@/lib/role-permissions";
import type { CanonicalPermission } from "@/lib/permissions";

type StudentSection = "overview" | "guardians" | "academic" | "attendance" | "fees" | "results" | "library" | "meetings" | "operations" | "documents" | "lifecycle";

const SECTION_LABELS: Record<StudentSection, string> = {
  overview: "Overview",
  guardians: "Guardians",
  academic: "Academic history",
  attendance: "Attendance",
  fees: "Fees",
  results: "Exams & marks",
  library: "Library",
  meetings: "Meetings",
  operations: "Transport & cafeteria",
  documents: "Documents",
  lifecycle: "Lifecycle"
};

function availableSections(permissions: Set<CanonicalPermission>) {
  return (Object.keys(SECTION_LABELS) as StudentSection[]).filter((section) => {
    if (section === "overview") return true;
    if (section === "guardians") return permissionSetCan(permissions, "VIEW_GUARDIANS");
    if (section === "academic") return permissionSetCan(permissions, "VIEW_ACADEMIC_YEAR_ENROLLMENTS");
    if (section === "attendance") return permissionSetCan(permissions, "VIEW_STUDENT_ATTENDANCE") || permissionSetCan(permissions, "VIEW_STUDENT_ATTENDANCE_REPORTS");
    if (section === "fees") return permissionSetCan(permissions, "VIEW_LEDGER") || permissionSetCan(permissions, "VIEW_PAYMENTS");
    if (section === "results") return permissionSetCan(permissions, "VIEW_REPORT_CARDS");
    if (section === "library") return permissionSetCan(permissions, "VIEW_LIBRARY_CIRCULATION") || permissionSetCan(permissions, "VIEW_LIBRARY_INCIDENTS") || permissionSetCan(permissions, "VIEW_LIBRARY_CHARGES");
    if (section === "meetings") return permissionSetCan(permissions, "VIEW_PARENT_MEETINGS");
    if (section === "operations") return permissionSetCan(permissions, "VIEW_TRANSPORT") || permissionSetCan(permissions, "VIEW_CAFETERIA");
    if (section === "documents") return permissionSetCan(permissions, "VIEW_CERTIFICATES") || permissionSetCan(permissions, "VIEW_CLASS_X_PACKAGES") || permissionSetCan(permissions, "VIEW_ID_CARDS") || permissionSetCan(permissions, "VIEW_REPORT_CARDS");
    return permissionSetCan(permissions, "VIEW_STUDENT_LIFECYCLE");
  });
}

export default async function StudentWorkspacePage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ section?: string }>;
}) {
  const user = await requirePermission("VIEW_STUDENTS");
  if (["PARENT", "TEACHER", "STUDENT"].includes(user.role)) redirect("/unauthorized");
  const [{ id }, query, permissions] = await Promise.all([params, searchParams, getCurrentUserEffectivePermissions()]);
  const sections = availableSections(permissions);
  const requested = query.section as StudentSection | undefined;
  const section = requested && sections.includes(requested) ? requested : "overview";
  const student = await prisma.student.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      admissionNo: true,
      studentName: true,
      fatherName: true,
      motherName: true,
      academicYear: true,
      className: true,
      section: true,
      rollNo: true,
      dateOfBirth: true,
      studentType: true,
      status: true,
      startMonth: true,
      updatedAt: true
    }
  });
  if (!student) notFound();

  return (
    <PageShell className="student-workspace-page">
      <PageHeader
        title={student.studentName}
        description={`Admission ${student.admissionNo} · ${student.className}${student.section ? `-${student.section}` : ""} · ${student.academicYear}`}
        action={<div className="page-actions"><Link className="button secondary" href="/students">Back to students</Link>{permissionSetCan(permissions, "EDIT_STUDENTS") ? <Link className="button" href={`/students/${student.id}/edit`}>Edit authorised fields</Link> : null}</div>}
      />
      <section className="workspace-identity card" aria-label="Student identity and current status">
        <div><span>Admission number</span><strong>{student.admissionNo}</strong></div>
        <div><span>Current class</span><strong>{student.className}{student.section ? `-${student.section}` : ""}</strong></div>
        <div><span>Roll number</span><strong>{student.rollNo || "Not assigned"}</strong></div>
        <div><span>Status</span><StatusBadge status={student.status} /></div>
      </section>
      <nav className="workspace-tabs" aria-label="Student workspace sections">
        {sections.map((item) => <Link key={item} href={`/students/${student.id}?section=${item}`} aria-current={item === section ? "page" : undefined} className={item === section ? "active" : ""}>{SECTION_LABELS[item]}</Link>)}
      </nav>
      <p className="workspace-privacy-note">Only this selected section is loaded. Parent and Teacher views remain in their separately scoped portals; this workspace never broadens linked-child or timetable authority.</p>
      <StudentSectionView section={section} student={student} permissions={permissions} />
    </PageShell>
  );
}

async function StudentSectionView({
  section,
  student,
  permissions
}: {
  section: StudentSection;
  student: { id: string; admissionNo: string; studentName: string; fatherName: string; motherName: string | null; academicYear: string; className: string; section: string | null; rollNo: string | null; dateOfBirth: Date | null; studentType: string; status: string; startMonth: string; updatedAt: Date };
  permissions: Set<CanonicalPermission>;
}) {
  if (section === "overview") return <section className="card card-pad workspace-section"><h2>Overview</h2><dl className="detail-grid"><div><dt>Student</dt><dd>{student.studentName}</dd></div><div><dt>Father / recorded guardian name</dt><dd>{student.fatherName}</dd></div><div><dt>Mother</dt><dd>{student.motherName || "Not recorded"}</dd></div><div><dt>Date of birth</dt><dd>{student.dateOfBirth ? displayDate(student.dateOfBirth) : "Not recorded"}</dd></div><div><dt>Student type</dt><dd>{student.studentType}</dd></div><div><dt>Fee start month</dt><dd>{student.startMonth}</dd></div><div><dt>Record status</dt><dd><StatusBadge status={student.status} /></dd></div><div><dt>Last updated</dt><dd>{displayDate(student.updatedAt)}</dd></div></dl></section>;

  if (section === "guardians") {
    const rows = await prisma.studentGuardian.findMany({ where: { studentId: student.id }, select: { id: true, relationshipToStudent: true, isPrimaryContact: true, canViewFees: true, canReceiveReminders: true, guardian: { select: { displayName: true, status: true } } }, orderBy: [{ isPrimaryContact: "desc" }, { createdAt: "asc" }], take: 20 });
    return <WorkspaceTable title="Guardians" description="Contact values remain in the governed Guardian workspace." headers={["Guardian", "Relationship", "Primary contact", "Fee view", "Reminders", "Status"]} rows={rows.map((row) => [row.guardian.displayName, row.relationshipToStudent, row.isPrimaryContact ? "Yes" : "No", row.canViewFees ? "Allowed" : "Not allowed", row.canReceiveReminders ? "Allowed" : "Not allowed", <StatusBadge key="status" status={row.guardian.status} />])} empty="No governed Guardian link is recorded." />;
  }
  if (section === "academic") {
    const rows = await prisma.academicYearEnrollment.findMany({ where: { studentId: student.id }, orderBy: { academicYear: "desc" }, take: 20 });
    return <WorkspaceTable title="Academic history" description="Bounded academic-year enrollment history." headers={["Academic year", "Class", "Roll", "Status", "Enrollment", "Exit"]} rows={rows.map((row) => [row.academicYear, `${row.className}${row.section ? `-${row.section}` : ""}`, row.rollNo || "—", <StatusBadge key="status" status={row.status} />, row.enrollmentDate ? displayDate(row.enrollmentDate) : "—", row.exitDate ? displayDate(row.exitDate) : "—"])} empty="No academic-year enrollment history is recorded." />;
  }
  if (section === "attendance") {
    const rows = await prisma.studentAttendanceRecord.findMany({ where: { studentId: student.id }, include: { session: { select: { attendanceDate: true, academicYear: true, status: true } } }, orderBy: { session: { attendanceDate: "desc" } }, take: 90 });
    return <WorkspaceTable title="Attendance" description="Latest 90 posted or governed attendance records." headers={["Date", "Academic year", "Attendance", "Session", "Remarks"]} rows={rows.map((row) => [displayDate(row.session.attendanceDate), row.session.academicYear, <StatusBadge key="attendance" status={row.status} />, <StatusBadge key="session" status={row.session.status} />, row.remarks || "—"])} empty="No attendance record is available." />;
  }
  if (section === "fees") {
    const rows = await prisma.payment.findMany({ where: { studentId: student.id, deletedAt: null }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 50 });
    return <WorkspaceTable title="Fee ledger activity" description="Latest 50 governed payment records. Exports remain separate and permission checked." headers={["Date", "Receipt", "Fee type", "Amount", "Mode", "Status"]} rows={rows.map((row) => [displayDate(row.date), row.receiptNo, row.feeType, money(row.amountPaid), row.paymentMode, <StatusBadge key="status" status={row.isCancelled ? "CANCELLED" : "POSTED"} />])} empty="No fee payment activity is recorded." action={permissionSetCan(permissions, "VIEW_LEDGER") ? <Link className="button secondary" href={`/ledger?admissionNo=${encodeURIComponent(student.admissionNo)}`}>Open full ledger</Link> : undefined} />;
  }
  if (section === "results") {
    const rows = await prisma.studentReportCard.findMany({ where: { studentId: student.id }, select: { id: true, reportCardNumber: true, academicYear: true, reportType: true, status: true, finalGrade: true, issuedAt: true }, orderBy: { updatedAt: "desc" }, take: 20 });
    return <WorkspaceTable title="Exams, marks and issued reports" description="Report-card summaries only; source marks remain governed by Academic Integrity permissions." headers={["Report", "Academic year", "Type", "Status", "Grade", "Issued"]} rows={rows.map((row) => [<Link key="report" href={`/report-cards/${row.id}`}>{row.reportCardNumber}</Link>, row.academicYear, row.reportType.replaceAll("_", " "), <StatusBadge key="status" status={row.status} />, row.finalGrade || "—", row.issuedAt ? displayDate(row.issuedAt) : "—"])} empty="No report-card record is available in this authorised scope." />;
  }
  if (section === "library") {
    const canCirculation = permissionSetCan(permissions, "VIEW_LIBRARY_CIRCULATION");
    const canIncidents = permissionSetCan(permissions, "VIEW_LIBRARY_INCIDENTS");
    const canCharges = permissionSetCan(permissions, "VIEW_LIBRARY_CHARGES");
    const [circulation, incidents, charges] = await Promise.all([
      canCirculation ? prisma.libraryMember.findUnique({ where: { studentId: student.id }, select: { memberCode: true, status: true, joinedDate: true, _count: { select: { loans: true, reservations: true } } } }) : null,
      canIncidents ? prisma.libraryMember.findUnique({ where: { studentId: student.id }, select: { _count: { select: { incidents: true } } } }) : null,
      canCharges ? prisma.libraryMember.findUnique({ where: { studentId: student.id }, select: { _count: { select: { charges: true } } } }) : null
    ]);
    return <section className="card card-pad workspace-section"><h2>Library</h2>{circulation || incidents || charges ? <dl className="detail-grid">{circulation ? <><div><dt>Member code</dt><dd>{circulation.memberCode}</dd></div><div><dt>Status</dt><dd><StatusBadge status={circulation.status} /></dd></div><div><dt>Joined</dt><dd>{displayDate(circulation.joinedDate)}</dd></div><div><dt>Loans</dt><dd>{circulation._count.loans}</dd></div><div><dt>Reservations</dt><dd>{circulation._count.reservations}</dd></div></> : null}{incidents ? <div><dt>Incidents</dt><dd>{incidents._count.incidents}</dd></div> : null}{charges ? <div><dt>Charges</dt><dd>{charges._count.charges}</dd></div> : null}</dl> : <p>No authorised Library summary is available.</p>}</section>;
  }
  if (section === "meetings") {
    const rows = await prisma.parentMeeting.findMany({ where: { studentId: student.id }, select: { publicKey: true, category: true, subject: true, status: true, scheduledStartAt: true }, orderBy: { createdAt: "desc" }, take: 20 });
    return <WorkspaceTable title="Parent meetings" description="Latest 20 governed meeting records; private notes are not loaded here." headers={["Reference", "Category", "Subject", "Status", "Scheduled"]} rows={rows.map((row) => [row.publicKey.slice(0, 8), row.category, row.subject, <StatusBadge key="status" status={row.status} />, row.scheduledStartAt ? displayDate(row.scheduledStartAt) : "Not scheduled"])} empty="No meeting is recorded." />;
  }
  if (section === "operations") return <section className="card card-pad workspace-section"><h2>Transport and cafeteria</h2><p>Optional operations remain default-off unless separately enabled and authorised.</p><div className="page-actions">{permissionSetCan(permissions, "VIEW_TRANSPORT") ? <Link className="button secondary" href="/operations/transport">Open transport</Link> : null}{permissionSetCan(permissions, "VIEW_CAFETERIA") ? <Link className="button secondary" href="/operations/cafeteria">Open cafeteria</Link> : null}</div></section>;
  if (section === "documents") {
    const canCertificates = permissionSetCan(permissions, "VIEW_CERTIFICATES");
    const canCards = permissionSetCan(permissions, "VIEW_ID_CARDS");
    const canPackages = permissionSetCan(permissions, "VIEW_CLASS_X_PACKAGES");
    const canReports = permissionSetCan(permissions, "VIEW_REPORT_CARDS");
    const [certificates, cards, packages, reports] = await Promise.all([
      canCertificates ? prisma.studentCertificate.count({ where: { studentId: student.id } }) : null,
      canCards ? prisma.identityCard.count({ where: { studentId: student.id } }) : null,
      canPackages ? prisma.classXDocumentPackage.count({ where: { studentId: student.id } }) : null,
      canReports ? prisma.studentReportCard.count({ where: { studentId: student.id } }) : null
    ]);
    return <section className="card card-pad workspace-section"><h2>Governed documents</h2><dl className="detail-grid">{certificates !== null ? <div><dt>Certificates</dt><dd>{certificates}</dd></div> : null}{cards !== null ? <div><dt>ID card records</dt><dd>{cards}</dd></div> : null}{packages !== null ? <div><dt>Class X packages</dt><dd>{packages}</dd></div> : null}{reports !== null ? <div><dt>Report cards</dt><dd>{reports}</dd></div> : null}</dl><p>Each count is queried only with its owning permission. Private file download remains in each owning module and is re-authorised at request time.</p></section>;
  }
  const rows = await prisma.studentLifecycleEvent.findMany({ where: { studentId: student.id }, orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }], take: 30 });
  return <WorkspaceTable title="Lifecycle" description="Append-only lifecycle evidence; this view does not mutate progression." headers={["Effective date", "Event", "From", "To", "Reason"]} rows={rows.map((row) => [displayDate(row.effectiveDate), row.eventType.replaceAll("_", " "), [row.fromClass, row.fromSection, row.fromStatus].filter(Boolean).join(" · ") || "—", [row.toClass, row.toSection, row.toStatus].filter(Boolean).join(" · ") || "—", row.reason || "—"])} empty="No lifecycle event is recorded." action={<Link className="button secondary" href={`/students/${student.id}/lifecycle`}>Open full lifecycle</Link>} />;
}

function WorkspaceTable({ title, description, headers, rows, empty, action }: { title: string; description: string; headers: string[]; rows: React.ReactNode[][]; empty: string; action?: React.ReactNode }) {
  return <section className="card workspace-section"><div className="section-title"><div><h2>{title}</h2><p>{description}</p></div>{action}</div><div className="table-wrap"><table aria-label={title}><thead><tr>{headers.map((header) => <th key={header} scope="col">{header}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}{!rows.length ? <tr><td colSpan={headers.length}>{empty}</td></tr> : null}</tbody></table></div></section>;
}
