import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { AuthUser } from "@/lib/auth";
import { currentReportCalendarBasis } from "@/lib/academic-calendar";
import {
  GOVERNED_REPORT_TEMPLATE_FAMILIES,
  REPORT_PUBLICATION_SCHEMA_VERSION,
  type GovernedReportTemplateFamily,
  type PublishedReportSnapshot,
  type ReportPublicationScope,
  reportTypeForFamily,
  safePublishedReportSnapshot
} from "@/lib/report-publication-types";
import { isCombinedVariant } from "@/lib/report-card-canonical-templates";
import { isKgReportCardOperationallyAvailable, KG_REPORT_CARD_DEFERRED_MESSAGE } from "@/lib/report-card-release-policy";

type PublicationClient = PrismaClient | any;
type PublicationActor = Pick<AuthUser, "id" | "name" | "role">;

const MAX_PUBLICATION_RUNS = 10;
export const MAX_REPORT_PUBLICATION_BATCH = 60;

export class ReportPublicationError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "REPORT_PUBLICATION_ERROR"
  ) {
    super(message);
    this.name = "ReportPublicationError";
  }
}

type PreviewInput = {
  calculationRunIds: string[];
  scope: ReportPublicationScope;
  studentIds: string[];
  studentAdmissionNumbers: string[];
};

type ResolvedSource = {
  snapshots: any[];
  cohortPaperStats: Map<string, { average: string; highest: string }>;
  bindings: Map<string, any>;
  lockEvents: Map<string, any>;
  examination: any;
  school: any;
  scope: ReportPublicationScope;
};

export async function loadReportPublicationReadiness(client: PublicationClient) {
  const snapshots = await client.studentResultSnapshot.findMany({
    include: {
      examination: { select: { examCode: true, name: true, academicYear: true } },
      classScope: { select: { id: true, className: true, section: true } },
      student: { select: { admissionNo: true } }
    },
    orderBy: [{ calculatedAt: "desc" }, { studentId: "asc" }]
  });
  const runIds = [...new Set(snapshots.map((row: any) => row.calculationRunId))];
  if (!runIds.length) return { runs: [], summary: emptyReadinessSummary() };
  const [events, bindings] = await Promise.all([
    client.examinationSchemeAudit.findMany({
      where: {
        targetType: "EXAM_CALCULATION_RUN",
        targetId: { in: runIds },
        eventType: {
          in: ["CALCULATION_SNAPSHOT_LOCKED", "CALCULATION_SNAPSHOT_SUPERSEDED"]
        }
      },
      orderBy: { eventDate: "desc" }
    }),
    client.examTemplateFamilyBinding.findMany({
      where: {
        classScopeId: { in: [...new Set(snapshots.map((row: any) => row.classScopeId))] }
      },
      include: { reportCardTemplate: true },
      orderBy: { versionNumber: "desc" }
    })
  ]);
  const grouped = new Map<string, any[]>();
  snapshots.forEach((snapshot: any) => {
    const rows = grouped.get(snapshot.calculationRunId) ?? [];
    rows.push(snapshot);
    grouped.set(snapshot.calculationRunId, rows);
  });
  const runs = [...grouped.entries()].map(([runId, rows]) => {
    const first = rows[0];
    const lock = events.find(
      (event: any) =>
        event.targetId === runId &&
        event.eventType === "CALCULATION_SNAPSHOT_LOCKED"
    );
    const superseded = events.find(
      (event: any) =>
        event.targetId === runId &&
        event.eventType === "CALCULATION_SNAPSHOT_SUPERSEDED"
    );
    const binding = bindings.find(
      (row: any) =>
        row.classScopeId === first.classScopeId &&
        row.status === "ACTIVE" &&
        row.frozenAt
    );
    const blockers = runBlockers(rows, lock, superseded, binding);
    return {
      id: runId,
      runReference: publicRunReference(runId),
      runNumber: first.runNumber,
      examination: first.examination,
      classScope: first.classScope,
      studentCount: rows.length,
      snapshotVersions: [...new Set(rows.map((row: any) => row.snapshotVersion))],
      templateFamily: binding?.templateFamily ?? null,
      templateVersion: binding?.versionNumber ?? null,
      lockedAt: lock?.eventDate?.toISOString?.() ?? null,
      supersededAt: superseded?.eventDate?.toISOString?.() ?? null,
      status: blockers.length ? ("BLOCKED" as const) : ("READY" as const),
      blockers
    };
  });
  return {
    runs,
    summary: {
      total: runs.length,
      ready: runs.filter((run) => run.status === "READY").length,
      blocked: runs.filter((run) => run.status === "BLOCKED").length,
      locked: runs.filter((run) => run.lockedAt).length,
      superseded: runs.filter((run) => run.supersededAt).length
    }
  };
}

export async function previewReportPublication(
  client: PublicationClient,
  rawInput: unknown,
  actor?: PublicationActor,
  now = new Date()
) {
  const input = publicationInput(rawInput);
  const resolved = await resolvePublicationSource(client, input);
  const bundles = await buildPublicationBundles(client, resolved, actor ?? null, now);
  const fingerprint = publicationPreviewFingerprint(bundles);
  const configurationWarnings = bundles.flatMap((report) =>
    report.templateFamily !== "KG_DEVELOPMENTAL_BOOKLET" && !approvedPublicationStatusLine(report)
      ? ["Approved report-card status line is missing. Final publication remains blocked until school leadership completes the configuration."]
      : []
  );
  return {
    fingerprint,
    scope: input.scope,
    count: bundles.length,
    templateFamily: bundles[0].templateFamily,
    className: bundles[0].student.className,
    sections: [...new Set(bundles.map((bundle) => bundle.student.section ?? ""))],
    configurationWarnings: [...new Set(configurationWarnings)],
    reports: bundles.map((bundle) =>
      safePublishedReportSnapshot({
        ...bundle,
        governance: { ...bundle.governance, previewFingerprint: fingerprint }
      })
    ),
    internalReports: bundles.map((bundle) => ({
      ...bundle,
      governance: { ...bundle.governance, previewFingerprint: fingerprint }
    }))
  };
}

