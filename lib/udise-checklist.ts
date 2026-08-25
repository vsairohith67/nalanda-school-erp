import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { SchoolSettingsValue } from "@/lib/school-settings";
import { UDISE_EVIDENCE, UDISE_EVIDENCE_REGISTER, UDISE_REGISTER_TOTALS, type UdiseEvidenceGroup } from "@/lib/udise-evidence-register";

export const UDISE_PLANNING_WARNING = UDISE_EVIDENCE.planningBoundary;
export const UDISE_VERIFICATION_WARNING = UDISE_EVIDENCE.portalVerificationWarning;
export const UDISE_STUDENT_ROW_LIMIT = 2_000;
export const UDISE_STAFF_ROW_LIMIT = 500;
export const UDISE_GUARDIAN_RELATION_LIMIT = 8;
export const UDISE_ENROLLMENT_RELATION_LIMIT = 2;
export const UDISE_LIFECYCLE_RELATION_LIMIT = 8;
export const UDISE_PROGRESSION_RELATION_LIMIT = 8;
const UDISE_PRIOR_ACADEMIC_CYCLE = "2025-26";

export const CHECKLIST_STATUSES = [
  "ERP_VALUE_PRESENT_NOT_OFFICIALLY_VERIFIED", "TRACKED_AUTHORITATIVE", "TRACKED_DERIVED",
  "PARTIALLY_TRACKED", "TRACKED_BUT_REQUIRES_VERIFICATION", "MISSING", "NOT_TRACKED",
  "NOT_APPLICABLE_TO_SCHOOL", "SENSITIVE_CONDITIONAL", "PORTAL_ONLY_UNVERIFIED",
  "OFFICIAL_EVIDENCE_MISSING", "SOURCE_CONFLICT", "APPLICABILITY_UNCONFIRMED"
] as const;
export type ChecklistStatus = (typeof CHECKLIST_STATUSES)[number];
export type ChecklistCounts = Record<ChecklistStatus, number>;

export const CHECKLIST_STATUS_LABELS: Readonly<Record<ChecklistStatus, string>> = Object.freeze({
  ERP_VALUE_PRESENT_NOT_OFFICIALLY_VERIFIED: "ERP value present - not officially verified",
  TRACKED_AUTHORITATIVE: "Tracked from an authoritative school source",
  TRACKED_DERIVED: "Derived from finalised ERP records",
  PARTIALLY_TRACKED: "Partly tracked",
  TRACKED_BUT_REQUIRES_VERIFICATION: "Needs school verification",
  MISSING: "Missing eligible ERP value",
  NOT_TRACKED: "Not tracked in ERP",
  NOT_APPLICABLE_TO_SCHOOL: "Not applicable to this school",
  SENSITIVE_CONDITIONAL: "Sensitive - separately governed",
  PORTAL_ONLY_UNVERIFIED: "Portal verification required",
  OFFICIAL_EVIDENCE_MISSING: "Official evidence missing",
  SOURCE_CONFLICT: "Source conflict",
  APPLICABILITY_UNCONFIRMED: "Applicability not confirmed"
});

export type ParentContactSourceStatus = "DIRECT_ONLY" | "GUARDIAN_ONLY" | "BOTH_CONSISTENT" | "BOTH_CONFLICT" | "NONE";

export type UdiseStudentSource = {
  admissionNo: string;
  studentName: string;
  fatherName: string;
  motherName: string | null;
  phone1: string;
  phone2: string | null;
  whatsappNumber: string | null;
  className: string;
  section: string | null;
  status: string;
  dateOfBirth: Date | null;
  address: string | null;
  aadhaarNo: string | null;
  guardians: Array<{ isPrimaryContact: boolean; guardian: { displayName: string; primaryMobile: string; alternateMobile: string | null } }>;
  academicYearEnrollments: Array<{ academicYear: string; className: string; section: string | null; status: string; enrollmentDate: Date | null }>;
  lifecycleEvents: Array<{ academicYear: string | null; eventType: string }>;
  progressionDecisions: Array<{ academicYear: string; decisionType: string; status: string; toAcademicYear: string | null }>;
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
  rowReference: string;
  maskedAdmissionReference: string;
  className: string;
  section: string;
  classSection: string;
  studentStatus: string;
  dateOfBirthStatus: ChecklistStatus;
  genderStatus: ChecklistStatus;
  enrollmentEvidenceStatus: ChecklistStatus;
  enrollmentExplanation: string;
  lifecycleStatus: ChecklistStatus;
  lifecycleExplanation: string;
  progressionStatus: ChecklistStatus;
  progressionExplanation: string;
  parentSourceStatus: ParentContactSourceStatus;
  contactSourceStatus: ParentContactSourceStatus;
  addressStatus: ChecklistStatus;
  addressExplanation: string;
  admissionDateStatus: ChecklistStatus;
  admissionDateExplanation: string;
  aadhaarStatus: "SENSITIVE_CONDITIONAL";
  aadhaarExplanation: string;
  gapTypes: string[];
  gapCount: number;
};

