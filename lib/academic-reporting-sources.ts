import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { AuthUser } from "@/lib/auth";
import { resolveClassworkLearnerContext } from "@/lib/classwork-access";
import { listExactTeacherMarkAssignments } from "@/lib/exam-marks-scope";
import { parsePublishedSnapshot } from "@/lib/report-publication";
import { AcademicReportingError } from "@/lib/academic-reporting";
import { ACADEMIC_REPORT_MAX_SOURCES, type AcademicEntryState, type AcademicReportAudience, type AcademicReportInput, type AcademicReportSource } from "@/lib/academic-reporting-types";

type Client = PrismaClient | any;
type Actor = Pick<AuthUser, "id" | "name" | "role" | "roleAssignmentId" | "guardianId">;

export type LoadedAcademicReportSources = {
  sources: AcademicReportSource[];
  audience: AcademicReportAudience;
  accessScope: Record<string, unknown>;
  expectedCompletion: Array<{ examinationCode: string; locked: number; issued: number; missing: number }>;
};

export async function loadAcademicReportSources(client: Client, input: AcademicReportInput, actor: Actor, sessionId: string): Promise<LoadedAcademicReportSources> {
  const scope = await resolveScope(client, input, actor, sessionId);
  const versions = await client.studentReportCardVersion.findMany({
    where: {
      reportCard: {
        academicYear: input.academicYear,
        status: "ISSUED",
        batch: { status: "ISSUED" },
        ...(input.className ? { className: input.className } : {}),
        ...(input.section ? { section: input.section } : {}),
        ...(scope.studentId ? { studentId: scope.studentId } : {})
      }
    },
    include: { reportCard: { include: { student: { select: { id: true, studentName: true, admissionNo: true } }, batch: { select: { status: true } } } } },
    orderBy: [{ issuedAt: "asc" }, { reportCard: { student: { admissionNo: "asc" } } }, { versionNumber: "asc" }],
    take: ACADEMIC_REPORT_MAX_SOURCES + 1
  });
  if (versions.length > ACADEMIC_REPORT_MAX_SOURCES) throw new AcademicReportingError("The selected report exceeds the bounded issued-source limit.", 400, "SOURCE_RANGE_TOO_LARGE");
  const candidates = versions.flatMap((version: any) => {
    if (version.versionNumber !== version.reportCard.currentVersionNumber) return [];
    try {
      const published = parsePublishedSnapshot(version.snapshotJson);
      if (!input.examinationCodes.includes(published.examination.code.toUpperCase())) return [];
      if (published.academicYear !== input.academicYear || published.student.className !== version.reportCard.className || (published.student.section ?? "") !== (version.reportCard.section ?? "")) return [];
      return [{ version, published }];
    } catch { return []; }
  });
  const snapshotIds = [...new Set(candidates.map((row: any) => row.published.governance.internal.resultSnapshotId))];
  const snapshots = snapshotIds.length ? await client.studentResultSnapshot.findMany({ where: { id: { in: snapshotIds }, lockedAt: { not: null }, runStatus: "LOCKED" }, include: { examination: true, schemeVersion: true } }) : [];
  const snapshotMap = new Map(snapshots.map((snapshot: any) => [snapshot.id, snapshot]));
  const sources: AcademicReportSource[] = [];
  for (const candidate of candidates) {
    const source = sourceFrom(candidate.version, candidate.published, snapshotMap.get(candidate.published.governance.internal.resultSnapshotId));
    if (!source || !scopeAllows(scope, source)) continue;
    const pruned = pruneSubjectScope(source, input.subjectCode, scope.allowedPapers);
    if (pruned) sources.push(pruned);
  }
  if (input.studentReference) {
    const filtered = sources.filter((source) => source.studentReference === input.studentReference);
    if (!filtered.length) throw new AcademicReportingError("The selected Student report scope is unavailable.", 404, "STUDENT_REPORT_SCOPE_MISSING");
    sources.splice(0, sources.length, ...filtered);
  }
  const expectedCompletion = await completionEvidence(client, input, scope, sources);
  return { sources, audience: scope.audience, accessScope: scope.publicScope, expectedCompletion };
}

