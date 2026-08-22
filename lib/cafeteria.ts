import { CAFETERIA_V1_5, optionalOperationsFeatureEnabled } from "@/lib/optional-operations-feature-flags";
import type { CanonicalPermission, Role } from "@/lib/permissions";

export type CafeteriaActor = { id: string; role: Role; permissions: ReadonlySet<string> };

export class CafeteriaError extends Error {
  constructor(message: string, public readonly status = 400, public readonly code = "CAFETERIA_INVALID") { super(message); }
}

function requirePermission(actor: CafeteriaActor, permission: CanonicalPermission) {
  if (!optionalOperationsFeatureEnabled(CAFETERIA_V1_5, actor.role)) throw new CafeteriaError("Cafeteria is not enabled.", 404, "CAFETERIA_FEATURE_DISABLED");
  if ((actor.role === "PARENT" || actor.role === "STUDENT") && permission !== "VIEW_OWN_CHILD_CAFETERIA") {
    throw new CafeteriaError("Cafeteria action is not authorised.", 403, "CAFETERIA_FORBIDDEN");
  }
  if (!actor.permissions.has(permission)) throw new CafeteriaError("Cafeteria action is not authorised.", 403, "CAFETERIA_FORBIDDEN");
}

function object(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CafeteriaError("A JSON object is required.");
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, min: number, max: number) {
  if (typeof value !== "string") throw new CafeteriaError(`${label} is required.`);
  const clean = value.trim().replace(/\s+/g, " ");
  if (clean.length < min || clean.length > max) throw new CafeteriaError(`${label} must be ${min}-${max} characters.`);
  return clean;
}

function optionalText(value: unknown, label: string, max: number) {
  if (value == null || value === "") return null;
  return text(value, label, 1, max);
}

function integer(value: unknown, label: string, min: number, max = 10_000) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) throw new CafeteriaError(`${label} is invalid.`);
  return number;
}

function oneOf<T extends readonly string[]>(value: unknown, allowed: T, label: string): T[number] {
  if (typeof value !== "string" || !allowed.includes(value as T[number])) throw new CafeteriaError(`${label} is invalid.`);
  return value as T[number];
}

function dateOnly(value: unknown, label: string) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new CafeteriaError(`${label} must use YYYY-MM-DD.`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new CafeteriaError(`${label} is invalid.`);
  return date;
}

