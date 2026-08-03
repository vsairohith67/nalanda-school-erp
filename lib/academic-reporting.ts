import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { AuthUser } from "@/lib/auth";
import {
  ACADEMIC_REPORT_FAMILIES,
  ACADEMIC_REPORT_MAX_EXAMS,
  ACADEMIC_REPORT_MAX_SOURCES,
  ACADEMIC_REPORT_MINIMUM_GROUP,
  ACADEMIC_REPORT_SCHEMA_VERSION,
  BOARD_CLASS_DISCLAIMER,
  REPORT_FAMILY_LABELS,
  type AcademicNormalizationRule,
  type AcademicReportAudience,
  type AcademicReportFamily,
  type AcademicReportInput,
  type AcademicReportSection,
  type AcademicReportSource,
  type AcademicReportSummary
} from "@/lib/academic-reporting-types";

type Client = PrismaClient | any;
type Actor = Pick<AuthUser, "id" | "name" | "role">;

export class AcademicReportingError extends Error {
  constructor(message: string, public status = 400, public code = "ACADEMIC_REPORT_ERROR") {
    super(message);
    this.name = "AcademicReportingError";
  }
}

export type BuildAcademicReportOptions = {
  audience: AcademicReportAudience;
  generatedAt?: Date;
  minimumGroupSize?: number;
  expectedCompletion?: Array<{ examinationCode: string; locked: number; issued: number; missing: number }>;
};

export function parseAcademicReportInput(value: unknown): AcademicReportInput {
  const row = object(value, "Report parameters");
  const family = enumValue(row.family, ACADEMIC_REPORT_FAMILIES, "Report family");
  const academicYear = bounded(row.academicYear, 9, "Academic year").toUpperCase();
  if (!/^\d{4}-\d{2}$/.test(academicYear)) throw invalid("Academic year must use YYYY-YY.");
  const examinationCodes = uniqueStrings(row.examinationCodes, ACADEMIC_REPORT_MAX_EXAMS, 60, "Examination codes");
  if (!examinationCodes.length) throw invalid("Select at least one published examination.");
  const normalizationRule = enumValue(row.normalizationRule ?? "NONE", ["NONE", "STRICT_MATCH", "PERCENTAGE_NORMALIZED"] as const, "Normalisation rule");
  const input: AcademicReportInput = {
    family,
    academicYear,
    examinationCodes,
    className: optionalBounded(row.className, 30),
    section: optionalBounded(row.section, 20),
    subjectCode: optionalBounded(row.subjectCode, 60),
    studentReference: optionalBounded(row.studentReference, 120),
    childHandle: optionalBounded(row.childHandle, 500),
    expectedContextVersion: row.expectedContextVersion == null ? null : boundedInteger(row.expectedContextVersion, 0, 1_000_000, "Context version"),
    normalizationRule,
    includeAverageHighest: row.includeAverageHighest === true,
    approvalReference: optionalBounded(row.approvalReference, 160),
    supersedesRunReference: optionalBounded(row.supersedesRunReference, 120)
  };
  if (comparisonFamily(family) && examinationCodes.length < 2) throw invalid("Comparative reports require at least two published examinations.");
  if (comparisonFamily(family) && !input.className) throw invalid("Comparative reports require one explicit class scope.");
  if (family === "CLASS_AVERAGE_HIGHEST" && (!input.includeAverageHighest || !input.approvalReference)) {
    throw new AcademicReportingError("Class average/highest requires an explicit approved reference.", 403, "AVERAGE_HIGHEST_APPROVAL_REQUIRED");
  }
  if (family === "BOARD_CLASS_COMPARATIVE" && !isBoardClass(input.className)) {
    throw invalid("The Class IX/X comparative package is limited to Class IX or X.");
  }
  return input;
}

export function academicComparisonCompatibility(left: AcademicReportSource, right: AcademicReportSource, rule: AcademicNormalizationRule) {
  if (left.formulaVersion !== right.formulaVersion) return incompatible(rule, "Formula versions differ; no equivalence is inferred.");
  if (left.roundingPolicyVersion !== right.roundingPolicyVersion) return incompatible(rule, "Rounding-policy versions differ; no equivalence is inferred.");
  const leftStructure = paperStructure(left, false), rightStructure = paperStructure(right, false);
  if (leftStructure !== rightStructure) return incompatible(rule, "Paper, component, or calculation-mode structure differs.");
  const exact = left.totalMaximum === right.totalMaximum && paperStructure(left, true) === paperStructure(right, true);
  if (exact) return { compatible: true, appliedRule: "STRICT_MATCH" as const, reason: "Formula, structure, maxima, and rounding policy match exactly." };
  if (rule === "PERCENTAGE_NORMALIZED") return { compatible: true, appliedRule: "PERCENTAGE_NORMALIZED" as const, reason: "Maxima differ; comparison uses only the already-published percentage values under the explicit percentage-normalised rule." };
  return incompatible(rule, "Maxima differ. Select the explicit percentage-normalised rule or keep the examinations separate.");
}

