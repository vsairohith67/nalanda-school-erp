import type { PublishedReportSnapshot, ReportColourMode } from "@/lib/report-publication-types";
import { buildCanonicalReportCardTemplate } from "@/lib/report-card-templates";
import type { CanonicalReportTemplateFamily } from "@/lib/report-card-canonical-templates";

export type SyntheticReportSpecimen = {
  id: string;
  family: CanonicalReportTemplateFamily;
  variant: string;
  mode: ReportColourMode;
  structureCoverage: string[];
  report: PublishedReportSnapshot;
};

const PAPER_DEFINITIONS = [
  ["ENGLISH-1", "English", "English Paper 1"],
  ["ENGLISH-2", "English", "English Paper 2"],
  ["HINDI", "Hindi", "Hindi"],
  ["SOCIAL-LONG", "Interdisciplinary Social and Environmental Studies", "Social Studies"],
  ["SCIENCE", "Science", "Science"],
  ["MATHS", "Mathematics", "Mathematics"],
  ["PHYSICS", "Physics", "Physics"],
  ["CHEMISTRY", "Chemistry", "Chemistry"],
  ["BIOLOGY", "Biology", "Biology"],
  ["COMPUTERS", "Computer Applications", "Computer Applications"]
] as const;

export function syntheticReportSpecimens(): SyntheticReportSpecimen[] {
  const requests: Array<{
    family: CanonicalReportTemplateFamily;
    variant: string;
    coverage: string[];
  }> = [
    { family: "KG_DEVELOPMENTAL_BOOKLET", variant: "DEVELOPMENTAL_BOOKLET", coverage: ["KG full ten-page booklet"] },
    { family: "LOWER_PRIMARY_I_II", variant: "CT", coverage: ["Classes I-II CT variable-component structure"] },
    { family: "LOWER_PRIMARY_I_II", variant: "SESSION", coverage: ["Classes I-II Session variable-component structure"] },
    { family: "LOWER_PRIMARY_I_II", variant: "COMBINED", coverage: ["Classes I-II combined-result structure"] },
    { family: "UPPER_PRIMARY_III_V", variant: "CT", coverage: ["Classes III-V CT with separate Science and Social"] },
    { family: "UPPER_PRIMARY_III_V", variant: "SESSION", coverage: ["Classes III-V Session with separate Science and Social"] },
    { family: "UPPER_PRIMARY_III_V", variant: "COMBINED", coverage: ["Classes III-V combined-result structure"] },
    { family: "MIDDLE_VI_VIII_GROUPED", variant: "CT", coverage: ["Classes VI-VIII grouped-subject CT structure"] },
    { family: "MIDDLE_VI_VIII_GROUPED", variant: "SESSION", coverage: ["Classes VI-VIII grouped-subject Session structure"] },
    { family: "MIDDLE_VI_VIII_GROUPED", variant: "COMBINED", coverage: ["Classes VI-VIII grouped-subject combined structure"] },
    { family: "SECONDARY_IX_X", variant: "CT", coverage: ["Classes IX-X CT grouped-subject structure"] },
    { family: "SECONDARY_IX_X", variant: "SESSION", coverage: ["Classes IX-X Session, Revision and Preboard shared variable-component structure"] },
    { family: "SECONDARY_IX_X", variant: "COMBINED", coverage: ["Classes IX-X configured combined-result capability"] }
  ];
  return requests.flatMap((request, index) => (["COLOUR", "MONOCHROME"] as const).map((mode) => {
    const id = `RC-SYN-${String(index + 1).padStart(2, "0")}-${mode === "COLOUR" ? "C" : "M"}`;
    return {
      id,
      family: request.family,
      variant: request.variant,
      mode,
      structureCoverage: request.coverage,
      report: syntheticReport(request.family, request.variant, id, index)
    };
  }));
}

