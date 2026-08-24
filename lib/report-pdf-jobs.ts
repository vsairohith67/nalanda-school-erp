import { createHash, randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import type { AuthUser } from "@/lib/auth";
import {
  createReportDownloadToken,
  verifyReportDownloadToken
} from "@/lib/report-download-tokens";
import {
  createReportZip,
  deterministicBatchPackageName,
  deterministicReportPdfName,
  mergeReportPdfs,
  renderReportPdf
} from "@/lib/report-pdf";
import {
  MAX_REPORT_PUBLICATION_BATCH,
  parsePublishedSnapshot,
  ReportPublicationError
} from "@/lib/report-publication";
import type {
  PublishedReportSnapshot,
  ReportColourMode
} from "@/lib/report-publication-types";

type JobClient = PrismaClient | any;
type JobActor = Pick<AuthUser, "id" | "name" | "role">;
export type ReportPdfJobFormat = "INDIVIDUAL_PDF" | "MERGED_PDF" | "ZIP";
export type ReportPdfJobStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";

export type ReportPdfJobManifest = {
  schemaVersion: 1;
  jobKey: string;
  requestHash: string;
  actorUserId: string;
  actorLabel: string;
  format: ReportPdfJobFormat;
  mode: ReportColourMode;
  reportCardNumbers: string[];
  expectedVersions: Record<string, number>;
  status: ReportPdfJobStatus;
  attempt: number;
  total: number;
  completed: number;
  failed: number;
  fileName: string | null;
  artifactFile: string | null;
  artifactSha256: string | null;
  artifactBytes: number | null;
  failureCode: string | null;
  failureSummary: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};

const REPORT_PDF_ROOT = path.join(process.cwd(), "tmp", "report-publication");
const MANIFEST_SUFFIX = ".job.json";
const MAX_ACTIVE_REPORT_PDF_JOBS = 2;
export const MAX_QUEUED_REPORT_PDF_JOBS = 16;
const JOB_EXPIRY_MINUTES = 30;
const scheduler = globalThis as typeof globalThis & {
  __nalandaReportPdfScheduler?: {
    active: number;
    queued: Set<string>;
    queue: Array<() => Promise<void>>;
  };
};

export async function createReportPdfJob(
  client: JobClient,
  rawInput: unknown,
  actor: JobActor,
  now = new Date(),
  options: { deferProcessing?: boolean } = {}
) {
  const input = pdfJobInput(rawInput);
  const requestHash = hash(input.requestKey);
  const jobKey = `RPJ-${requestHash.slice(0, 32)}`;
  ensureRoot();
  const prior = readManifestIfExists(jobKey);
  if (prior) {
    if (
      prior.requestHash !== requestHash ||
      prior.actorUserId !== actor.id ||
      prior.format !== input.format ||
      prior.mode !== input.mode ||
      JSON.stringify(prior.reportCardNumbers) !== JSON.stringify(input.reportCardNumbers)
    ) {
      throw new ReportPublicationError(
        "The PDF request key is already in use.",
        409,
        "IDEMPOTENCY_KEY_CONFLICT"
      );
    }
    return publicPdfJob(prior, true);
  }
  const reports = await loadExactIssuedReports(
    client,
    input.reportCardNumbers,
    input.expectedVersions
  );
  if (input.format === "INDIVIDUAL_PDF" && reports.length !== 1) {
    throw new ReportPublicationError("Individual PDF generation requires one report.");
  }
  if (!options.deferProcessing && reportPdfQueueState().queue.length >= MAX_QUEUED_REPORT_PDF_JOBS) {
    throw new ReportPublicationError("PDF capacity is temporarily exhausted. Retry shortly.", 503, "PDF_QUEUE_SATURATED");
  }
  const manifest: ReportPdfJobManifest = {
    schemaVersion: 1,
    jobKey,
    requestHash,
    actorUserId: actor.id,
    actorLabel: actor.name,
    format: input.format,
    mode: input.mode,
    reportCardNumbers: input.reportCardNumbers,
    expectedVersions: input.expectedVersions,
    status: "QUEUED",
    attempt: 1,
    total: reports.length,
    completed: 0,
    failed: 0,
    fileName: null,
    artifactFile: null,
    artifactSha256: null,
    artifactBytes: null,
    failureCode: null,
    failureSummary: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + JOB_EXPIRY_MINUTES * 60_000).toISOString()
  };
  writeManifest(manifest);
  if (!options.deferProcessing) enqueueReportPdfJob(client, jobKey);
  return publicPdfJob(manifest, false);
}