export function buildAcademicReportSummary(sources: AcademicReportSource[], input: AcademicReportInput, options: BuildAcademicReportOptions): AcademicReportSummary {
  if (!sources.length && input.family !== "COMPLETION_MISSING_SOURCE") throw new AcademicReportingError("No issued report versions matched the governed scope.", 404, "ISSUED_SOURCE_MISSING");
  if (sources.length > ACADEMIC_REPORT_MAX_SOURCES) throw invalid("The selected report exceeds the bounded source limit.");
  authorizeFamily(options.audience, input.family);
  const ordered = [...sources].sort(sourceOrder);
  const minimumGroup = Math.max(3, Math.min(50, options.minimumGroupSize ?? ACADEMIC_REPORT_MINIMUM_GROUP));
  const comparisons = comparisonEvidence(ordered, input);
  const warnings = compatibilityWarnings(comparisons);
  if (input.normalizationRule === "PERCENTAGE_NORMALIZED") warnings.push("Percentage-normalised comparisons use published percentage values only; marks, maxima, components, and grades are not converted or recalculated.");
  if (isBoardClass(input.className) || input.family === "BOARD_CLASS_COMPARATIVE") warnings.push(BOARD_CLASS_DISCLAIMER);
  const sections = sectionsFor(ordered, input, options, comparisons);
  const suppressed = applyViewerSuppression(sections, options.audience, minimumGroup);
  const generatedAt = (options.generatedAt ?? new Date()).toISOString();
  return {
    schemaVersion: ACADEMIC_REPORT_SCHEMA_VERSION,
    family: input.family,
    title: REPORT_FAMILY_LABELS[input.family],
    generatedAt,
    audience: options.audience,
    parameters: publicParameters(input),
    boardClassDisclaimer: isBoardClass(input.className) || input.family === "BOARD_CLASS_COMPARATIVE" ? BOARD_CLASS_DISCLAIMER : null,
    sourceStatement: "Generated only from immutable issued report-card versions backed by locked governed result snapshots. No raw marks or examination formula were recalculated.",
    sourceVersions: sourceVersionEvidence(ordered, options.audience),
    compatibility: comparisons,
    warnings: [...new Set(warnings)],
    suppressed,
    sections
  };
}

export async function persistAcademicReportRun(client: Client, input: AcademicReportInput, summary: AcademicReportSummary, sources: AcademicReportSource[], actor: Actor, accessScope: Record<string, unknown>, now = new Date()) {
  const definition = definitionFor(input.family);
  const sourceRows = [...sources].sort(sourceOrder);
  const sourceFingerprint = sha256(canonicalJson(sourceRows.map(sourceIdentity)));
  const fingerprint = sha256(canonicalJson({ definitionHash: definition.definitionHash, parameters: persistedParameters(input), accessScope, sourceFingerprint }));
  const existing = await client.academicReportRun.findUnique({ where: { requestFingerprint: fingerprint }, include: runInclude });
  if (existing) return publicRun(existing, true);
  const supersedes = input.supersedesRunReference ? await client.academicReportRun.findUnique({ where: { publicKey: input.supersedesRunReference } }) : null;
  if (input.supersedesRunReference && !supersedes) throw new AcademicReportingError("The superseded report run was not found.", 404, "SUPERSEDED_RUN_MISSING");
  if (supersedes && !leadershipRole(actor.role)) throw new AcademicReportingError("Only school leadership may supersede a report run.", 403, "SUPERSESSION_ROLE_REQUIRED");
  const immutableSummaryJson = canonicalJson(summary);
  const summaryHash = sha256(immutableSummaryJson);
  try {
    const created = await client.$transaction(async (tx: any) => {
      const storedDefinition = await ensureDefinition(tx, definition, actor.id);
      const run = await tx.academicReportRun.create({ data: {
        definitionId: storedDefinition.id,
        requestFingerprint: fingerprint,
        parameterJson: canonicalJson(persistedParameters(input)),
        accessScopeJson: canonicalJson(accessScope),
        normalizationRule: input.normalizationRule,
        sourceFingerprint,
        status: "COMPLETED",
        immutableSummaryJson,
        summaryHash,
        supersedesRunId: supersedes?.id ?? null,
        generatedAt: now,
        createdByUserId: actor.id,
        createdByRole: actor.role
      } });
      for (const [index, source] of sourceRows.entries()) await tx.academicReportSourceReference.create({ data: {
        reportRunId: run.id,
        ordinal: index + 1,
        sourceKind: "LOCKED_RESULT_AND_ISSUED_REPORT",
        sourceRecordId: source.sourceRecordId,
        sourceVersion: source.reportCardVersion,
        publicReference: source.publicReference,
        resultSnapshotId: source.resultSnapshotId,
        reportCardVersionId: source.reportCardVersionId,
        formulaVersion: source.formulaVersion,
        roundingPolicyVersion: source.roundingPolicyVersion,
        schemeVersionRefsJson: canonicalJson(source.schemeVersionReferences),
        attendanceBasisKey: source.attendanceBasisKey,
        sourceLockedAt: new Date(source.sourceLockedAt),
        publishedAt: new Date(source.publishedAt),
        sourceHash: source.sourceHash
      } });
      const events: Array<{ eventType: string; details: Record<string, unknown> }> = [{ eventType: "RUN_GENERATED", details: { family: input.family, sourceCount: sourceRows.length, summaryHash } }];
      if (supersedes) events.push({ eventType: "RUN_SUPERSEDES", details: { supersededRunReference: supersedes.publicKey, reason: input.approvalReference ?? "Governed replacement" } });
      for (const [index, event] of events.entries()) await tx.academicReportAuditEvent.create({ data: {
        eventKey: sha256(`${run.id}|${event.eventType}|${index}`), reportRunId: run.id, eventType: event.eventType,
        actorUserId: actor.id, actorRole: actor.role, safeDetailsJson: canonicalJson(event.details), occurredAt: now
      } });
      return tx.academicReportRun.findUniqueOrThrow({ where: { id: run.id }, include: runInclude });
    });
    return publicRun(created, false);
  } catch (error: any) {
    if (error?.code === "P2002") {
      const duplicate = await client.academicReportRun.findUnique({ where: { requestFingerprint: fingerprint }, include: runInclude });
      if (duplicate) return publicRun(duplicate, true);
    }
    throw error;
  }
}

