import { copyFileSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/password";
import { hasRolePermission } from "../lib/role-permissions";
import {
  ExamConfigurationError,
  activateSchemeVersion,
  archiveExaminationConfiguration,
  archiveTeacherExamAssignment,
  createCoScholasticSchemeVersion,
  createExaminationConfiguration,
  createGradeScaleVersion,
  createSchemeVersion,
  createSubjectGroup,
  createSubjectPaper,
  createTeacherExamAssignment,
  createTemplateFamilyBinding,
  listTeacherExamAssignments,
  recordTeacherSchemeProposal,
  validateSchemeComponents
} from "../lib/exam-configurations";
import {
  OPERATIONAL_DATABASE,
  QA_ROOT,
  assertIsolatedDatabasePath,
  businessBaseline,
  cleanupIsolatedDatabase,
  createEmptyIsolatedDatabase,
  databaseUrl,
  fileSha256,
  runPrisma
} from "./migration-check-utils";

const STATE_PATH = path.join(QA_ROOT, "reports", "EXAM1QA-browser-state.json");
const PRINCIPAL_USERNAME = "exam1qa-principal";
const TEACHER_USERNAME = "exam1qa-teacher-a";
const PRINCIPAL_PASSWORD = "EXAM1QA-local-only-Principal-2026!";
const TEACHER_PASSWORD = "EXAM1QA-local-only-Teacher-A-2026!";

type QaState = {
  databasePath: string;
  sourceHash: string;
  examinationId: string;
  principalUsername: string;
  principalPassword: string;
  teacherUsername: string;
  teacherPassword: string;
};

type Actor = {
  id: string;
  name: string;
  role: "SUPER_ADMIN" | "DIRECTOR" | "PRINCIPAL" | "TEACHER";
};

function readState() {
  if (!existsSync(STATE_PATH)) throw new Error("EXAM1QA_STATE_MISSING");
  const state = JSON.parse(readFileSync(STATE_PATH, "utf8")) as QaState;
  state.databasePath = assertIsolatedDatabasePath(state.databasePath);
  return state;
}

function removeState() {
  if (existsSync(STATE_PATH)) rmSync(STATE_PATH, { force: true });
}

async function currentExaminationVersion(client: PrismaClient, examinationId: string) {
  return (await client.examination.findUniqueOrThrow({
    where: { id: examinationId },
    select: { version: true }
  })).version;
}

async function governedInput(client: PrismaClient, examinationId: string, input: Record<string, unknown>) {
  return {
    ...input,
    expectedExaminationVersion: await currentExaminationVersion(client, examinationId)
  };
}

async function expectDomainError(
  label: string,
  operation: () => Promise<unknown> | unknown,
  expected: RegExp,
  status?: number
) {
  try {
    await operation();
  } catch (error) {
    if (
      error instanceof ExamConfigurationError &&
      expected.test(error.message) &&
      (status == null || error.status === status)
    ) {
      return;
    }
    throw error;
  }
  throw new Error(`${label}_NOT_REJECTED`);
}

function actor(user: { id: string; name: string; role: string }): Actor {
  return { id: user.id, name: user.name, role: user.role as Actor["role"] };
}

async function createFixture(databasePath: string) {
  const client = new PrismaClient({ datasourceUrl: databaseUrl(databasePath) });
  try {
    const passwordHashes = await Promise.all([
      hashPassword("EXAM1QA-local-only-Super-Admin-2026!"),
      hashPassword("EXAM1QA-local-only-Director-2026!"),
      hashPassword(PRINCIPAL_PASSWORD),
      hashPassword(TEACHER_PASSWORD),
      hashPassword("EXAM1QA-local-only-Teacher-B-2026!")
    ]);
    const [superAdmin, director, principal, teacherAUser, teacherBUser] = await Promise.all([
      client.user.create({
        data: {
          name: "EXAM1QA Super Admin",
          username: "exam1qa-super-admin",
          passwordHash: passwordHashes[0],
          role: "SUPER_ADMIN",
          isActive: true
        }
      }),
      client.user.create({
        data: {
          name: "EXAM1QA Director",
          username: "exam1qa-director",
          passwordHash: passwordHashes[1],
          role: "DIRECTOR",
          isActive: true
        }
      }),
      client.user.create({
        data: {
          name: "EXAM1QA Principal",
          username: PRINCIPAL_USERNAME,
          passwordHash: passwordHashes[2],
          role: "PRINCIPAL",
          isActive: true
        }
      }),
      client.user.create({
        data: {
          name: "EXAM1QA Teacher A",
          username: TEACHER_USERNAME,
          passwordHash: passwordHashes[3],
          role: "TEACHER",
          isActive: true
        }
      }),
      client.user.create({
        data: {
          name: "EXAM1QA Teacher B",
          username: "exam1qa-teacher-b",
          passwordHash: passwordHashes[4],
          role: "TEACHER",
          isActive: true
        }
      })
    ]);
    const principalActor = actor(principal);
    const teacherAActor = actor(teacherAUser);
    const superAdminActor = actor(superAdmin);

    if (
      !(await hasRolePermission(client, "PRINCIPAL", "MANAGE_EXAM_CONFIGURATION")) ||
      !(await hasRolePermission(client, "PRINCIPAL", "ACTIVATE_EXAM_SCHEMES")) ||
      !(await hasRolePermission(client, "DIRECTOR", "MANAGE_EXAM_CONFIGURATION")) ||
      !(await hasRolePermission(client, "TEACHER", "ENTER_MARKS")) ||
      await hasRolePermission(client, "TEACHER", "ACTIVATE_EXAM_SCHEMES")
    ) {
      throw new Error("EXAM1QA_ROLE_BOUNDARY_INVALID");
    }
    await client.rolePermission.upsert({
      where: { role_permission: { role: "TEACHER", permission: "PROPOSE_EXAM_SCHEMES" } },
      update: { enabled: true },
      create: { role: "TEACHER", permission: "PROPOSE_EXAM_SCHEMES", enabled: true }
    });
    if (!(await hasRolePermission(client, "TEACHER", "PROPOSE_EXAM_SCHEMES"))) {
      throw new Error("EXAM1QA_TEACHER_PROPOSAL_PERMISSION_MISSING");
    }

    await expectDomainError(
      "EXAM1QA_SUPER_ADMIN_REASON",
      () => createExaminationConfiguration(client, {
        examCode: "EXAM1QA-SA-NO-REASON",
        academicYear: "2026-27",
        name: "EXAM1QA Super Admin Refusal Probe",
        examType: "TERM",
        startDate: "2026-08-01",
        endDate: "2026-08-02",
        classSectionIds: ["not-created"]
      }, superAdminActor),
      /intervention audit reason/i
    );

    const [teacherA, teacherB] = await Promise.all([
      client.timetableTeacher.create({
        data: {
          name: "EXAM1QA Teacher A",
          shortName: "E1QA-A",
          department: "EXAM1QA Synthetic",
          maxPeriodsPerWeek: 30,
          maxPeriodsPerDay: 8,
          isActive: true
        }
      }),
      client.timetableTeacher.create({
        data: {
          name: "EXAM1QA Teacher B",
          shortName: "E1QA-B",
          department: "EXAM1QA Synthetic",
          maxPeriodsPerWeek: 30,
          maxPeriodsPerDay: 8,
          isActive: true
        }
      })
    ]);
    const [staffA, staffB] = await Promise.all([
      client.staffMember.create({
        data: {
          staffCode: "EXAM1QA-T01",
          fullName: "EXAM1QA Teacher A",
          displayName: "EXAM1QA Teacher A",
          staffType: "TEACHING",
          designation: "Synthetic Mathematics Teacher",
          department: "EXAM1QA Synthetic",
          status: "ACTIVE",
          userId: teacherAUser.id,
          timetableTeacherId: teacherA.id
        }
      }),
      client.staffMember.create({
        data: {
          staffCode: "EXAM1QA-T02",
          fullName: "EXAM1QA Teacher B",
          displayName: "EXAM1QA Teacher B",
          staffType: "TEACHING",
          designation: "Synthetic Science Teacher",
          department: "EXAM1QA Synthetic",
          status: "ACTIVE",
          userId: teacherBUser.id,
          timetableTeacherId: teacherB.id
        }
      })
    ]);
    const [sectionA, sectionB, nextYearSection] = await Promise.all([
      client.timetableClassSection.create({
        data: {
          academicYear: "2026-27",
          className: "EXAM1QA",
          section: "A",
          displayName: "EXAM1QA - A",
          groupName: "EXAM1QA SYNTHETIC",
          isActive: true
        }
      }),
      client.timetableClassSection.create({
        data: {
          academicYear: "2026-27",
          className: "EXAM1QA",
          section: "B",
          displayName: "EXAM1QA - B",
          groupName: "EXAM1QA SYNTHETIC",
          isActive: true
        }
      }),
      client.timetableClassSection.create({
        data: {
          academicYear: "2027-28",
          className: "EXAM1QA",
          section: "A",
          displayName: "EXAM1QA - A (2027-28)",
          groupName: "EXAM1QA SYNTHETIC",
          isActive: true
        }
      })
    ]);
    const [mathematics, science] = await Promise.all([
      client.timetableSubject.create({
        data: { name: "EXAM1QA Mathematics", shortName: "E1QA-MATH", department: "EXAM1QA Synthetic", isActive: true }
      }),
      client.timetableSubject.create({
        data: { name: "EXAM1QA Science", shortName: "E1QA-SCI", department: "EXAM1QA Synthetic", isActive: true }
      })
    ]);
    const timetableRows = [
      ["2026-27", sectionA.id, mathematics.id, teacherA.id],
      ["2026-27", sectionA.id, mathematics.id, teacherB.id],
      ["2026-27", sectionA.id, science.id, teacherB.id],
      ["2026-27", sectionB.id, mathematics.id, teacherA.id],
      ["2026-27", sectionB.id, mathematics.id, teacherB.id],
      ["2026-27", sectionB.id, science.id, teacherB.id],
      ["2027-28", nextYearSection.id, mathematics.id, teacherA.id]
    ] as const;
    for (const [academicYear, classSectionId, subjectId, teacherId] of timetableRows) {
      await client.timetableAssignment.create({
        data: {
          academicYear,
          classSectionId,
          subjectId,
          teacherId,
          periodsPerWeek: 5,
          notes: "EXAM1QA synthetic exact-scope fixture"
        }
      });
    }

    await createExaminationConfiguration(client, {
      examCode: "EXAM1QA",
      academicYear: "2026-27",
      name: "EXAM1QA Independent Foundation Verification",
      examType: "TERM",
      startDate: "2026-09-01",
      endDate: "2026-09-12",
      description: "Synthetic copied-database matrix for EXAM-RC-IMPL-1-QA.",
      classSectionIds: [sectionA.id, sectionB.id]
    }, principalActor);
    const examination = await client.examination.findUniqueOrThrow({
      where: { examCode: "EXAM1QA" },
      include: { classScopes: true }
    });
    const scopeA = examination.classScopes.find((scope) => scope.section === "A");
    const scopeB = examination.classScopes.find((scope) => scope.section === "B");
    if (!scopeA || !scopeB) throw new Error("EXAM1QA_CLASS_SCOPE_MISSING");

    const mathPaperA = await createSubjectPaper(client, examination.id, await governedInput(client, examination.id, {
      classScopeId: scopeA.id,
      timetableSubjectId: mathematics.id,
      paperCode: "MATH-A",
      paperName: "Mathematics Paper A",
      displayOrder: 1
    }), principalActor);
    const sciencePaperA = await createSubjectPaper(client, examination.id, await governedInput(client, examination.id, {
      classScopeId: scopeA.id,
      timetableSubjectId: science.id,
      paperCode: "SCI-A",
      paperName: "Science Paper A",
      displayOrder: 2
    }), principalActor);
    const mathPaperB = await createSubjectPaper(client, examination.id, await governedInput(client, examination.id, {
      classScopeId: scopeB.id,
      timetableSubjectId: mathematics.id,
      paperCode: "MATH-B",
      paperName: "Mathematics Paper B",
      displayOrder: 1
    }), principalActor);
    const sciencePaperB = await createSubjectPaper(client, examination.id, await governedInput(client, examination.id, {
      classScopeId: scopeB.id,
      timetableSubjectId: science.id,
      paperCode: "SCI-B",
      paperName: "Science Paper B",
      displayOrder: 2
    }), principalActor);

    await expectDomainError(
      "EXAM1QA_WEIGHTED_GROUP_TOTAL",
      async () => createSubjectGroup(client, examination.id, await governedInput(client, examination.id, {
        classScopeId: scopeA.id,
        groupCode: "BAD-WEIGHT",
        groupName: "Invalid Weighted Group",
        calculationMode: "WEIGHTED_NORMALIZED",
        displayOrder: 10,
        members: [
          { subjectPaperId: mathPaperA.id, contributionWeight: 60 },
          { subjectPaperId: sciencePaperA.id, contributionWeight: 30 }
        ]
      }), principalActor),
      /exactly 100%/i
    );
    await createSubjectGroup(client, examination.id, await governedInput(client, examination.id, {
      classScopeId: scopeA.id,
      groupCode: "CORE-W",
      groupName: "Weighted Core Subjects",
      calculationMode: "WEIGHTED_NORMALIZED",
      displayOrder: 1,
      members: [
        { subjectPaperId: mathPaperA.id, contributionWeight: 50 },
        { subjectPaperId: sciencePaperA.id, contributionWeight: 50 }
      ]
    }), principalActor);
    await createSubjectGroup(client, examination.id, await governedInput(client, examination.id, {
      classScopeId: scopeB.id,
      groupCode: "CORE-R",
      groupName: "Raw Core Subjects",
      calculationMode: "RAW_SUM",
      displayOrder: 1,
      members: [
        { subjectPaperId: mathPaperB.id },
        { subjectPaperId: sciencePaperB.id }
      ]
    }), principalActor);

    for (const [label, input, pattern] of [
      ["ZERO", [{ componentCode: "X", name: "X", componentKind: "WRITTEN", displayOrder: 1, maximumMarks: 0 }], /greater than zero/i],
      ["NEGATIVE", [{ componentCode: "X", name: "X", componentKind: "WRITTEN", displayOrder: 1, maximumMarks: -1 }], /greater than zero/i],
      ["DUPLICATE", [
        { componentCode: "X", name: "X", componentKind: "WRITTEN", displayOrder: 1, maximumMarks: 10 },
        { componentCode: "X", name: "Y", componentKind: "ORAL", displayOrder: 2, maximumMarks: 10 }
      ], /duplicate component/i]
    ] as const) {
      await expectDomainError(`EXAM1QA_${label}`, () => validateSchemeComponents("RAW_SUM", input), pattern);
    }
    await expectDomainError(
      "EXAM1QA_WEIGHT_TOTAL",
      () => validateSchemeComponents("WEIGHTED_NORMALIZED", [
        { componentCode: "A", name: "A", componentKind: "WRITTEN", displayOrder: 1, maximumMarks: 80, contributionWeight: 70 },
        { componentCode: "B", name: "B", componentKind: "INTERNAL", displayOrder: 2, maximumMarks: 20, contributionWeight: 29 }
      ]),
      /exactly 100%/i
    );

    const schemeA = await createSchemeVersion(client, examination.id, await governedInput(client, examination.id, {
      classScopeId: scopeA.id,
      calculationMode: "WEIGHTED_NORMALIZED",
      components: [
        { componentCode: "THEORY", name: "Theory", componentKind: "WRITTEN", displayOrder: 1, maximumMarks: 80, contributionWeight: 60, isRequired: true },
        { componentCode: "INTERNAL", name: "Internal Assessment", componentKind: "INTERNAL", displayOrder: 2, maximumMarks: 20, contributionWeight: 25, isRequired: true },
        { componentCode: "PROJECT", name: "Project", componentKind: "PROJECT", displayOrder: 3, maximumMarks: 10, contributionWeight: 15, isRequired: false }
      ]
    }), principalActor);
    const schemeB = await createSchemeVersion(client, examination.id, await governedInput(client, examination.id, {
      classScopeId: scopeB.id,
      calculationMode: "RAW_SUM",
      components: [
        { componentCode: "WRITTEN", name: "Written Examination", componentKind: "WRITTEN", displayOrder: 1, maximumMarks: 40, isRequired: true },
        { componentCode: "ORAL", name: "Oral Assessment", componentKind: "ORAL", displayOrder: 2, maximumMarks: 10, isRequired: false }
      ]
    }), principalActor);
    const mathOverride = await createSchemeVersion(client, examination.id, await governedInput(client, examination.id, {
      classScopeId: scopeA.id,
      subjectPaperId: mathPaperA.id,
      calculationMode: "RAW_SUM",
      components: [
        { componentCode: "MATH-PAPER", name: "Mathematics Paper", componentKind: "WRITTEN", displayOrder: 1, maximumMarks: 25, isRequired: true }
      ]
    }), principalActor);

    await client.staffMember.update({ where: { id: staffB.id }, data: { status: "INACTIVE" } });
    await expectDomainError(
      "EXAM1QA_INACTIVE_TEACHER",
      async () => createTeacherExamAssignment(client, examination.id, await governedInput(client, examination.id, {
        classScopeId: scopeA.id,
        subjectPaperId: sciencePaperA.id,
        componentId: schemeA.components[0].id,
        staffMemberId: staffB.id,
        assignmentRole: "PRIMARY_SUBMITTER",
        assignmentReason: "EXAM1QA inactive Teacher refusal."
      }), principalActor),
      /no active Staff\/timetable Teacher link/i
    );
    await client.staffMember.update({ where: { id: staffB.id }, data: { status: "ACTIVE", timetableTeacherId: null } });
    await expectDomainError(
      "EXAM1QA_UNLINKED_TEACHER",
      async () => createTeacherExamAssignment(client, examination.id, await governedInput(client, examination.id, {
        classScopeId: scopeA.id,
        subjectPaperId: sciencePaperA.id,
        componentId: schemeA.components[0].id,
        staffMemberId: staffB.id,
        assignmentRole: "PRIMARY_SUBMITTER",
        assignmentReason: "EXAM1QA unlinked Teacher refusal."
      }), principalActor),
      /no active Staff\/timetable Teacher link/i
    );
    await client.staffMember.update({ where: { id: staffB.id }, data: { timetableTeacherId: teacherB.id } });
    await expectDomainError(
      "EXAM1QA_SUBJECT_TAMPERING",
      async () => createTeacherExamAssignment(client, examination.id, await governedInput(client, examination.id, {
        classScopeId: scopeA.id,
        subjectPaperId: sciencePaperA.id,
        componentId: schemeA.components[0].id,
        staffMemberId: staffA.id,
        assignmentRole: "PRIMARY_SUBMITTER",
        assignmentReason: "EXAM1QA cross-subject refusal."
      }), principalActor),
      /no exact timetable assignment/i
    );
    await expectDomainError(
      "EXAM1QA_SCOPE_TAMPERING",
      async () => createTeacherExamAssignment(client, examination.id, await governedInput(client, examination.id, {
        classScopeId: scopeA.id,
        subjectPaperId: mathPaperB.id,
        componentId: schemeA.components[0].id,
        staffMemberId: staffA.id,
        assignmentRole: "PRIMARY_SUBMITTER",
        assignmentReason: "EXAM1QA cross-section refusal."
      }), principalActor),
      /outside this class scope/i
    );
    await expectDomainError(
      "EXAM1QA_PAPER_OVERRIDE_TAMPERING",
      async () => createTeacherExamAssignment(client, examination.id, await governedInput(client, examination.id, {
        classScopeId: scopeA.id,
        subjectPaperId: sciencePaperA.id,
        componentId: mathOverride.components[0].id,
        staffMemberId: staffB.id,
        assignmentRole: "PRIMARY_SUBMITTER",
        assignmentReason: "EXAM1QA wrong paper-override refusal."
      }), principalActor),
      /different subject-paper override/i
    );

    for (const scope of [scopeA, scopeB]) {
      await createGradeScaleVersion(client, examination.id, await governedInput(client, examination.id, {
        classScopeId: scope.id,
        name: `EXAM1QA Grade Scale ${scope.section}`,
        scaleFamily: "SECONDARY_VI_X",
        bands: [
          { gradeCode: "A", label: "Excellent", minimumPercentage: 80, maximumPercentage: 100, displayOrder: 1 },
          { gradeCode: "B", label: "Good", minimumPercentage: 60, maximumPercentage: 79.9999, displayOrder: 2 },
          { gradeCode: "C", label: "Developing", minimumPercentage: 0, maximumPercentage: 59.9999, displayOrder: 3 }
        ]
      }), principalActor);
      await createCoScholasticSchemeVersion(client, examination.id, await governedInput(client, examination.id, {
        classScopeId: scope.id,
        name: `EXAM1QA Co-Scholastic ${scope.section}`,
        schemeFamily: "SECONDARY_PERSONALITY",
        ratingScale: ["A", "B", "C"],
        items: ["Work Education", "Art Education", "Health and Physical Education"]
      }), principalActor);
      await createTemplateFamilyBinding(client, examination.id, await governedInput(client, examination.id, {
        classScopeId: scope.id,
        templateFamily: "SECONDARY_10_40_GROUPED"
      }), principalActor);
    }

    const assignmentRows: Array<{
      scopeId: string;
      paperId: string;
      componentId: string;
      staffId: string;
    }> = [];
    for (const [scope, scheme, papers] of [
      [scopeA, schemeA, [[mathPaperA, staffA], [sciencePaperA, staffB]]],
      [scopeB, schemeB, [[mathPaperB, staffA], [sciencePaperB, staffB]]]
    ] as const) {
      for (const [paper, staff] of papers) {
        for (const component of scheme.components) {
          assignmentRows.push({ scopeId: scope.id, paperId: paper.id, componentId: component.id, staffId: staff.id });
        }
      }
    }
    for (const row of assignmentRows) {
      await createTeacherExamAssignment(client, examination.id, await governedInput(client, examination.id, {
        classScopeId: row.scopeId,
        subjectPaperId: row.paperId,
        componentId: row.componentId,
        staffMemberId: row.staffId,
        assignmentRole: "PRIMARY_SUBMITTER",
        assignmentReason: "EXAM1QA exact primary ownership."
      }), principalActor);
    }
    await createTeacherExamAssignment(client, examination.id, await governedInput(client, examination.id, {
      classScopeId: scopeA.id,
      subjectPaperId: mathPaperA.id,
      componentId: schemeA.components[0].id,
      staffMemberId: staffB.id,
      assignmentRole: "CONTRIBUTOR",
      assignmentReason: "EXAM1QA explicit audited contributor."
    }), principalActor);
    await createTeacherExamAssignment(client, examination.id, await governedInput(client, examination.id, {
      classScopeId: scopeA.id,
      subjectPaperId: mathPaperA.id,
      componentId: mathOverride.components[0].id,
      staffMemberId: staffA.id,
      assignmentRole: "PRIMARY_SUBMITTER",
      assignmentReason: "EXAM1QA paper-override primary ownership."
    }), principalActor);

    await activateSchemeVersion(client, examination.id, {
      expectedExaminationVersion: await currentExaminationVersion(client, examination.id),
      schemeVersionId: schemeA.id,
      expectedVersion: schemeA.version,
      activationReason: "EXAM1QA Principal activation and freeze for section A."
    }, principalActor);
    await activateSchemeVersion(client, examination.id, {
      expectedExaminationVersion: await currentExaminationVersion(client, examination.id),
      schemeVersionId: schemeB.id,
      expectedVersion: schemeB.version,
      activationReason: "EXAM1QA Principal activation and freeze for section B."
    }, principalActor);

    for (const operation of [
      async () => createGradeScaleVersion(client, examination.id, await governedInput(client, examination.id, {
        classScopeId: scopeA.id,
        name: "EXAM1QA Grade Scale A Override",
        scaleFamily: "SECONDARY_VI_X",
        bands: [
          { gradeCode: "A", label: "Excellent", minimumPercentage: 80, maximumPercentage: 100, displayOrder: 1 },
          { gradeCode: "B", label: "Good", minimumPercentage: 0, maximumPercentage: 79.9999, displayOrder: 2 }
        ]
      }), principalActor),
      async () => createCoScholasticSchemeVersion(client, examination.id, await governedInput(client, examination.id, {
        classScopeId: scopeA.id,
        name: "EXAM1QA Co-Scholastic A Override",
        schemeFamily: "SECONDARY_PERSONALITY",
        ratingScale: ["A", "B"],
        items: ["Work Education"]
      }), principalActor),
      async () => createTemplateFamilyBinding(client, examination.id, await governedInput(client, examination.id, {
        classScopeId: scopeA.id,
        templateFamily: "SECONDARY_10_40_GROUPED"
      }), principalActor)
    ]) {
      await operation();
    }
    await activateSchemeVersion(client, examination.id, {
      expectedExaminationVersion: await currentExaminationVersion(client, examination.id),
      schemeVersionId: mathOverride.id,
      expectedVersion: mathOverride.version,
      activationReason: "EXAM1QA Principal activation of the Mathematics paper override."
    }, principalActor);

    const activeAssignment = await client.teacherExamAssignment.findFirstOrThrow({
      where: { schemeVersionId: schemeA.id, assignmentRole: "PRIMARY_SUBMITTER", status: "ACTIVE" }
    });
    await expectDomainError(
      "EXAM1QA_ACTIVE_ASSIGNMENT_IMMUTABILITY",
      async () => archiveTeacherExamAssignment(client, examination.id, activeAssignment.id, {
        expectedExaminationVersion: await currentExaminationVersion(client, examination.id),
        expectedVersion: activeAssignment.version,
        archiveReason: "EXAM1QA active-history mutation refusal."
      }, principalActor),
      /active or frozen scheme are immutable/i,
      409
    );

    const cloned = await createSchemeVersion(client, examination.id, await governedInput(client, examination.id, {
      classScopeId: scopeA.id,
      cloneSourceId: schemeA.id
    }), principalActor);
    if (cloned.versionNumber !== 2 || cloned.supersedesVersionId !== schemeA.id || cloned.status !== "DRAFT") {
      throw new Error("EXAM1QA_CLONE_VERSION_INVALID");
    }
    const concurrentVersion = await currentExaminationVersion(client, examination.id);
    const concurrentPrimary = await createTeacherExamAssignment(client, examination.id, {
      expectedExaminationVersion: concurrentVersion,
      classScopeId: scopeA.id,
      subjectPaperId: mathPaperA.id,
      componentId: cloned.components[0].id,
      staffMemberId: staffA.id,
      assignmentRole: "PRIMARY_SUBMITTER",
      assignmentReason: "EXAM1QA optimistic-concurrency primary."
    }, principalActor);
    await expectDomainError(
      "EXAM1QA_STALE_VERSION",
      () => createTeacherExamAssignment(client, examination.id, {
        expectedExaminationVersion: concurrentVersion,
        classScopeId: scopeA.id,
        subjectPaperId: mathPaperA.id,
        componentId: cloned.components[0].id,
        staffMemberId: staffB.id,
        assignmentRole: "PRIMARY_SUBMITTER",
        assignmentReason: "EXAM1QA stale competing primary."
      }, principalActor),
      /changed in another session/i,
      409
    );
    await expectDomainError(
      "EXAM1QA_OVERLAPPING_PRIMARY",
      async () => createTeacherExamAssignment(client, examination.id, await governedInput(client, examination.id, {
        classScopeId: scopeA.id,
        subjectPaperId: mathPaperA.id,
        componentId: cloned.components[0].id,
        staffMemberId: staffB.id,
        assignmentRole: "PRIMARY_SUBMITTER",
        assignmentReason: "EXAM1QA competing final owner."
      }), principalActor),
      /already has a primary submitter/i
    );
    const concurrentContributor = await createTeacherExamAssignment(client, examination.id, await governedInput(client, examination.id, {
      classScopeId: scopeA.id,
      subjectPaperId: mathPaperA.id,
      componentId: cloned.components[0].id,
      staffMemberId: staffB.id,
      assignmentRole: "CONTRIBUTOR",
      assignmentReason: "EXAM1QA explicit draft contributor."
    }), principalActor);
    await expectDomainError(
      "EXAM1QA_HIDDEN_FINAL_OWNER",
      async () => archiveTeacherExamAssignment(client, examination.id, concurrentPrimary.id, {
        expectedExaminationVersion: await currentExaminationVersion(client, examination.id),
        expectedVersion: concurrentPrimary.version,
        archiveReason: "EXAM1QA hidden-owner refusal."
      }, principalActor),
      /contributors before archiving the primary/i,
      409
    );
    await archiveTeacherExamAssignment(client, examination.id, concurrentContributor.id, {
      expectedExaminationVersion: await currentExaminationVersion(client, examination.id),
      expectedVersion: concurrentContributor.version,
      archiveReason: "EXAM1QA contributor archived before primary correction."
    }, principalActor);
    await archiveTeacherExamAssignment(client, examination.id, concurrentPrimary.id, {
      expectedExaminationVersion: await currentExaminationVersion(client, examination.id),
      expectedVersion: concurrentPrimary.version,
      archiveReason: "EXAM1QA primary archived after contributor removal."
    }, principalActor);

    const proposal = await recordTeacherSchemeProposal(client, examination.id, {
      subjectPaperId: mathPaperA.id,
      proposalReason: "EXAM1QA assigned-subject non-activating proposal.",
      calculationMode: "RAW_SUM",
      components: [
        { componentCode: "PROPOSED", name: "Proposed Component", componentKind: "WRITTEN", displayOrder: 1, maximumMarks: 50, isRequired: true }
      ]
    }, teacherAActor);
    if (proposal.activationAuthority !== "PRINCIPAL_ONLY" || proposal.status !== "PROPOSED") {
      throw new Error("EXAM1QA_TEACHER_PROPOSAL_AUTHORITY_INVALID");
    }
    await expectDomainError(
      "EXAM1QA_TEACHER_PROPOSAL_TAMPERING",
      () => recordTeacherSchemeProposal(client, examination.id, {
        subjectPaperId: sciencePaperA.id,
        proposalReason: "EXAM1QA unassigned-subject proposal refusal.",
        calculationMode: "RAW_SUM",
        components: [
          { componentCode: "PROPOSED", name: "Proposed Component", componentKind: "WRITTEN", displayOrder: 1, maximumMarks: 50, isRequired: true }
        ]
      }, teacherAActor),
      /outside your exact active examination assignment/i,
      404
    );

    await createExaminationConfiguration(client, {
      examCode: "EXAM1QA-BAD",
      academicYear: "2027-28",
      name: "EXAM1QA Invalid Activation Matrix",
      examType: "TERM",
      startDate: "2027-09-01",
      endDate: "2027-09-02",
      classSectionIds: [nextYearSection.id]
    }, principalActor);
    const incomplete = await client.examination.findUniqueOrThrow({
      where: { examCode: "EXAM1QA_BAD" },
      include: { classScopes: true }
    });
    const incompleteScope = incomplete.classScopes[0];
    const incompletePaper = await createSubjectPaper(client, incomplete.id, await governedInput(client, incomplete.id, {
      classScopeId: incompleteScope.id,
      timetableSubjectId: mathematics.id,
      paperCode: "MATH",
      paperName: "Mathematics",
      displayOrder: 1
    }), principalActor);
    const incompleteScheme = await createSchemeVersion(client, incomplete.id, await governedInput(client, incomplete.id, {
      classScopeId: incompleteScope.id,
      subjectPaperId: incompletePaper.id,
      calculationMode: "RAW_SUM",
      components: [
        { componentCode: "WRITTEN", name: "Written", componentKind: "WRITTEN", displayOrder: 1, maximumMarks: 50, isRequired: true }
      ]
    }), principalActor);
    await expectDomainError(
      "EXAM1QA_INVALID_ACTIVATION",
      async () => activateSchemeVersion(client, incomplete.id, {
        expectedExaminationVersion: await currentExaminationVersion(client, incomplete.id),
        schemeVersionId: incompleteScheme.id,
        expectedVersion: incompleteScheme.version,
        activationReason: "EXAM1QA incomplete activation refusal."
      }, principalActor),
      /grade-scale version/i
    );
    const incompleteVersion = await currentExaminationVersion(client, incomplete.id);
    await archiveExaminationConfiguration(client, incomplete.id, {
      expectedVersion: incompleteVersion,
      archiveReason: "EXAM1QA invalid fixture archived without deletion."
    }, principalActor);
    if (
      !(await client.examination.findUnique({ where: { id: incomplete.id } })) ||
      !(await client.examinationSchemeVersion.findUnique({ where: { id: incompleteScheme.id } }))
    ) {
      throw new Error("EXAM1QA_ARCHIVE_DELETED_HISTORY");
    }

    const [teacherAAssignments, teacherBAssignments, liveExamination] = await Promise.all([
      listTeacherExamAssignments(client, teacherAActor),
      listTeacherExamAssignments(client, actor(teacherBUser)),
      client.examination.findUniqueOrThrow({
        where: { id: examination.id },
        include: {
          schemeVersions: { include: { components: true } },
          subjectPapers: true,
          subjectGroups: { include: { members: true } },
          gradeScaleVersions: { include: { bands: true } },
          coScholasticSchemeVersions: { include: { items: true } },
          templateBindings: true,
          teacherAssignments: true,
          schemeAudits: true
        }
      })
    ]);
    if (
      liveExamination.status !== "ACTIVE" ||
      liveExamination.schemeVersions.filter((row) => row.status === "ACTIVE").length !== 3 ||
      liveExamination.schemeVersions.filter((row) => row.frozenAt).length !== 3 ||
      liveExamination.subjectPapers.length !== 4 ||
      liveExamination.subjectGroups.length !== 2 ||
      liveExamination.teacherAssignments.filter((row) => row.status === "ACTIVE").length !== 12 ||
      liveExamination.teacherAssignments.filter((row) => row.status === "ARCHIVED").length !== 2 ||
      !teacherAAssignments.length ||
      !teacherBAssignments.length ||
      !liveExamination.schemeAudits.some((audit) => audit.eventType === "TEACHER_SCHEME_PROPOSAL_RECORDED") ||
      !liveExamination.schemeAudits.some((audit) => audit.eventType === "SCHEME_VERSION_ACTIVATED_AND_FROZEN" && audit.actorRole === "PRINCIPAL")
    ) {
      throw new Error("EXAM1QA_CONFIGURATION_MATRIX_INVALID");
    }
    if (liveExamination.teacherAssignments.some((row) => row.staffMemberId === staffA.id && row.subjectPaperId === sciencePaperA.id)) {
      throw new Error("EXAM1QA_PERMISSION_GRANTED_UNASSIGNED_SCOPE");
    }

    return {
      examinationId: examination.id,
      audits: liveExamination.schemeAudits.length,
      teacherAAssignments: teacherAAssignments.length,
      teacherBAssignments: teacherBAssignments.length,
      activeSchemes: liveExamination.schemeVersions.filter((row) => row.status === "ACTIVE").length
    };
  } finally {
    await client.$disconnect();
  }
}

async function prepare() {
  if (existsSync(STATE_PATH)) {
    const previous = readState();
    cleanupIsolatedDatabase(previous.databasePath);
    removeState();
  }
  const sourceHash = fileSha256(OPERATIONAL_DATABASE);
  const databasePath = createEmptyIsolatedDatabase("operational-copy", "EXAM1QA-independent");
  try {
    copyFileSync(OPERATIONAL_DATABASE, databasePath);
    if (fileSha256(databasePath) !== sourceHash) throw new Error("EXAM1QA_COPY_HASH_MISMATCH");
    runPrisma(["migrate", "deploy", "--schema", "prisma/schema.prisma"], databasePath);
    runPrisma(["migrate", "deploy", "--schema", "prisma/schema.prisma"], databasePath);
    const status = runPrisma(["migrate", "status", "--schema", "prisma/schema.prisma"], databasePath);
    if (!/database schema is up to date/i.test(status.combined)) throw new Error("EXAM1QA_MIGRATION_STATUS_NOT_CLEAN");
    const matrix = await createFixture(databasePath);
    const state: QaState = {
      databasePath,
      sourceHash,
      examinationId: matrix.examinationId,
      principalUsername: PRINCIPAL_USERNAME,
      principalPassword: PRINCIPAL_PASSWORD,
      teacherUsername: TEACHER_USERNAME,
      teacherPassword: TEACHER_PASSWORD
    };
    writeFileSync(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    if (fileSha256(OPERATIONAL_DATABASE) !== sourceHash) throw new Error("OPERATIONAL_DATABASE_CHANGED_DURING_EXAM1QA_PREPARE");
    console.log(
      `EXAM1QA matrix passed: activeSchemes=${matrix.activeSchemes} audits=${matrix.audits} ` +
      `teacherA=${matrix.teacherAAssignments} teacherB=${matrix.teacherBAssignments}.`
    );
    console.log("EXAM1QA Browser credentials are stored only in the ignored private QA state file.");
  } catch (error) {
    cleanupIsolatedDatabase(databasePath);
    removeState();
    throw error;
  }
}

async function inspect() {
  const state = readState();
  const client = new PrismaClient({ datasourceUrl: databaseUrl(state.databasePath) });
  try {
    const [baseline, students, enrollments, payments, guardians, staff, examination, migrations] = await Promise.all([
      businessBaseline(state.databasePath),
      client.student.count({ where: { deletedAt: null } }),
      client.academicYearEnrollment.count({ where: { status: "ACTIVE" } }),
      client.payment.count({ where: { deletedAt: null } }),
      client.guardian.count(),
      client.staffMember.count(),
      client.examination.findUniqueOrThrow({
        where: { id: state.examinationId },
        include: { schemeVersions: true, teacherAssignments: true, schemeAudits: true }
      }),
      client.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) AS count
        FROM _prisma_migrations
        WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
      `
    ]);
    if (
      baseline.students !== 0 ||
      baseline.activeEnrollments !== 0 ||
      baseline.payments !== 0 ||
      baseline.collected !== 0 ||
      students !== 0 ||
      enrollments !== 0 ||
      payments !== 0 ||
      guardians !== 0 ||
      staff !== 2
    ) {
      throw new Error("EXAM1QA_BUSINESS_BASELINE_CHANGED");
    }
    if (
      examination.status !== "ACTIVE" ||
      examination.schemeVersions.filter((row) => row.status === "ACTIVE").length !== 3 ||
      examination.teacherAssignments.filter((row) => row.status === "ACTIVE").length !== 12 ||
      examination.teacherAssignments.filter((row) => row.status === "ARCHIVED").length !== 2 ||
      examination.schemeAudits.length < 30 ||
      migrations[0]?.count !== 2n
    ) {
      throw new Error("EXAM1QA_INSPECTION_INVARIANTS_FAILED");
    }
    if (fileSha256(OPERATIONAL_DATABASE) !== state.sourceHash) {
      throw new Error("OPERATIONAL_DATABASE_CHANGED_DURING_EXAM1QA_INSPECTION");
    }
    console.log("EXAM1QA copied-database inspection passed with exact configuration, assignment, audit, and migration invariants.");
    console.log("Operational baseline remains byte-identical and zero-business-data.");
  } finally {
    await client.$disconnect();
  }
}

async function cleanup() {
  if (!existsSync(STATE_PATH)) {
    console.log("EXAM1QA cleanup already complete.");
    return;
  }
  const state = readState();
  if (fileSha256(OPERATIONAL_DATABASE) !== state.sourceHash) {
    throw new Error("OPERATIONAL_DATABASE_CHANGED_BEFORE_EXAM1QA_CLEANUP");
  }
  cleanupIsolatedDatabase(state.databasePath);
  removeState();
  console.log("EXAM1QA copied database and private Browser state removed.");
}

const action = process.argv.slice(2).find((value) => value !== "--") ?? "inspect";
const runner = action === "prepare" ? prepare : action === "inspect" ? inspect : action === "cleanup" ? cleanup : null;
if (!runner) {
  console.error("Usage: pnpm.cmd qa:exam1qa -- prepare|inspect|cleanup");
  process.exitCode = 1;
} else {
  runner().catch((error) => {
    console.error(error instanceof Error ? error.message : "EXAM1QA failed");
    process.exitCode = 1;
  });
}