export async function publishReportCards(
  client: PublicationClient,
  rawInput: unknown,
  actor: PublicationActor,
  now = new Date()
) {
  if (actor.role !== "PRINCIPAL" && actor.role !== "DIRECTOR" && actor.role !== "SUPER_ADMIN") {
    throw new ReportPublicationError(
      "Only governed school leadership may publish report cards.",
      403,
      "PUBLICATION_ROLE_REQUIRED"
    );
  }
  const row = object(rawInput, "Publication request");
  const requestKey = boundedRequestKey(row.requestKey);
  const expectedFingerprint = boundedHash(row.previewFingerprint, "Preview fingerprint");
  const preview = await previewReportPublication(client, row, actor, now);
  const missingStatusLine = preview.internalReports.some((report) =>
    report.templateFamily !== "KG_DEVELOPMENTAL_BOOKLET" && !approvedPublicationStatusLine(report)
  );
  if (missingStatusLine) {
    throw new ReportPublicationError(
      "Final report publication is blocked until school leadership configures the approved report-card status line.",
      409,
      "REPORT_CARD_STATUS_LINE_REQUIRED"
    );
  }
  if (preview.fingerprint !== expectedFingerprint) {
    throw new ReportPublicationError(
      "The exact preview changed. Review the refreshed report before publishing.",
      409,
      "EXPECTED_VERSION_CONFLICT"
    );
  }
  const requestHash = hashText(requestKey);
  const batchNumber = `EXAM3-PUB-${requestHash.slice(0, 16)}`;
  const existing = await client.reportCardBatch.findUnique({
    where: { batchNumber },
    include: { reportCards: { include: { versions: true } } }
  });
  if (existing) {
    const metadata = parseJson(existing.templateSnapshotJson, "Stored publication metadata");
    if (metadata?.publication?.requestHash !== requestHash) {
      throw new ReportPublicationError(
        "The publication request key is already in use.",
        409,
        "IDEMPOTENCY_KEY_CONFLICT"
      );
    }
    return publicPublicationResult(existing, true);
  }
  const reports = preview.internalReports as PublishedReportSnapshot[];
  const first = reports[0];
  const bindingTemplateId = await templateIdForPreview(client, first);
  const batchSnapshot = {
    publicationSchemaVersion: REPORT_PUBLICATION_SCHEMA_VERSION,
    reportType: first.reportType,
    definition: first.template.definition,
    gradingScheme: { bands: first.content.legends },
    publication: {
      requestHash,
      previewFingerprint: preview.fingerprint,
      scope: preview.scope,
      calculationRunReferences: [
        ...new Set(reports.map((report) => report.governance.calculationRunReference))
      ],
      templateFamily: first.templateFamily,
      templateVersion: first.template.version,
      templateBindingVersion: first.template.bindingVersion,
      publishedAt: now.toISOString()
    }
  };
  const sectionValues = [...new Set(reports.map((report) => report.student.section ?? ""))];
  try {
    const batch = await client.$transaction(async (tx: any) => {
      const createdBatch = await tx.reportCardBatch.create({
        data: {
          batchNumber,
          academicYear: first.academicYear,
          reportType: first.reportType,
          templateId: bindingTemplateId,
          className: first.student.className,
          section: sectionValues.length === 1 ? sectionValues[0] || null : null,
          title: first.title,
          reportingPeriod: first.reportingPeriod,
          status: "ISSUED",
          templateSnapshotJson: JSON.stringify(batchSnapshot),
          createdByUserId: actor.id,
          approvedByUserId: actor.id,
          issuedByUserId: actor.id,
          approvedAt: now,
          issuedAt: now
        }
      });
      for (const report of reports) {
        const calendarBasis = await currentReportCalendarBasis(tx, { academicYear: report.academicYear, className: report.student.className, section: report.student.section });
        const issuedReport: PublishedReportSnapshot = {
          ...report,
          status: "ISSUED",
          versionNumber: 1,
          issueDate: now.toISOString(),
          governance: {
            ...report.governance,
            previewFingerprint: preview.fingerprint,
            publishedByLabel: actor.name
          }
        };
        const card = await tx.studentReportCard.create({
          data: {
            reportCardNumber: report.reportCardNumber,
            batchId: createdBatch.id,
            studentId: report.governance.internal.resultSnapshotId
              ? await studentIdForSnapshot(tx, report.governance.internal.resultSnapshotId)
              : "",
            academicYear: report.academicYear,
            className: report.student.className,
            section: report.student.section,
            reportType: report.reportType,
            status: "ISSUED",
            currentVersionNumber: 1,
            draftDataJson: JSON.stringify({
              kind: report.reportType,
              publicationSchemaVersion: REPORT_PUBLICATION_SCHEMA_VERSION,
              previewFingerprint: preview.fingerprint
            }),
            finalGrade: report.content.grade?.code ?? null,
            createdByUserId: actor.id,
            approvedByUserId: actor.id,
            issuedByUserId: actor.id,
            approvedAt: now,
            issuedAt: now
          }
        });
        const version = await tx.studentReportCardVersion.create({
          data: {
            reportCardId: card.id,
            versionNumber: 1,
            versionType: "ORIGINAL",
            snapshotJson: JSON.stringify(issuedReport),
            issuedAt: now,
            issuedByUserId: actor.id,
            ...calendarBasis
          }
        });
        await tx.studentReportCardEvent.createMany({
          data: [
            {
              reportCardId: card.id,
              eventType: "CARD_CREATED",
              eventDate: now,
              newStatus: "DRAFT",
              recordedByUserId: actor.id,
              actorLabel: actor.name,
              notes: safeAuditJson({
                requestHash,
                previewFingerprint: preview.fingerprint,
                sourceRunReference: report.governance.calculationRunReference
              })
            },
            {
              reportCardId: card.id,
              versionId: version.id,
              eventType: "PUBLICATION_ISSUED",
              eventDate: now,
              previousStatus: "DRAFT",
              newStatus: "ISSUED",
              recordedByUserId: actor.id,
              actorLabel: actor.name,
              notes: safeAuditJson({
                publicationReference: report.publicationReference,
                templateVersion: report.template.version,
                resultSnapshotVersion: report.governance.resultSnapshotVersion
              })
            }
          ]
        });
      }
      return tx.reportCardBatch.findUniqueOrThrow({
        where: { id: createdBatch.id },
        include: {
          reportCards: {
            include: { versions: { orderBy: { versionNumber: "asc" } } }
          }
        }
      });
    });
    return publicPublicationResult(batch, false);
  } catch (error: any) {
    if (error?.code === "P2002") {
      const duplicate = await client.reportCardBatch.findUnique({
        where: { batchNumber },
        include: { reportCards: { include: { versions: true } } }
      });
      if (duplicate) return publicPublicationResult(duplicate, true);
    }
    throw error;
  }
}

export function approvedPublicationStatusLine(report: PublishedReportSnapshot) {
  return [
    report.school.affiliationWording,
    report.school.recognitionWording,
    report.school.establishmentYear ? `Established ${report.school.establishmentYear}` : null
  ].filter((value): value is string => Boolean(String(value ?? "").trim())).join("  •  ") || null;
}

