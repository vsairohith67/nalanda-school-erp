import { createHash, randomBytes, randomUUID } from "node:crypto";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/password";
import { DEFAULT_MARK_TEMPLATE } from "../lib/report-card-templates";
import { SYNTHETIC_PILOT_DATASET_PLAN, SYNTHETIC_PILOT_ID } from "../lib/synthetic-pilot-readiness";

const workspace = path.resolve(".");
const root = path.resolve(workspace, "tmp", "synthetic-pilot-readiness-1a");
const databasePath = path.join(root, "synthetic-pilot.db");
const credentialsPath = path.join(root, "browser-credentials.json");
const manifestPath = path.join(root, "fixture-manifest.json");
const privateMediaRoot = path.join(root, "private-media");
const privateMediaStorageKey = "original/12/34/12345678-1234-4234-8234-123456789abc.png";
const privateMediaPath = path.join(privateMediaRoot, ...privateMediaStorageKey.split("/"));
const databaseUrl = `file:${databasePath.replaceAll("\\", "/")}`;
const generatedAt = new Date("2026-08-28T03:30:00.000Z");

function invariant(value: unknown, code: string): asserts value {
  if (!value) throw new Error(code);
}

function checkedRoot() {
  const parent = path.resolve(workspace, "tmp");
  invariant(root.startsWith(`${parent}${path.sep}`) && root.endsWith(`${path.sep}synthetic-pilot-readiness-1a`), "SYNTHETIC_PILOT_FIXTURE_SCOPE_REFUSED");
  return root;
}

function canonical(candidate: string) {
  const resolved = path.resolve(candidate);
  return existsSync(resolved) ? realpathSync.native(resolved) : resolved;
}

function sameFile(left: string, right: string) {
  if (!existsSync(left) || !existsSync(right)) return false;
  const a = statSync(left, { bigint: true });
  const b = statSync(right, { bigint: true });
  return a.dev === b.dev && a.ino === b.ino;
}

function syntheticPassword(label: string) {
  return ["SYNPILOT", label, randomBytes(12).toString("hex")].join("-") + "!";
}

function assertIsolatedTarget() {
  invariant(process.env.SYNTHETIC_PILOT_OPT_IN === "true", "SYNTHETIC_PILOT_OPT_IN_REQUIRED");
  invariant(process.env.NALANDA_ENVIRONMENT === "TEST" && process.env.NODE_ENV !== "production", "SYNTHETIC_PILOT_ENVIRONMENT_REFUSED");
  invariant(!/[\\/]prisma[\\/]dev\.db$/i.test(canonical(databasePath)), "SYNTHETIC_PILOT_OPERATIONAL_NAME_REFUSED");
  const operational = process.env.NALANDA_OPERATIONAL_DATABASE_PATH;
  if (operational) invariant(canonical(databasePath).toLowerCase() !== canonical(operational).toLowerCase() && !sameFile(databasePath, operational), "SYNTHETIC_PILOT_OPERATIONAL_DATABASE_REFUSED");
}

function cleanup() {
  const target = checkedRoot();
  if (existsSync(target)) rmSync(target, { recursive: true, force: true });
}

