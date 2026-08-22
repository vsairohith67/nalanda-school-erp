import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import {
  addTransportRouteStop,
  assignTransportStudent,
  createTransportRoute,
  createTransportStop,
  createTransportVehicle,
  parentTransportView,
  transportReport,
  transportReportCsv,
  transportWorkspace,
  updateTransportRoute,
  updateTransportStop,
  updateTransportVehicle,
} from "../lib/transport";
import {
  cafeteriaReport,
  cafeteriaReportCsv,
  cafeteriaWorkspace,
  createCafeteriaItem,
  createCafeteriaMenu,
  enrollCafeteriaStudent,
  parentCafeteriaView,
  recordCafeteriaMeal,
  updateCafeteriaItem,
} from "../lib/cafeteria";
import { PERMISSIONS } from "../lib/permissions";
import { hashPassword } from "../lib/password";
import {
  loadOptionalOperationsBackup,
  restoreOptionalOperationsBackup,
} from "../lib/optional-operations-backup";
import {
  cleanupIsolatedDatabase,
  createEmptyIsolatedDatabase,
  databaseUrl,
  runPrisma,
} from "./migration-check-utils";

type Seeded = Awaited<ReturnType<typeof seedSyntheticBase>>;
const SYNTHETIC_PASSWORD = "OptionalOps-Synthetic-2026!";

function invariant(value: unknown, code: string): asserts value {
  if (!value) throw new Error(code);
}

async function expectCode(action: () => Promise<unknown>, code: string) {
  try {
    await action();
  } catch (error) {
    invariant((error as { code?: string }).code === code, `EXPECTED_${code}_GOT_${(error as { code?: string }).code ?? "UNKNOWN"}`);
    return;
  }
  throw new Error(`EXPECTED_${code}`);
}

async function seedSyntheticBase(client: PrismaClient, prefix: string) {
  const passwordHash = await hashPassword(SYNTHETIC_PASSWORD);
  const admin = await client.user.create({
    data: {
      name: "Optional Operations Synthetic Admin",
      iamPublicKey: randomUUID(),
      username: `${prefix.toLowerCase()}-admin`,
      passwordHash,
      role: "SUPER_ADMIN",
    },
  });
  await client.userRoleAssignment.create({ data: { userId: admin.id, role: "SUPER_ADMIN", reason: "Optional Operations synthetic QA", activeKey: `${prefix}:SUPER_ADMIN` } });
  await client.authLoginAlias.create({ data: { userId: admin.id, type: "USERNAME", normalizedValue: admin.username, displayMasked: admin.username, status: "VERIFIED", isSchoolGoverned: true, verifiedAt: new Date() } });
  const guardian = await client.guardian.create({
    data: { displayName: "Synthetic Guardian", primaryMobile: "9000000000" },
  });
  const parent = await client.user.create({
    data: {
      name: "Optional Operations Synthetic Parent",
      iamPublicKey: randomUUID(),
      username: `${prefix.toLowerCase()}-parent`,
      passwordHash,
      role: "PARENT",
      guardianId: guardian.id,
    },
  });
  await client.userRoleAssignment.create({ data: { userId: parent.id, role: "PARENT", reason: "Optional Operations synthetic QA", activeKey: `${prefix}:PARENT` } });
  await client.authLoginAlias.create({ data: { userId: parent.id, type: "USERNAME", normalizedValue: parent.username, displayMasked: parent.username, status: "VERIFIED", isSchoolGoverned: true, verifiedAt: new Date() } });
  const staff = await client.staffMember.create({
    data: {
      staffCode: `${prefix}-OPS-01`,
      fullName: "Synthetic Operations Reference",
      designation: "Operations Reference",
      staffType: "NON_TEACHING",
    },
  });
  const students = [];
  for (let index = 1; index <= 6; index += 1) {
    students.push(await client.student.create({
      data: {
        admissionNo: `${prefix}-S${index}`,
        studentName: index === 1 ? "=Synthetic Formula Student" : `Synthetic Student ${index}`,
        fatherName: "Synthetic Parent",
        className: "V",
        section: "A",
        phone1: `90000000${index.toString().padStart(2, "0")}`,
        address: `Synthetic private address ${index}`,
      },
    }));
  }
  await client.studentGuardian.create({ data: { guardianId: guardian.id, studentId: students[0].id, isPrimaryContact: true } });
  return { admin, guardian, parent, staff, students };
}

