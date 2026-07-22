import Link from "next/link";
import { PilotAcceptance } from "@/components/pilot-acceptance";
import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isPilotDatabaseUrl } from "@/lib/pilot";
import { PILOT_SAMPLE_IMPORT_FILES } from "@/lib/pilot-sample-constants";

export default async function PilotAcceptancePage() {
  const user = await requirePermission("RUN_PILOT_ACCEPTANCE");
  const [recentSampleImportBatches, sampleStudentCount, samplePaymentCount] = await Promise.all([
    prisma.importBatch.findMany({
      where: { fileName: { in: [...PILOT_SAMPLE_IMPORT_FILES] } },
      orderBy: { importedAt: "desc" },
      take: 6,
      select: {
        id: true,
        type: true,
        fileName: true,
        importedByName: true,
        importedAt: true,
        mode: true,
        status: true,
        totalRows: true,
        createdCount: true,
        updatedCount: true,
        skippedCount: true,
        errorCount: true,
        warningCount: true
      }
    }),
    prisma.student.count({ where: { admissionNo: { startsWith: "PILOT-" } } }),
    prisma.payment.count({ where: { receiptNo: { startsWith: "PILOT-" }, deletedAt: null } })
  ]);
  const databaseMode = isPilotDatabaseUrl(process.env.DATABASE_URL) ? "PILOT" : "NORMAL";

  return (
    <div className="page">
      <PageHeader
        title="Pilot Acceptance"
        description="Guided acceptance checks and read-only collection reconciliation for larger real-data testing."
        action={<Link className="button secondary" href="/import-verification">Open Import Verification</Link>}
      />
      <section className="notice no-print">
        Complete these checks on the copied pilot database. Capture permanent evidence in the Pilot QA Report before sign-off.
      </section>
      <PilotAcceptance
        currentUserName={user.name}
        currentUserRole={user.role}
        databaseMode={databaseMode}
        sampleModeDetected={databaseMode === "PILOT" || sampleStudentCount > 0 || samplePaymentCount > 0 || recentSampleImportBatches.length > 0}
        recentSampleImportBatches={recentSampleImportBatches.map((batch) => ({
          ...batch,
          importedAt: batch.importedAt.toISOString()
        }))}
      />
    </div>
  );
}
