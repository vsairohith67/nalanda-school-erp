import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import * as XLSX from "xlsx";
import { createGovernedReviewDraft, writeGovernedReviewDraft } from "@/lib/onboarding-review-draft";
import { canonicalOnboardingPackage } from "@/lib/onboarding-canonical-package";
import { loadMappingCatalogue, packageDigest, validatePackage } from "@/lib/onboarding-preparation";
import { parseOnboardingWorkbook } from "@/lib/onboarding-workbooks";
import { inventedReviewPackage } from "./helpers/onboarding-review-fixture";

const roots: string[] = [];
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }); });
const mappingPath = path.resolve("config/onboarding/mapping-catalogue.json");
async function fixture(options = {}) { const root = await mkdtemp(path.join(os.tmpdir(), "nalanda-review-synthetic-")); roots.push(root); const source = path.join(root, "source"); const manifest = await inventedReviewPackage(source, "one", options); return { root, source, manifest, catalogue: await loadMappingCatalogue(mappingPath) }; }

describe("offline package to the governed workbook", () => {
  it("executes the public preparation command with aggregate output and an honest collision refusal", async () => {
    const f = await fixture(); const output = path.join(f.root, "cli-review");
    const args = [path.resolve("node_modules/tsx/dist/cli.mjs"), "scripts/onboarding-preparation.ts", "review-draft", "--package", f.source, "--mapping", mappingPath, "--bundle", "STUDENT_GUARDIAN", "--output", output];
    const run = spawnSync(process.execPath, args, { encoding: "utf8", timeout: 10000 });
    expect(run.status).toBe(0); expect(run.stderr).toBe("");
    expect(JSON.parse(run.stdout)).toEqual({ result: "REVIEW_CANDIDATE_GENERATED", rowsReceived: 3, heldRows: 0, targetValidation: "REQUIRED", authoritativeWrites: 0 });
    expect(parseOnboardingWorkbook(await readFile(path.join(output, "review.xlsx")), "STUDENT_GUARDIAN").students).toHaveLength(1);
    const refused = spawnSync(process.execPath, args, { encoding: "utf8", timeout: 10000 });
    expect(refused.status).toBe(1); expect(refused.stdout).toBe(""); expect(refused.stderr).not.toContain(f.root);
    expect(refused.stderr).not.toContain("విద్యార్థి");
  });
  it("reopens the existing contract, preserves string identity/Unicode/lineage and canonical hash binding", async () => {
    const f = await fixture(); const before = await packageDigest(f.source, f.manifest);
    const draft = await createGovernedReviewDraft({ packageRoot: f.source, catalogue: f.catalogue, bundle: "STUDENT_GUARDIAN" });
    expect(draft.heldRows).toBe(0); expect(draft.rowsReceived).toBe(3); expect(draft.parsed.students[0]["Admission Number"]).toBe("000-one");
    expect(draft.parsed.students[0]["Student Full Name"]).toContain("విద్యార్థి");
    expect(draft.parsed.links[0]["Student Row Key"]).toBe(draft.parsed.students[0]["Import Row Key"]);
    expect(draft.parsed.enrollments[0]["Student Row Key"]).toBe(draft.parsed.students[0]["Import Row Key"]);
    expect(draft.ledger.every(row => row.sourceRow === 2 && row.fileId.startsWith("SYNTH-"))).toBe(true);
    const canonical = parseOnboardingWorkbook(canonicalOnboardingPackage(draft.parsed, "STUDENT_GUARDIAN"), "STUDENT_GUARDIAN");
    expect(canonical.metadata["Preparation Package Hash"]).toBe(draft.packageHash); expect(canonical.metadata["Preparation Mapping Hash"]).toBe(draft.mappingHash);
    expect(canonical.metadata["Preparation Held Rows"]).toBe("0"); expect(await packageDigest(f.source, f.manifest)).toBe(before);
  });
  it("retains missing required values without placeholders and holds unrelated financial rows", async () => {
    const f = await fixture({ missingFather: true, finance: true });
    const draft = await createGovernedReviewDraft({ packageRoot: f.source, catalogue: f.catalogue, bundle: "STUDENT_GUARDIAN" });
    expect(draft.parsed.students[0]["Father Name"]).toBe(""); expect(draft.ledger).toHaveLength(4); expect(draft.heldRows).toBeGreaterThan(0);
    expect(draft.ledger.find(row => row.domain === "FINANCE")!.heldCodes).toContain("DOMAIN_OUTSIDE_BUNDLE");
    expect(draft.parsed.metadata["Preparation Held Rows"]).not.toBe("0"); expect(draft.targetValidation).toBe("REQUIRED");
  });
  it("requires fresh explicit output, rejects case/path aliases and collisions, and emits only aggregate results", async () => {
    const f = await fixture(); const output = path.join(f.root, "review");
    await expect(writeGovernedReviewDraft({ packageRoot: f.source, mappingPath, output: path.join(f.source, "review"), bundle: "STUDENT_GUARDIAN" })).rejects.toThrow("INSIDE_SOURCE");
    if (process.platform === "win32") {
      await expect(writeGovernedReviewDraft({ packageRoot: f.source, mappingPath, output: path.join(f.source.toUpperCase(), "review"), bundle: "STUDENT_GUARDIAN" })).rejects.toThrow("INSIDE_SOURCE");
      await expect(writeGovernedReviewDraft({ packageRoot: f.source, mappingPath, output: path.join(process.cwd(), "PUBLIC", "SYNTHETIC-review-alias"), bundle: "STUDENT_GUARDIAN" })).rejects.toThrow("PRIVATE_OUTPUT_REQUIRED");
    }
    const summary = await writeGovernedReviewDraft({ packageRoot: f.source, mappingPath, output, bundle: "STUDENT_GUARDIAN" });
    expect(Object.keys(summary).sort()).toEqual(["authoritativeWrites", "heldRows", "result", "rowsReceived", "targetValidation"].sort());
    expect(parseOnboardingWorkbook(await readFile(path.join(output, "review.xlsx")), "STUDENT_GUARDIAN").students).toHaveLength(1);
    await expect(writeGovernedReviewDraft({ packageRoot: f.source, mappingPath, output, bundle: "STUDENT_GUARDIAN" })).rejects.toThrow();
    expect((await validatePackage(f.source)).issues).toEqual([]);
    const alias = path.join(f.root, "alias"); await symlink(f.source, alias, process.platform === "win32" ? "junction" : "dir");
    await expect(writeGovernedReviewDraft({ packageRoot: f.source, mappingPath, output: path.join(alias, "new"), bundle: "STUDENT_GUARDIAN" })).rejects.toThrow("PARENT_REFUSED");
  });
  it("binds changed mapping and file ordering without transferring approval", async () => {
    const f = await fixture(); const first = await createGovernedReviewDraft({ packageRoot: f.source, catalogue: f.catalogue, bundle: "STUDENT_GUARDIAN" });
    f.manifest.files.reverse(); await writeFile(path.join(f.source, "manifest.json"), JSON.stringify(f.manifest));
    const reordered = await createGovernedReviewDraft({ packageRoot: f.source, catalogue: f.catalogue, bundle: "STUDENT_GUARDIAN" });
    expect(reordered.packageHash).toBe(first.packageHash); expect(reordered.ledger.map(row => row.rowKey)).toEqual(first.ledger.map(row => row.rowKey));
    const changed = structuredClone(f.catalogue); changed.entries[0].authority = "SYNTHETIC_CHANGED_MAPPING";
    const next = await createGovernedReviewDraft({ packageRoot: f.source, catalogue: changed, bundle: "STUDENT_GUARDIAN" });
    expect(next.mappingHash).not.toBe(first.mappingHash); expect(next.workbookHash).not.toBe(first.workbookHash);
    f.manifest.sourceClassification = "SUPPORTING_EVIDENCE";
    await writeFile(path.join(f.source, "manifest.json"), JSON.stringify(f.manifest));
    const meaningChanged = await createGovernedReviewDraft({ packageRoot: f.source, catalogue: f.catalogue, bundle: "STUDENT_GUARDIAN" });
    expect(meaningChanged.packageHash).not.toBe(first.packageHash); expect(meaningChanged.heldRows).toBe(3);
  });
  it("preserves physical XLSX row and sheet lineage across blank source rows", async () => {
    const f = await fixture(); const manifest = f.manifest; const file = manifest.files[0];
    const source = (await readFile(path.join(f.source, file.relativePath), "utf8")).trim().split(/\r?\n/).map(line => line.split(","));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([source[0], [], source[1]]), "Invented roster");
    const bytes = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
    await rm(path.join(f.source, file.relativePath)); file.relativePath = "students.xlsx"; file.format = "XLSX"; file.sizeBytes = bytes.length;
    const { createHash } = await import("node:crypto"); file.sha256 = createHash("sha256").update(bytes).digest("hex");
    await writeFile(path.join(f.source, file.relativePath), bytes); manifest.fileSize = manifest.files.reduce((sum, item) => sum + item.sizeBytes, 0); manifest.sha256 = await packageDigest(f.source, manifest); await writeFile(path.join(f.source, "manifest.json"), JSON.stringify(manifest));
    const draft = await createGovernedReviewDraft({ packageRoot: f.source, catalogue: f.catalogue, bundle: "STUDENT_GUARDIAN" });
    const student = draft.ledger.find(row => row.domain === "STUDENTS")!; expect(student.sourceRow).toBe(3); expect(student.sourceSheet).toBe("Invented roster"); expect(student.rowKey).toBe("SRC:SYNTH-STUDENTS:3");
  });
  it("preserves CSV physical lineage through blank lines and refuses public/traversing output", async () => {
    const f = await fixture(); const file = f.manifest.files[0];
    const text = (await readFile(path.join(f.source, file.relativePath), "utf8")).replace("\r\n", "\r\n\r\n");
    await writeFile(path.join(f.source, file.relativePath), text); const { createHash } = await import("node:crypto");
    file.sha256 = createHash("sha256").update(text).digest("hex"); file.sizeBytes = Buffer.byteLength(text); f.manifest.fileSize = f.manifest.files.reduce((sum, item) => sum + item.sizeBytes, 0); f.manifest.sha256 = await packageDigest(f.source, f.manifest); await writeFile(path.join(f.source, "manifest.json"), JSON.stringify(f.manifest));
    const draft = await createGovernedReviewDraft({ packageRoot: f.source, catalogue: f.catalogue, bundle: "STUDENT_GUARDIAN" });
    expect(draft.ledger.find(row => row.domain === "STUDENTS")!.sourceRow).toBe(3);
    await expect(writeGovernedReviewDraft({ packageRoot: f.source, mappingPath, output: path.join(process.cwd(), "public", "SYNTHETIC-REVIEW"), bundle: "STUDENT_GUARDIAN" })).rejects.toThrow("PRIVATE_OUTPUT_REQUIRED");
    await expect(writeGovernedReviewDraft({ packageRoot: f.source, mappingPath, output: `${f.root}/../SYNTHETIC-REVIEW`, bundle: "STUDENT_GUARDIAN" })).rejects.toThrow("TRAVERSAL_REFUSED");
  });
});