export type UdiseStaffGapRow = {
  rowReference: string;
  maskedStaffReference: string;
  staffType: string;
  recordStatus: string;
  mobileStatus: ChecklistStatus;
  emailStatus: ChecklistStatus;
  qualificationStatus: ChecklistStatus;
  demographicStatus: ChecklistStatus;
  attendanceFoundation: "INTERNAL_ERP_FOUNDATION_NOT_OFFICIAL_UDISE_EVIDENCE";
  leaveFoundation: "INTERNAL_ERP_FOUNDATION_NOT_OFFICIAL_UDISE_EVIDENCE";
  gapTypes: string[];
  gapCount: number;
};

export type UdiseChecklistReport = {
  warning: string;
  verificationWarning: string;
  evidence: typeof UDISE_EVIDENCE;
  academicYear: string;
  schoolAcademicYear: string;
  cycleStatus: "CURRENT_CYCLE_MATCH" | "SOURCE_CONFLICT" | "OFFICIAL_EVIDENCE_MISSING";
  limits: {
    studentRowsMatched: number; studentRowsLoaded: number; studentRowsTruncated: boolean;
    staffRowsMatched: number; staffRowsLoaded: number; staffRowsTruncated: boolean;
  };
  summary: {
    activeStudentsChecked: number;
    enrollmentsChecked: number;
    lifecycleRecordsChecked: number;
    studentsWithMissingBasics: number;
    guardianContactGaps: number;
    staffRecordsChecked: number;
    evidenceGroupsNotTrackedInErp: number;
    itemsNeedingSchoolVerification: number;
  };
  indicators: {
    erpDataPresence: { presentCandidates: number; partiallyTrackedCandidates: number; missingOrNotTrackedCandidates: number };
    schoolVerification: { verifiedValues: 0; status: "NOT_IMPLEMENTED_IN_1C" };
    officialEvidenceCoverage: { attributedGroups: number; totalGroups: number; supportingManualsAndCodeLists: "PARTIAL" };
    applicabilityResolution: { resolvedGroups: number; unresolvedGroups: number };
    portalVerification: { verifiedByAuthorisedHuman: 0; pendingGroups: number };
  };
  categoryCounts: Record<string, ChecklistCounts>;
  students: UdiseStudentGapRow[];
  staff: UdiseStaffGapRow[];
  school: {
    schoolNameStatus: ChecklistStatus;
    academicYearStatus: ChecklistStatus;
    addressStatus: ChecklistStatus;
    phoneStatus: ChecklistStatus;
    officialFieldsStatus: ChecklistStatus;
  };
  sourceRegister: readonly UdiseEvidenceGroup[];
};

const emptyCounts = (): ChecklistCounts => Object.fromEntries(CHECKLIST_STATUSES.map((status) => [status, 0])) as ChecklistCounts;

function add(counts: ChecklistCounts, status: ChecklistStatus, amount = 1) {
  counts[status] += amount;
}

function presence(value: string | null | undefined): ChecklistStatus {
  return value?.trim() ? "ERP_VALUE_PRESENT_NOT_OFFICIALLY_VERIFIED" : "MISSING";
}

function activeStatus(value: string) {
  return value.trim().toUpperCase() === "ACTIVE";
}

function normalizedTextSet(values: Array<string | null | undefined>) {
  return new Set(values.map((value) => value?.trim().toLocaleLowerCase().replace(/\s+/g, " ") ?? "").filter(Boolean));
}

function normalizedPhoneSet(values: Array<string | null | undefined>) {
  return new Set(values.map((value) => value?.replace(/\D/g, "") ?? "").filter(Boolean));
}

