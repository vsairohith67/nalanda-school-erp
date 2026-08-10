import { Prisma, type PrismaClient } from "@prisma/client";
import type { AuthUser } from "@/lib/auth";
import { BINDABLE_REPORT_TEMPLATE_FAMILIES } from "@/lib/report-publication-types";
import { canonicalFamilyForClassName, canonicalFamilyFromDefinition } from "@/lib/report-card-canonical-templates";

export const EXAM_CALCULATION_MODES = ["RAW_SUM", "WEIGHTED_NORMALIZED"] as const;
export const EXAM_COMPONENT_KINDS = ["INTERNAL", "WRITTEN", "PRACTICAL", "ORAL", "PROJECT", "OTHER_APPROVED"] as const;
export const EXAM_TEMPLATE_FAMILIES = BINDABLE_REPORT_TEMPLATE_FAMILIES;
export const EXAM_ROUNDING_POLICY_V1 = "RC05_V1_DECIMAL6_HALF_UP2";

type ExamClient = PrismaClient | Prisma.TransactionClient;
type ExamActor = Pick<AuthUser, "id" | "role" | "name">;
type ComponentInput = {
  componentCode?: unknown;
  name?: unknown;
  componentKind?: unknown;
  displayOrder?: unknown;
  maximumMarks?: unknown;
  contributionWeight?: unknown;
  isRequired?: unknown;
};

export class ExamConfigurationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ExamConfigurationError";
    this.status = status;
  }
}

export const examinationConfigurationInclude = {
  classScopes: {
    include: {
      timetableClassSection: {
        select: { id: true, className: true, section: true, displayName: true, academicYear: true, isActive: true }
      },
      schemeVersions: {
        include: {
          components: { orderBy: { displayOrder: "asc" } },
          subjectPaper: { select: { id: true, paperCode: true, paperName: true } }
        },
        orderBy: { versionNumber: "desc" }
      },
      subjectPapers: {
        include: { timetableSubject: { select: { id: true, name: true, shortName: true, isActive: true } } },
        orderBy: { displayOrder: "asc" }
      },
      subjectGroups: {
        include: {
          members: {
            include: { subjectPaper: { select: { id: true, paperCode: true, paperName: true } } },
            orderBy: { displayOrder: "asc" }
          }
        },
        orderBy: { displayOrder: "asc" }
      },
      gradeScaleVersions: {
        include: { bands: { orderBy: { displayOrder: "asc" } } },
        orderBy: { versionNumber: "desc" }
      },
      coScholasticVersions: {
        include: { items: { orderBy: { displayOrder: "asc" } } },
        orderBy: { versionNumber: "desc" }
      },
      templateBindings: {
        include: { reportCardTemplate: { select: { id: true, templateCode: true, name: true, status: true, versionNumber: true } } },
        orderBy: { versionNumber: "desc" }
      },
      teacherAssignments: {
        include: {
          staffMember: { select: { id: true, staffCode: true, fullName: true, displayName: true, status: true } },
          subjectPaper: { select: { id: true, paperCode: true, paperName: true, subjectNameSnapshot: true } },
          component: { select: { id: true, componentCode: true, name: true } },
          schemeVersion: { select: { id: true, versionNumber: true, status: true } }
        },
        orderBy: { assignmentRole: "desc" }
      }
    },
    orderBy: { className: "asc" }
  },
  schemeAudits: {
    orderBy: { eventDate: "desc" },
    take: 100
  }
} as const;

export function expectedExamVersion(value: unknown, label = "configuration") {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new ExamConfigurationError(`A valid expected ${label} version is required.`);
  }
  return parsed;
}

export function validateSchemeComponents(modeValue: unknown, input: unknown) {
  const calculationMode = enumText(modeValue, EXAM_CALCULATION_MODES, "Calculation mode");
  if (!Array.isArray(input) || input.length < 1 || input.length > 30) {
    throw new ExamConfigurationError("A scheme requires between 1 and 30 ordered components.");
  }
  const seenCodes = new Set<string>();
  const seenOrders = new Set<number>();
  const components = input.map((raw, index) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new ExamConfigurationError(`Component ${index + 1} is invalid.`);
    }
    const row = raw as ComponentInput;
    const componentCode = codeText(row.componentCode, `Component ${index + 1} code`, 40);
    if (seenCodes.has(componentCode)) throw new ExamConfigurationError(`Duplicate component code: ${componentCode}.`);
    seenCodes.add(componentCode);
    const displayOrder = positiveInteger(row.displayOrder ?? index + 1, `Component ${componentCode} order`, 100);
    if (seenOrders.has(displayOrder)) throw new ExamConfigurationError("Component display order must be unique.");
    seenOrders.add(displayOrder);
    const maximumMarks = positiveDecimal(row.maximumMarks, `Component ${componentCode} maximum`);
    const contributionWeight = optionalPositiveDecimal(row.contributionWeight, `Component ${componentCode} contribution weight`);
    if (calculationMode === "WEIGHTED_NORMALIZED" && contributionWeight == null) {
      throw new ExamConfigurationError(`Component ${componentCode} requires a contribution weight in weighted mode.`);
    }
    if (calculationMode === "RAW_SUM" && contributionWeight != null) {
      throw new ExamConfigurationError("RAW_SUM components cannot carry contribution weights.");
    }
    return {
      componentCode,
      name: safeText(row.name, `Component ${componentCode} name`, 120),
      componentKind: enumText(row.componentKind, EXAM_COMPONENT_KINDS, `Component ${componentCode} kind`),
      displayOrder,
      maximumMarks,
      contributionWeight,
      isRequired: row.isRequired !== false
    };
  });
  if (
    calculationMode === "WEIGHTED_NORMALIZED" &&
    !components.reduce((sum, component) => sum.add(component.contributionWeight!), new Prisma.Decimal(0)).equals(100)
  ) {
    throw new ExamConfigurationError("Weighted component contributions must total exactly 100%.");
  }
  return { calculationMode, components };
}

export function validateGradeBands(input: unknown) {
  if (!Array.isArray(input) || input.length < 1 || input.length > 30) {
    throw new ExamConfigurationError("A grade scale requires between 1 and 30 ordered bands.");
  }
  const codes = new Set<string>();
  const orders = new Set<number>();
  const bands = input.map((raw, index) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new ExamConfigurationError(`Grade band ${index + 1} is invalid.`);
    }
    const row = raw as Record<string, unknown>;
    const gradeCode = codeText(row.gradeCode, `Grade band ${index + 1} code`, 20);
    if (codes.has(gradeCode)) throw new ExamConfigurationError(`Duplicate grade code: ${gradeCode}.`);
    codes.add(gradeCode);
    const displayOrder = positiveInteger(row.displayOrder ?? index + 1, `Grade ${gradeCode} order`, 100);
    if (orders.has(displayOrder)) throw new ExamConfigurationError("Grade-band display order must be unique.");
    orders.add(displayOrder);
    const minimumPercentage = boundedDecimal(row.minimumPercentage, `Grade ${gradeCode} minimum`, 0, 100);
    const maximumPercentage = boundedDecimal(row.maximumPercentage, `Grade ${gradeCode} maximum`, 0, 100);
    if (maximumPercentage.lt(minimumPercentage)) {
      throw new ExamConfigurationError(`Grade ${gradeCode} maximum cannot be below its minimum.`);
    }
    return {
      gradeCode,
      label: safeText(row.label, `Grade ${gradeCode} label`, 80),
      minimumPercentage,
      maximumPercentage,
      displayOrder,
      gradePoint: row.gradePoint == null || row.gradePoint === "" ? null : boundedDecimal(row.gradePoint, `Grade ${gradeCode} point`, 0, 100),
      remarks: optionalText(row.remarks, `Grade ${gradeCode} remarks`, 300)
    };
  });
  const ascending = [...bands].sort((a, b) => a.minimumPercentage.comparedTo(b.minimumPercentage));
  for (let index = 1; index < ascending.length; index += 1) {
    if (ascending[index].minimumPercentage.lte(ascending[index - 1].maximumPercentage)) {
      throw new ExamConfigurationError("Grade bands must not overlap.");
    }
  }
  return bands;
}

