import { Prisma, type PrismaClient } from "@prisma/client";
import type { AuthUser } from "@/lib/auth";

export const EXAM_TIMETABLE_STATUSES = [
  "DRAFT",
  "READY_FOR_PUBLICATION",
  "PUBLISHED",
  "WITHDRAWN",
  "REPLACED",
  "ARCHIVED"
] as const;

type TimetableClient = PrismaClient | Prisma.TransactionClient;
type TimetableActor = Pick<AuthUser, "id" | "name" | "role">;
type NormalizedRow = {
  subjectPaperId: string;
  examDate: Date;
  startTime: string;
  endTime: string;
  reportingTime: string | null;
  venue: string | null;
  parentInstructions: string | null;
  displayOrder: number;
};

export class ExaminationTimetableError extends Error {
  status: number;
  code: string;
  issues: string[];

  constructor(message: string, status = 400, code = "EXAM_TIMETABLE_INVALID", issues: string[] = []) {
    super(message);
    this.name = "ExaminationTimetableError";
    this.status = status;
    this.code = code;
    this.issues = issues;
  }
}

export const examinationTimetableInclude = {
  examination: {
    select: {
      id: true,
      examCode: true,
      academicYear: true,
      name: true,
      examType: true,
      startDate: true,
      endDate: true,
      status: true,
      version: true
    }
  },
  classScope: {
    include: {
      timetableClassSection: {
        select: { id: true, displayName: true, academicYear: true, className: true, section: true, isActive: true }
      },
      subjectPapers: {
        where: { status: "ACTIVE" },
        include: { timetableSubject: { select: { id: true, name: true, shortName: true, isActive: true } } },
        orderBy: { displayOrder: "asc" }
      }
    }
  },
  replacesVersion: {
    select: { id: true, versionNumber: true, status: true, publishedAt: true }
  },
  rows: {
    include: {
      subjectPaper: {
        include: { timetableSubject: { select: { id: true, name: true, shortName: true, isActive: true } } }
      }
    },
    orderBy: [{ examDate: "asc" }, { startTime: "asc" }, { displayOrder: "asc" }]
  },
  events: {
    orderBy: { eventDate: "desc" },
    take: 100
  }
} satisfies Prisma.ExaminationTimetableVersionInclude;

export function expectedTimetableVersion(value: unknown) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new ExaminationTimetableError("A valid expected timetable version is required.");
  }
  return parsed;
}

export function validateExaminationTimetableRows(value: unknown) {
  const rows = normalizeRows(value);
  return {
    rows,
    issues: overlapIssues(rows)
  };
}

export async function listExaminationTimetables(client: TimetableClient): Promise<any[]> {
  return client.examinationTimetableVersion.findMany({
    include: {
      examination: { select: { examCode: true, name: true, academicYear: true, status: true } },
      classScope: { select: { className: true, section: true, status: true } },
      _count: { select: { rows: true } }
    },
    orderBy: [{ examination: { startDate: "desc" } }, { className: "asc" }, { section: "asc" }, { versionNumber: "desc" }],
    take: 500
  });
}

export async function listTimetableCreationOptions(client: TimetableClient): Promise<any[]> {
  return client.examination.findMany({
    where: { status: { in: ["DRAFT", "ACTIVE"] } },
    select: {
      id: true,
      examCode: true,
      name: true,
      academicYear: true,
      startDate: true,
      endDate: true,
      status: true,
      classScopes: {
        where: { status: "ACTIVE", timetableClassSection: { isActive: true } },
        select: {
          id: true,
          className: true,
          section: true,
          subjectPapers: { where: { status: "ACTIVE" }, select: { id: true } },
          timetableVersions: {
            select: { id: true, versionNumber: true, status: true },
            orderBy: { versionNumber: "desc" },
            take: 20
          }
        },
        orderBy: [{ className: "asc" }, { section: "asc" }]
      }
    },
    orderBy: [{ startDate: "desc" }, { name: "asc" }],
    take: 100
  });
}