function run(command: string, args: string[], environment: NodeJS.ProcessEnv) {
  const result = spawnSync(command, args, { cwd: workspace, env: environment, encoding: "utf8", windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error(`SYNTHETIC_PILOT_COMMAND_FAILED:${command}:${args.join(" ")}:${result.error?.message ?? `${result.stdout}\n${result.stderr}`}`);
}

async function createMany(delegate: { createMany(input: any): Promise<unknown> }, rows: unknown[]) {
  for (let offset = 0; offset < rows.length; offset += 200) await delegate.createMany({ data: rows.slice(offset, offset + 200) });
}

async function seed() {
  assertIsolatedTarget();
  cleanup();
  mkdirSync(path.dirname(privateMediaPath), { recursive: true });
  closeSync(openSync(databasePath, "wx"));
  const environment: NodeJS.ProcessEnv = { ...process.env, DATABASE_URL: databaseUrl, NODE_ENV: "development", NALANDA_ENVIRONMENT: "TEST" };
  run(process.execPath, [path.join(workspace, "node_modules", "prisma", "build", "index.js"), "migrate", "deploy", "--schema", "prisma/schema.prisma"], environment);

  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  const roles = ["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL", "ADMIN", "ACCOUNTANT", "COMPUTER_OPERATOR", "GATE_STAFF", "TEACHER", "PARENT", "STUDENT", "VIEWER"] as const;
  const credentials: Array<{ username: string; password: string; role: string }> = [];
  const users: Record<string, string> = {};
  try {
    await prisma.schoolSettings.create({ data: { id: "school", schoolName: "NALANDA SYNTHETIC PILOT SCHOOL - NO REAL DATA", academicYear: "2026-27", phone: "0000000000", addressLine1: "Synthetic campus only", city: "Test City" } });
    for (const role of roles) {
      const username = `synpilot-${role.toLowerCase().replaceAll("_", "-")}`;
      const password = syntheticPassword(role);
      const id = `synpilot-user-${role.toLowerCase()}`;
      const active = true;
      await prisma.user.create({ data: { id, iamPublicKey: randomUUID(), name: `Synthetic ${role.replaceAll("_", " ")}`, username, email: `${username}@example.test`, passwordHash: await hashPassword(password), role, isActive: active, lifecycleStatus: "ACTIVE", mustChangePassword: false } });
      await prisma.authLoginAlias.create({ data: { id: `synpilot-alias-${role.toLowerCase()}`, userId: id, type: "USERNAME", normalizedValue: username, displayMasked: username, status: "VERIFIED", isSchoolGoverned: true, verifiedAt: generatedAt } });
      await prisma.userRoleAssignment.create({ data: { publicKey: randomUUID(), userId: id, role, reason: `${SYNTHETIC_PILOT_ID} isolated persona`, activeKey: `${id}:${role}`, status: "ACTIVE" } });
      users[role] = id;
      credentials.push({ username, password, role });
    }
    const deniedPassword = syntheticPassword("DENIED");
    await prisma.user.create({ data: { id: "synpilot-user-denied", iamPublicKey: randomUUID(), name: "Synthetic Disabled User", username: "synpilot-denied", email: "synpilot-denied@example.test", passwordHash: await hashPassword(deniedPassword), role: "VIEWER", isActive: false, lifecycleStatus: "SUSPENDED", mustChangePassword: false } });
    await prisma.authLoginAlias.create({ data: { id: "synpilot-alias-denied", userId: "synpilot-user-denied", type: "USERNAME", normalizedValue: "synpilot-denied", displayMasked: "synpilot-denied", status: "VERIFIED", isSchoolGoverned: true, verifiedAt: generatedAt } });
    await prisma.userRoleAssignment.create({ data: { publicKey: randomUUID(), userId: "synpilot-user-denied", role: "VIEWER", reason: `${SYNTHETIC_PILOT_ID} denied-user boundary`, status: "ENDED", endedAt: generatedAt } });
    credentials.push({ username: "synpilot-denied", password: deniedPassword, role: "DENIED_DISABLED_USER" });

    const guardians = Array.from({ length: 1_200 }, (_, index) => ({
      id: `synpilot-guardian-${String(index).padStart(4, "0")}`,
      iamPublicKey: randomUUID(),
      displayName: `Synthetic Guardian ${String(index).padStart(4, "0")}`,
      primaryMobile: `0001${String(index).padStart(6, "0")}`,
      email: `guardian-${String(index).padStart(4, "0")}@example.test`,
      relationship: index % 7 === 0 ? "Grandparent" : index % 5 === 0 ? "Guardian" : "Parent",
      status: index >= 1_190 ? "Inactive" : "Active",
      createdAt: generatedAt,
      updatedAt: generatedAt
    }));
    const classNames = SYNTHETIC_PILOT_DATASET_PLAN.classes;
    const students = Array.from({ length: 800 }, (_, index) => ({
      id: `synpilot-student-${String(index).padStart(4, "0")}`,
      academicYear: "2026-27",
      admissionNo: `SYNP${String(index).padStart(5, "0")}`,
      studentName: `Synthetic Student ${String(index).padStart(4, "0")}`,
      fatherName: `Synthetic Guardian Family ${String(Math.floor(index / 2)).padStart(4, "0")}`,
      className: classNames[index % classNames.length],
      section: SYNTHETIC_PILOT_DATASET_PLAN.sections[Math.floor(index / classNames.length) % 4],
      rollNo: String((index % 20) + 1),
      phone1: `0002${String(index).padStart(6, "0")}`,
      status: index >= 790 ? (index % 2 ? "TC" : "Left") : index >= 780 ? "Left" : "Active",
      studentType: index % 23 === 0 ? "Faculty Child" : "Normal",
      discountPercent: index % 23 === 0 ? 50 : index % 29 === 0 ? 10 : 0,
      remarks: "UNMISTAKABLY SYNTHETIC PILOT RECORD",
      createdAt: generatedAt,
      updatedAt: generatedAt
    }));
    await createMany(prisma.guardian, guardians);
    await createMany(prisma.student, students);
    const links = students.flatMap((student, index) => {
      const family = Math.floor(index / 2);
      return [
        { id: `synpilot-link-primary-${String(index).padStart(4, "0")}`, guardianId: guardians[family].id, studentId: student.id, relationshipToStudent: "Parent", isPrimaryContact: true, canViewFees: true, canReceiveReminders: true, createdAt: generatedAt, updatedAt: generatedAt },
        { id: `synpilot-link-secondary-${String(index).padStart(4, "0")}`, guardianId: guardians[600 + family].id, studentId: student.id, relationshipToStudent: "Guardian", isPrimaryContact: false, canViewFees: index % 11 !== 0, canReceiveReminders: true, createdAt: generatedAt, updatedAt: generatedAt }
      ];
    });
    await createMany(prisma.studentGuardian, links);
    await prisma.user.update({ where: { id: users.PARENT }, data: { guardianId: guardians[0].id } });

    const staff = Array.from({ length: 80 }, (_, index) => ({
      id: `synpilot-staff-${String(index).padStart(3, "0")}`,
      iamPublicKey: randomUUID(),
      staffCode: `SYNS${String(index).padStart(3, "0")}`,
      fullName: `Synthetic Staff ${String(index).padStart(3, "0")}`,
      staffType: index < 45 ? "TEACHING" : "NON_TEACHING",
      designation: index < 45 ? "Teacher" : index < 60 ? "Office Staff" : "Operations Staff",
      department: index < 45 ? "Academics" : "Operations",
      primarySubject: index < 45 ? ["English", "Mathematics", "Science", "Social Studies", "Hindi"][index % 5] : null,
      status: index >= 78 ? "INACTIVE" : "ACTIVE",
      userId: index === 0 ? users.TEACHER : index === 1 ? users.PRINCIPAL : index === 2 ? users.COMPUTER_OPERATOR : null,
      createdAt: generatedAt,
      updatedAt: generatedAt
    }));
    await createMany(prisma.staffMember, staff);
    const enrollments = students.flatMap((student, index) => [
      { id: `synpilot-enrol-current-${String(index).padStart(4, "0")}`, studentId: student.id, academicYear: "2026-27", className: student.className, section: student.section, rollNo: student.rollNo, status: student.status === "Active" ? "ACTIVE" : student.status === "TC" ? "TRANSFERRED_OUT" : "LEFT", enrollmentDate: new Date("2026-06-01T00:00:00.000Z") },
      ...(index < 200 ? [{ id: `synpilot-enrol-prior-${String(index).padStart(4, "0")}`, studentId: student.id, academicYear: "2025-26", className: index % 10 === 0 ? "I" : classNames[Math.max(0, classNames.indexOf(student.className) - 1)], section: student.section, rollNo: student.rollNo, status: "PROMOTED", enrollmentDate: new Date("2025-06-01T00:00:00.000Z"), exitDate: new Date("2026-04-15T00:00:00.000Z") }] : [])
    ]);
    await createMany(prisma.academicYearEnrollment, enrollments);
    await createMany(prisma.feeStructure, classNames.map((className, index) => ({ id: `synpilot-fee-${index}`, academicYear: "2026-27", className, termAmount: 12_000 + index * 500, term1Month: "June", term2Month: "August", term3Month: "November", term4Month: "January", active: true, createdAt: generatedAt, updatedAt: generatedAt })));

    const payments = students.flatMap((student, index) => index % 3 === 2 ? [] : Array.from({ length: index % 3 === 0 ? 2 : 1 }, (_, part) => ({
      id: `synpilot-payment-${String(index).padStart(4, "0")}-${part}`,
      date: generatedAt,
      receiptNo: `SYNR-${String(index).padStart(5, "0")}-${part}`,
      admissionNo: student.admissionNo,
      studentId: student.id,
      studentName: student.studentName,
      className: student.className,
      section: student.section,
      amountPaid: part === 0 ? 4_000 : 8_000,
      paymentMode: index % 4 === 0 ? "Cash" : "UPI",
      receivedAccount: index % 4 === 0 ? "Cash" : "NPS Current Account UPI",
      transactionRefNo: index % 4 === 0 ? null : `SYN-UPI-${String(index).padStart(5, "0")}-${part}`,
      feeType: "Current Year Fee",
      termHint: "Term 1",
      remarks: "Synthetic fee-day rehearsal",
      enteredBy: "Synthetic Accountant",
      createdAt: generatedAt,
      updatedAt: generatedAt
    })));
    await createMany(prisma.payment, payments);

    const studentSessions = classNames.flatMap((className) => SYNTHETIC_PILOT_DATASET_PLAN.sections.map((section) => ({
      id: `synpilot-attendance-${className}-${section}`,
      attendanceDate: generatedAt,
      className,
      section,
      academicYear: "2026-27",
      status: "LOCKED",
      takenByUserId: users.TEACHER,
      submittedByUserId: users.TEACHER,
      lockedByUserId: users.PRINCIPAL,
      submittedAt: generatedAt,
      lockedAt: generatedAt,
      notes: "Synthetic attendance day"
    })));
    await createMany(prisma.studentAttendanceSession, studentSessions);
    await createMany(prisma.studentAttendanceRecord, students.map((student, index) => ({ id: `synpilot-attendance-record-${String(index).padStart(4, "0")}`, sessionId: `synpilot-attendance-${student.className}-${student.section}`, studentId: student.id, admissionNo: student.admissionNo, status: index % 17 === 0 ? "LATE" : index % 13 === 0 ? "ABSENT" : "PRESENT", remarks: "Synthetic day record" })));
    await prisma.staffAttendanceSession.create({ data: { id: "synpilot-staff-attendance", attendanceDate: generatedAt, academicYear: "2026-27", status: "LOCKED", takenByUserId: users.PRINCIPAL, submittedByUserId: users.PRINCIPAL, lockedByUserId: users.DIRECTOR, submittedAt: generatedAt, lockedAt: generatedAt, notes: "Manual synthetic staff attendance; no biometric dependency" } });
    await createMany(prisma.staffAttendanceRecord, staff.map((member, index) => ({ id: `synpilot-staff-attendance-${String(index).padStart(3, "0")}`, sessionId: "synpilot-staff-attendance", staffMemberId: member.id, staffCode: member.staffCode, status: index % 19 === 0 ? "ABSENT" : index % 11 === 0 ? "LATE" : "PRESENT", checkInTime: index % 11 === 0 ? "09:12" : "08:45", checkOutTime: "16:30", lateMinutes: index % 11 === 0 ? 12 : 0, source: "MANUAL" })));

    const exam = await prisma.examCycle.create({ data: { id: "synpilot-exam", examCode: "SYNPILOT-TERM1", academicYear: "2026-27", name: "Synthetic Term I", examType: "TERM", startDate: generatedAt, endDate: new Date("2026-09-05T00:00:00.000Z"), status: "APPROVED", createdByUserId: users.PRINCIPAL, openedByUserId: users.PRINCIPAL, approvedByUserId: users.PRINCIPAL, openedAt: generatedAt, approvedAt: generatedAt } });
    const assessment = await prisma.examAssessment.create({ data: { id: "synpilot-assessment", examCycleId: exam.id, academicYear: "2026-27", className: "I", section: "A", subjectName: "Mathematics", componentName: "Theory", assessmentType: "THEORY", maxMarks: 100, passMarks: 35, entryStatus: "LOCKED", createdByUserId: users.PRINCIPAL, approvedByUserId: users.PRINCIPAL, lockedByUserId: users.PRINCIPAL, approvedAt: generatedAt, lockedAt: generatedAt } });
    const assessmentStudents = students.filter((student) => student.className === "I" && student.section === "A");
    await createMany(prisma.studentMark, assessmentStudents.map((student, index) => ({ id: `synpilot-mark-${String(index).padStart(3, "0")}`, assessmentId: assessment.id, studentId: student.id, academicYear: "2026-27", marksObtained: index % 17 === 0 ? null : 55 + index % 40, entryStatus: index % 17 === 0 ? "ABSENT" : "PRESENT", remarks: "Synthetic governed marks", enteredByUserId: users.PRINCIPAL, verifiedByUserId: users.PRINCIPAL, enteredAt: generatedAt, verifiedAt: generatedAt })));
    const template = await prisma.reportCardTemplate.create({ data: { id: "synpilot-report-template", templateCode: "SYNPILOT-I-X", name: "Synthetic Printer-Safe Report", reportType: "MARK_BASED", academicYear: "2026-27", className: "I", status: "ACTIVE", templateDefinitionJson: JSON.stringify(DEFAULT_MARK_TEMPLATE), printSettingsJson: "{\"pageSize\":\"A4\",\"mode\":\"BLACK_AND_WHITE\"}", createdByUserId: users.PRINCIPAL, activatedByUserId: users.PRINCIPAL } });
    const templateSnapshot = { reportType: "MARK_BASED", definition: DEFAULT_MARK_TEMPLATE, gradingScheme: { bands: [] }, publicationSchemaVersion: 3, publication: { previewFingerprint: createHash("sha256").update("synpilot-report-template-preview").digest("hex"), templateFamily: "SYNTHETIC_MARK_BASED" } };
    const batch = await prisma.reportCardBatch.create({ data: { id: "synpilot-report-batch", batchNumber: "SYNPILOT-RC-001", academicYear: "2026-27", reportType: "MARK_BASED", templateId: template.id, className: "I", section: "A", title: "Synthetic Term I Report", reportingPeriod: "Term I", status: "ISSUED", templateSnapshotJson: JSON.stringify(templateSnapshot), createdByUserId: users.PRINCIPAL, openedByUserId: users.PRINCIPAL, submittedByUserId: users.PRINCIPAL, approvedByUserId: users.PRINCIPAL, issuedByUserId: users.PRINCIPAL, openedAt: generatedAt, submittedAt: generatedAt, approvedAt: generatedAt, issuedAt: generatedAt } });
    const reportCards = assessmentStudents.map((student, index) => ({ id: `synpilot-report-${String(index).padStart(3, "0")}`, reportCardNumber: `SYNPILOT-RC-${String(index).padStart(4, "0")}`, batchId: batch.id, studentId: student.id, academicYear: "2026-27", className: "I", section: "A", reportType: "MARK_BASED", status: "ISSUED", currentVersionNumber: 1, draftDataJson: JSON.stringify({ publicationSchemaVersion: 3, previewFingerprint: createHash("sha256").update(`synpilot-report-preview-${index}`).digest("hex") }), teacherOverallComment: "Synthetic progress comment", principalComment: "Synthetic approved report", finalGrade: index % 5 === 0 ? "B" : "A", createdByUserId: users.PRINCIPAL, approvedByUserId: users.PRINCIPAL, issuedByUserId: users.PRINCIPAL, approvedAt: generatedAt, issuedAt: generatedAt }));
    await createMany(prisma.studentReportCard, reportCards);
    await createMany(prisma.studentReportCardVersion, reportCards.map((card, index) => ({ id: `synpilot-report-version-${String(index).padStart(3, "0")}`, reportCardId: card.id, versionNumber: 1, versionType: "ORIGINAL", snapshotJson: JSON.stringify({ status: "ISSUED", versionNumber: 1, reportType: card.reportType, reportCardNumber: card.reportCardNumber, synthetic: true }), issuedAt: generatedAt, issuedByUserId: users.PRINCIPAL })));
    await createMany(prisma.studentReportCardEvent, reportCards.map((card, index) => ({ id: `synpilot-report-event-${String(index).padStart(3, "0")}`, reportCardId: card.id, versionId: `synpilot-report-version-${String(index).padStart(3, "0")}`, eventType: "ISSUED", eventDate: generatedAt, newStatus: "ISSUED", recordedByUserId: users.PRINCIPAL, actorLabel: "Synthetic Principal" })));

    const subject = await prisma.timetableSubject.create({ data: { id: "synpilot-subject", name: "Synthetic Mathematics", shortName: "SYN-MATH", department: "Academics" } });
    const timetableTeacher = await prisma.timetableTeacher.create({ data: { id: "synpilot-timetable-teacher", name: staff[0].fullName, shortName: "SYN-TCHR", department: "Academics", isActive: true, maxPeriodsPerWeek: 30, maxPeriodsPerDay: 6, notes: "Synthetic pilot teacher scope" } });
    await prisma.staffMember.update({ where: { id: staff[0].id }, data: { timetableTeacherId: timetableTeacher.id } });
    const timetableClass = await prisma.timetableClassSection.create({ data: { id: "synpilot-timetable-class-i-a", academicYear: "2026-27", className: "I", section: "A", displayName: "Class I A - Synthetic", groupName: "PRIMARY", isActive: true } });
    await prisma.timetableAssignment.create({ data: { id: "synpilot-timetable-assignment", academicYear: "2026-27", classSectionId: timetableClass.id, subjectId: subject.id, teacherId: timetableTeacher.id, periodsPerWeek: 5, notes: "Synthetic pilot daily scope" } });
    const classwork = await prisma.classworkItem.create({ data: { id: "synpilot-classwork", itemNumber: "SYNPILOT-CW-001", kind: "CLASSWORK", academicYear: "2026-27", className: "I", section: "A", subjectName: "Mathematics", timetableSubjectId: subject.id, status: "PUBLISHED", createdByUserId: users.TEACHER, publishedAt: generatedAt } });
    await prisma.classworkItemVersion.create({ data: { id: "synpilot-classwork-v1", itemId: classwork.id, versionNumber: 1, versionStatus: "PUBLISHED", title: "Synthetic fractions practice", instructions: "Complete the unmistakably synthetic exercise.", publishRequestKey: "SYNPILOT_classwork_publish_request_0001", createdByUserId: users.TEACHER, publishedByUserId: users.TEACHER, publishedAt: generatedAt } });

    const category = await prisma.expenseCategory.create({ data: { id: "synpilot-expense-category", name: "Synthetic Utilities", code: "SYN-UTIL" } });
    const expenseAmounts = [12_000, 4_000, 2_500, 1_500, 3_000];
    await createMany(prisma.expenseRecord, expenseAmounts.map((amount, index) => ({ id: `synpilot-expense-${index}`, expenseNumber: `SYNEXP-${index}`, expenseDate: generatedAt, academicYear: "2026-27", categoryId: category.id, description: "Synthetic approved cash expense", grossAmount: amount, netAmount: amount, paymentMethod: "CASH", paymentStatus: "PAID", approvalStatus: "APPROVED", paidDate: generatedAt, createdByUserId: users.ACCOUNTANT, submittedByUserId: users.ACCOUNTANT, approvedByUserId: users.DIRECTOR, paidByUserId: users.ACCOUNTANT, submittedAt: generatedAt, approvedAt: generatedAt, paidAt: generatedAt })));
    const incomeItem = await prisma.miscIncomeItem.create({ data: { id: "synpilot-income-item", itemCode: "SYN-MISC", name: "Synthetic Miscellaneous Income", category: "OTHER", studentLinkPolicy: "OPTIONAL", createdByUserId: users.ACCOUNTANT } });
    await createMany(prisma.miscIncomeReceipt, [5_000, 7_500, 2_500].map((amount, index) => ({ id: `synpilot-income-${index}`, receiptNumber: `SYNMIS-${index}`, receiptDate: generatedAt, academicYear: "2026-27", payerName: "Synthetic Payer", paymentMethod: "CASH", receivedAccount: "CASH_COUNTER", grossAmount: amount, netAmount: amount, status: "ACTIVE", remarks: "Synthetic income rehearsal", createdByUserId: users.ACCOUNTANT })));
    await createMany(prisma.miscIncomeReceiptLine, [5_000, 7_500, 2_500].map((amount, index) => ({ id: `synpilot-income-line-${index}`, receiptId: `synpilot-income-${index}`, itemId: incomeItem.id, itemNameSnapshot: incomeItem.name, quantity: 1, unitAmount: amount, lineTotal: amount })));

    const libraryTitle = await prisma.libraryTitle.create({ data: { id: "synpilot-library-title", titleCode: "SYNBOOK-001", title: "Synthetic School Operations", authors: "Synthetic Author", language: "English", subject: "Operations", category: "Reference", createdByUserId: users.COMPUTER_OPERATOR } });
    const copies = Array.from({ length: 20 }, (_, index) => ({ id: `synpilot-library-copy-${index}`, titleId: libraryTitle.id, accessionNumber: `SYNACC-${String(index).padStart(3, "0")}`, barcodeValue: `SYNBAR-${String(index).padStart(3, "0")}`, condition: index === 19 ? "DAMAGED" : "GOOD", status: "AVAILABLE", shelfCode: "SYN-A1", createdByUserId: users.COMPUTER_OPERATOR }));
    await createMany(prisma.libraryCopy, copies);
    await createMany(prisma.libraryCopyEvent, copies.map((copy, index) => ({ id: `synpilot-library-copy-event-${index}`, copyId: copy.id, eventType: "ACCESSIONED", eventDate: generatedAt, newStatus: copy.status, newCondition: copy.condition, newShelfCode: copy.shelfCode, reason: "Synthetic pilot accession", recordedByUserId: users.COMPUTER_OPERATOR })));
    const members = students.slice(0, 20).map((student, index) => ({ id: `synpilot-library-member-${index}`, memberCode: `SYNLIB-${String(index).padStart(3, "0")}`, memberType: "STUDENT", studentId: student.id, status: "ACTIVE", joinedDate: new Date("2026-06-01T00:00:00.000Z"), createdByUserId: users.COMPUTER_OPERATOR }));
    await createMany(prisma.libraryMember, members);
    await createMany(prisma.libraryLoan, copies.slice(0, 10).map((copy, index) => ({ id: `synpilot-library-loan-${index}`, loanNumber: `SYNLOAN-${String(index).padStart(3, "0")}`, copyId: copy.id, memberId: members[index].id, status: "ISSUED", activeCopyKey: copy.id, issueDate: new Date("2026-08-01T00:00:00.000Z"), dueDate: index < 3 ? new Date("2026-08-15T00:00:00.000Z") : new Date("2026-09-15T00:00:00.000Z"), policyCodeSnapshot: "SYNTHETIC", loanPeriodDaysSnapshot: 14, maxRenewalsSnapshot: 1, renewalPeriodDaysSnapshot: 7, issueConditionSnapshot: "GOOD", issuedByUserId: users.COMPUTER_OPERATOR })));

    const supportQueue = await prisma.supportQueue.create({ data: { id: "synpilot-support-queue", queueCode: "SYN-SUPPORT", name: "Synthetic Support", allowedAssigneeRolesJson: "[\"SUPER_ADMIN\",\"PRINCIPAL\"]", confidentialityJson: "[\"STANDARD\",\"RESTRICTED\"]", createdByUserId: users.SUPER_ADMIN } });
    const supportPolicy = await prisma.supportCategoryPolicy.create({ data: { id: "synpilot-support-policy", categoryCode: "SYN-GENERAL", label: "Synthetic General Support", queueId: supportQueue.id, permittedAssigneeRolesJson: "[\"SUPER_ADMIN\",\"PRINCIPAL\"]", createdByUserId: users.SUPER_ADMIN } });
    await createMany(prisma.supportRequest, Array.from({ length: 12 }, (_, index) => ({ id: `synpilot-support-${index}`, reference: `SYNSUP-${String(index).padStart(3, "0")}`, source: index % 2 ? "PARENT" : "STAFF", requesterRole: index % 2 ? "PARENT" : "TEACHER", requesterName: `Synthetic Requester ${index}`, requesterType: index % 2 ? "GUARDIAN" : "STAFF", identityVerified: true, categoryPolicyId: supportPolicy.id, queueId: supportQueue.id, priority: index === 0 ? "HIGH" : "NORMAL", confidentiality: index === 1 ? "RESTRICTED" : "STANDARD", subject: `Synthetic support case ${index}`, originalStatement: "No real complaint content. Synthetic rehearsal only.", status: index % 4 === 0 ? "RESOLVED" : "OPEN", privacyNoticeVersion: "SYN-1", consentRecordedAt: generatedAt, retentionReviewAt: new Date("2027-08-28T00:00:00.000Z") })));
    await createMany(prisma.parentMeeting, Array.from({ length: 40 }, (_, index) => ({ id: `synpilot-meeting-${index}`, publicKey: randomUUID(), studentId: students[index].id, requesterGuardianId: guardians[Math.floor(index / 2)].id, academicYear: "2026-27", source: "PARENT_REQUEST", category: "ACADEMIC_PROGRESS", subject: `Synthetic Parent Meeting ${index}`, requestReason: "Synthetic rehearsal", status: ["REQUESTED", "SCHEDULED", "COMPLETED", "CANCELLED"][index % 4], scheduledStartAt: new Date(generatedAt.getTime() + index * 3_600_000), scheduledEndAt: new Date(generatedAt.getTime() + index * 3_600_000 + 1_800_000), durationMinutes: 30, mode: "IN_PERSON", locationReference: "Synthetic Meeting Room", createdByUserId: users.PRINCIPAL, scheduledByUserId: users.PRINCIPAL, completedByUserId: index % 4 === 2 ? users.PRINCIPAL : null, cancelledByUserId: index % 4 === 3 ? users.PRINCIPAL : null, completedAt: index % 4 === 2 ? generatedAt : null, cancelledAt: index % 4 === 3 ? generatedAt : null, cancellationInternalReason: index % 4 === 3 ? "Synthetic cancellation" : null, followUpRequired: index % 5 === 0 })));

    const cycle = await prisma.admissionCycle.create({ data: { id: "synpilot-admission-cycle", cycleCode: "SYN-ADM-2026", name: "Synthetic Admissions 2026", academicYear: "2026-27", status: "OPEN", enabledClassesJson: JSON.stringify(classNames), declarationsJson: "[]", documentTypesJson: "[]", admissionNumberPrefix: "SYNA", createdByUserId: users.PRINCIPAL, opensAt: generatedAt, closesAt: new Date("2027-03-31T00:00:00.000Z") } });
    await createMany(prisma.admissionEnquiry, Array.from({ length: 20 }, (_, index) => ({ id: `synpilot-enquiry-${index}`, publicKey: randomUUID(), enquiryNumber: `SYNENQ-${String(index).padStart(3, "0")}`, cycleId: cycle.id, guardianName: `Synthetic Prospective Guardian ${index}`, contactMethod: "PHONE", contactValue: `0003${String(index).padStart(6, "0")}`, contactHash: createHash("sha256").update(`syn-enquiry-${index}`).digest("hex"), desiredAcademicYear: "2026-27", desiredClass: classNames[index % classNames.length], childName: `Synthetic Applicant ${index}`, enquirySource: "OFFICE", boundedMessage: "Synthetic admission enquiry", privacyNoticeVersion: "SYN-1", consentVersion: "SYN-1", consentRecordedAt: generatedAt, intakeChannel: "OFFICE", status: index % 5 === 0 ? "REJECTED" : "FOLLOW_UP", retentionReviewAt: new Date("2027-08-28T00:00:00.000Z"), createdByUserId: users.COMPUTER_OPERATOR })));

    const device = await prisma.offlineSyncDevice.create({ data: { id: "synpilot-device", publicDeviceId: "synpilot-device-public", userId: users.ACCOUNTANT, label: "Synthetic Accountant Device", platform: "DESKTOP", publicSigningKey: JSON.stringify({ kty: "EC", crv: "P-256", x: "9gFDiAFy0ASC1vDHn6_z0xzmBtngeG7BWYs7p57PmIM", y: "-IOVyc8QquzAdi0d34l2_jfW0dYDNhzUgvlYmQN_4Wk", ext: true, key_ops: ["verify"] }), publicKeyHash: "befd58decea4eadc6ad5e283bc7aaf96315f10299164346cfa261dc8bd0c4ea5", status: "ACTIVE", approvedAt: generatedAt, approvedByUserId: users.SUPER_ADMIN } });
    const accountantAssignment = await prisma.userRoleAssignment.findUniqueOrThrow({ where: { activeKey: `${users.ACCOUNTANT}:ACCOUNTANT` } });
    const nativeSession = await prisma.nativeSession.create({ data: { id: "synpilot-native-session", publicSessionId: "12345678-1234-4234-8234-123456789abc", userId: users.ACCOUNTANT, deviceId: device.id, roleAssignmentId: accountantAssignment.id, accessTokenHash: createHash("sha256").update("synthetic-access-token").digest("hex"), refreshTokenHash: createHash("sha256").update("synthetic-refresh-token-current").digest("hex"), credentialVersion: 1, authorizationVersion: 1, scopesJson: JSON.stringify(["offline:context", "offline:reference", "offline:sync", "offline:own-conflicts"]), tokenVersion: 2, accessExpiresAt: new Date(generatedAt.getTime() + 60 * 60 * 1_000), refreshExpiresAt: new Date(generatedAt.getTime() + 30 * 24 * 60 * 60 * 1_000), absoluteExpiresAt: new Date(generatedAt.getTime() + 45 * 24 * 60 * 60 * 1_000), lastSeenAt: generatedAt } });
    await prisma.nativeRefreshTokenHistory.create({ data: { id: "synpilot-native-refresh-history", sessionId: nativeSession.id, refreshTokenHash: createHash("sha256").update("synthetic-refresh-token-rotated").digest("hex"), tokenVersion: 1, status: "ROTATED", rotatedAt: generatedAt } });
    await createMany(prisma.offlineSyncMutation, Array.from({ length: 30 }, (_, index) => ({ id: `synpilot-offline-${index}`, deviceId: device.id, actorUserId: users.ACCOUNTANT, activeRole: "ACCOUNTANT", clientMutationId: `synpilot-mutation-${index}`, localDraftId: `synpilot-draft-${index}`, operationType: ["FEE_PAYMENT", "EXPENSE_DRAFT", "MISC_INCOME"][index % 3], requestHash: createHash("sha256").update(`request-${index}`).digest("hex"), payloadHash: createHash("sha256").update(`payload-${index}`).digest("hex"), syncSchemaVersion: 1, referenceSnapshotVersion: createHash("sha256").update("synthetic-reference-v1").digest("hex"), status: "RECEIVED", createdClientAt: generatedAt, receivedServerAt: generatedAt, lastAttemptAt: generatedAt })));
    for (let index = 0; index < 30; index += 1) {
      const terminalStatus = ["ACCEPTED", "CONFLICT", "REJECTED"][index % 3];
      await prisma.offlineSyncMutation.update({
        where: { id: `synpilot-offline-${index}` },
        data: {
          status: terminalStatus,
          conflictCode: terminalStatus === "CONFLICT" ? "SYNTHETIC_CONFLICT" : null,
          rejectionCode: terminalStatus === "REJECTED" ? "SYNTHETIC_REJECTION" : null,
          committedAt: terminalStatus === "ACCEPTED" ? generatedAt : null
        }
      });
    }

    const vehicle = await prisma.transportVehicle.create({ data: { id: "synpilot-vehicle", registrationCode: "SYN-VEHICLE-001", displayName: "Synthetic Bus", capacity: 40 } });
    const route = await prisma.transportRoute.create({ data: { id: "synpilot-route", code: "SYN-ROUTE-1", name: "Synthetic Route", vehicleId: vehicle.id, capacity: 40, allocatedSeats: 20 } });
    const stop = await prisma.transportStop.create({ data: { id: "synpilot-stop", code: "SYN-STOP-1", name: "Synthetic Approved Stop", approvedReference: "SYNTHETIC ONLY" } });
    const morningRouteStop = await prisma.transportRouteStop.create({ data: { id: "synpilot-route-stop-morning", routeId: route.id, stopId: stop.id, direction: "MORNING", sequence: 1, timingReference: "08:00 synthetic" } });
    const eveningRouteStop = await prisma.transportRouteStop.create({ data: { id: "synpilot-route-stop-evening", routeId: route.id, stopId: stop.id, direction: "EVENING", sequence: 1, timingReference: "16:00 synthetic" } });
    await createMany(prisma.transportStudentAssignment, students.slice(0, 20).map((student, index) => ({ id: `synpilot-transport-${index}`, studentId: student.id, activeStudentId: student.id, routeId: route.id, pickupRouteStopId: morningRouteStop.id, dropRouteStopId: eveningRouteStop.id, routeCodeSnapshot: route.code, routeNameSnapshot: route.name, pickupStopSnapshot: stop.name, pickupTimingSnapshot: morningRouteStop.timingReference, dropStopSnapshot: stop.name, dropTimingSnapshot: eveningRouteStop.timingReference, effectiveFrom: new Date("2026-06-01T00:00:00.000Z"), active: true, changeReason: "Synthetic optional-operation rehearsal", createdByUserId: users.SUPER_ADMIN, createdByRole: "SUPER_ADMIN" })));
    const cafeteriaItem = await prisma.cafeteriaCatalogItem.create({ data: { id: "synpilot-cafeteria-item", code: "SYN-MEAL", name: "Synthetic Meal", category: "LUNCH" } });
    const cafeteriaMenu = await prisma.cafeteriaMenu.create({ data: { id: "synpilot-cafeteria-menu", menuDate: generatedAt, dayLabel: "Synthetic Day", mealPlanName: "SYNTHETIC" } });
    await prisma.cafeteriaMenuItem.create({ data: { id: "synpilot-cafeteria-menu-item", menuId: cafeteriaMenu.id, itemId: cafeteriaItem.id, mealSlot: "LUNCH" } });

    const syntheticPng = Buffer.from([
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQ",
      "AAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z0b8AAAAASUVORK5CYII="
    ].join(""), "base64");
    mkdirSync(path.dirname(privateMediaPath), { recursive: true });
    writeFileSync(privateMediaPath, syntheticPng, { mode: 0o600 });
    const album = await prisma.eventMediaAlbum.create({ data: { id: "synpilot-media-album", title: "Synthetic Private School Event", eventDate: generatedAt, description: "Generated synthetic image only", visibility: "PRIVATE_LEADERSHIP", status: "APPROVED", reviewStatus: "APPROVED", publicationState: "PRIVATE", createdByUserId: users.SUPER_ADMIN, reviewedByUserId: users.PRINCIPAL, approvedByUserId: users.PRINCIPAL, reviewedAt: generatedAt, approvedAt: generatedAt } });
    await prisma.eventMediaAsset.create({ data: { id: "synpilot-media-asset", albumId: album.id, originalStorageKey: privateMediaStorageKey, originalMediaType: "image/png", originalExtension: ".png", originalByteSize: syntheticPng.length, originalSha256: createHash("sha256").update(syntheticPng).digest("hex"), originalWidth: 1, originalHeight: 1, uploadActorUserId: users.SUPER_ADMIN, uploadedAt: generatedAt, reviewStatus: "APPROVED", reviewedByUserId: users.PRINCIPAL, reviewedAt: generatedAt, reviewNote: "Synthetic-only private media", caption: "Synthetic pilot event image", peopleDeclaration: "NO_STUDENTS", publicationEligibility: "ELIGIBLE", publicationStatus: "PRIVATE", derivativeStatus: "NOT_REQUIRED", recoveryStatus: "LOCAL_SYNTHETIC" } });

    const counts = {
      students: await prisma.student.count(),
      guardians: await prisma.guardian.count(),
      staff: await prisma.staffMember.count(),
      users: await prisma.user.count(),
      guardianLinks: await prisma.studentGuardian.count(),
      payments: await prisma.payment.count(),
      attendanceRecords: await prisma.studentAttendanceRecord.count(),
      staffAttendanceRecords: await prisma.staffAttendanceRecord.count(),
      marks: await prisma.studentMark.count(),
      issuedReports: await prisma.studentReportCard.count({ where: { status: "ISSUED" } }),
      supportRequests: await prisma.supportRequest.count(),
      parentMeetings: await prisma.parentMeeting.count(),
      offlineMutations: await prisma.offlineSyncMutation.count(),
      nativeSessions: await prisma.nativeSession.count(),
      transportAssignments: await prisma.transportStudentAssignment.count(),
      eventMediaAssets: await prisma.eventMediaAsset.count()
    };
    invariant(counts.students === 800 && counts.guardians === 1_200 && counts.staff === 80 && counts.attendanceRecords === 800, "SYNTHETIC_PILOT_FIXTURE_COUNT_MISMATCH");
    writeFileSync(credentialsPath, `${JSON.stringify({ synthetic: true, generatedAt: new Date().toISOString(), personas: credentials }, null, 2)}\n`, { mode: 0o600 });
    const manifest = { promptId: SYNTHETIC_PILOT_ID, synthetic: true, operationalDataUsed: false, databasePath, databaseSha256: createHash("sha256").update(readFileSync(databasePath)).digest("hex"), credentialsPath, privateMediaPath, counts };
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
    console.log(JSON.stringify({ verdict: "SYNTHETIC_PILOT_FIXTURE_READY", manifestPath, counts }));
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[2] === "cleanup") {
  cleanup();
  console.log("SYNTHETIC_PILOT_FIXTURE_CLEANED");
} else {
  seed().catch((error) => {
    console.error(error instanceof Error ? error.message : "SYNTHETIC_PILOT_FIXTURE_FAILED");
    process.exitCode = 1;
  });
}