export function enqueueReportPdfJob(client: JobClient, jobKey: string) {
  const state = reportPdfQueueState();
  if (state.queued.has(jobKey)) return;
  if (state.queue.length >= MAX_QUEUED_REPORT_PDF_JOBS) {
    throw new ReportPublicationError("PDF capacity is temporarily exhausted. Retry shortly.", 503, "PDF_QUEUE_SATURATED");
  }
  state.queued.add(jobKey);
  state.queue.push(async () => {
    try {
      await processReportPdfJob(client, jobKey);
    } finally {
      state.queued.delete(jobKey);
    }
  });
  void drainQueue(state);
}

function reportPdfQueueState() {
  return scheduler.__nalandaReportPdfScheduler ??= {
    active: 0,
    queued: new Set<string>(),
    queue: []
  };
}

export async function processReportPdfJob(
  client: JobClient,
  jobKeyValue: unknown,
  options: { injectFailureAfter?: number; now?: Date } = {}
) {
  const jobKey = validJobKey(jobKeyValue);
  const now = options.now ?? new Date();
  const manifest = readManifest(jobKey);
  if (manifest.status === "COMPLETED" && manifest.artifactFile) {
    const artifact = resolvedArtifactPath(manifest.artifactFile);
    if (existsSync(artifact)) return publicPdfJob(manifest, true);
  }
  if (manifest.status === "RUNNING") {
    throw new ReportPublicationError("This PDF job is already running.", 409, "JOB_ALREADY_RUNNING");
  }
  const reports = await loadExactIssuedReports(
    client,
    manifest.reportCardNumbers,
    manifest.expectedVersions
  );
  const running: ReportPdfJobManifest = {
    ...manifest,
    status: "RUNNING",
    completed: 0,
    failed: 0,
    failureCode: null,
    failureSummary: null,
    updatedAt: now.toISOString()
  };
  writeManifest(running);
  const extension = manifest.format === "ZIP" ? "zip" : "pdf";
  const artifactFile = `${jobKey}-${manifest.attempt}-${randomBytes(8).toString("hex")}.${extension}`;
  const finalPath = resolvedArtifactPath(artifactFile);
  const partialPath = `${finalPath}.part`;
  let completedCount = 0;
  try {
    const rendered: Array<{ report: PublishedReportSnapshot; name: string; bytes: Buffer }> = [];
    for (let index = 0; index < reports.length; index += 1) {
      if (options.injectFailureAfter === index) throw new Error("INJECTED_PDF_FAILURE");
      const report = reports[index];
      const bytes = await renderReportPdf(report, manifest.mode);
      rendered.push({
        report,
        name: deterministicReportPdfName(report, manifest.mode),
        bytes
      });
      completedCount = index + 1;
      writeManifest({
        ...running,
        completed: completedCount,
        updatedAt: new Date().toISOString()
      });
    }
    const artifact =
      manifest.format === "INDIVIDUAL_PDF"
        ? rendered[0].bytes
        : manifest.format === "MERGED_PDF"
          ? await mergeReportPdfs(rendered.map((row) => row.bytes))
          : createReportZip(rendered.map((row) => ({ name: row.name, bytes: row.bytes })));
    const fileName =
      manifest.format === "INDIVIDUAL_PDF"
        ? rendered[0].name
        : deterministicBatchPackageName(
            reports,
            manifest.mode,
            manifest.format === "ZIP" ? "ZIP" : "MERGED_PDF"
          );
    writeFileSync(partialPath, artifact, { flag: "wx" });
    renameSync(partialPath, finalPath);
    const completed: ReportPdfJobManifest = {
      ...running,
      status: "COMPLETED",
      completed: reports.length,
      failed: 0,
      fileName,
      artifactFile,
      artifactSha256: hashBuffer(artifact),
      artifactBytes: artifact.length,
      failureCode: null,
      failureSummary: null,
      updatedAt: new Date().toISOString()
    };
    await appendPdfJobEvents(client, completed, "REPORT_PDF_GENERATED");
    writeManifest(completed);
    return publicPdfJob(completed, false);
  } catch (error) {
    rmSync(partialPath, { force: true });
    rmSync(finalPath, { force: true });
    const failed: ReportPdfJobManifest = {
      ...running,
      status: "FAILED",
      completed: completedCount,
      failed: Math.max(1, running.total - completedCount),
      fileName: null,
      artifactFile: null,
      artifactSha256: null,
      artifactBytes: null,
      failureCode:
        error instanceof Error && error.message === "INJECTED_PDF_FAILURE"
          ? "PDF_RENDER_FAILED"
          : "PDF_OR_PACKAGING_FAILED",
      failureSummary: "PDF generation or packaging failed safely. No artifact was published.",
      updatedAt: new Date().toISOString()
    };
    await appendPdfJobEvents(client, failed, "REPORT_PDF_GENERATION_FAILED");
    writeManifest(failed);
    return publicPdfJob(failed, false);
  }
}