export async function withdrawPublishedReport(
  client: PublicationClient,
  rawInput: unknown,
  actor: PublicationActor,
  now = new Date()
) {
  const row = object(rawInput, "Withdrawal request");
  const reportCardNumber = boundedReference(row.reportCardNumber, "Report-card reference");
  const reason = boundedReason(row.reason, "Withdrawal reason");
  const expectedVersion = positiveInteger(row.expectedVersion, "Expected version");
  const expectedUpdatedAt = validDate(row.expectedUpdatedAt, "Expected report-card version");
  return client.$transaction(async (tx: any) => {
    const card = await tx.studentReportCard.findUnique({
      where: { reportCardNumber },
      include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } }
    });
    if (!card || !card.versions[0]) {
      throw new ReportPublicationError("Issued report card was not found.", 404);
    }
    if (card.status === "WITHDRAWN") return publicCardState(card, "WITHDRAWN");
    if (card.status !== "ISSUED" || card.currentVersionNumber !== expectedVersion) {
      throw new ReportPublicationError(
        "The issued version changed. Reload before withdrawing.",
        409,
        "EXPECTED_VERSION_CONFLICT"
      );
    }
    const changed = await tx.studentReportCard.updateMany({
      where: {
        id: card.id,
        status: "ISSUED",
        currentVersionNumber: expectedVersion,
        updatedAt: expectedUpdatedAt
      },
      data: {
        status: "WITHDRAWN",
        cancellationReason: reason,
        cancelledAt: now,
        cancelledByUserId: actor.id
      }
    });
    if (changed.count !== 1) {
      throw new ReportPublicationError(
        "The report changed in another session. Reload before withdrawing.",
        409,
        "EXPECTED_VERSION_CONFLICT"
      );
    }
    await tx.studentReportCardEvent.create({
      data: {
        reportCardId: card.id,
        versionId: card.versions[0].id,
        eventType: "PUBLICATION_WITHDRAWN",
        eventDate: now,
        previousStatus: "ISSUED",
        newStatus: "WITHDRAWN",
        reason,
        recordedByUserId: actor.id,
        actorLabel: actor.name
      }
    });
    return publicCardState(
      await tx.studentReportCard.findUniqueOrThrow({ where: { id: card.id } }),
      "WITHDRAWN"
    );
  });
}

export async function replacePublishedReport(
  client: PublicationClient,
  rawInput: unknown,
  actor: PublicationActor,
  now = new Date()
) {
  const row = object(rawInput, "Replacement request");
  const reportCardNumber = boundedReference(row.reportCardNumber, "Report-card reference");
  const reason = boundedReason(row.reason, "Replacement reason");
  const requestKey = boundedRequestKey(row.requestKey);
  const expectedVersion = positiveInteger(row.expectedVersion, "Expected version");
  const expectedUpdatedAt = validDate(row.expectedUpdatedAt, "Expected report-card version");
  const current = await client.studentReportCard.findUnique({
    where: { reportCardNumber },
    include: {
      student: {
        include: {
          guardians: {
            include: { guardian: true },
            orderBy: [{ isPrimaryContact: "desc" }, { createdAt: "asc" }]
          }
        }
      },
      versions: { orderBy: { versionNumber: "desc" }, take: 1 }
    }
  });
  if (!current || !current.versions[0]) {
    throw new ReportPublicationError("Issued report card was not found.", 404);
  }
  if (!["ISSUED", "WITHDRAWN"].includes(current.status)) {
    throw new ReportPublicationError("Only an issued or withdrawn report can be replaced.", 409);
  }
  if (current.currentVersionNumber !== expectedVersion) {
    throw new ReportPublicationError(
      "The issued version changed. Reload before replacing.",
      409,
      "EXPECTED_VERSION_CONFLICT"
    );
  }
  const preview = await previewReportPublication(
    client,
    {
      ...row,
      scope: "INDIVIDUAL",
      studentIds: [current.studentId]
    },
    actor,
    now
  );
  if (preview.count !== 1) {
    throw new ReportPublicationError("Replacement must resolve exactly one linked Student result.", 409);
  }
  const expectedFingerprint = boundedHash(row.previewFingerprint, "Preview fingerprint");
  if (preview.fingerprint !== expectedFingerprint) {
    throw new ReportPublicationError(
      "The exact replacement preview changed. Review it again.",
      409,
      "EXPECTED_VERSION_CONFLICT"
    );
  }
  const replacement = preview.internalReports[0] as PublishedReportSnapshot;
  if (replacement.student.admissionNumber !== current.student.admissionNo) {
    throw new ReportPublicationError("Replacement source belongs to another Student.", 403);
  }
  const priorSnapshot = parsePublishedSnapshot(current.versions[0].snapshotJson);
  if (
    priorSnapshot.governance.internal.resultSnapshotId ===
    replacement.governance.internal.resultSnapshotId
  ) {
    throw new ReportPublicationError(
      "Choose a newer locked result snapshot for the replacement.",
      409,
      "SOURCE_NOT_NEWER"
    );
  }
  const requestHash = hashText(requestKey);
  const priorEvent = await client.studentReportCardEvent.findFirst({
    where: {
      reportCardId: current.id,
      eventType: "CORRECTION_ISSUED",
      notes: { contains: requestHash }
    },
    orderBy: { eventDate: "desc" }
  });
  if (priorEvent) {
    return publicCardState(
      await client.studentReportCard.findUniqueOrThrow({ where: { id: current.id } }),
      "ISSUED"
    );
  }
  const nextVersion = expectedVersion + 1;
  const issued: PublishedReportSnapshot = {
    ...replacement,
    status: "ISSUED",
    reportCardNumber: current.reportCardNumber,
    publicationReference: `${basePublicationReference(
      replacement,
      current.reportCardNumber
    )}-V${nextVersion}`,
    versionNumber: nextVersion,
    issueDate: now.toISOString(),
    governance: {
      ...replacement.governance,
      previewFingerprint: preview.fingerprint,
      publishedByLabel: actor.name
    }
  };
  return client.$transaction(async (tx: any) => {
    const changed = await tx.studentReportCard.updateMany({
      where: {
        id: current.id,
        status: current.status,
        currentVersionNumber: expectedVersion,
        updatedAt: expectedUpdatedAt
      },
      data: {
        status: "ISSUED",
        currentVersionNumber: nextVersion,
        finalGrade: issued.content.grade?.code ?? null,
        cancellationReason: null,
        cancelledAt: null,
        cancelledByUserId: null,
        issuedAt: now,
        issuedByUserId: actor.id
      }
    });
    if (changed.count !== 1) {
      throw new ReportPublicationError(
        "The report changed in another session. Reload before replacing.",
        409,
        "EXPECTED_VERSION_CONFLICT"
      );
    }
    const version = await tx.studentReportCardVersion.create({
      data: {
        reportCardId: current.id,
        versionNumber: nextVersion,
        versionType: "CORRECTION",
        snapshotJson: JSON.stringify(issued),
        correctionReason: reason,
        issuedAt: now,
        issuedByUserId: actor.id,
        supersedesVersionId: current.versions[0].id,
        calendarBasisVersionKey: current.versions[0].calendarBasisVersionKey,
        calendarBasisSnapshotJson: current.versions[0].calendarBasisSnapshotJson
      }
    });
    await tx.studentReportCardEvent.createMany({
      data: [
        {
          reportCardId: current.id,
          versionId: current.versions[0].id,
          eventType: "PUBLICATION_REPLACED",
          eventDate: now,
          previousStatus: current.status,
          newStatus: "REPLACED",
          reason,
          recordedByUserId: actor.id,
          actorLabel: actor.name,
          notes: safeAuditJson({
            requestHash,
            replacedByVersion: nextVersion
          })
        },
        {
          reportCardId: current.id,
          versionId: version.id,
          eventType: "CORRECTION_ISSUED",
          eventDate: now,
          previousStatus: current.status,
          newStatus: "ISSUED",
          reason,
          recordedByUserId: actor.id,
          actorLabel: actor.name,
          notes: safeAuditJson({
            requestHash,
            previewFingerprint: preview.fingerprint,
            publicationReference: issued.publicationReference
          })
        }
      ]
    });
    return publicCardState(
      await tx.studentReportCard.findUniqueOrThrow({ where: { id: current.id } }),
      "ISSUED"
    );
  });
}

