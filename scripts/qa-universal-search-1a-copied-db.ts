import { createHash, randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import path from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { hashPassword, verifyPassword } from "../lib/password";
import { resolveLoginIdentifier } from "../lib/auth-identifiers";
import { parseUniversalSearchRequest, runUniversalSearch } from "../lib/universal-search";

const extension = process.argv.includes("--extension-1b");
const SUITE = extension ? "SEARCHEXTENSION1B" : "UNIVERSALSEARCH1A";
const workspace = path.resolve(".");
const operational = path.resolve(process.env.UNIVERSAL_SEARCH_OPERATIONAL_DB?.trim() || path.join(workspace, "prisma", "dev.db"));
const rootName = extension ? "search-extension-1b-synthetic-qa" : "universal-search-1a-qa";
const root = path.join(workspace, "tmp", rootName);
const copiedDatabase = path.join(root, "search-copy.db");
const credentialsPath = path.join(root, "browser-credentials.json");
const fixtureSuffix = randomUUID().slice(0, 8);
const browserCredentialValue = `universalsearch${fixtureSuffix}safe9`;
const target = `US1ATARGET${fixtureSuffix}`;
const keep = process.argv.includes("--keep");
let stage = "preflight";

function invariant(value: unknown, code: string): asserts value {
  if (!value) throw new Error(code);
}

function databaseUrl(file: string) {
  return `file:${file.replaceAll("\\", "/")}`;
}

function sha256(file: string) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function checkedRoot() {
  const resolved = path.resolve(root);
  const parent = path.resolve(workspace, "tmp");
  invariant(resolved.startsWith(`${parent}${path.sep}`) && resolved.endsWith(rootName), `${SUITE}_CLEANUP_SCOPE_REFUSED`);
  return resolved;
}

function cleanup() {
  const targetPath = checkedRoot();
  if (existsSync(targetPath)) rmSync(targetPath, { recursive: true, force: true });
}

function percentile(values: number[], proportion: number) {
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.max(0, Math.ceil(ordered.length * proportion) - 1)] ?? 0;
}

function applyExistingMigrations(database: string) {
  const prismaEntry = path.join(workspace, "node_modules", "prisma", "build", "index.js");
  invariant(existsSync(prismaEntry), `${SUITE}_PRISMA_RUNTIME_MISSING`);
  const result = spawnSync(process.execPath, [prismaEntry, "migrate", "deploy", "--schema", "prisma/schema.prisma"], {
    cwd: workspace,
    env: { ...process.env, DATABASE_URL: databaseUrl(database) },
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true
  });
  if (result.error || result.status !== 0) throw new Error(`${SUITE}_COPIED_DATABASE_MIGRATION_FAILED:${result.error?.message ?? `${result.stdout}\n${result.stderr}`}`);
}

async function createUser(client: PrismaClient, role: "SUPER_ADMIN" | "PRINCIPAL", label: string, passwordHash: string) {
  const id = randomUUID();
  const username = `${SUITE.toLowerCase()}-${label.toLowerCase()}-${fixtureSuffix}`;
  await client.user.create({ data: {
    id, iamPublicKey: randomUUID(), name: `${target} ${label}`, designation: `${role} copied-database fixture`,
    username, passwordHash, role, isActive: true, lifecycleStatus: "ACTIVE"
  } });
  await client.authLoginAlias.create({ data: { userId: id, type: "USERNAME", normalizedValue: username, displayMasked: username, status: "VERIFIED", isSchoolGoverned: true, verifiedAt: new Date() } });
  await client.userRoleAssignment.create({ data: { publicKey: randomUUID(), userId: id, role, status: "ACTIVE", reason: `${SUITE} copied-database fixture`, activeKey: `${id}:${role}` } });
  return { id, username, role } as const;
}