export async function getExaminationTimetable(client: TimetableClient, id: string): Promise<any> {
  const row = await client.examinationTimetableVersion.findUnique({ where: { id }, include: examinationTimetableInclude });
  if (!row) throw new ExaminationTimetableError("Examination timetable was not found.", 404, "EXAM_TIMETABLE_NOT_FOUND");
  return row;
}

export async function createExaminationTimetable(client: PrismaClient, input: unknown, actor: TimetableActor): Promise<any> {
  assertLeadership(actor);
  const source = objectInput(input);
  const examinationId = requiredId(source.examinationId, "Examination");
  const classScopeId = requiredId(source.classScopeId, "Class and section scope");
  const sourceVersionId = optionalId(source.sourceVersionId);
  const idempotencyKey = idempotencyKeyText(source.idempotencyKey);
  return client.$transaction(async (tx) => {
    const replay = await tx.examinationTimetableVersion.findUnique({ where: { idempotencyKey } });
    if (replay) {
      if (replay.createdByUserId !== actor.id || replay.examinationId !== examinationId || replay.classScopeId !== classScopeId) {
        throw new ExaminationTimetableError("This request key is already associated with another timetable.", 409, "EXAM_TIMETABLE_REPLAY_CONFLICT");
      }
      return getExaminationTimetable(tx, replay.id);
    }
    const examination = await tx.examination.findFirst({
      where: { id: examinationId, status: { in: ["DRAFT", "ACTIVE"] } },
      include: {
        classScopes: {
          where: { id: classScopeId, status: "ACTIVE", timetableClassSection: { isActive: true } },
          take: 1
        }
      }
    });
    const classScope = examination?.classScopes[0];
    if (!examination || !classScope) {
      throw new ExaminationTimetableError("The examination class and section scope is unavailable.", 409, "EXAM_TIMETABLE_SCOPE_UNAVAILABLE");
    }
    const cloneSource = sourceVersionId
      ? await tx.examinationTimetableVersion.findFirst({
          where: { id: sourceVersionId, examinationId, classScopeId },
          include: { rows: { orderBy: { displayOrder: "asc" } } }
        })
      : null;
    if (sourceVersionId && !cloneSource) {
      throw new ExaminationTimetableError("The timetable version to clone was not found in this exact cohort.", 404, "EXAM_TIMETABLE_CLONE_UNAVAILABLE");
    }
    const latest = await tx.examinationTimetableVersion.findFirst({
      where: { examinationId, classScopeId },
      orderBy: { versionNumber: "desc" },
      select: { versionNumber: true }
    });
    const created = await tx.examinationTimetableVersion.create({
      data: {
        examinationId,
        classScopeId,
        academicYear: examination.academicYear,
        className: classScope.className,
        section: classScope.section,
        versionNumber: (latest?.versionNumber ?? 0) + 1,
        idempotencyKey,
        replacesVersionId: cloneSource?.status === "PUBLISHED" ? cloneSource.id : null,
        parentInstructions: cloneSource?.parentInstructions ?? null,
        createdByUserId: actor.id,
        rows: cloneSource?.rows.length ? {
          create: cloneSource.rows.map((row) => ({
            subjectPaperId: row.subjectPaperId,
            subjectNameSnapshot: row.subjectNameSnapshot,
            paperCodeSnapshot: row.paperCodeSnapshot,
            paperNameSnapshot: row.paperNameSnapshot,
            examDate: row.examDate,
            startTime: row.startTime,
            endTime: row.endTime,
            reportingTime: row.reportingTime,
            venue: row.venue,
            parentInstructions: row.parentInstructions,
            displayOrder: row.displayOrder
          }))
        } : undefined
      }
    });
    await appendEvent(tx, created, actor, {
      eventType: cloneSource ? "TIMETABLE_VERSION_CLONED" : "TIMETABLE_VERSION_CREATED",
      previousStatus: null,
      newStatus: created.status,
      reason: null,
      snapshot: { versionNumber: created.versionNumber, cloned: Boolean(cloneSource), rowCount: cloneSource?.rows.length ?? 0 }
    });
    return getExaminationTimetable(tx, created.id);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }).catch(rethrowDatabaseError);
}