export async function listAcademicReportFilterOptions(client: Client, actor: Actor, sessionId: string) {
  const rows = await client.studentReportCardVersion.findMany({ where: { reportCard: { status: "ISSUED", batch: { status: "ISSUED" } } }, include: { reportCard: { select: { currentVersionNumber: true, academicYear: true, className: true, section: true, studentId: true } } }, orderBy: { issuedAt: "desc" }, take: 2_001 });
  const options: Array<{ academicYear: string; examinationCode: string; examinationName: string; className: string; section: string }> = [];
  for (const row of rows) {
    if (row.versionNumber !== row.reportCard.currentVersionNumber) continue;
    try {
      const snapshot = parsePublishedSnapshot(row.snapshotJson);
      options.push({ academicYear: row.reportCard.academicYear, examinationCode: snapshot.examination.code, examinationName: snapshot.examination.name, className: row.reportCard.className, section: row.reportCard.section ?? "" });
    } catch {}
  }
  if (["SUPER_ADMIN","DIRECTOR","PRINCIPAL","VIEWER"].includes(actor.role)) return uniqueOptions(options);
  if (actor.role === "TEACHER") {
    const assignments = await listExactTeacherMarkAssignments(client, actor);
    const allowed = new Set(assignments.map((row: any) => `${row.academicYear}|${row.examination.examCode}|${row.className}|${row.section}`));
    return uniqueOptions(options.filter((row) => allowed.has(`${row.academicYear}|${row.examinationCode}|${row.className}|${row.section}`)));
  }
  if (actor.role === "PARENT" || actor.role === "STUDENT") {
    const years = [...new Set(options.map((row) => row.academicYear))].slice(0, 6), allowed = new Set<string>();
    for (const academicYear of years) try { const context = await resolveClassworkLearnerContext(client, { user: actor as AuthUser, sessionId, academicYear }); allowed.add(`${academicYear}|${context.className}|${context.section}`); } catch {}
    return uniqueOptions(options.filter((row) => allowed.has(`${row.academicYear}|${row.className}|${row.section}`)));
  }
  return [];
}

type Scope = {
  audience: AcademicReportAudience;
  studentId: string | null;
  allowedPapers: Map<string, Set<string>> | null;
  allowedTargets: Set<string> | null;
  publicScope: Record<string, unknown>;
};

async function resolveScope(client: Client, input: AcademicReportInput, actor: Actor, sessionId: string): Promise<Scope> {
  if (["SUPER_ADMIN","DIRECTOR","PRINCIPAL"].includes(actor.role)) return { audience: "LEADERSHIP", studentId: null, allowedPapers: null, allowedTargets: null, publicScope: { role: actor.role, academicYear: input.academicYear, className: input.className, section: input.section } };
  if (actor.role === "VIEWER") return { audience: "VIEWER", studentId: null, allowedPapers: null, allowedTargets: null, publicScope: { role: "VIEWER", academicYear: input.academicYear, className: input.className, section: input.section, suppression: true } };
  if (actor.role === "TEACHER") {
    const assignments = await listExactTeacherMarkAssignments(client, actor, input.academicYear);
    const allowedTargets = new Set<string>(), allowedPapers = new Map<string,Set<string>>();
    for (const row of assignments) {
      const target = `${row.examination.examCode.toUpperCase()}|${row.className}|${row.section}`;
      allowedTargets.add(target);
      const papers = allowedPapers.get(target) ?? new Set<string>(); papers.add(row.subjectPaper.paperCode.toUpperCase()); allowedPapers.set(target, papers);
    }
    if (!allowedTargets.size) throw denied("No exact active Teacher reporting assignment is available.");
    if (input.subjectCode && ![...allowedPapers.values()].some((papers) => papers.has(input.subjectCode!.toUpperCase()))) throw denied("The requested subject is outside this Teacher's exact assignment.");
    return { audience: "TEACHER", studentId: null, allowedPapers, allowedTargets, publicScope: { role: "TEACHER", academicYear: input.academicYear, targets: [...allowedTargets].sort(), papers: [...new Set([...allowedPapers.values()].flatMap((set) => [...set]))].sort(), allowedUserIds: [actor.id] } };
  }
  if (actor.role === "PARENT" || actor.role === "STUDENT") {
    const learner = await resolveClassworkLearnerContext(client, { user: actor as AuthUser, sessionId, academicYear: input.academicYear, childHandle: input.childHandle, expectedContextVersion: input.expectedContextVersion });
    if (input.className && input.className !== learner.className || input.section && input.section !== learner.section) throw new AcademicReportingError("The linked/self report scope is unavailable.", 404, "LEARNER_REPORT_SCOPE_MISSING");
    return { audience: "LEARNER", studentId: learner.studentId, allowedPapers: null, allowedTargets: new Set(input.examinationCodes.map((code) => `${code}|${learner.className}|${learner.section}`)), publicScope: { role: actor.role, academicYear: learner.academicYear, className: learner.className, section: learner.section, studentReference: publicStudentReference(learner.studentId), allowedUserIds: [actor.id] } };
  }
  throw denied("The active role is not authorised for academic reporting.");
}

