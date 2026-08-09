import { readFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  createReportDownloadToken,
  verifyReportDownloadToken
} from "../lib/report-download-tokens";
import {
  createReportZip,
  deterministicReportPdfName,
  renderReportPdf
} from "../lib/report-pdf";
import {
  GOVERNED_REPORT_TEMPLATE_FAMILIES,
  safePublishedReportSnapshot,
  type PublishedReportSnapshot
} from "../lib/report-publication-types";

const source = (path: string) => readFileSync(path, "utf8");

describe("EXAM-RC-IMPL-3 publication security and PDF contract", () => {
  it("keeps the workflow bounded, POST-driven, authenticated, and free of native dialogs", () => {
    const publication = source("lib/report-publication.ts");
    const jobs = source("lib/report-pdf-jobs.ts");
    const parent = source("lib/report-parent-delivery.ts");
    const workspace = source("components/report-publication-workspace.tsx");
    const publicationRoute = source("app/api/report-cards/publication/route.ts");
    const parentAccessRoute = source("app/api/parent/report-cards/access/route.ts");

    expect(GOVERNED_REPORT_TEMPLATE_FAMILIES).toEqual([
      "KG_DEVELOPMENTAL_BOOKLET",
      "PRIMARY_10_40_SKILLS",
      "SECONDARY_10_40_GROUPED",
      "RETAINED_MULTI_EXAM_I_X"
    ]);
    expect(publication).toContain("MAX_REPORT_PUBLICATION_BATCH = 60");
    expect(jobs).toContain("MAX_ACTIVE_REPORT_PDF_JOBS = 2");
    expect(jobs).toContain("PDF generation or packaging failed safely. No artifact was published.");
    expect(publicationRoute).toContain("export async function POST");
    expect(publicationRoute).not.toContain("export async function GET");
    expect(parentAccessRoute).toContain("requireApiRolePermission(\"VIEW_OWN_REPORT_CARDS\", \"PARENT\")");
    expect(parent).toContain("child.studentReference === selectedStudentId");
    expect(parent).not.toContain("child.studentId === selectedStudentId");
    expect(workspace).not.toMatch(/\b(?:alert|confirm|prompt)\s*\(/);
  });

  it("signs short-lived audience-bound access and rejects tampering or expiry", () => {
    const previous = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = "EXAM3-test-secret-that-is-longer-than-thirty-two-characters";
    try {
      const now = new Date("2026-07-31T10:00:00.000Z");
      const token = createReportDownloadToken({
        kind: "PARENT_REPORT",
        action: "DOWNLOAD",
        userId: "exam3-parent",
        resource: "card:version",
        mode: "MONOCHROME"
      }, { now, lifetimeSeconds: 60 });
      expect(verifyReportDownloadToken(token, {
        now: new Date("2026-07-31T10:00:30.000Z")
      })?.userId).toBe("exam3-parent");
      expect(verifyReportDownloadToken(`${token}x`, { now })).toBeNull();
      expect(verifyReportDownloadToken(token, {
        now: new Date("2026-07-31T10:01:01.000Z")
      })).toBeNull();
    } finally {
      if (previous === undefined) delete process.env.AUTH_SECRET;
      else process.env.AUTH_SECRET = previous;
    }
  });

  it("drops internal source identities from Parent-safe snapshots", () => {
    const safe = safePublishedReportSnapshot(reportFixture());
    expect(safe.governance).not.toHaveProperty("internal");
    expect(JSON.stringify(safe)).not.toContain("internal-snapshot-id");
  });

  it("renders A4 PDFs in colour and monochrome and packages sanitized ZIP entries", async () => {
    const report = reportFixture();
    const colour = await renderReportPdf(report, "COLOUR");
    const monochrome = await renderReportPdf(report, "MONOCHROME");
    expect(colour.subarray(0, 4).toString()).toBe("%PDF");
    expect(monochrome.subarray(0, 4).toString()).toBe("%PDF");
    const [colourDocument, monochromeDocument] = await Promise.all([
      PDFDocument.load(colour),
      PDFDocument.load(monochrome)
    ]);
    expect(colourDocument.getPageCount()).toBeGreaterThan(0);
    expect(monochromeDocument.getPageCount()).toBe(colourDocument.getPageCount());
    const size = colourDocument.getPage(0).getSize();
    expect(size.width).toBeCloseTo(595.28, 1);
    expect(size.height).toBeCloseTo(841.89, 1);
    const fileName = deterministicReportPdfName(report, "MONOCHROME");
    expect(fileName).toMatch(/^[A-Za-z0-9._-]+\.pdf$/);
    expect(fileName).not.toContain("..");
    const zip = createReportZip([{ name: "../../unsafe report.pdf", bytes: monochrome }]);
    expect(zip.subarray(0, 2).toString("hex")).toBe("504b");
  }, 30_000);

  it("preserves backup version 38 and the isolated EXAM3 harness contract", () => {
    expect(source("lib/backup.ts")).toContain("backupVersion: 38");
    expect(source("package.json")).toContain("\"qa:exam3\": \"tsx scripts/qa-exam3-copied-db.ts\"");
    const harness = source("scripts/qa-exam3-copied-db.ts");
    expect(harness).toContain("assertIsolatedDatabasePath");
    expect(harness).toContain("EXAM3_OPERATIONAL_SOURCE_CHANGED");
    expect(harness).toContain("injectFailureAfter: 1");
  });
});

function reportFixture(): PublishedReportSnapshot {
  return {
    schemaVersion: 3,
    status: "ISSUED",
    reportType: "MARK_BASED",
    templateFamily: "PRIMARY_10_40_SKILLS",
    publicationReference: "NPS-PUB-2026-27-EXAM3-A-1234567890-V1",
    reportCardNumber: "NPS-RC-2026-27-EXAM3-A-EXAM3-001-T1",
    versionNumber: 1,
    issueDate: "2026-07-31T10:00:00.000Z",
    title: "EXAM3 Primary Report Card",
    reportingPeriod: "2026-07-01 to 2026-07-25",
    academicYear: "2026-27",
    school: {
      name: "Nalanda Public School",
      address: "Nanalnagar, Mehdipatnam",
      city: "Hyderabad",
      phone: "040-23513913",
      logoPath: "/nalanda-logo.jpg"
    },
    student: {
      name: "EXAM3 Student With A Long Name",
      admissionNumber: "EXAM3-001",
      rollNumber: "1",
      className: "EXAM3 Primary",
      section: "A",
      dateOfBirth: "2016-01-15"
    },
    examination: {
      code: "EXAM3-PRI",
      name: "EXAM3 Primary Term Review",
      periodStart: "2026-07-01",
      periodEnd: "2026-07-25"
    },
    content: {
      papers: [{
        code: "P1",
        subjectName: "Environmental Studies With A Long Subject Label",
        paperName: "Integrated Paper",
        calculationMode: "RAW_SUM",
        components: [
          { code: "W", name: "Written", state: "PRESENT", obtained: "0.00", maximum: "50.00", contributionWeight: null, contribution: "0.00" },
          { code: "I", name: "Internal", state: "ABSENT", obtained: null, maximum: "50.00", contributionWeight: null, contribution: null }
        ],
        obtained: "0.00",
        maximum: "100.00",
        percentage: "0.00",
        excluded: false
      }],
      groups: [],
      totalObtained: "0.00",
      totalMaximum: "100.00",
      percentage: "0.00",
      grade: { code: "A", label: "Excellent", point: "4.0" },
      passResult: "PASS",
      rank: 1,
      cohortAverage: "65.00",
      cohortHighest: "95.00",
      attendance: {
        policy: "LOCKED_EXAMINATION_DATE_RANGE_ONLY",
        periodStart: "2026-07-01",
        periodEnd: "2026-07-25",
        totalLockedDays: 20,
        recordedDays: 20,
        presentEquivalentDays: 18.5
      },
      skills: [{ area: "Communication", rating: "A", remarks: "Consistent" }],
      personality: [],
      developmentalSections: [],
      combinedResults: [],
      remarks: {
        classTeacher: "Approved synthetic remark.",
        principal: "Approved for EXAM3 QA.",
        general: null
      },
      legends: [{ code: "A", label: "Excellent" }],
      warnings: []
    },
    signatures: [
      { role: "CLASS_TEACHER", label: "Class Teacher" },
      { role: "PRINCIPAL", label: "Principal" },
      { role: "PARENT", label: "Parent / Guardian" }
    ],
    template: {
      code: "EXAM3-T",
      name: "EXAM3 Primary Template",
      version: 1,
      bindingVersion: 1,
      definition: {},
      printSettings: {
        orientation: "PORTRAIT",
        pageSize: "A4",
        minimumFontSizePt: 9,
        marginMm: 12
      }
    },
    governance: {
      calculationRunReference: "CALC-123456789012",
      resultSnapshotVersion: 1,
      formulaVersion: "EXAM_CALCULATION_V2",
      roundingPolicyVersion: "RC05_V1_DECIMAL6_HALF_UP2",
      sourceLockedAt: "2026-07-29T08:05:00.000Z",
      templateFrozenAt: "2026-06-20T10:00:00.000Z",
      previewFingerprint: "A".repeat(64),
      publishedByLabel: "EXAM3 Principal",
      internal: {
        resultSnapshotId: "internal-snapshot-id",
        calculationRunId: "internal-run-id",
        templateBindingId: "internal-binding-id"
      }
    }
  };
}