function setsOverlap(left: Set<string>, right: Set<string>) {
  return [...left].some((value) => right.has(value));
}

function sourceStatus(direct: Set<string>, guardian: Set<string>): ParentContactSourceStatus {
  if (!direct.size && !guardian.size) return "NONE";
  if (direct.size && !guardian.size) return "DIRECT_ONLY";
  if (!direct.size && guardian.size) return "GUARDIAN_ONLY";
  return setsOverlap(direct, guardian) ? "BOTH_CONSISTENT" : "BOTH_CONFLICT";
}

function sourceChecklistStatus(status: ParentContactSourceStatus): ChecklistStatus {
  if (status === "NONE") return "MISSING";
  if (status === "BOTH_CONFLICT") return "TRACKED_BUT_REQUIRES_VERIFICATION";
  return "ERP_VALUE_PRESENT_NOT_OFFICIALLY_VERIFIED";
}

function opaqueRowReference(kind: "STUDENT" | "STAFF") {
  return `${kind === "STUDENT" ? "STU" : "STF"}-${randomBytes(8).toString("hex").toUpperCase()}`;
}

export function maskUdiseReference(value: string | null | undefined, prefix: "ADM" | "STAFF") {
  const clean = value?.trim().replace(/[^a-zA-Z0-9]/g, "") ?? "";
  if (!clean) return `${prefix}-UNSET`;
  return `${prefix}-••••${clean.slice(-2).toUpperCase().padStart(2, "•")}`;
}

function studentLifecycleState(student: UdiseStudentSource, currentCycle: string) {
  const currentEvents = student.lifecycleEvents.filter((event) => event.academicYear === currentCycle);
  const currentEnrollment = student.academicYearEnrollments.some((enrollment) => enrollment.academicYear === currentCycle);
  const priorEnrollment = student.academicYearEnrollments.some((enrollment) => enrollment.academicYear !== currentCycle);
  if (currentEvents.length) return { status: "ERP_VALUE_PRESENT_NOT_OFFICIALLY_VERIFIED" as const, explanation: `${currentEvents.length} cycle-relevant lifecycle record(s) present; official equivalence is unverified.` };
  if (!activeStatus(student.status)) return { status: "MISSING" as const, explanation: "The Student is not active and no cycle-relevant lifecycle evidence is present." };
  if (currentEnrollment && !priorEnrollment) return { status: "NOT_APPLICABLE_TO_SCHOOL" as const, explanation: "Current-cycle active enrollment has no prior-cycle enrollment candidate; treat as a possible new admission, not a lifecycle defect." };
  return { status: "APPLICABILITY_UNCONFIRMED" as const, explanation: "No governed cycle-close rule establishes that lifecycle evidence is due." };
}

function studentProgressionState(student: UdiseStudentSource, currentCycle: string) {
  const finalised = student.progressionDecisions.filter((decision) => decision.status.toUpperCase() === "FINALIZED"
    && (decision.academicYear === currentCycle || decision.toAcademicYear === currentCycle));
  if (finalised.length) return { status: "TRACKED_BUT_REQUIRES_VERIFICATION" as const, explanation: `${finalised.length} finalised progression decision(s) present; DCF cycle semantics still require verification.` };
  const hasPriorEnrollment = student.academicYearEnrollments.some((enrollment) => enrollment.academicYear !== currentCycle);
  if (!hasPriorEnrollment) return { status: "NOT_APPLICABLE_TO_SCHOOL" as const, explanation: "No prior-cycle enrollment candidate makes progression inapplicable until school evidence says otherwise." };
  return { status: "APPLICABILITY_UNCONFIRMED" as const, explanation: "A prior enrollment exists, but no evidenced progression window makes a missing decision an unconditional gap." };
}

