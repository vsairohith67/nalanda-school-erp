export const UDISE_EVIDENCE_STATUS = "UDISE_15E_EVIDENCE_PARTIAL" as const;

export const UDISE_EVIDENCE = Object.freeze({
  sourceId: "N1",
  title: "UDISE+ Data Capture Format for Academic Year 2026-27",
  academicCycle: "2026-27",
  publicFilename: "UDISE_DCF_Final_26_27_v3.pdf",
  internalVersion: "5.0",
  documentDate: "2026-07-15",
  reviewedDate: "2026-08-25",
  scope: "National field schedule; Telangana evidence partial",
  evidenceStatus: UDISE_EVIDENCE_STATUS,
  versionConflict: "Public filename says v3; the document internally identifies itself as v5.0 dated 15 July 2026.",
  portalVerificationWarning: "Current public module manuals, Telangana workflow, code lists, correction screens and certification rules are not fully evidenced. Verify manually in the latest authorised portal.",
  planningBoundary: "Planning checklist only - not official UDISE+ submission, certification or compliance evidence."
});

export const UDISE_GROUP_STATUSES = [
  "TRACKED_AUTHORITATIVE",
  "TRACKED_DERIVED",
  "TRACKED_BUT_REQUIRES_VERIFICATION",
  "PARTIALLY_TRACKED",
  "NOT_TRACKED",
  "SENSITIVE_CONDITIONAL",
  "PORTAL_ONLY_UNVERIFIED"
] as const;
export type UdiseGroupStatus = (typeof UDISE_GROUP_STATUSES)[number];

export type UdiseEvidenceDomain = "SCHOOL" | "FACILITY" | "STUDENT" | "STAFF" | "BLOCK";
export type UdiseApplicability = "APPLICABLE_CONFIRMED" | "APPLICABILITY_UNCONFIRMED" | "PORTAL_CONTROLLED" | "STATE_EVIDENCE_REQUIRED";
export type UdiseSensitivity = "NON_SENSITIVE_CHECKLIST" | "SENSITIVE_OR_CONDITIONAL" | "PORTAL_OR_POLICY_BOUNDARY";

type GroupDefinition = readonly [id: string, label: string, status: UdiseGroupStatus];