function adminActor(seed: Seeded) {
  return { id: seed.admin.id, role: "SUPER_ADMIN" as const, permissions: new Set<string>(PERMISSIONS) };
}

async function protectedModuleCounts(client: PrismaClient) {
  const [payments, cashDays, cashMovements, marks, attendance, departures] = await Promise.all([
    client.payment.count(),
    client.cashBookDay.count(),
    client.cashBookMovement.count(),
    client.studentMark.count(),
    client.studentAttendanceRecord.count(),
    client.studentDepartureRequest.count(),
  ]);
  return { payments, cashDays, cashMovements, marks, attendance, departures };
}

async function exerciseTransport(client: PrismaClient, seed: Seeded) {
  const actor = adminActor(seed);
  await expectCode(() => createTransportVehicle(client, actor, { registrationCode: "BAD-0", displayName: "Invalid", capacity: 0 }), "TRANSPORT_INVALID");
  const vehicleA = await createTransportVehicle(client, actor, { registrationCode: "SYN-001", displayName: "Synthetic Bus A", capacity: 2 });
  const vehicleB = await createTransportVehicle(client, actor, { registrationCode: "SYN-002", displayName: "Synthetic Bus B", capacity: 1 });
  const inactiveVehicle = await createTransportVehicle(client, actor, { registrationCode: "SYN-003", displayName: "Synthetic Inactive Bus", capacity: 2, status: "INACTIVE" });
  invariant(inactiveVehicle.status === "INACTIVE", "TRANSPORT_INACTIVE_VEHICLE_CREATE");
  await expectCode(() => createTransportRoute(client, actor, { code: "BAD-INACTIVE", name: "Inactive vehicle route", vehicleKey: inactiveVehicle.publicKey, capacity: 1 }), "TRANSPORT_VEHICLE_INACTIVE");

  const stopA = await createTransportStop(client, actor, { code: "STOP-A", name: "Approved Gate A", approvedReference: "Main gate only" });
  const stopB = await createTransportStop(client, actor, { code: "STOP-B", name: "Approved Gate B", approvedReference: "Library gate only" });
  const stopC = await createTransportStop(client, actor, { code: "STOP-C", name: "Approved Gate C" });
  const inactiveStop = await createTransportStop(client, actor, { code: "STOP-X", name: "Inactive Synthetic Stop", active: false });

  const routeA = await createTransportRoute(client, actor, { code: "R-A", name: "Synthetic Route A", directionMode: "BOTH", vehicleKey: vehicleA.publicKey, driverStaffCode: seed.staff.staffCode, attendantStaffCode: seed.staff.staffCode, capacity: 2 });
  const routeB = await createTransportRoute(client, actor, { code: "R-B", name: "Synthetic Route B", directionMode: "BOTH", vehicleKey: vehicleB.publicKey, capacity: 1 });
  const routeC = await createTransportRoute(client, actor, { code: "R-C", name: "Synthetic Route C", directionMode: "BOTH", vehicleKey: vehicleA.publicKey, capacity: 2 });
  const aPickup = await addTransportRouteStop(client, actor, { routeKey: routeA.publicKey, stopKey: stopA.publicKey, direction: "MORNING", sequence: 1, timingReference: "07:30 approved" });
  const aDrop = await addTransportRouteStop(client, actor, { routeKey: routeA.publicKey, stopKey: stopB.publicKey, direction: "EVENING", sequence: 1, timingReference: "16:00 approved" });
  const bPickup = await addTransportRouteStop(client, actor, { routeKey: routeB.publicKey, stopKey: stopB.publicKey, direction: "MORNING", sequence: 1 });
  const bDrop = await addTransportRouteStop(client, actor, { routeKey: routeB.publicKey, stopKey: stopC.publicKey, direction: "EVENING", sequence: 1 });
  const cPickup = await addTransportRouteStop(client, actor, { routeKey: routeC.publicKey, stopKey: stopC.publicKey, direction: "MORNING", sequence: 1 });
  const cDrop = await addTransportRouteStop(client, actor, { routeKey: routeC.publicKey, stopKey: stopA.publicKey, direction: "EVENING", sequence: 1 });
  await expectCode(() => addTransportRouteStop(client, actor, { routeKey: routeA.publicKey, stopKey: inactiveStop.publicKey, direction: "MORNING", sequence: 2 }), "TRANSPORT_STOP_INACTIVE");
  await expectCode(() => addTransportRouteStop(client, actor, { routeKey: routeA.publicKey, stopKey: stopA.publicKey, direction: "MORNING", sequence: 1 }), "TRANSPORT_DUPLICATE");

  const first = await assignTransportStudent(client, actor, { admissionNo: seed.students[0].admissionNo, routeKey: routeA.publicKey, pickupRouteStopKey: aPickup.publicKey, dropRouteStopKey: aDrop.publicKey, effectiveFrom: "2026-08-01", changeReason: "Synthetic initial assignment" });
  await assignTransportStudent(client, actor, { admissionNo: seed.students[1].admissionNo, routeKey: routeA.publicKey, pickupRouteStopKey: aPickup.publicKey, dropRouteStopKey: aDrop.publicKey, effectiveFrom: "2026-08-01", changeReason: "Synthetic capacity edge" });
  await expectCode(() => assignTransportStudent(client, actor, { admissionNo: seed.students[0].admissionNo, routeKey: routeA.publicKey, pickupRouteStopKey: aPickup.publicKey, dropRouteStopKey: aDrop.publicKey, effectiveFrom: "2026-08-01", changeReason: "Synthetic duplicate attempt" }), "TRANSPORT_EFFECTIVE_DATE_CONFLICT");
  await expectCode(() => assignTransportStudent(client, actor, { admissionNo: seed.students[2].admissionNo, routeKey: routeA.publicKey, pickupRouteStopKey: aPickup.publicKey, dropRouteStopKey: aDrop.publicKey, effectiveFrom: "2026-08-01", changeReason: "Synthetic over allocation" }), "TRANSPORT_CAPACITY_FULL");
  await expectCode(() => assignTransportStudent(client, actor, { admissionNo: seed.students[2].admissionNo, routeKey: routeA.publicKey, pickupRouteStopKey: bPickup.publicKey, dropRouteStopKey: aDrop.publicKey, effectiveFrom: "2026-08-01", changeReason: "Synthetic foreign key substitution" }), "TRANSPORT_PICKUP_INVALID");

  const concurrent = await Promise.allSettled([2, 3].map((index) => assignTransportStudent(client, actor, { admissionNo: seed.students[index].admissionNo, routeKey: routeB.publicKey, pickupRouteStopKey: bPickup.publicKey, dropRouteStopKey: bDrop.publicKey, effectiveFrom: "2026-08-01", changeReason: "Synthetic concurrent assignment" })));
  invariant(concurrent.filter((result) => result.status === "fulfilled").length === 1, "TRANSPORT_CONCURRENT_CAPACITY_RESULT");
  invariant(await client.transportStudentAssignment.count({ where: { routeId: routeB.id, active: true } }) === 1, "TRANSPORT_CONCURRENT_CAPACITY_COUNT");

  await expectCode(() => assignTransportStudent(client, actor, { admissionNo: seed.students[0].admissionNo, routeKey: routeC.publicKey, pickupRouteStopKey: cPickup.publicKey, dropRouteStopKey: cDrop.publicKey, effectiveFrom: "2026-08-10", changeReason: "Synthetic stale reassignment" }), "TRANSPORT_STALE_ASSIGNMENT");
  const reassigned = await assignTransportStudent(client, actor, { admissionNo: seed.students[0].admissionNo, routeKey: routeC.publicKey, pickupRouteStopKey: cPickup.publicKey, dropRouteStopKey: cDrop.publicKey, effectiveFrom: "2026-08-10", changeReason: "Synthetic effective-dated reassignment", expectedCurrentAssignmentKey: first.publicKey, expectedCurrentVersion: first.version });
  invariant(reassigned.replacesAssignmentId === first.id, "TRANSPORT_REASSIGNMENT_LINK");
  invariant(await client.transportStudentAssignment.count({ where: { studentId: seed.students[0].id } }) === 2, "TRANSPORT_HISTORY_RETAINED");
  invariant(await client.transportStudentAssignment.count({ where: { activeStudentId: seed.students[0].id } }) === 1, "TRANSPORT_ONE_ACTIVE_CONFIGURATION");
  const renamedRoute = await updateTransportRoute(client, actor, { publicKey: routeC.publicKey, expectedVersion: 1, name: "Renamed Current Route" });
  await updateTransportStop(client, actor, { publicKey: stopC.publicKey, expectedVersion: 1, name: "Renamed Current Stop" });
  await expectCode(() => updateTransportStop(client, actor, { publicKey: stopC.publicKey, expectedVersion: 2, active: false }), "TRANSPORT_STOP_IN_USE");
  await expectCode(() => updateTransportRoute(client, actor, { publicKey: routeC.publicKey, expectedVersion: renamedRoute.version, status: "INACTIVE" }), "TRANSPORT_ROUTE_IN_USE");
  await expectCode(() => updateTransportVehicle(client, actor, { publicKey: vehicleA.publicKey, expectedVersion: 1, status: "INACTIVE" }), "TRANSPORT_VEHICLE_IN_USE");

  const concurrentReassignment = await Promise.allSettled([0, 1].map(() => assignTransportStudent(client, actor, { admissionNo: seed.students[0].admissionNo, routeKey: routeA.publicKey, pickupRouteStopKey: aPickup.publicKey, dropRouteStopKey: aDrop.publicKey, effectiveFrom: "2026-09-01", changeReason: "Synthetic concurrent reassignment", expectedCurrentAssignmentKey: reassigned.publicKey, expectedCurrentVersion: reassigned.version })));
  invariant(concurrentReassignment.filter((result) => result.status === "fulfilled").length === 1, "TRANSPORT_CONCURRENT_REASSIGNMENT_RESULT");

  const parentActor = { id: seed.parent.id, role: "PARENT" as const, permissions: new Set<string>(["VIEW_OWN_CHILD_TRANSPORT"]) };
  const parentView = await parentTransportView(client, parentActor, seed.students[0].admissionNo);
  invariant(parentView.children.length === 1 && JSON.stringify(parentView).includes("Synthetic Route C") && JSON.stringify(parentView).includes("Approved Gate C") && !JSON.stringify(parentView).includes("Renamed Current"), "TRANSPORT_PARENT_LINKED_CHILD_SNAPSHOT");
  await expectCode(() => parentTransportView(client, parentActor, seed.students[1].admissionNo), "TRANSPORT_CHILD_NOT_FOUND");
  await expectCode(() => createTransportVehicle(client, { ...parentActor, permissions: new Set<string>(PERMISSIONS) }, { registrationCode: "PARENT-BYPASS", displayName: "Parent bypass", capacity: 1 }), "TRANSPORT_FORBIDDEN");
  await expectCode(() => createTransportVehicle(client, { id: seed.parent.id, role: "STUDENT", permissions: new Set<string>(PERMISSIONS) }, { registrationCode: "STUDENT-BYPASS", displayName: "Student bypass", capacity: 1 }), "TRANSPORT_FORBIDDEN");

  const viewOnlyActor = { id: seed.admin.id, role: "PRINCIPAL" as const, permissions: new Set<string>(["VIEW_TRANSPORT", "VIEW_TRANSPORT_REPORTS"]) };
  const viewOnlyWorkspace = await transportWorkspace(client, viewOnlyActor);
  invariant(viewOnlyWorkspace.students.length === 0 && viewOnlyWorkspace.staff.length === 0 && !JSON.stringify(viewOnlyWorkspace).includes("changeReason") && !JSON.stringify(viewOnlyWorkspace).includes("createdByUserId"), "TRANSPORT_VIEW_ONLY_PRIVACY");
  await expectCode(() => transportReport(client, viewOnlyActor), "TRANSPORT_FORBIDDEN");

  const report = await transportReport(client, actor);
  const reportJson = JSON.stringify(report.rows);
  invariant(reportJson.includes("Synthetic Route C") && !reportJson.includes("Renamed Current Route"), "TRANSPORT_EFFECTIVE_AS_OF_AND_SNAPSHOT_REPORT");
  invariant(!/private address|phone1|9000000/i.test(reportJson), "TRANSPORT_REPORT_PRIVACY");
  invariant(transportReportCsv(report).includes("\"'=Synthetic Formula Student\""), "TRANSPORT_CSV_FORMULA_NEUTRALIZATION");
  return { vehicles: 3, routes: 3, activeAssignments: await client.transportStudentAssignment.count({ where: { active: true } }) };
}