export async function listExaminationConfigurations(client: ExamClient, academicYear?: string) {
  return client.examination.findMany({
    where: academicYear ? { academicYear } : undefined,
    select: {
      id: true,
      examCode: true,
      academicYear: true,
      name: true,
      examType: true,
      startDate: true,
      endDate: true,
      status: true,
      version: true,
      updatedAt: true,
      _count: { select: { classScopes: true, schemeVersions: true, teacherAssignments: true } }
    },
    orderBy: [{ startDate: "desc" }, { name: "asc" }]
  });
}

export async function getExaminationConfiguration(client: ExamClient, id: string): Promise<unknown> {
  const row = await client.examination.findUnique({ where: { id }, include: examinationConfigurationInclude });
  if (!row) throw new ExamConfigurationError("Examination configuration was not found.", 404);
  return row;
}

export async function createExaminationConfiguration(client: PrismaClient, input: unknown, actor: ExamActor) {
  const source = objectInput(input);
  const interventionReason = governedInterventionReason(actor, source.interventionReason);
  const academicYear = academicYearText(source.academicYear);
  const examCode = codeText(source.examCode, "Examination code", 40);
  const name = safeText(source.name, "Examination name", 160);
  const examType = codeText(source.examType, "Examination type", 40);
  const startDate = dateOnly(source.startDate, "Start date");
  const endDate = dateOnly(source.endDate, "End date");
  if (endDate < startDate) throw new ExamConfigurationError("End date cannot be before start date.");
  const classSectionIds = uniqueIds(source.classSectionIds, "class and section", 100);
  return client.$transaction(async (tx) => {
    const classSections = await tx.timetableClassSection.findMany({
      where: { id: { in: classSectionIds }, academicYear, isActive: true },
      orderBy: [{ className: "asc" }, { section: "asc" }]
    });
    if (classSections.length !== classSectionIds.length) {
      throw new ExamConfigurationError("Every selected class and section must be active in the chosen academic year.");
    }
    const examination = await tx.examination.create({
      data: {
        examCode,
        academicYear,
        name,
        examType,
        startDate,
        endDate,
        description: optionalText(source.description, "Description", 2_000),
        createdByUserId: actor.id,
        interventionReason,
        classScopes: {
          create: classSections.map((scope) => ({
            academicYear,
            className: scope.className,
            section: scope.section,
            timetableClassSectionId: scope.id,
            createdByUserId: actor.id
          }))
        }
      }
    });
    await appendAudit(tx, {
      examinationId: examination.id,
      eventType: "EXAMINATION_CREATED",
      targetType: "EXAMINATION",
      targetId: examination.id,
      newStatus: examination.status,
      reason: interventionReason,
      actor,
      snapshot: {
        examCode,
        academicYear,
        name,
        examType,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        classScopes: classSections.map((scope) => ({ className: scope.className, section: scope.section }))
      }
    });
    return getExaminationConfiguration(tx, examination.id);
  }).catch(rethrowKnownDatabaseError);
}

export async function updateExaminationConfiguration(
  client: PrismaClient,
  id: string,
  input: unknown,
  actor: ExamActor
) {
  const source = objectInput(input);
  const interventionReason = governedInterventionReason(actor, source.interventionReason);
  const expectedVersion = expectedExamVersion(source.expectedVersion);
  return client.$transaction(async (tx) => {
    const current = await tx.examination.findUnique({ where: { id }, include: { _count: { select: { schemeVersions: true } } } });
    if (!current) throw new ExamConfigurationError("Examination configuration was not found.", 404);
    if (current.status !== "DRAFT") throw new ExamConfigurationError("Only a draft examination can be edited.", 409);
    const startDate = dateOnly(source.startDate ?? current.startDate, "Start date");
    const endDate = dateOnly(source.endDate ?? current.endDate, "End date");
    if (endDate < startDate) throw new ExamConfigurationError("End date cannot be before start date.");
    const changed = await tx.examination.updateMany({
      where: { id, status: "DRAFT", version: expectedVersion },
      data: {
        name: source.name == null ? current.name : safeText(source.name, "Examination name", 160),
        examType: source.examType == null ? current.examType : codeText(source.examType, "Examination type", 40),
        startDate,
        endDate,
        description: source.description === undefined ? current.description : optionalText(source.description, "Description", 2_000),
        interventionReason: interventionReason ?? current.interventionReason,
        version: { increment: 1 }
      }
    });
    if (changed.count !== 1) throw new ExamConfigurationError("This examination changed in another session. Reload it before saving.", 409);
    const updated = await tx.examination.findUniqueOrThrow({ where: { id } });
    await appendAudit(tx, {
      examinationId: id,
      eventType: "EXAMINATION_DRAFT_UPDATED",
      targetType: "EXAMINATION",
      targetId: id,
      previousStatus: current.status,
      newStatus: updated.status,
      reason: interventionReason,
      actor,
      snapshot: { version: updated.version, name: updated.name, examType: updated.examType, startDate, endDate }
    });
    return getExaminationConfiguration(tx, id);
  }).catch(rethrowKnownDatabaseError);
}