export function syntheticReport(
  family: CanonicalReportTemplateFamily,
  variant: string,
  specimenId: string,
  seed = 0
): PublishedReportSnapshot {
  const kg = family === "KG_DEVELOPMENTAL_BOOKLET";
  const lowerOrUpper = family === "LOWER_PRIMARY_I_II" || family === "UPPER_PRIMARY_III_V";
  const grouped = family === "MIDDLE_VI_VIII_GROUPED" || family === "SECONDARY_IX_X";
  const combined = variant === "COMBINED";
  const componentNames = variant === "CT"
    ? ["Configured component A", "Configured component B"]
    : ["Configured component A", "Configured component B", "Configured component C"];
  const definition = buildCanonicalReportCardTemplate(family, variant, {
    parentGuardianMode: seed % 2 ? "FATHER_NAME_COMPATIBILITY" : "INCLUSIVE_GUARDIAN",
    parentGuardianLabel: seed % 2 ? "Father Name" : "Parent / Guardian",
    signatureLabels: kg
      ? ["Class Teacher", "Principal", "Parent / Guardian", "Director"]
      : grouped
        ? ["Class Teacher", "Principal", "Parent / Guardian", "Director"]
        : ["Parent / Guardian", "Class Teacher", "Principal / HM"],
    affiliationWording: "Synthetic affiliation wording - not an operational claim",
    recognitionWording: "Synthetic recognition wording",
    establishmentYear: "2000",
    chartEnabled: !kg,
    combinedSourceApprovalReference: combined ? "SYNTHETIC-LAYOUT-CALIBRATION-ONLY" : null
  });
  const papers = kg ? [] : PAPER_DEFINITIONS.slice(0, grouped ? 10 : 7).map((row, paperIndex) => {
    const states = ["PRESENT", "PRESENT", "ABSENT", "EXEMPT", "NOT_APPLICABLE", "NOT_ENTERED"];
    const components = componentNames.map((name, componentIndex) => {
      const state = states[(paperIndex + componentIndex + seed) % states.length];
      const maximum = ["13.5", "37", "80"][componentIndex] ?? "50";
      const obtained = state === "PRESENT"
        ? paperIndex === 0 && componentIndex === 0 ? "0.00" : String(Math.min(Number(maximum), 7.25 + paperIndex * 2 + componentIndex * 3.5))
        : null;
      return {
        code: `CMP-${componentIndex + 1}`,
        name,
        state,
        obtained,
        maximum,
        contributionWeight: componentIndex === 0 ? "17.5" : componentIndex === 1 ? "32.5" : "50",
        contribution: state === "PRESENT" ? String((Number(obtained) / Number(maximum) * (componentIndex === 0 ? 17.5 : componentIndex === 1 ? 32.5 : 50)).toFixed(2)) : null
      };
    });
    return {
      code: row[0],
      subjectName: row[1],
      paperName: row[2],
      calculationMode: seed % 2 ? "RAW_SUM" : "WEIGHTED_NORMALIZED",
      components,
      obtained: String((paperIndex * 7.13 + 24.5).toFixed(2)),
      maximum: "100",
      percentage: String(Math.min(100, 38.5 + paperIndex * 5.6).toFixed(2)),
      excluded: false,
      cohortAverage: String(Math.min(100, 42.25 + paperIndex * 3.1).toFixed(2)),
      cohortHighest: String(Math.min(100, 88 + paperIndex * 1.25).toFixed(2))
    };
  });
  const evaluations = ["I", "II", "III", "IV", "V"];
  const criteria = Array.isArray((definition as any).criteria) ? (definition as any).criteria : [];
  const summaryAreas = Array.isArray((definition as any).summaryAreas) ? (definition as any).summaryAreas : [];
  const personalityTraits = Array.isArray((definition as any).personalityTraits) ? (definition as any).personalityTraits : [];
  const monthly = ["JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER", "JANUARY", "FEBRUARY", "MARCH", "APRIL"]
    .map((month, index) => ({ month, workingDays: 20 + (index % 3), daysPresent: seed % 2 ? 8 + (index % 5) : 20 + (index % 3) }));
  const report: PublishedReportSnapshot = {
    schemaVersion: 3,
    status: seed % 3 === 0 ? "PREVIEW" : "ISSUED",
    reportType: kg ? "KG_RUBRIC" : "MARK_BASED",
    templateFamily: family,
    publicationReference: `SYNTHETIC-${specimenId}-V${seed % 2 + 1}`,
    reportCardNumber: `SYN-RC-${String(seed + 1).padStart(4, "0")}`,
    versionNumber: seed % 2 + 1,
    issueDate: "2026-08-11",
    title: `${variant.replaceAll("_", " ")} Synthetic Progress Report`,
    reportingPeriod: "Synthetic period only",
    academicYear: "2099-00",
    school: {
      name: "NALANDA PUBLIC SCHOOL",
      address: "Synthetic School Address, Sample Road",
      city: "Hyderabad",
      phone: null,
      logoPath: "/nalanda-logo-transparent.png",
      affiliationWording: "Synthetic affiliation wording - not an operational claim",
      recognitionWording: "Synthetic recognition wording",
      establishmentYear: "2000"
    },
    student: {
      name: seed % 2 ? "Aarav-Synthetic Extremely Long Multilingual-Compatible Student Name" : "Ananya-Synthetic Long Student Name For Print Calibration",
      admissionNumber: `SYN-${String(seed + 1).padStart(4, "0")}`,
      rollNumber: String(seed + 1),
      className: classNameForFamily(family),
      section: "SYN",
      dateOfBirth: "2090-01-01",
      gender: seed % 2 ? "Synthetic X" : "Synthetic Y",
      parentGuardians: seed % 2
        ? [{ label: "Father Name", value: "Synthetic Historical-Compatibility Parent Name" }]
        : [
            { label: "Parent / Guardian", value: "Synthetic Guardian With An Extremely Long Name For Wrapping" },
            { label: "Parent / Guardian", value: "Second Synthetic Guardian Name" }
          ]
    },
    examination: {
      code: `SYN-${variant}`,
      name: `${variant.replaceAll("_", " ")} Synthetic Examination`,
      periodStart: "2099-06-01",
      periodEnd: "2099-12-31"
    },
    content: {
      papers,
      groups: grouped ? [
        { groupCode: "LANG", groupName: "English Papers", obtained: "71.25", maximum: "100", percentage: "71.25", calculationMode: "WEIGHTED_NORMALIZED" },
        { groupCode: "SOC", groupName: "History / Geography / Social Group", obtained: "62.40", maximum: "100", percentage: "62.40", calculationMode: "RAW_SUM" },
        { groupCode: "SCI", groupName: "Physics / Chemistry / Biology / Science Group", obtained: "78.15", maximum: "100", percentage: "78.15", calculationMode: "WEIGHTED_NORMALIZED" }
      ] : [],
      totalObtained: kg ? "0" : "437.65",
      totalMaximum: kg ? "0" : "700",
      percentage: kg ? "0" : "62.52",
      grade: kg ? null : { code: seed % 2 ? "B" : "A", label: seed % 2 ? "Very Good" : "Excellent", point: seed % 2 ? null : "4.0" },
      passResult: kg ? null : seed % 2 ? null : "PASS",
      rank: kg || seed % 2 ? null : 7,
      cohortAverage: kg ? null : "58.37",
      cohortHighest: kg ? null : "98.50",
      attendance: {
        policy: "SYNTHETIC_LOCKED_BASIS",
        periodStart: "2099-06-01",
        periodEnd: "2099-12-31",
        totalLockedDays: 220,
        recordedDays: 220,
        presentEquivalentDays: seed % 2 ? 97.5 : 220,
        monthly
      },
      skills: lowerOrUpper ? skillsRows() : [],
      personality: grouped ? personalityRows() : [],
      developmentalSections: kg ? [{
        title: "Synthetic developmental observations",
        items: criteria.map((row: any, index: number) => ({ area: row.label, rating: ["GOOD", "SATISFACTORY", "NEEDS_IMPROVEMENT"][index % 3], remarks: null }))
      }] : [],
      combinedResults: combined ? [
        { label: "Configured synthetic result A", obtained: "17.50", maximum: "25", percentage: "70.00", configuredWeight: "25" },
        { label: "Configured synthetic result B", obtained: "53.20", maximum: "75", percentage: "70.93", configuredWeight: "75" }
      ] : [],
      remarks: {
        classTeacher: "Synthetic long remark: demonstrates thoughtful participation, sustained effort, and opportunities for further growth without containing any real Student observation.",
        principal: "Synthetic leadership remark for print calibration only.",
        general: "SYNTHETIC DATA ONLY - NOT A REAL STUDENT REPORT. This deliberately long line validates wrapping, spacing, and the absence of clipped text."
      },
      legends: seed % 2 ? [
        { code: "A", label: "Synthetic excellent", minimumPercentage: "80", maximumPercentage: "100", gradePoint: null },
        { code: "B", label: "Synthetic developing", minimumPercentage: "50", maximumPercentage: "79.99", gradePoint: null },
        { code: "C", label: "Synthetic support required", minimumPercentage: "0", maximumPercentage: "49.99", gradePoint: null }
      ] : [
        { code: "A+", label: "Synthetic outstanding", minimumPercentage: "90", maximumPercentage: "100", gradePoint: "4.0" },
        { code: "A", label: "Synthetic excellent", minimumPercentage: "75", maximumPercentage: "89.99", gradePoint: "3.5" },
        { code: "B", label: "Synthetic good", minimumPercentage: "0", maximumPercentage: "74.99", gradePoint: "3.0" }
      ],
      warnings: seed % 3 === 0 ? ["Synthetic preview includes NOT ENTERED to prove visual distinction; it is not issuable."] : [],
      growth: kg ? evaluations.filter((value) => ["I", "III", "V"].includes(value)).map((evaluation, index) => ({ evaluation, heightCm: String(100 + index * 3.5), weightKg: String(15 + index * 1.5) })) : [],
      evaluationComments: kg ? evaluations.map((evaluation) => ({ evaluation, comment: `Synthetic Evaluation ${evaluation} comment with sufficient length to validate wrapping and signature spacing.` })) : [],
      kgRubricEvaluations: kg ? evaluations.map((evaluation, evaluationIndex) => ({ evaluation, ratings: criteria.map((row: any, index: number) => ({ area: row.key, rating: ["GOOD", "AVERAGE", "NEEDS_IMPROVEMENT"][(index + evaluationIndex) % 3] })) })) : [],
      kgSummaryEvaluations: kg ? evaluations.map((evaluation, evaluationIndex) => ({ evaluation, ratings: summaryAreas.map((area: string, index: number) => ({ area, rating: ["A", "B", "C"][(index + evaluationIndex) % 3] })) })) : [],
      kgPersonalityEvaluations: kg ? evaluations.map((evaluation, evaluationIndex) => ({ evaluation, ratings: personalityTraits.map((area: string, index: number) => ({ area, rating: ["G", "S", "N"][(index + evaluationIndex) % 3] })) })) : [],
      promotion: kg ? { nextClass: "SYNTHETIC NEXT CLASS", nextSessionStartDate: "2100-04-01", displayText: "Synthetic promotion wording for layout proof only." } : undefined
    },
    signatures: (definition.signatureLabels ?? []).map((label, index) => ({ role: `SYNTHETIC_SIGNATORY_${index + 1}`, label })),
    template: {
      code: `SYN-${family}-${variant}`,
      name: `${family} ${variant} synthetic calibration`,
      version: 1,
      bindingVersion: 1,
      definition,
      printSettings: { orientation: family === "SECONDARY_IX_X" && combined ? "LANDSCAPE" : "PORTRAIT", pageSize: "A4", minimumFontSizePt: 8.5, marginMm: 9 }
    },
    governance: {
      calculationRunReference: `SYN-CALC-${String(seed + 1).padStart(4, "0")}`,
      resultSnapshotVersion: 1,
      formulaVersion: "SYNTHETIC-FROZEN-FORMULA-V1",
      roundingPolicyVersion: "SYNTHETIC-ROUNDING-V1",
      sourceLockedAt: "2026-08-11T00:00:00.000Z",
      templateFrozenAt: "2026-08-11T00:00:00.000Z",
      previewFingerprint: "A".repeat(64),
      publishedByLabel: "Synthetic QA",
      schemeVersionReferences: ["SYN-SCHEME-V1"],
      gradeScaleVersion: 1,
      skillsPersonalitySchemeVersion: 1,
      attendanceBasisVersion: "SYN-ATT-V1",
      reportTemplateVersion: 1,
      signatureConfigurationVersion: "SYN-SIG-V1",
      publicationVersion: 1,
      internal: { resultSnapshotId: "synthetic-result", calculationRunId: "synthetic-run", templateBindingId: "synthetic-binding" }
    }
  };
  return report;
}

function classNameForFamily(family: CanonicalReportTemplateFamily) {
  if (family === "KG_DEVELOPMENTAL_BOOKLET") return "LKG";
  if (family === "LOWER_PRIMARY_I_II") return "II";
  if (family === "UPPER_PRIMARY_III_V") return "V";
  if (family === "MIDDLE_VI_VIII_GROUPED") return "VIII";
  return "X";
}

function skillsRows() {
  return ["Reading Skills", "Writing Skills", "Speaking Skills", "Listening Skills", "Problem Solving Techniques", "Mental Ability", "Concepts", "Tables", "Environmental Sensitivity", "Spoken English"]
    .map((area, index) => ({ area, rating: ["G", "S", "N"][index % 3], remarks: index === 0 ? "Synthetic skills remark for wrapping." : null }));
}

function personalityRows() {
  return ["Courteousness", "Confidence", "Dress and Cleanliness", "Regularity and Punctuality", "Self-Control", "General Discipline", "Sharing and Caring", "Participation towards School Activities", "Leadership Quality", "Spirit of Service"]
    .map((area, index) => ({ area, rating: ["G", "S", "N"][index % 3], remarks: index === 7 ? "Synthetic long personality observation." : null }));
}
