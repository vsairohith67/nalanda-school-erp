import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

const feasibility = read("docs/STUDENT_LOCATION_MAPPING_PRIVACY_COST_AND_FEASIBILITY.md");
const threatModel = read("docs/STUDENT_LOCATION_THREAT_MODEL_AND_DATA_POLICY.md");
const providers = read("docs/MAPPING_PROVIDER_COMPARISON_AND_COST_MODEL.md");

describe("Prompt 21A Student-location planning boundary", () => {
  it("records one conditional decision and the provider-free 21B boundary", () => {
    expect(feasibility).toContain("Decision: **CONDITIONAL GO FOR 21B**");
    expect(feasibility).toContain("NO PROVIDER / MANUAL ADDRESS ONLY");
    expect(feasibility).toContain("do not collect exact residential coordinates in Prompt 21B");
    expect(feasibility).toContain("No Student address was submitted to a third party");
  });

  it("documents precision, access, correction, legal, backup, PWA, AI, public, and phase gates", () => {
    for (const required of [
      "## Data precision tiers",
      "## Access and permission matrix",
      "## Correction and verification workflow",
      "## Data lifecycle",
      "## Backup, restore, export, print, and deletion",
      "## AI, PWA, public-site, and device boundaries",
      "## Legal and regulatory review",
      "## Prompt 21D geocoding privacy architecture",
      "## Security-control checklist",
      "## Failure and data-quality workflows",
      "### Prompt 21B: conditional scope",
      "### Prompt 21C: later map gate",
      "### Prompt 21D: later provider gate",
      "## Traceable Prompt 21A requirements checklist",
      "## Unresolved questions",
      "## Leadership decision checklist",
    ]) {
      expect(feasibility).toContain(required);
    }
    expect(feasibility).toContain("Current backup format: version 37, unchanged");
  });

  it("records high-risk threats, concrete controls, retention, incidents, and rights", () => {
    expect(threatModel).toContain("high-risk child personal data");
    expect(threatModel).toContain("| L-30 |");
    expect(threatModel).toContain("minimum cell size 10");
    expect(threatModel).toContain("Cache-Control: private, no-store");
    expect(threatModel).toContain("## Incident and breach response");
    expect(threatModel).toContain("## Retention and deletion policy template");
    expect(threatModel).toContain("## Parent and Student rights workflow");
  });

  it("compares all requested provider paths and makes assumptions configurable", () => {
    for (const required of [
      "No provider / manual address only",
      "Google Maps Platform",
      "Mapbox",
      "Public OSM Nominatim",
      "Self-hosted Nominatim",
      "Contracted OSM-based provider",
      "## Configurable cost model",
      "| 800 |",
      "| 1,000 |",
      "| 2,000 |",
      "## Mandatory budget and abuse controls",
      "## Procurement questions",
    ]) {
      expect(providers).toContain(required);
    }
    expect(providers).toContain("Public Nominatim is prohibited");
    expect(providers).toContain("Prices and terms can change");
    expect(providers).toContain("All values are estimates");
  });

  it("contains no provider credential and adds no Student coordinate schema", () => {
    const combined = feasibility + threatModel + providers;
    expect(combined).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/);
    expect(combined).not.toMatch(/\bpk\.[0-9A-Za-z_-]{20,}/);
    expect(combined).not.toMatch(/\bsk\.[0-9A-Za-z_-]{20,}/);

    const schema = read("prisma/schema.prisma");
    const studentModel = schema.slice(schema.indexOf("model Student {"), schema.indexOf("\nmodel ", schema.indexOf("model Student {") + 1));
    expect(studentModel).not.toMatch(/\b(latitude|longitude|locationPoint|geocodeProvider)\b/);
  });

  it("keeps backup format at version 37 and links all three documents", () => {
    expect(read("lib/backup.ts")).toContain("backupVersion: 37");
    const index = read("docs/INDEX.md");
    for (const filename of [
      "STUDENT_LOCATION_MAPPING_PRIVACY_COST_AND_FEASIBILITY.md",
      "STUDENT_LOCATION_THREAT_MODEL_AND_DATA_POLICY.md",
      "MAPPING_PROVIDER_COMPARISON_AND_COST_MODEL.md",
    ]) {
      expect(index).toContain(filename);
    }
  });
});
