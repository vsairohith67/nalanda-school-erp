import type { PrismaClient } from "@prisma/client";
import { getSchoolSettings, type SchoolSettingsValue } from "@/lib/school-settings";

export const UDISE_PLANNING_WARNING = "Planning checklist only — not official UDISE+ submission.";
export const UDISE_VERIFICATION_WARNING = "Verify against latest UDISE+ portal before production use.";

export const CHECKLIST_STATUSES = [
  "Complete",
  "Missing",
  "Not tracked in ERP",
  "Needs school verification",
  "Sensitive/privacy caution"
] as const;
export type ChecklistStatus = (typeof CHECKLIST_STATUSES)[number];
export type ChecklistCounts = Record<ChecklistStatus, number>;

export type UdiseStudentSource = {
  admissionNo: string;
  studentName: string;
  className: string;
  section: string | null;
  status: string;
  dateOfBirth: Date | null;
  address: string | null;
  aadhaarNo: string | null;
  guardians: Array<{ isPrimaryContact: boolean; guardian: { primaryMobile: string } }>;
  academicYearEnrollments: Array<{ academicYear: string; className: string; section: string | null; status: string }>;
  lifecycleEvents: Array<{ eventType: string }>;
  progressionDecisions: Array<{ decisionType: string }>;
};

export type UdiseStaffSource = {
  staffCode: string | null;
  fullName: string;
  staffType: string;
  designation: string;
  mobile: string | null;
  email: string | null;
  qualification: string | null;
  status: string;
};

export type UdiseStudentGapRow = {
  admissionNo: string;
  studentName: string;
  className: string;
  section: string;
  classSection: string;
  studentStatus: string;
  dateOfBirthStatus: ChecklistStatus;
  genderStatus: ChecklistStatus;
  enrollmentStatus: string;
  lifecycleStatus: string;
  progressionHistory: string;
  guardianLinkStatus: ChecklistStatus;
  guardianContactStatus: ChecklistStatus;
  addressStatus: ChecklistStatus;
  admissionDateStatus: ChecklistStatus;
  aadhaarStatus: "Not collected" | "Available in school records — needs verification";
  gapTypes: string[];
  gapCount: number;
};

export type UdiseStaffGapRow = {
  staffCode: string;
  staffName: string;
  staffType: string;
  designation: string;
  status: string;
  mobileStatus: ChecklistStatus;
  emailStatus: ChecklistStatus;
  qualificationStatus: ChecklistStatus;
  demographicStatus: ChecklistStatus;
  attendanceFoundation: "Available";
  leaveFoundation: "Available";
  gapTypes: string[];
  gapCount: number;
};

export type UdiseChecklistReport = {
  warning: string;
  verificationWarning: string;
  academicYear: string;
  summary: {
    activeStudentsChecked: number;
    enrollmentsChecked: number;
    lifecycleRecordsChecked: number;
    studentsWithMissingBasics: number;
    guardianContactGaps: number;
    staffRecordsChecked: number;
    fieldsNotTrackedInErp: number;
    itemsNeedingSchoolVerification: number;
  };
  categoryCounts: Record<string, ChecklistCounts>;
  students: UdiseStudentGapRow[];
  staff: UdiseStaffGapRow[];
  school: {
    schoolName: string;
    academicYear: string;
    addressStatus: ChecklistStatus;
    phoneStatus: ChecklistStatus;
    erpSettingsStatus: ChecklistStatus;
    officialFieldsStatus: ChecklistStatus;
  };
  notTrackedFields: string[];
};

const emptyCounts = (): ChecklistCounts => ({
  Complete: 0,
  Missing: 0,
  "Not tracked in ERP": 0,
  "Needs school verification": 0,
  "Sensitive/privacy caution": 0
});

function add(counts: ChecklistCounts, status: ChecklistStatus, amount = 1) {
  counts[status] += amount;
}

function presence(value: string | null | undefined): ChecklistStatus {
  return value?.trim() ? "Complete" : "Missing";
}