function sourceFrom(version: any, published: any, snapshot: any): AcademicReportSource | null {
  if (!snapshot || snapshot.studentId !== version.reportCard.studentId || snapshot.snapshotVersion !== published.governance.resultSnapshotVersion || snapshot.formulaVersion !== published.governance.formulaVersion || snapshot.roundingPolicyVersion !== published.governance.roundingPolicyVersion) return null;
  if (number(snapshot.percentage) !== number(published.content.percentage) || number(snapshot.totalMaximum) !== number(published.content.totalMaximum)) return null;
  const schemeVersionReferences = stringRefs(snapshot.sourceSchemeVersionsJson);
  const sourceHash = hash(`${version.id}|${version.versionNumber}|${version.snapshotJson}|${snapshot.id}|${snapshot.inputFingerprint}|${snapshot.snapshotJson}`);
  return {
    reportCardVersionId: version.id, reportCardVersion: version.versionNumber, resultSnapshotId: snapshot.id, resultSnapshotVersion: snapshot.snapshotVersion,
    sourceRecordId: `${snapshot.id}:${version.id}`, sourceHash, publicReference: published.publicationReference, academicYear: published.academicYear,
    examinationCode: published.examination.code.toUpperCase(), examinationName: published.examination.name, examinationType: snapshot.examination.examType,
    examinationStart: dateIso(snapshot.examination.startDate), examinationEnd: dateIso(snapshot.examination.endDate), className: published.student.className, section: published.student.section ?? "",
    studentId: snapshot.studentId, studentReference: publicStudentReference(snapshot.studentId), studentName: published.student.name, admissionNumber: published.student.admissionNumber,
    totalObtained: number(published.content.totalObtained), totalMaximum: number(published.content.totalMaximum), percentage: number(published.content.percentage), gradeCode: published.content.grade?.code ?? null, passResult: published.content.passResult ?? null,
    papers: published.content.papers.map((paper: any) => ({ code: String(paper.code).toUpperCase(), subjectName: String(paper.subjectName), paperName: String(paper.paperName), calculationMode: String(paper.calculationMode), obtained: number(paper.obtained), maximum: number(paper.maximum), percentage: number(paper.percentage), excluded: Boolean(paper.excluded), components: paper.components.map((component: any) => ({ code: String(component.code).toUpperCase(), name: String(component.name), state: entryState(component.state), obtained: component.obtained == null ? null : number(component.obtained), maximum: number(component.maximum), contributionWeight: component.contributionWeight == null ? null : number(component.contributionWeight), contribution: component.contribution == null ? null : number(component.contribution) })) })),
    groups: Array.isArray(published.content.groups) ? published.content.groups : [], combinedResults: (Array.isArray(published.content.combinedResults) ? published.content.combinedResults : []).map((row: any) => ({ label: String(row.label), obtained: number(row.obtained), maximum: number(row.maximum), percentage: number(row.percentage), configuredWeight: row.configuredWeight == null ? null : number(row.configuredWeight) })),
    formulaVersion: snapshot.formulaVersion, roundingPolicyVersion: snapshot.roundingPolicyVersion, schemeVersionReferences, calculationRunReference: published.governance.calculationRunReference,
    sourceLockedAt: dateIso(snapshot.lockedAt), publishedAt: dateIso(version.issuedAt), templateVersion: published.template.version, templateBindingVersion: published.template.bindingVersion,
    attendanceBasisKey: version.calendarBasisVersionKey ?? attendanceKey(published.content.attendance), attendance: { totalLockedDays: Number(published.content.attendance?.totalLockedDays ?? 0), recordedDays: Number(published.content.attendance?.recordedDays ?? 0), presentEquivalentDays: Number(published.content.attendance?.presentEquivalentDays ?? 0) }
  };
}