export function parsePublishedSnapshot(value: string): PublishedReportSnapshot {
  const parsed = parseJson(value, "Published report");
  if (
    parsed?.schemaVersion !== REPORT_PUBLICATION_SCHEMA_VERSION ||
    parsed?.status !== "ISSUED" ||
    !parsed?.publicationReference ||
    !parsed?.governance?.internal?.resultSnapshotId
  ) {
    throw new ReportPublicationError("Stored published report is invalid.", 500);
  }
  return parsed as PublishedReportSnapshot;
}

export function publicationPreviewFingerprint(reports: PublishedReportSnapshot[]) {
  return hashText(
    JSON.stringify(
      reports.map((report) => ({
        source: report.governance.internal,
        resultSnapshotVersion: report.governance.resultSnapshotVersion,
        template: report.template,
        school: report.school,
        student: report.student,
        examination: report.examination,
        content: report.content,
        signatures: report.signatures
      }))
    )
  );
}

async function resolvePublicationSource(
  client: PublicationClient,
  input: PreviewInput
): Promise<ResolvedSource> {
  const snapshots = await client.studentResultSnapshot.findMany({
    where: { calculationRunId: { in: input.calculationRunIds } },
    include: {
      student: true,
      examination: {
        include: {
          subjectPapers: { orderBy: { displayOrder: "asc" } },
          subjectGroups: {
            include: {
              members: {
                include: { subjectPaper: true },
                orderBy: { displayOrder: "asc" }
              }
            },
            orderBy: { displayOrder: "asc" }
          },
          templateBindings: {
            include: {
              reportCardTemplate: {
                include: {
                  gradingScheme: {
                    include: { bands: { orderBy: { displayOrder: "asc" } } }
                  }
                }
              }
            },
            orderBy: { versionNumber: "desc" }
          }
        }
      },
      classScope: {
        include: {
          gradeScaleVersions: {
            include: { bands: { orderBy: { displayOrder: "asc" } } },
            orderBy: { versionNumber: "desc" }
          },
          coScholasticVersions: { orderBy: { versionNumber: "desc" } }
        }
      },
      schemeVersion: true
    },
    orderBy: [
      { classScope: { className: "asc" } },
      { classScope: { section: "asc" } },
      { student: { studentName: "asc" } }
    ]
  });
  if (!snapshots.length) {
    throw new ReportPublicationError("No result snapshots matched the requested calculation run.", 404);
  }
  const cohortPaperStats = lockedPaperCohortStats(snapshots);
  const returnedRuns = new Set(snapshots.map((row: any) => row.calculationRunId));
  if (input.calculationRunIds.some((runId) => !returnedRuns.has(runId))) {
    throw new ReportPublicationError("A selected calculation run was not found.", 404);
  }
  const examinationIds = new Set(snapshots.map((row: any) => row.examinationId));
  if (examinationIds.size !== 1) {
    throw new ReportPublicationError("One publication may use only one configured examination.");
  }
  const classNames = new Set(snapshots.map((row: any) => row.classScope.className));
  if (classNames.size !== 1) {
    throw new ReportPublicationError("Class-wise publication cannot mix different classes.");
  }
  if (input.scope === "SECTION" && input.calculationRunIds.length !== 1) {
    throw new ReportPublicationError("Section-wise publication requires one locked calculation run.");
  }
  if (input.scope === "INDIVIDUAL") {
    if (!input.studentIds.length && !input.studentAdmissionNumbers.length) {
      throw new ReportPublicationError("Choose at least one Student for individual publication.");
    }
    const allowedIds = new Set(input.studentIds);
    const allowedAdmissions = new Set(
      input.studentAdmissionNumbers.map((value) => value.toUpperCase())
    );
    const selected = snapshots.filter(
      (row: any) =>
        allowedIds.has(row.studentId) ||
        allowedAdmissions.has(String(row.student.admissionNo).toUpperCase())
    );
    if (selected.length !== allowedIds.size + allowedAdmissions.size) {
      throw new ReportPublicationError("A selected Student is outside the locked result cohort.", 403);
    }
    snapshots.splice(0, snapshots.length, ...selected);
  }
  if (snapshots.length > MAX_REPORT_PUBLICATION_BATCH) {
    throw new ReportPublicationError(
      `A publication batch is limited to ${MAX_REPORT_PUBLICATION_BATCH} Students.`,
      413,
      "BATCH_LIMIT_EXCEEDED"
    );
  }
  const events = await client.examinationSchemeAudit.findMany({
    where: {
      targetType: "EXAM_CALCULATION_RUN",
      targetId: { in: input.calculationRunIds },
      eventType: {
        in: ["CALCULATION_SNAPSHOT_LOCKED", "CALCULATION_SNAPSHOT_SUPERSEDED"]
      }
    },
    orderBy: { eventDate: "desc" }
  });
  const lockEvents = new Map<string, any>();
  const bindings = new Map<string, any>();
  for (const runId of input.calculationRunIds) {
    const rows = snapshots.filter((row: any) => row.calculationRunId === runId);
    const lock = events.find(
      (event: any) =>
        event.targetId === runId &&
        event.eventType === "CALCULATION_SNAPSHOT_LOCKED"
    );
    const superseded = events.find(
      (event: any) =>
        event.targetId === runId &&
        event.eventType === "CALCULATION_SNAPSHOT_SUPERSEDED"
    );
    const binding = rows[0]?.examination.templateBindings.find(
      (candidate: any) =>
        candidate.classScopeId === rows[0].classScopeId &&
        candidate.status === "ACTIVE" &&
        candidate.frozenAt
    );
    const blockers = runBlockers(rows, lock, superseded, binding);
    if (blockers.length) {
      throw new ReportPublicationError(
        `Publication is blocked: ${blockers[0]}`,
        409,
        "SOURCE_NOT_PUBLISHABLE"
      );
    }
    lockEvents.set(runId, lock);
    bindings.set(rows[0].classScopeId, binding);
  }
  const families = new Set(
    [...bindings.values()].map((binding: any) => binding.templateFamily)
  );
  const templateIds = new Set(
    [...bindings.values()].map((binding: any) => binding.reportCardTemplateId)
  );
  if (families.size !== 1 || templateIds.size !== 1) {
    throw new ReportPublicationError(
      "Class-wise publication requires one frozen template family and template version across sections."
    );
  }
  const school = await client.schoolSettings.findUnique({ where: { id: "school" } });
  if (!school) throw new ReportPublicationError("School identity settings are unavailable.", 409);
  return {
    snapshots,
    cohortPaperStats,
    bindings,
    lockEvents,
    examination: snapshots[0].examination,
    school,
    scope: input.scope
  };
}