const DEFINITIONS: readonly GroupDefinition[] = [
  ["S01", "School identity and geography labels", "PARTIALLY_TRACKED"],
  ["S02", "UDISE code and official school identifiers", "NOT_TRACKED"],
  ["S03", "Address, PIN, latitude and longitude", "PARTIALLY_TRACKED"],
  ["S04", "School phone, mobile, email and website", "PARTIALLY_TRACKED"],
  ["S05", "Head or in-charge identity and contacts", "NOT_TRACKED"],
  ["S06", "Management, sub-management, formal/special, PM-SHRI", "PORTAL_ONLY_UNVERIFIED"],
  ["S07", "School category, operational classes, streams and gender type", "PARTIALLY_TRACKED"],
  ["S08", "Board and affiliation numbers", "NOT_TRACKED"],
  ["S09", "Session dates, establishment, recognition and upgrades", "NOT_TRACKED"],
  ["S10", "Mediums, subjects and curriculum", "PARTIALLY_TRACKED"],
  ["S11", "Minority-management, RTE 25 percent and vocational admin flags", "SENSITIVE_CONDITIONAL"],
  ["S12", "Residential, shift, mother tongue, distance and access road", "NOT_TRACKED"],
  ["S13", "Instructional days, CCE, records, inspection and committees", "PARTIALLY_TRACKED"],
  ["S14", "Government or aided-only entitlements and governance items", "PORTAL_ONLY_UNVERIFIED"],
  ["S15", "Safety, disaster, fire, CCTV and counselling indicators", "NOT_TRACKED"],
  ["S16", "Attendance capture modes, clubs, teacher IDs and SSSA", "PARTIALLY_TRACKED"],
  ["S17", "Receipts, expenditure and inventory registers", "PARTIALLY_TRACKED"],
  ["S18", "School-level NSQF and vocational outcomes", "SENSITIVE_CONDITIONAL"],
  ["F01", "Building ownership, status and construction profile", "NOT_TRACKED"],
  ["F02", "Classroom counts, use and condition", "NOT_TRACKED"],
  ["F03", "Boundary, electricity, fans, climate and solar", "NOT_TRACKED"],
  ["F04", "Rooms, library, common rooms and laboratories", "NOT_TRACKED"],
  ["F05", "Toilets, urinals, water, handwash and menstrual facilities", "NOT_TRACKED"],
  ["F06", "Drinking-water source, treatment, testing and harvesting", "NOT_TRACKED"],
  ["F07", "Library, book-bank, reading and circulation measures", "PARTIALLY_TRACKED"],
  ["F08", "Land, playground, sports equipment and coach", "NOT_TRACKED"],
  ["F09", "Health checks, deworming, IFA, first aid and medicines", "SENSITIVE_CONDITIONAL"],
  ["F10", "Ramps, handrails, special educator, garden, bins and furniture", "NOT_TRACKED"],
  ["F11", "Hostel and residential facilities", "SENSITIVE_CONDITIONAL"],
  ["F12", "Lab availability, rooms, condition and equipment", "NOT_TRACKED"],
  ["F13", "ICT devices, ICT labs, internet, e-content and assistive tech", "NOT_TRACKED"],
  ["F14", "Free student transport facility", "PARTIALLY_TRACKED"],
  ["F15", "Kitchen shed and meal-related facilities", "PORTAL_ONLY_UNVERIFIED"],
  ["ST01", "Academic year, school code, class and section", "PARTIALLY_TRACKED"],
  ["ST02", "Student National Code (PEN)", "NOT_TRACKED"],
  ["ST03", "Roll number (optional)", "TRACKED_AUTHORITATIVE"],
  ["ST04", "Student name", "TRACKED_AUTHORITATIVE"],
  ["ST05", "Gender", "NOT_TRACKED"],
  ["ST06", "Date of birth", "TRACKED_AUTHORITATIVE"],
  ["ST07", "Mother, father and guardian names", "PARTIALLY_TRACKED"],
  ["ST08", "Aadhaar and name as Aadhaar", "SENSITIVE_CONDITIONAL"],
  ["ST09", "Student address and PIN", "PARTIALLY_TRACKED"],
  ["ST10", "Mobile, alternate mobile and email", "PARTIALLY_TRACKED"],
  ["ST11", "Mother tongue and language group", "NOT_TRACKED"],
  ["ST12", "Social category, minority, BPL/AAY and EWS", "SENSITIVE_CONDITIONAL"],
  ["ST13", "CWSN, impairment, certificate and disability percentage", "SENSITIVE_CONDITIONAL"],
  ["ST14", "Nationality and blood group", "SENSITIVE_CONDITIONAL"],
  ["ST15", "Out-of-school and mainstreaming history", "SENSITIVE_CONDITIONAL"],
  ["ST16", "Admission number and admission date", "PARTIALLY_TRACKED"],
  ["ST17", "Medium, subjects and stream", "PARTIALLY_TRACKED"],
  ["ST18", "Previous-school status and previous class", "PARTIALLY_TRACKED"],
  ["ST19", "RTE 12C admission and reimbursement amount", "SENSITIVE_CONDITIONAL"],
  ["ST20", "Previous-year result and marks", "TRACKED_DERIVED"],
  ["ST21", "Previous-year attendance", "TRACKED_DERIVED"],
  ["ST22", "Government or aided-only student facilities", "PORTAL_ONLY_UNVERIFIED"],
  ["ST23", "CWSN aids, competitions, NCC, NSS and Scouts", "SENSITIVE_CONDITIONAL"],
  ["ST24", "Height, weight, home distance and parent education", "SENSITIVE_CONDITIONAL"],
  ["ST25", "Student vocational education details", "SENSITIVE_CONDITIONAL"],
  ["ST26", "Progression, result, marks and attendance handoff", "TRACKED_BUT_REQUIRES_VERIFICATION"],
  ["ST27", "APAAR ID and APAAR generation status", "PORTAL_ONLY_UNVERIFIED"],
  ["T01", "Staff category counts and required teaching posts", "PARTIALLY_TRACKED"],
  ["T02", "Staff national and state codes", "NOT_TRACKED"],
  ["T03", "Staff name", "TRACKED_AUTHORITATIVE"],
  ["T04", "Gender, date of birth and social category", "SENSITIVE_CONDITIONAL"],
  ["T05", "Academic, professional and trade qualifications", "PARTIALLY_TRACKED"],
  ["T06", "Staff mobile and email", "TRACKED_AUTHORITATIVE"],
  ["T07", "Staff Aadhaar and name as Aadhaar", "SENSITIVE_CONDITIONAL"],
  ["T08", "Staff disability", "SENSITIVE_CONDITIONAL"],
  ["T09", "Service dates, present school, current post and appointment", "PARTIALLY_TRACKED"],
  ["T10", "Classes, levels, subjects and deputation", "PARTIALLY_TRACKED"],
  ["T11", "Training, NISHTHA, safety, cyber and CWSN training", "NOT_TRACKED"],
  ["T12", "Non-teaching assignment days", "NOT_TRACKED"],
  ["T13", "Working languages and CTET/STET", "NOT_TRACKED"],
  ["T14", "VTP and special-educator sector, job role and CRR details", "SENSITIVE_CONDITIONAL"],
  ["O01", "Block-level special educator and other-school enrollment", "PORTAL_ONLY_UNVERIFIED"]
];

