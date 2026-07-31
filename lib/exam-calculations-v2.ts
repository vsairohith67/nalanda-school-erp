// @ts-nocheck -- runtime-validated calculation graph; kept flat to avoid generated-type heap exhaustion.
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { AuthUser } from "@/lib/auth";
import { exactEligibleStudents } from "@/lib/exam-marks-scope";
import { ExamMarksError } from "@/lib/exam-marks";

type ExamActor = Pick<AuthUser, "id" | "role" | "name">;
type ExamClient = any;

export const EXAM_CALCULATION_FORMULA_V1 = "RC_CALC_V1_PAPER_NORMALIZED";
export const APPROVED_ENTRY_STATE_POLICY_V1 = {
  NOT_ENTERED: "BLOCK",
  PRESENT: "USE_MARK",
  ABSENT: "ZERO",
  EXEMPT: "EXCLUDE",
  NOT_APPLICABLE: "EXCLUDE"
} as const;

const calculationAttempts = new Map<string, number[]>();

function rateLimitCalculation(actorId: string, now = Date.now()) {
  const recent = (calculationAttempts.get(actorId) ?? []).filter((time) => now - time < 60_000);
  if (recent.length >= 5) throw new ExamMarksError("Too many calculation requests. Wait one minute and try again.", 429);
  recent.push(now);
  calculationAttempts.set(actorId, recent);
}

function safeId(value: unknown, label: string) {
  const id = String(value ?? "").trim();
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(id)) throw new ExamMarksError(`${label} is invalid.`);
  return id;
}

function requestKey(value: unknown, label: string) {
  const key = String(value ?? "").trim();
  if (!/^[A-Za-z0-9:_-]{12,120}$/.test(key)) throw new ExamMarksError(`A valid ${label} request key is required.`);
  return key;
}

function reasonText(value: unknown, label: string) {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!text || text.length > 500 || /[\u0000-\u001F\u007F]/.test(text)) {
    throw new ExamMarksError(`${label} is required and must be 500 characters or fewer.`);
  }
  return text;
}

function eventKey(parts: string[]) {
  return createHash("sha256").update(parts.join("|")).digest("hex").toUpperCase();
}

function fingerprint(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").toUpperCase();
}