async function exerciseCafeteria(client: PrismaClient, seed: Seeded) {
  const actor = adminActor(seed);
  const itemA = await createCafeteriaItem(client, actor, { code: "MEAL-A", name: "Synthetic Meal A", category: "Lunch" });
  const itemB = await createCafeteriaItem(client, actor, { code: "MEAL-B", name: "Synthetic Meal B", category: "Snack" });
  const itemInactive = await createCafeteriaItem(client, actor, { code: "MEAL-X", name: "Unavailable Synthetic Meal", category: "Lunch", available: false });
  await expectCode(() => createCafeteriaItem(client, actor, { code: "MEAL-A", name: "Duplicate Meal", category: "Lunch" }), "CAFETERIA_DUPLICATE");
  await expectCode(() => createCafeteriaMenu(client, actor, { menuDate: "2026-08-22", mealPlanName: "Invalid", items: [{ itemKey: itemInactive.publicKey, mealSlot: "LUNCH" }] }), "CAFETERIA_ITEM_INACTIVE");
  const menu = await createCafeteriaMenu(client, actor, { menuDate: "2026-08-22", mealPlanName: "Standard", items: [{ itemKey: itemA.publicKey, mealSlot: "LUNCH" }, { itemKey: itemB.publicKey, mealSlot: "SNACK" }] });
  const alternateMenu = await createCafeteriaMenu(client, actor, { menuDate: "2026-08-22", mealPlanName: "PLAN-B", items: [{ itemKey: itemA.publicKey, mealSlot: "LUNCH" }] });
  await expectCode(() => createCafeteriaMenu(client, actor, { menuDate: "2026-08-22", mealPlanName: "Standard", items: [{ itemKey: itemA.publicKey, mealSlot: "LUNCH" }] }), "CAFETERIA_DUPLICATE");

  await expectCode(() => enrollCafeteriaStudent(client, actor, { admissionNo: seed.students[1].admissionNo, mealPlanName: "MEDICAL-DIET", effectiveFrom: "2026-08-01", changeReason: "INITIAL_OPT_IN" }), "CAFETERIA_HEALTH_DATA_PROHIBITED");
  const firstEnrollment = await enrollCafeteriaStudent(client, actor, { admissionNo: seed.students[0].admissionNo, mealPlanName: "Standard", effectiveFrom: "2026-08-01", changeReason: "INITIAL_OPT_IN" });
  await expectCode(() => enrollCafeteriaStudent(client, actor, { admissionNo: seed.students[0].admissionNo, mealPlanName: "Standard", effectiveFrom: "2026-08-01", changeReason: "INITIAL_OPT_IN" }), "CAFETERIA_EFFECTIVE_DATE_CONFLICT");
  const lunch = menu.items.find((entry: { mealSlot: string }) => entry.mealSlot === "LUNCH");
  invariant(lunch, "CAFETERIA_LUNCH_MENU_ITEM");
  await recordCafeteriaMeal(client, actor, { admissionNo: seed.students[0].admissionNo, menuItemKey: lunch.publicKey, serviceDate: "2026-08-22", mealSlot: "LUNCH", recordType: "PARTICIPATION", idempotencyKey: "optional-ops-meal-001" });
  const alternateLunch = alternateMenu.items.find((entry: { mealSlot: string }) => entry.mealSlot === "LUNCH");
  invariant(alternateLunch, "CAFETERIA_ALTERNATE_LUNCH_MENU_ITEM");
  await expectCode(() => recordCafeteriaMeal(client, actor, { admissionNo: seed.students[0].admissionNo, menuItemKey: alternateLunch.publicKey, serviceDate: "2026-08-22", mealSlot: "LUNCH", recordType: "ORDER", idempotencyKey: "optional-ops-plan-002" }), "CAFETERIA_MEAL_PLAN_MISMATCH");
  await expectCode(() => recordCafeteriaMeal(client, actor, { admissionNo: seed.students[0].admissionNo, menuItemKey: lunch.publicKey, serviceDate: "2026-08-22", mealSlot: "LUNCH", recordType: "PARTICIPATION", idempotencyKey: "optional-ops-meal-001" }), "CAFETERIA_DUPLICATE");
  await expectCode(() => recordCafeteriaMeal(client, actor, { admissionNo: seed.students[0].admissionNo, menuItemKey: lunch.publicKey, serviceDate: "2026-08-23", mealSlot: "LUNCH", recordType: "ORDER", idempotencyKey: "optional-ops-date-002" }), "CAFETERIA_MENU_ITEM_UNAVAILABLE");
  await updateCafeteriaItem(client, actor, { publicKey: itemB.publicKey, expectedVersion: 1, status: "INACTIVE", available: false });
  await expectCode(() => enrollCafeteriaStudent(client, actor, { admissionNo: seed.students[0].admissionNo, mealPlanName: "Standard", effectiveFrom: "2026-09-01", changeReason: "PLAN_CHANGE" }), "CAFETERIA_STALE_ENROLLMENT");
  await enrollCafeteriaStudent(client, actor, { admissionNo: seed.students[0].admissionNo, mealPlanName: "Standard", effectiveFrom: "2026-09-01", changeReason: "PLAN_CHANGE", expectedCurrentEnrollmentKey: firstEnrollment.publicKey, expectedCurrentVersion: firstEnrollment.version });
  invariant(await client.cafeteriaStudentEnrollment.count({ where: { studentId: seed.students[0].id } }) === 2, "CAFETERIA_HISTORY_RETAINED");
  invariant(await client.cafeteriaStudentEnrollment.count({ where: { activeStudentId: seed.students[0].id } }) === 1, "CAFETERIA_ONE_ACTIVE_CONFIGURATION");

  const parentActor = { id: seed.parent.id, role: "PARENT" as const, permissions: new Set<string>(["VIEW_OWN_CHILD_CAFETERIA"]) };
  const parentView = await parentCafeteriaView(client, parentActor, seed.students[0].admissionNo);
  invariant(parentView.children.length === 1, "CAFETERIA_PARENT_LINKED_CHILD");
  await expectCode(() => parentCafeteriaView(client, parentActor, seed.students[1].admissionNo), "CAFETERIA_CHILD_NOT_FOUND");
  await expectCode(() => createCafeteriaItem(client, { ...parentActor, permissions: new Set<string>(PERMISSIONS) }, { code: "PARENT-BYPASS", name: "Parent bypass", category: "Invalid" }), "CAFETERIA_FORBIDDEN");
  await expectCode(() => createCafeteriaItem(client, { id: seed.parent.id, role: "STUDENT", permissions: new Set<string>(PERMISSIONS) }, { code: "STUDENT-BYPASS", name: "Student bypass", category: "Invalid" }), "CAFETERIA_FORBIDDEN");

  const viewOnlyActor = { id: seed.admin.id, role: "PRINCIPAL" as const, permissions: new Set<string>(["VIEW_CAFETERIA", "VIEW_CAFETERIA_REPORTS"]) };
  const viewOnlyWorkspace = await cafeteriaWorkspace(client, viewOnlyActor);
  invariant(viewOnlyWorkspace.students.length === 0 && !JSON.stringify(viewOnlyWorkspace).includes("idempotencyKey") && !JSON.stringify(viewOnlyWorkspace).includes("recordedByUserId") && !JSON.stringify(viewOnlyWorkspace).includes("changeReason"), "CAFETERIA_VIEW_ONLY_PRIVACY");
  await expectCode(() => cafeteriaReport(client, viewOnlyActor), "CAFETERIA_FORBIDDEN");

  const report = await cafeteriaReport(client, actor);
  const reportJson = JSON.stringify(report.rows);
  invariant(!/diagnosis|dietary|payment|wallet|private address|phone1/i.test(reportJson), "CAFETERIA_REPORT_PRIVACY");
  invariant(cafeteriaReportCsv(report).includes("\"'=Synthetic Formula Student\""), "CAFETERIA_CSV_FORMULA_NEUTRALIZATION");
  return { catalogItems: 3, menus: 2, mealRecords: report.rows.length };
}

