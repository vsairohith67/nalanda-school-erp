import { it, expect } from "vitest";
import { publicIdentifierScanText } from "../scripts/qa-real-data-onboarding-preparation-1a-public-repo-scan";
const ledger = "docs/evidence/RELEASE_RECOVERY_1C.md";
const id = ["109783", "796888"].join("");
const url = `https://github.com/vsairohith67/nalanda-school-erp/actions/runs/36683414008/job/${id}`;
const forbidden = (file: string, text: string) => /\b(?:[6-9]\d{9})\b|\b\d{12}\b/.test(publicIdentifierScanText(file, text));
it("recognizes only the complete approved ledger job-link destination, preserving labels and source bytes", () => {
  const text = `[retained CI job](${url})`, copy = text;
  expect(forbidden(ledger, text)).toBe(false); expect(text).toBe(copy);
  expect(publicIdentifierScanText(ledger, text)).toBe("[retained CI job](PUBLIC_GITHUB_JOB_COORDINATE)");
});
it.each([
  url, `[${id}](${url})`, `[job](${url}) ${id}`, `${id} [job](${url})`,
  `[job](${url}?value=1)`, `[job](${url}#fragment)`, `[job](${url}/extra)`,
  `[job](${url.replace("github.com", "foreign.invalid")})`,
  `[job](${url.replace("nalanda-school-erp", "foreign-repo")})`,
  `[job](${url.replace("https:", "http:")})`,
  `[job](${url.replace("https:", "https:123e4567-e89b-12d3-a456-426614174000")})`,
  `[job](${url.replace("/job/", "/jobs/")})`,
  `[job](${url.replace("/36683414008/", "/0/")})`,
  `[job](${url.replace("/36683414008/", "/" + "1".repeat(21) + "/")})`
])("retains refusal of raw or noncanonical coordinates: fixture %s", text => {
  expect(forbidden(ledger, text)).toBe(true);
});
it.each(["config/onboarding/example.json", "templates/onboarding/example.csv", "docs/evidence/other.md"])("does not extend the exception to %s", file => {
  expect(forbidden(file, `[job](${url})`)).toBe(true);
});
it("preserves raw phone-shaped and private-key-like text for the existing detectors", () => {
  const phone = "9" + "1".repeat(9), key = ["-----BEGIN", "PRIVATE KEY-----"].join(" ");
  expect(forbidden(ledger, `[job](${url}) ${phone}`)).toBe(true);
  expect(publicIdentifierScanText(ledger, `[job](${url}) ${key}`)).toContain(key);
});