export function buildUdiseChecklist(input: {
  academicYear?: string;
  students: UdiseStudentSource[];
  staff: UdiseStaffSource[];
  school: SchoolSettingsValue | null;
  matchedRows?: { students: number; staff: number };
}): UdiseChecklistReport {
  const currentCycle = UDISE_EVIDENCE.academicCycle;
  const categoryCounts: Record<string, ChecklistCounts> = {
    "Student data": emptyCounts(), "Enrollment/lifecycle": emptyCounts(), "Parent/contact": emptyCounts(),
    "Staff data": emptyCounts(), "School candidates": emptyCounts(), "Aadhaar/privacy boundary": emptyCounts()
  };

  const strength = new Map<string, { master: number; enrollment: number }>();
  const students = input.students.map((student) => {
    const dateOfBirthStatus: ChecklistStatus = student.dateOfBirth ? "ERP_VALUE_PRESENT_NOT_OFFICIALLY_VERIFIED" : "MISSING";
    const addressStatus: ChecklistStatus = student.address?.trim() ? "PARTIALLY_TRACKED" : "NOT_TRACKED";
    const parentSourceStatus = sourceStatus(normalizedTextSet([student.fatherName, student.motherName]), normalizedTextSet(student.guardians.map((link) => link.guardian.displayName)));
    const contactSourceStatus = sourceStatus(normalizedPhoneSet([student.phone1, student.phone2, student.whatsappNumber]), normalizedPhoneSet(student.guardians.flatMap((link) => [link.guardian.primaryMobile, link.guardian.alternateMobile])));
    const currentEnrollments = student.academicYearEnrollments.filter((row) => row.academicYear === currentCycle);
    const activeEnrollments = currentEnrollments.filter((row) => activeStatus(row.status));
    const duplicateActive = activeEnrollments.length > 1;
    const currentEnrollment = activeEnrollments[0] ?? currentEnrollments[0];
    const enrollmentEvidenceStatus: ChecklistStatus = duplicateActive ? "TRACKED_BUT_REQUIRES_VERIFICATION" : currentEnrollment ? "ERP_VALUE_PRESENT_NOT_OFFICIALLY_VERIFIED" : "MISSING";
    const enrollmentExplanation = duplicateActive ? "Duplicate active current-cycle enrollment candidates require school review." : currentEnrollment ? `${currentEnrollment.status} current-cycle enrollment candidate present.` : "No enrollment candidate exists for the pinned 2026-27 evidence cycle.";
    const admissionDateStatus: ChecklistStatus = currentEnrollment?.enrollmentDate ? "PARTIALLY_TRACKED" : "NOT_TRACKED";
    const lifecycle = studentLifecycleState(student, currentCycle);
    const progression = studentProgressionState(student, currentCycle);

    for (const status of [presence(student.admissionNo), presence(student.studentName), dateOfBirthStatus, "NOT_TRACKED" as const, presence(student.className), presence(student.section), addressStatus, admissionDateStatus]) add(categoryCounts["Student data"], status);
    for (const status of [enrollmentEvidenceStatus, lifecycle.status, progression.status, duplicateActive ? "TRACKED_BUT_REQUIRES_VERIFICATION" as const : "ERP_VALUE_PRESENT_NOT_OFFICIALLY_VERIFIED" as const]) add(categoryCounts["Enrollment/lifecycle"], status);
    add(categoryCounts["Parent/contact"], sourceChecklistStatus(parentSourceStatus));
    add(categoryCounts["Parent/contact"], sourceChecklistStatus(contactSourceStatus));
    add(categoryCounts["Aadhaar/privacy boundary"], "SENSITIVE_CONDITIONAL");

    if (activeStatus(student.status)) {
      const key = `${student.className}\u0000${student.section ?? ""}`;
      const item = strength.get(key) ?? { master: 0, enrollment: 0 };
      item.master += 1;
      strength.set(key, item);
    }
    if (currentEnrollment && activeStatus(currentEnrollment.status)) {
      const key = `${currentEnrollment.className}\u0000${currentEnrollment.section ?? ""}`;
      const item = strength.get(key) ?? { master: 0, enrollment: 0 };
      item.enrollment += 1;
      strength.set(key, item);
    }

    const gapTypes = [...new Set([
      (!student.dateOfBirth || !student.section) && "missing-basics", !currentEnrollment && "enrollment",
      lifecycle.status === "MISSING" && "lifecycle",
      (lifecycle.status === "APPLICABILITY_UNCONFIRMED" || progression.status === "APPLICABILITY_UNCONFIRMED") && "applicability",
      parentSourceStatus === "NONE" && "parent-source", contactSourceStatus === "NONE" && "contact-source",
      (parentSourceStatus === "BOTH_CONFLICT" || contactSourceStatus === "BOTH_CONFLICT") && "source-conflict",
      "address", admissionDateStatus === "NOT_TRACKED" && "admission-date", duplicateActive && "duplicate-enrollment", "privacy"
    ].filter(Boolean) as string[])];

    return {
      rowReference: opaqueRowReference("STUDENT"),
      maskedAdmissionReference: maskUdiseReference(student.admissionNo, "ADM"),
      className: student.className, section: student.section ?? "",
      classSection: `${student.className}${student.section ? `-${student.section}` : " (section missing)"}`,
      studentStatus: student.status, dateOfBirthStatus, genderStatus: "NOT_TRACKED", enrollmentEvidenceStatus, enrollmentExplanation,
      lifecycleStatus: lifecycle.status, lifecycleExplanation: lifecycle.explanation,
      progressionStatus: progression.status, progressionExplanation: progression.explanation,
      parentSourceStatus, contactSourceStatus, addressStatus,
      addressExplanation: student.address?.trim() ? "Free-text address candidate exists; structured PIN and geography are not tracked." : "No address candidate exists; structured PIN and geography are not tracked.",
      admissionDateStatus,
      admissionDateExplanation: currentEnrollment?.enrollmentDate ? "AcademicYearEnrollment.enrollmentDate candidate exists; semantic equivalence is not proven." : "No current-cycle AcademicYearEnrollment.enrollmentDate candidate; createdAt is never substituted.",
      aadhaarStatus: "SENSITIVE_CONDITIONAL",
      aadhaarExplanation: student.aadhaarNo?.trim() ? "ERP contains an unverified optional sensitive value; it is not displayed, validated or counted as completeness." : "Sensitive optional value is not held in this ERP record; no placeholder is created.",
      gapTypes, gapCount: gapTypes.filter((type) => type !== "privacy").length
    } satisfies UdiseStudentGapRow;
  });

  for (const item of strength.values()) add(categoryCounts["Enrollment/lifecycle"], item.master === item.enrollment ? "ERP_VALUE_PRESENT_NOT_OFFICIALLY_VERIFIED" : "TRACKED_BUT_REQUIRES_VERIFICATION");

  const staff = input.staff.map((member) => {
    const mobileStatus = presence(member.mobile);
    const emailStatus = presence(member.email);
    const qualificationStatus = member.qualification?.trim() ? "PARTIALLY_TRACKED" as const : "MISSING" as const;
    for (const status of [presence(member.staffCode), presence(member.fullName), presence(member.staffType), presence(member.designation), mobileStatus, emailStatus, qualificationStatus, presence(member.status), "NOT_TRACKED" as const]) add(categoryCounts["Staff data"], status);
    const gapTypes = [!member.staffCode?.trim() && "staff-code", !member.mobile?.trim() && "mobile", !member.email?.trim() && "email", !member.qualification?.trim() && "qualification", "not-tracked"].filter(Boolean) as string[];
    return {
      rowReference: opaqueRowReference("STAFF"), maskedStaffReference: maskUdiseReference(member.staffCode, "STAFF"),
      staffType: member.staffType, recordStatus: member.status, mobileStatus, emailStatus, qualificationStatus,
      demographicStatus: "SENSITIVE_CONDITIONAL", attendanceFoundation: "INTERNAL_ERP_FOUNDATION_NOT_OFFICIAL_UDISE_EVIDENCE",
      leaveFoundation: "INTERNAL_ERP_FOUNDATION_NOT_OFFICIAL_UDISE_EVIDENCE", gapTypes, gapCount: gapTypes.length
    } satisfies UdiseStaffGapRow;
  });

  const schoolAddress = [input.school?.addressLine1, input.school?.city].filter(Boolean).join(" ");
  const cycleStatus = !input.school ? "OFFICIAL_EVIDENCE_MISSING" as const
    : input.school.academicYear === currentCycle ? "CURRENT_CYCLE_MATCH" as const : "SOURCE_CONFLICT" as const;
  const school = input.school ? {
    schoolNameStatus: presence(input.school.schoolName),
    academicYearStatus: cycleStatus === "CURRENT_CYCLE_MATCH" ? "ERP_VALUE_PRESENT_NOT_OFFICIALLY_VERIFIED" as const : "SOURCE_CONFLICT" as const,
    addressStatus: schoolAddress.trim() ? "PARTIALLY_TRACKED" as const : "NOT_TRACKED" as const,
    phoneStatus: presence(input.school.phone), officialFieldsStatus: "NOT_TRACKED" as const
  } : {
    schoolNameStatus: "OFFICIAL_EVIDENCE_MISSING" as const,
    academicYearStatus: "OFFICIAL_EVIDENCE_MISSING" as const,
    addressStatus: "OFFICIAL_EVIDENCE_MISSING" as const,
    phoneStatus: "OFFICIAL_EVIDENCE_MISSING" as const,
    officialFieldsStatus: "OFFICIAL_EVIDENCE_MISSING" as const
  };
  for (const status of Object.values(school)) add(categoryCounts["School candidates"], status);

  const activeStudents = input.students.filter((student) => activeStatus(student.status));
  const itemsNeedingSchoolVerification = Object.values(categoryCounts).reduce((sum, counts) => sum + counts.TRACKED_BUT_REQUIRES_VERIFICATION + counts.SOURCE_CONFLICT + counts.APPLICABILITY_UNCONFIRMED, 0);
  const unresolvedApplicability = UDISE_EVIDENCE_REGISTER.filter((group) => group.applicability !== "APPLICABLE_CONFIRMED").length;
  const presenceCounts = Object.values(categoryCounts).reduce((totals, counts) => ({
    presentCandidates: totals.presentCandidates + counts.ERP_VALUE_PRESENT_NOT_OFFICIALLY_VERIFIED + counts.TRACKED_AUTHORITATIVE + counts.TRACKED_DERIVED,
    partiallyTrackedCandidates: totals.partiallyTrackedCandidates + counts.PARTIALLY_TRACKED + counts.TRACKED_BUT_REQUIRES_VERIFICATION,
    missingOrNotTrackedCandidates: totals.missingOrNotTrackedCandidates + counts.MISSING + counts.NOT_TRACKED
  }), { presentCandidates: 0, partiallyTrackedCandidates: 0, missingOrNotTrackedCandidates: 0 });

  return {
    warning: UDISE_PLANNING_WARNING, verificationWarning: UDISE_VERIFICATION_WARNING, evidence: UDISE_EVIDENCE,
    academicYear: currentCycle, schoolAcademicYear: input.school?.academicYear ?? "SOURCE_NOT_CONFIGURED", cycleStatus,
    limits: {
      studentRowsMatched: input.matchedRows?.students ?? input.students.length,
      studentRowsLoaded: input.students.length,
      studentRowsTruncated: (input.matchedRows?.students ?? input.students.length) > input.students.length,
      staffRowsMatched: input.matchedRows?.staff ?? input.staff.length,
      staffRowsLoaded: input.staff.length,
      staffRowsTruncated: (input.matchedRows?.staff ?? input.staff.length) > input.staff.length
    },
    summary: {
      activeStudentsChecked: activeStudents.length,
      enrollmentsChecked: input.students.reduce((sum, student) => sum + student.academicYearEnrollments.filter((row) => row.academicYear === currentCycle).length, 0),
      lifecycleRecordsChecked: input.students.reduce((sum, student) => sum + student.lifecycleEvents.filter((event) => event.academicYear === currentCycle).length, 0),
      studentsWithMissingBasics: students.filter((row) => row.gapTypes.includes("missing-basics")).length,
      guardianContactGaps: students.filter((row) => row.parentSourceStatus === "NONE" || row.contactSourceStatus === "NONE" || row.parentSourceStatus === "BOTH_CONFLICT" || row.contactSourceStatus === "BOTH_CONFLICT").length,
      staffRecordsChecked: staff.length, evidenceGroupsNotTrackedInErp: UDISE_REGISTER_TOTALS.notTracked, itemsNeedingSchoolVerification
    },
    indicators: {
      erpDataPresence: presenceCounts,
      schoolVerification: { verifiedValues: 0, status: "NOT_IMPLEMENTED_IN_1C" },
      officialEvidenceCoverage: { attributedGroups: UDISE_REGISTER_TOTALS.total, totalGroups: UDISE_REGISTER_TOTALS.total, supportingManualsAndCodeLists: "PARTIAL" },
      applicabilityResolution: { resolvedGroups: UDISE_REGISTER_TOTALS.total - unresolvedApplicability, unresolvedGroups: unresolvedApplicability },
      portalVerification: { verifiedByAuthorisedHuman: 0, pendingGroups: UDISE_REGISTER_TOTALS.portalOnlyOrUnverified }
    },
    categoryCounts, students, staff, school, sourceRegister: UDISE_EVIDENCE_REGISTER
  };
}