export async function getAcademicReportRun(client: Client, publicKey: string, actor: Actor) {
  const key = bounded(publicKey, 120, "Report run reference");
  const run = await client.academicReportRun.findUnique({ where: { publicKey: key }, include: runInclude });
  if (!run) throw new AcademicReportingError("Report run was not found.", 404, "REPORT_RUN_MISSING");
  const scope = JSON.parse(run.accessScopeJson) as Record<string, unknown>;
  if (!canReadPersistedRun(actor, run, scope)) throw new AcademicReportingError("Report run was not found.", 404, "REPORT_RUN_MISSING");
  const stale = await detectStaleSources(client, run.sources);
  return { ...publicRun(run, false), stale, staleWarning: stale ? "One or more issued source versions are no longer current. This historical run remains reproducible and unchanged." : null };
}

export async function recordAcademicReportExport(client: Client, runId: string, actor: Actor, format: "CSV" | "PDF", mode: "COLOUR" | "MONOCHROME", now = new Date()) {
  const eventKey = sha256(`${runId}|${actor.id}|${format}|${mode}|${now.toISOString()}|${cryptoRandomSuffix()}`);
  await client.academicReportAuditEvent.create({ data: { eventKey, reportRunId: runId, eventType: "EXPORT_AUTHORIZED", actorUserId: actor.id, actorRole: actor.role, safeDetailsJson: canonicalJson({ format, mode, privacy: "No raw actor ID, Student ID, IP address, user agent, or provider transfer recorded." }), occurredAt: now } });
}

export function academicReportCsv(summary: AcademicReportSummary) {
  const lines: string[][] = [
    ["Report", summary.title], ["Generated at", summary.generatedAt], ["Source", summary.sourceStatement]
  ];
  if (summary.boardClassDisclaimer) lines.push(["Class IX/X boundary", summary.boardClassDisclaimer]);
  for (const warning of summary.warnings) lines.push(["Warning", warning]);
  for (const section of summary.sections) {
    lines.push([], [section.title], section.columns);
    for (const row of section.rows) lines.push(section.columns.map((column) => formulaSafe(row[column])));
  }
  return lines.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export function deterministicAcademicReportFilename(runReference: string, summaryHash: string, extension: "csv" | "pdf") {
  const key = runReference.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 48) || "report";
  return `academic-report-${key}-${summaryHash.slice(0, 10)}.${extension}`;
}

function sectionsFor(sources: AcademicReportSource[], input: AcademicReportInput, options: BuildAcademicReportOptions, comparisons: AcademicReportSummary["compatibility"]): AcademicReportSection[] {
  switch (input.family) {
    case "STUDENT_LONGITUDINAL": return [longitudinalSection(sources, comparisons)];
    case "CLASS_SECTION_SUMMARY": return [classSummarySection(sources, false)];
    case "SUBJECT_PAPER_DISTRIBUTION": return [paperDistributionSection(sources)];
    case "SUBJECT_GROUP_SUMMARY": return [groupSummarySection(sources)];
    case "OUTCOME_DISTRIBUTION": return [outcomeSection(sources)];
    case "COMPARATIVE_DELTA": return [comparisonSection(sources, input)];
    case "COMPLETION_MISSING_SOURCE": return [completionSection(options.expectedCompletion ?? [], sources)];
    case "CLASS_AVERAGE_HIGHEST": return [classSummarySection(sources, true)];
    case "BOARD_CLASS_COMPARATIVE": return [comparisonSection(sources, input), paperDistributionSection(sources)];
    case "LEADERSHIP_SUMMARY": return [classSummarySection(sources, input.includeAverageHighest), outcomeSection(sources), completionSection(options.expectedCompletion ?? [], sources)];
  }
}