async function buildPublicationBundles(
  client: PublicationClient,
  resolved: ResolvedSource,
  actor: PublicationActor | null,
  now: Date
) {
  const reports: PublishedReportSnapshot[] = [];
  for (const snapshotRow of resolved.snapshots) {
    const source = parseJson(snapshotRow.snapshotJson, "Result snapshot");
    const binding = resolved.bindings.get(snapshotRow.classScopeId);
    const template = binding.reportCardTemplate;
    const family = binding.templateFamily as GovernedReportTemplateFamily;
    const content = publishedContent(
      source,
      snapshotRow.examination,
      family,
      resolved.cohortPaperStats,
      snapshotRow.calculationRunId
    );
    const contentBlockers = familyContentBlockers(family, content, template);
    if (contentBlockers.length) {
      throw new ReportPublicationError(
        `${snapshotRow.student.admissionNo} is incomplete: ${contentBlockers[0]}`,
        409,
        "INCOMPLETE_REPORT"
      );
    }
    const lock = resolved.lockEvents.get(snapshotRow.calculationRunId);
    const reportCardNumber = deterministicReportCardNumber(
      snapshotRow,
      binding.versionNumber
    );
    const publicationReference = `${basePublicationReference(
      {
        academicYear: snapshotRow.examination.academicYear,
        student: {
          className: snapshotRow.classScope.className,
          section: snapshotRow.classScope.section,
          admissionNumber: snapshotRow.student.admissionNo
        }
      } as PublishedReportSnapshot,
      reportCardNumber
    )}-V1`;
    const definition = template
      ? parseJson(template.templateDefinitionJson, "Report template definition")
      : {};
    const printSettings = governedPrintSettings(
      template?.printSettingsJson
        ? parseJson(template.printSettingsJson, "Report print settings")
        : {},
      family
    );
    const frozenGradeScale = snapshotRow.classScope.gradeScaleVersions.find(
      (row: any) => row.status === "ACTIVE" && row.frozenAt
    ) ?? null;
    const frozenCoScholastic = snapshotRow.classScope.coScholasticVersions.find(
      (row: any) => row.status === "ACTIVE" && row.frozenAt
    ) ?? null;
    const legends = frozenGradeScale?.bands?.map((band: any) => ({
      code: band.gradeCode,
      label: band.label,
      minimumPercentage: String(band.minimumPercentage),
      maximumPercentage: String(band.maximumPercentage),
      gradePoint: band.gradePoint == null ? null : String(band.gradePoint)
    })) ?? template?.gradingScheme?.bands?.map((band: any) => ({
      code: band.gradeCode,
      label: band.label,
      minimumPercentage: String(band.minimumPercentage),
      maximumPercentage: band.maximumPercentage == null ? "100" : String(band.maximumPercentage),
      gradePoint: null
    })) ?? source.legends ?? [];
    const report: PublishedReportSnapshot = {
      schemaVersion: REPORT_PUBLICATION_SCHEMA_VERSION,
      status: "PREVIEW",
      reportType: reportTypeForFamily(family),
      templateFamily: family,
      publicationReference,
      reportCardNumber,
      versionNumber: 1,
      issueDate: null,
      title: `${snapshotRow.examination.name} Report Card`,
      reportingPeriod: `${isoDate(snapshotRow.examination.startDate)} to ${isoDate(
        snapshotRow.examination.endDate
      )}`,
      academicYear: snapshotRow.examination.academicYear,
      school: {
        name: resolved.school.schoolName,
        address: resolved.school.addressLine1,
        city: resolved.school.city,
        phone: resolved.school.showSchoolPhone ? resolved.school.phone : null,
        logoPath: reportLogoPath(resolved.school.logoPath),
        affiliationWording: optionalText(definition.schoolIdentity?.affiliationWording, 160),
        recognitionWording: optionalText(definition.schoolIdentity?.recognitionWording, 160),
        establishmentYear: optionalText(definition.schoolIdentity?.establishmentYear, 4)
      },
      student: {
        name: snapshotRow.student.studentName,
        admissionNumber: snapshotRow.student.admissionNo,
        rollNumber: snapshotRow.student.rollNo ?? null,
        className: snapshotRow.classScope.className,
        section: snapshotRow.classScope.section || null,
        dateOfBirth: snapshotRow.student.dateOfBirth
          ? isoDate(snapshotRow.student.dateOfBirth)
          : null,
        gender: nullableString(snapshotRow.student.gender),
        parentGuardians: governedParentGuardianRows(snapshotRow.student, definition)
      },
      examination: {
        code: snapshotRow.examination.examCode,
        name: snapshotRow.examination.name,
        periodStart: isoDate(snapshotRow.examination.startDate),
        periodEnd: isoDate(snapshotRow.examination.endDate)
      },
      content: { ...content, legends },
      signatures: governedSignatures(definition),
      template: {
        code: template?.templateCode ?? `BUILTIN-${family}`,
        name: template?.name ?? `${family} built-in renderer`,
        version: template?.versionNumber ?? 1,
        bindingVersion: binding.versionNumber,
        definition,
        printSettings
      },
      governance: {
        calculationRunReference: publicRunReference(snapshotRow.calculationRunId),
        resultSnapshotVersion: snapshotRow.snapshotVersion,
        formulaVersion: snapshotRow.formulaVersion,
        roundingPolicyVersion: snapshotRow.roundingPolicyVersion,
        sourceLockedAt: lock.eventDate.toISOString(),
        templateFrozenAt: binding.frozenAt.toISOString(),
        previewFingerprint: "",
        publishedByLabel: actor?.name ?? null,
        schemeVersionReferences: safeSchemeVersionReferences(snapshotRow.sourceSchemeVersionsJson),
        gradeScaleVersion: frozenGradeScale?.versionNumber ?? null,
        skillsPersonalitySchemeVersion: frozenCoScholastic?.versionNumber ?? null,
        attendanceBasisVersion: `ATT-${hashText(JSON.stringify(content.attendance)).slice(0, 12)}`,
        reportTemplateVersion: template?.versionNumber ?? 1,
        signatureConfigurationVersion: `SIG-${hashText(JSON.stringify(governedSignatures(definition))).slice(0, 12)}`,
        publicationVersion: 1,
        internal: {
          resultSnapshotId: snapshotRow.id,
          calculationRunId: snapshotRow.calculationRunId,
          templateBindingId: binding.id
        }
      }
    };
    reports.push(report);
  }
  const fingerprint = publicationPreviewFingerprint(reports);
  return reports.map((report) => ({
    ...report,
    governance: { ...report.governance, previewFingerprint: fingerprint },
    issueDate: report.status === "ISSUED" ? now.toISOString() : null
  }));
}