export async function createSchemeVersion(client: PrismaClient, examinationId: string, input: unknown, actor: ExamActor) {
  const source = objectInput(input);
  const interventionReason = governedInterventionReason(actor, source.interventionReason);
  return client.$transaction(async (tx) => {
    const { examination, classScope } = await mutableScope(tx, examinationId, source.classScopeId, source.expectedExaminationVersion);
    const subjectPaperId = optionalId(source.subjectPaperId);
    const subjectPaper = subjectPaperId
      ? await tx.examSubjectPaper.findFirst({ where: { id: subjectPaperId, examinationId, classScopeId: classScope.id, status: "ACTIVE" } })
      : null;
    if (subjectPaperId && !subjectPaper) throw new ExamConfigurationError("The subject or paper override is outside this class scope.");
    const scopeKey = subjectPaper ? `SUBJECT:${subjectPaper.id}` : "BASE";
    const cloneSourceId = optionalId(source.cloneSourceId);
    const cloneSource = cloneSourceId
      ? await tx.examinationSchemeVersion.findFirst({
          where: { id: cloneSourceId, examinationId, classScopeId: classScope.id },
          include: { components: { orderBy: { displayOrder: "asc" } } }
        })
      : null;
    if (cloneSourceId && !cloneSource) throw new ExamConfigurationError("The scheme version to clone was not found in this class scope.", 404);
    const validated = validateSchemeComponents(
      cloneSource ? cloneSource.calculationMode : source.calculationMode,
      cloneSource
        ? cloneSource.components.map((component) => ({
            componentCode: component.componentCode,
            name: component.name,
            componentKind: component.componentKind,
            displayOrder: component.displayOrder,
            maximumMarks: component.maximumMarks,
            contributionWeight: component.contributionWeight,
            isRequired: component.isRequired
          }))
        : source.components
    );
    const latest = await tx.examinationSchemeVersion.findFirst({
      where: { examinationId, classScopeId: classScope.id, scopeKey },
      orderBy: { versionNumber: "desc" }
    });
    const created = await tx.examinationSchemeVersion.create({
      data: {
        examinationId,
        classScopeId: classScope.id,
        academicYear: examination.academicYear,
        className: classScope.className,
        section: classScope.section,
        scopeKey,
        subjectPaperId: subjectPaper?.id ?? null,
        versionNumber: (latest?.versionNumber ?? 0) + 1,
        calculationMode: validated.calculationMode,
        roundingPolicyVersion: EXAM_ROUNDING_POLICY_V1,
        supersedesVersionId: cloneSource?.id ?? latest?.id ?? null,
        createdByUserId: actor.id,
        components: { create: validated.components }
      },
      include: { components: { orderBy: { displayOrder: "asc" } } }
    });
    await bumpExamination(tx, examinationId, examination.version);
    await appendAudit(tx, {
      examinationId,
      schemeVersionId: created.id,
      eventType: cloneSource ? "SCHEME_VERSION_CLONED" : "SCHEME_VERSION_CREATED",
      targetType: "SCHEME_VERSION",
      targetId: created.id,
      newStatus: created.status,
      reason: interventionReason,
      actor,
      snapshot: publicScheme(created)
    });
    return created;
  }).catch(rethrowKnownDatabaseError);
}

export async function createSubjectPaper(client: PrismaClient, examinationId: string, input: unknown, actor: ExamActor) {
  const source = objectInput(input);
  const interventionReason = governedInterventionReason(actor, source.interventionReason);
  return client.$transaction(async (tx) => {
    const { examination, classScope } = await mutableScope(tx, examinationId, source.classScopeId, source.expectedExaminationVersion);
    const timetableSubjectId = requiredId(source.timetableSubjectId, "Timetable subject");
    const timetableSubject = await tx.timetableSubject.findFirst({ where: { id: timetableSubjectId, isActive: true } });
    if (!timetableSubject) throw new ExamConfigurationError("An active timetable subject is required.");
    const timetableLink = await tx.timetableAssignment.count({
      where: {
        academicYear: examination.academicYear,
        classSectionId: classScope.timetableClassSectionId,
        subjectId: timetableSubjectId
      }
    });
    if (!timetableLink) throw new ExamConfigurationError("The selected subject has no timetable assignment for this class and section.");
    const displayOrder = positiveInteger(source.displayOrder, "Paper display order", 500);
    const created = await tx.examSubjectPaper.create({
      data: {
        examinationId,
        classScopeId: classScope.id,
        academicYear: examination.academicYear,
        className: classScope.className,
        section: classScope.section,
        timetableSubjectId,
        subjectNameSnapshot: timetableSubject.name,
        paperCode: codeText(source.paperCode, "Paper code", 40),
        paperName: safeText(source.paperName, "Paper name", 120),
        displayOrder,
        createdByUserId: actor.id
      }
    });
    await bumpExamination(tx, examinationId, examination.version);
    await appendAudit(tx, {
      examinationId,
      eventType: "SUBJECT_PAPER_CREATED",
      targetType: "SUBJECT_PAPER",
      targetId: created.id,
      newStatus: created.status,
      reason: interventionReason,
      actor,
      snapshot: { paperCode: created.paperCode, paperName: created.paperName, subject: created.subjectNameSnapshot, classScopeId: classScope.id }
    });
    return created;
  }).catch(rethrowKnownDatabaseError);
}

export async function createSubjectGroup(client: PrismaClient, examinationId: string, input: unknown, actor: ExamActor) {
  const source = objectInput(input);
  const interventionReason = governedInterventionReason(actor, source.interventionReason);
  return client.$transaction(async (tx) => {
    const { examination, classScope } = await mutableScope(tx, examinationId, source.classScopeId, source.expectedExaminationVersion);
    const calculationMode = enumText(source.calculationMode, EXAM_CALCULATION_MODES, "Group calculation mode");
    if (!Array.isArray(source.members) || source.members.length < 2 || source.members.length > 20) {
      throw new ExamConfigurationError("A subject group requires between 2 and 20 papers.");
    }
    const paperIds = new Set<string>();
    const members = source.members.map((raw, index) => {
      const row = objectInput(raw);
      const subjectPaperId = requiredId(row.subjectPaperId, `Group paper ${index + 1}`);
      if (paperIds.has(subjectPaperId)) throw new ExamConfigurationError("A subject paper cannot appear twice in one group.");
      paperIds.add(subjectPaperId);
      const contributionWeight = optionalPositiveDecimal(row.contributionWeight, `Group paper ${index + 1} weight`);
      if (calculationMode === "WEIGHTED_NORMALIZED" && contributionWeight == null) {
        throw new ExamConfigurationError("Every weighted subject-group member requires a contribution weight.");
      }
      if (calculationMode === "RAW_SUM" && contributionWeight != null) {
        throw new ExamConfigurationError("RAW_SUM subject groups cannot carry contribution weights.");
      }
      return { subjectPaperId, displayOrder: index + 1, contributionWeight };
    });
    const matchingPapers = await tx.examSubjectPaper.count({
      where: { id: { in: [...paperIds] }, examinationId, classScopeId: classScope.id, status: "ACTIVE" }
    });
    if (matchingPapers !== paperIds.size) throw new ExamConfigurationError("Every group member must be an active paper in the same class scope.");
    if (
      calculationMode === "WEIGHTED_NORMALIZED" &&
      !members.reduce((sum, member) => sum.add(member.contributionWeight!), new Prisma.Decimal(0)).equals(100)
    ) {
      throw new ExamConfigurationError("Weighted subject-group contributions must total exactly 100%.");
    }
    const created = await tx.examSubjectGroup.create({
      data: {
        examinationId,
        classScopeId: classScope.id,
        academicYear: examination.academicYear,
        className: classScope.className,
        section: classScope.section,
        groupCode: codeText(source.groupCode, "Group code", 40),
        groupName: safeText(source.groupName, "Group name", 120),
        calculationMode,
        displayOrder: positiveInteger(source.displayOrder, "Group display order", 500),
        createdByUserId: actor.id,
        members: { create: members }
      },
      include: { members: true }
    });
    await bumpExamination(tx, examinationId, examination.version);
    await appendAudit(tx, {
      examinationId,
      eventType: "SUBJECT_GROUP_CREATED",
      targetType: "SUBJECT_GROUP",
      targetId: created.id,
      newStatus: created.status,
      reason: interventionReason,
      actor,
      snapshot: { groupCode: created.groupCode, calculationMode, members }
    });
    return created;
  }).catch(rethrowKnownDatabaseError);
}