function roundPolicy(value: Prisma.Decimal, policy: string) {
  if (policy !== "RC05_V1_DECIMAL6_HALF_UP2") {
    throw new ExamMarksError("The frozen scheme uses an unsupported rounding policy.", 409);
  }
  return value.toDecimalPlaces(6, Prisma.Decimal.ROUND_HALF_UP).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

function decimalJson(value: Prisma.Decimal | null | undefined) {
  return value == null ? null : value.toFixed(2);
}

const calculationInclude = {
  examination: true,
  classScope: true,
  subjectPaper: true,
  component: true,
  schemeVersion: true,
  entries: {
    include: { student: { select: { admissionNo: true, studentName: true } } },
    orderBy: { studentId: "asc" }
  }
} as const;

type CalculationContextData = {
  examination: {
    id: string;
    examCode: string;
    name: string;
    academicYear: string;
    startDate: Date;
    endDate: Date;
    teacherAssignments: any[];
    subjectPapers: any[];
    subjectGroups: any[];
    gradeScaleVersions: any[];
    schemeVersions: any[];
    [key: string]: any;
  };
  classScope: any;
  sheets: any[];
  students: any[];
};

async function calculationContext(
  client: ExamClient,
  examinationId: string,
  classScopeId: string
): Promise<CalculationContextData> {
  const examination = await client.examination.findFirst({
    where: { id: examinationId, status: "ACTIVE" },
    include: {
      classScopes: { where: { id: classScopeId, status: "ACTIVE" } },
      subjectPapers: {
        where: { classScopeId, status: "ACTIVE" },
        orderBy: { displayOrder: "asc" }
      },
      subjectGroups: {
        where: { classScopeId, status: "ACTIVE" },
        include: {
          members: {
            include: { subjectPaper: true },
            orderBy: { displayOrder: "asc" }
          }
        },
        orderBy: { displayOrder: "asc" }
      },
      gradeScaleVersions: {
        where: { classScopeId, status: "ACTIVE", frozenAt: { not: null } },
        include: { bands: { orderBy: { displayOrder: "asc" } } },
        orderBy: { versionNumber: "desc" },
        take: 1
      },
      schemeVersions: {
        where: { classScopeId, status: "ACTIVE", frozenAt: { not: null } },
        include: { components: { orderBy: { displayOrder: "asc" } } },
        orderBy: { versionNumber: "desc" }
      },
      teacherAssignments: {
        where: {
          classScopeId,
          status: "ACTIVE",
          assignmentRole: "PRIMARY_SUBMITTER",
          staffMember: {
            status: "ACTIVE",
            user: { isActive: true, role: "TEACHER" },
            timetableTeacher: { is: { isActive: true } }
          }
        },
        include: {
          staffMember: { select: { displayName: true, fullName: true } },
          subjectPaper: true,
          component: true,
          schemeVersion: true
        }
      }
    }
  });
  const classScope = examination?.classScopes[0];
  if (!examination || !classScope) throw new ExamMarksError("The active examination class scope was not found.", 404);
  const sheets = await client.examMarkSheet.findMany({
    where: { examinationId, classScopeId, currentKey: { not: null } },
    include: calculationInclude,
    orderBy: [{ subjectPaper: { displayOrder: "asc" } }, { component: { displayOrder: "asc" } }]
  });
  const students = await exactEligibleStudents(client, classScope);
  return { examination, classScope, sheets, students };
}

function readinessIssues(context: CalculationContextData) {
  const issues: string[] = [];
  const sheetByComponent = new Map<string, any>(context.sheets.map((sheet) => [sheet.componentId, sheet]));
  for (const assignment of context.examination.teacherAssignments) {
    if (!assignment.component.isRequired) continue;
    const sheet = sheetByComponent.get(assignment.componentId);
    const version = sheet;
    if (!sheet) {
      issues.push(`${assignment.subjectPaper.paperName} / ${assignment.component.name} has not started.`);
      continue;
    }
    if (!["SUBMITTED", "RESUBMITTED", "MODERATED", "LOCKED"].includes(version.status)) {
      issues.push(`${assignment.subjectPaper.paperName} / ${assignment.component.name} is ${version.status.replaceAll("_", " ").toLowerCase()}.`);
    }
    const eligible = new Set(context.students.map((student) => student.studentId));
    if (version.entries.some((entry: any) => !eligible.has(entry.studentId) || entry.entryState === "NOT_ENTERED")) {
      issues.push(`${assignment.subjectPaper.paperName} / ${assignment.component.name} has missing or out-of-cohort entries.`);
    }
    if (version.schemeVersionId !== assignment.schemeVersionId || sheet.schemeVersionId !== assignment.schemeVersionId) {
      issues.push(`${assignment.subjectPaper.paperName} / ${assignment.component.name} no longer matches its frozen scheme.`);
    }
  }
  if (!context.examination.teacherAssignments.length) issues.push("No active primary Teacher component assignments are configured.");
  if (!context.students.length) issues.push("The exact class and section has no active enrolled Students.");
  return [...new Set(issues)];
}

function sourceMaterial(context: CalculationContextData) {
  return context.sheets
    .map((sheet) => {
      const version = sheet;
      return {
        sheetId: sheet.id,
        sheetVersionId: version.id,
        versionNumber: version.versionNumber,
        schemeVersionId: version.schemeVersionId,
        subjectPaperId: sheet.subjectPaperId,
        componentId: sheet.componentId,
        entries: version.entries.map((entry: any) => ({
          id: entry.id,
          studentId: entry.studentId,
          state: entry.entryState,
          mark: entry.marksObtained?.toString() ?? null,
          rowVersion: entry.rowVersion
        }))
      };
    })
    .sort((a, b) => a.sheetVersionId.localeCompare(b.sheetVersionId));
}

type ComponentResult = {
  componentId: string;
  componentCode: string;
  componentName: string;
  state: string;
  obtained: Prisma.Decimal | null;
  maximum: Prisma.Decimal;
  contributionWeight: Prisma.Decimal | null;
  contribution: Prisma.Decimal | null;
  sourceSheetVersionId: string;
  sourceEntryId: string;
  sourceRowVersion: number;
};

function paperResult(
  sheets: any[],
  paperId: string,
  studentId: string
) {
  const paperSheets = sheets.filter((sheet) => sheet.subjectPaperId === paperId);
  if (!paperSheets.length) throw new ExamMarksError("A configured paper has no source sheets.", 409);
  const schemeId = paperSheets[0].schemeVersionId;
  if (paperSheets.some((sheet) => sheet.schemeVersionId !== schemeId)) {
    throw new ExamMarksError("A paper mixes incompatible frozen scheme versions.", 409);
  }
  const scheme = paperSheets[0].schemeVersion;
  const components: ComponentResult[] = paperSheets.map((sheet) => {
    const version = sheet;
    const entry = version.entries.find((row: any) => row.studentId === studentId);
    if (!entry || entry.entryState === "NOT_ENTERED") throw new ExamMarksError("A required Student component is not entered.", 409);
    const state = entry.entryState;
    const excluded = state === "EXEMPT" || state === "NOT_APPLICABLE";
    const obtained = state === "PRESENT" ? entry.marksObtained : state === "ABSENT" ? new Prisma.Decimal(0) : null;
    if (state === "PRESENT" && obtained === null) throw new ExamMarksError("A Present source entry has no numeric mark.", 409);
    if (!excluded && sheet.component.maximumMarks.lte(0)) throw new ExamMarksError("A component has an unsafe zero denominator.", 409);
    const contribution = excluded || scheme.calculationMode !== "WEIGHTED_NORMALIZED"
      ? null
      : obtained!.div(sheet.component.maximumMarks).mul(sheet.component.contributionWeight!);
    return {
      componentId: sheet.componentId,
      componentCode: sheet.component.componentCode,
      componentName: sheet.component.name,
      state,
      obtained,
      maximum: sheet.component.maximumMarks,
      contributionWeight: sheet.component.contributionWeight,
      contribution,
      sourceSheetVersionId: version.id,
      sourceEntryId: entry.id,
      sourceRowVersion: entry.rowVersion
    };
  });
  const included = components.filter((component) => !["EXEMPT", "NOT_APPLICABLE"].includes(component.state));
  if (!included.length) {
    return {
      paperId,
      scheme,
      components,
      obtained: new Prisma.Decimal(0),
      maximum: new Prisma.Decimal(0),
      percentage: new Prisma.Decimal(0),
      excluded: true
    };
  }
  let obtained: Prisma.Decimal;
  let maximum: Prisma.Decimal;
  if (scheme.calculationMode === "RAW_SUM") {
    obtained = included.reduce((sum, component) => sum.add(component.obtained!), new Prisma.Decimal(0));
    maximum = included.reduce((sum, component) => sum.add(component.maximum), new Prisma.Decimal(0));
  } else if (scheme.calculationMode === "WEIGHTED_NORMALIZED") {
    const weights = included.reduce((sum, component) => sum.add(component.contributionWeight!), new Prisma.Decimal(0));
    if (weights.lte(0)) throw new ExamMarksError("Weighted calculation has an unsafe zero denominator.", 409);
    obtained = included.reduce((sum, component) => sum.add(component.contribution!), new Prisma.Decimal(0));
    maximum = weights;
  } else {
    throw new ExamMarksError("The frozen scheme has an unsupported calculation mode.", 409);
  }
  if (maximum.lte(0)) throw new ExamMarksError("A paper has an unsafe zero denominator.", 409);
  return {
    paperId,
    scheme,
    components,
    obtained: roundPolicy(obtained, scheme.roundingPolicyVersion),
    maximum: roundPolicy(maximum, scheme.roundingPolicyVersion),
    percentage: roundPolicy(obtained.div(maximum).mul(100), scheme.roundingPolicyVersion),
    excluded: false
  };
}

function groupResults(
  groups: any[],
  papers: Array<ReturnType<typeof paperResult>>
) {
  const byPaper = new Map(papers.map((paper) => [paper.paperId, paper]));
  return groups.map((group) => {
    const members: Array<{ member: any; paper: PaperCalculationResult }> = group.members.map((member: any) => {
      const paper = byPaper.get(member.subjectPaperId);
      if (!paper) throw new ExamMarksError(`Subject group ${group.groupName} has a missing paper source.`, 409);
      return { member, paper };
    }).filter((row: { paper: PaperCalculationResult }) => !row.paper.excluded);
    if (!members.length) return { groupCode: group.groupCode, groupName: group.groupName, excluded: true };
    if (group.calculationMode === "RAW_SUM") {
      const obtained = members.reduce((sum: Prisma.Decimal, row) => sum.add(row.paper.percentage), new Prisma.Decimal(0));
      const maximum = new Prisma.Decimal(members.length * 100);
      return {
        groupCode: group.groupCode,
        groupName: group.groupName,
        calculationMode: group.calculationMode,
        obtained: decimalJson(obtained),
        maximum: decimalJson(maximum),
        percentage: decimalJson(obtained.div(maximum).mul(100)),
        excluded: false
      };
    }
    if (group.calculationMode !== "WEIGHTED_NORMALIZED") {
      throw new ExamMarksError(`Subject group ${group.groupName} uses an unsupported mode.`, 409);
    }
    const weight = members.reduce((sum: Prisma.Decimal, row) => sum.add(row.member.contributionWeight ?? 0), new Prisma.Decimal(0));
    if (!weight.equals(100)) throw new ExamMarksError(`Subject group ${group.groupName} weights must total exactly 100%.`, 409);
    const obtained = members.reduce((sum: Prisma.Decimal, row) =>
      sum.add(row.paper.percentage.div(100).mul(row.member.contributionWeight!)), new Prisma.Decimal(0));
    return {
      groupCode: group.groupCode,
      groupName: group.groupName,
      calculationMode: group.calculationMode,
      obtained: decimalJson(obtained),
      maximum: "100.00",
      percentage: decimalJson(obtained),
      excluded: false
    };
  });
}

function gradeFor(
  percentage: Prisma.Decimal,
  gradeScale: { bands: any[] } | undefined
) {
  const band = gradeScale?.bands.find((row) =>
    percentage.gte(row.minimumPercentage) && percentage.lte(row.maximumPercentage)
  );
  return band ? { code: band.gradeCode, label: band.label, point: band.gradePoint } : null;
}

type PaperCalculationResult = ReturnType<typeof paperResult>;
type ProvisionalStudentResult = {
  enrollment: any;
  paperResults: PaperCalculationResult[];
  groupResults: ReturnType<typeof groupResults>;
  totalObtained: Prisma.Decimal;
  totalMaximum: Prisma.Decimal;
  percentage: Prisma.Decimal;
  grade: ReturnType<typeof gradeFor>;
  passResult: string | null;
  attendance: any;
  warningCodes: string[];
};

async function lockedAttendanceReference(
  client: ExamClient,
  context: CalculationContextData,
  studentId: string
) {
  const sessions = await client.studentAttendanceSession.findMany({
    where: {
      academicYear: context.classScope.academicYear,
      className: context.classScope.className,
      section: context.classScope.section,
      status: "LOCKED",
      attendanceDate: { gte: context.examination.startDate, lte: context.examination.endDate }
    },
    include: { records: { where: { studentId }, select: { status: true } } },
    orderBy: { attendanceDate: "asc" }
  });
  const recorded = sessions.filter((session) => session.records[0]);
  return {
    policy: "LOCKED_EXAMINATION_DATE_RANGE_ONLY",
    periodStart: context.examination.startDate.toISOString(),
    periodEnd: context.examination.endDate.toISOString(),
    lockedSessionIds: sessions.map((session) => session.id),
    lockedSessionVersions: sessions.map((session) => ({ id: session.id, updatedAt: session.updatedAt.toISOString() })),
    totalLockedDays: sessions.length,
    recordedDays: recorded.length,
    presentEquivalentDays: recorded.filter((session) => !["ABSENT"].includes(session.records[0].status)).length
  };
}

export async function runExaminationCalculationPreview(
  client: ExamClient,
  input: unknown,
  actor: ExamActor,
  now = new Date()
) {
  rateLimitCalculation(actor.id, now.valueOf());
  const source = input && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {};
  const examinationId = safeId(source.examinationId, "Examination");
  const classScopeId = safeId(source.classScopeId, "Class scope");
  const calculationRequestKey = requestKey(source.requestKey, "calculation");
  const context = await calculationContext(client, examinationId, classScopeId);
  const issues = readinessIssues(context);
  if (issues.length) {
    throw new ExamMarksError(`Calculation is blocked: ${issues.join(" ")}`, 409, "CALCULATION_NOT_READY");
  }
  const material = sourceMaterial(context);
  const inputFingerprint = fingerprint({
    examinationId,
    classScopeId,
    formulaVersion: EXAM_CALCULATION_FORMULA_V1,
    statePolicy: APPROVED_ENTRY_STATE_POLICY_V1,
    sources: material
  });
  const existing = await client.studentResultSnapshot.findMany({
    where: { inputFingerprint },
    orderBy: { studentId: "asc" }
  });
  if (existing.length) {
    const locked = await client.examinationSchemeAudit.findFirst({
      where: {
        targetType: "EXAM_CALCULATION_RUN",
        targetId: existing[0].calculationRunId,
        eventType: "CALCULATION_SNAPSHOT_LOCKED"
      },
      orderBy: { eventDate: "desc" }
    });
    return publicCalculationRun(existing, true, locked);
  }
  const paperIds = context.examination.subjectPapers.map((paper) => paper.id);
  const baseScheme = context.examination.schemeVersions.find((scheme) => scheme.scopeKey === "BASE")
    ?? context.examination.schemeVersions[0];
  if (!baseScheme) throw new ExamMarksError("No active frozen base scheme is available.", 409);
  const provisional: ProvisionalStudentResult[] = [];
  for (const enrollment of context.students) {
    const paperResults = paperIds.map((paperId) => paperResult(context.sheets, paperId, enrollment.studentId));
    const included = paperResults.filter((paper) => !paper.excluded);
    if (!included.length) throw new ExamMarksError("A Student has no calculable papers.", 409);
    const totalObtained = roundPolicy(
      included.reduce((sum, paper) => sum.add(paper.percentage), new Prisma.Decimal(0)),
      baseScheme.roundingPolicyVersion
    );
    const totalMaximum = new Prisma.Decimal(included.length * 100);
    const percentage = roundPolicy(totalObtained.div(totalMaximum).mul(100), baseScheme.roundingPolicyVersion);
    const grade = gradeFor(percentage, context.examination.gradeScaleVersions[0]);
    const passResult = baseScheme.passFailEnabled && baseScheme.passThresholdPercentage
      ? percentage.gte(baseScheme.passThresholdPercentage) ? "PASS" : "FAIL"
      : null;
    const attendance = await lockedAttendanceReference(client, context, enrollment.studentId);
    const warningCodes = [
      ...(paperResults.some((paper) => paper.components.some((component) =>
        component.state === "PRESENT" && component.obtained?.equals(0)
      )) ? ["PRESENT_ZERO"] : []),
      ...(paperResults.some((paper) => paper.excluded) ? ["PAPER_EXCLUDED_BY_APPROVED_STATE"] : [])
    ];
    provisional.push({
      enrollment,
      paperResults,
      groupResults: groupResults(context.examination.subjectGroups, paperResults),
      totalObtained,
      totalMaximum,
      percentage,
      grade,
      passResult,
      attendance,
      warningCodes
    });
  }
  const ranked = [...provisional].sort((a, b) =>
    b.percentage.comparedTo(a.percentage) ||
    a.enrollment.student.admissionNo.localeCompare(b.enrollment.student.admissionNo)
  );
  const ranks = new Map<string, number>();
  if (baseScheme.rankEnabled) {
    let previous: Prisma.Decimal | null = null;
    let rank = 0;
    ranked.forEach((row, index) => {
      if (!previous || !row.percentage.equals(previous)) rank = index + 1;
      ranks.set(row.enrollment.studentId, rank);
      previous = row.percentage;
    });
  }
  const cohortAverage = roundPolicy(
    provisional.reduce((sum, row) => sum.add(row.percentage), new Prisma.Decimal(0)).div(provisional.length),
    baseScheme.roundingPolicyVersion
  );
  const cohortHighest = ranked[0].percentage;
  const priorVersions = await client.studentResultSnapshot.groupBy({
    by: ["studentId"],
    where: { examinationId, classScopeId },
    _max: { snapshotVersion: true }
  });
  const priorByStudent = new Map(priorVersions.map((row) => [row.studentId, row._max.snapshotVersion ?? 0]));
  const previousRun = await client.studentResultSnapshot.findFirst({
    where: { examinationId, classScopeId },
    orderBy: { runNumber: "desc" },
    select: { runNumber: true }
  });
  const runNumber = (previousRun?.runNumber ?? 0) + 1;
  const calculationRunId = eventKey(["CALCULATION_RUN", inputFingerprint]).slice(0, 40);
  const warnings = provisional.flatMap((row) => row.warningCodes.map((code) => ({
    code,
    studentReference: row.enrollment.student.admissionNo
  })));
  const sourceSchemeVersions = [...new Set(material.map((row) => row.schemeVersionId))].sort();
  return client.$transaction(async (tx: ExamClient) => {
    const duplicate = await tx.studentResultSnapshot.findMany({
      where: { inputFingerprint },
      orderBy: { studentId: "asc" }
    });
    if (duplicate.length) {
      return publicCalculationRun(duplicate, true, null);
    }
    const snapshotRows = provisional.map((row) => {
      const sourceSheetVersions = row.paperResults.flatMap((paper) =>
        paper.components.map((component) => ({
          sheetVersionId: component.sourceSheetVersionId,
          entryId: component.sourceEntryId,
          rowVersion: component.sourceRowVersion,
          state: component.state,
          mark: decimalJson(component.obtained)
        }))
      );
      const snapshot = {
        examination: {
          id: examinationId,
          code: context.examination.examCode,
          name: context.examination.name
        },
        schemeVersionIds: sourceSchemeVersions,
        entryStatePolicy: APPROVED_ENTRY_STATE_POLICY_V1,
        papers: row.paperResults.map((paper) => ({
          paperId: paper.paperId,
          calculationMode: paper.scheme.calculationMode,
          schemeVersionId: paper.scheme.id,
          obtained: decimalJson(paper.obtained),
          maximum: decimalJson(paper.maximum),
          percentage: decimalJson(paper.percentage),
          excluded: paper.excluded,
          components: paper.components.map((component) => ({
            componentId: component.componentId,
            code: component.componentCode,
            name: component.componentName,
            state: component.state,
            obtained: decimalJson(component.obtained),
            maximum: decimalJson(component.maximum),
            contributionWeight: decimalJson(component.contributionWeight),
            contribution: decimalJson(component.contribution),
            sourceSheetVersionId: component.sourceSheetVersionId,
            sourceEntryId: component.sourceEntryId,
            sourceRowVersion: component.sourceRowVersion
          }))
        })),
        groups: row.groupResults,
        totalObtained: decimalJson(row.totalObtained),
        totalMaximum: decimalJson(row.totalMaximum),
        percentage: decimalJson(row.percentage),
        grade: row.grade ? {
          code: row.grade.code,
          label: row.grade.label,
          point: decimalJson(row.grade.point)
        } : null,
        passResult: row.passResult,
        rank: ranks.get(row.enrollment.studentId) ?? null,
        rankTiePolicy: baseScheme.rankEnabled ? baseScheme.rankTiePolicy : null,
        cohortAverage: decimalJson(cohortAverage),
        cohortHighest: decimalJson(cohortHighest),
        attendanceReference: row.attendance,
        warnings: row.warningCodes,
        formulaVersion: EXAM_CALCULATION_FORMULA_V1,
        roundingPolicyVersion: baseScheme.roundingPolicyVersion,
        calculatedAt: now.toISOString()
      };
      return {
        calculationRunId,
        inputFingerprint,
        runNumber,
        runStatus: "PREVIEW",
        examinationId,
        classScopeId,
        studentId: row.enrollment.studentId,
        schemeVersionId: baseScheme.id,
        snapshotVersion: (priorByStudent.get(row.enrollment.studentId) ?? 0) + 1,
        totalObtained: row.totalObtained,
        totalMaximum: row.totalMaximum,
        percentage: row.percentage,
        gradeCode: row.grade?.code ?? null,
        gradePoint: row.grade?.point ?? null,
        passResult: row.passResult,
        rankValue: ranks.get(row.enrollment.studentId) ?? null,
        formulaVersion: EXAM_CALCULATION_FORMULA_V1,
        roundingPolicyVersion: baseScheme.roundingPolicyVersion,
        warningsJson: JSON.stringify(warnings),
        sourceSheetVersionsJson: JSON.stringify(sourceSheetVersions),
        sourceSchemeVersionsJson: JSON.stringify(sourceSchemeVersions),
        snapshotJson: JSON.stringify(snapshot),
        calculatedByUserId: actor.id,
        calculatedAt: now
      };
    });
    await tx.studentResultSnapshot.createMany({ data: snapshotRows });
    const created = await tx.studentResultSnapshot.findMany({
      where: { calculationRunId },
      orderBy: { studentId: "asc" }
    });
    await tx.examinationSchemeAudit.create({
      data: {
        eventKey: eventKey(["CALCULATION_PREVIEW", calculationRunId, calculationRequestKey]),
        examinationId,
        schemeVersionId: baseScheme.id,
        eventType: "CALCULATION_PREVIEW_CREATED",
        targetType: "EXAM_CALCULATION_RUN",
        targetId: calculationRunId,
        newStatus: "PREVIEW",
        actorUserId: actor.id,
        actorRole: actor.role,
        snapshotJson: JSON.stringify({
          inputFingerprint,
          sourceSheetVersionIds: material.map((row) => row.sheetVersionId),
          snapshotCount: provisional.length,
          warnings
        }),
        eventDate: now
      }
    });
    return publicCalculationRun(created, false, null);
  });
}

export async function lockExaminationCalculation(
  client: ExamClient,
  calculationRunIdValue: unknown,
  input: unknown,
  actor: ExamActor,
  now = new Date()
) {
  const calculationRunId = safeId(calculationRunIdValue, "Calculation run");
  const source = input && typeof input === "object" && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {};
  const lockRequestKey = requestKey(source.requestKey, "calculation lock");
  const reason = reasonText(source.reason, "Calculation lock reason");
  if (actor.role === "SUPER_ADMIN") reasonText(source.interventionReason, "Super Admin intervention audit reason");
  return client.$transaction(async (tx: ExamClient) => {
    const snapshots = await tx.studentResultSnapshot.findMany({
      where: { calculationRunId },
      orderBy: { studentId: "asc" }
    });
    if (!snapshots.length) throw new ExamMarksError("Calculation preview was not found.", 404);
    const run = snapshots[0];
    const key = eventKey(["CALCULATION_LOCK", calculationRunId, lockRequestKey]);
    const prior = await tx.examinationSchemeAudit.findUnique({ where: { eventKey: key } });
    if (prior) return { runId: calculationRunId, status: "LOCKED", lockedAt: prior.eventDate.toISOString() };
    const existingLock = await tx.examinationSchemeAudit.findFirst({
      where: {
        targetType: "EXAM_CALCULATION_RUN",
        targetId: calculationRunId,
        eventType: "CALCULATION_SNAPSHOT_LOCKED"
      },
      orderBy: { eventDate: "desc" }
    });
    if (existingLock) return { runId: calculationRunId, status: "LOCKED", lockedAt: existingLock.eventDate.toISOString() };
    if (run.runStatus !== "PREVIEW") {
      throw new ExamMarksError("Only a complete calculation preview can be locked.", 409);
    }
    const sourceSheetVersionIds = (JSON.parse(run.sourceSheetVersionsJson) as Array<{ sheetVersionId: string }>)
      .map((row) => row.sheetVersionId);
    const sourceVersions = await tx.examMarkSheet.findMany({
      where: { id: { in: sourceSheetVersionIds } },
      include: { entries: { orderBy: { studentId: "asc" } } }
    });
    if (sourceVersions.length !== sourceSheetVersionIds.length) {
      throw new ExamMarksError("A frozen calculation source is unavailable.", 409);
    }
    for (const sourceVersion of sourceVersions) {
      if (sourceVersion.currentKey !== sourceVersion.logicalSheetKey) {
        throw new ExamMarksError("A source sheet has a newer version. Run calculation preview again.", 409);
      }
      if (!["SUBMITTED", "RESUBMITTED", "MODERATED", "LOCKED"].includes(sourceVersion.status)) {
        throw new ExamMarksError("A source sheet is no longer calculation-ready.", 409);
      }
    }
    for (const sourceVersion of sourceVersions) {
      if (sourceVersion.status !== "LOCKED") {
        const versionChanged = await tx.examMarkSheet.updateMany({
          where: {
            id: sourceVersion.id,
            optimisticVersion: sourceVersion.optimisticVersion,
            status: sourceVersion.status
          },
          data: {
            status: "LOCKED",
            lockedByUserId: actor.id,
            lockedAt: now,
            optimisticVersion: { increment: 1 },
            updatedAt: now
          }
        });
        if (versionChanged.count !== 1) {
          throw new ExamMarksError("A source sheet changed during calculation lock.", 409);
        }
      }
    }
    await tx.examinationSchemeAudit.create({
      data: {
        eventKey: key,
        examinationId: run.examinationId,
        schemeVersionId: run.schemeVersionId,
        eventType: "CALCULATION_SNAPSHOT_LOCKED",
        targetType: "EXAM_CALCULATION_RUN",
        targetId: calculationRunId,
        previousStatus: "PREVIEW",
        newStatus: "LOCKED",
        reason: actor.role === "SUPER_ADMIN" ? String(source.interventionReason).trim() : reason,
        actorUserId: actor.id,
        actorRole: actor.role,
        snapshotJson: JSON.stringify({
          inputFingerprint: run.inputFingerprint,
          sourceSheetVersionIds,
          snapshotIds: snapshots.map((row) => row.id),
          publicationStatus: "NOT_IMPLEMENTED"
        }),
        eventDate: now
      }
    });
    return { runId: calculationRunId, status: "LOCKED", lockedAt: now.toISOString() };
  });
}

export async function loadMarksModerationDashboard(
  client: ExamClient,
  selection: { examinationId?: string; classScopeId?: string } = {}
) {
  const examinations = await client.examination.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      examCode: true,
      name: true,
      academicYear: true,
      classScopes: {
        where: { status: "ACTIVE" },
        select: { id: true, className: true, section: true },
        orderBy: [{ className: "asc" }, { section: "asc" }]
      }
    },
    orderBy: { startDate: "desc" }
  });
  const examinationId = selection.examinationId ?? examinations[0]?.id;
  const selectedExam = examinations.find((row) => row.id === examinationId);
  const classScopeId = selection.classScopeId ?? selectedExam?.classScopes[0]?.id;
  if (!examinationId || !classScopeId) {
    return { examinations, selection: null, sheets: [], summary: emptySummary(), calculationRuns: [] };
  }
  const context = await calculationContext(client, examinationId, classScopeId);
  const contributors = await client.teacherExamAssignment.findMany({
    where: { examinationId, classScopeId, status: "ACTIVE", assignmentRole: "CONTRIBUTOR" },
    select: {
      componentId: true,
      staffMember: { select: { displayName: true, fullName: true } }
    }
  });
  const versionHistory = await client.examMarkSheet.findMany({
    where: { examinationId, classScopeId },
    select: {
      id: true,
      componentId: true,
      versionNumber: true,
      status: true,
      optimisticVersion: true,
      submittedAt: true,
      moderatedAt: true,
      lockedAt: true,
      supersedesSheetId: true,
      createdAt: true
    },
    orderBy: [{ componentId: "asc" }, { versionNumber: "desc" }]
  });
  const rows = context.examination.subjectPapers.map((paper) => {
    const paperSheets = context.sheets.filter((sheet) => sheet.subjectPaperId === paper.id);
    const components = context.examination.teacherAssignments
      .filter((assignment) => assignment.subjectPaperId === paper.id)
      .map((assignment) => {
        const sheet = paperSheets.find((candidate) => candidate.componentId === assignment.componentId);
        const version = sheet;
        return {
          componentId: assignment.componentId,
          componentName: assignment.component.name,
          primaryTeacher: assignment.staffMember.displayName ?? assignment.staffMember.fullName,
          contributors: contributors.filter((row) => row.componentId === assignment.componentId)
            .map((row) => row.staffMember.displayName ?? row.staffMember.fullName),
          sheetId: sheet?.id ?? null,
          status: sheet?.status ?? "NOT_STARTED",
          sheetVersion: sheet?.optimisticVersion ?? null,
          versionNumber: version?.versionNumber ?? null,
          submittedAt: version?.submittedAt?.toISOString() ?? null,
          missing: version?.entries.filter((entry: any) => entry.entryState === "NOT_ENTERED").length ?? context.students.length,
          absent: version?.entries.filter((entry: any) => entry.entryState === "ABSENT").length ?? 0,
          exempt: version?.entries.filter((entry: any) => entry.entryState === "EXEMPT").length ?? 0,
          notApplicable: version?.entries.filter((entry: any) => entry.entryState === "NOT_APPLICABLE").length ?? 0,
          late: context.examination.endDate < new Date() && !["SUBMITTED", "RESUBMITTED", "MODERATED", "LOCKED"].includes(sheet?.status ?? "NOT_STARTED"),
          history: versionHistory.filter((history) => history.componentId === assignment.componentId).map((history) => ({
            ...history,
            submittedAt: history.submittedAt?.toISOString() ?? null,
            moderatedAt: history.moderatedAt?.toISOString() ?? null,
            lockedAt: history.lockedAt?.toISOString() ?? null,
            createdAt: history.createdAt.toISOString()
          })),
          correctionRequest: sheet?.correctionRequestStatus === "PENDING" ? {
            id: sheet.correctionRequestId,
            status: sheet.correctionRequestStatus,
            requestReason: sheet.correctionRequestReason,
            requestedAt: sheet.correctionRequestedAt?.toISOString() ?? null
          } : null
        };
      });
    return {
      paperId: paper.id,
      paperCode: paper.paperCode,
      paperName: paper.paperName,
      subjectName: paper.subjectNameSnapshot,
      components,
      readiness: components.length > 0 && components.every((component) =>
        ["SUBMITTED", "RESUBMITTED", "MODERATED", "LOCKED"].includes(component.status) && component.missing === 0
      ) ? "READY" : "INCOMPLETE"
    };
  });
  const flat = rows.flatMap((row) => row.components);
  const calculationSnapshots = await client.studentResultSnapshot.findMany({
    where: { examinationId, classScopeId },
    orderBy: [{ runNumber: "desc" }, { studentId: "asc" }]
  });
  const runIds = [...new Set(calculationSnapshots.map((row) => row.calculationRunId))];
  const locks = await client.examinationSchemeAudit.findMany({
    where: {
      targetType: "EXAM_CALCULATION_RUN",
      targetId: { in: runIds },
      eventType: "CALCULATION_SNAPSHOT_LOCKED"
    },
    orderBy: { eventDate: "desc" }
  });
  const groupedRuns = new Map<string, any[]>();
  calculationSnapshots.forEach((snapshot) => {
    const rows = groupedRuns.get(snapshot.calculationRunId) ?? [];
    rows.push(snapshot);
    groupedRuns.set(snapshot.calculationRunId, rows);
  });
  return {
    examinations,
    selection: {
      examinationId,
      classScopeId,
      examination: {
        code: context.examination.examCode,
        name: context.examination.name,
        academicYear: context.examination.academicYear
      },
      classScope: {
        className: context.classScope.className,
        section: context.classScope.section
      },
      calculationIssues: readinessIssues(context)
    },
    sheets: rows,
    summary: {
      notStarted: flat.filter((row) => row.status === "NOT_STARTED").length,
      draft: flat.filter((row) => ["DRAFT", "VALIDATION_FAILED", "READY_TO_SUBMIT"].includes(row.status)).length,
      submitted: flat.filter((row) => ["SUBMITTED", "RESUBMITTED", "MODERATED"].includes(row.status)).length,
      reopened: flat.filter((row) => ["REOPEN_REQUESTED", "REOPENED"].includes(row.status)).length,
      locked: flat.filter((row) => row.status === "LOCKED").length,
      missingEntries: flat.reduce((sum, row) => sum + row.missing, 0),
      correctionRequests: flat.filter((row) => row.correctionRequest).length,
      validationFailures: flat.filter((row) => row.status === "VALIDATION_FAILED").length
    },
    calculationRuns: [...groupedRuns.values()].map((snapshots) =>
      publicCalculationRun(
        snapshots,
        false,
        locks.find((lock) => lock.targetId === snapshots[0].calculationRunId) ?? null
      )
    )
  };
}