export async function retryReportPdfJob(
  client: JobClient,
  jobKeyValue: unknown,
  actor: JobActor
) {
  const jobKey = validJobKey(jobKeyValue);
  const manifest = readManifest(jobKey);
  if (manifest.actorUserId !== actor.id && !["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL"].includes(actor.role)) {
    throw new ReportPublicationError("This PDF job is outside your authorized scope.", 403);
  }
  if (manifest.status !== "FAILED") {
    throw new ReportPublicationError("Only a failed PDF job can be retried.", 409);
  }
  await loadExactIssuedReports(client, manifest.reportCardNumbers, manifest.expectedVersions);
  const queued: ReportPdfJobManifest = {
    ...manifest,
    status: "QUEUED",
    attempt: manifest.attempt + 1,
    completed: 0,
    failed: 0,
    failureCode: null,
    failureSummary: null,
    updatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + JOB_EXPIRY_MINUTES * 60_000).toISOString()
  };
  writeManifest(queued);
  enqueueReportPdfJob(client, jobKey);
  return publicPdfJob(queued, false);
}

export function getReportPdfJob(jobKeyValue: unknown, actor: Pick<JobActor, "id" | "role">) {
  const manifest = readManifest(validJobKey(jobKeyValue));
  if (manifest.actorUserId !== actor.id && !["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL"].includes(actor.role)) {
    throw new ReportPublicationError("This PDF job is outside your authorized scope.", 403);
  }
  return publicPdfJob(manifest, false);
}

export function listReportPdfJobs(actor: Pick<JobActor, "id" | "role">) {
  ensureRoot();
  cleanupExpiredReportPdfJobs();
  return readdirSync(REPORT_PDF_ROOT)
    .filter((name) => name.endsWith(MANIFEST_SUFFIX))
    .map((name) => readManifestIfExists(name.slice(0, -MANIFEST_SUFFIX.length)))
    .filter((row): row is ReportPdfJobManifest => Boolean(row))
    .filter(
      (row) =>
        row.actorUserId === actor.id ||
        ["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL"].includes(actor.role)
    )
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 50)
    .map((row) => publicPdfJob(row, false));
}

export function readCompletedReportPdfArtifact(
  jobKeyValue: unknown,
  actor: Pick<JobActor, "id" | "role">
) {
  const manifest = readManifest(validJobKey(jobKeyValue));
  if (manifest.actorUserId !== actor.id && !["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL"].includes(actor.role)) {
    throw new ReportPublicationError("This PDF job is outside your authorized scope.", 403);
  }
  if (
    manifest.status !== "COMPLETED" ||
    !manifest.artifactFile ||
    !manifest.fileName ||
    new Date(manifest.expiresAt) <= new Date()
  ) {
    throw new ReportPublicationError("This PDF artifact is unavailable or expired.", 410);
  }
  const artifactPath = resolvedArtifactPath(manifest.artifactFile);
  if (!existsSync(artifactPath)) {
    throw new ReportPublicationError("This PDF artifact is unavailable or expired.", 410);
  }
  const bytes = readFileSync(artifactPath);
  if (hashBuffer(bytes) !== manifest.artifactSha256) {
    throw new ReportPublicationError("This PDF artifact failed integrity verification.", 409);
  }
  return {
    bytes,
    fileName: manifest.fileName,
    contentType: manifest.format === "ZIP" ? "application/zip" : "application/pdf"
  };
}

export async function authorizeReportPdfJobDownload(
  client: JobClient,
  jobKeyValue: unknown,
  actor: JobActor,
  now = new Date()
) {
  const jobKey = validJobKey(jobKeyValue);
  const manifest = readManifest(jobKey);
  if (manifest.actorUserId !== actor.id && !["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL"].includes(actor.role)) {
    throw new ReportPublicationError("This PDF job is outside your authorized scope.", 403);
  }
  if (
    manifest.status !== "COMPLETED" ||
    !manifest.artifactFile ||
    new Date(manifest.expiresAt) <= now
  ) {
    throw new ReportPublicationError("This PDF artifact is unavailable or expired.", 410);
  }
  await appendPdfJobEvents(client, manifest, "REPORT_PDF_DOWNLOAD_AUTHORIZED");
  const token = createReportDownloadToken(
    {
      kind: "STAFF_PDF_JOB",
      action: "DOWNLOAD",
      userId: actor.id,
      resource: jobKey,
      mode: manifest.mode
    },
    { now, lifetimeSeconds: 5 * 60 }
  );
  return {
    url: `/api/report-cards/pdf-jobs/${jobKey}/download?token=${encodeURIComponent(token)}`,
    expiresAt: new Date(now.getTime() + 5 * 60_000).toISOString()
  };
}

