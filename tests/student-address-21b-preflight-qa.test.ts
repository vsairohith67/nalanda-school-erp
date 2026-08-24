import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");
const approval = read("docs/STUDENT_ADDRESS_21B_APPROVAL_RECORD.md");
const notice = read("docs/STUDENT_ADDRESS_PRIVACY_NOTICE_DRAFT.md");
const retention = read("docs/STUDENT_ADDRESS_RETENTION_AND_DELETION_POLICY_DRAFT.md");
const matrix = read("docs/STUDENT_ADDRESS_ACCESS_AND_INCIDENT_MATRIX.md");
const report = read("docs/STUDENT_ADDRESS_21B_PREFLIGHT_QA_REPORT.md");
const combined = [approval, notice, retention, matrix].join("\n");

describe("Prompt 21B-Preflight-QA approval gate", () => {
  it("keeps evidence authenticity visibly pending and never implies an external approval", () => {
    for (const evidence of [
      "Approving person: Not supplied",
      "Approval date: Not supplied",
      "Approval reference or meeting note: Not supplied",
      "Reviewer name: Not supplied",
      "Organisation or professional capacity: Not supplied",
      "Review date: Not supplied",
      "Written reference: Not supplied",
    ]) expect(approval).toContain(evidence);
    expect(approval).toContain("Decision status: PENDING");
    expect(approval).toContain("Review status: PENDING");
    expect(approval).toContain("This engineering record is not legal advice.");
    expect(notice).toContain("DRAFT");
    expect(notice).toContain("NOT LEGALLY APPROVED");
  });

  it("keeps purposes specific, alternatives visible, and optional/minimised fields explicit", () => {
    for (const purpose of ["Student-record correspondence", "Address-quality and correction", "Suppressed locality planning"]) {
      expect(approval).toContain(`| ${purpose} |`);
    }
    expect(approval).toContain("Lower-risk alternative considered");
    expect(approval).toContain("| addressLine2 | OPTIONAL |");
    expect(approval).toContain("| landmark | OPTIONAL |");
    for (const omitted of ["latitude", "longitude", "coordinatePrecision", "coordinateSource", "housePhotograph", "deviceLocationHistory", "liveLocation"]) {
      expect(approval).toContain(`| ${omitted} | OMITTED |`);
    }
    expect(combined).toContain("No live or device tracking occurs.");
    expect(combined).toContain("house/residence photographs");
  });

  it("uses the exact Tier 1/Tier 2 boundary and denies coordinate permissions", () => {
    expect(approval).toContain("Coordinate decision: OMIT_ALL_COORDINATES_FROM_21B");
    expect(approval).toContain("| Tier 1 | Structured postal address |");
    expect(approval).toContain("| Tier 2 | Locality-level aggregate |");
    expect(approval).toContain("| Tier 3 | Rounded approximate point | Requires a separate approval");
    expect(approval).toContain("| Tier 4 | Exact residential coordinate | PROHIBITED |");
    expect(approval).toContain("| Tier 5 | Live/device location | PROHIBITED |");
    expect(matrix).toContain("Exact-coordinate permission: NONE");
    expect(matrix).toContain("no page, API, role, export, emergency path, or audit role receives a coordinate permission");
  });

  it("makes the draft notice complete while preserving its unresolved contact and approval state", () => {
    for (const heading of [
      "## Purpose",
      "## Minimum fields",
      "## Optional and required fields",
      "## No tracking, map, or geocoding",
      "## Who may access the address",
      "## Parent correction rights",
      "## Retention",
      "## Complaints and contact",
      "## Incident or breach communication",
      "## Approval record",
    ]) expect(notice).toContain(heading);
    expect(notice).toContain("Approved version: AWAITING_APPROVAL");
    expect(notice).toContain("Complaint/contact route: AWAITING_APPROVAL");
    expect(notice).toContain("No third-party geocoding occurs in Prompt 21B.");
  });

  it("treats every role separately and preserves the low-risk defaults", () => {
    for (const role of ["Super Admin", "Director", "Principal", "Admin", "Teacher", "Viewer/Auditor", "Accountant", "Parent", "public user"]) {
      expect(matrix).toContain(`| ${role} |`);
    }
    expect(matrix).toContain("| Teacher | No address page | Denied |");
    expect(matrix).toContain("| Viewer/Auditor | Aggregate page only | Suppressed aggregate endpoint only |");
    expect(matrix).toContain("| Accountant | Denied | Denied |");
    expect(matrix).toContain("| Parent | Linked-child current-address/request page only |");
    expect(matrix).toContain("| public user | Denied | Denied |");
    expect(matrix).toContain("No full-address print, routine CSV");
  });

  it("uses explicit retention, deletion, backup, and exceptional-hold rules", () => {
    for (const required of [
      "## Active lifecycle",
      "## Transfer, exit, and graduation lifecycle",
      "## Correction history",
      "## Audit retention",
      "## Generalisation and deletion",
      "## Backup expiry and restore",
      "## Exceptional hold",
      "## Deletion verification",
      "## No live-location history",
      "transferred, withdrawn, left, and graduated Students",
    ]) expect(retention).toContain(required);
    expect(retention).toContain("“Retain as needed,” indefinite holds, and silent extensions are prohibited.");
    expect(retention).toContain("no public structured data, sitemap, metadata, analytics, or telemetry copy exists");
  });

  it("keeps all nine incident owners visibly unassigned and therefore blocking", () => {
    const incidentRows = matrix.split(/\r?\n/).filter((line) =>
      /^\| (Operational owner|Privacy owner|Security owner|Incident coordinator|Parent communication owner|Regulator\/legal escalation|Evidence preservation|Access suspension|Post-incident review) \|/.test(line),
    );
    expect(incidentRows).toHaveLength(9);
    for (const row of incidentRows) {
      expect(row).toContain("| Not supplied | PENDING |");
    }
    expect(matrix).toContain("Missing accountable persons blocks Prompt 21B.");
  });

  it("keeps backup projections permission-safe and excludes all secondary surfaces", () => {
    for (const exclusion of [
      "Address fields in JSON backup: proposed yes only through a reviewed explicit allowlist",
      "Encrypted cloud-backup coverage:",
      "PWA/offline cache: excluded",
      "Public website: excluded",
      "Public structured data, metadata, sitemap, and search markup: excluded",
      "AI Assistant: excluded",
      "Communication templates: excluded",
      "Ordinary application, access, error, analytics, and telemetry logs:",
    ]) expect(approval).toContain(exclusion);
  });

  it("keeps the blocker table and gate mechanically consistent", () => {
    const blockerRows = approval.split(/\r?\n/).filter((line) =>
      /^\| (approved purpose|approved precision tier|qualified legal\/privacy review|approved Parent notice|mandatory\/optional decision|field-minimisation decision|role matrix|aggregate threshold|export policy|retention and deletion|exit\/transfer treatment|incident ownership|backup\/restore projection|coordinate omission or separate approval|leadership signature\/reference) \|/.test(line),
    );
    expect(blockerRows).toHaveLength(15);
    expect(blockerRows.every((line) => line.includes("| UNRESOLVED |"))).toBe(true);
    expect(approval).toContain("Final gate decision: PROMPT_21B_BLOCKED");
    expect(approval).not.toContain("Final gate decision: SAFE_TO_BEGIN_PROMPT_21B");
  });

  it("retains the documentation-only product boundary", () => {
    const schema = read("prisma/schema.prisma");
    const student = schema.slice(schema.indexOf("model Student {"), schema.indexOf("\nmodel ", schema.indexOf("model Student {") + 1));
    expect(student).not.toMatch(/\b(latitude|longitude|coordinatePrecision|coordinateSource|locationPoint)\b/);
    expect(existsSync("app/student-addresses")).toBe(false);
    expect(existsSync("app/api/student-addresses")).toBe(false);
    expect(existsSync("app/student-locations")).toBe(false);
    expect(existsSync("app/api/geocoding")).toBe(false);
    expect(read("package.json")).not.toMatch(/mapbox|maplibre|leaflet|google-maps|nominatim|geocod/i);
    expect(read("lib/backup.ts")).toContain("backupVersion: 43");
  });

  it("publishes an evidence-based QA report with the required blocked release decision", () => {
    for (const heading of [
      "## Evidence-authenticity QA",
      "## Purpose and minimisation QA",
      "## Precision QA",
      "## Notice QA",
      "## Access QA",
      "## Retention and deletion QA",
      "## Incident-ownership QA",
      "## Backup, PWA, AI, logs, and public-site QA",
      "## Blocker-consistency QA",
      "## No-implementation QA",
      "## Release decision",
    ]) expect(report).toContain(heading);
    expect(report).toContain("`PROMPT_21B_REMAINS_BLOCKED`");
    expect(report).not.toContain("`PROMPT_21B_SAFE_TO_BEGIN`");
    expect(read("docs/INDEX.md")).toContain("STUDENT_ADDRESS_21B_PREFLIGHT_QA_REPORT.md");
  });
});
