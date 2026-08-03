import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { ensureDefaultRolePermissions } from "../lib/role-permissions";
import { hashPassword } from "../lib/password";
import type { PublishedReportSnapshot } from "../lib/report-publication-types";
import type { Role } from "../lib/permissions";
import { DEFAULT_MARK_TEMPLATE } from "../lib/report-card-templates";

export const REPORT23G_YEAR = "2026-27";
export const REPORT23G_CLASS = "IX";

type UserFixture = { user: any; assignment: any };

export async function seedReport23GFixtures(client: PrismaClient, options: { suite: string; browserPassword?: string }) {
  const prefix = `${options.suite}-${randomBytes(4).toString("hex")}`.toUpperCase();
  await ensureDefaultRolePermissions(client);
  const makeUser = async (slug: string, role: Role, guardianId?: string): Promise<UserFixture> => {
    const passwordHash = options.browserPassword ? await hashPassword(options.browserPassword) : `${options.suite}-NO-LOGIN`;
    const username = `${options.suite.toLowerCase()}-${slug}`;
    const user = await client.user.create({ data: {
      iamPublicKey: randomUUID(), name: `${prefix} ${slug}`, username, passwordHash, role,
      designation: role === "PRINCIPAL" ? "Principal" : role === "DIRECTOR" ? "Director" : role === "TEACHER" ? "Teacher" : role,
      guardianId: guardianId ?? null,
      authLoginAliases: { create: { type: "USERNAME", normalizedValue: username, displayMasked: username, status: "VERIFIED", isSchoolGoverned: true, verifiedAt: new Date() } }
    } });
    const assignment = await client.userRoleAssignment.create({ data: { publicKey: randomUUID(), userId: user.id, role, reason: `${options.suite} copied-database fixture`, assignedByUserId: user.id, activeKey: `${user.id}:${role}` } });
    return { user, assignment };
  };

  const guardian = await client.guardian.create({ data: { iamPublicKey: randomUUID(), displayName: `${prefix} Guardian`, primaryMobile: "9000237001" } });
  const [principal, director, teacher, parent, viewer, accountant, studentUser] = await Promise.all([
    makeUser("principal", "PRINCIPAL"), makeUser("director", "DIRECTOR"), makeUser("teacher", "TEACHER"),
    makeUser("parent", "PARENT", guardian.id), makeUser("viewer", "VIEWER"), makeUser("accountant", "ACCOUNTANT"), makeUser("student", "STUDENT")
  ]);

  const sections = [`${prefix.slice(-8)}A`, `${prefix.slice(-8)}B`];
  const classSections = await Promise.all(sections.map((section) => client.timetableClassSection.create({ data: {
    academicYear: REPORT23G_YEAR, className: REPORT23G_CLASS, section,
    displayName: `${REPORT23G_CLASS}-${section}`, groupName: prefix, isActive: true
  } })));
  const [math, science] = await Promise.all([
    client.timetableSubject.create({ data: { name: "Mathematics", shortName: `${prefix}-MAT`, department: prefix, isActive: true } }),
    client.timetableSubject.create({ data: { name: "Science", shortName: `${prefix}-SCI`, department: prefix, isActive: true } })
  ]);
  const timetableTeacher = await client.timetableTeacher.create({ data: { name: teacher.user.name, shortName: `${prefix}-T`, isActive: true, maxPeriodsPerWeek: 30 } });
  const staff = await client.staffMember.create({ data: { iamPublicKey: randomUUID(), staffCode: `${prefix}-STAFF`, fullName: teacher.user.name, designation: "Teacher", status: "ACTIVE", userId: teacher.user.id, timetableTeacherId: timetableTeacher.id } });
  const timetableAssignment = await client.timetableAssignment.create({ data: { academicYear: REPORT23G_YEAR, classSectionId: classSections[0].id, subjectId: math.id, teacherId: timetableTeacher.id, periodsPerWeek: 5 } });

  const students: any[] = [];
  for (const [sectionIndex, count] of [6, 2].entries()) {
    const section = sections[sectionIndex];
    for (let index = 0; index < count; index++) {
      const student = await client.student.create({ data: {
        admissionNo: `${prefix}-${section}-${String(index + 1).padStart(2, "0")}`,
        studentName: `${prefix} Student ${section}${index + 1}`, fatherName: "Synthetic",
        className: REPORT23G_CLASS, section, rollNo: String(index + 1), phone1: "0000000000"
      } });
      await client.academicYearEnrollment.create({ data: { studentId: student.id, academicYear: REPORT23G_YEAR, className: REPORT23G_CLASS, section, rollNo: String(index + 1), status: "ACTIVE" } });
      students.push(student);
    }
  }
  await client.studentGuardian.create({ data: { guardianId: guardian.id, studentId: students[0].id, isPrimaryContact: true } });
  await client.authLoginAlias.create({ data: { userId: studentUser.user.id, type: "ADMISSION_NUMBER", normalizedValue: students[0].admissionNo.toLowerCase(), displayMasked: "***-A-01", status: "VERIFIED", isSchoolGoverned: true, admissionStudentId: students[0].id, verifiedAt: new Date() } });

  const template = await client.reportCardTemplate.create({ data: {
    templateCode: `${prefix}-REPORT`, name: `${prefix} governed report`, reportType: "MARK_BASED", academicYear: REPORT23G_YEAR,
    className: REPORT23G_CLASS, status: "ACTIVE", templateDefinitionJson: JSON.stringify(DEFAULT_MARK_TEMPLATE), printSettingsJson: "{}", createdByUserId: principal.user.id
  } });
  const examSpecifications = [
    { code: `${prefix}-REV`, name: "Class IX Revision", maximum: 100, mode: "RAW_SUM", formula: "EXAM_RESULT_V1", start: "2026-06-01", end: "2026-06-05" },
    { code: `${prefix}-PRE`, name: "Class IX Preboard", maximum: 80, mode: "RAW_SUM", formula: "EXAM_RESULT_V1", start: "2026-07-01", end: "2026-07-05" },
    { code: `${prefix}-WGT`, name: "Class IX Weighted Review", maximum: 100, mode: "WEIGHTED_NORMALIZED", formula: "EXAM_RESULT_WEIGHTED_V1", start: "2026-07-15", end: "2026-07-20" }
  ] as const;
  const resultSnapshots: any[] = [], reportCardVersions: any[] = [];
  for (const [examIndex, specification] of examSpecifications.entries()) {
    const examination = await client.examination.create({ data: { examCode: specification.code, academicYear: REPORT23G_YEAR, name: specification.name, examType: examIndex === 0 ? "REVISION" : "PREBOARD", startDate: new Date(specification.start), endDate: new Date(specification.end), status: "ACTIVE", version: 1, createdByUserId: principal.user.id, activatedByUserId: principal.user.id, activatedAt: new Date(specification.start) } });
    for (const [sectionIndex, classSection] of classSections.entries()) {
      const section = sections[sectionIndex];
      const scope = await client.examinationClassScope.create({ data: { examinationId: examination.id, academicYear: REPORT23G_YEAR, className: REPORT23G_CLASS, section, timetableClassSectionId: classSection.id, status: "ACTIVE", createdByUserId: principal.user.id } });
      const paper = await client.examSubjectPaper.create({ data: { examinationId: examination.id, classScopeId: scope.id, academicYear: REPORT23G_YEAR, className: REPORT23G_CLASS, section, timetableSubjectId: math.id, subjectNameSnapshot: math.name, paperCode: "MAT", paperName: "Mathematics", displayOrder: 1, status: "ACTIVE", createdByUserId: principal.user.id } });
      const scheme = await client.examinationSchemeVersion.create({ data: { examinationId: examination.id, classScopeId: scope.id, academicYear: REPORT23G_YEAR, className: REPORT23G_CLASS, section, scopeKey: "MAT", subjectPaperId: paper.id, versionNumber: 1, calculationMode: specification.mode, roundingPolicyVersion: "RC05_V1_DECIMAL6_HALF_UP2", markDecimalPlaces: 2, status: "ACTIVE", frozenAt: new Date(specification.start), createdByUserId: principal.user.id, activatedByUserId: principal.user.id, activatedAt: new Date(specification.start) } });
      const component = await client.examinationComponent.create({ data: { schemeVersionId: scheme.id, componentCode: "TOTAL", name: "Published total", componentKind: "WRITTEN", displayOrder: 1, maximumMarks: specification.maximum, contributionWeight: specification.mode === "WEIGHTED_NORMALIZED" ? 100 : null } });
      if (section === sections[0]) await client.teacherExamAssignment.create({ data: { examinationId: examination.id, classScopeId: scope.id, timetableClassSectionId: classSection.id, subjectPaperId: paper.id, schemeVersionId: scheme.id, componentId: component.id, academicYear: REPORT23G_YEAR, className: REPORT23G_CLASS, section, staffMemberId: staff.id, timetableTeacherId: timetableTeacher.id, timetableAssignmentId: timetableAssignment.id, assignmentRole: "PRIMARY_SUBMITTER", status: "ACTIVE", assignmentReason: `${options.suite} exact scope`, assignedByUserId: principal.user.id } });
      const templateSnapshot = { reportType: "MARK_BASED", definition: DEFAULT_MARK_TEMPLATE, gradingScheme: { bands: [] }, publicationSchemaVersion: 3, publication: { previewFingerprint: sha(`${prefix}|${specification.code}|${section}`), templateFamily: "SECONDARY_10_40_GROUPED" } };
      const batch = await client.reportCardBatch.create({ data: { batchNumber: `${prefix}-${examIndex}-${section}`, academicYear: REPORT23G_YEAR, reportType: "MARK_BASED", templateId: template.id, className: REPORT23G_CLASS, section, title: specification.name, reportingPeriod: `${specification.start} to ${specification.end}`, status: "ISSUED", templateSnapshotJson: JSON.stringify(templateSnapshot), createdByUserId: principal.user.id, issuedByUserId: principal.user.id, issuedAt: new Date(`${specification.end}T12:00:00Z`) } });
      const sectionStudents = students.filter((student) => student.section === section);
      for (const [studentIndex, student] of sectionStudents.entries()) {
        const state = (["PRESENT", "ABSENT", "EXEMPT", "NOT_APPLICABLE", "NOT_ENTERED", "PRESENT"] as const)[studentIndex] ?? "PRESENT";
        const percentage = studentIndex === 0 ? examIndex * 10 : studentIndex === 5 ? 75 : Math.max(0, 72 - studentIndex * 7 + examIndex * 3);
        const obtained = Number((percentage * specification.maximum / 100).toFixed(2));
        const calculatedAt = new Date(`${specification.end}T09:00:00Z`), lockedAt = new Date(`${specification.end}T10:00:00Z`);
        const calculationRunId = `${prefix}-${specification.code}-${section}`;
        const snapshot = await client.studentResultSnapshot.create({ data: { calculationRunId, inputFingerprint: sha(`${calculationRunId}|${student.id}`), runNumber: 1, runStatus: "LOCKED", examinationId: examination.id, classScopeId: scope.id, studentId: student.id, schemeVersionId: scheme.id, snapshotVersion: 1, totalObtained: obtained, totalMaximum: specification.maximum, percentage, gradeCode: percentage >= 75 ? "A" : percentage >= 40 ? "B" : "D", passResult: percentage >= 40 ? "PASS" : "FAIL", rankValue: studentIndex === 1 || studentIndex === 2 ? 2 : studentIndex + 1, formulaVersion: specification.formula, roundingPolicyVersion: "RC05_V1_DECIMAL6_HALF_UP2", warningsJson: "[]", sourceSheetVersionsJson: "[]", sourceSchemeVersionsJson: JSON.stringify([scheme.id]), snapshotJson: JSON.stringify({ source: "LOCKED_REPORT23G_FIXTURE", state }), calculatedByUserId: principal.user.id, calculatedAt, lockedByUserId: principal.user.id, lockedAt } });
        const card = await client.studentReportCard.create({ data: { reportCardNumber: `${prefix}-${examIndex}-${section}-${studentIndex + 1}`, batchId: batch.id, studentId: student.id, academicYear: REPORT23G_YEAR, className: REPORT23G_CLASS, section, reportType: "MARK_BASED", status: "ISSUED", currentVersionNumber: 1, draftDataJson: JSON.stringify({ publicationSchemaVersion: 3, previewFingerprint: sha(snapshot.id) }), finalGrade: percentage >= 75 ? "A" : percentage >= 40 ? "B" : "D", createdByUserId: principal.user.id, issuedByUserId: principal.user.id, issuedAt: new Date(`${specification.end}T12:00:00Z`) } });
        const published = publishedSnapshot({ prefix, examination, specification, student, snapshot, scheme, state, obtained, percentage, maximum: specification.maximum, reportCardNumber: card.reportCardNumber, scienceName: science.name });
        const version = await client.studentReportCardVersion.create({ data: { reportCardId: card.id, versionNumber: 1, versionType: "ORIGINAL", snapshotJson: JSON.stringify(published), calendarBasisVersionKey: `${prefix}-ATTENDANCE-V1`, calendarBasisSnapshotJson: JSON.stringify({ locked: true }), issuedAt: new Date(`${specification.end}T12:00:00Z`), issuedByUserId: principal.user.id } });
        resultSnapshots.push(snapshot); reportCardVersions.push(version);
      }
    }
  }
  return { prefix, sections, students, resultSnapshots, reportCardVersions, users: { principal, director, teacher, parent, viewer, accountant, student: studentUser }, examCodes: examSpecifications.map((row) => row.code) };
}