type UdiseClient = Pick<PrismaClient, "student" | "staffMember" | "schoolSettings">;

export type UdiseLoadFilters = {
  includeStudents?: boolean;
  includeStaff?: boolean;
  student?: { className?: string; section?: string; status?: string };
  staff?: { staffType?: string; status?: string };
};

export async function loadUdiseChecklist(client: UdiseClient, filters: UdiseLoadFilters = {}) {
  const includeStudents = filters.includeStudents !== false;
  const includeStaff = filters.includeStaff !== false;
  const studentWhere = {
    deletedAt: null,
    ...(filters.student?.className ? { className: filters.student.className } : {}),
    ...(filters.student?.section ? { section: filters.student.section } : {}),
    ...(filters.student?.status ? { status: filters.student.status } : {})
  };
  const staffWhere = {
    ...(filters.staff?.staffType ? { staffType: filters.staff.staffType } : {}),
    ...(filters.staff?.status ? { status: filters.staff.status } : {})
  };
  const studentsMatchedPromise = includeStudents ? client.student.count({ where: studentWhere }) : Promise.resolve(0);
  const staffMatchedPromise = includeStaff ? client.staffMember.count({ where: staffWhere }) : Promise.resolve(0);
  const studentsPromise: Promise<UdiseStudentSource[]> = includeStudents ? client.student.findMany({
    where: studentWhere,
    take: UDISE_STUDENT_ROW_LIMIT,
    select: {
      admissionNo: true, studentName: true, fatherName: true, motherName: true, phone1: true, phone2: true, whatsappNumber: true,
      className: true, section: true, status: true, dateOfBirth: true, address: true, aadhaarNo: true,
      guardians: {
        take: UDISE_GUARDIAN_RELATION_LIMIT,
        orderBy: [{ isPrimaryContact: "desc" }, { id: "asc" }],
        select: { isPrimaryContact: true, guardian: { select: { displayName: true, primaryMobile: true, alternateMobile: true } } }
      },
      academicYearEnrollments: {
        where: { academicYear: { in: [UDISE_EVIDENCE.academicCycle, UDISE_PRIOR_ACADEMIC_CYCLE] } },
        take: UDISE_ENROLLMENT_RELATION_LIMIT,
        orderBy: [{ academicYear: "desc" }, { id: "asc" }],
        select: { academicYear: true, className: true, section: true, status: true, enrollmentDate: true }
      },
      lifecycleEvents: {
        where: { academicYear: UDISE_EVIDENCE.academicCycle },
        take: UDISE_LIFECYCLE_RELATION_LIMIT,
        orderBy: [{ effectiveDate: "desc" }, { id: "asc" }],
        select: { academicYear: true, eventType: true }
      },
      progressionDecisions: {
        where: { OR: [{ academicYear: UDISE_EVIDENCE.academicCycle }, { toAcademicYear: UDISE_EVIDENCE.academicCycle }] },
        take: UDISE_PROGRESSION_RELATION_LIMIT,
        orderBy: [{ effectiveDate: "desc" }, { id: "asc" }],
        select: { academicYear: true, decisionType: true, status: true, toAcademicYear: true }
      }
    },
    orderBy: [{ className: "asc" }, { section: "asc" }, { studentName: "asc" }]
  }) : Promise.resolve([]);
  const staffPromise: Promise<UdiseStaffSource[]> = includeStaff ? client.staffMember.findMany({
    where: staffWhere,
    take: UDISE_STAFF_ROW_LIMIT,
    select: { staffCode: true, fullName: true, staffType: true, designation: true, mobile: true, email: true, qualification: true, status: true },
    orderBy: [{ status: "asc" }, { fullName: "asc" }]
  }) : Promise.resolve([]);
  const [school, studentsMatched, staffMatched, students, staff] = await Promise.all([
    client.schoolSettings.findUnique({ where: { id: "school" } }),
    studentsMatchedPromise,
    staffMatchedPromise,
    studentsPromise,
    staffPromise
  ]);
  return buildUdiseChecklist({ students, staff, school, matchedRows: { students: studentsMatched, staff: staffMatched } });
}