async function seedVolume(client: PrismaClient, ownerA: string, ownerB: string) {
  stage = "synthetic volume";
  const baseDate = new Date("2026-08-22T00:00:00.000Z");
  await client.student.createMany({ data: Array.from({ length: 1_200 }, (_, index) => ({
    admissionNo: `${target}-ADM-${String(index).padStart(4, "0")}`,
    studentName: `${target} Student ${String(index).padStart(4, "0")}`,
    fatherName: `${target} Guardian ${String(index).padStart(4, "0")}`,
    className: String(index % 10 + 1), section: ["A", "B", "C"][index % 3], phone1: `9000${String(index).padStart(6, "0")}`,
    academicYear: "2026-27", status: "Active"
  })) });
  const students = await client.student.findMany({ where: { admissionNo: { startsWith: `${target}-ADM-` } }, select: { id: true }, orderBy: { admissionNo: "asc" }, take: 1_200 });
  invariant(students.length === 1_200, `${SUITE}_STUDENT_VOLUME_INVALID`);

  await client.guardian.createMany({ data: Array.from({ length: 600 }, (_, index) => ({
    displayName: `${target} Guardian ${String(index).padStart(4, "0")}`,
    primaryMobile: `9100${String(index).padStart(6, "0")}`, email: `${target.toLowerCase()}-${index}@example.test`, relationship: "Parent", status: "Active"
  })) });
  await client.staffMember.createMany({ data: Array.from({ length: 320 }, (_, index) => ({
    staffCode: `${target}-STAFF-${String(index).padStart(4, "0")}`, fullName: `${target} Staff ${String(index).padStart(4, "0")}`,
    designation: index % 2 ? "Teacher" : "Administrator", department: index % 2 ? "Academics" : "Operations", status: "ACTIVE"
  })) });
  await client.admissionEnquiry.createMany({ data: Array.from({ length: 360 }, (_, index) => ({
    publicKey: randomUUID(), enquiryNumber: `${target}-ENQ-${String(index).padStart(4, "0")}`,
    guardianName: `${target} Prospective Guardian ${index}`, contactMethod: "PHONE", contactValue: `9200${String(index).padStart(6, "0")}`,
    contactHash: createHash("sha256").update(`${target}-${index}`).digest("hex"), desiredAcademicYear: "2026-27", desiredClass: String(index % 10 + 1),
    childName: `${target} Applicant ${index}`, enquirySource: "WALK_IN", privacyNoticeVersion: "SYNTHETIC", consentVersion: "SYNTHETIC",
    consentRecordedAt: baseDate, intakeChannel: "IN_PERSON", status: "NEW", retentionReviewAt: new Date("2027-08-22T00:00:00.000Z")
  })) });
  await client.superAdminDiaryEntry.createMany({ data: [
    ...Array.from({ length: 420 }, (_, index) => ({
      publicKey: randomUUID(), ownerUserId: ownerA,
      title: index === 0
        ? `${target} Diary with a deliberately long but privacy-safe title for responsive Universal Search result layout verification`
        : `${target} Diary ${index}`,
      entryDate: baseDate,
      notes: index === 0
        ? `${target} privacy-safe copied-database note with deliberately extended content to verify that long snippets remain readable and bounded on desktop and mobile without exposing another owner's data.`
        : `${target} private diary body ${index}`,
      category: "OPERATIONS", status: "OPEN", priority: "NORMAL"
    })),
    ...Array.from({ length: 12 }, (_, index) => ({ publicKey: randomUUID(), ownerUserId: ownerB, title: `${target} OWNER B DIARY ${index}`, entryDate: baseDate, notes: `${target} owner-b-only diary ${index}`, category: "PERSONAL_WORK", status: "OPEN", priority: "NORMAL" }))
  ] });
  await client.superAdminTask.createMany({ data: [
    ...Array.from({ length: 1_500 }, (_, index) => ({ publicKey: randomUUID(), ownerUserId: ownerA, title: `${target} Task ${index}`, description: `${target} bounded task description ${index}`, status: "TO_DO", priority: "NORMAL", dueDate: baseDate, category: "OPERATIONS" })),
    ...Array.from({ length: 12 }, (_, index) => ({ publicKey: randomUUID(), ownerUserId: ownerB, title: `${target} OWNER B TASK ${index}`, description: `${target} owner-b-only task ${index}`, status: "TO_DO", priority: "NORMAL", dueDate: baseDate, category: "PERSONAL_WORK" }))
  ] });
  await client.superAdminContact.createMany({ data: [
    ...Array.from({ length: 520 }, (_, index) => ({ publicKey: randomUUID(), ownerUserId: ownerA, name: `${target} Contact ${index}`, contactPerson: `${target} Person ${index}`, category: "BOOK_SUPPLIER", phone: `9300${String(index).padStart(6, "0")}`, email: `${target.toLowerCase()}-contact-${index}@example.test`, status: "ACTIVE", tagsJson: `["${target}","synthetic"]` })),
    ...Array.from({ length: 12 }, (_, index) => ({ publicKey: randomUUID(), ownerUserId: ownerB, name: `${target} OWNER B CONTACT ${index}`, category: "OTHER", phone: `9400${String(index).padStart(6, "0")}`, status: "ACTIVE", tagsJson: "[]" }))
  ] });
  await client.payment.createMany({ data: Array.from({ length: 240 }, (_, index) => ({
    date: baseDate, receiptNo: `${target}-RCT-${String(index).padStart(4, "0")}`, admissionNo: `${target}-ADM-${String(index).padStart(4, "0")}`,
    studentId: students[index].id, studentName: `${target} Student ${String(index).padStart(4, "0")}`, className: String(index % 10 + 1),
    amountPaid: 1_000, paymentMode: "Cash", receivedAccount: "Synthetic copy", feeType: "Current Year Fee", enteredBy: "Synthetic QA"
  })) });
  await client.examination.createMany({ data: Array.from({ length: 140 }, (_, index) => ({
    examCode: `${target}-EXAM-${String(index).padStart(4, "0")}`, academicYear: "2026-27", name: `${target} Examination ${index}`,
    examType: "TERM", startDate: baseDate, endDate: new Date("2026-08-25T00:00:00.000Z"), status: "ACTIVE", createdByUserId: ownerA
  })) });

  const queue = await client.supportQueue.create({ data: { publicKey: randomUUID(), queueCode: `${target}-QUEUE`, name: `${target} Support Queue`, allowedAssigneeRolesJson: '["SUPER_ADMIN"]' } });
  const category = await client.supportCategoryPolicy.create({ data: { publicKey: randomUUID(), categoryCode: `${target}-GENERAL`, label: `${target} General`, queueId: queue.id, permittedAssigneeRolesJson: '["SUPER_ADMIN"]', createdByUserId: ownerA } });
  await client.supportRequest.createMany({ data: Array.from({ length: 120 }, (_, index) => ({
    publicKey: randomUUID(), reference: `${target}-SUP-${String(index).padStart(4, "0")}`, source: "IN_PERSON", requesterName: `${target} Requester ${index}`,
    requesterType: "OTHER", recordedByUserId: ownerA, categoryPolicyId: category.id, queueId: queue.id, priority: "NORMAL", confidentiality: "STANDARD",
    subject: `${target} Support subject ${index}`, originalStatement: "Synthetic copied-database statement", status: "OPEN", privacyNoticeVersion: "SYNTHETIC",
    retentionReviewAt: new Date("2027-08-22T00:00:00.000Z")
  })) });
  await client.studentDepartureRequest.createMany({ data: Array.from({ length: 80 }, (_, index) => ({
    publicKey: randomUUID(), requestNumber: `${target}-EXIT-${String(index).padStart(4, "0")}`, submissionKey: randomUUID(), source: "STAFF",
    studentId: students[index].id, academicYear: "2026-27", reasonCategory: "OTHER", calendarBasisJson: "{}", intendedHandoverMethod: "PARENT_PICKUP",
    intendedDepartureAt: baseDate, status: "REQUESTED", restricted: false, requestedByUserId: ownerA, requestedByRole: "SUPER_ADMIN"
  })) });

  await client.releaseManifest.createMany({ data: Array.from({ length: 20 }, (_, index) => ({
    releaseVersion: `${target}-v${index}`, environment: "SYNTHETIC", gitCommit: `${target}${String(index).padStart(4, "0")}`, buildId: `${target}-BUILD-${index}`,
    migrationVersion: "COPIED_DB_ONLY", backupVersion: 1, pwaBuildId: `${target}-PWA-${index}`, applicationSchemaId: "SYNTHETIC", createdByUserId: ownerA
  })) });
  await client.operationalAlert.createMany({ data: Array.from({ length: 100 }, (_, index) => ({
    publicKey: randomUUID(), fingerprint: createHash("sha256").update(`${target}-alert-${index}`).digest("hex"), domain: "CORE_APPLICATION_HEALTH", severity: "WARNING",
    status: "OPEN", titleSafe: `${target} Alert ${index}`, evidenceSummarySafe: `${target} safe synthetic evidence`, runbookPath: "docs/synthetic"
  })) });
}

