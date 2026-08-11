import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../lib/prisma";
import {
  renderR41EdgePack,
  renderR41VisualPack,
  resolveReportSchoolIdentity
} from "../lib/report-card-refined-source-lock";
import { requireRenderedPdfPagesMonochrome } from "../lib/report-card-monochrome-validation";
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
  const visualPack = await renderR41VisualPack(identity);
  const edgePack = await renderR41EdgePack(identity);

  await mkdir(outputRoot, { recursive: true });
  const visualPath = path.join(outputRoot, "VISUAL-DIRECTION-PACK-R4-1.pdf");
  const edgePath = path.join(outputRoot, "EDGE-CASE-RENDERING-PACK-R4-1.pdf");
  await Promise.all([
    writeFile(visualPath, visualPack),
    writeFile(edgePath, edgePack)
  ]);
  const visualMonochrome = await requireRenderedPdfPagesMonochrome(visualPack, [3, 4]);
  const edgeMonochrome = await requireRenderedPdfPagesMonochrome(edgePack, [3, 4]);
  await Promise.all([
    writeFile(
      path.join(outputRoot, "pack-manifest-r4-1.json"),
      JSON.stringify({
        status: "R4_1_FINAL_NUMERICAL_MONOCHROME_USER_REVIEW_PENDING",
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
            file: "VISUAL-DIRECTION-PACK-R4-1.pdf",
            pages: 4,
            syntheticOnly: true,
            physicalPrintingAuthorised: false,
            monochromePageChecks: visualMonochrome
          },
          {
            file: "EDGE-CASE-RENDERING-PACK-R4-1.pdf",
            pages: 4,
            syntheticOnly: true,
            physicalPrintingAuthorised: false,
            monochromePageChecks: edgeMonochrome
          }
        ],
        fullPackRegenerated: false,
        sourcePagesIncluded: false,
        operationalDataReadOnly: true
      }, null, 2) + "\n"
    ),
    writeFile(
      path.join(outputRoot, "REVIEW-INSTRUCTIONS-R4-1.txt"),
      [
        "R4.1 FINAL NUMERICAL AND TRUE-MONOCHROME REVIEW - SYNTHETIC DATA ONLY",
        "",
        "VISUAL-DIRECTION-PACK-R4-1.pdf is the four-page micro-review pack.",
        "EDGE-CASE-RENDERING-PACK-R4-1.pdf is separate grouped-result, cohort, state, and wrapping evidence.",
        "NALANDA_LEGACY_REFINED is the selected structural direction.",
        "LEGACY_EXACT remains historical local comparison evidence only.",
        "Do not print either pack yet.",
        "Full colour and monochrome pack generation remains paused."
      ].join("\r\n")
    )
  ]);

  process.stdout.write(JSON.stringify({
    outputRoot,
    visualPages: 4,
    edgePages: 4,
    visualMonochrome,
    edgeMonochrome,
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