function todayUtc() { return new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`); }
function currentOn(date: Date) { return { effectiveFrom: { lte: date }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }] }; }

function publicKey(value: unknown, label: string) {
  const key = text(value, label, 8, 100);
  if (!/^[A-Za-z0-9_-]+$/.test(key)) throw new CafeteriaError(`${label} is invalid.`);
  return key;
}

function code(value: unknown, label: string) {
  const normalized = text(value, label, 2, 40).toUpperCase().replace(/\s+/g, "-");
  if (!/^[A-Z0-9][A-Z0-9._/-]*$/.test(normalized)) throw new CafeteriaError(`${label} is invalid.`);
  return normalized;
}

const CAFETERIA_ENROLLMENT_REASON_CODES = ["INITIAL_OPT_IN", "PLAN_CHANGE", "PARENT_REQUEST", "SERVICE_CHANGE", "ADMIN_CORRECTION"] as const;
function enrollmentReason(value: unknown) { return oneOf(value, CAFETERIA_ENROLLMENT_REASON_CODES, "Enrollment reason code"); }
function mealPlanCode(value: unknown) {
  const normalized = code(value ?? "STANDARD", "Meal plan code");
  if (/(MEDICAL|HEALTH|ALLERG|DIAGNOS|DIABET|CELIAC|GLUTEN|LACTOSE|ANAPHYL|DISEASE)/.test(normalized)) throw new CafeteriaError("Health or dietary details require the separately governed health-data workflow.", 409, "CAFETERIA_HEALTH_DATA_PROHIBITED");
  return normalized;
}

function safeMetadata(value: Record<string, unknown>) { return JSON.stringify(value); }
function prismaConflict(error: unknown, message: string): never {
  if ((error as { code?: string })?.code === "P2002") throw new CafeteriaError(message, 409, "CAFETERIA_DUPLICATE");
  throw error;
}

async function cafeteriaAudit(tx: any, actor: CafeteriaActor, input: { eventType: string; entityType: string; entityPublicKey: string; metadata?: Record<string, unknown> }) {
  await tx.cafeteriaAuditEvent.create({ data: { eventType: input.eventType, entityType: input.entityType, entityPublicKey: input.entityPublicKey, actorUserId: actor.id, actorRole: actor.role, safeMetadataJson: input.metadata ? safeMetadata(input.metadata) : null } });
}

export async function createCafeteriaItem(client: any, actor: CafeteriaActor, value: unknown) {
  requirePermission(actor, "MANAGE_CAFETERIA_CATALOG");
  const row = object(value);
  try {
    return await client.$transaction(async (tx: any) => {
      const item = await tx.cafeteriaCatalogItem.create({ data: { code: code(row.code, "Item code"), name: text(row.name, "Item name", 2, 100), category: text(row.category, "Category", 2, 60), available: row.available !== false, status: oneOf(row.status ?? "ACTIVE", ["ACTIVE", "INACTIVE"] as const, "Item status") } });
      await cafeteriaAudit(tx, actor, { eventType: "CATALOG_ITEM_CREATED", entityType: "CATALOG_ITEM", entityPublicKey: item.publicKey, metadata: { code: item.code, category: item.category, available: item.available, status: item.status } });
      return item;
    });
  } catch (error) { return prismaConflict(error, "A Cafeteria item with this code already exists."); }
}

export async function updateCafeteriaItem(client: any, actor: CafeteriaActor, value: unknown) {
  requirePermission(actor, "MANAGE_CAFETERIA_CATALOG");
  const row = object(value), key = publicKey(row.publicKey, "Item reference"), expectedVersion = integer(row.expectedVersion, "Expected version", 1);
  const data: Record<string, unknown> = {};
  if (row.name !== undefined) data.name = text(row.name, "Item name", 2, 100);
  if (row.category !== undefined) data.category = text(row.category, "Category", 2, 60);
  if (row.available !== undefined) { if (typeof row.available !== "boolean") throw new CafeteriaError("Availability is invalid."); data.available = row.available; }
  if (row.status !== undefined) data.status = oneOf(row.status, ["ACTIVE", "INACTIVE"] as const, "Item status");
  if (!Object.keys(data).length) throw new CafeteriaError("No supported item changes were supplied.");
  return client.$transaction(async (tx: any) => {
    const current = await tx.cafeteriaCatalogItem.findUnique({ where: { publicKey: key } });
    if (!current) throw new CafeteriaError("Cafeteria item not found.", 404, "CAFETERIA_NOT_FOUND");
    const changed = await tx.cafeteriaCatalogItem.updateMany({ where: { id: current.id, version: expectedVersion }, data: { ...data, version: { increment: 1 } } });
    if (changed.count !== 1) throw new CafeteriaError("The item changed. Refresh and retry.", 409, "CAFETERIA_STALE_VERSION");
    const item = await tx.cafeteriaCatalogItem.findUnique({ where: { id: current.id } });
    await cafeteriaAudit(tx, actor, { eventType: "CATALOG_ITEM_UPDATED", entityType: "CATALOG_ITEM", entityPublicKey: current.publicKey, metadata: { priorStatus: current.status, status: item.status, priorAvailable: current.available, available: item.available } });
    return item;
  });
}

export async function createCafeteriaMenu(client: any, actor: CafeteriaActor, value: unknown) {
  requirePermission(actor, "MANAGE_CAFETERIA_MENUS");
  const row = object(value), menuDate = dateOnly(row.menuDate, "Menu date"), mealPlanName = mealPlanCode(row.mealPlanName);
  if (!Array.isArray(row.items) || row.items.length < 1 || row.items.length > 100) throw new CafeteriaError("At least one bounded menu item is required.");
  const requested = row.items.map((value, index) => {
    const item = object(value);
    return { itemKey: publicKey(item.itemKey, `Menu item ${index + 1}`), mealSlot: oneOf(item.mealSlot, ["BREAKFAST", "LUNCH", "SNACK"] as const, `Meal slot ${index + 1}`), available: item.available !== false };
  });
  if (new Set(requested.map((item) => `${item.itemKey}:${item.mealSlot}`)).size !== requested.length) throw new CafeteriaError("Duplicate menu items are not allowed.", 409, "CAFETERIA_DUPLICATE");
  try {
    return await client.$transaction(async (tx: any) => {
      const catalog = await tx.cafeteriaCatalogItem.findMany({ where: { publicKey: { in: requested.map((item) => item.itemKey) } } });
      if (catalog.length !== requested.length || catalog.some((item: any) => item.status !== "ACTIVE" || !item.available)) throw new CafeteriaError("Every menu item must be active and available.", 409, "CAFETERIA_ITEM_INACTIVE");
      const byKey = new Map<string, any>(catalog.map((item: any) => [item.publicKey, item]));
      const menu = await tx.cafeteriaMenu.create({ data: { menuDate, dayLabel: menuDate.toLocaleDateString("en", { weekday: "long", timeZone: "UTC" }), mealPlanName, status: "ACTIVE", items: { create: requested.map((item) => ({ itemId: byKey.get(item.itemKey).id, mealSlot: item.mealSlot, available: item.available })) } }, include: { items: { include: { item: true } } } });
      await cafeteriaAudit(tx, actor, { eventType: "MENU_CREATED", entityType: "MENU", entityPublicKey: menu.publicKey, metadata: { menuDate: menuDate.toISOString().slice(0, 10), mealPlanName, itemCount: requested.length } });
      return menu;
    });
  } catch (error) { return prismaConflict(error, "A menu already exists for this date and meal plan."); }
}

export async function updateCafeteriaMenu(client: any, actor: CafeteriaActor, value: unknown) {
  requirePermission(actor, "MANAGE_CAFETERIA_MENUS");
  const row = object(value), key = publicKey(row.publicKey, "Menu reference"), expectedVersion = integer(row.expectedVersion, "Expected version", 1), status = oneOf(row.status, ["ACTIVE", "INACTIVE"] as const, "Menu status");
  return client.$transaction(async (tx: any) => {
    const current = await tx.cafeteriaMenu.findUnique({ where: { publicKey: key } });
    if (!current) throw new CafeteriaError("Menu not found.", 404, "CAFETERIA_NOT_FOUND");
    const changed = await tx.cafeteriaMenu.updateMany({ where: { id: current.id, version: expectedVersion }, data: { status, version: { increment: 1 } } });
    if (changed.count !== 1) throw new CafeteriaError("The menu changed. Refresh and retry.", 409, "CAFETERIA_STALE_VERSION");
    await cafeteriaAudit(tx, actor, { eventType: "MENU_UPDATED", entityType: "MENU", entityPublicKey: current.publicKey, metadata: { priorStatus: current.status, status } });
    return tx.cafeteriaMenu.findUnique({ where: { id: current.id }, include: { items: { include: { item: true } } } });
  });
}

export async function enrollCafeteriaStudent(client: any, actor: CafeteriaActor, value: unknown) {
  requirePermission(actor, "MANAGE_CAFETERIA_ENROLLMENTS");
  const row = object(value), admissionNo = text(row.admissionNo, "Admission number", 1, 40), effectiveFrom = dateOnly(row.effectiveFrom, "Effective from"), effectiveTo = row.effectiveTo ? dateOnly(row.effectiveTo, "Effective to") : null, mealPlanName = mealPlanCode(row.mealPlanName), changeReason = enrollmentReason(row.changeReason);
  if (effectiveTo && effectiveTo < effectiveFrom) throw new CafeteriaError("Effective to cannot be before effective from.");
  try {
    return await client.$transaction(async (tx: any) => {
      const student = await tx.student.findUnique({ where: { admissionNo }, select: { id: true, status: true } });
      if (!student || student.status !== "Active") throw new CafeteriaError("An active Student is required.", 409, "CAFETERIA_STUDENT_INACTIVE");
      const current = await tx.cafeteriaStudentEnrollment.findUnique({ where: { activeStudentId: student.id } });
      if (current && effectiveFrom <= current.effectiveFrom) throw new CafeteriaError("A changed opt-in must start after the current enrollment start date.", 409, "CAFETERIA_EFFECTIVE_DATE_CONFLICT");
      if (current) {
        const expectedCurrentKey = row.expectedCurrentEnrollmentKey === undefined ? null : publicKey(row.expectedCurrentEnrollmentKey, "Expected current enrollment"), expectedCurrentVersion = row.expectedCurrentVersion === undefined ? null : integer(row.expectedCurrentVersion, "Expected current version", 1);
        if (expectedCurrentKey !== current.publicKey || expectedCurrentVersion !== current.version) throw new CafeteriaError("The current enrollment changed. Refresh and retry.", 409, "CAFETERIA_STALE_ENROLLMENT");
        const ended = await tx.cafeteriaStudentEnrollment.updateMany({ where: { id: current.id, active: true, version: expectedCurrentVersion }, data: { active: false, activeStudentId: null, effectiveTo: new Date(effectiveFrom.getTime() - 86_400_000), version: { increment: 1 } } });
        if (ended.count !== 1) throw new CafeteriaError("The current enrollment changed. Refresh and retry.", 409, "CAFETERIA_STALE_ENROLLMENT");
      } else if (row.expectedCurrentEnrollmentKey !== undefined || row.expectedCurrentVersion !== undefined) throw new CafeteriaError("The current enrollment changed. Refresh and retry.", 409, "CAFETERIA_STALE_ENROLLMENT");
      const enrollment = await tx.cafeteriaStudentEnrollment.create({ data: { studentId: student.id, activeStudentId: student.id, mealPlanName, effectiveFrom, effectiveTo, active: true, changeReason, replacesEnrollmentId: current?.id ?? null, createdByUserId: actor.id, createdByRole: actor.role } });
      if (current) await cafeteriaAudit(tx, actor, { eventType: "ENROLLMENT_ENDED", entityType: "STUDENT_ENROLLMENT", entityPublicKey: current.publicKey, metadata: { studentId: student.id, originalReasonCode: current.changeReason, supersededEffectiveTo: new Date(effectiveFrom.getTime() - 86_400_000).toISOString().slice(0, 10), replacedByPublicKey: enrollment.publicKey } });
      await cafeteriaAudit(tx, actor, { eventType: current ? "STUDENT_ENROLLMENT_CHANGED" : "STUDENT_ENROLLED", entityType: "STUDENT_ENROLLMENT", entityPublicKey: enrollment.publicKey, metadata: { studentId: student.id, effectiveFrom: effectiveFrom.toISOString().slice(0, 10), mealPlanName } });
      return enrollment;
    });
  } catch (error) { return prismaConflict(error, "The Student already has an active Cafeteria enrollment."); }
}

export async function deactivateCafeteriaEnrollment(client: any, actor: CafeteriaActor, value: unknown) {
  requirePermission(actor, "MANAGE_CAFETERIA_ENROLLMENTS");
  const row = object(value), key = publicKey(row.publicKey, "Enrollment reference"), expectedVersion = integer(row.expectedVersion, "Expected version", 1), effectiveTo = dateOnly(row.effectiveTo, "Effective to"), reason = enrollmentReason(row.reason);
  return client.$transaction(async (tx: any) => {
    const current = await tx.cafeteriaStudentEnrollment.findUnique({ where: { publicKey: key } });
    if (!current) throw new CafeteriaError("Enrollment not found.", 404, "CAFETERIA_NOT_FOUND");
    if (!current.active) throw new CafeteriaError("Enrollment is already inactive.", 409, "CAFETERIA_ENROLLMENT_INACTIVE");
    if (effectiveTo < current.effectiveFrom) throw new CafeteriaError("Effective to cannot be before enrollment start.");
    const changed = await tx.cafeteriaStudentEnrollment.updateMany({ where: { id: current.id, active: true, version: expectedVersion }, data: { active: false, activeStudentId: null, effectiveTo, version: { increment: 1 } } });
    if (changed.count !== 1) throw new CafeteriaError("The enrollment changed. Refresh and retry.", 409, "CAFETERIA_STALE_VERSION");
    await cafeteriaAudit(tx, actor, { eventType: "ENROLLMENT_DEACTIVATED", entityType: "STUDENT_ENROLLMENT", entityPublicKey: current.publicKey, metadata: { studentId: current.studentId, originalReasonCode: current.changeReason, deactivationReasonCode: reason, effectiveTo: effectiveTo.toISOString().slice(0, 10) } });
    return tx.cafeteriaStudentEnrollment.findUnique({ where: { id: current.id } });
  });
}

export async function recordCafeteriaMeal(client: any, actor: CafeteriaActor, value: unknown) {
  requirePermission(actor, "RECORD_CAFETERIA_PARTICIPATION");
  const row = object(value), admissionNo = text(row.admissionNo, "Admission number", 1, 40), menuItemKey = publicKey(row.menuItemKey, "Menu item reference"), serviceDateKey = dateOnly(row.serviceDate, "Service date").toISOString().slice(0, 10), mealSlot = oneOf(row.mealSlot, ["BREAKFAST", "LUNCH", "SNACK"] as const, "Meal slot"), recordType = oneOf(row.recordType, ["ORDER", "PARTICIPATION"] as const, "Record type"), idempotencyKey = text(row.idempotencyKey, "Idempotency key", 8, 120);
  try {
    return await client.$transaction(async (tx: any) => {
      const [student, menuItem] = await Promise.all([
        tx.student.findUnique({ where: { admissionNo }, select: { id: true, status: true } }),
        tx.cafeteriaMenuItem.findUnique({ where: { publicKey: menuItemKey }, include: { item: true, menu: true } })
      ]);
      if (!student || student.status !== "Active") throw new CafeteriaError("An active Student is required.", 409, "CAFETERIA_STUDENT_INACTIVE");
      const serviceDate = new Date(`${serviceDateKey}T00:00:00.000Z`);
      const enrollment = await tx.cafeteriaStudentEnrollment.findFirst({ where: { studentId: student.id, ...currentOn(serviceDate) }, orderBy: { effectiveFrom: "desc" } });
      if (!enrollment) throw new CafeteriaError("The Student is not opted in for this service date.", 409, "CAFETERIA_ENROLLMENT_REQUIRED");
      if (!menuItem || !menuItem.available || menuItem.mealSlot !== mealSlot || menuItem.item.status !== "ACTIVE" || !menuItem.item.available || menuItem.menu.status !== "ACTIVE" || menuItem.menu.menuDate.toISOString().slice(0, 10) !== serviceDateKey) throw new CafeteriaError("The selected item is not available for this date and meal slot.", 409, "CAFETERIA_MENU_ITEM_UNAVAILABLE");
      if (enrollment.mealPlanName !== menuItem.menu.mealPlanName) throw new CafeteriaError("The selected item does not match the Student meal plan.", 409, "CAFETERIA_MEAL_PLAN_MISMATCH");
      const meal = await tx.cafeteriaMealRecord.create({ data: { studentId: student.id, enrollmentId: enrollment.id, menuItemId: menuItem.id, serviceDateKey, mealSlot, recordType, idempotencyKey, recordedByUserId: actor.id, recordedByRole: actor.role } });
      await cafeteriaAudit(tx, actor, { eventType: "MEAL_RECORD_CREATED", entityType: "MEAL_RECORD", entityPublicKey: meal.publicKey, metadata: { studentId: student.id, serviceDateKey, mealSlot, recordType, catalogItemPublicKey: menuItem.item.publicKey } });
      return meal;
    });
  } catch (error) { return prismaConflict(error, "This meal record was already captured."); }
}

export async function cafeteriaWorkspace(client: any, actor: CafeteriaActor) {
  requirePermission(actor, "VIEW_CAFETERIA");
  const canCatalog = actor.permissions.has("MANAGE_CAFETERIA_CATALOG"), canMenus = actor.permissions.has("MANAGE_CAFETERIA_MENUS"), canEnrollments = actor.permissions.has("MANAGE_CAFETERIA_ENROLLMENTS"), canMeals = actor.permissions.has("RECORD_CAFETERIA_PARTICIPATION"), asOf = todayUtc();
  const [itemRows, menuRows, enrollmentRows, mealRecords, students] = await Promise.all([
    client.cafeteriaCatalogItem.findMany({ select: { publicKey: true, code: true, name: true, category: true, available: true, status: true, version: true }, orderBy: [{ category: "asc" }, { name: "asc" }], take: 1_000 }),
    client.cafeteriaMenu.findMany({ select: { publicKey: true, menuDate: true, dayLabel: true, mealPlanName: true, status: true, version: true, items: { select: { publicKey: true, mealSlot: true, available: true, item: { select: { publicKey: true, code: true, name: true, category: true, status: true, available: true } } } } }, orderBy: { menuDate: "desc" }, take: 500 }),
    client.cafeteriaStudentEnrollment.findMany({ select: { publicKey: true, version: true, active: true, mealPlanName: true, effectiveFrom: true, effectiveTo: true, student: { select: { admissionNo: true, studentName: true, className: true, section: true } } }, orderBy: { createdAt: "desc" }, take: 1_000 }),
    client.cafeteriaMealRecord.findMany({ select: { publicKey: true, serviceDateKey: true, mealSlot: true, recordType: true, status: true, student: { select: { admissionNo: true, studentName: true, className: true, section: true } }, menuItem: { select: { item: { select: { publicKey: true, name: true, category: true } }, menu: { select: { menuDate: true, mealPlanName: true } } } } }, orderBy: { recordedAt: "desc" }, take: 1_000 }),
    canEnrollments || canMeals ? client.student.findMany({ where: { status: "Active", deletedAt: null }, select: { admissionNo: true, studentName: true, className: true, section: true }, orderBy: { studentName: "asc" }, take: 5_000 }) : Promise.resolve([])
  ]);
  const items = itemRows.map((row: any) => canCatalog ? row : (({ version: _version, ...safe }) => safe)(row));
  const menus = menuRows.map((row: any) => canMenus ? row : (({ version: _version, ...safe }) => safe)(row));
  const enrollments = enrollmentRows.map((row: any) => { const current = row.effectiveFrom <= asOf && (!row.effectiveTo || row.effectiveTo >= asOf), scheduled = row.effectiveFrom > asOf; return { publicKey: row.publicKey, ...(canEnrollments ? { version: row.version, open: row.active } : {}), active: current, lifecycleStatus: current ? "CURRENT" : scheduled ? "SCHEDULED" : "HISTORY", mealPlanName: row.mealPlanName, effectiveFrom: row.effectiveFrom, effectiveTo: row.effectiveTo, student: row.student }; });
  return { items, menus, enrollments, mealRecords, students, policy: { healthRecords: false, dietaryNote: "OMITTED_REQUIRES_SEPARATE_HEALTH_DATA_GOVERNANCE", wallet: false, payments: false, automaticFees: false } };
}

export async function cafeteriaReport(client: any, actor: CafeteriaActor) {
  requirePermission(actor, "EXPORT_CAFETERIA_REPORTS");
  const rows = await client.cafeteriaMealRecord.findMany({ select: { serviceDateKey: true, mealSlot: true, recordType: true, student: { select: { admissionNo: true, studentName: true, className: true, section: true } }, menuItem: { select: { item: { select: { code: true, name: true, category: true } }, menu: { select: { mealPlanName: true } } } } }, orderBy: [{ serviceDateKey: "desc" }, { mealSlot: "asc" }], take: 10_000 });
  return { generatedAt: new Date().toISOString(), rows, privacy: "NO_HEALTH_OR_PAYMENT_DATA" };
}

function csvCell(value: unknown) { let cell = value == null ? "" : String(value); if (/^[=+\-@\t\r]/.test(cell)) cell = `'${cell}`; return `"${cell.replaceAll('"', '""')}"`; }
export function cafeteriaReportCsv(report: Awaited<ReturnType<typeof cafeteriaReport>>) {
  const rows = [["Service Date", "Meal Slot", "Record Type", "Admission No", "Student", "Class", "Section", "Item Code", "Item", "Category", "Meal Plan"], ...report.rows.map((row: any) => [row.serviceDateKey, row.mealSlot, row.recordType, row.student.admissionNo, row.student.studentName, row.student.className, row.student.section ?? "", row.menuItem.item.code, row.menuItem.item.name, row.menuItem.item.category, row.menuItem.menu.mealPlanName])];
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export async function parentCafeteriaView(client: any, actor: CafeteriaActor, admissionNo?: string | null) {
  requirePermission(actor, "VIEW_OWN_CHILD_CAFETERIA");
  if (actor.role !== "PARENT") throw new CafeteriaError("Parent linked-child access is required.", 403, "CAFETERIA_PARENT_ONLY");
  const user = await client.user.findUnique({ where: { id: actor.id }, select: { guardianId: true } });
  if (!user?.guardianId) return { children: [] };
  const links = await client.studentGuardian.findMany({ where: { guardianId: user.guardianId, ...(admissionNo ? { student: { admissionNo } } : {}) }, select: { studentId: true } });
  if (admissionNo && links.length === 0) throw new CafeteriaError("Cafeteria enrollment not found.", 404, "CAFETERIA_CHILD_NOT_FOUND");
  const students = await client.student.findMany({
    where: { id: { in: links.map((link: any) => link.studentId) } },
    select: {
      id: true,
      admissionNo: true,
      studentName: true,
      className: true,
      section: true,
      cafeteriaEnrollments: {
        where: currentOn(todayUtc()),
        select: { mealPlanName: true, effectiveFrom: true, effectiveTo: true },
        orderBy: { effectiveFrom: "desc" },
        take: 1,
      },
      cafeteriaMealRecords: {
        orderBy: { recordedAt: "desc" },
        take: 30,
        select: {
          serviceDateKey: true,
          mealSlot: true,
          recordType: true,
          status: true,
          menuItem: {
            select: { item: { select: { name: true, category: true } } },
          },
        },
      },
    },
  });
  return { children: students.map((student: any) => ({ student: { admissionNo: student.admissionNo, studentName: student.studentName, className: student.className, section: student.section }, enrollment: student.cafeteriaEnrollments[0] ?? null, mealRecords: student.cafeteriaMealRecords })) };
}

export type CafeteriaChargeReference = Readonly<{
  source: "CAFETERIA_FUTURE_REFERENCE_ONLY";
  studentId: string;
  serviceDateKey: string;
  mealRecordPublicKey: string;
  financialMutation: "PROHIBITED";
}>;

export function cafeteriaFutureChargeReference(input: Omit<CafeteriaChargeReference, "source" | "financialMutation">): CafeteriaChargeReference {
  return { source: "CAFETERIA_FUTURE_REFERENCE_ONLY", ...input, financialMutation: "PROHIBITED" };
}