function publishedContent(
  source: any,
  examination: any,
  family: GovernedReportTemplateFamily,
  cohortPaperStats: Map<string, { average: string; highest: string }>,
  calculationRunId: string
) {
  const paperMap = new Map(
    examination.subjectPapers.map((paper: any) => [paper.id, paper])
  );
  const papers = (Array.isArray(source.papers) ? source.papers : []).map((paper: any) => {
    const configured = paperMap.get(paper.paperId) as any;
    const cohort = cohortPaperStats.get(`${calculationRunId}|${paper.paperId}`);
    return {
      code: configured?.paperCode ?? "PAPER",
      subjectName: configured?.subjectNameSnapshot ?? configured?.paperName ?? "Subject",
      paperName: configured?.paperName ?? "Paper",
      calculationMode: String(paper.calculationMode ?? ""),
      components: (Array.isArray(paper.components) ? paper.components : []).map(
        (component: any) => ({
          code: String(component.code ?? ""),
          name: String(component.name ?? ""),
          state: String(component.state ?? ""),
          obtained: nullableString(component.obtained),
          maximum: String(component.maximum ?? ""),
          contributionWeight: nullableString(component.contributionWeight),
          contribution: nullableString(component.contribution)
        })
      ),
      obtained: String(paper.obtained ?? ""),
      maximum: String(paper.maximum ?? ""),
      percentage: String(paper.percentage ?? ""),
      excluded: paper.excluded === true,
      cohortAverage: cohort?.average ?? null,
      cohortHighest: cohort?.highest ?? null
    };
  });
  const attendance = source.attendanceReference ?? {};
  return {
    papers,
    groups: Array.isArray(source.groups) ? source.groups : [],
    totalObtained: String(source.totalObtained ?? ""),
    totalMaximum: String(source.totalMaximum ?? ""),
    percentage: String(source.percentage ?? ""),
    grade: source.grade
      ? {
          code: String(source.grade.code ?? ""),
          label: String(source.grade.label ?? source.grade.code ?? ""),
          point: nullableString(source.grade.point)
        }
      : null,
    passResult: nullableString(source.passResult),
    rank: Number.isInteger(source.rank) ? source.rank : null,
    cohortAverage: nullableString(source.cohortAverage),
    cohortHighest: nullableString(source.cohortHighest),
    attendance: {
      policy: String(attendance.policy ?? "LOCKED_EXAMINATION_DATE_RANGE_ONLY"),
      periodStart: String(attendance.periodStart ?? ""),
      periodEnd: String(attendance.periodEnd ?? ""),
      totalLockedDays: nonNegativeNumber(attendance.totalLockedDays),
      recordedDays: nonNegativeNumber(attendance.recordedDays),
      presentEquivalentDays: nonNegativeNumber(attendance.presentEquivalentDays),
      ...optionalAttendanceMonths(source.attendanceMonthly)
    },
    skills: boundedRatingRows(source.skills),
    personality: boundedRatingRows(source.personality),
    developmentalSections: boundedDevelopmentalSections(source.developmentalSections),
    combinedResults: boundedCombinedResults(source.combinedResults),
    remarks: {
      classTeacher: optionalText(source.remarks?.classTeacher, 2_000),
      principal: optionalText(source.remarks?.principal, 2_000),
      general: optionalText(source.remarks?.general, 2_000)
    },
    legends: Array.isArray(source.legends)
      ? source.legends.slice(0, 30).map((row: any) => ({
          code: String(row.code ?? "").slice(0, 30),
          label: String(row.label ?? "").slice(0, 120),
          minimumPercentage: nullableString(row.minimumPercentage),
          maximumPercentage: nullableString(row.maximumPercentage),
          gradePoint: nullableString(row.gradePoint)
        }))
      : [],
    growth: boundedGrowth(source.growth),
    evaluationComments: boundedEvaluationComments(source.evaluationComments),
    kgRubricEvaluations: boundedEvaluationRatingMaps(source.rubrics),
    kgSummaryEvaluations: boundedEvaluationRatingMaps(source.summaryGrades),
    kgPersonalityEvaluations: boundedEvaluationRatingMaps(source.personality),
    promotion: boundedPromotion(source.promotion),
    warnings: Array.isArray(source.warnings)
      ? source.warnings.slice(0, 50).map((value: unknown) => String(value).slice(0, 160))
      : [],
    family
  };
}

function runBlockers(rows: any[], lock: any, superseded: any, binding: any) {
  const blockers: string[] = [];
  if (!rows.length) blockers.push("The calculation run has no Student snapshots.");
  if (!lock) blockers.push("The calculation run is not locked.");
  if (superseded) blockers.push("The calculation run has been superseded.");
  if (!binding) blockers.push("No active frozen report-template family is bound to this class scope.");
  if (binding && !GOVERNED_REPORT_TEMPLATE_FAMILIES.includes(binding.templateFamily)) {
    blockers.push("The frozen template family is unsupported.");
  }
  if (binding?.templateFamily === "KG_DEVELOPMENTAL_BOOKLET" && !isKgReportCardOperationallyAvailable()) {
    blockers.push(KG_REPORT_CARD_DEFERRED_MESSAGE);
  }
  if (binding && !binding.reportCardTemplateId) {
    blockers.push("The frozen template family is not linked to an approved report-card template.");
  }
  if (binding?.reportCardTemplate && binding.reportCardTemplate.status !== "ACTIVE") {
    blockers.push("The linked report-card template is not active.");
  }
  if (rows.some((row) => row.runStatus !== "PREVIEW")) {
    blockers.push("The calculation snapshots are incomplete.");
  }
  if (rows.some((row) => !row.lockedAt && !lock)) {
    blockers.push("A Student result snapshot is unlocked.");
  }
  if (lock) {
    const lockSnapshot = parseJson(lock.snapshotJson, "Calculation lock audit");
    const lockedIds = new Set(
      Array.isArray(lockSnapshot.snapshotIds) ? lockSnapshot.snapshotIds : []
    );
    if (lockedIds.size && rows.some((row) => !lockedIds.has(row.id))) {
      blockers.push("The locked calculation audit does not contain the exact snapshot cohort.");
    }
  }
  return [...new Set(blockers)];
}

function familyContentBlockers(
  family: GovernedReportTemplateFamily,
  content: ReturnType<typeof publishedContent>,
  template: any
) {
  const blockers: string[] = [];
  if (family !== "KG_DEVELOPMENTAL_BOOKLET" && !content.papers.length) blockers.push("No paper results are present.");
  if (
    content.papers.some(
      (paper: { components: Array<{ state: string }> }) =>
        !paper.components.length ||
        paper.components.some(
          (component: { state: string }) => component.state === "NOT_ENTERED"
        )
    )
  ) {
    blockers.push("A paper component is incomplete.");
  }
  if (family !== "KG_DEVELOPMENTAL_BOOKLET" && (!content.totalMaximum || Number(content.totalMaximum) <= 0)) {
    blockers.push("The frozen result total has an unsafe denominator.");
  }
  if (!content.attendance.periodStart || !content.attendance.periodEnd) {
    blockers.push("Locked attendance context is missing.");
  }
  if (family === "KG_DEVELOPMENTAL_BOOKLET" && !content.developmentalSections.length) {
    blockers.push("KG developmental sections are missing.");
  }
  if (["LOWER_PRIMARY_I_II", "UPPER_PRIMARY_III_V", "PRIMARY_10_40_SKILLS"].includes(family) && !content.skills.length) {
    blockers.push("Primary skills ratings are missing.");
  }
  if (["MIDDLE_VI_VIII_GROUPED", "SECONDARY_IX_X", "SECONDARY_10_40_GROUPED"].includes(family) && !content.personality.length) {
    blockers.push("Secondary personality ratings are missing.");
  }
  const definition = template?.templateDefinitionJson
      ? parseJson(template.templateDefinitionJson, "Combined report template")
      : {};
  if (family === "RETAINED_MULTI_EXAM_I_X" || isCombinedVariant(definition)) {
    if (
      definition?.combinedResult?.enabled !== true ||
      !definition?.combinedResult?.sourceApprovalReference
    ) {
      blockers.push("The combined-result template is not explicitly enabled and source-approved.");
    }
    if (!content.combinedResults.length) blockers.push("Configured combined-result rows are missing.");
  }
  return blockers;
}