async function seedExtensionVolume(client: PrismaClient, ownerA: string) {
  stage = "extension synthetic volume";
  const baseDate = new Date("2026-08-24T00:00:00.000Z");
  const students = await client.student.findMany({
    where: { admissionNo: { startsWith: `${target}-ADM-` } },
    select: { id: true, admissionNo: true, studentName: true },
    orderBy: { admissionNo: "asc" },
    take: 300
  });
  const staff = await client.staffMember.findFirstOrThrow({ where: { staffCode: { startsWith: `${target}-STAFF-` } }, orderBy: { staffCode: "asc" } });
  invariant(students.length === 300, `${SUITE}_EXTENSION_STUDENT_VOLUME_INVALID`);
  const sentinelSuffix = fixtureSuffix.replace(/[^a-z0-9]/gi, "").toUpperCase();
  const forbidden = {
    parent: `ZXFORBIDDENPARENT${sentinelSuffix}Q7`,
    driver: `ZXFORBIDDENDRIVER${sentinelSuffix}Q7`,
    diet: `ZXFORBIDDENHEALTH${sentinelSuffix}Q7`,
    kg: `ZXFORBIDDENRUBRIC${sentinelSuffix}Q7`,
    media: `ZXFORBIDDENMEDIA${sentinelSuffix}Q7`
  };
  const xssPayload = "<script>search-extension-xss</script><img src=x onerror=alert(1)><svg onload=alert(1)>[x](javascript:alert(1))";
  await client.student.update({ where: { id: students[0].id }, data: { studentName: `${target} ${xssPayload}` } });
  await client.staffMember.update({ where: { id: staff.id }, data: { emergencyContactMobile: forbidden.driver } });

  await client.parentMeeting.createMany({ data: Array.from({ length: 1_050 }, (_, index) => ({
    publicKey: `${target}-PM-${String(index).padStart(4, "0")}`,
    studentId: students[index % students.length].id,
    academicYear: "2026-27",
    source: "LEADERSHIP_CREATED",
    category: index % 2 ? "ACADEMIC_PROGRESS" : "GENERAL_SCHOOL_DISCUSSION",
    subject: index === 0 ? forbidden.parent : `${target} private meeting subject ${index}`,
    requestReason: `${target} parent-sensitive request reason ${index}`,
    status: "SCHEDULED",
    scheduledStartAt: new Date(baseDate.getTime() + index * 60 * 60 * 1000),
    scheduledEndAt: new Date(baseDate.getTime() + (index * 60 + 30) * 60 * 1000),
    durationMinutes: 30,
    mode: "IN_PERSON",
    locationReference: "School meeting room",
    followUpRequired: index < 80,
    createdByUserId: ownerA,
    scheduledByUserId: ownerA
  })) });
  const meetings = await client.parentMeeting.findMany({ where: { publicKey: { startsWith: `${target}-PM-` } }, select: { id: true }, orderBy: { publicKey: "asc" }, take: 80 });
  await client.parentMeetingFollowUp.createMany({ data: meetings.map((meeting, index) => ({
    publicKey: `${target}-PF-${String(index).padStart(4, "0")}`,
    meetingId: meeting.id,
    internalDescription: `${target} leadership-private follow-up ${index}`,
    parentVisibleDescription: `${target} parent-visible follow-up ${index}`,
    responsibleStaffMemberId: staff.id,
    dueDate: new Date(baseDate.getTime() + (index + 1) * 24 * 60 * 60 * 1000),
    status: "OPEN",
    createdByUserId: ownerA
  })) });

  await client.transportVehicle.createMany({ data: Array.from({ length: 40 }, (_, index) => ({
    publicKey: `${target}-TV-${String(index).padStart(4, "0")}`,
    registrationCode: `${target}-BUS-${String(index).padStart(4, "0")}`,
    displayName: `${target} Vehicle ${String(index).padStart(4, "0")}`,
    capacity: 50,
    status: "ACTIVE"
  })) });
  const vehicles = await client.transportVehicle.findMany({ where: { registrationCode: { startsWith: `${target}-BUS-` } }, select: { id: true }, orderBy: { registrationCode: "asc" } });
  await client.transportRoute.createMany({ data: Array.from({ length: 80 }, (_, index) => ({
    publicKey: `${target}-TR-${String(index).padStart(4, "0")}`,
    code: `${target}-ROUTE-${String(index).padStart(4, "0")}`,
    name: index === 0 ? `${target} Route ${String(index).padStart(4, "0")} ${xssPayload}` : `${target} Route ${String(index).padStart(4, "0")}`,
    vehicleId: vehicles[index % vehicles.length].id,
    driverStaffMemberId: staff.id,
    capacity: 50,
    directionMode: "BOTH",
    status: "ACTIVE"
  })) });
  await client.transportStop.createMany({ data: Array.from({ length: 120 }, (_, index) => ({
    publicKey: `${target}-TS-${String(index).padStart(4, "0")}`,
    code: `${target}-STOP-${String(index).padStart(4, "0")}`,
    name: index === 0 ? `${target} Approved Stop ${String(index).padStart(4, "0")} ${xssPayload}` : `${target} Approved Stop ${String(index).padStart(4, "0")}`,
    approvedReference: `${target}-APPROVED-${String(index).padStart(4, "0")}`,
    active: true
  })) });
  const routes = await client.transportRoute.findMany({ where: { code: { startsWith: `${target}-ROUTE-` } }, select: { id: true, code: true, name: true }, orderBy: { code: "asc" } });
  const stops = await client.transportStop.findMany({ where: { code: { startsWith: `${target}-STOP-` } }, select: { id: true, name: true }, orderBy: { code: "asc" } });
  await client.transportRouteStop.createMany({ data: routes.flatMap((route, index) => {
    const stop = stops[index % stops.length];
    return [
      { publicKey: `${target}-TRS-M-${String(index).padStart(4, "0")}`, routeId: route.id, stopId: stop.id, direction: "MORNING", sequence: 1, timingReference: "07:30", active: true },
      { publicKey: `${target}-TRS-A-${String(index).padStart(4, "0")}`, routeId: route.id, stopId: stop.id, direction: "AFTERNOON", sequence: 1, timingReference: "14:30", active: true }
    ];
  }) });
  const routeStops = await client.transportRouteStop.findMany({
    where: { route: { code: { startsWith: `${target}-ROUTE-` } } },
    select: { id: true, routeId: true, direction: true, timingReference: true, stop: { select: { name: true } } }
  });
  const stopsByRoute = new Map<string, { morning: typeof routeStops[number]; afternoon: typeof routeStops[number] }>();
  for (const route of routes) {
    const morning = routeStops.find((row) => row.routeId === route.id && row.direction === "MORNING");
    const afternoon = routeStops.find((row) => row.routeId === route.id && row.direction === "AFTERNOON");
    invariant(morning && afternoon, `${SUITE}_TRANSPORT_ROUTE_STOP_PAIR_MISSING`);
    stopsByRoute.set(route.id, { morning, afternoon });
  }
  await client.transportStudentAssignment.createMany({ data: students.map((student, index) => {
    const route = routes[index % routes.length];
    const pair = stopsByRoute.get(route.id)!;
    return {
      publicKey: `${target}-TA-${String(index).padStart(4, "0")}`,
      studentId: student.id,
      activeStudentId: student.id,
      routeId: route.id,
      pickupRouteStopId: pair.morning.id,
      dropRouteStopId: pair.afternoon.id,
      routeCodeSnapshot: route.code,
      routeNameSnapshot: route.name,
      pickupStopSnapshot: pair.morning.stop.name,
      pickupTimingSnapshot: pair.morning.timingReference,
      dropStopSnapshot: pair.afternoon.stop.name,
      dropTimingSnapshot: pair.afternoon.timingReference,
      effectiveFrom: baseDate,
      active: true,
      changeReason: `${target} synthetic assignment`,
      createdByUserId: ownerA,
      createdByRole: "SUPER_ADMIN"
    };
  }) });

  await client.cafeteriaCatalogItem.createMany({ data: Array.from({ length: 80 }, (_, index) => ({
    publicKey: `${target}-CI-${String(index).padStart(4, "0")}`,
    code: `${target}-ITEM-${String(index).padStart(4, "0")}`,
    name: index === 0 ? `${target} Menu Item ${String(index).padStart(4, "0")} ${xssPayload}` : `${target} Menu Item ${String(index).padStart(4, "0")}`,
    category: index % 2 ? "LUNCH" : "SNACK",
    available: true,
    status: "ACTIVE"
  })) });
  await client.cafeteriaMenu.createMany({ data: Array.from({ length: 30 }, (_, index) => ({
    publicKey: `${target}-CM-${String(index).padStart(4, "0")}`,
    menuDate: new Date(baseDate.getTime() + index * 24 * 60 * 60 * 1000),
    dayLabel: index === 0 ? `${target} Day ${String(index).padStart(2, "0")} ${xssPayload}` : `${target} Day ${String(index).padStart(2, "0")}`,
    mealPlanName: "STANDARD",
    status: "ACTIVE"
  })) });
  const items = await client.cafeteriaCatalogItem.findMany({ where: { code: { startsWith: `${target}-ITEM-` } }, select: { id: true }, orderBy: { code: "asc" } });
  const menus = await client.cafeteriaMenu.findMany({ where: { dayLabel: { startsWith: `${target} Day` } }, select: { id: true }, orderBy: { menuDate: "asc" } });
  await client.cafeteriaMenuItem.createMany({ data: items.map((item, index) => ({
    publicKey: `${target}-CMI-${String(index).padStart(4, "0")}`,
    menuId: menus[index % menus.length].id,
    itemId: item.id,
    mealSlot: "LUNCH",
    available: true
  })) });
  await client.cafeteriaStudentEnrollment.createMany({ data: students.map((student, index) => ({
    publicKey: `${target}-CE-${String(index).padStart(4, "0")}`,
    studentId: student.id,
    activeStudentId: student.id,
    mealPlanName: index === 0 ? forbidden.diet : "STANDARD",
    effectiveFrom: baseDate,
    active: true,
    changeReason: `${target} synthetic enrollment`,
    createdByUserId: ownerA,
    createdByRole: "SUPER_ADMIN"
  })) });
  const enrollments = await client.cafeteriaStudentEnrollment.findMany({ where: { publicKey: { startsWith: `${target}-CE-` } }, select: { id: true, studentId: true }, orderBy: { publicKey: "asc" } });
  const menuItems = await client.cafeteriaMenuItem.findMany({ where: { item: { code: { startsWith: `${target}-ITEM-` } } }, select: { id: true } });
  await client.cafeteriaMealRecord.createMany({ data: enrollments.map((enrollment, index) => ({
    publicKey: `${target}-MEAL-${String(index).padStart(4, "0")}`,
    studentId: enrollment.studentId,
    enrollmentId: enrollment.id,
    menuItemId: menuItems[index % menuItems.length].id,
    serviceDateKey: baseDate.toISOString().slice(0, 10),
    mealSlot: "LUNCH",
    recordType: "SERVED",
    status: "RECORDED",
    idempotencyKey: `${target}-MEAL-IDEMPOTENCY-${String(index).padStart(4, "0")}`,
    recordedByUserId: ownerA,
    recordedByRole: "SUPER_ADMIN"
  })) });

  const template = await client.reportCardTemplate.create({ data: {
    templateCode: `${target}-KG-TEMPLATE`, name: `${target} KG metadata template`, reportType: "KG_RUBRIC", academicYear: "2026-27",
    className: "LKG", status: "ACTIVE", templateDefinitionJson: JSON.stringify({ synthetic: true }), createdByUserId: ownerA, activatedByUserId: ownerA
  } });
  const batch = await client.reportCardBatch.create({ data: {
    batchNumber: `${target}-KG-BATCH`, academicYear: "2026-27", reportType: "KG_RUBRIC", templateId: template.id,
    className: "LKG", section: "A", title: `${target} KG Evaluations I-V`, reportingPeriod: "Evaluations I-V", status: "ISSUED",
    templateSnapshotJson: JSON.stringify({ synthetic: true }), createdByUserId: ownerA, issuedByUserId: ownerA, issuedAt: baseDate
  } });
  await client.studentReportCard.createMany({ data: students.slice(0, 200).map((student, index) => ({
    reportCardNumber: `${target}-KG-REPORT-${String(index).padStart(4, "0")}`,
    batchId: batch.id,
    studentId: student.id,
    academicYear: "2026-27",
    className: "LKG",
    section: "A",
    reportType: "KG_RUBRIC",
    status: "ISSUED",
    currentVersionNumber: 1,
    draftDataJson: index === 0 ? forbidden.kg : `${target} rubric snapshot ${index}`,
    teacherOverallComment: `${target} private assessment comment ${index}`,
    finalGrade: "A",
    createdByUserId: ownerA,
    issuedByUserId: ownerA,
    issuedAt: baseDate
  })) });

  await client.eventMediaAlbum.createMany({ data: Array.from({ length: 60 }, (_, index) => ({
    publicKey: index === 0 ? `${target}-ALBUM-${String(index).padStart(4, "0")}${xssPayload}` : `${target}-ALBUM-${String(index).padStart(4, "0")}`,
    title: index === 0 ? forbidden.media : `${target} Event Album ${String(index).padStart(4, "0")}`,
    eventDate: new Date(baseDate.getTime() - index * 24 * 60 * 60 * 1000),
    description: index === 0 ? forbidden.media : `${target} consent-sensitive album description ${index}`,
    visibility: "PRIVATE_LEADERSHIP",
    status: "APPROVED",
    reviewStatus: "APPROVED",
    publicationState: "PRIVATE",
    createdByUserId: ownerA,
    reviewedByUserId: ownerA,
    approvedByUserId: ownerA,
    reviewedAt: baseDate,
    approvedAt: baseDate
  })) });
  const albums = await client.eventMediaAlbum.findMany({ where: { publicKey: { startsWith: `${target}-ALBUM-` } }, select: { id: true }, orderBy: { publicKey: "asc" } });
  await client.eventMediaAsset.createMany({ data: Array.from({ length: 300 }, (_, index) => ({
    publicKey: index === 0 ? `${target}-MEDIA-${String(index).padStart(4, "0")}${xssPayload}` : `${target}-MEDIA-${String(index).padStart(4, "0")}`,
    albumId: albums[index % albums.length].id,
    originalStorageKey: `${target}/private/original-${String(index).padStart(4, "0")}.jpg`,
    originalMediaType: "image/jpeg",
    originalExtension: ".jpg",
    originalByteSize: 128_000,
    originalSha256: createHash("sha256").update(`${target}-media-${index}`).digest("hex"),
    originalWidth: 1600,
    originalHeight: 900,
    uploadActorUserId: ownerA,
    reviewStatus: "APPROVED",
    reviewedByUserId: ownerA,
    reviewedAt: baseDate,
    reviewNote: `${target} consent-sensitive review note ${index}`,
    caption: index === 0 ? forbidden.media : `${target} private caption ${index}`,
    peopleDeclaration: "UNKNOWN",
    publicationEligibility: "UNKNOWN",
    publicationStatus: "PRIVATE",
    derivativeStatus: "READY",
    recoveryStatus: "VERIFIED"
  })) });

  return {
    forbidden,
    xssPayload,
    volume: { parentMeetings: 1_050, transportVehicles: 40, transportRoutes: 80, transportStops: 120, transportAssignments: 300, cafeteriaItems: 80, cafeteriaMenus: 30, cafeteriaEnrollments: 300, cafeteriaMeals: 300, kgReports: 200, eventAlbums: 60, eventMedia: 300 }
  };
}