async function verifyBackupRestore(source: PrismaClient, target: PrismaClient, sourceSeed: Seeded, targetSeed: Seeded) {
  const optionalBackup = await loadOptionalOperationsBackup(source);
  invariant(optionalBackup.transportVehicles.length === 3 && optionalBackup.cafeteriaMenus.length === 2, "OPTIONAL_OPS_BACKUP_COUNTS");
  invariant(!JSON.stringify(optionalBackup).includes("actorUserId"), "OPTIONAL_OPS_BACKUP_ACTOR_PRIVACY");
  const students = await source.student.findMany({ select: { id: true, admissionNo: true } });
  const staffMembers = await source.staffMember.findMany({ select: { id: true, staffCode: true } });
  const first = await restoreOptionalOperationsBackup(target, { ...optionalBackup, students, staffMembers }, { id: targetSeed.admin.id });
  invariant(Object.values(first).every((entry) => entry.errors.length === 0), "OPTIONAL_OPS_RESTORE_ERRORS");
  const countsAfterFirst = {
    vehicles: await target.transportVehicle.count(),
    assignments: await target.transportStudentAssignment.count(),
    meals: await target.cafeteriaMealRecord.count(),
    transportAudits: await target.transportAuditEvent.count(),
    cafeteriaAudits: await target.cafeteriaAuditEvent.count(),
  };
  const second = await restoreOptionalOperationsBackup(target, { ...optionalBackup, students, staffMembers }, { id: targetSeed.admin.id });
  invariant(Object.values(second).every((entry) => entry.errors.length === 0), "OPTIONAL_OPS_SECOND_RESTORE_ERRORS");
  const countsAfterSecond = {
    vehicles: await target.transportVehicle.count(),
    assignments: await target.transportStudentAssignment.count(),
    meals: await target.cafeteriaMealRecord.count(),
    transportAudits: await target.transportAuditEvent.count(),
    cafeteriaAudits: await target.cafeteriaAuditEvent.count(),
  };
  invariant(JSON.stringify(countsAfterFirst) === JSON.stringify(countsAfterSecond), "OPTIONAL_OPS_RESTORE_NOT_IDEMPOTENT");
  const foreignKeys = await target.$queryRawUnsafe<unknown[]>("PRAGMA foreign_key_check");
  invariant(foreignKeys.length === 0, "OPTIONAL_OPS_RESTORE_FOREIGN_KEYS");
  invariant(sourceSeed.students.length === targetSeed.students.length, "OPTIONAL_OPS_SYNTHETIC_BASE_MISMATCH");
  return countsAfterSecond;
}

