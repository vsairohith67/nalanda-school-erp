import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../lib/prisma";
import {
  renderR3EdgePack,
  renderR3VisualPack,
  resolveReportSchoolIdentity
} from "../lib/report-card-refined-source-lock";
import { getSchoolSettings } from "../lib/school-settings";

const outputRoot = path.resolve(process.cwd(), ".codex", "report-print-accept-1a", "source-fidelity");

async function main() {
  const settings = await getSchoolSettings(prisma);
  const activeTemplates = await prisma.reportCardTemplate.findMany({
    where: { status: "ACTIVE" },
    select: { templateDefinitionJson: true }
  });
  const approvedDefinitions = activeTemplates.map((row) => JSON.parse(row.templateDefinitionJson));
  const identity = resolveReportSchoolIdentity(settings, approvedDefinitions);
  const visualPack = await renderR3VisualPack(identity);
  const edgePack = await renderR3EdgePack(identity);

  await mkdir(outputRoot, { recursive: true });
  await Promise.all([
    writeFile(path.join(outputRoot, "VISUAL-DIRECTION-PACK-R3.pdf"), visualPack),
    writeFile(path.join(outputRoot, "EDGE-CASE-RENDERING-PACK-R3.pdf"), edgePack),
    writeFile(
      path.join(outputRoot, "pack-manifest-r3.json"),
      JSON.stringify({
        status: "REFINED_SOURCE_LOCK_USER_REVIEW_PENDING",
        productionFamilies: [
          "NALANDA_LEGACY_REFINED_COLOUR",
          "NALANDA_LEGACY_REFINED_MONOCHROME"
        ],
        comparisonOnlyDirection: "LEGACY_EXACT",
        generatedAt: new Date().toISOString(),
        schoolIdentity: {
          schoolName: identity.schoolName,
          address: [identity.addressLine1, identity.city].filter(Boolean),
          academicYear: identity.academicYear,
          motto: identity.motto,
          affiliationWordingConfigured: Boolean(identity.affiliationWording),
          recognitionWordingConfigured: Boolean(identity.recognitionWording),
          establishmentYearConfigured: Boolean(identity.establishmentYear),
          logo: identity.logoPath
        },
        packs: [
          {
            file: "VISUAL-DIRECTION-PACK-R3.pdf",
            pages: 10,
            syntheticOnly: true,
            physicalPrintingAuthorised: false
          },
          {
            file: "EDGE-CASE-RENDERING-PACK-R3.pdf",
            pages: 8,
            syntheticOnly: true,
            physicalPrintingAuthorised: false
          }
        ],
        fullPackRegenerated: false,
        sourcePagesIncluded: false,
        operationalDataReadOnly: true
      }, null, 2) + "\n"
    ),
    writeFile(
      path.join(outputRoot, "REVIEW-INSTRUCTIONS-R3.txt"),
      [
        "R3 REFINED SOURCE-LOCK REVIEW - SYNTHETIC DATA ONLY",
        "",
        "VISUAL-DIRECTION-PACK-R3.pdf is the ten-page design review pack.",
        "EDGE-CASE-RENDERING-PACK-R3.pdf is separate wrapping and state evidence.",
        "NALANDA_LEGACY_REFINED is the selected structural direction.",
        "LEGACY_EXACT remains historical local comparison evidence only.",
        "Do not print either pack yet.",
        "Full colour and monochrome pack generation remains paused."
      ].join("\r\n")
    )
  ]);

  process.stdout.write(JSON.stringify({
    outputRoot,
    visualPages: 10,
    edgePages: 8,
    productionFamilies: [
      "NALANDA_LEGACY_REFINED_COLOUR",
      "NALANDA_LEGACY_REFINED_MONOCHROME"
    ],
    physicalPrintingAuthorised: false,
    fullPackRegenerated: false
  }, null, 2));
}

main()
  .catch((error) => {
    process.stderr.write((error instanceof Error ? error.stack || error.message : String(error)) + "\n");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