async function main() {
  cleanup();
  mkdirSync(root, { recursive: true });
  invariant(existsSync(operational), `${SUITE}_OPERATIONAL_DATABASE_MISSING`);
  const operationalBefore = { sha256: sha256(operational), size: statSync(operational).size };
  copyFileSync(operational, copiedDatabase);
  stage = "apply existing migrations to copy";
  applyExistingMigrations(copiedDatabase);
  if (extension) {
    process.env.DATABASE_URL = databaseUrl(copiedDatabase);
    process.env.PARENT_MEETINGS_V1_5 = "true";
    process.env.EVENT_MEDIA_PUBLIC_GALLERY_ENABLED = "true";
    process.env.KG_REPORT_CARDS_V1_5_QA_MODE = "SYNTHETIC_COPY_ONLY";
    process.env.OPTIONAL_OPS_SYNTHETIC_QA = "1";
    process.env.TRANSPORT_V1_5 = "enabled";
    process.env.CAFETERIA_V1_5 = "enabled";
  }
  const client = new PrismaClient({ datasourceUrl: databaseUrl(copiedDatabase) });
  try {
    stage = "actor fixtures";
    const passwordHash = await hashPassword(browserCredentialValue);
    const superA = await createUser(client, "SUPER_ADMIN", "A", passwordHash);
    const superB = await createUser(client, "SUPER_ADMIN", "B", passwordHash);
    const principal = await createUser(client, "PRINCIPAL", "Principal", passwordHash);
    await seedVolume(client, superA.id, superB.id);
    const extensionEvidence = extension ? await seedExtensionVolume(client, superA.id) : null;

    stage = "owner isolation";
    const ownerRequest = parseUniversalSearchRequest({ query: target, sources: ["DIARY", "TASKS", "CONTACTS"], limit: 50 });
    const ownerA = await runUniversalSearch(client, { id: superA.id, role: "SUPER_ADMIN" }, ownerRequest);
    const ownerB = await runUniversalSearch(client, { id: superB.id, role: "SUPER_ADMIN" }, ownerRequest);
    invariant(ownerA.results.length > 0 && ownerB.results.length > 0, `${SUITE}_OWNER_RESULTS_MISSING`);
    invariant(!JSON.stringify(ownerA).includes("OWNER B"), `${SUITE}_OWNER_A_LEAKED_OWNER_B`);
    invariant(ownerB.results.every((row) => row.title.includes("OWNER B")), `${SUITE}_OWNER_B_RESULTS_INVALID`);

    if (extensionEvidence) {
      stage = "extension source coverage and privacy sentinels";
      const extensionSources = ["PARENT_MEETINGS", "TRANSPORT", "CAFETERIA", "KG_REPORTS", "EVENT_MEDIA"] as const;
      const extensionResponse = await runUniversalSearch(client, { id: superA.id, role: "SUPER_ADMIN" }, parseUniversalSearchRequest({ query: target, sources: [...extensionSources], limit: 50 }));
      invariant(extensionResponse.results.length > 0, `${SUITE}_EXTENSION_RESULTS_MISSING`);
      invariant(
        extensionResponse.sources.every((source) => source.state === "OK"),
        `${SUITE}_EXTENSION_SOURCE_STATE_INVALID:${extensionResponse.sources.map((source) => `${source.source}=${source.state}:${source.message ?? "none"}`).join(",")}`
      );
      invariant(extensionResponse.results.length <= 50, `${SUITE}_EXTENSION_RESULT_CAP_EXCEEDED`);
      const sourceProbes = await Promise.all(([
        ["PARENT_MEETINGS", `${target}-PM-0000`],
        ["TRANSPORT", `${target}-ROUTE-000`],
        ["CAFETERIA", `${target}-ITEM-000`],
        ["KG_REPORTS", `${target}-KG-REPORT-0000`],
        ["EVENT_MEDIA", `${target}-ALBUM-0000`]
      ] as const).map(async ([source, query]) => runUniversalSearch(
        client,
        { id: superA.id, role: "SUPER_ADMIN" },
        parseUniversalSearchRequest({ query, sources: [source], limit: 6 })
      )));
      invariant(sourceProbes.every((response) => response.results.length > 0 && response.sources[0]?.state === "OK"), `${SUITE}_EXTENSION_SOURCE_COVERAGE_INCOMPLETE`);
      invariant(sourceProbes.every((response) => JSON.stringify(response).includes("<script>search-extension-xss")), `${SUITE}_EXTENSION_XSS_SAFE_FIELD_FIXTURE_MISSING`);
      invariant(!Object.values(extensionEvidence.forbidden).some((value) => JSON.stringify([extensionResponse, sourceProbes]).includes(value)), `${SUITE}_EXTENSION_FORBIDDEN_VALUE_LEAKED`);
      for (const [source, query] of [
        ["PARENT_MEETINGS", extensionEvidence.forbidden.parent],
        ["TRANSPORT", extensionEvidence.forbidden.driver],
        ["CAFETERIA", extensionEvidence.forbidden.diet],
        ["KG_REPORTS", extensionEvidence.forbidden.kg],
        ["EVENT_MEDIA", extensionEvidence.forbidden.media]
      ] as const) {
        const sentinelResponse = await runUniversalSearch(client, { id: superA.id, role: "SUPER_ADMIN" }, parseUniversalSearchRequest({ query, sources: [source], limit: 6 }));
        invariant(sentinelResponse.results.length === 0 && sentinelResponse.sources[0]?.state === "EMPTY", `${SUITE}_${source}_SENTINEL_MATCHED`);
      }
    }

    stage = "performance";
    const measured = new PrismaClient({ datasourceUrl: databaseUrl(copiedDatabase), log: [{ emit: "event", level: "query" }] });
    let queryCount = 0;
    measured.$on("query", (_event: Prisma.QueryEvent) => { queryCount += 1; });
    const request = parseUniversalSearchRequest({ query: target, limit: 50 });
    const times: number[] = [];
    const counts: number[] = [];
    const heapBefore = process.memoryUsage().heapUsed;
    try {
      await runUniversalSearch(measured, { id: superA.id, role: "SUPER_ADMIN" }, request);
      // A timed-out Prisma read cannot be cancelled. Let any cold-start read settle
      // before measuring steady-state query counts so it is not charged to the next run.
      await new Promise((resolve) => setTimeout(resolve, 800));
      queryCount = 0;
      for (let index = 0; index < 25; index += 1) {
        const beforeQueries = queryCount;
        const started = performance.now();
        const response = await runUniversalSearch(measured, { id: superA.id, role: "SUPER_ADMIN" }, request);
        times.push(performance.now() - started);
        counts.push(queryCount - beforeQueries);
        invariant(response.results.length <= 50 && response.total <= 50, `${SUITE}_CLIENT_RESULT_BOUND_FAILED`);
        invariant(response.sources.filter((source) => source.state === "TIMEOUT").length === 0, `${SUITE}_SOURCE_TIMEOUT_UNEXPECTED`);
      }
    } finally {
      await measured.$disconnect();
    }
    const p95Ms = percentile(times, .95);
    const maximumMs = Math.max(...times);
    const heapGrowth = process.memoryUsage().heapUsed - heapBefore;
    invariant(p95Ms <= 1_500, `${SUITE}_P95_EXCEEDED:${p95Ms.toFixed(2)}`);
    invariant(maximumMs <= 2_000, `${SUITE}_HARD_CEILING_EXCEEDED:${maximumMs.toFixed(2)}`);
    invariant(Math.max(...counts) <= (extension ? 48 : 20), `${SUITE}_QUERY_BOUND_EXCEEDED:${Math.max(...counts)}`);
    invariant(heapGrowth < 160 * 1024 * 1024, `${SUITE}_HEAP_GROWTH_EXCEEDED:${heapGrowth}`);

    stage = "operational integrity";
    const operationalAfter = { sha256: sha256(operational), size: statSync(operational).size };
    invariant(JSON.stringify(operationalBefore) === JSON.stringify(operationalAfter), `${SUITE}_OPERATIONAL_DATABASE_CHANGED`);
    const credentials = { databaseUrl: databaseUrl(copiedDatabase), password: browserCredentialValue, superA: { username: superA.username }, superB: { username: superB.username }, principal: { username: principal.username } };
    writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2), { flag: "wx" });
    console.log(JSON.stringify({
      result: `${SUITE}_COPIED_DATABASE_VERIFIED`, operationalBefore, operationalAfter,
      volume: { students: 1_200, guardians: 600, staff: 320, admissions: 360, diary: 432, tasks: 1_512, contacts: 532, fees: 240, exams: 140, support: 120, safeExit: 80 },
      extension: extensionEvidence ? { coverage: ["PARENT_MEETINGS", "TRANSPORT", "CAFETERIA", "KG_REPORTS", "EVENT_MEDIA"], coverageDecision: "SAFE_METADATA_ONLY", forbiddenSentinelsExcluded: true, volume: extensionEvidence.volume } : null,
      ownerIsolation: true, resultLimit: 50, maximumQueriesPerRequest: Math.max(...counts), p95Ms: Number(p95Ms.toFixed(2)), maximumMs: Number(maximumMs.toFixed(2)),
      heapGrowthBytes: heapGrowth, copiedDatabaseRetained: keep, credentialsPath: keep ? credentialsPath : null
    }));
  } finally {
    await client.$disconnect();
    if (!keep) cleanup();
  }
}