function longitudinalSection(sources: AcademicReportSource[], comparisons: AcademicReportSummary["compatibility"]): AcademicReportSection {
  const rows: Array<Record<string, string | number | null>> = [];
  const byStudent = groupBy(sources, (source) => source.studentReference);
  for (const studentSources of byStudent.values()) {
    const ordered = [...studentSources].sort(sourceOrder);
    ordered.forEach((source, index) => {
      const previous = ordered[index - 1];
      const evidence = previous ? comparisons.find((item) => item.leftExam === previous.examinationCode && item.rightExam === source.examinationCode) : null;
      rows.push({ Student: source.studentName, Admission: source.admissionNumber, Examination: source.examinationName, Percentage: fixed(source.percentage), Grade: source.gradeCode ?? "N/A", Result: source.passResult ?? "N/A", "Change (percentage points)": previous && evidence?.compatible ? fixed(source.percentage - previous.percentage) : "N/A" });
    });
  }
  return { id: "longitudinal", title: "Published progress trend", description: "Percentage-point change is shown only for compatible issued examination versions.", columns: ["Student","Admission","Examination","Percentage","Grade","Result","Change (percentage points)"], rows, chart: trendChart(rows) };
}

function classSummarySection(sources: AcademicReportSource[], includeHighest: boolean): AcademicReportSection {
  const rows = [...groupBy(sources, (source) => `${source.examinationCode}|${source.className}|${source.section}`).values()].map((group) => {
    const percentages = group.map((source) => source.percentage);
    return { Examination: group[0].examinationName, Class: group[0].className, Section: group[0].section || "All", "Issued sources": group.length, "Average percentage": fixed(average(percentages)), "Highest percentage": includeHighest ? fixed(Math.max(...percentages)) : "Not approved" };
  });
  return { id: "class-summary", title: "Class/section summary", description: includeHighest ? "Average and highest use published percentages under the recorded approval reference." : "Highest is withheld unless explicitly approved.", columns: ["Examination","Class","Section","Issued sources","Average percentage","Highest percentage"], rows, chart: countChart("Issued report sources", rows, "Examination", "Issued sources") };
}

function paperDistributionSection(sources: AcademicReportSource[]): AcademicReportSection {
  const material = sources.flatMap((source) => source.papers.filter((paper) => !paper.excluded).map((paper) => ({ source, paper })));
  const rows = [...groupBy(material, (item) => `${item.source.examinationCode}|${item.paper.code}`).values()].map((group) => {
    const percentages = group.map((item) => item.paper.percentage), components = group.flatMap((item) => item.paper.components);
    return { Examination: group[0].source.examinationName, "Paper code": group[0].paper.code, Subject: group[0].paper.subjectName, Paper: group[0].paper.paperName, Count: group.length, "Average percentage": fixed(average(percentages)), "Below 40": percentages.filter((value) => value < 40).length, "40-59.99": percentages.filter((value) => value >= 40 && value < 60).length, "60-74.99": percentages.filter((value) => value >= 60 && value < 75).length, "75 and above": percentages.filter((value) => value >= 75).length, Absent: stateCount(components, "ABSENT"), Exempt: stateCount(components, "EXEMPT"), "N/A": stateCount(components, "NOT_APPLICABLE"), "Not entered": stateCount(components, "NOT_ENTERED") };
  });
  const columns = ["Examination","Paper code","Subject","Paper","Count","Average percentage","Below 40","40-59.99","60-74.99","75 and above","Absent","Exempt","N/A","Not entered"];
  return { id: "paper-distribution", title: "Subject and paper distribution", description: "Uses paper totals and component states preserved in issued report snapshots.", columns, rows, chart: countChart("Paper source count", rows, "Paper code", "Count") };
}

function groupSummarySection(sources: AcademicReportSource[]): AcademicReportSection {
  const rows: Array<Record<string, string | number | null>> = [];
  for (const source of sources) {
    for (const combined of source.combinedResults) rows.push({ Examination: source.examinationName, Student: source.studentName, Group: combined.label, Obtained: fixed(combined.obtained), Maximum: fixed(combined.maximum), Percentage: fixed(combined.percentage), "Configured weight": combined.configuredWeight == null ? "N/A" : fixed(combined.configuredWeight) });
    for (const raw of source.groups) {
      const label = stringFrom(raw.label ?? raw.groupName ?? raw.name ?? raw.code, "Configured group");
      const percentage = numberOrNull(raw.percentage);
      rows.push({ Examination: source.examinationName, Student: source.studentName, Group: label, Obtained: valueText(raw.obtained), Maximum: valueText(raw.maximum), Percentage: percentage == null ? "Published group snapshot" : fixed(percentage), "Configured weight": valueText(raw.configuredWeight ?? raw.weight) });
    }
  }
  return { id: "group-summary", title: "Configured subject groups and combined results", description: "Values are copied from the locked published group/combined result snapshot; no combination is invented.", columns: ["Examination","Student","Group","Obtained","Maximum","Percentage","Configured weight"], rows };
}