export async function saveExaminationTimetableDraft(client: PrismaClient, id: string, input: unknown, actor: TimetableActor): Promise<any> {
  assertLeadership(actor);
  const source = objectInput(input);
  const expectedVersion = expectedTimetableVersion(source.expectedVersion);
  const parentInstructions = optionalText(source.parentInstructions, "Parent-facing timetable instructions", 2_000);
  const rows = normalizeRows(source.rows);
  return client.$transaction(async (tx) => {
    const current = await tx.examinationTimetableVersion.findUnique({
      where: { id },
      include: { examination: true, classScope: { include: { timetableClassSection: true } } }
    });
    if (!current) throw new ExaminationTimetableError("Examination timetable was not found.", 404, "EXAM_TIMETABLE_NOT_FOUND");
    if (current.status !== "DRAFT") {
      throw new ExaminationTimetableError("Only a draft timetable can be edited.", 409, "EXAM_TIMETABLE_IMMUTABLE");
    }
    const papers = await validateDraftRows(tx, current, rows);
    const changed = await tx.examinationTimetableVersion.updateMany({
      where: { id, status: "DRAFT", version: expectedVersion },
      data: { parentInstructions, version: { increment: 1 } }
    });
    if (changed.count !== 1) throw staleVersionError();
    await tx.examinationTimetableRow.deleteMany({ where: { timetableVersionId: id } });
    if (rows.length) {
      await tx.examinationTimetableRow.createMany({
        data: rows.map((row) => {
          const paper = papers.get(row.subjectPaperId)!;
          return {
            timetableVersionId: id,
            subjectPaperId: paper.id,
            subjectNameSnapshot: paper.subjectNameSnapshot,
            paperCodeSnapshot: paper.paperCode,
            paperNameSnapshot: paper.paperName,
            examDate: row.examDate,
            startTime: row.startTime,
            endTime: row.endTime,
            reportingTime: row.reportingTime,
            venue: row.venue,
            parentInstructions: row.parentInstructions,
            displayOrder: row.displayOrder
          };
        })
      });
    }
    const updated = await tx.examinationTimetableVersion.findUniqueOrThrow({ where: { id } });
    await appendEvent(tx, updated, actor, {
      eventType: "TIMETABLE_DRAFT_SAVED",
      previousStatus: current.status,
      newStatus: updated.status,
      reason: null,
      snapshot: { version: updated.version, rowCount: rows.length, parentInstructionsConfigured: Boolean(parentInstructions) }
    });
    return getExaminationTimetable(tx, id);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }).catch(rethrowDatabaseError);
}

export async function inspectExaminationTimetable(client: TimetableClient, id: string): Promise<{ valid: boolean; issues: string[]; rowCount: number }> {
  const current = await client.examinationTimetableVersion.findUnique({ where: { id }, include: { examination: true, classScope: { include: { timetableClassSection: true } }, rows: true } });
  if (!current) throw new ExaminationTimetableError("Examination timetable was not found.", 404, "EXAM_TIMETABLE_NOT_FOUND");
  const issues = await publicationIssues(client, current);
  return { valid: issues.length === 0, issues, rowCount: current.rows.length };
}

export async function transitionExaminationTimetable(client: PrismaClient, id: string, input: unknown, actor: TimetableActor): Promise<any> {
  assertLeadership(actor);
  const source = objectInput(input);
  const action = String(source.action ?? "").trim().toLowerCase();
  const expectedVersion = expectedTimetableVersion(source.expectedVersion);
  return client.$transaction(async (tx) => {
    const current = await tx.examinationTimetableVersion.findUnique({
      where: { id },
      include: { examination: true, classScope: { include: { timetableClassSection: true } }, rows: true }
    });
    if (!current) throw new ExaminationTimetableError("Examination timetable was not found.", 404, "EXAM_TIMETABLE_NOT_FOUND");
    if (action === "ready") return markReady(tx, current, expectedVersion, actor);
    if (action === "return_to_draft") return returnToDraft(tx, current, expectedVersion, actor, governedReason(source.reason, "Return-to-draft reason"));
    if (action === "publish") return publish(tx, current, expectedVersion, actor, source);
    if (action === "withdraw") return withdraw(tx, current, expectedVersion, actor, governedReason(source.reason, "Withdrawal reason"));
    if (action === "archive") return archive(tx, current, expectedVersion, actor, governedReason(source.reason, "Archive reason"));
    throw new ExaminationTimetableError("Unsupported examination timetable action.");
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }).catch(rethrowDatabaseError);
}

