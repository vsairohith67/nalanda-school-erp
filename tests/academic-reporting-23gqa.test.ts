import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { academicReportCsv, deterministicAcademicReportFilename } from "../lib/academic-reporting";

const root = path.resolve(".");
const source = (file: string) => readFileSync(path.join(root, file), "utf8");

describe("Prompt 23G independent reporting QA regressions", () => {
  it("preserves distinct same-name timetable subjects by stable identity during restore", () => {
    const restore = source("lib/restore-database.ts");
    const subjectBlock = restore.slice(restore.indexOf("for (const [index, row] of backup.timetableSubjects.entries())"), restore.indexOf("for (const [index, row] of backup.timetableClassSections.entries())"));
    expect(subjectBlock).toContain("findUnique({ where: { id: backupId } })");
    expect(subjectBlock).toContain("findUnique({ where: { shortName: data.shortName } })");
    expect(subjectBlock).not.toContain("findFirst({ where: { name: data.name } })");
  });

  it("keeps reporting private, state-changing, role-scoped and provider-free", () => {
    const middleware = source("middleware.ts");
    const api = source("lib/academic-reporting-api.ts");
    const loader = source("lib/academic-reporting-sources.ts");
    const exportRoute = source("app/api/academic-reports/runs/[runKey]/export/route.ts");
    expect(middleware).toContain("unsafeRequestOriginAllowed");
    expect(api).toContain("private, no-store");
    expect(exportRoute).toContain("export async function POST");
    expect(exportRoute).not.toContain("export async function GET");
    expect(loader).not.toMatch(/\bfetch\s*\(|axios|openai/i);
  });

  it("uses formula-safe CSV cells and deterministic bounded filenames", () => {
    const summary = {
      title: "QA", generatedAt: "2026-08-03T00:00:00.000Z", sourceStatement: "Locked and issued only", boardClassDisclaimer: null, warnings: [],
      sections: [{ id: "qa", title: "QA", description: "QA", columns: ["Value"], rows: [{ Value: "=1+1" }] }]
    } as any;
    expect(academicReportCsv(summary)).toContain("'=1+1");
    expect(deterministicAcademicReportFilename("AR-23G-QA", "a".repeat(64), "pdf")).toBe("academic-report-AR-23G-QA-aaaaaaaaaa.pdf");
  });

  it("keeps report filter and export actions at the 44px touch target", () => {
    const css = source("app/globals.css");
    expect(css).toContain(".academic-report-filter-grid input,.academic-report-filter-grid select,.approval-box input{min-block-size:44px}");
    expect(css).toContain(".academic-reporting-workspace button{min-block-size:44px}");
    expect(css).toContain(".academic-exam-selector label,.check-label{align-items:center;display:flex;gap:.55rem;min-height:44px}");
  });
});
