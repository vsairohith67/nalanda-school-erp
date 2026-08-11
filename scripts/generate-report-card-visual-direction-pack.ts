import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../lib/prisma";
import {
  renderR4EdgePack,
  renderR4VisualPack,
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
  const visualPack = await renderR4VisualPack(identity);
  const edgePack = await renderR4EdgePack(identity);

  await mkdir(outputRoot, { recursive: true });
  await Promise.all([
    writeFile(path.join(outputRoot, "VISUAL-DIRECTION-PACK-R4.pdf"), visualPack),
    writeFile(path.join(outputRoot, "EDGE-CASE-RENDERING-PACK-R4.pdf"), edgePack),
    writeFile(
      path.join(outputRoot, "pack-manifest-r4.json"),
      JSON.stringify({
        status: "R4_FINAL_PRE_PRINT_CORRECTION_USER_REVIEW_PENDING",
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
            file: "VISUAL-DIRECTION-PACK-R4.pdf",
            pages: 8,
            syntheticOnly: true,
            physicalPrintingAuthorised: false
          },
          {
            file: "EDGE-CASE-RENDERING-PACK-R4.pdf",
            pages: 4,
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
      path.join(outputRoot, "REVIEW-INSTRUCTIONS-R4.txt"),
      [
        "R4 FINAL PRE-PRINT CORRECTION REVIEW - SYNTHETIC DATA ONLY",
        "",
        "VISUAL-DIRECTION-PACK-R4.pdf is the eight-page design review pack.",
        "EDGE-CASE-RENDERING-PACK-R4.pdf is separate long-name and AB/EX/NE/NA evidence.",
        "NALANDA_LEGACY_REFINED is the selected structural direction.",
        "LEGACY_EXACT remains historical local comparison evidence only.",
        "Do not print either pack yet.",
        "Full colour and monochrome pack generation remains paused."
      ].join("\r\n")
    )
  ]);

  process.stdout.write(JSON.stringify({
    outputRoot,
    visualPages: 8,
    edgePages: 4,
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