export async function createGradeScaleVersion(client: PrismaClient, examinationId: string, input: unknown, actor: ExamActor) {
  const source = objectInput(input);
  const interventionReason = governedInterventionReason(actor, source.interventionReason);
  const bands = validateGradeBands(source.bands);
  return client.$transaction(async (tx) => {
    const { examination, classScope } = await mutableScope(tx, examinationId, source.classScopeId, source.expectedExaminationVersion);
    const latest = await tx.gradeScaleVersion.findFirst({ where: { examinationId, classScopeId: classScope.id }, orderBy: { versionNumber: "desc" } });
    const created = await tx.gradeScaleVersion.create({
      data: {
        examinationId,
        classScopeId: classScope.id,
        academicYear: examination.academicYear,
        className: classScope.className,
        section: classScope.section,
        name: safeText(source.name, "Grade scale name", 120),
        scaleFamily: codeText(source.scaleFamily, "Grade scale family", 40),
        versionNumber: (latest?.versionNumber ?? 0) + 1,
        supersedesVersionId: latest?.id ?? null,
        createdByUserId: actor.id,
        bands: { create: bands }
      },
      include: { bands: { orderBy: { displayOrder: "asc" } } }
    });
    await bumpExamination(tx, examinationId, examination.version);
    await appendAudit(tx, {
      examinationId,
      eventType: "GRADE_SCALE_VERSION_CREATED",
      targetType: "GRADE_SCALE_VERSION",
      targetId: created.id,
      newStatus: created.status,
      reason: interventionReason,
      actor,
      snapshot: publicGradeScale(created)
    });
    return created;
  }).catch(rethrowKnownDatabaseError);
}

export async function createCoScholasticSchemeVersion(client: PrismaClient, examinationId: string, input: unknown, actor: ExamActor) {
  const source = objectInput(input);
  const interventionReason = governedInterventionReason(actor, source.interventionReason);
  const ratingScale = uniqueShortTextArray(source.ratingScale, "Co-scholastic rating scale", 2, 10);
  const itemLabels = uniqueShortTextArray(source.items, "Co-scholastic items", 1, 50);
  return client.$transaction(async (tx) => {
    const { examination, classScope } = await mutableScope(tx, examinationId, source.classScopeId, source.expectedExaminationVersion);
    const latest = await tx.coScholasticSchemeVersion.findFirst({ where: { examinationId, classScopeId: classScope.id }, orderBy: { versionNumber: "desc" } });
    const created = await tx.coScholasticSchemeVersion.create({
      data: {
        examinationId,
        classScopeId: classScope.id,
        academicYear: examination.academicYear,
        className: classScope.className,
        section: classScope.section,
        name: safeText(source.name, "Co-scholastic scheme name", 120),
        schemeFamily: codeText(source.schemeFamily, "Co-scholastic family", 40),
        ratingScaleJson: JSON.stringify(ratingScale),
        versionNumber: (latest?.versionNumber ?? 0) + 1,
        supersedesVersionId: latest?.id ?? null,
        createdByUserId: actor.id,
        items: {
          create: itemLabels.map((label, index) => ({
            itemCode: `ITEM_${index + 1}`,
            label,
            displayOrder: index + 1,
            isRequired: true
          }))
        }
      },
      include: { items: { orderBy: { displayOrder: "asc" } } }
    });
    await bumpExamination(tx, examinationId, examination.version);
    await appendAudit(tx, {
      examinationId,
      eventType: "CO_SCHOLASTIC_VERSION_CREATED",
      targetType: "CO_SCHOLASTIC_VERSION",
      targetId: created.id,
      newStatus: created.status,
      reason: interventionReason,
      actor,
      snapshot: { name: created.name, schemeFamily: created.schemeFamily, ratingScale, items: itemLabels }
    });
    return created;
  }).catch(rethrowKnownDatabaseError);
}

export async function createTemplateFamilyBinding(client: PrismaClient, examinationId: string, input: unknown, actor: ExamActor) {
  const source = objectInput(input);
  const interventionReason = governedInterventionReason(actor, source.interventionReason);
  return client.$transaction(async (tx) => {
    const { examination, classScope } = await mutableScope(tx, examinationId, source.classScopeId, source.expectedExaminationVersion);
    const templateFamily = enumText(source.templateFamily, EXAM_TEMPLATE_FAMILIES, "Template family");
    const reportCardTemplateId = requiredId(source.reportCardTemplateId, "Report-card template");
    const template = await tx.reportCardTemplate.findFirst({ where: { id: reportCardTemplateId, status: "ACTIVE" } });
    if (!template) throw new ExamConfigurationError("Choose an active canonical report-card template.");
    const definition = parseConfigurationJson(template.templateDefinitionJson, "Report-card template definition");
    if (canonicalFamilyFromDefinition(definition) !== templateFamily) {
      throw new ExamConfigurationError("The selected template does not match the canonical family.");
    }
    const expectedFamily = canonicalFamilyForClassName(classScope.className);
    if (expectedFamily && expectedFamily !== templateFamily) {
      throw new ExamConfigurationError("The canonical family does not match the configured class scope.");
    }
    if ((templateFamily === "KG_DEVELOPMENTAL_BOOKLET") !== (template.reportType === "KG_RUBRIC")) {
      throw new ExamConfigurationError("The canonical family does not match the template report type.");
    }
    const latest = await tx.examTemplateFamilyBinding.findFirst({ where: { examinationId, classScopeId: classScope.id }, orderBy: { versionNumber: "desc" } });
    const created = await tx.examTemplateFamilyBinding.create({
      data: {
        examinationId,
        classScopeId: classScope.id,
        academicYear: examination.academicYear,
        className: classScope.className,
        section: classScope.section,
        templateFamily,
        reportCardTemplateId,
        evidenceStatus: "DIRECTLY_EVIDENCED",
        versionNumber: (latest?.versionNumber ?? 0) + 1,
        createdByUserId: actor.id
      }
    });
    await bumpExamination(tx, examinationId, examination.version);
    await appendAudit(tx, {
      examinationId,
      eventType: "TEMPLATE_FAMILY_VERSION_CREATED",
      targetType: "TEMPLATE_FAMILY_BINDING",
      targetId: created.id,
      newStatus: created.status,
      reason: interventionReason,
      actor,
      snapshot: { templateFamily, reportCardTemplateId, evidenceStatus: created.evidenceStatus }
    });
    return created;
  }).catch(rethrowKnownDatabaseError);
}