function activeStatus(value: string) {
  return value.trim().toUpperCase() === "ACTIVE";
}

export function buildUdiseChecklist(input: {
  academicYear: string;
  students: UdiseStudentSource[];
  staff: UdiseStaffSource[];
  school: SchoolSettingsValue;
}): UdiseChecklistReport {
  const categoryCounts: Record<string, ChecklistCounts> = {
    "Student data": emptyCounts(),
    "Enrollment/lifecycle": emptyCounts(),
    "Guardian/contact": emptyCounts(),
    "Staff data": emptyCounts(),
    "School settings": emptyCounts(),
    "Aadhaar/privacy caution": emptyCounts()
  };

  const strength = new Map<string, { master: number; enrollment: number }>();
  const students = input.students.map((student) => {
    const dateOfBirthStatus: ChecklistStatus = student.dateOfBirth ? "Complete" : "Missing";
    const addressStatus = presence(student.address);
    const guardianLinkStatus: ChecklistStatus = student.guardians.length ? "Complete" : "Missing";
    const guardianContactStatus: ChecklistStatus = student.guardians.some((link) => link.guardian.primaryMobile.trim()) ? "Complete" : "Missing";
    const currentEnrollments = student.academicYearEnrollments.filter((row) => row.academicYear === input.academicYear);
    const activeEnrollments = currentEnrollments.filter((row) => activeStatus(row.status));
    const duplicateActive = activeEnrollments.length > 1;
    const currentEnrollment = activeEnrollments[0] ?? currentEnrollments[0];
    const enrollmentStatus = duplicateActive
      ? "Duplicate active enrollment — needs school verification"
      : currentEnrollment
        ? `${currentEnrollment.status} enrollment available`
        : "Missing current academic-year enrollment";
    const lifecycleStatus = student.lifecycleEvents.length
      ? `${student.lifecycleEvents.length} lifecycle record${student.lifecycleEvents.length === 1 ? "" : "s"} available`
      : "Missing lifecycle history";
    const progressionHistory = student.progressionDecisions.length
      ? `${student.progressionDecisions.length} progression decision${student.progressionDecisions.length === 1 ? "" : "s"} available`
      : "No progression decision history";

    for (const status of [presence(student.admissionNo), presence(student.studentName), dateOfBirthStatus, "Not tracked in ERP" as const, presence(student.className), presence(student.section), addressStatus, "Not tracked in ERP" as const]) add(categoryCounts["Student data"], status);
    add(categoryCounts["Enrollment/lifecycle"], currentEnrollment ? "Complete" : "Missing");
    add(categoryCounts["Enrollment/lifecycle"], student.lifecycleEvents.length ? "Complete" : "Missing");
    add(categoryCounts["Enrollment/lifecycle"], duplicateActive ? "Needs school verification" : "Complete");
    add(categoryCounts["Enrollment/lifecycle"], "Complete");
    add(categoryCounts["Guardian/contact"], guardianLinkStatus);
    add(categoryCounts["Guardian/contact"], guardianContactStatus);
    add(categoryCounts["Aadhaar/privacy caution"], "Sensitive/privacy caution");
    add(categoryCounts["Aadhaar/privacy caution"], student.aadhaarNo ? "Needs school verification" : "Missing");

    if (activeStatus(student.status)) {
      const masterKey = `${student.className}\u0000${student.section ?? ""}`;
      const item = strength.get(masterKey) ?? { master: 0, enrollment: 0 };
      item.master += 1;
      strength.set(masterKey, item);
    }
    if (currentEnrollment && activeStatus(currentEnrollment.status)) {
      const enrollmentKey = `${currentEnrollment.className}\u0000${currentEnrollment.section ?? ""}`;
      const item = strength.get(enrollmentKey) ?? { master: 0, enrollment: 0 };
      item.enrollment += 1;
      strength.set(enrollmentKey, item);
    }

    const gapTypes = [...new Set([
      !student.dateOfBirth && "missing-basics",
      !student.section && "missing-basics",
      !currentEnrollment && "enrollment",
      !student.lifecycleEvents.length && "lifecycle",
      !student.guardians.length && "guardian-link",
      !student.guardians.some((link) => link.guardian.primaryMobile.trim()) && "guardian-contact",
      !student.address?.trim() && "address",
      duplicateActive && "duplicate-enrollment",
      "not-tracked",
      "privacy"
    ].filter(Boolean) as string[])];

    return {
      admissionNo: student.admissionNo,
      studentName: student.studentName,
      className: student.className,
      section: student.section ?? "",
      classSection: `${student.className}${student.section ? `-${student.section}` : " (section missing)"}`,
      studentStatus: student.status,
      dateOfBirthStatus,
      genderStatus: "Not tracked in ERP",
      enrollmentStatus,
      lifecycleStatus,
      progressionHistory,
      guardianLinkStatus,
      guardianContactStatus,
      addressStatus,
      admissionDateStatus: "Not tracked in ERP",
      aadhaarStatus: student.aadhaarNo ? "Available in school records — needs verification" : "Not collected",
      gapTypes,
      gapCount: gapTypes.filter((type) => type !== "privacy").length
    } satisfies UdiseStudentGapRow;
  });

  for (const item of strength.values()) {
    if (item.master !== item.enrollment) add(categoryCounts["Enrollment/lifecycle"], "Needs school verification");
    else add(categoryCounts["Enrollment/lifecycle"], "Complete");
  }

  const staff = input.staff.map((member) => {
    const mobileStatus = presence(member.mobile);
    const emailStatus = presence(member.email);
    const qualificationStatus = presence(member.qualification);
    for (const status of [presence(member.staffCode), presence(member.fullName), presence(member.staffType), presence(member.designation), mobileStatus, emailStatus, qualificationStatus, presence(member.status), "Not tracked in ERP" as const, "Complete" as const, "Complete" as const]) add(categoryCounts["Staff data"], status);
    const gapTypes = [
      !member.staffCode?.trim() && "staff-code",
      !member.mobile?.trim() && "mobile",
      !member.email?.trim() && "email",
      !member.qualification?.trim() && "qualification",
      "not-tracked"
    ].filter(Boolean) as string[];
    return {
      staffCode: member.staffCode ?? "Missing",
      staffName: member.fullName,
      staffType: member.staffType,
      designation: member.designation,
      status: member.status,
      mobileStatus,
      emailStatus,
      qualificationStatus,
      demographicStatus: "Not tracked in ERP",
      attendanceFoundation: "Available",
      leaveFoundation: "Available",
      gapTypes,
      gapCount: gapTypes.length
    } satisfies UdiseStaffGapRow;
  });

  const schoolAddress = [input.school.addressLine1, input.school.city].filter(Boolean).join(" ");
  const school = {
    schoolName: input.school.schoolName,
    academicYear: input.school.academicYear,
    addressStatus: presence(schoolAddress),
    phoneStatus: presence(input.school.phone),
    erpSettingsStatus: "Complete" as const,
    officialFieldsStatus: "Not tracked in ERP" as const
  };
  for (const status of [presence(input.school.schoolName), presence(input.school.academicYear), school.addressStatus, school.phoneStatus, school.erpSettingsStatus, school.officialFieldsStatus]) add(categoryCounts["School settings"], status);

  const notTrackedFields = [
    "Student gender",
    "Student admission date",
    "Staff demographic reporting fields",
    "Official UDISE+ school identifiers",
    "UDISE+ portal submission fields"
  ];
  const activeStudents = input.students.filter((student) => activeStatus(student.status));
  const itemsNeedingSchoolVerification = Object.values(categoryCounts).reduce((sum, counts) => sum + counts["Needs school verification"], 0);

  return {
    warning: UDISE_PLANNING_WARNING,
    verificationWarning: UDISE_VERIFICATION_WARNING,
    academicYear: input.academicYear,
    summary: {
      activeStudentsChecked: activeStudents.length,
      enrollmentsChecked: input.students.reduce((sum, student) => sum + student.academicYearEnrollments.filter((row) => row.academicYear === input.academicYear).length, 0),
      lifecycleRecordsChecked: input.students.reduce((sum, student) => sum + student.lifecycleEvents.length, 0),
      studentsWithMissingBasics: students.filter((row) => row.gapTypes.includes("missing-basics")).length,
      guardianContactGaps: students.filter((row) => row.guardianLinkStatus === "Missing" || row.guardianContactStatus === "Missing").length,
      staffRecordsChecked: staff.length,
      fieldsNotTrackedInErp: notTrackedFields.length,
      itemsNeedingSchoolVerification
    },
    categoryCounts,
    students,
    staff,
    school,
    notTrackedFields
  };
}