function publicationInput(value: unknown): PreviewInput {
  const row = object(value, "Publication selection");
  const calculationRunIds = uniqueBoundedIds(
    row.calculationRunIds ?? (row.calculationRunId ? [row.calculationRunId] : []),
    "Calculation run",
    MAX_PUBLICATION_RUNS
  );
  if (!calculationRunIds.length) throw new ReportPublicationError("Choose a locked calculation run.");
  const scope = String(row.scope ?? "SECTION").toUpperCase() as ReportPublicationScope;
  if (!["INDIVIDUAL", "SECTION", "CLASS"].includes(scope)) {
    throw new ReportPublicationError("Choose individual, section, or class publication.");
  }
  const studentIds = uniqueBoundedIds(row.studentIds ?? [], "Student", MAX_REPORT_PUBLICATION_BATCH);
  const studentAdmissionNumbers = uniqueAdmissionNumbers(
    row.studentAdmissionNumbers ?? [],
    MAX_REPORT_PUBLICATION_BATCH
  );
  return { calculationRunIds, scope, studentIds, studentAdmissionNumbers };
}

function uniqueBoundedIds(value: unknown, label: string, maximum: number) {
  if (!Array.isArray(value) || value.length > maximum) {
    throw new ReportPublicationError(`${label} selection is invalid or too large.`);
  }
  const values = value.map((item) => {
    const text = String(item ?? "").trim();
    if (!/^[A-Za-z0-9_-]{1,200}$/.test(text)) {
      throw new ReportPublicationError(`${label} selection is invalid.`);
    }
    return text;
  });
  if (new Set(values).size !== values.length) {
    throw new ReportPublicationError(`${label} selection contains duplicates.`);
  }
  return values;
}

function uniqueAdmissionNumbers(value: unknown, maximum: number) {
  if (!Array.isArray(value) || value.length > maximum) {
    throw new ReportPublicationError("Student admission-number selection is invalid or too large.");
  }
  const values = value.map((item) => {
    const text = String(item ?? "").trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9/_-]{0,39}$/.test(text)) {
      throw new ReportPublicationError("A Student admission-number selection is invalid.");
    }
    return text;
  });
  if (new Set(values).size !== values.length) {
    throw new ReportPublicationError("Student admission-number selection contains duplicates.");
  }
  return values;
}

function governedPrintSettings(value: any, family: GovernedReportTemplateFamily) {
  const requested = String(value?.orientation ?? "").toUpperCase();
  const orientation: "PORTRAIT" | "LANDSCAPE" =
    family !== "KG_DEVELOPMENTAL_BOOKLET" && requested === "LANDSCAPE"
      ? "LANDSCAPE"
      : "PORTRAIT";
  const rawMargin = Number(value?.marginMm ?? 12);
  const marginMm = Number.isFinite(rawMargin) ? Math.min(20, Math.max(8, rawMargin)) : 10;
  const rawFont = Number(value?.minimumFontSizePt ?? 9);
  const minimumFontSizePt = Number.isFinite(rawFont)
    ? Math.min(11, Math.max(8.5, rawFont))
    : 9;
  return {
    orientation,
    pageSize: "A4" as const,
    minimumFontSizePt,
    marginMm
  };
}

function governedSignatures(definition: any) {
  const configured = Array.isArray(definition?.signatureLabels)
    ? definition.signatureLabels
    : ["Class Teacher", "Principal", "Parent / Guardian"];
  return configured.slice(0, 6).map((value: unknown, index: number) => {
    const label = String(value ?? "").trim().slice(0, 80);
    return { role: `SIGNATORY_${index + 1}`, label: label || `Signatory ${index + 1}` };
  });
}

function boundedRatingRows(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 100).map((row: any) => ({
    area: String(row?.area ?? row?.label ?? "").trim().slice(0, 160),
    rating: String(row?.rating ?? "").trim().slice(0, 80),
    remarks: optionalText(row?.remarks, 500)
  })).filter((row) => row.area && row.rating);
}

function boundedDevelopmentalSections(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).map((section: any) => ({
    title: String(section?.title ?? "").trim().slice(0, 160),
    items: boundedRatingRows(section?.items)
  })).filter((section) => section.title && section.items.length);
}

function boundedCombinedResults(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 30).map((row: any) => ({
    label: String(row?.label ?? "").trim().slice(0, 160),
    obtained: String(row?.obtained ?? "").trim().slice(0, 40),
    maximum: String(row?.maximum ?? "").trim().slice(0, 40),
    percentage: String(row?.percentage ?? "").trim().slice(0, 40),
    configuredWeight: nullableString(row?.configuredWeight)
  })).filter((row) => row.label && row.obtained && row.maximum && row.percentage);
}

function lockedPaperCohortStats(snapshots: any[]) {
  const buckets = new Map<string, number[]>();
  for (const row of snapshots) {
    const source = parseJson(row.snapshotJson, "Result snapshot");
    for (const paper of Array.isArray(source.papers) ? source.papers : []) {
      const percentage = Number(paper?.percentage);
      if (!paper?.paperId || paper?.excluded === true || !Number.isFinite(percentage)) continue;
      const key = `${row.calculationRunId}|${paper.paperId}`;
      const values = buckets.get(key) ?? [];
      values.push(percentage);
      buckets.set(key, values);
    }
  }
  return new Map([...buckets.entries()].map(([key, values]) => {
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    return [key, { average: average.toFixed(2), highest: Math.max(...values).toFixed(2) }];
  }));
}

function boundedAttendanceMonths(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 12).map((row: any) => ({
    month: String(row?.month ?? "").trim().toUpperCase().slice(0, 20),
    workingDays: nullableNonNegativeNumber(row?.workingDays),
    daysPresent: nullableNonNegativeNumber(row?.daysPresent)
  })).filter((row) => row.month);
}

function optionalAttendanceMonths(value: unknown) {
  const monthly = boundedAttendanceMonths(value);
  return monthly.length ? { monthly } : {};
}

function boundedGrowth(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, any>).slice(0, 10).map(([evaluation, row]) => ({
    evaluation: evaluation.slice(0, 20),
    heightCm: nullableString(row?.heightCm),
    weightKg: nullableString(row?.weightKg)
  }));
}

function boundedEvaluationComments(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, any>).slice(0, 10).map(([evaluation, row]) => ({
    evaluation: evaluation.slice(0, 20),
    comment: optionalText(row?.comment ?? row, 2_000)
  }));
}

function boundedEvaluationRatingMaps(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>).slice(0, 10).map(([evaluation, ratings]) => ({
    evaluation: evaluation.slice(0, 20),
    ratings: ratings && typeof ratings === "object" && !Array.isArray(ratings)
      ? Object.entries(ratings as Record<string, unknown>).slice(0, 200).map(([area, rating]) => ({
          area: area.slice(0, 160),
          rating: String(rating ?? "").slice(0, 80)
        })).filter((row) => row.area && row.rating)
      : []
  })).filter((row) => row.evaluation && row.ratings.length);
}