function pruneSubjectScope(source: AcademicReportSource, requested: string | null, allowed: Map<string,Set<string>> | null) {
  let codes: Set<string> | null = requested ? new Set([requested.toUpperCase()]) : null;
  if (allowed) { const assigned = allowed.get(`${source.examinationCode}|${source.className}|${source.section}`); if (!assigned) return null; codes = codes ? new Set([...codes].filter((code) => assigned.has(code))) : assigned; }
  if (!codes) return source;
  const papers = source.papers.filter((paper) => codes!.has(paper.code));
  if (!papers.length) return null;
  if (papers.length === 1) return { ...source, papers, totalObtained: papers[0].obtained, totalMaximum: papers[0].maximum, percentage: papers[0].percentage, gradeCode: null, passResult: null, groups: [], combinedResults: [] };
  return { ...source, papers, gradeCode: null, passResult: null, groups: [], combinedResults: [] };
}

function scopeAllows(scope: Scope, source: AcademicReportSource) {
  if (scope.studentId && source.studentId !== scope.studentId) return false;
  if (scope.allowedTargets && !scope.allowedTargets.has(`${source.examinationCode}|${source.className}|${source.section}`)) return false;
  return true;
}

async function completionEvidence(client: Client, input: AcademicReportInput, scope: Scope, sources: AcademicReportSource[]) {
  const locked = await client.studentResultSnapshot.findMany({ where: { lockedAt: { not: null }, runStatus: "LOCKED", examination: { academicYear: input.academicYear, examCode: { in: input.examinationCodes } }, ...(input.className ? { classScope: { className: input.className, ...(input.section ? { section: input.section } : {}) } } : {}), ...(scope.studentId ? { studentId: scope.studentId } : {}) }, include: { examination: { select: { examCode: true } }, classScope: { select: { className: true, section: true } } }, take: ACADEMIC_REPORT_MAX_SOURCES + 1 });
  if (locked.length > ACADEMIC_REPORT_MAX_SOURCES) throw new AcademicReportingError("The selected completion range exceeds the bounded source limit.", 400, "SOURCE_RANGE_TOO_LARGE");
  const allowedLocked = scope.allowedTargets ? locked.filter((row: any) => scope.allowedTargets!.has(`${row.examination.examCode.toUpperCase()}|${row.classScope.className}|${row.classScope.section}`)) : locked;
  const issuedIds = new Set(sources.map((source) => source.resultSnapshotId));
  return input.examinationCodes.map((code) => { const rows = allowedLocked.filter((row: any) => row.examination.examCode.toUpperCase() === code), issued = rows.filter((row: any) => issuedIds.has(row.id)).length; return { examinationCode: code, locked: rows.length, issued, missing: rows.length - issued }; });
}

function uniqueOptions(rows: Array<{ academicYear: string; examinationCode: string; examinationName: string; className: string; section: string }>) { return [...new Map(rows.map((row) => [`${row.academicYear}|${row.examinationCode}|${row.className}|${row.section}`,row])).values()].slice(0,500); }
function stringRefs(value: string) { try { const parsed = JSON.parse(value); const rows = Array.isArray(parsed) ? parsed : parsed && typeof parsed === "object" ? Object.values(parsed) : []; return [...new Set(rows.flatMap((item: any) => typeof item === "string" ? [item] : item?.schemeVersionId ? [String(item.schemeVersionId)] : item?.id ? [String(item.id)] : []))].sort(); } catch { return []; } }
function entryState(value: unknown): AcademicEntryState { const state = String(value ?? "NOT_ENTERED").toUpperCase(); if (["PRESENT","ABSENT","EXEMPT","NOT_APPLICABLE","NOT_ENTERED"].includes(state)) return state as AcademicEntryState; return "NOT_ENTERED"; }
function publicStudentReference(id: string) { return `LEARNER-${hash(id).slice(0,16).toUpperCase()}`; }
function attendanceKey(value: any) { return value ? `ATT-${hash(JSON.stringify(value)).slice(0,16).toUpperCase()}` : null; }
function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }
function number(value: unknown) { const result = Number(value); if (!Number.isFinite(result)) throw new AcademicReportingError("A published numeric source is invalid.", 409, "PUBLISHED_SOURCE_INVALID"); return Number(result.toFixed(6)); }
function dateIso(value: unknown) { const date = value instanceof Date ? value : new Date(String(value)); if (Number.isNaN(date.getTime())) throw new AcademicReportingError("A published source date is invalid.", 409, "PUBLISHED_SOURCE_INVALID"); return date.toISOString(); }
function denied(message: string) { return new AcademicReportingError(message, 403, "ACADEMIC_REPORT_SCOPE_DENIED"); }
