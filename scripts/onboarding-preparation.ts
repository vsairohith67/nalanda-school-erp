import path from "node:path";
import { createSyntheticPackage, dryRunPackage, loadMappingCatalogue, validateMappingCatalogue, validatePackage, writeDryRunReports } from "@/lib/onboarding-preparation";
import { readFile } from "node:fs/promises";
import { writeGovernedReviewDraft } from "@/lib/onboarding-review-draft";
import { isOnboardingBundle } from "@/lib/onboarding-types";

function argument(name: string) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function positional(index: number) { return process.argv.slice(3).filter((item, itemIndex, all) => !item.startsWith("--") && (itemIndex === 0 || !all[itemIndex - 1].startsWith("--")))[index]; }
function safeSummary(value: unknown) { process.stdout.write(`${JSON.stringify(value)}\n`); }

async function main() {
  const command = process.argv[2]; const workspace = process.cwd(); const cataloguePath = path.resolve(argument("--mapping") ?? path.join(workspace, "config", "onboarding", "mapping-catalogue.json"));
  if (command === "mapping-validate") {
    const checked = validateMappingCatalogue(JSON.parse(await readFile(cataloguePath, "utf8")));
    safeSummary({ result: checked.issues.length ? "MAPPING_INVALID" : "MAPPING_VALID", entryCount: checked.catalogue?.entries.length ?? 0, issues: checked.issues });
    if (checked.issues.length) process.exitCode = 1; return;
  }
  if (command === "synthetic") {
    const output = path.resolve(argument("--output") ?? path.join(workspace, "tmp", "real-data-onboarding-preparation-1a", "synthetic-package"));
    const generated = await createSyntheticPackage(output, { students: Number(argument("--students") ?? 120), guardians: Number(argument("--guardians") ?? 160), staff: Number(argument("--staff") ?? 30), adversarial: process.argv.includes("--adversarial") });
    safeSummary({ result: "SYNTHETIC_PACKAGE_CREATED", packageId: generated.manifest.packageId, counts: generated.counts }); return;
  }
  const packageInput = argument("--package") ?? positional(0);
  if (!packageInput) throw new Error("PACKAGE_PATH_REQUIRED");
  const packageRoot = path.resolve(packageInput);
  if (command === "review-draft") {
    const mappingPath = argument("--mapping"), output = argument("--output"), bundle = argument("--bundle");
    if (!mappingPath || !output || !isOnboardingBundle(bundle)) throw new Error("REVIEW_EXPLICIT_PATHS_REQUIRED");
    safeSummary(await writeGovernedReviewDraft({ packageRoot, mappingPath, output, bundle })); return;
  }
  if (command === "package-validate") {
    const result = await validatePackage(packageRoot); safeSummary({ result: result.issues.some((item) => item.severity === "ERROR") ? "PACKAGE_INVALID" : "PACKAGE_VALID", fileCount: result.tables.length, rowCount: result.tables.reduce((sum, table) => sum + table.rows.length, 0), issueCounts: { errors: result.issues.filter((item) => item.severity === "ERROR").length, review: result.issues.filter((item) => item.severity === "REVIEW").length } }); if (result.issues.some((item) => item.severity === "ERROR")) process.exitCode = 1; return;
  }
  if (command === "dry-run" || command === "report") {
    const catalogue = await loadMappingCatalogue(cataloguePath); const result = await dryRunPackage(packageRoot, catalogue); const output = argument("--output");
    if (output) { const resolvedOutput = path.resolve(output), packagePrefix = packageRoot.endsWith(path.sep) ? packageRoot : `${packageRoot}${path.sep}`; if (resolvedOutput === packageRoot || resolvedOutput.startsWith(packagePrefix)) throw new Error("REPORT_OUTPUT_INSIDE_SOURCE_PACKAGE_REFUSED"); await writeDryRunReports(resolvedOutput, result); }
    safeSummary({ result: result.validationState, rowsReceived: result.rowsReceived, rowsAcceptedForReview: result.rowsAcceptedForReview, errors: result.issues.filter((item) => item.severity === "ERROR").length, reviewItems: result.issues.filter((item) => item.severity === "REVIEW").length, duplicateCandidates: result.duplicates.length, mappedFields: result.mappedFields, unmappedFields: result.unmappedFields, authoritativeWrites: result.noWriteProof.authoritativeWriteCount, sourceMutation: result.packageDigest !== result.sourceDigestAfter, reportsWritten: Boolean(output) });
    if (result.issues.some((item) => item.severity === "ERROR")) process.exitCode = 2; return;
  }
  throw new Error("COMMAND_REQUIRED");
}

main().catch((error) => { const prefix = error instanceof Error ? error.message.split(":", 1)[0] : ""; const code = /^[A-Z][A-Z0-9_]{2,80}$/.test(prefix) ? prefix : "ONBOARDING_PREPARATION_FAILED"; process.stderr.write(`${code}\n`); process.exitCode = 1; });