const MAPPING_OVERRIDES: Readonly<Record<string, string>> = Object.freeze({
  S01: "SchoolSettings candidate only; official geography is not structured",
  S03: "SchoolSettings free-text address candidate; PIN and coordinates are not structured",
  S04: "SchoolSettings phone candidate; official mailbox and website need school verification",
  S07: "Student enrollment classes provide a partial operational-class candidate",
  S10: "Timetable and subject configuration are candidate evidence only",
  S13: "School calendar and exam/report records provide partial derived evidence",
  S16: "Attendance modules exist; capture-mode and official teacher identifiers are incomplete",
  S17: "Finance, receipt and inventory modules provide partial internal evidence",
  F07: "Library catalogue and circulation exist but do not prove the full DCF facility schedule",
  F14: "Transport routes and assignments exist but do not prove free-transport entitlement",
  ST01: "Student and AcademicYearEnrollment provide cycle, class and section candidates; official school code is absent",
  ST03: "Student.rollNo and AcademicYearEnrollment.rollNo",
  ST04: "Student.studentName",
  ST06: "Student.dateOfBirth",
  ST07: "Student fatherName/motherName plus Guardian relations; source precedence is unresolved",
  ST09: "Student.address free text; structured PIN is absent",
  ST10: "Student phone fields plus Guardian contact relations; values remain masked",
  ST16: "Student.admissionNo plus current AcademicYearEnrollment.enrollmentDate candidate",
  ST17: "Enrollment/timetable subject candidates; exact DCF semantics are unresolved",
  ST18: "Lifecycle and enrollment history provide partial previous-school/class evidence",
  ST20: "Finalised exam/result/report snapshots provide derived evidence after period confirmation",
  ST21: "Locked/finalised attendance provides derived evidence after period confirmation",
  ST26: "Finalised progression decisions and result/attendance handoff need cycle verification",
  T01: "StaffMember status/type can support internal category counts only",
  T03: "StaffMember.fullName",
  T05: "StaffMember.qualification is free text and not an official code",
  T06: "StaffMember.mobile and StaffMember.email; values remain masked",
  T09: "StaffMember joining/designation/status fields provide partial candidates",
  T10: "Staff/timetable assignments provide partial class and subject candidates"
});

