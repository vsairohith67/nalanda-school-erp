import { it, expect } from "vitest";
import { publicIdentifierScanText } from "../scripts/qa-real-data-onboarding-preparation-1a-public-repo-scan";
const ledger = "docs/evidence/RELEASE_RECOVERY_1C.md";
const adoptedLedgers = ["docs/evidence/recovery-batch-integration-5a/HANDOFF.md", "scripts/laptop-lab/HANDOFF.md"];
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
it.each(adoptedLedgers)("retains strict coordinate and content boundaries for adopted evidence %s", file => {
  expect(forbidden(file, `[retained job](${url})`)).toBe(false);
  for (const text of [url, `[${id}](${url})`, `[job](${url}) ${id}`, `[job](${url}?value=1)`, `[job](${url.replace("nalanda-school-erp", "foreign-repo")})`]) {
    expect(forbidden(file, text)).toBe(true);
  }
  expect(forbidden(file, `[job](${url}) ${"9" + "1".repeat(9)}`)).toBe(true);
  const key = ["-----BEGIN", "PRIVATE KEY-----"].join(" ");
  expect(publicIdentifierScanText(file, `[job](${url}) ${key}`)).toContain(key);
});

const capacityPacketPath = "config/runtime-base-prior-blocked.json";
async function capacityPacket() { return (await import("node:fs/promises")).readFile(capacityPacketPath, "utf8"); }
it("projects only reviewed digest-bound capacity bytes while preserving complete public source", async () => {
  const text = await capacityPacket(), prior = text;
  expect(forbidden(capacityPacketPath, text)).toBe(false); expect(text).toBe(prior);
  const projected = publicIdentifierScanText(capacityPacketPath, text);
  expect(projected).toContain("PUBLIC_CAPACITY_BYTE_COUNT");
  expect(projected).toContain("BLOCKING_FINDINGS_CONFIRMED"); expect(JSON.parse(JSON.parse(projected).reports.arm64.raw).scanners.trivy.ignoreUnfixed).toBe(false);
});
it.each(["config/onboarding/example.json", "docs/evidence/other.md", "config/runtime-base-prior-blocked-copy.json"])("retains capacity-shaped identifiers outside exact reviewed file %s", async file => {
  expect(forbidden(file, await capacityPacket())).toBe(true);
});
it.each(["contract", "priorSource", "priorTree", "priorRun", "priorAttempt"])("refuses altered public packet binding %s", async field => {
  const packet = JSON.parse(await capacityPacket()); packet[field] = "ALTERED";
  expect(forbidden(capacityPacketPath, JSON.stringify(packet, null, 2) + "\n")).toBe(true);
});
it("refuses changed raw reports even when the caller updates their claimed digest", async () => {
  const packet = JSON.parse(await capacityPacket()); packet.reports.arm64.raw += " ";
  packet.reports.arm64.sha256 = (await import("node:crypto")).createHash("sha256").update(packet.reports.arm64.raw).digest("hex");
  expect(forbidden(capacityPacketPath, JSON.stringify(packet, null, 2) + "\n")).toBe(true);
});
it("preserves additional identifiers, labels, phone-shaped values and private-key-like text", async () => {
  const original = await capacityPacket(), packet = JSON.parse(original);
  for (const value of [id, "9" + "1".repeat(9)]) { packet.additional = value; expect(forbidden(capacityPacketPath, JSON.stringify(packet, null, 2) + "\n")).toBe(true); }
  const key = ["-----BEGIN", "PRIVATE KEY-----"].join(" "); packet.additional = key;
  expect(publicIdentifierScanText(capacityPacketPath, JSON.stringify(packet, null, 2) + "\n")).toContain(key);
  expect(forbidden(capacityPacketPath, original + " " + id)).toBe(true);
});
it("does not conceal duplicate unknown populated outer columns", async () => {
  const original = await capacityPacket(); expect(original.trimEnd().endsWith("}")).toBe(true); const adversarial = original.trimEnd().slice(0, -1) + ',"unreviewed":"' + id + '","unreviewed":"safe"}';
  expect(JSON.parse(adversarial).unreviewed).toBe("safe");
  expect(forbidden(capacityPacketPath, adversarial)).toBe(true);
});

it("refuses a changed capacity value even with a recomputed report digest", async () => {
  const packet = JSON.parse(await capacityPacket()), report = JSON.parse(packet.reports.arm64.raw); report.capacityFreeBytes += 1;
  packet.reports.arm64.raw = JSON.stringify(report); packet.reports.arm64.sha256 = (await import("node:crypto")).createHash("sha256").update(packet.reports.arm64.raw).digest("hex");
  expect(forbidden(capacityPacketPath, JSON.stringify(packet, null, 2) + "\n")).toBe(true);
});

it("does not project capacity inside an unknown outer copy of the complete raw report", async () => {
  const packet = JSON.parse(await capacityPacket()); packet.unreviewedRawCopy = packet.reports.arm64.raw;
  const text = JSON.stringify(packet, null, 2) + "\n";
  expect(forbidden(capacityPacketPath, text)).toBe(true);
  expect(publicIdentifierScanText(capacityPacketPath, text)).toBe(text);
});