export async function createTeacherExamAssignment(client: PrismaClient, examinationId: string, input: unknown, actor: ExamActor) {
  const source = objectInput(input);
  const interventionReason = governedInterventionReason(actor, source.interventionReason);
  const assignmentReason = safeText(source.assignmentReason, "Assignment reason", 1_000);
  return client.$transaction(async (tx) => {
    const { examination, classScope } = await mutableScope(tx, examinationId, source.classScopeId, source.expectedExaminationVersion);
    const subjectPaperId = requiredId(source.subjectPaperId, "Subject paper");
    const componentId = requiredId(source.componentId, "Scheme component");
    const staffMemberId = requiredId(source.staffMemberId, "Staff member");
    const assignmentRole = enumText(source.assignmentRole, ["PRIMARY_SUBMITTER", "CONTRIBUTOR"] as const, "Assignment role");
    const paper = await tx.examSubjectPaper.findFirst({
      where: { id: subjectPaperId, examinationId, classScopeId: classScope.id, status: "ACTIVE" }
    });
    if (!paper) throw new ExamConfigurationError("The selected subject paper is outside this class scope.");
    const component = await tx.examinationComponent.findFirst({
      where: { id: componentId, schemeVersion: { examinationId, classScopeId: classScope.id, status: "DRAFT" } },
      include: { schemeVersion: true }
    });
    if (!component) throw new ExamConfigurationError("The selected component is outside the current draft scheme version.");
    if (component.schemeVersion.subjectPaperId && component.schemeVersion.subjectPaperId !== subjectPaperId) {
      throw new ExamConfigurationError("The selected component belongs to a different subject-paper override.");
    }
    const staff = await tx.staffMember.findFirst({
      where: { id: staffMemberId, status: "ACTIVE", user: { isActive: true, role: "TEACHER" } },
      include: { timetableTeacher: true }
    });
    if (!staff?.timetableTeacher || !staff.timetableTeacher.isActive) {
      throw new ExamConfigurationError("No active Staff/timetable Teacher link exists for this assignment.");
    }
    const timetableAssignment = await tx.timetableAssignment.findFirst({
      where: {
        academicYear: examination.academicYear,
        classSectionId: classScope.timetableClassSectionId,
        subjectId: paper.timetableSubjectId,
        teacherId: staff.timetableTeacher.id
      }
    });
    if (!timetableAssignment) {
      throw new ExamConfigurationError("The Teacher has no exact timetable assignment for this academic year, class, section, and subject.");
    }
    const targetAssignments = await tx.teacherExamAssignment.findMany({
      where: { examinationId, classScopeId: classScope.id, subjectPaperId, componentId, status: "ACTIVE" }
    });
    if (assignmentRole === "PRIMARY_SUBMITTER" && targetAssignments.some((row) => row.assignmentRole === "PRIMARY_SUBMITTER")) {
      throw new ExamConfigurationError("This paper/component already has a primary submitter.");
    }
    if (assignmentRole === "CONTRIBUTOR" && !targetAssignments.some((row) => row.assignmentRole === "PRIMARY_SUBMITTER")) {
      throw new ExamConfigurationError("Assign one primary submitter before adding contributors.");
    }
    const created = await tx.teacherExamAssignment.create({
      data: {
        examinationId,
        classScopeId: classScope.id,
        timetableClassSectionId: classScope.timetableClassSectionId,
        subjectPaperId,
        schemeVersionId: component.schemeVersionId,
        componentId,
        academicYear: examination.academicYear,
        className: classScope.className,
        section: classScope.section,
        staffMemberId: staff.id,
        timetableTeacherId: staff.timetableTeacher.id,
        timetableAssignmentId: timetableAssignment.id,
        assignmentRole,
        assignmentReason,
        assignedByUserId: actor.id
      }
    });
    await bumpExamination(tx, examinationId, examination.version);
    await appendAudit(tx, {
      examinationId,
      schemeVersionId: component.schemeVersionId,
      assignmentId: created.id,
      eventType: "TEACHER_ASSIGNMENT_CREATED",
      targetType: "TEACHER_ASSIGNMENT",
      targetId: created.id,
      newStatus: created.status,
      reason: interventionReason ?? assignmentReason,
      actor,
      snapshot: {
        academicYear: created.academicYear,
        className: created.className,
        section: created.section,
        subjectPaperId,
        componentId,
        staffMemberId,
        assignmentRole
      }
    });
    return created;
  }).catch(rethrowKnownDatabaseError);
}

export async function archiveTeacherExamAssignment(
  client: PrismaClient,
  examinationId: string,
  assignmentId: string,
  input: unknown,
  actor: ExamActor
) {
  const source = objectInput(input);
  const interventionReason = governedInterventionReason(actor, source.interventionReason);
  const archiveReason = safeText(source.archiveReason, "Assignment archive reason", 1_000);
  const expectedVersion = expectedExamVersion(source.expectedVersion, "assignment");
  return client.$transaction(async (tx) => {
    const current = await tx.teacherExamAssignment.findFirst({
      where: { id: assignmentId, examinationId },
      include: { schemeVersion: { select: { status: true } } }
    });
    if (!current) throw new ExamConfigurationError("Teacher assignment was not found.", 404);
    if (current.status === "ARCHIVED") return current;
    const { examination } = await mutableScope(
      tx,
      examinationId,
      current.classScopeId,
      source.expectedExaminationVersion
    );
    if (current.schemeVersion.status !== "DRAFT") {
      throw new ExamConfigurationError(
        "Assignments in an active or frozen scheme are immutable; clone a new version for correction.",
        409
      );
    }
    if (current.assignmentRole === "PRIMARY_SUBMITTER") {
      const activeContributors = await tx.teacherExamAssignment.count({
        where: {
          examinationId,
          classScopeId: current.classScopeId,
          subjectPaperId: current.subjectPaperId,
          componentId: current.componentId,
          status: "ACTIVE",
          assignmentRole: "CONTRIBUTOR"
        }
      });
      if (activeContributors) {
        throw new ExamConfigurationError(
          "Archive explicit contributors before archiving the primary submitter; contributors cannot become hidden final owners.",
          409
        );
      }
    }
    const changed = await tx.teacherExamAssignment.updateMany({
      where: { id: assignmentId, examinationId, status: "ACTIVE", version: expectedVersion },
      data: { status: "ARCHIVED", archivedAt: new Date(), archivedByUserId: actor.id, archiveReason, version: { increment: 1 } }
    });
    if (changed.count !== 1) throw new ExamConfigurationError("This assignment changed in another session. Reload it before archiving.", 409);
    await bumpExamination(tx, examinationId, examination.version);
    const updated = await tx.teacherExamAssignment.findUniqueOrThrow({ where: { id: assignmentId } });
    await appendAudit(tx, {
      examinationId,
      schemeVersionId: current.schemeVersionId,
      assignmentId,
      eventType: "TEACHER_ASSIGNMENT_ARCHIVED",
      targetType: "TEACHER_ASSIGNMENT",
      targetId: assignmentId,
      previousStatus: current.status,
      newStatus: updated.status,
      reason: interventionReason ?? archiveReason,
      actor,
      snapshot: { archiveReason, version: updated.version }
    });
    return updated;
  }).catch(rethrowKnownDatabaseError);
}