async function markReady(tx: Prisma.TransactionClient, current: any, expectedVersion: number, actor: TimetableActor) {
  if (current.status === "READY_FOR_PUBLICATION" && current.version === expectedVersion) return getExaminationTimetable(tx, current.id);
  if (current.status !== "DRAFT") throw new ExaminationTimetableError("Only a draft timetable can be marked ready.", 409);
  const issues = await publicationIssues(tx, current);
  if (issues.length) throw validationError(issues);
  const changed = await tx.examinationTimetableVersion.updateMany({
    where: { id: current.id, status: "DRAFT", version: expectedVersion },
    data: { status: "READY_FOR_PUBLICATION", version: { increment: 1 } }
  });
  if (changed.count !== 1) throw staleVersionError();
  const updated = await tx.examinationTimetableVersion.findUniqueOrThrow({ where: { id: current.id } });
  await appendEvent(tx, updated, actor, {
    eventType: "TIMETABLE_READY_FOR_PUBLICATION",
    previousStatus: current.status,
    newStatus: updated.status,
    reason: null,
    snapshot: { version: updated.version, rowCount: current.rows.length }
  });
  return getExaminationTimetable(tx, current.id);
}

async function returnToDraft(tx: Prisma.TransactionClient, current: any, expectedVersion: number, actor: TimetableActor, reason: string) {
  if (current.status !== "READY_FOR_PUBLICATION") throw new ExaminationTimetableError("Only a ready timetable can return to draft.", 409);
  const changed = await tx.examinationTimetableVersion.updateMany({
    where: { id: current.id, status: "READY_FOR_PUBLICATION", version: expectedVersion },
    data: { status: "DRAFT", version: { increment: 1 } }
  });
  if (changed.count !== 1) throw staleVersionError();
  const updated = await tx.examinationTimetableVersion.findUniqueOrThrow({ where: { id: current.id } });
  await appendEvent(tx, updated, actor, { eventType: "TIMETABLE_RETURNED_TO_DRAFT", previousStatus: current.status, newStatus: updated.status, reason, snapshot: { version: updated.version } });
  return getExaminationTimetable(tx, current.id);
}