function boundedPromotion(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const row = value as Record<string, unknown>;
  return {
    nextClass: optionalText(row.nextClass, 80),
    nextSessionStartDate: optionalText(row.nextSessionStartDate, 20),
    displayText: optionalText(row.displayText, 500)
  };
}

function reportLogoPath(value: unknown) {
  const configured = String(value ?? "").trim();
  if (/^\/nalanda-logo\.(jpg|jpeg|png)$/i.test(configured)) return "/nalanda-logo-transparent.png";
  return configured || null;
}

function governedParentGuardianRows(student: any, definition: any) {
  const label = optionalText(definition?.identity?.parentGuardianLabel, 160) ?? "Parent / Guardian";
  if (definition?.identity?.parentGuardianMode === "FATHER_NAME_COMPATIBILITY") {
    return student.fatherName ? [{ label, value: String(student.fatherName).slice(0, 160) }] : [];
  }
  const linked = (Array.isArray(student.guardians) ? student.guardians : [])
    .filter((row: any) => row?.guardian?.status === "Active" || row?.guardian?.status === "ACTIVE")
    .map((row: any) => ({
      label: String(row.relationshipToStudent || row.guardian.relationship || label).slice(0, 80),
      value: String(row.guardian.displayName ?? "").trim().slice(0, 160)
    }))
    .filter((row: { value: string }) => row.value)
    .slice(0, 2);
  if (linked.length) return linked;
  return [
    student.fatherName ? { label: "Parent / Guardian", value: String(student.fatherName).slice(0, 160) } : null,
    student.motherName ? { label: "Parent / Guardian", value: String(student.motherName).slice(0, 160) } : null
  ].filter(Boolean) as Array<{ label: string; value: string }>;
}

function safeSchemeVersionReferences(value: unknown) {
  try {
    const parsed = JSON.parse(String(value ?? "[]"));
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 100).map((item) => `SCHEME-${hashText(String(item)).slice(0, 12)}`);
  } catch {
    return [];
  }
}

function nullableNonNegativeNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function deterministicReportCardNumber(snapshot: any, bindingVersion: number) {
  const parts = [
    "NPS-RC",
    sanitizeReference(snapshot.examination.academicYear),
    sanitizeReference(snapshot.classScope.className),
    sanitizeReference(snapshot.classScope.section || "ALL"),
    sanitizeReference(snapshot.student.admissionNo),
    `T${bindingVersion}`
  ];
  return parts.join("-").slice(0, 100);
}

function basePublicationReference(report: PublishedReportSnapshot, reportCardNumber: string) {
  return [
    "NPS",
    "PUB",
    sanitizeReference(report.academicYear),
    sanitizeReference(report.student.className),
    sanitizeReference(report.student.section || "ALL"),
    hashText(reportCardNumber).slice(0, 10)
  ].join("-");
}

function publicRunReference(runId: string) {
  return `CALC-${hashText(runId).slice(0, 12)}`;
}

async function studentIdForSnapshot(tx: any, snapshotId: string) {
  const row = await tx.studentResultSnapshot.findUnique({
    where: { id: snapshotId },
    select: { studentId: true }
  });
  if (!row) throw new ReportPublicationError("Result snapshot disappeared during publication.", 409);
  return row.studentId;
}

async function templateIdForPreview(client: PublicationClient, report: PublishedReportSnapshot) {
  const binding = await client.examTemplateFamilyBinding.findUnique({
    where: { id: report.governance.internal.templateBindingId },
    select: { reportCardTemplateId: true }
  });
  if (!binding?.reportCardTemplateId) {
    throw new ReportPublicationError("The frozen report template is unavailable.", 409);
  }
  return binding.reportCardTemplateId;
}

function publicPublicationResult(batch: any, idempotent: boolean) {
  return {
    idempotent,
    batchNumber: batch.batchNumber,
    status: batch.status,
    count: batch.reportCards.length,
    issuedAt: batch.issuedAt?.toISOString?.() ?? batch.issuedAt ?? null,
    reports: batch.reportCards.map((card: any) => ({
      reportCardNumber: card.reportCardNumber,
      status: card.status,
      currentVersion: card.currentVersionNumber,
      updatedAt: card.updatedAt?.toISOString?.() ?? card.updatedAt
    }))
  };
}

function publicCardState(card: any, status: string) {
  return {
    reportCardNumber: card.reportCardNumber,
    status,
    currentVersion: card.currentVersionNumber,
    updatedAt: card.updatedAt?.toISOString?.() ?? card.updatedAt
  };
}

function emptyReadinessSummary() {
  return { total: 0, ready: 0, blocked: 0, locked: 0, superseded: 0 };
}

function boundedRequestKey(value: unknown) {
  const text = String(value ?? "").trim();
  if (!/^[A-Za-z0-9:_-]{12,120}$/.test(text)) {
    throw new ReportPublicationError("A valid idempotency request key is required.");
  }
  return text;
}

function boundedHash(value: unknown, label: string) {
  const text = String(value ?? "").trim().toUpperCase();
  if (!/^[A-F0-9]{64}$/.test(text)) {
    throw new ReportPublicationError(`${label} is invalid.`);
  }
  return text;
}

function boundedReference(value: unknown, label: string) {
  const text = String(value ?? "").trim();
  if (!/^[A-Za-z0-9_-]{6,120}$/.test(text)) {
    throw new ReportPublicationError(`${label} is invalid.`);
  }
  return text;
}

function boundedReason(value: unknown, label: string) {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!text || text.length > 1_000 || /[\u0000-\u001F\u007F]/.test(text)) {
    throw new ReportPublicationError(`${label} is required and must be 1,000 characters or fewer.`);
  }
  return text;
}

function positiveInteger(value: unknown, label: string) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 10_000) {
    throw new ReportPublicationError(`${label} is invalid.`);
  }
  return number;
}

function validDate(value: unknown, label: string) {
  const date = new Date(String(value ?? ""));
  if (Number.isNaN(date.getTime())) {
    throw new ReportPublicationError(`${label} is invalid. Reload and try again.`, 409);
  }
  return date;
}

function object(value: unknown, label: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ReportPublicationError(`${label} must be an object.`);
  }
  return value as Record<string, any>;
}

function parseJson(value: unknown, label: string): any {
  if (typeof value !== "string" || value.length > 2_000_000) {
    throw new ReportPublicationError(`${label} is invalid.`, 500);
  }
  try {
    return JSON.parse(value);
  } catch {
    throw new ReportPublicationError(`${label} is invalid JSON.`, 500);
  }
}

function hashText(value: string) {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

function sanitizeReference(value: unknown) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24) || "NA";
}

function isoDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

function nullableString(value: unknown) {
  return value === null || value === undefined || value === "" ? null : String(value);
}

function optionalText(value: unknown, maximum: number) {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");
  return text ? text.slice(0, maximum) : null;
}

function nonNegativeNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function safeAuditJson(value: Record<string, unknown>) {
  return JSON.stringify(value).slice(0, 2_000);
}
