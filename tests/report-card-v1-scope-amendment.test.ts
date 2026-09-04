import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { releaseFeatureFlags } from "@/lib/release-feature-flags";
import {
  KG_REPORT_CARD_DEFERRED_MESSAGE,
  KG_REPORT_CARD_DEFERRED_STATUS,
  KG_REPORT_CARD_V1_5_STATUS,
  isKgReportCardOperationallyAvailable,
  isV1OperationalReportType
} from "@/lib/report-card-release-policy";

const root = process.cwd();
const source = (relative: string) => readFileSync(path.join(root, relative), "utf8");

describe("REPORT-PRINT-ACCEPT-1A and KG-REPORTS-V1_5-1A release boundaries", () => {
  it("preserves KG as default-off after V1.5 software clearance", () => {
    const flag = releaseFeatureFlags().find((row) => row.key === "kg-report-cards-v1-5");
    expect(flag).toMatchObject({
      environment: "PRODUCTION",
      defaultState: false,
      allowedRoles: ["SUPER_ADMIN"],
      rolloutPercentage: 0,
      version: 1
    });
    expect(KG_REPORT_CARD_DEFERRED_STATUS).toBe("SOFTWARE_CLEARED_OPERATIONAL_ACTIVATION_OFF");
    expect(KG_REPORT_CARD_V1_5_STATUS).toBe("SOFTWARE_CLEARED_OPERATIONAL_ACTIVATION_OFF");
    expect(KG_REPORT_CARD_DEFERRED_MESSAGE).toContain("operational activation remains off");
    expect(isKgReportCardOperationallyAvailable()).toBe(false);
    expect(isV1OperationalReportType("KG_RUBRIC")).toBe(false);
    expect(isV1OperationalReportType("MARK_BASED")).toBe(true);
  });

  it("blocks new KG operational work while keeping cleared software and historical views", () => {
    const service = source("lib/report-cards.ts");
    const publication = source("lib/report-publication.ts");
    const examConfiguration = source("lib/exam-configurations.ts");
    const historyPage = source("app/report-cards/[id]/page.tsx");
    const kgRenderer = source("lib/report-card-refined-source-lock.ts");
    const kgTests = source("tests/kg-report-card.test.ts");

    expect(service.match(/requireV1OperationalReportType/g)?.length).toBeGreaterThanOrEqual(8);
    expect(publication).toContain("KG_REPORT_CARD_DEFERRED_MESSAGE");
    expect(examConfiguration).toContain('templateFamily === "KG_DEVELOPMENTAL_BOOKLET"');
    expect(historyPage).toContain("Historical records remain readable");
    expect(historyPage).toContain("Print Preview");
    expect(kgRenderer).toContain("FINAL_KG_PAGE_SPECS");
    expect(kgTests).toContain("KG report-card");
  });

  it("records one non-duplicated scope split and preserves all 29 R5 corrections", () => {
    const register = source("docs/REQUIREMENTS_REGISTER.md");
    const amendment = source("docs/REPORT_CARD_V1_SCOPE_AMENDMENT.md");
    const requirementRows = [...register.matchAll(/^\| (V(?:1(?:\.1|\.5)?|2)-[A-Z][A-Z-]*-\d{3}) \|/gm)].map((match) => match[1]);

    // Include the V1.1 Academic Integrity release as well as V1, V1.5, and V2
    // so additions cannot silently duplicate or disappear from the ledger.
    expect(requirementRows).toHaveLength(43);
    expect(requirementRows).toContain("V1.5-APP-041");
    expect(new Set(requirementRows).size).toBe(requirementRows.length);
    expect(requirementRows.filter((id) => id === "V1.1-SEC-ACADEMIC-001")).toHaveLength(1);
    expect(requirementRows.filter((id) => id === "V1-RC-016")).toHaveLength(1);
    expect(requirementRows.filter((id) => id === "V1.5-RC-034")).toHaveLength(1);
    expect(requirementRows.filter((id) => id === "V1.5-SEARCH-036")).toHaveLength(1);
    expect(requirementRows.filter((id) => id === "V1.5-AI-037")).toHaveLength(1);
    expect(requirementRows.filter((id) => id === "V1.5-MEET-038")).toHaveLength(1);
    expect(requirementRows.filter((id) => id === "V1.5-SEARCH-039")).toHaveLength(1);
    expect(requirementRows.filter((id) => id === "V1.5-DB-042")).toHaveLength(1);
    expect(register).toContain("| Total requirements | 40 |");
    expect(register).toContain("| V1 | 24 |");
    expect(register).toContain("| V1.1 | 1 |");
    expect(register).toContain("| V1.5 | 9 |");
    expect(register).toContain("| V2 | 6 |");
    expect(register).toContain("| CLEARED | 28 |");
    expect(register).not.toContain("| RELEASE_BLOCKED |");
    expect(register).toContain("| CLEARED_WITH_OPERATIONAL_CONFIGURATION_PENDING | 4 |");
    expect(register).toContain("| COMPLETE | 1 |");
    expect(register).toContain("| DEFERRED | 6 |");
    expect(register).not.toContain("| COMPLETE_LOCAL_PRIVATE |");
    expect(register).not.toContain("| PARTIAL |");
    expect(register).not.toContain("| MISSING |");
    expect(register).not.toContain("IN_PROGRESS_PHYSICAL_ACCEPTANCE_PENDING");
    expect(register).toContain("| IMPLEMENTED_FOUNDATION_DEFERRED_TO_V1_5 | 0 |");
    expect(register).toContain("| READY_FOR_QA | 0 |");
    expect(register).toContain("SOFTWARE_CLEARED_OPERATIONAL_ACTIVATION_OFF");
    for (let correction = 1; correction <= 29; correction += 1) {
      expect(amendment.match(new RegExp(`^${correction}\\. `, "gm"))).toHaveLength(1);
    }
    expect(amendment).toContain("implemented in both approved Classes I-X variants");
    expect(amendment).toContain("user visual review");
    expect(amendment).toContain("SUPERSEDED_PENDING_CLASSES_I_X_CORRECTIONS");
  });

  it("keeps the V1 release candidate Classes I-X-only and physical acceptance pending", () => {
    const checklist = source("docs/RELEASE_CANDIDATE_CHECKLIST.md");
    const printChecklist = source("docs/REPORT_CARD_PHYSICAL_PRINT_ACCEPTANCE_CHECKLIST.md");
    expect(checklist).toContain("KG/LKG/UKG excluded from V1 release-candidate completeness");
    expect(checklist).toContain("PHYSICAL_PRINT_GATE_PENDING");
    expect(checklist).toContain("R8_DIGITAL_DESIGN_APPROVED");
    expect(printChecklist).toContain("SUPERSEDED_PENDING_CLASSES_I_X_CORRECTIONS");
    expect(printChecklist).toContain("PHYSICAL PRINT GATE OPEN");
    expect(printChecklist).toContain("Classes I-X-only");
  });
});