type UdiseClient = Pick<PrismaClient, "student" | "staffMember" | "schoolSettings">;

export async function loadUdiseChecklist(client: UdiseClient) {
  const school = await getSchoolSettings(client);
  const [students, staff] = await Promise.all([
    client.student.findMany({
      where: { deletedAt: null },
      select: {
        admissionNo: true, studentName: true, className: true, section: true, status: true,
        dateOfBirth: true, address: true, aadhaarNo: true,
        guardians: { select: { isPrimaryContact: true, guardian: { select: { primaryMobile: true } } } },
        academicYearEnrollments: { select: { academicYear: true, className: true, section: true, status: true } },
        lifecycleEvents: { select: { eventType: true } },
        progressionDecisions: { select: { decisionType: true } }
      },
      orderBy: [{ className: "asc" }, { section: "asc" }, { studentName: "asc" }]
    }),
    client.staffMember.findMany({
      select: { staffCode: true, fullName: true, staffType: true, designation: true, mobile: true, email: true, qualification: true, status: true },
      orderBy: [{ status: "asc" }, { fullName: "asc" }]
    })
  ]);
  return buildUdiseChecklist({ academicYear: school.academicYear, students, staff, school });
}

export function filterUdiseStudents(rows: UdiseStudentGapRow[], filters: { className?: string; section?: string; status?: string; gapType?: string }) {
  return rows.filter((row) => {
    return (!filters.className || row.className === filters.className)
      && (!filters.section || row.section === filters.section)
      && (!filters.status || row.studentStatus.toUpperCase() === filters.status.toUpperCase())
      && (!filters.gapType || row.gapTypes.includes(filters.gapType));
  });
}

