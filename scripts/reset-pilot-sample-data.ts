import { prisma } from "../lib/prisma";
import { resetPilotSampleData } from "../lib/pilot-reset-sample-data";

resetPilotSampleData(prisma, process.env.DATABASE_URL)
  .then((summary) => {
    console.log("Pilot sample data reset complete.");
    console.log(`Payment audits removed: ${summary.paymentAudits}`);
    console.log(`Payments removed: ${summary.payments}`);
    console.log(`Receipt notes removed: ${summary.receiptNotes}`);
    console.log(`Students removed: ${summary.students}`);
    console.log(`Sample import batches removed: ${summary.importBatches}`);
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