function emptySummary() {
  return {
    notStarted: 0,
    draft: 0,
    submitted: 0,
    reopened: 0,
    locked: 0,
    missingEntries: 0,
    correctionRequests: 0,
    validationFailures: 0
  };
}

function publicCalculationRun(
  snapshots: Array<{
    id: string;
    calculationRunId: string;
    runNumber: number;
    runStatus: string;
    inputFingerprint: string;
    formulaVersion: string;
    roundingPolicyVersion: string;
    sourceSchemeVersionsJson: string;
    sourceSheetVersionsJson: string;
    warningsJson: string;
    calculatedAt: Date;
    studentId: string;
    snapshotVersion: number;
    totalObtained: Prisma.Decimal;
    totalMaximum: Prisma.Decimal;
    percentage: Prisma.Decimal;
    gradeCode: string | null;
    gradePoint: Prisma.Decimal | null;
    passResult: string | null;
    rankValue: number | null;
    snapshotJson: string;
  }>,
  idempotent: boolean,
  lockEvent: { eventDate: Date } | null
) {
  const run = snapshots[0];
  const sourceSheetVersionIds = (JSON.parse(run.sourceSheetVersionsJson) as Array<{ sheetVersionId: string }>)
    .map((row) => row.sheetVersionId);
  return {
    id: run.calculationRunId,
    runNumber: run.runNumber,
    status: lockEvent ? "LOCKED" : run.runStatus,
    inputFingerprint: run.inputFingerprint,
    formulaVersion: run.formulaVersion,
    roundingPolicyVersion: run.roundingPolicyVersion,
    sourceSchemeVersionIds: JSON.parse(run.sourceSchemeVersionsJson) as string[],
    sourceSheetVersionIds,
    warnings: JSON.parse(run.warningsJson) as unknown[],
    calculatedAt: run.calculatedAt.toISOString(),
    lockedAt: lockEvent?.eventDate.toISOString() ?? null,
    idempotent,
    snapshots: snapshots.map((snapshot) => ({
      id: snapshot.id,
      studentId: snapshot.studentId,
      version: snapshot.snapshotVersion,
      totalObtained: snapshot.totalObtained.toFixed(2),
      totalMaximum: snapshot.totalMaximum.toFixed(2),
      percentage: snapshot.percentage.toFixed(2),
      gradeCode: snapshot.gradeCode,
      gradePoint: snapshot.gradePoint?.toFixed(2) ?? null,
      passResult: snapshot.passResult,
      rank: snapshot.rankValue,
      details: JSON.parse(snapshot.snapshotJson) as Record<string, unknown>
    }))
  };
}