function outcomeSection(sources: AcademicReportSource[]): AcademicReportSection {
  const grade = counts(sources.map((source) => source.gradeCode ?? "N/A"));
  const result = counts(sources.map((source) => source.passResult ?? "N/A"));
  const components = sources.flatMap((source) => source.papers.flatMap((paper) => paper.components));
  const stateRows: Array<[string, number]> = [
    ["ABSENT", stateCount(components, "ABSENT")], ["EXEMPT", stateCount(components, "EXEMPT")], ["N/A", stateCount(components, "NOT_APPLICABLE")], ["NOT_ENTERED", stateCount(components, "NOT_ENTERED")], ["ZERO", components.filter((row) => row.state === "PRESENT" && row.obtained === 0).length]
  ];
  const rows = [...Object.entries(grade).map(([label, count]) => ({ Distribution: "Grade", Outcome: label, Count: count })), ...Object.entries(result).map(([label, count]) => ({ Distribution: "Pass result", Outcome: label, Count: count })), ...stateRows.map(([label, count]) => ({ Distribution: "Entry state", Outcome: label, Count: count }))];
  return { id: "outcomes", title: "Grade, pass and entry-state distribution", description: "Absent, exempt, not-applicable, not-entered and present-zero remain distinct.", columns: ["Distribution","Outcome","Count"], rows, chart: countChart("Outcome counts", rows, "Outcome", "Count") };
}

function comparisonSection(sources: AcademicReportSource[], input: AcademicReportInput): AcademicReportSection {
  const rows: Array<Record<string, string | number | null>> = [];
  for (const studentSources of groupBy(sources, (source) => source.studentReference).values()) {
    const ordered = input.examinationCodes.map((code) => studentSources.find((source) => source.examinationCode === code)).filter(Boolean) as AcademicReportSource[];
    for (let index = 1; index < ordered.length; index++) {
      const left = ordered[index - 1], right = ordered[index], compatibility = academicComparisonCompatibility(left, right, input.normalizationRule);
      rows.push({ Student: left.studentName, Admission: left.admissionNumber, "Earlier exam": left.examinationName, "Later exam": right.examinationName, Rule: compatibility.appliedRule, Compatibility: compatibility.compatible ? "COMPATIBLE" : "REFUSED", "Earlier percentage": fixed(left.percentage), "Later percentage": fixed(right.percentage), "Change (percentage points)": compatibility.compatible ? fixed(right.percentage - left.percentage) : "N/A", Direction: compatibility.compatible ? direction(right.percentage - left.percentage) : "N/A", Reason: compatibility.reason });
    }
  }
  return { id: "comparison", title: "Governed comparative evidence", description: "Improvement/decline is a numeric historical delta, not an outcome prediction.", columns: ["Student","Admission","Earlier exam","Later exam","Rule","Compatibility","Earlier percentage","Later percentage","Change (percentage points)","Direction","Reason"], rows, chart: changeChart(rows) };
}

function completionSection(expected: NonNullable<BuildAcademicReportOptions["expectedCompletion"]>, sources: AcademicReportSource[]): AcademicReportSection {
  const fallback = [...groupBy(sources, (source) => source.examinationCode).values()].map((group) => ({ examinationCode: group[0].examinationCode, locked: group.length, issued: group.length, missing: 0 }));
  const rows = (expected.length ? expected : fallback).map((row) => ({ Examination: row.examinationCode, "Locked snapshots": row.locked, "Issued versions": row.issued, "Missing issued source": row.missing, Completion: row.locked ? `${fixed((row.issued / row.locked) * 100)}%` : "N/A" }));
  return { id: "completion", title: "Examination completion and missing sources", description: "Counts compare locked governed result snapshots with matching current issued report versions.", columns: ["Examination","Locked snapshots","Issued versions","Missing issued source","Completion"], rows, chart: countChart("Missing issued sources", rows, "Examination", "Missing issued source") };
}

function comparisonEvidence(sources: AcademicReportSource[], input: AcademicReportInput) {
  if (!comparisonFamily(input.family) && input.family !== "STUDENT_LONGITUDINAL") return [];
  const rows: AcademicReportSummary["compatibility"] = [];
  for (let index = 1; index < input.examinationCodes.length; index++) {
    const leftCode = input.examinationCodes[index - 1], rightCode = input.examinationCodes[index];
    const pair = [...groupBy(sources, (source) => source.studentReference).values()].map((group) => [group.find((source) => source.examinationCode === leftCode), group.find((source) => source.examinationCode === rightCode)] as const).find(([left, right]) => left && right);
    if (!pair?.[0] || !pair[1]) { rows.push({ leftExam: leftCode, rightExam: rightCode, compatible: false, appliedRule: input.normalizationRule, reason: "No student has issued locked sources for both examinations." }); continue; }
    const evidence = academicComparisonCompatibility(pair[0], pair[1], input.normalizationRule);
    rows.push({ leftExam: leftCode, rightExam: rightCode, ...evidence });
  }
  return rows;
}