async function verifyRestoreSubstitution(source: PrismaClient, target: PrismaClient, targetSeed: Seeded) {
  const backup = await loadOptionalOperationsBackup(source);
  const corrupted = structuredClone(backup);
  const assignment = corrupted.transportStudentAssignments[0];
  const substitutedPickup = corrupted.transportRouteStops.find((row) => row.routeId !== assignment.routeId && row.direction === "MORNING");
  invariant(substitutedPickup, "TRANSPORT_RESTORE_SUBSTITUTION_FIXTURE");
  assignment.pickupRouteStopId = substitutedPickup.id;
  const meal = corrupted.cafeteriaMealRecords[0];
  const substitutedEnrollment = corrupted.cafeteriaStudentEnrollments.find((row) => row.id !== meal.enrollmentId);
  invariant(substitutedEnrollment, "CAFETERIA_RESTORE_SUBSTITUTION_FIXTURE");
  meal.enrollmentId = substitutedEnrollment.id;
  const students = await source.student.findMany({ select: { id: true, admissionNo: true } });
  const staffMembers = await source.staffMember.findMany({ select: { id: true, staffCode: true } });
  const rejected = await restoreOptionalOperationsBackup(target, { ...corrupted, students, staffMembers }, { id: targetSeed.admin.id });
  invariant(rejected.transportStudentAssignments.errors.some((message) => message.includes("does not belong")), "TRANSPORT_RESTORE_SUBSTITUTION_NOT_REJECTED");
  invariant(rejected.cafeteriaMealRecords.errors.some((message) => message.includes("does not belong")), "CAFETERIA_RESTORE_SUBSTITUTION_NOT_REJECTED");
}

