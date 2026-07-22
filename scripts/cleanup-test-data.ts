import { prisma } from "../lib/prisma";
import {
  cleanupTestData,
  TEST_DATA_CLEANUP_CONFIRMATION,
  type CleanupCandidate,
  type ManualReviewItem
} from "../lib/test-data-cleanup";

type ParsedArgs = {
  apply: boolean;
  dryRun: boolean;
  receipts: string[];
  prefixes: string[];
  confirm?: string;
};

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = { apply: false, dryRun: false, receipts: [], prefixes: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") continue;
    if (arg === "--apply") parsed.apply = true;
    else if (arg === "--dry-run") parsed.dryRun = true;
    else if (arg === "--receipt") parsed.receipts.push(requireValue(argv, ++index, "--receipt"));
    else if (arg === "--prefix") parsed.prefixes.push(requireValue(argv, ++index, "--prefix"));
    else if (arg === "--confirm") parsed.confirm = requireValue(argv, ++index, "--confirm");
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  if (parsed.apply && parsed.dryRun) throw new Error("Choose either --dry-run or --apply, not both.");
  if (!parsed.apply) parsed.dryRun = true;
  if (!parsed.receipts.length && !parsed.prefixes.length) {
    throw new Error("Add at least one --receipt or --prefix selector.");
  }
  return parsed;
}

function requireValue(argv: string[], index: number, flag: string) {
  const value = argv[index];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value.`);
  return value;
}

function printHelp() {
  console.log("Nalanda test-data cleanup");
  console.log("");
  console.log("Dry-run examples:");
  console.log("  pnpm.cmd qa:cleanup -- --dry-run --receipt QA10C-0056");
  console.log("  pnpm.cmd qa:cleanup -- --dry-run --prefix QA");
  console.log("");
  console.log("Apply examples:");
  console.log(`  pnpm.cmd qa:cleanup -- --apply --receipt QA10C-0056 --confirm ${TEST_DATA_CLEANUP_CONFIRMATION}`);
  console.log(`  pnpm.cmd qa:cleanup -- --apply --prefix QA --confirm ${TEST_DATA_CLEANUP_CONFIRMATION}`);
}

function printCandidates(title: string, rows: CleanupCandidate[]) {
  console.log("");
  console.log(`${title}: ${rows.length}`);
  if (!rows.length) return;
  rows.forEach((row) => {
    console.log(`- ${row.label}`);
    console.log(`  Reason: ${row.reason}`);
  });
}

function printManualReview(rows: ManualReviewItem[]) {
  console.log("");
  console.log(`Needs manual review / skipped: ${rows.length}`);
  rows.forEach((row) => {
    console.log(`- ${row.scope}: ${row.label}`);
    console.log(`  Reason: ${row.reason}`);
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log(args.apply ? "APPLY MODE: deleting only the safe records listed below." : "DRY RUN ONLY: no records will be changed.");
  console.log("This utility is only for QA/demo/test records. Do not use it to correct real fee mistakes.");
  const result = await cleanupTestData(prisma, {
    receipts: args.receipts,
    prefixes: args.prefixes,
    apply: args.apply,
    confirm: args.confirm,
    databaseUrl: process.env.DATABASE_URL,
    environment: process.env
  });
  const { preview } = result;
  if (Object.values(preview.totals).every((count) => count === 0)) {
    console.log("");
    console.log("No test data matched. Nothing changed.");
    printManualReview(preview.manualReview);
    return;
  }

  printCandidates("Payments", preview.payments);
  printCandidates("Payment audits", preview.paymentAudits);
  printCandidates("Receipt notes", preview.receiptNotes);
  printCandidates("Import batches", preview.importBatches);
  printCandidates("QA/demo students", preview.students);
  printManualReview(preview.manualReview);

  console.log("");
  if (!args.apply) {
    console.log("Dry-run complete. Review the list above before applying cleanup.");
    console.log(`To apply, rerun with --apply --confirm ${TEST_DATA_CLEANUP_CONFIRMATION}.`);
    return;
  }

  console.log("Cleanup applied.");
  console.log(`Payment audits removed: ${result.deleted.paymentAudits}`);
  console.log(`Payments removed: ${result.deleted.payments}`);
  console.log(`Receipt notes removed: ${result.deleted.receiptNotes}`);
  console.log(`Import batches removed: ${result.deleted.importBatches}`);
  console.log(`QA/demo students removed: ${result.deleted.students}`);
  console.log("Run pnpm.cmd backup now to save the cleaned state.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