function applyViewerSuppression(sections: AcademicReportSection[], audience: AcademicReportAudience, minimum: number) {
  if (audience !== "VIEWER") return false;
  let suppressed = false;
  for (const section of sections) section.rows = section.rows.map((row) => {
    const count = numericCount(row);
    const safe = Object.fromEntries(Object.entries(row).filter(([key]) => !/student|admission|reference/i.test(key)));
    if (count !== null && count < minimum) {
      suppressed = true;
      return Object.fromEntries(Object.keys(safe).map((key) => [key, /count|source|snapshot|version|average|highest|percentage|missing|completion/i.test(key) ? "SUPPRESSED" : safe[key]]));
    }
    return safe;
  });
  return suppressed;
}

function authorizeFamily(audience: AcademicReportAudience, family: AcademicReportFamily) {
  if (audience === "LEADERSHIP") return;
  if (audience === "LEARNER" && family === "STUDENT_LONGITUDINAL") return;
  if (audience === "TEACHER" && ["SUBJECT_PAPER_DISTRIBUTION","OUTCOME_DISTRIBUTION","COMPLETION_MISSING_SOURCE"].includes(family)) return;
  if (audience === "VIEWER" && ["CLASS_SECTION_SUMMARY","SUBJECT_PAPER_DISTRIBUTION","OUTCOME_DISTRIBUTION","COMPLETION_MISSING_SOURCE","LEADERSHIP_SUMMARY"].includes(family)) return;
  throw new AcademicReportingError("This report family is outside the active role scope.", 403, "REPORT_FAMILY_SCOPE_DENIED");
}

function sourceVersionEvidence(sources: AcademicReportSource[], audience: AcademicReportAudience): AcademicReportSummary["sourceVersions"] {
  if (audience === "VIEWER") return [...groupBy(sources, (source) => source.examinationCode).values()].map((group) => ({ examinationCode: group[0].examinationCode, reportReference: `${group.length} suppressed issued versions`, reportVersion: Math.max(...group.map((row) => row.reportCardVersion)), resultSnapshotVersion: Math.max(...group.map((row) => row.resultSnapshotVersion)), calculationRunReference: "Suppressed aggregate", formulaVersion: uniqueLabel(group.map((row) => row.formulaVersion)), roundingPolicyVersion: uniqueLabel(group.map((row) => row.roundingPolicyVersion)), schemeVersionReferences: ["Suppressed aggregate"], sourceLockedAt: latest(group.map((row) => row.sourceLockedAt)), publishedAt: latest(group.map((row) => row.publishedAt)), attendanceBasisKey: "Suppressed aggregate" }));
  return sources.map((source) => ({ examinationCode: source.examinationCode, reportReference: source.publicReference, reportVersion: source.reportCardVersion, resultSnapshotVersion: source.resultSnapshotVersion, calculationRunReference: source.calculationRunReference, formulaVersion: source.formulaVersion, roundingPolicyVersion: source.roundingPolicyVersion, schemeVersionReferences: source.schemeVersionReferences, sourceLockedAt: source.sourceLockedAt, publishedAt: source.publishedAt, attendanceBasisKey: source.attendanceBasisKey }));
}

const runInclude = { definition: true, sources: { orderBy: { ordinal: "asc" } }, auditEvents: { orderBy: { occurredAt: "asc" } }, supersedesRun: { select: { publicKey: true } }, supersedingRuns: { select: { publicKey: true, generatedAt: true }, orderBy: { generatedAt: "asc" } } } as const;

function publicRun(run: any, idempotent: boolean) { return { id: run.id, runReference: run.publicKey, definition: { code: run.definition.definitionCode, name: run.definition.name, family: run.definition.family, version: run.definition.schemaVersion, minimumGroupSize: run.definition.minimumGroupSize }, parameters: JSON.parse(run.parameterJson), summary: JSON.parse(run.immutableSummaryJson) as AcademicReportSummary, summaryHash: run.summaryHash, sourceFingerprint: run.sourceFingerprint, generatedAt: run.generatedAt.toISOString(), sourceCount: run.sources.length, sourceVersions: run.sources.map((source: any) => ({ kind: source.sourceKind, publicReference: source.publicReference, sourceVersion: source.sourceVersion, formulaVersion: source.formulaVersion, roundingPolicyVersion: source.roundingPolicyVersion, schemeVersionReferences: JSON.parse(source.schemeVersionRefsJson), attendanceBasisKey: source.attendanceBasisKey, sourceLockedAt: source.sourceLockedAt.toISOString(), publishedAt: source.publishedAt.toISOString(), sourceHash: source.sourceHash })), supersedesRunReference: run.supersedesRun?.publicKey ?? null, supersededBy: run.supersedingRuns.map((item: any) => ({ runReference: item.publicKey, generatedAt: item.generatedAt.toISOString() })), audit: run.auditEvents.map((event: any) => ({ eventType: event.eventType, actorRole: event.actorRole, details: JSON.parse(event.safeDetailsJson), occurredAt: event.occurredAt.toISOString() })), idempotent } }