async function main() {
  const keepSource = process.argv.includes("--keep");
  const sourcePath = createEmptyIsolatedDatabase("empty-db", "optional-ops-source");
  const targetPath = createEmptyIsolatedDatabase("restore", "optional-ops-target");
  const rejectionPath = createEmptyIsolatedDatabase("restore", "optional-ops-rejection");
  let source: PrismaClient | null = null;
  let target: PrismaClient | null = null;
  let rejection: PrismaClient | null = null;
  const originalEnvironment = {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    OPTIONAL_OPS_SYNTHETIC_QA: process.env.OPTIONAL_OPS_SYNTHETIC_QA,
    TRANSPORT_V1_5: process.env.TRANSPORT_V1_5,
    CAFETERIA_V1_5: process.env.CAFETERIA_V1_5,
  };
  try {
    runPrisma(["migrate", "deploy", "--schema", "prisma/schema.prisma"], sourcePath);
    runPrisma(["migrate", "deploy", "--schema", "prisma/schema.prisma"], targetPath);
    runPrisma(["migrate", "deploy", "--schema", "prisma/schema.prisma"], rejectionPath);
    source = new PrismaClient({ datasourceUrl: databaseUrl(sourcePath) });
    target = new PrismaClient({ datasourceUrl: databaseUrl(targetPath) });
    rejection = new PrismaClient({ datasourceUrl: databaseUrl(rejectionPath) });
    const sourceSeed = await seedSyntheticBase(source, "OPSV15");
    const targetSeed = await seedSyntheticBase(target, "OPSV15");
    const rejectionSeed = await seedSyntheticBase(rejection, "OPSV15");
    const protectedBefore = await protectedModuleCounts(source);
    await expectCode(() => createTransportVehicle(source!, adminActor(sourceSeed), { registrationCode: "OFF-001", displayName: "Feature off", capacity: 1 }), "TRANSPORT_FEATURE_DISABLED");
    await expectCode(() => createCafeteriaItem(source!, adminActor(sourceSeed), { code: "OFF-ITEM", name: "Feature off", category: "Test" }), "CAFETERIA_FEATURE_DISABLED");

    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.OPTIONAL_OPS_SYNTHETIC_QA = "1";
    process.env.TRANSPORT_V1_5 = "enabled";
    process.env.CAFETERIA_V1_5 = "enabled";
    await expectCode(() => createTransportVehicle(source!, adminActor(sourceSeed), { registrationCode: "PROD-OFF", displayName: "Production override denied", capacity: 1 }), "TRANSPORT_FEATURE_DISABLED");
    (process.env as Record<string, string | undefined>).NODE_ENV = "test";
    process.env.DATABASE_URL = databaseUrl(sourcePath);

    const transport = await exerciseTransport(source, sourceSeed);
    const cafeteria = await exerciseCafeteria(source, sourceSeed);
    const protectedAfter = await protectedModuleCounts(source);
    invariant(JSON.stringify(protectedBefore) === JSON.stringify(protectedAfter), "OPTIONAL_OPS_NON_REGRESSION_MUTATION");
    const auditText = JSON.stringify({ transport: await source.transportAuditEvent.findMany(), cafeteria: await source.cafeteriaAuditEvent.findMany() });
    invariant(!/private address|9000000|diagnosis|medical/i.test(auditText), "OPTIONAL_OPS_AUDIT_PRIVACY");
    await verifyRestoreSubstitution(source, rejection, rejectionSeed);
    const restored = await verifyBackupRestore(source, target, sourceSeed, targetSeed);
    console.log(JSON.stringify({ status: "OPTIONAL_OPS_V1_5_COPIED_DATABASE_PASSED", defaultOff: true, productionOverrideDenied: true, syntheticOnly: true, transport, cafeteria, protectedModulesUnchanged: protectedAfter, restored, ...(keepSource ? { browserFixture: { databasePath: sourcePath, username: "opsv15-admin", password: SYNTHETIC_PASSWORD } } : {}) }));
  } finally {
    await Promise.all([source?.$disconnect(), target?.$disconnect(), rejection?.$disconnect()]);
    if (!keepSource) cleanupIsolatedDatabase(sourcePath);
    cleanupIsolatedDatabase(targetPath);
    cleanupIsolatedDatabase(rejectionPath);
    for (const [key, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "OPTIONAL_OPS_V1_5_COPIED_DATABASE_FAILED");
  process.exitCode = 1;
});
