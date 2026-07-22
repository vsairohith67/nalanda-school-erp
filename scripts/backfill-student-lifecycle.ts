import { prisma } from "../lib/prisma";
import { backfillCurrentAcademicYearEnrollments } from "../lib/student-lifecycle";

async function main() {
  const apply = process.argv.includes("--apply");
  const yearArg = process.argv.find((arg) => arg.startsWith("--academic-year="));
  const academicYear = yearArg?.slice("--academic-year=".length);
  const result = await backfillCurrentAcademicYearEnrollments(prisma, { apply, academicYear });
  console.log(`${apply ? "APPLY" : "DRY RUN"}: academic year ${result.academicYear}`);
  console.log(`Active students scanned: ${result.scanned}`);
  console.log(`Already enrolled: ${result.alreadyPresent}`);
  console.log(`Missing enrollments: ${result.missing}`);
  console.log(`Created enrollments and ENROLLED events: ${result.created}`);
  if (!apply && result.missing > 0) console.log("No data changed. Review this result, then run: pnpm.cmd lifecycle:backfill -- --apply");
  if (!apply && result.missing === 0) console.log("No data changed. All active students already have an enrollment for this academic year.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Lifecycle backfill failed");
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