const CONDITIONAL_IDS = new Set(["S11", "S12", "S14", "S18", "F09", "F11", "F14", "F15", "ST19", "ST22", "ST23", "ST25", "ST27", "T14", "O01"]);
const STATE_EVIDENCE_IDS = new Set(["S06", "S14", "ST22", "ST27", "O01"]);

function domainFor(id: string): UdiseEvidenceDomain {
  if (id.startsWith("ST")) return "STUDENT";
  if (id.startsWith("S")) return "SCHOOL";
  if (id.startsWith("F")) return "FACILITY";
  if (id.startsWith("T")) return "STAFF";
  return "BLOCK";
}

function applicabilityFor(id: string, status: UdiseGroupStatus): UdiseApplicability {
  if (STATE_EVIDENCE_IDS.has(id)) return "STATE_EVIDENCE_REQUIRED";
  if (status === "PORTAL_ONLY_UNVERIFIED") return "PORTAL_CONTROLLED";
  if (status === "SENSITIVE_CONDITIONAL" || CONDITIONAL_IDS.has(id)) return "APPLICABILITY_UNCONFIRMED";
  return "APPLICABLE_CONFIRMED";
}

function sensitivityFor(status: UdiseGroupStatus): UdiseSensitivity {
  if (status === "SENSITIVE_CONDITIONAL") return "SENSITIVE_OR_CONDITIONAL";
  if (status === "PORTAL_ONLY_UNVERIFIED") return "PORTAL_OR_POLICY_BOUNDARY";
  return "NON_SENSITIVE_CHECKLIST";
}

function recommendationFor(status: UdiseGroupStatus) {
  switch (status) {
    case "TRACKED_AUTHORITATIVE": return "Verify the current school source before treating the ERP candidate as current-cycle evidence.";
    case "TRACKED_DERIVED": return "Use only finalised, cycle-correct source records and label the result as derived.";
    case "TRACKED_BUT_REQUIRES_VERIFICATION": return "Keep the candidate unresolved until cycle semantics and school evidence are confirmed.";
    case "PARTIALLY_TRACKED": return "Show the missing components or semantic gap; do not award full completeness.";
    case "NOT_TRACKED": return "Keep as a source-register gap; no field or code list may be invented in 1C.";
    case "SENSITIVE_CONDITIONAL": return "Exclude raw values and ordinary denominators pending separate privacy and applicability approval.";
    case "PORTAL_ONLY_UNVERIFIED": return "Keep status-only until an authorised human verifies the current portal or State evidence.";
  }
}

const SCHOOL_SOURCE_REFS: Readonly<Record<string, string>> = Object.freeze({
  S01: "§1", S02: "§1/§4", S03: "§1", S04: "§1", S05: "§1",
  S06: "§1.12-1.15", S07: "§1.16-1.18", S08: "§1.19-1.20", S09: "§1.22-1.24",
  S10: "§1.25-1.27", S11: "§1.28-1.30", S12: "§1A", S13: "§1A", S14: "§1A",
  S15: "§1B", S16: "§1B", S17: "§1C", S18: "§1D"
});