async function setObservabilityDegraded(degraded: boolean) {
  invariant(existsSync(credentialsPath), `${SUITE}_BROWSER_CREDENTIALS_MISSING`);
  const credentials = JSON.parse(readFileSync(credentialsPath, "utf8")) as { databaseUrl?: string };
  invariant(typeof credentials.databaseUrl === "string", `${SUITE}_BROWSER_DATABASE_URL_MISSING`);
  const copiedPath = path.resolve(credentials.databaseUrl.replace(/^file:/, ""));
  invariant(copiedPath === path.resolve(copiedDatabase), `${SUITE}_BROWSER_DATABASE_SCOPE_REFUSED`);
  const client = new PrismaClient({ datasourceUrl: credentials.databaseUrl });
  try {
    const active = "OperationalAlert";
    const held = "OperationalAlertUniversalSearchQaHeld";
    const rows = await client.$queryRawUnsafe<Array<{ name: string }>>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (?, ?)",
      active,
      held
    );
    const names = new Set(rows.map((row) => row.name));
    if (degraded && names.has(active) && !names.has(held)) {
      await client.$executeRawUnsafe(`ALTER TABLE "${active}" RENAME TO "${held}"`);
    } else if (!degraded && names.has(held) && !names.has(active)) {
      await client.$executeRawUnsafe(`ALTER TABLE "${held}" RENAME TO "${active}"`);
    }
    console.log(JSON.stringify({ result: degraded ? `${SUITE}_OBSERVABILITY_DEGRADED` : `${SUITE}_OBSERVABILITY_RESTORED` }));
  } finally {
    await client.$disconnect();
  }
}