function publishedSnapshot(input: any): PublishedReportSnapshot {
  const componentObtained = input.state === "PRESENT" ? input.obtained.toFixed(2) : null;
  return {
    schemaVersion: 3, status: "ISSUED", reportType: "MARK_BASED", templateFamily: "SECONDARY_10_40_GROUPED",
    publicationReference: `${input.prefix}-PUB-${sha(input.snapshot.id).slice(0, 12).toUpperCase()}`, reportCardNumber: input.reportCardNumber, versionNumber: 1,
    issueDate: `${input.specification.end}T12:00:00.000Z`, title: input.examination.name, reportingPeriod: `${input.specification.start} to ${input.specification.end}`, academicYear: REPORT23G_YEAR,
    school: { name: "Nalanda Public School", address: "Synthetic copied-database fixture", city: "Hyderabad", phone: null, logoPath: null },
    student: { name: input.student.studentName, admissionNumber: input.student.admissionNo, rollNumber: input.student.rollNo, className: REPORT23G_CLASS, section: input.student.section, dateOfBirth: null },
    examination: { code: input.examination.examCode, name: input.examination.name, periodStart: input.specification.start, periodEnd: input.specification.end },
    content: {
      papers: [{ code: "MAT", subjectName: "Mathematics", paperName: "Mathematics", calculationMode: input.specification.mode, components: [{ code: "TOTAL", name: "Published total", state: input.state, obtained: componentObtained, maximum: input.maximum.toFixed(2), contributionWeight: input.specification.mode === "WEIGHTED_NORMALIZED" ? "100.00" : null, contribution: componentObtained }], obtained: input.obtained.toFixed(2), maximum: input.maximum.toFixed(2), percentage: input.percentage.toFixed(2), excluded: false }],
      groups: [{ code: "STEM", label: "STEM group", paperCodes: ["MAT"], obtained: input.obtained.toFixed(2), maximum: input.maximum.toFixed(2), percentage: input.percentage.toFixed(2) }],
      totalObtained: input.obtained.toFixed(2), totalMaximum: input.maximum.toFixed(2), percentage: input.percentage.toFixed(2), grade: { code: input.percentage >= 75 ? "A" : input.percentage >= 40 ? "B" : "D", label: "Published grade", point: null }, passResult: input.percentage >= 40 ? "PASS" : "FAIL", rank: null, cohortAverage: null, cohortHighest: null,
      attendance: { policy: "LOCKED_EXAMINATION_DATE_RANGE_ONLY", periodStart: input.specification.start, periodEnd: input.specification.end, totalLockedDays: 5, recordedDays: 5, presentEquivalentDays: input.state === "ABSENT" ? 4 : 5 },
      skills: [], personality: [], developmentalSections: [], combinedResults: [{ label: "Configured combined result", obtained: input.obtained.toFixed(2), maximum: input.maximum.toFixed(2), percentage: input.percentage.toFixed(2), configuredWeight: "100.00" }], remarks: { classTeacher: null, principal: null, general: null }, legends: [{ code: input.state, label: input.state.replaceAll("_", " ") }], warnings: []
    },
    signatures: [{ role: "PRINCIPAL", label: "Principal" }], template: { code: `${input.prefix}-REPORT`, name: "Governed Class IX report", version: 1, bindingVersion: 1, definition: {}, printSettings: { orientation: "PORTRAIT", pageSize: "A4", minimumFontSizePt: 10, marginMm: 12 } },
    governance: { calculationRunReference: `${input.prefix}-RUN-${sha(input.snapshot.calculationRunId).slice(0, 12).toUpperCase()}`, resultSnapshotVersion: 1, formulaVersion: input.snapshot.formulaVersion, roundingPolicyVersion: input.snapshot.roundingPolicyVersion, sourceLockedAt: input.snapshot.lockedAt.toISOString(), templateFrozenAt: `${input.specification.start}T00:00:00.000Z`, previewFingerprint: sha(input.snapshot.id), publishedByLabel: "Principal", internal: { resultSnapshotId: input.snapshot.id, calculationRunId: input.snapshot.calculationRunId, templateBindingId: `${input.prefix}-BINDING` } }
  };
}

function sha(value: string) { return createHash("sha256").update(value).digest("hex"); }