function sourceReferenceFor(id: string) {
  if (SCHOOL_SOURCE_REFS[id]) return `N1 DCF ${SCHOOL_SOURCE_REFS[id]}`;
  if (id.startsWith("F")) return `N1 DCF ${id === "F14" ? "§2/student facilities" : "§2"}`;
  if (id === "ST27") return "N7/N9/T3 APAAR sources (not a confirmed N1 DCF field)";
  if (id.startsWith("ST")) {
    const ref = id === "ST08" ? "§4.1.7"
      : ["ST20", "ST21", "ST22", "ST23", "ST24", "ST25", "ST26"].includes(id)
        ? ({ ST20: "§4.2.7", ST21: "§4.2.8", ST22: "§4.3", ST23: "§4.3", ST24: "§4.3", ST25: "§4.4", ST26: "§4.5" } as const)[id as "ST20" | "ST21" | "ST22" | "ST23" | "ST24" | "ST25" | "ST26"]
        : Number(id.slice(2)) >= 16 ? "§4.2" : "§4.1";
    return `N1 DCF ${ref}`;
  }
  if (id.startsWith("T")) {
    const ref = id === "T01" ? "§3.1" : id === "T02" ? "§3.2-3.5" : id === "T14" ? "§3.4-3.5" : "§3";
    return `N1 DCF ${ref}`;
  }
  return "N1 DCF §5";
}

export type UdiseEvidenceGroup = Readonly<{
  id: string;
  evidenceId: string;
  domain: UdiseEvidenceDomain;
  label: string;
  primaryStatus: UdiseGroupStatus;
  sourceId: string;
  sourceReference: string;
  sourceScope: typeof UDISE_EVIDENCE.scope;
  currentErpMapping: string;
  applicability: UdiseApplicability;
  sensitivity: UdiseSensitivity;
  recommendation: string;
}>;

export const UDISE_EVIDENCE_REGISTER: readonly UdiseEvidenceGroup[] = Object.freeze(DEFINITIONS.map(([id, label, primaryStatus]) => Object.freeze({
  id,
  evidenceId: `${id === "ST27" ? "N7/N9/T3" : UDISE_EVIDENCE.sourceId}:${id}`,
  domain: domainFor(id),
  label,
  primaryStatus,
  sourceId: id === "ST27" ? "N7/N9/T3" : UDISE_EVIDENCE.sourceId,
  sourceReference: sourceReferenceFor(id),
  sourceScope: UDISE_EVIDENCE.scope,
  currentErpMapping: MAPPING_OVERRIDES[id] ?? (primaryStatus === "NOT_TRACKED" ? "No suitable current ERP mapping" : "No value mapping authorised in 1C"),
  applicability: applicabilityFor(id, primaryStatus),
  sensitivity: sensitivityFor(primaryStatus),
  recommendation: recommendationFor(primaryStatus)
})));

function countBy<T extends string>(values: readonly T[]) {
  return values.reduce<Record<T, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {} as Record<T, number>);
}

export const UDISE_REGISTER_TOTALS = Object.freeze({
  total: UDISE_EVIDENCE_REGISTER.length,
  byDomain: Object.freeze(countBy(UDISE_EVIDENCE_REGISTER.map((group) => group.domain))),
  byStatus: Object.freeze(countBy(UDISE_EVIDENCE_REGISTER.map((group) => group.primaryStatus))),
  tracked: UDISE_EVIDENCE_REGISTER.filter((group) => group.primaryStatus.startsWith("TRACKED_")).length,
  partial: UDISE_EVIDENCE_REGISTER.filter((group) => group.primaryStatus === "PARTIALLY_TRACKED").length,
  notTracked: UDISE_EVIDENCE_REGISTER.filter((group) => group.primaryStatus === "NOT_TRACKED").length,
  sensitiveOrConditional: UDISE_EVIDENCE_REGISTER.filter((group) => group.primaryStatus === "SENSITIVE_CONDITIONAL").length,
  portalOnlyOrUnverified: UDISE_EVIDENCE_REGISTER.filter((group) => group.primaryStatus === "PORTAL_ONLY_UNVERIFIED").length
});

export function filterUdiseEvidenceRegister(filters: { domain?: string; status?: string }) {
  return UDISE_EVIDENCE_REGISTER.filter((group) => (!filters.domain || group.domain === filters.domain)
    && (!filters.status || group.primaryStatus === filters.status));
}
