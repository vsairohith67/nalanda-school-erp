export const REPORT_PUBLICATION_SCHEMA_VERSION = 3 as const;

export const GOVERNED_REPORT_TEMPLATE_FAMILIES = [
  "KG_DEVELOPMENTAL_BOOKLET",
  "PRIMARY_10_40_SKILLS",
  "SECONDARY_10_40_GROUPED",
  "RETAINED_MULTI_EXAM_I_X"
] as const;

export type GovernedReportTemplateFamily =
  (typeof GOVERNED_REPORT_TEMPLATE_FAMILIES)[number];

export type ReportColourMode = "COLOUR" | "MONOCHROME";
export type ReportPublicationScope = "INDIVIDUAL" | "SECTION" | "CLASS";

export type PublishedReportSnapshot = {
  schemaVersion: typeof REPORT_PUBLICATION_SCHEMA_VERSION;
  status: "PREVIEW" | "ISSUED";
  reportType: "MARK_BASED" | "KG_RUBRIC";
  templateFamily: GovernedReportTemplateFamily;
  publicationReference: string;
  reportCardNumber: string;
  versionNumber: number;
  issueDate: string | null;
  title: string;
  reportingPeriod: string;
  academicYear: string;
  school: {
    name: string;
    address: string;
    city: string;
    phone: string | null;
    logoPath: string | null;
  };
  student: {
    name: string;
    admissionNumber: string;
    rollNumber: string | null;
    className: string;
    section: string | null;
    dateOfBirth: string | null;
  };
  examination: {
    code: string;
    name: string;
    periodStart: string;
    periodEnd: string;
  };
  content: {
    papers: Array<{
      code: string;
      subjectName: string;
      paperName: string;
      calculationMode: string;
      components: Array<{
        code: string;
        name: string;
        state: string;
        obtained: string | null;
        maximum: string;
        contributionWeight: string | null;
        contribution: string | null;
      }>;
      obtained: string;
      maximum: string;
      percentage: string;
      excluded: boolean;
    }>;
    groups: Array<Record<string, unknown>>;
    totalObtained: string;
    totalMaximum: string;
    percentage: string;
    grade: { code: string; label: string; point: string | null } | null;
    passResult: string | null;
    rank: number | null;
    cohortAverage: string | null;
    cohortHighest: string | null;
    attendance: {
      policy: string;
      periodStart: string;
      periodEnd: string;
      totalLockedDays: number;
      recordedDays: number;
      presentEquivalentDays: number;
    };
    skills: Array<{ area: string; rating: string; remarks: string | null }>;
    personality: Array<{ area: string; rating: string; remarks: string | null }>;
    developmentalSections: Array<{
      title: string;
      items: Array<{ area: string; rating: string; remarks: string | null }>;
    }>;
    combinedResults: Array<{
      label: string;
      obtained: string;
      maximum: string;
      percentage: string;
      configuredWeight: string | null;
    }>;
    remarks: {
      classTeacher: string | null;
      principal: string | null;
      general: string | null;
    };
    legends: Array<{ code: string; label: string }>;
    warnings: string[];
  };
  signatures: Array<{ role: string; label: string }>;
  template: {
    code: string;
    name: string;
    version: number;
    bindingVersion: number;
    definition: Record<string, unknown>;
    printSettings: {
      orientation: "PORTRAIT" | "LANDSCAPE";
      pageSize: "A4";
      minimumFontSizePt: number;
      marginMm: number;
    };
  };
  governance: {
    calculationRunReference: string;
    resultSnapshotVersion: number;
    formulaVersion: string;
    roundingPolicyVersion: string;
    sourceLockedAt: string;
    templateFrozenAt: string;
    previewFingerprint: string;
    publishedByLabel: string | null;
    internal: {
      resultSnapshotId: string;
      calculationRunId: string;
      templateBindingId: string;
    };
  };
};

export type SafePublishedReportSnapshot = Omit<PublishedReportSnapshot, "governance"> & {
  governance: Omit<PublishedReportSnapshot["governance"], "internal">;
};

export function safePublishedReportSnapshot(
  snapshot: PublishedReportSnapshot
): SafePublishedReportSnapshot {
  const { internal: _internal, ...governance } = snapshot.governance;
  return { ...snapshot, governance };
}

export function reportTypeForFamily(
  family: GovernedReportTemplateFamily
): "MARK_BASED" | "KG_RUBRIC" {
  return family === "KG_DEVELOPMENTAL_BOOKLET" ? "KG_RUBRIC" : "MARK_BASED";
}

export function reportTemplateFamilyLabel(family: GovernedReportTemplateFamily) {
  const labels: Record<GovernedReportTemplateFamily, string> = {
    KG_DEVELOPMENTAL_BOOKLET: "KG developmental booklet",
    PRIMARY_10_40_SKILLS: "Primary mark and skills report",
    SECONDARY_10_40_GROUPED: "Secondary grouped-subject and personality report",
    RETAINED_MULTI_EXAM_I_X: "Configured combined-result report"
  };
  return labels[family];
}