async function ensureDefinition(client: Client, definition: ReturnType<typeof definitionFor>, actorId: string) {
  const existing = await client.academicReportDefinition.findUnique({ where: { definitionCode: definition.definitionCode } });
  if (existing) {
    if (existing.definitionHash !== definition.definitionHash || existing.status !== "ACTIVE") throw new AcademicReportingError("The governed report definition changed or is inactive.", 409, "REPORT_DEFINITION_VERSION_CONFLICT");
    return existing;
  }
  return client.academicReportDefinition.create({ data: { ...definition, createdByUserId: actorId } });
}

function definitionFor(family: AcademicReportFamily) {
  const parameterSchema = { academicYear: "YYYY-YY", examinationCodes: { minimum: comparisonFamily(family) ? 2 : 1, maximum: ACADEMIC_REPORT_MAX_EXAMS }, className: "optional bounded exact value", section: "optional bounded exact value", subjectCode: "optional exact assigned paper", normalizationRule: ["NONE","STRICT_MATCH","PERCENTAGE_NORMALIZED"] };
  const base = { definitionCode: `AR23G-${family}-V1`, name: REPORT_FAMILY_LABELS[family], family, schemaVersion: 1, status: "ACTIVE", parameterSchemaJson: canonicalJson(parameterSchema), minimumGroupSize: ACADEMIC_REPORT_MINIMUM_GROUP };
  return { ...base, definitionHash: sha256(canonicalJson(base)) };
}

async function detectStaleSources(client: Client, sources: any[]) {
  for (const source of sources) {
    const current = await client.studentReportCard.findFirst({ where: { versions: { some: { id: source.reportCardVersionId } } }, select: { status: true, currentVersionNumber: true } });
    if (!current || current.status !== "ISSUED" || current.currentVersionNumber !== source.sourceVersion) return true;
    const snapshot = await client.studentResultSnapshot.findUnique({ where: { id: source.resultSnapshotId }, select: { lockedAt: true, snapshotVersion: true } });
    if (!snapshot?.lockedAt) return true;
  }
  return false;
}

function canReadPersistedRun(actor: Actor, run: any, scope: Record<string, unknown>) {
  if (leadershipRole(actor.role)) return true;
  if (actor.role === "VIEWER") {
    try { return (JSON.parse(run.immutableSummaryJson) as AcademicReportSummary).audience === "VIEWER"; }
    catch { return false; }
  }
  if (run.createdByUserId === actor.id) return true;
  return Array.isArray(scope.allowedUserIds) && scope.allowedUserIds.includes(actor.id);
}

function persistedParameters(input: AcademicReportInput) { const { childHandle: _child, expectedContextVersion: _version, ...safe } = input; return safe; }
function publicParameters(input: AcademicReportInput): AcademicReportSummary["parameters"] { const { childHandle: _child, expectedContextVersion: _version, supersedesRunReference: _supersedes, ...safe } = input; return safe; }
function sourceIdentity(source: AcademicReportSource) { return { sourceRecordId: source.sourceRecordId, reportCardVersionId: source.reportCardVersionId, reportCardVersion: source.reportCardVersion, resultSnapshotId: source.resultSnapshotId, resultSnapshotVersion: source.resultSnapshotVersion, sourceHash: source.sourceHash, formulaVersion: source.formulaVersion, roundingPolicyVersion: source.roundingPolicyVersion, schemeVersionReferences: source.schemeVersionReferences, sourceLockedAt: source.sourceLockedAt, publishedAt: source.publishedAt, attendanceBasisKey: source.attendanceBasisKey }; }

