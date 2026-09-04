import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");
const feasibility = read("docs/STUDENT_LOCATION_MAPPING_PRIVACY_COST_AND_FEASIBILITY.md");
const threats = read("docs/STUDENT_LOCATION_THREAT_MODEL_AND_DATA_POLICY.md");
const providers = read("docs/MAPPING_PROVIDER_COMPARISON_AND_COST_MODEL.md");

describe("Prompt 21A-QA planning completeness", () => {
  it("gives every use case explicit decision inputs and rejects vague future collection", () => {
    for (const heading of [
      "Business owner",
      "Legitimate purpose",
      "Minimum data / precision",
      "Access roles",
      "Retention need",
      "Lower-risk alternative",
      "Separate-module boundary",
    ]) {
      expect(feasibility).toContain(heading);
    }
    expect(feasibility).toContain("“Useful later”");
    expect(feasibility).toContain("is not a sufficient purpose");
  });

  it("evaluates tiers zero through four with distinct display, export, backup, correction, and deletion rules", () => {
    for (const tier of ["| 0 |", "| 1 |", "| 2 |", "| 3 |", "| 4 |"]) {
      expect(feasibility).toContain(tier);
    }
    expect(feasibility).toContain("Decimal places are not a complete privacy control");
    expect(feasibility).toContain("Unknown must remain different from blank");
    expect(feasibility.toLowerCase()).toContain("do not collect exact residential coordinates in prompt 21b");
    expect(feasibility).toContain("No raw coordinate export permission");
  });

  it("keeps legal conclusions cautious and sources current official material", () => {
    expect(feasibility).toContain("Review date: 2026-07-19");
    expect(feasibility).toContain("This is an engineering review, not legal advice");
    expect(feasibility).toContain("Digital Personal Data Protection Act, 2023");
    expect(feasibility).toContain("Digital Personal Data Protection Rules, 2025");
    expect(feasibility).toContain("Commencement notification G.S.R. 843(E)");
    expect(feasibility).toContain("qualified Indian counsel");
    expect(threats).toContain("Official-source review date: 2026-07-19");
  });

  it("gives each threat control, residual risk, owner, and phase", () => {
    const rows = threats.split(/\r?\n/).filter((line) => /^\| L-\d{2} \|/.test(line));
    expect(rows).toHaveLength(35);
    for (const row of rows) {
      const columns = row.split("|").slice(1, -1).map((value) => value.trim());
      expect(columns).toHaveLength(7);
      expect(columns[4]).not.toBe("");
      expect(columns[5]).not.toBe("");
      expect(columns[6]).toMatch(/\//);
    }
    for (const risk of [
      "stalking",
      "harassment",
      "burglary",
      "kidnapping",
      "Parent attempting another child",
      "API enumeration",
      "PWA",
      "AI",
      "public",
    ]) {
      expect(threats.toLowerCase()).toContain(risk.toLowerCase());
    }
  });

  it("treats every role explicitly and keeps exact/raw access denied by default", () => {
    for (const role of ["Super Admin", "Director", "Principal", "Admin", "Teacher", "Viewer", "Accountant", "Parent/Guardian", "Public/unauthenticated"]) {
      expect(feasibility).toContain(`| ${role} |`);
    }
    expect(feasibility).toContain("Viewer | Aggregate locality counts only");
    expect(feasibility).toContain("Parent/Guardian | Linked child’s current postal address");
    expect(feasibility).toContain("VIEW_EXACT_STUDENT_POINTS");
    expect(feasibility).toContain("no default role");
  });

  it("separates provider pricing, storage, security, and production suitability", () => {
    for (const required of [
      "Google Maps Platform pricing in India",
      "Geocoding API policies",
      "API security best practices",
      "Mapbox pricing",
      "temporary and permanent geocoding",
      "Mapbox token security",
      "Public Nominatim usage policy",
      "OpenStreetMap tile usage policy",
      "Nominatim installation guidance",
      "not to submit personal or confidential material",
      "no-code/low-code/LLM-assisted",
    ]) {
      expect(providers).toContain(required);
    }
    expect(providers).toContain("Prices and terms can change");
    expect(providers).toContain("Public Nominatim is prohibited");
  });

  it("shows formulas and separate demand/cost components for every cohort", () => {
    for (const formula of [
      "annual new-admission geocodes",
      "annual correction geocodes",
      "monthly map loads",
      "development/staging geocode capacity",
      "manual initial verification cost",
      "self-hosted monthly cost",
    ]) {
      expect(providers).toContain(formula);
    }
    for (const row of [
      "| 800 | 920 | 138 | 74 | 212 | 283 | 144 | 36 | INR 16,000 |",
      "| 1,000 | 1,150 | 173 | 92 | 265 | 354 | 144 | 36 | INR 20,000 |",
      "| 2,000 | 2,300 | 345 | 184 | 529 | 708 | 144 | 36 | INR 40,000 |",
    ]) {
      expect(providers).toContain(row);
    }
    expect(providers).toContain("Misuse and failure examples");
    expect(providers).toContain("All values are estimates");
  });

  it("covers lifecycle, map privacy, and non-overlapping phase boundaries", () => {
    for (const required of [
      "## Data lifecycle",
      "accepted address change invalidates the old point",
      "on transfer/exit",
      "provider metadata",
      "minimum of 10",
      "Do not return or display contact details",
      "no Parent/public map",
      "### Prompt 21B: conditional scope",
      "### Prompt 21C: later map gate",
      "### Prompt 21D: later provider gate",
    ]) {
      expect(feasibility).toContain(required);
    }
  });

  it("retains the documentation-only implementation boundary", () => {
    const schema = read("prisma/schema.prisma");
    const student = schema.slice(schema.indexOf("model Student {"), schema.indexOf("\nmodel ", schema.indexOf("model Student {") + 1));
    expect(student).not.toMatch(/\b(latitude|longitude|locationPoint|geocodeProvider)\b/);
    expect(read("lib/backup.ts")).toContain("backupVersion: 45");
    expect(existsSync("app/student-locations")).toBe(false);
    expect(existsSync("app/api/student-locations")).toBe(false);
    expect(existsSync("app/api/geocoding")).toBe(false);

    const packageJson = read("package.json");
    expect(packageJson).not.toMatch(/mapbox|leaflet|maplibre|google-maps|geocod/i);
    expect(feasibility + threats + providers).not.toMatch(/AIza[0-9A-Za-z_-]{20,}|\bpk\.[0-9A-Za-z_-]{20,}|\bsk\.[0-9A-Za-z_-]{20,}/);
  });

  it("publishes a completed QA report with final release evidence", () => {
    const report = read("docs/STUDENT_LOCATION_MAPPING_21A_QA_REPORT.md");
    expect(report).toContain("Prompt 21A status: **fully cleared**");
    expect(report).toContain("1,313 tests across 143 files passed");
    expect(report).toContain("274 page routes and 375 APIs");
    expect(report).toContain("backup-2026-07-19-19-43.json");
    expect(report).toContain("Prompt 21B is **not yet safe to begin**");
    expect(report).not.toContain("FINAL_VERIFICATION_PLACEHOLDER");
    expect(read("docs/INDEX.md")).toContain("STUDENT_LOCATION_MAPPING_21A_QA_REPORT.md");
  });
});