async function publish(tx: Prisma.TransactionClient, current: any, expectedVersion: number, actor: TimetableActor, source: Record<string, unknown>) {
  if (current.status === "PUBLISHED") return getExaminationTimetable(tx, current.id);
  if (current.status !== "READY_FOR_PUBLICATION") throw new ExaminationTimetableError("Validate and mark the timetable ready before publication.", 409);
  const publicationReason = governedReason(source.reason, "Publication reason");
  const issues = await publicationIssues(tx, current);
  if (issues.length) throw validationError(issues);
  const publicationKey = `${current.examinationId}:${current.classScopeId}`;
  const existingPublished = await tx.examinationTimetableVersion.findFirst({
    where: { examinationId: current.examinationId, classScopeId: current.classScopeId, status: "PUBLISHED", currentPublicationKey: publicationKey }
  });
  const prior = current.replacesVersionId
    ? await tx.examinationTimetableVersion.findFirst({ where: { id: current.replacesVersionId, examinationId: current.examinationId, classScopeId: current.classScopeId } })
    : null;
  if (current.replacesVersionId && (!prior || prior.status !== "PUBLISHED" || existingPublished?.id !== prior.id)) {
    throw new ExaminationTimetableError("The timetable being replaced is no longer the current published version.", 409, "EXAM_TIMETABLE_REPLACEMENT_STALE");
  }
  if (!current.replacesVersionId && existingPublished) {
    throw new ExaminationTimetableError("Clone the current published timetable to create a replacement version.", 409, "EXAM_TIMETABLE_REPLACEMENT_REQUIRED");
  }
  const now = new Date();
  let replacementReason: string | null = null;
  if (prior) {
    replacementReason = governedReason(source.replacementReason, "Replacement reason");
    const retired = await tx.examinationTimetableVersion.updateMany({
      where: { id: prior.id, status: "PUBLISHED", currentPublicationKey: publicationKey, version: prior.version },
      data: { status: "REPLACED", currentPublicationKey: null, replacementReason, replacedAt: now, version: { increment: 1 } }
    });
    if (retired.count !== 1) throw staleVersionError();
    const retiredRow = await tx.examinationTimetableVersion.findUniqueOrThrow({ where: { id: prior.id } });
    await appendEvent(tx, retiredRow, actor, { eventType: "TIMETABLE_REPLACED", previousStatus: "PUBLISHED", newStatus: "REPLACED", reason: replacementReason, snapshot: { replacementVersionNumber: current.versionNumber } });
  }
  const changed = await tx.examinationTimetableVersion.updateMany({
    where: { id: current.id, status: "READY_FOR_PUBLICATION", version: expectedVersion, currentPublicationKey: null },
    data: {
      status: "PUBLISHED",
      currentPublicationKey: publicationKey,
      publicationReason,
      replacementReason,
      publishedByUserId: actor.id,
      publishedAt: now,
      version: { increment: 1 }
    }
  });
  if (changed.count !== 1) throw staleVersionError();
  const published = await tx.examinationTimetableVersion.findUniqueOrThrow({ where: { id: current.id } });
  await appendEvent(tx, published, actor, {
    eventType: prior ? "TIMETABLE_REPLACEMENT_PUBLISHED" : "TIMETABLE_PUBLISHED",
    previousStatus: current.status,
    newStatus: published.status,
    reason: prior ? replacementReason : publicationReason,
    snapshot: { versionNumber: published.versionNumber, rowCount: current.rows.length, replacesPublishedVersion: Boolean(prior) }
  });
  return getExaminationTimetable(tx, current.id);
}

async function withdraw(tx: Prisma.TransactionClient, current: any, expectedVersion: number, actor: TimetableActor, reason: string) {
  if (current.status === "WITHDRAWN") return getExaminationTimetable(tx, current.id);
  if (current.status !== "PUBLISHED") throw new ExaminationTimetableError("Only the current published timetable can be withdrawn.", 409);
  const now = new Date();
  const changed = await tx.examinationTimetableVersion.updateMany({
    where: { id: current.id, status: "PUBLISHED", version: expectedVersion, currentPublicationKey: { not: null } },
    data: { status: "WITHDRAWN", currentPublicationKey: null, withdrawalReason: reason, withdrawnByUserId: actor.id, withdrawnAt: now, version: { increment: 1 } }
  });
  if (changed.count !== 1) throw staleVersionError();
  const updated = await tx.examinationTimetableVersion.findUniqueOrThrow({ where: { id: current.id } });
  await appendEvent(tx, updated, actor, { eventType: "TIMETABLE_WITHDRAWN", previousStatus: current.status, newStatus: updated.status, reason, snapshot: { versionNumber: updated.versionNumber } });
  return getExaminationTimetable(tx, current.id);
}

async function archive(tx: Prisma.TransactionClient, current: any, expectedVersion: number, actor: TimetableActor, reason: string) {
  if (current.status === "ARCHIVED") return getExaminationTimetable(tx, current.id);
  if (current.status === "PUBLISHED") throw new ExaminationTimetableError("Withdraw the published timetable before archiving it.", 409);
  if (!["DRAFT", "READY_FOR_PUBLICATION", "WITHDRAWN", "REPLACED"].includes(current.status)) {
    throw new ExaminationTimetableError("This timetable cannot be archived from its current state.", 409);
  }
  const changed = await tx.examinationTimetableVersion.updateMany({
    where: { id: current.id, status: current.status, version: expectedVersion },
    data: { status: "ARCHIVED", archiveReason: reason, archivedByUserId: actor.id, archivedAt: new Date(), currentPublicationKey: null, version: { increment: 1 } }
  });
  if (changed.count !== 1) throw staleVersionError();
  const updated = await tx.examinationTimetableVersion.findUniqueOrThrow({ where: { id: current.id } });
  await appendEvent(tx, updated, actor, { eventType: "TIMETABLE_ARCHIVED", previousStatus: current.status, newStatus: updated.status, reason, snapshot: { versionNumber: updated.versionNumber } });
  return getExaminationTimetable(tx, current.id);
}