export async function activateSchemeVersion(client: PrismaClient, examinationId: string, input: unknown, actor: ExamActor) {
  const source = objectInput(input);
  const interventionReason = governedInterventionReason(actor, source.interventionReason);
  const schemeVersionId = requiredId(source.schemeVersionId, "Scheme version");
  const activationReason = safeText(source.activationReason, "Activation reason", 1_000);
  const expectedVersion = expectedExamVersion(source.expectedVersion, "scheme");
  const expectedExaminationVersion = expectedExamVersion(source.expectedExaminationVersion, "examination");
  return client.$transaction(async (tx) => {
    const examination = await tx.examination.findUnique({ where: { id: examinationId }, include: { classScopes: { where: { status: "ACTIVE" } } } });
    if (!examination) throw new ExamConfigurationError("Examination configuration was not found.", 404);
    if (examination.status === "ARCHIVED") throw new ExamConfigurationError("An archived examination cannot activate a scheme.", 409);
    if (examination.version !== expectedExaminationVersion) {
      throw new ExamConfigurationError("This examination changed in another session. Reload it before activation.", 409);
    }
    const scheme = await tx.examinationSchemeVersion.findFirst({
      where: { id: schemeVersionId, examinationId },
      include: {
        components: { orderBy: { displayOrder: "asc" } },
        classScope: true
      }
    });
    if (!scheme) throw new ExamConfigurationError("Scheme version was not found.", 404);
    if (scheme.status === "ACTIVE") return scheme;
    if (scheme.status !== "DRAFT") throw new ExamConfigurationError("Only a draft scheme version can be activated.", 409);
    validateSchemeComponents(scheme.calculationMode, scheme.components.map((component) => ({
      componentCode: component.componentCode,
      name: component.name,
      componentKind: component.componentKind,
      displayOrder: component.displayOrder,
      maximumMarks: component.maximumMarks,
      contributionWeight: component.contributionWeight,
      isRequired: component.isRequired
    })));
    const [papers, groups, gradeScale, coScholastic, templateBinding, assignments] = await Promise.all([
      tx.examSubjectPaper.findMany({
        where: {
          examinationId,
          classScopeId: scheme.classScopeId,
          status: "ACTIVE",
          ...(scheme.subjectPaperId ? { id: scheme.subjectPaperId } : {})
        }
      }),
      tx.examSubjectGroup.findMany({ where: { examinationId, classScopeId: scheme.classScopeId, status: "ACTIVE" }, include: { members: true } }),
      tx.gradeScaleVersion.findFirst({ where: { examinationId, classScopeId: scheme.classScopeId, status: "DRAFT" }, include: { bands: true }, orderBy: { versionNumber: "desc" } }),
      tx.coScholasticSchemeVersion.findFirst({ where: { examinationId, classScopeId: scheme.classScopeId, status: "DRAFT" }, include: { items: true }, orderBy: { versionNumber: "desc" } }),
      tx.examTemplateFamilyBinding.findFirst({ where: { examinationId, classScopeId: scheme.classScopeId, status: "DRAFT" }, orderBy: { versionNumber: "desc" } }),
      tx.teacherExamAssignment.findMany({ where: { examinationId, classScopeId: scheme.classScopeId, schemeVersionId, status: "ACTIVE" } })
    ]);
    if (!papers.length) throw new ExamConfigurationError("Add at least one active subject paper before activation.");
    for (const group of groups) {
      if (group.members.length < 2) throw new ExamConfigurationError(`Subject group ${group.groupCode} is incomplete.`);
      if (
        group.calculationMode === "WEIGHTED_NORMALIZED" &&
        !group.members.reduce((sum, member) => sum.add(member.contributionWeight ?? 0), new Prisma.Decimal(0)).equals(100)
      ) {
        throw new ExamConfigurationError(`Subject group ${group.groupCode} weights must total exactly 100%.`);
      }
    }
    if (!gradeScale?.bands.length) throw new ExamConfigurationError("Create a complete grade-scale version before activation.");
    validateGradeBands(gradeScale.bands.map((band) => ({
      gradeCode: band.gradeCode,
      label: band.label,
      minimumPercentage: band.minimumPercentage,
      maximumPercentage: band.maximumPercentage,
      displayOrder: band.displayOrder,
      gradePoint: band.gradePoint,
      remarks: band.remarks
    })));
    if (!coScholastic?.items.length) throw new ExamConfigurationError("Create a co-scholastic scheme version before activation.");
    if (!templateBinding) throw new ExamConfigurationError("Select a report-template family before activation.");
    if (templateBinding.evidenceStatus !== "DIRECTLY_EVIDENCED") {
      throw new ExamConfigurationError("The selected report-template family still requires source approval and cannot be activated.");
    }
    for (const paper of papers) {
      for (const component of scheme.components) {
        const owners = assignments.filter((assignment) => assignment.subjectPaperId === paper.id && assignment.componentId === component.id);
        if (owners.filter((assignment) => assignment.assignmentRole === "PRIMARY_SUBMITTER").length !== 1) {
          throw new ExamConfigurationError(`Assign exactly one primary submitter for ${paper.paperName} / ${component.name}.`);
        }
      }
    }
    const now = new Date();
    await tx.examinationSchemeVersion.updateMany({
      where: { examinationId, classScopeId: scheme.classScopeId, scopeKey: scheme.scopeKey, status: "ACTIVE" },
      data: { status: "SUPERSEDED" }
    });
    const changed = await tx.examinationSchemeVersion.updateMany({
      where: { id: schemeVersionId, status: "DRAFT", version: expectedVersion },
      data: {
        status: "ACTIVE",
        activationReason,
        activatedByUserId: actor.id,
        activatedAt: now,
        frozenAt: now,
        version: { increment: 1 }
      }
    });
    if (changed.count !== 1) throw new ExamConfigurationError("This scheme changed in another session. Reload it before activation.", 409);
    await tx.gradeScaleVersion.updateMany({
      where: { examinationId, classScopeId: scheme.classScopeId, status: "ACTIVE", id: { not: gradeScale.id } },
      data: { status: "SUPERSEDED" }
    });
    await tx.gradeScaleVersion.update({
      where: { id: gradeScale.id },
      data: { status: "ACTIVE", activatedByUserId: actor.id, activatedAt: now, frozenAt: now, version: { increment: 1 } }
    });
    await tx.coScholasticSchemeVersion.updateMany({
      where: { examinationId, classScopeId: scheme.classScopeId, status: "ACTIVE", id: { not: coScholastic.id } },
      data: { status: "SUPERSEDED" }
    });
    await tx.coScholasticSchemeVersion.update({
      where: { id: coScholastic.id },
      data: { status: "ACTIVE", activatedByUserId: actor.id, activatedAt: now, frozenAt: now, version: { increment: 1 } }
    });
    await tx.examTemplateFamilyBinding.updateMany({
      where: { examinationId, classScopeId: scheme.classScopeId, status: "ACTIVE", id: { not: templateBinding.id } },
      data: { status: "SUPERSEDED" }
    });
    await tx.examTemplateFamilyBinding.update({
      where: { id: templateBinding.id },
      data: { status: "ACTIVE", activatedByUserId: actor.id, activatedAt: now, frozenAt: now, version: { increment: 1 } }
    });
    const activeScopeIds = await tx.examinationSchemeVersion.findMany({
      where: { examinationId, status: "ACTIVE", scopeKey: "BASE" },
      select: { classScopeId: true },
      distinct: ["classScopeId"]
    });
    const examinationChanged = await tx.examination.updateMany({
      where: { id: examinationId, version: expectedExaminationVersion, status: { not: "ARCHIVED" } },
      data: activeScopeIds.length === examination.classScopes.length
        ? { status: "ACTIVE", activatedAt: examination.activatedAt ?? now, activatedByUserId: actor.id, version: { increment: 1 } }
        : { version: { increment: 1 } }
    });
    if (examinationChanged.count !== 1) {
      throw new ExamConfigurationError("This examination changed in another session. Reload it before activation.", 409);
    }
    const updated = await tx.examinationSchemeVersion.findUniqueOrThrow({
      where: { id: schemeVersionId },
      include: { components: { orderBy: { displayOrder: "asc" } } }
    });
    await appendAudit(tx, {
      examinationId,
      schemeVersionId,
      eventType: "SCHEME_VERSION_ACTIVATED_AND_FROZEN",
      targetType: "SCHEME_VERSION",
      targetId: schemeVersionId,
      previousStatus: scheme.status,
      newStatus: updated.status,
      reason: interventionReason ?? activationReason,
      actor,
      snapshot: {
        ...publicScheme(updated),
        papers: papers.map((paper) => ({ id: paper.id, paperCode: paper.paperCode, paperName: paper.paperName })),
        gradeScaleVersionId: gradeScale.id,
        coScholasticSchemeVersionId: coScholastic.id,
        templateBindingId: templateBinding.id,
        assignmentCount: assignments.length
      }
    });
    return updated;
  }).catch(rethrowKnownDatabaseError);
}