export function filterUdiseStudents(rows: UdiseStudentGapRow[], filters: { className?: string; section?: string; status?: string; gapType?: string }) {
  return rows.filter((row) => (!filters.className || row.className === filters.className) && (!filters.section || row.section === filters.section)
    && (!filters.status || row.studentStatus.toUpperCase() === filters.status.toUpperCase()) && (!filters.gapType || row.gapTypes.includes(filters.gapType)));
}

export function filterUdiseStaff(rows: UdiseStaffGapRow[], filters: { staffType?: string; status?: string; gapType?: string }) {
  return rows.filter((row) => (!filters.staffType || row.staffType === filters.staffType) && (!filters.status || row.recordStatus === filters.status)
    && (!filters.gapType || row.gapTypes.includes(filters.gapType)));
}

function safeCsvCell(value: unknown) {
  const raw = String(value ?? "");
  const protectedValue = /^[=+\-@\t\r]/.test(raw.trimStart()) ? `'${raw}` : raw;
  return `"${protectedValue.replaceAll('"', '""')}"`;
}

function csvEvidenceMetadataRows() {
  return [[UDISE_PLANNING_WARNING], [UDISE_VERIFICATION_WARNING], ["Evidence status", UDISE_EVIDENCE.evidenceStatus], ["Evidence cycle", UDISE_EVIDENCE.academicCycle],
    ["Evidence source", UDISE_EVIDENCE.title], ["Public filename", UDISE_EVIDENCE.publicFilename], ["Internal version", UDISE_EVIDENCE.internalVersion],
    ["Document date", UDISE_EVIDENCE.documentDate], ["Reviewed date", UDISE_EVIDENCE.reviewedDate]];
}

