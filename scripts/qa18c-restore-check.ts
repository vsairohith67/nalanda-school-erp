import { prisma } from "../lib/prisma";
import { restoreIdentityCardData } from "../lib/restore-database";
import { emptyEntityResult } from "../lib/restore";

function resultSet() {
  return {
    identityCardNumberSeries: emptyEntityResult(),
    identityCardTemplates: emptyEntityResult(),
    identityCardBatches: emptyEntityResult(),
    identityCards: emptyEntityResult(),
    identityCardVersions: emptyEntityResult(),
    identityCardEvents: emptyEntityResult(),
    warnings: [] as string[]
  };
}

function summarize(result: ReturnType<typeof resultSet>) {
  const entityKeys = Object.keys(result).filter((key) => key !== "warnings") as Array<
    Exclude<keyof typeof result, "warnings">
  >;
  return {
    created: entityKeys.reduce((sum, key) => sum + result[key].created, 0),
    updated: entityKeys.reduce((sum, key) => sum + result[key].updated, 0),
    skipped: entityKeys.reduce((sum, key) => sum + result[key].skipped, 0),
    errors: entityKeys.flatMap((key) => result[key].errors),
    warnings: result.warnings,
    byEntity: Object.fromEntries(
      entityKeys.map((key) => [
        key,
        {
          created: result[key].created,
          updated: result[key].updated,
          skipped: result[key].skipped,
          errors: result[key].errors.length
        }
      ])
    )
  };
}

async function main() {
  const qaCards = await prisma.identityCard.findMany({
    where: { cardNumber: { startsWith: "QA18C-" } },
    select: { id: true, studentId: true }
  });
  const cardIds = qaCards.map((row) => row.id);
  const studentIds = [...new Set(qaCards.flatMap((row) => (row.studentId ? [row.studentId] : [])))];
  const backupStudentLocalIds = new Map(studentIds.map((id) => [id, id]));

  const backup = {
    staffMembers: await prisma.staffMember.findMany({ where: { staffCode: { startsWith: "QA18C-" } } }),
    identityCardNumberSeries: await prisma.identityCardNumberSeries.findMany({
      where: { seriesCode: { startsWith: "QA18C-" } }
    }),
    identityCardTemplates: await prisma.identityCardTemplate.findMany({
      where: { templateCode: { startsWith: "QA18C-" } }
    }),
    identityCardBatches: await prisma.identityCardBatch.findMany({
      where: {
        OR: [
          { batchNumber: { startsWith: "QA18C-" } },
          { notes: { contains: "QA18C" } }
        ]
      }
    }),
    identityCards: await prisma.identityCard.findMany({ where: { id: { in: cardIds } } }),
    identityCardVersions: await prisma.identityCardVersion.findMany({
      where: { identityCardId: { in: cardIds } },
      orderBy: [{ identityCardId: "asc" }, { versionNumber: "asc" }]
    }),
    identityCardEvents: await prisma.identityCardEvent.findMany({
      where: {
        OR: [
          { identityCardId: { in: cardIds } },
          { batch: { notes: { contains: "QA18C" } } }
        ]
      },
      orderBy: { createdAt: "asc" }
    })
  };

  const attempts = [];
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const result = resultSet();
    await restoreIdentityCardData(
      prisma,
      backup as never,
      backupStudentLocalIds,
      result
    );
    attempts.push({ attempt, ...summarize(result) });
  }

  console.log(JSON.stringify({
    backupCounts: {
      numberSeries: backup.identityCardNumberSeries.length,
      templates: backup.identityCardTemplates.length,
      batches: backup.identityCardBatches.length,
      cards: backup.identityCards.length,
      versions: backup.identityCardVersions.length,
      events: backup.identityCardEvents.length
    },
    attempts
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