export async function archiveExaminationConfiguration(client: PrismaClient, examinationId: string, input: unknown, actor: ExamActor) {
  const source = objectInput(input);
  const interventionReason = governedInterventionReason(actor, source.interventionReason);
  const archiveReason = safeText(source.archiveReason, "Examination archive reason", 1_000);
  const expectedVersion = expectedExamVersion(source.expectedVersion);
  return client.$transaction(async (tx) => {
    const current = await tx.examination.findUnique({ where: { id: examinationId } });
    if (!current) throw new ExamConfigurationError("Examination configuration was not found.", 404);
    if (current.status === "ARCHIVED") return current;
    const changed = await tx.examination.updateMany({
      where: { id: examinationId, version: expectedVersion, status: { not: "ARCHIVED" } },
      data: {
        status: "ARCHIVED",
        archivedAt: new Date(),
        archivedByUserId: actor.id,
        archiveReason,
        interventionReason: interventionReason ?? current.interventionReason,
        version: { increment: 1 }
      }
    });
    if (changed.count !== 1) throw new ExamConfigurationError("This examination changed in another session. Reload it before archiving.", 409);
    await tx.examinationSchemeVersion.updateMany({
      where: { examinationId, status: { in: ["DRAFT", "ACTIVE"] } },
      data: { status: "ARCHIVED", archivedAt: new Date(), archivedByUserId: actor.id, archiveReason }
    });
    const updated = await tx.examination.findUniqueOrThrow({ where: { id: examinationId } });
    await appendAudit(tx, {
      examinationId,
      eventType: "EXAMINATION_ARCHIVED",
      targetType: "EXAMINATION",
      targetId: examinationId,
      previousStatus: current.status,
      newStatus: updated.status,
      reason: interventionReason ?? archiveReason,
      actor,
      snapshot: { archiveReason, version: updated.version }
    });
    return updated;
  }).catch(rethrowKnownDatabaseError);
}

export async function recordTeacherSchemeProposal(client: PrismaClient, examinationId: string, input: unknown, actor: ExamActor) {
  if (actor.role !== "TEACHER") throw new ExamConfigurationError("Only a Teacher can use the assigned-subject proposal workflow.", 403);
  const source = objectInput(input);
  const subjectPaperId = requiredId(source.subjectPaperId, "Subject paper");
  const proposalReason = safeText(source.proposalReason, "Proposal reason", 1_000);
  const validated = validateSchemeComponents(source.calculationMode, source.components);
  return client.$transaction(async (tx) => {
    const assignment = await tx.teacherExamAssignment.findFirst({
      where: {
        examinationId,
        subjectPaperId,
        status: "ACTIVE",
        examination: { status: { in: ["DRAFT", "ACTIVE"] } },
        staffMember: {
          userId: actor.id,
          status: "ACTIVE",
          user: { isActive: true, role: "TEACHER" },
          timetableTeacher: { is: { isActive: true } }
        }
      },
      include: { subjectPaper: true, classScope: true }
    });
    if (!assignment) throw new ExamConfigurationError("This subject is outside your exact active examination assignment.", 404);
    const audit = await appendAudit(tx, {
      examinationId,
      schemeVersionId: assignment.schemeVersionId,
      assignmentId: assignment.id,
      eventType: "TEACHER_SCHEME_PROPOSAL_RECORDED",
      targetType: "SUBJECT_PAPER",
      targetId: subjectPaperId,
      reason: proposalReason,
      actor,
      snapshot: {
        className: assignment.className,
        section: assignment.section,
        subjectPaper: assignment.subjectPaper.paperName,
        calculationMode: validated.calculationMode,
        roundingPolicyVersion: EXAM_ROUNDING_POLICY_V1,
        components: validated.components.map((component) => ({
          ...component,
          maximumMarks: component.maximumMarks.toString(),
          contributionWeight: component.contributionWeight?.toString() ?? null
        })),
        activationAuthority: "PRINCIPAL_ONLY"
      }
    });
    return { proposalId: audit.id, status: "PROPOSED", activationAuthority: "PRINCIPAL_ONLY" };
  }).catch(rethrowKnownDatabaseError);
}

export async function listTeacherExamAssignments(client: ExamClient, actor: Pick<ExamActor, "id" | "role">) {
  if (actor.role !== "TEACHER") throw new ExamConfigurationError("Teacher assignment view is available only to a Teacher.", 403);
  return client.teacherExamAssignment.findMany({
    where: {
      status: "ACTIVE",
      examination: { status: { in: ["DRAFT", "ACTIVE"] } },
      staffMember: {
        userId: actor.id,
        status: "ACTIVE",
        user: { isActive: true, role: "TEACHER" },
        timetableTeacher: { is: { isActive: true } }
      }
    },
    select: {
      id: true,
      academicYear: true,
      className: true,
      section: true,
      assignmentRole: true,
      assignmentReason: true,
      status: true,
      examination: { select: { id: true, examCode: true, name: true, examType: true, startDate: true, endDate: true, status: true } },
      subjectPaper: { select: { paperCode: true, paperName: true, subjectNameSnapshot: true } },
      component: { select: { componentCode: true, name: true, componentKind: true, maximumMarks: true, contributionWeight: true, isRequired: true } },
      schemeVersion: { select: { versionNumber: true, calculationMode: true, roundingPolicyVersion: true, status: true, frozenAt: true } }
    },
    orderBy: [
      { examination: { startDate: "desc" } },
      { className: "asc" },
      { section: "asc" },
      { subjectPaper: { displayOrder: "asc" } },
      { component: { displayOrder: "asc" } }
    ]
  });
}

export function publicExaminationConfiguration(row: unknown) {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    throw new ExamConfigurationError("Examination configuration data is unavailable.", 500);
  }
  const serialized = JSON.parse(JSON.stringify(row)) as Record<string, unknown>;
  if (typeof serialized.startDate === "string") serialized.startDate = serialized.startDate.slice(0, 10);
  if (typeof serialized.endDate === "string") serialized.endDate = serialized.endDate.slice(0, 10);
  return serialized;
}

function publicScheme(row: object) {
  return JSON.parse(JSON.stringify(row)) as Record<string, unknown>;
}