async function validateDraftRows(tx: TimetableClient, current: any, rows: NormalizedRow[]) {
  if (current.examinationId !== current.classScope.examinationId || current.academicYear !== current.classScope.academicYear) {
    throw new ExaminationTimetableError("The examination timetable cohort no longer matches its examination scope.", 409);
  }
  if (current.className !== current.classScope.className || current.section !== current.classScope.section) {
    throw new ExaminationTimetableError("The examination timetable cohort snapshot is invalid.", 409);
  }
  const papers = await tx.examSubjectPaper.findMany({
    where: { id: { in: rows.map((row) => row.subjectPaperId) }, examinationId: current.examinationId, classScopeId: current.classScopeId, status: "ACTIVE", timetableSubject: { isActive: true } },
    select: { id: true, subjectNameSnapshot: true, paperCode: true, paperName: true }
  });
  if (papers.length !== rows.length) {
    throw new ExaminationTimetableError("Every timetable row must use one active subject paper from this exact examination cohort.", 409, "EXAM_TIMETABLE_PAPER_SCOPE_INVALID");
  }
  const start = dateKey(current.examination.startDate);
  const end = dateKey(current.examination.endDate);
  if (rows.some((row) => dateKey(row.examDate) < start || dateKey(row.examDate) > end)) {
    throw new ExaminationTimetableError("Every paper date must fall within the examination start and end dates.");
  }
  return new Map(papers.map((paper) => [paper.id, paper]));
}

async function publicationIssues(client: TimetableClient, current: any) {
  const issues: string[] = [];
  if (current.examination.status !== "ACTIVE") issues.push("The examination is not active.");
  if (current.classScope.status !== "ACTIVE" || !current.classScope.timetableClassSection.isActive) issues.push("The exact class and section scope is inactive.");
  if (!current.rows.length) issues.push("The timetable has no rows.");
  let normalized: NormalizedRow[] = [];
  try {
    normalized = normalizeRows(current.rows.map((row: any) => ({
      subjectPaperId: row.subjectPaperId,
      examDate: dateKey(row.examDate),
      startTime: row.startTime,
      endTime: row.endTime,
      reportingTime: row.reportingTime,
      venue: row.venue,
      parentInstructions: row.parentInstructions,
      displayOrder: row.displayOrder
    })));
    await validateDraftRows(client, current, normalized);
  } catch (error) {
    issues.push(error instanceof ExaminationTimetableError ? error.message : "The timetable rows are invalid.");
  }
  const activePapers = await client.examSubjectPaper.findMany({
    where: { examinationId: current.examinationId, classScopeId: current.classScopeId, status: "ACTIVE", timetableSubject: { isActive: true } },
    select: { id: true, paperName: true },
    orderBy: { displayOrder: "asc" }
  });
  const rowPaperIds = new Set(current.rows.map((row: any) => row.subjectPaperId));
  const missing = activePapers.filter((paper) => !rowPaperIds.has(paper.id));
  if (missing.length) issues.push(`Add timetable rows for all active papers: ${missing.map((paper) => paper.paperName).join(", ")}.`);
  const internal = overlapIssues(normalized);
  issues.push(...internal);
  if (normalized.length) {
    const otherRows = await client.examinationTimetableRow.findMany({
      where: {
        timetableVersionId: { notIn: [current.id, ...(current.replacesVersionId ? [current.replacesVersionId] : [])] },
        examDate: { in: normalized.map((row) => row.examDate) },
        timetableVersion: {
          academicYear: current.academicYear,
          className: current.className,
          section: current.section,
          status: "PUBLISHED",
          currentPublicationKey: { not: null }
        }
      },
      select: { examDate: true, startTime: true, endTime: true, subjectNameSnapshot: true, paperNameSnapshot: true }
    });
    for (const row of normalized) {
      for (const other of otherRows) {
        if (dateKey(row.examDate) === dateKey(other.examDate) && overlaps(row.startTime, row.endTime, other.startTime, other.endTime)) {
          issues.push(`The ${dateKey(row.examDate)} ${row.startTime}-${row.endTime} slot overlaps a currently published ${other.subjectNameSnapshot} / ${other.paperNameSnapshot} paper for this cohort.`);
        }
      }
    }
  }
  return [...new Set(issues)];
}