export function resolveReportPdfJobDownload(
  jobKeyValue: unknown,
  token: unknown,
  actor: Pick<JobActor, "id" | "role">,
  now = new Date()
) {
  const jobKey = validJobKey(jobKeyValue);
  const payload = verifyReportDownloadToken(token, { now });
  if (
    !payload ||
    payload.kind !== "STAFF_PDF_JOB" ||
    payload.action !== "DOWNLOAD" ||
    payload.userId !== actor.id ||
    payload.resource !== jobKey
  ) {
    throw new ReportPublicationError("PDF download access has expired or is invalid.", 403);
  }
  return readCompletedReportPdfArtifact(jobKey, actor);
}

export function cleanupExpiredReportPdfJobs(now = new Date()) {
  ensureRoot();
  for (const name of readdirSync(REPORT_PDF_ROOT).filter((value) => value.endsWith(MANIFEST_SUFFIX))) {
    const jobKey = name.slice(0, -MANIFEST_SUFFIX.length);
    const manifest = readManifestIfExists(jobKey);
    if (!manifest || new Date(manifest.expiresAt) > now) continue;
    if (manifest.artifactFile) {
      rmSync(resolvedArtifactPath(manifest.artifactFile), { force: true });
    }
    rmSync(manifestPath(jobKey), { force: true });
  }
}

async function loadExactIssuedReports(
  client: JobClient,
  reportCardNumbers: string[],
  expectedVersions: Record<string, number>
) {
  const cards = await client.studentReportCard.findMany({
    where: {
      reportCardNumber: { in: reportCardNumbers },
      status: "ISSUED"
    },
    include: {
      versions: { orderBy: { versionNumber: "desc" }, take: 1 }
    }
  });
  if (cards.length !== reportCardNumbers.length) {
    throw new ReportPublicationError("One or more issued reports are unavailable.", 404);
  }
  const byNumber = new Map(cards.map((card: any) => [card.reportCardNumber, card]));
  return reportCardNumbers.map((number) => {
    const card = byNumber.get(number) as any;
    const version = card?.versions[0];
    if (
      !version ||
      card.currentVersionNumber !== expectedVersions[number] ||
      version.versionNumber !== expectedVersions[number]
    ) {
      throw new ReportPublicationError(
        "A report version changed. Refresh the batch before generating PDFs.",
        409,
        "EXPECTED_VERSION_CONFLICT"
      );
    }
    return parsePublishedSnapshot(version.snapshotJson);
  });
}

async function appendPdfJobEvents(
  client: JobClient,
  manifest: ReportPdfJobManifest,
  eventType:
    | "REPORT_PDF_GENERATED"
    | "REPORT_PDF_GENERATION_FAILED"
    | "REPORT_PDF_DOWNLOAD_AUTHORIZED"
) {
  const cards = await client.studentReportCard.findMany({
    where: { reportCardNumber: { in: manifest.reportCardNumbers } },
    select: {
      id: true,
      reportCardNumber: true,
      versions: { orderBy: { versionNumber: "desc" }, take: 1, select: { id: true } }
    }
  });
  if (!cards.length) return;
  await client.studentReportCardEvent.createMany({
    data: cards.map((card: any) => ({
      reportCardId: card.id,
      versionId: card.versions[0]?.id ?? null,
      eventType,
      eventDate: new Date(manifest.updatedAt),
      previousStatus: "ISSUED",
      newStatus: "ISSUED",
      recordedByUserId: manifest.actorUserId,
      actorLabel: manifest.actorLabel,
      notes: JSON.stringify({
        jobKey: manifest.jobKey,
        requestHash: manifest.requestHash,
        attempt: manifest.attempt,
        format: manifest.format,
        mode: manifest.mode,
        status: manifest.status,
        artifactSha256: manifest.artifactSha256,
        failureCode: manifest.failureCode
      }).slice(0, 2_000)
    }))
  });
}

async function drainQueue(state: NonNullable<typeof scheduler.__nalandaReportPdfScheduler>) {
  while (state.active < MAX_ACTIVE_REPORT_PDF_JOBS && state.queue.length) {
    const task = state.queue.shift()!;
    state.active += 1;
    void task().finally(() => {
      state.active -= 1;
      void drainQueue(state);
    });
  }
}

function pdfJobInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ReportPublicationError("PDF job request must be an object.");
  }
  const row = value as Record<string, any>;
  const requestKey = String(row.requestKey ?? "").trim();
  if (!/^[A-Za-z0-9:_-]{12,120}$/.test(requestKey)) {
    throw new ReportPublicationError("A valid PDF idempotency key is required.");
  }
  const format = String(row.format ?? "").toUpperCase() as ReportPdfJobFormat;
  if (!["INDIVIDUAL_PDF", "MERGED_PDF", "ZIP"].includes(format)) {
    throw new ReportPublicationError("Choose individual PDF, merged PDF, or ZIP.");
  }
  const mode = String(row.mode ?? "").toUpperCase() as ReportColourMode;
  if (!["COLOUR", "MONOCHROME"].includes(mode)) {
    throw new ReportPublicationError("Choose colour or black-and-white output.");
  }
  if (
    !Array.isArray(row.reports) ||
    !row.reports.length ||
    row.reports.length > MAX_REPORT_PUBLICATION_BATCH
  ) {
    throw new ReportPublicationError(
      `Choose between 1 and ${MAX_REPORT_PUBLICATION_BATCH} issued reports.`
    );
  }
  const reportCardNumbers: string[] = [];
  const expectedVersions: Record<string, number> = {};
  for (const item of row.reports) {
    const number = String(item?.reportCardNumber ?? "").trim();
    const version = Number(item?.expectedVersion);
    if (
      !/^[A-Za-z0-9_-]{6,120}$/.test(number) ||
      !Number.isInteger(version) ||
      version < 1
    ) {
      throw new ReportPublicationError("A PDF report selection is invalid.");
    }
    if (expectedVersions[number]) {
      throw new ReportPublicationError("A PDF report selection contains duplicates.");
    }
    reportCardNumbers.push(number);
    expectedVersions[number] = version;
  }
  return { requestKey, format, mode, reportCardNumbers, expectedVersions };
}

function publicPdfJob(manifest: ReportPdfJobManifest, idempotent: boolean) {
  return {
    idempotent,
    jobKey: manifest.jobKey,
    status: manifest.status,
    format: manifest.format,
    mode: manifest.mode,
    attempt: manifest.attempt,
    total: manifest.total,
    completed: manifest.completed,
    failed: manifest.failed,
    fileName: manifest.fileName,
    artifactBytes: manifest.artifactBytes,
    artifactSha256: manifest.artifactSha256,
    failureCode: manifest.failureCode,
    failureSummary: manifest.failureSummary,
    createdAt: manifest.createdAt,
    updatedAt: manifest.updatedAt,
    expiresAt: manifest.expiresAt
  };
}

function ensureRoot() {
  mkdirSync(REPORT_PDF_ROOT, { recursive: true });
}

function manifestPath(jobKey: string) {
  return path.join(REPORT_PDF_ROOT, `${jobKey}${MANIFEST_SUFFIX}`);
}

function readManifest(jobKey: string) {
  const manifest = readManifestIfExists(jobKey);
  if (!manifest) throw new ReportPublicationError("PDF job was not found.", 404);
  return manifest;
}

function readManifestIfExists(jobKey: string): ReportPdfJobManifest | null {
  const target = manifestPath(validJobKey(jobKey));
  if (!existsSync(target)) return null;
  try {
    const parsed = JSON.parse(readFileSync(target, "utf8")) as ReportPdfJobManifest;
    if (
      parsed.schemaVersion !== 1 ||
      parsed.jobKey !== jobKey ||
      !["QUEUED", "RUNNING", "COMPLETED", "FAILED"].includes(parsed.status) ||
      !Array.isArray(parsed.reportCardNumbers)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeManifest(manifest: ReportPdfJobManifest) {
  ensureRoot();
  const target = manifestPath(manifest.jobKey);
  const temporary = `${target}.${randomBytes(6).toString("hex")}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(manifest, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx"
  });
  renameSync(temporary, target);
}

function resolvedArtifactPath(fileName: string) {
  const candidate = path.resolve(REPORT_PDF_ROOT, path.basename(fileName));
  const relative = path.relative(REPORT_PDF_ROOT, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new ReportPublicationError("PDF artifact path is invalid.", 500);
  }
  return candidate;
}

function validJobKey(value: unknown) {
  const text = String(value ?? "").trim();
  if (!/^RPJ-[A-F0-9]{32}$/.test(text)) {
    throw new ReportPublicationError("PDF job reference is invalid.", 404);
  }
  return text;
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}

function hashBuffer(value: Buffer) {
  return createHash("sha256").update(value).digest("hex").toUpperCase();
}