function csvMetadataRows(report: UdiseChecklistReport, generatedAt: Date) {
  return [...csvEvidenceMetadataRows(),
    ["Student rows", `${report.limits.studentRowsLoaded} loaded of ${report.limits.studentRowsMatched} matched${report.limits.studentRowsTruncated ? " - truncated" : ""}`],
    ["Staff rows", `${report.limits.staffRowsLoaded} loaded of ${report.limits.staffRowsMatched} matched${report.limits.staffRowsTruncated ? " - truncated" : ""}`],
    ["Generated at", generatedAt.toISOString()], []];
}

export function udiseChecklistCsv(report: UdiseChecklistReport, generatedAt = new Date()) {
  const rows: unknown[][] = [
    ...csvMetadataRows(report, generatedAt),
    ["Record type", "Opaque row reference", "Masked source reference", "Class / safe type", "Record status", "Gap count", "Gap types", "Sensitive-value status"],
    ...report.students.slice(0, UDISE_STUDENT_ROW_LIMIT).map((row) => ["Student", row.rowReference, row.maskedAdmissionReference, row.classSection, row.studentStatus, row.gapCount, row.gapTypes.join("; "), row.aadhaarStatus]),
    ...report.staff.slice(0, UDISE_STAFF_ROW_LIMIT).map((row) => ["Staff", row.rowReference, row.maskedStaffReference, row.staffType, row.recordStatus, row.gapCount, row.gapTypes.join("; "), row.demographicStatus])
  ];
  return rows.map((row) => row.map(safeCsvCell).join(",")).join("\r\n");
}

export function udiseSourceRegisterCsv(generatedAt = new Date()) {
  const rows: unknown[][] = [
    ...csvEvidenceMetadataRows(), ["Generated at", generatedAt.toISOString()], [],
    ["Evidence ID", "Group ID", "Domain", "Label", "Primary status", "Official source", "Source scope", "ERP mapping", "Applicability", "Sensitivity", "Recommendation"],
    ...UDISE_EVIDENCE_REGISTER.map((group) => [group.evidenceId, group.id, group.domain, group.label, group.primaryStatus, group.sourceReference, group.sourceScope, group.currentErpMapping, group.applicability, group.sensitivity, group.recommendation])
  ];
  return rows.map((row) => row.map(safeCsvCell).join(",")).join("\r\n");
}

export function udiseChecklistFilename(kind: "masked-rows" | "source-register" = "masked-rows") {
  return kind === "source-register" ? `udise-planning-source-register-${UDISE_EVIDENCE.academicCycle}.csv` : `udise-planning-masked-gap-report-${UDISE_EVIDENCE.academicCycle}.csv`;
}