function normalizeRows(value: unknown): NormalizedRow[] {
  if (!Array.isArray(value) || value.length > 100) {
    throw new ExaminationTimetableError("A timetable supports between 0 and 100 rows.");
  }
  const paperIds = new Set<string>();
  const displayOrders = new Set<number>();
  return value.map((raw, index) => {
    const row = objectInput(raw);
    const subjectPaperId = requiredId(row.subjectPaperId, `Row ${index + 1} subject paper`);
    if (paperIds.has(subjectPaperId)) throw new ExaminationTimetableError("A subject paper can appear only once in a timetable version.");
    paperIds.add(subjectPaperId);
    const displayOrder = positiveInteger(row.displayOrder ?? index + 1, `Row ${index + 1} display order`, 100);
    if (displayOrders.has(displayOrder)) throw new ExaminationTimetableError("Timetable display order must be unique.");
    displayOrders.add(displayOrder);
    const startTime = timeText(row.startTime, `Row ${index + 1} start time`);
    const endTime = timeText(row.endTime, `Row ${index + 1} end time`);
    if (minutes(endTime) <= minutes(startTime)) throw new ExaminationTimetableError(`Row ${index + 1} end time must be after its start time.`);
    const reportingTime = optionalTime(row.reportingTime, `Row ${index + 1} reporting time`);
    if (reportingTime && minutes(reportingTime) > minutes(startTime)) {
      throw new ExaminationTimetableError(`Row ${index + 1} reporting time cannot be after its start time.`);
    }
    return {
      subjectPaperId,
      examDate: dateOnly(row.examDate, `Row ${index + 1} examination date`),
      startTime,
      endTime,
      reportingTime,
      venue: optionalText(row.venue, `Row ${index + 1} venue`, 160),
      parentInstructions: optionalText(row.parentInstructions, `Row ${index + 1} Parent instructions`, 500),
      displayOrder
    };
  });
}

function overlapIssues(rows: NormalizedRow[]) {
  const issues: string[] = [];
  const sorted = [...rows].sort((a, b) => dateKey(a.examDate).localeCompare(dateKey(b.examDate)) || a.startTime.localeCompare(b.startTime));
  for (let left = 0; left < sorted.length; left += 1) {
    for (let right = left + 1; right < sorted.length; right += 1) {
      if (dateKey(sorted[left].examDate) !== dateKey(sorted[right].examDate)) break;
      if (overlaps(sorted[left].startTime, sorted[left].endTime, sorted[right].startTime, sorted[right].endTime)) {
        issues.push(`Two papers overlap on ${dateKey(sorted[left].examDate)} (${sorted[left].startTime}-${sorted[left].endTime} and ${sorted[right].startTime}-${sorted[right].endTime}).`);
      }
    }
  }
  return issues;
}

function overlaps(startA: string, endA: string, startB: string, endB: string) {
  return minutes(startA) < minutes(endB) && minutes(startB) < minutes(endA);
}