function publicGradeScale(row: object) {
  return JSON.parse(JSON.stringify(row)) as Record<string, unknown>;
}

async function mutableScope(
  tx: Prisma.TransactionClient,
  examinationId: string,
  classScopeIdValue: unknown,
  expectedExaminationVersionValue: unknown
) {
  const expectedExaminationVersion = expectedExamVersion(expectedExaminationVersionValue, "examination");
  const examination = await tx.examination.findUnique({ where: { id: examinationId } });
  if (!examination) throw new ExamConfigurationError("Examination configuration was not found.", 404);
  if (examination.status === "ARCHIVED") throw new ExamConfigurationError("An archived examination is immutable.", 409);
  if (examination.version !== expectedExaminationVersion) {
    throw new ExamConfigurationError("This examination changed in another session. Reload it before continuing.", 409);
  }
  const classScopeId = requiredId(classScopeIdValue, "Class scope");
  const classScope = await tx.examinationClassScope.findFirst({
    where: { id: classScopeId, examinationId, status: "ACTIVE" }
  });
  if (!classScope) throw new ExamConfigurationError("The class and section scope was not found.", 404);
  return { examination, classScope };
}

async function bumpExamination(tx: Prisma.TransactionClient, examinationId: string, expectedVersion: number) {
  const changed = await tx.examination.updateMany({
    where: { id: examinationId, version: expectedVersion, status: { not: "ARCHIVED" } },
    data: { version: { increment: 1 } }
  });
  if (changed.count !== 1) throw new ExamConfigurationError("This examination changed in another session. Reload it before continuing.", 409);
}

async function appendAudit(
  tx: Prisma.TransactionClient,
  input: {
    examinationId: string;
    schemeVersionId?: string | null;
    assignmentId?: string | null;
    eventType: string;
    targetType: string;
    targetId: string;
    previousStatus?: string | null;
    newStatus?: string | null;
    reason?: string | null;
    actor: ExamActor;
    snapshot: unknown;
  }
) {
  return tx.examinationSchemeAudit.create({
    data: {
      examinationId: input.examinationId,
      schemeVersionId: input.schemeVersionId ?? null,
      assignmentId: input.assignmentId ?? null,
      eventType: input.eventType,
      targetType: input.targetType,
      targetId: input.targetId,
      previousStatus: input.previousStatus ?? null,
      newStatus: input.newStatus ?? null,
      reason: input.reason ?? null,
      actorUserId: input.actor.id,
      actorRole: input.actor.role,
      snapshotJson: JSON.stringify(input.snapshot),
      eventDate: new Date()
    }
  });
}

function objectInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ExamConfigurationError("Request data must be an object.");
  return value as Record<string, unknown>;
}

function parseConfigurationJson(value: string, label: string) {
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid");
    return parsed as Record<string, unknown>;
  } catch {
    throw new ExamConfigurationError(`${label} is invalid.`, 409);
  }
}

function academicYearText(value: unknown) {
  const text = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(text)) throw new ExamConfigurationError("Academic year must use YYYY-YY format.");
  return text;
}

function dateOnly(value: unknown, label: string) {
  const text = value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new ExamConfigurationError(`${label} must be a valid date.`);
  const date = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== text) throw new ExamConfigurationError(`${label} must be a valid date.`);
  return date;
}

function safeText(value: unknown, label: string, max: number) {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!text || text.length > max || /[\u0000-\u001F\u007F]/.test(text)) throw new ExamConfigurationError(`${label} is required and must be ${max} characters or fewer.`);
  return text;
}

function optionalText(value: unknown, label: string, max: number) {
  if (value == null || String(value).trim() === "") return null;
  return safeText(value, label, max);
}

function codeText(value: unknown, label: string, max: number) {
  const code = String(value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (!code || code.length > max) throw new ExamConfigurationError(`${label} must use letters, numbers, spaces, hyphens, or underscores.`);
  return code;
}

function enumText<const T extends readonly string[]>(value: unknown, allowed: T, label: string): T[number] {
  const text = String(value ?? "").trim().toUpperCase();
  if (!(allowed as readonly string[]).includes(text)) throw new ExamConfigurationError(`${label} is unsupported.`);
  return text as T[number];
}

function positiveInteger(value: unknown, label: string, max: number) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > max) throw new ExamConfigurationError(`${label} must be a whole number from 1 to ${max}.`);
  return parsed;
}

function decimal(value: unknown, label: string) {
  try {
    const result = new Prisma.Decimal(String(value ?? "").trim());
    if (!result.isFinite() || result.decimalPlaces() > 4) throw new Error("invalid");
    return result;
  } catch {
    throw new ExamConfigurationError(`${label} must be a decimal with at most four places.`);
  }
}

function positiveDecimal(value: unknown, label: string) {
  const result = decimal(value, label);
  if (result.lte(0)) throw new ExamConfigurationError(`${label} must be greater than zero.`);
  return result;
}

function optionalPositiveDecimal(value: unknown, label: string) {
  if (value == null || String(value).trim() === "") return null;
  return positiveDecimal(value, label);
}

function boundedDecimal(value: unknown, label: string, minimum: number, maximum: number) {
  const result = decimal(value, label);
  if (result.lt(minimum) || result.gt(maximum)) throw new ExamConfigurationError(`${label} must be between ${minimum} and ${maximum}.`);
  return result;
}

function requiredId(value: unknown, label: string) {
  const text = String(value ?? "").trim();
  if (!text || text.length > 200 || !/^[A-Za-z0-9_-]+$/.test(text)) throw new ExamConfigurationError(`${label} is required.`);
  return text;
}

function optionalId(value: unknown) {
  if (value == null || String(value).trim() === "") return null;
  return requiredId(value, "Identifier");
}

function uniqueIds(value: unknown, label: string, max: number) {
  if (!Array.isArray(value) || !value.length || value.length > max) throw new ExamConfigurationError(`Select between 1 and ${max} ${label} entries.`);
  const ids = value.map((item) => requiredId(item, label));
  if (new Set(ids).size !== ids.length) throw new ExamConfigurationError(`Duplicate ${label} selections are not allowed.`);
  return ids;
}

function uniqueShortTextArray(value: unknown, label: string, minimum: number, maximum: number) {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) {
    throw new ExamConfigurationError(`${label} requires between ${minimum} and ${maximum} entries.`);
  }
  const values = value.map((item, index) => safeText(item, `${label} ${index + 1}`, 120));
  const normalized = values.map((item) => item.toLocaleLowerCase("en-IN"));
  if (new Set(normalized).size !== normalized.length) throw new ExamConfigurationError(`${label} entries must be unique.`);
  return values;
}

function governedInterventionReason(actor: ExamActor, value: unknown) {
  if (actor.role !== "SUPER_ADMIN") return null;
  return safeText(value, "Super Admin intervention audit reason", 1_000);
}

function rethrowKnownDatabaseError(error: unknown): never {
  if (error instanceof ExamConfigurationError) throw error;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") throw new ExamConfigurationError("A configuration row with the same governed identity already exists.", 409);
    if (error.code === "P2003") throw new ExamConfigurationError("A required linked configuration record is unavailable.", 409);
  }
  throw new ExamConfigurationError("The examination configuration could not be completed safely.", 500);
}