export function filterUdiseStaff(rows: UdiseStaffGapRow[], filters: { staffType?: string; status?: string; gapType?: string }) {
  return rows.filter((row) => (!filters.staffType || row.staffType === filters.staffType)
    && (!filters.status || row.status === filters.status)
    && (!filters.gapType || row.gapTypes.includes(filters.gapType)));
}

function safeCsvCell(value: unknown) {
  const raw = String(value ?? "");
  const protectedValue = /^[=+\-@\t\r]/.test(raw.trimStart()) ? `'${raw}` : raw;
  return `"${protectedValue.replaceAll('"', '""')}"`;
}

export function udiseChecklistCsv(report: UdiseChecklistReport) {
  const rows: unknown[][] = [
    [UDISE_PLANNING_WARNING],
    [UDISE_VERIFICATION_WARNING],
    [],
    ["Record type", "Reference", "Name", "Class / type", "Status", "Gap count", "Gap types", "Aadhaar/privacy status"],
    ...report.students.map((row) => ["Student", row.admissionNo, row.studentName, row.classSection, row.studentStatus, row.gapCount, row.gapTypes.join("; "), row.aadhaarStatus]),
    ...report.staff.map((row) => ["Staff", row.staffCode, row.staffName, row.staffType, row.status, row.gapCount, row.gapTypes.join("; "), "Not applicable"])
  ];
  return rows.map((row) => row.map(safeCsvCell).join(",")).join("\r\n");
}

export function udiseChecklistFilename(academicYear: string) {
  const safeYear = academicYear.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "school-year";
  return `udise-planning-checklist-gap-report-${safeYear}.csv`;
}