function paperStructure(source: AcademicReportSource, includeMaxima: boolean) { return canonicalJson(source.papers.map((paper) => ({ code: paper.code, calculationMode: paper.calculationMode, ...(includeMaxima ? { maximum: paper.maximum } : {}), components: paper.components.map((component) => ({ code: component.code, ...(includeMaxima ? { maximum: component.maximum, weight: component.contributionWeight } : {}) })) }))); }
function incompatible(rule: AcademicNormalizationRule, reason: string) { return { compatible: false, appliedRule: rule, reason }; }
function compatibilityWarnings(rows: AcademicReportSummary["compatibility"]) { return rows.filter((row) => !row.compatible).map((row) => `${row.leftExam} and ${row.rightExam} were not compared: ${row.reason}`); }
function comparisonFamily(family: AcademicReportFamily) { return ["COMPARATIVE_DELTA","BOARD_CLASS_COMPARATIVE"].includes(family); }
function isBoardClass(value: string | null) { return ["IX","X","9","10","CLASS IX","CLASS X","CLASS 9","CLASS 10"].includes(String(value ?? "").trim().toUpperCase()); }
function leadershipRole(role: string) { return ["SUPER_ADMIN","DIRECTOR","PRINCIPAL"].includes(role); }
function sourceOrder(left: AcademicReportSource, right: AcademicReportSource) { return left.examinationStart.localeCompare(right.examinationStart) || left.examinationCode.localeCompare(right.examinationCode) || left.studentReference.localeCompare(right.studentReference); }
function groupBy<T>(rows: T[], key: (row: T) => string) { const result = new Map<string,T[]>(); for (const row of rows) { const value = key(row), group = result.get(value) ?? []; group.push(row); result.set(value, group); } return result; }
function average(values: number[]) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
function fixed(value: number) { return Number(value.toFixed(2)); }
function direction(value: number) { return value > 0 ? "IMPROVEMENT" : value < 0 ? "DECLINE" : "NO_CHANGE"; }
function counts(values: string[]) { return values.reduce((result, value) => { result[value] = (result[value] ?? 0) + 1; return result; }, {} as Record<string,number>); }
function stateCount(rows: Array<{ state: string }>, state: string) { return rows.filter((row) => row.state === state).length; }
function countChart(label: string, rows: Array<Record<string, any>>, labelKey: string, valueKey: string): AcademicReportSection["chart"] { return { label, series: rows.slice(0,20).map((row,index) => ({ label: String(row[labelKey] ?? ""), value: Number(row[valueKey]) || 0, pattern: (["SOLID","DIAGONAL","DOT","CROSS","HORIZONTAL"] as const)[index % 5] })) }; }
function trendChart(rows: Array<Record<string, any>>): AcademicReportSection["chart"] { return { label: "Published percentage trend", series: rows.slice(0,20).map((row,index) => ({ label: String(row.Examination), value: Number(row.Percentage) || 0, pattern: (["SOLID","DIAGONAL","DOT","CROSS","HORIZONTAL"] as const)[index % 5] })) }; }
function changeChart(rows: Array<Record<string, any>>): AcademicReportSection["chart"] { const directions = counts(rows.map((row) => String(row.Direction))); return { label: "Historical direction counts", series: Object.entries(directions).map(([label,value],index) => ({ label, value, pattern: (["SOLID","DIAGONAL","DOT","CROSS","HORIZONTAL"] as const)[index % 5] })) }; }
function numericCount(row: Record<string, unknown>) { for (const key of ["Count","Issued sources","Locked snapshots","Issued versions"]) if (typeof row[key] === "number") return row[key] as number; return null; }
function uniqueLabel(values: string[]) { const unique = [...new Set(values)]; return unique.length === 1 ? unique[0] : `Multiple governed versions (${unique.length})`; }
function latest(values: string[]) { return [...values].sort().at(-1) ?? new Date(0).toISOString(); }
function valueText(value: unknown) { return value == null || value === "" ? "N/A" : String(value); }
function numberOrNull(value: unknown) { const number = Number(value); return Number.isFinite(number) ? number : null; }
function stringFrom(value: unknown, fallback: string) { const result = String(value ?? "").trim(); return result.slice(0,120) || fallback; }
function canonicalJson(value: unknown): string { return JSON.stringify(sortValue(value)); }
function sortValue(value: unknown): unknown { if (Array.isArray(value)) return value.map(sortValue); if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string,unknown>).sort(([a],[b]) => a.localeCompare(b)).map(([key,item]) => [key,sortValue(item)])); return value; }
function sha256(value: string) { return createHash("sha256").update(value).digest("hex"); }
function cryptoRandomSuffix() { return createHash("sha256").update(`${Date.now()}|${Math.random()}`).digest("hex").slice(0,16); }
function formulaSafe(value: unknown) { const text = String(value ?? ""); return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text; }
function csvCell(value: unknown) { const text = formulaSafe(value); return /[",\r\n]/.test(text) ? `"${text.replaceAll('"','""')}"` : text; }
function object(value: unknown, label: string) { if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid(`${label} must be an object.`); return value as Record<string,unknown>; }
function bounded(value: unknown, maximum: number, label: string) { const result = String(value ?? "").trim(); if (!result || result.length > maximum) throw invalid(`${label} is required and must contain at most ${maximum} characters.`); return result; }
function optionalBounded(value: unknown, maximum: number) { if (value == null || String(value).trim() === "") return null; const result = String(value).trim(); if (result.length > maximum) throw invalid(`A report filter exceeds ${maximum} characters.`); return result; }
function boundedInteger(value: unknown, minimum: number, maximum: number, label: string) { const result = Number(value); if (!Number.isInteger(result) || result < minimum || result > maximum) throw invalid(`${label} is invalid.`); return result; }
function uniqueStrings(value: unknown, maximumItems: number, maximumLength: number, label: string) { if (!Array.isArray(value) || value.length > maximumItems) throw invalid(`${label} must be a bounded list.`); const rows = value.map((item) => bounded(item, maximumLength, label).toUpperCase()); return [...new Set(rows)]; }
function enumValue<T extends readonly string[]>(value: unknown, allowed: T, label: string): T[number] { const result = String(value ?? "").trim().toUpperCase(); if (!allowed.includes(result as T[number])) throw invalid(`${label} is unsupported.`); return result as T[number]; }
function invalid(message: string) { return new AcademicReportingError(message, 400, "INVALID_REPORT_PARAMETERS"); }