async function verifyBrowserCredentials() {
  invariant(existsSync(credentialsPath), `${SUITE}_BROWSER_CREDENTIALS_MISSING`);
  const credentials = JSON.parse(readFileSync(credentialsPath, "utf8")) as { databaseUrl?: string; password?: string; superA?: { username?: string } };
  invariant(typeof credentials.databaseUrl === "string" && typeof credentials.password === "string" && typeof credentials.superA?.username === "string", `${SUITE}_BROWSER_CREDENTIALS_INVALID`);
  const client = new PrismaClient({ datasourceUrl: credentials.databaseUrl });
  try {
    const resolved = await resolveLoginIdentifier(client, credentials.superA.username);
    invariant(resolved.kind === "resolved", `${SUITE}_BROWSER_IDENTIFIER_NOT_RESOLVED`);
    invariant(await verifyPassword(credentials.password, resolved.user.passwordHash), `${SUITE}_BROWSER_PASSWORD_NOT_VERIFIED`);
    console.log(JSON.stringify({ result: `${SUITE}_BROWSER_CREDENTIALS_VERIFIED` }));
  } finally {
    await client.$disconnect();
  }
}

async function runBrowserCookieBridge() {
  invariant(existsSync(credentialsPath), `${SUITE}_BROWSER_CREDENTIALS_MISSING`);
  const credentials = JSON.parse(readFileSync(credentialsPath, "utf8")) as {
    password?: string;
    superA?: { username?: string };
    principal?: { username?: string };
  };
  invariant(typeof credentials.password === "string" && typeof credentials.superA?.username === "string" && typeof credentials.principal?.username === "string", `${SUITE}_BROWSER_CREDENTIALS_INVALID`);
  const actors = { "super-a": credentials.superA.username, principal: credentials.principal.username } as const;
  const bridge = createServer(async (request, response) => {
    try {
      const actor = request.url === "/principal" ? "principal" : request.url === "/super-a" ? "super-a" : null;
      if (!actor) {
        response.writeHead(404, { "cache-control": "no-store" }).end("Not found");
        return;
      }
      const login = await fetch("http://127.0.0.1:3108/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json", "user-agent": `${SUITE} copied-database browser bridge` },
        body: JSON.stringify({ identifier: actors[actor], password: credentials.password })
      });
      const cookie = login.headers.get("set-cookie");
      invariant(login.ok && cookie, `${SUITE}_BROWSER_BRIDGE_LOGIN_FAILED`);
      response.writeHead(302, {
        "cache-control": "no-store",
        "set-cookie": cookie,
        location: actor === "principal" ? "http://127.0.0.1:3108/super-admin/search" : "http://127.0.0.1:3108/dashboard"
      }).end();
    } catch {
      response.writeHead(502, { "cache-control": "no-store" }).end("QA bridge unavailable");
    }
  });
  bridge.listen(3109, "127.0.0.1", () => console.log(JSON.stringify({ result: `${SUITE}_BROWSER_COOKIE_BRIDGE_READY`, port: 3109 })));
}

if (process.argv.includes("cleanup")) {
  cleanup();
  console.log(JSON.stringify({ result: `${SUITE}_CLEANUP_COMPLETE`, exists: existsSync(root) }));
} else if (process.argv.includes("degrade-observability")) {
  setObservabilityDegraded(true).catch((error) => {
    console.error(`${SUITE}_OBSERVABILITY_DEGRADE_FAILED:${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
} else if (process.argv.includes("restore-observability")) {
  setObservabilityDegraded(false).catch((error) => {
    console.error(`${SUITE}_OBSERVABILITY_RESTORE_FAILED:${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
} else if (process.argv.includes("verify-browser-credentials")) {
  verifyBrowserCredentials().catch((error) => {
    console.error(`${SUITE}_BROWSER_CREDENTIAL_VERIFY_FAILED:${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
} else if (process.argv.includes("browser-cookie-bridge")) {
  runBrowserCookieBridge().catch((error) => {
    console.error(`${SUITE}_BROWSER_COOKIE_BRIDGE_FAILED:${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
} else {
  main().catch((error) => {
    console.error(`${stage}: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