async function appendEvent(tx: TimetableClient, version: any, actor: TimetableActor, input: {
  eventType: string;
  previousStatus: string | null;
  newStatus: string | null;
  reason: string | null;
  snapshot: Record<string, unknown>;
}) {
  await tx.examinationTimetableEvent.create({
    data: {
      timetableVersionId: version.id,
      examinationId: version.examinationId,
      classScopeId: version.classScopeId,
      eventType: input.eventType,
      previousStatus: input.previousStatus,
      newStatus: input.newStatus,
      reason: input.reason,
      actorUserId: actor.id,
      actorLabel: safeActorLabel(actor.name),
      snapshotJson: JSON.stringify(input.snapshot)
    }
  });
}

function assertLeadership(actor: TimetableActor) {
  if (!["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL"].includes(actor.role)) {
    throw new ExaminationTimetableError("Switch to an authorised leadership context for examination timetable changes.", 403, "EXAM_TIMETABLE_LEADERSHIP_REQUIRED");
  }
}

function validationError(issues: string[]) {
  return new ExaminationTimetableError("Resolve every examination timetable validation issue before publication.", 409, "EXAM_TIMETABLE_VALIDATION_FAILED", issues);
}

function staleVersionError() {
  return new ExaminationTimetableError("This timetable changed in another session. Reload it before continuing.", 409, "EXAM_TIMETABLE_STALE_VERSION");
}

function rethrowDatabaseError(error: unknown): never {
  if (error instanceof ExaminationTimetableError) throw error;
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new ExaminationTimetableError("A concurrent timetable version or publication already exists. Reload and try again.", 409, "EXAM_TIMETABLE_CONCURRENT_CONFLICT");
  }
  const message = error instanceof Error ? error.message : "";
  if (message.includes("immutable") || message.includes("append-only") || message.includes("draft")) {
    throw new ExaminationTimetableError("Published timetable history is immutable.", 409, "EXAM_TIMETABLE_IMMUTABLE");
  }
  throw error;
}

function objectInput(value: unknown): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ExaminationTimetableError("A valid timetable request body is required.");
  return value as Record<string, any>;
}

function requiredId(value: unknown, label: string) {
  const text = String(value ?? "").trim();
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(text)) throw new ExaminationTimetableError(`${label} is required.`);
  return text;
}

function optionalId(value: unknown) {
  const text = String(value ?? "").trim();
  return text ? requiredId(text, "Version") : null;
}

function idempotencyKeyText(value: unknown) {
  const text = String(value ?? "").trim();
  if (!/^[A-Za-z0-9_-]{16,100}$/.test(text)) throw new ExaminationTimetableError("A valid idempotency key is required.");
  return text;
}

function governedReason(value: unknown, label: string) {
  const text = safeText(value, label, 1_000);
  if (text.length < 12) throw new ExaminationTimetableError(`${label} must be at least 12 characters.`);
  return text;
}

function safeText(value: unknown, label: string, maximum: number) {
  const text = String(value ?? "").trim();
  if (!text || text.length > maximum || /[\u0000-\u001f\u007f<>]/.test(text)) {
    throw new ExaminationTimetableError(`${label} is required and must be at most ${maximum} safe characters.`);
  }
  return text;
}

function optionalText(value: unknown, label: string, maximum: number) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  return safeText(text, label, maximum);
}

function positiveInteger(value: unknown, label: string, maximum: number) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) throw new ExaminationTimetableError(`${label} must be between 1 and ${maximum}.`);
  return parsed;
}

function dateOnly(value: unknown, label: string) {
  const text = value instanceof Date ? dateKey(value) : String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new ExaminationTimetableError(`${label} is required.`);
  const parsed = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || dateKey(parsed) !== text) throw new ExaminationTimetableError(`${label} is invalid.`);
  return parsed;
}

function timeText(value: unknown, label: string) {
  const text = String(value ?? "").trim();
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(text)) throw new ExaminationTimetableError(`${label} is required in 24-hour time.`);
  return text;
}

function optionalTime(value: unknown, label: string) {
  const text = String(value ?? "").trim();
  return text ? timeText(text, label) : null;
}

function minutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function safeActorLabel(value: string) {
  return value.replace(/[\u0000-\u001f\u007f<>]/g, "").trim().slice(0, 160) || "Authorised leadership user";
}
