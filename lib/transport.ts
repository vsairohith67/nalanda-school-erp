import { optionalOperationsFeatureEnabled, TRANSPORT_V1_5 } from "@/lib/optional-operations-feature-flags";
import type { CanonicalPermission, Role } from "@/lib/permissions";

export type TransportActor = {
  id: string;
  role: Role;
  permissions: ReadonlySet<string>;
};

export class TransportError extends Error {
  constructor(message: string, public readonly status = 400, public readonly code = "TRANSPORT_INVALID") {
    super(message);
  }
}

function requireFeature(actor: TransportActor) {
  if (!optionalOperationsFeatureEnabled(TRANSPORT_V1_5, actor.role)) {
    throw new TransportError("Transport is not enabled.", 404, "TRANSPORT_FEATURE_DISABLED");
  }
}

function requirePermission(actor: TransportActor, permission: CanonicalPermission) {
  requireFeature(actor);
  if ((actor.role === "PARENT" || actor.role === "STUDENT") && permission !== "VIEW_OWN_CHILD_TRANSPORT") {
    throw new TransportError("Transport action is not authorised.", 403, "TRANSPORT_FORBIDDEN");
  }
  if (!actor.permissions.has(permission)) throw new TransportError("Transport action is not authorised.", 403, "TRANSPORT_FORBIDDEN");
}

function object(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TransportError("A JSON object is required.");
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, min: number, max: number) {
  if (typeof value !== "string") throw new TransportError(`${label} is required.`);
  const clean = value.trim().replace(/\s+/g, " ");
  if (clean.length < min || clean.length > max) throw new TransportError(`${label} must be ${min}-${max} characters.`);
  return clean;
}

function optionalText(value: unknown, label: string, max: number) {
  if (value == null || value === "") return null;
  return text(value, label, 1, max);
}

function integer(value: unknown, label: string, min: number, max = 10_000) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) throw new TransportError(`${label} is invalid.`);
  return parsed;
}

function oneOf<T extends readonly string[]>(value: unknown, allowed: T, label: string): T[number] {
  if (typeof value !== "string" || !allowed.includes(value as T[number])) throw new TransportError(`${label} is invalid.`);
  return value as T[number];
}

function dateOnly(value: unknown, label: string) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new TransportError(`${label} must use YYYY-MM-DD.`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new TransportError(`${label} is invalid.`);
  return date;
}

function todayUtc() {
  return new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
}

function currentOn(date: Date) {
  return { effectiveFrom: { lte: date }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }] };
}

function intervalOverlap(effectiveFrom: Date, effectiveTo: Date | null) {
  return {
    effectiveFrom: effectiveTo ? { lte: effectiveTo } : undefined,
    OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveFrom } }]
  };
}

function publicKey(value: unknown, label: string) {
  const key = text(value, label, 8, 100);
  if (!/^[A-Za-z0-9_-]+$/.test(key)) throw new TransportError(`${label} is invalid.`);
  return key;
}

function code(value: unknown, label: string) {
  const normalized = text(value, label, 2, 40).toUpperCase().replace(/\s+/g, "-");
  if (!/^[A-Z0-9][A-Z0-9._/-]*$/.test(normalized)) throw new TransportError(`${label} is invalid.`);
  return normalized;
}

function safeMetadata(value: Record<string, unknown>) {
  return JSON.stringify(value);
}

function prismaConflict(error: unknown, message: string): never {
  if ((error as { code?: string })?.code === "P2002") throw new TransportError(message, 409, "TRANSPORT_DUPLICATE");
  throw error;
}

async function transportAudit(tx: any, actor: TransportActor, input: {
  eventType: string;
  entityType: string;
  entityPublicKey: string;
  metadata?: Record<string, unknown>;
}) {
  await tx.transportAuditEvent.create({ data: {
    eventType: input.eventType,
    entityType: input.entityType,
    entityPublicKey: input.entityPublicKey,
    actorUserId: actor.id,
    actorRole: actor.role,
    safeMetadataJson: input.metadata ? safeMetadata(input.metadata) : null
  } });
}

export async function createTransportVehicle(client: any, actor: TransportActor, value: unknown) {
  requirePermission(actor, "MANAGE_TRANSPORT_VEHICLES");
  const row = object(value);
  const data = {
    registrationCode: code(row.registrationCode, "Registration code"),
    displayName: text(row.displayName, "Vehicle name", 2, 80),
    capacity: integer(row.capacity, "Vehicle capacity", 1, 200),
    status: oneOf(row.status ?? "ACTIVE", ["ACTIVE", "INACTIVE"] as const, "Vehicle status")
  };
  try {
    return await client.$transaction(async (tx: any) => {
      const vehicle = await tx.transportVehicle.create({ data });
      await transportAudit(tx, actor, { eventType: "VEHICLE_CREATED", entityType: "VEHICLE", entityPublicKey: vehicle.publicKey, metadata: { registrationCode: vehicle.registrationCode, capacity: vehicle.capacity, status: vehicle.status } });
      return vehicle;
    });
  } catch (error) { return prismaConflict(error, "A vehicle with this registration code already exists."); }
}

export async function updateTransportVehicle(client: any, actor: TransportActor, value: unknown) {
  requirePermission(actor, "MANAGE_TRANSPORT_VEHICLES");
  const row = object(value), key = publicKey(row.publicKey, "Vehicle reference"), expectedVersion = integer(row.expectedVersion, "Expected version", 1);
  const data: Record<string, unknown> = {};
  if (row.displayName !== undefined) data.displayName = text(row.displayName, "Vehicle name", 2, 80);
  if (row.capacity !== undefined) data.capacity = integer(row.capacity, "Vehicle capacity", 1, 200);
  if (row.status !== undefined) data.status = oneOf(row.status, ["ACTIVE", "INACTIVE"] as const, "Vehicle status");
  if (!Object.keys(data).length) throw new TransportError("No supported vehicle changes were supplied.");
  return client.$transaction(async (tx: any) => {
    const current = await tx.transportVehicle.findUnique({ where: { publicKey: key }, include: { routes: { where: { status: "ACTIVE" }, select: { capacity: true, allocatedSeats: true } } } });
    if (!current) throw new TransportError("Vehicle not found.", 404, "TRANSPORT_NOT_FOUND");
    if (data.capacity !== undefined && current.routes.some((route: any) => route.capacity > data.capacity! || route.allocatedSeats > data.capacity!)) throw new TransportError("Vehicle capacity cannot be lower than an active route capacity or allocation.", 409, "TRANSPORT_CAPACITY_CONFLICT");
    if (data.status === "INACTIVE" && current.routes.length) throw new TransportError("A vehicle assigned to an active route cannot be made inactive.", 409, "TRANSPORT_VEHICLE_IN_USE");
    const changed = await tx.transportVehicle.updateMany({ where: { id: current.id, version: expectedVersion }, data: { ...data, version: { increment: 1 } } });
    if (changed.count !== 1) throw new TransportError("The vehicle changed. Refresh and retry.", 409, "TRANSPORT_STALE_VERSION");
    const vehicle = await tx.transportVehicle.findUnique({ where: { id: current.id } });
    await transportAudit(tx, actor, { eventType: "VEHICLE_UPDATED", entityType: "VEHICLE", entityPublicKey: current.publicKey, metadata: { priorStatus: current.status, status: vehicle.status, priorCapacity: current.capacity, capacity: vehicle.capacity } });
    return vehicle;
  });
}

export async function createTransportStop(client: any, actor: TransportActor, value: unknown) {
  requirePermission(actor, "MANAGE_TRANSPORT_ROUTES");
  const row = object(value);
  try {
    return await client.$transaction(async (tx: any) => {
      const stop = await tx.transportStop.create({ data: { code: code(row.code, "Stop code"), name: text(row.name, "Stop name", 2, 100), approvedReference: optionalText(row.approvedReference, "Approved reference", 160), active: row.active !== false } });
      await transportAudit(tx, actor, { eventType: "STOP_CREATED", entityType: "STOP", entityPublicKey: stop.publicKey, metadata: { code: stop.code, active: stop.active } });
      return stop;
    });
  } catch (error) { return prismaConflict(error, "A stop with this code already exists."); }
}

export async function updateTransportStop(client: any, actor: TransportActor, value: unknown) {
  requirePermission(actor, "MANAGE_TRANSPORT_ROUTES");
  const row = object(value), key = publicKey(row.publicKey, "Stop reference"), expectedVersion = integer(row.expectedVersion, "Expected version", 1);
  const data: Record<string, unknown> = {};
  if (row.name !== undefined) data.name = text(row.name, "Stop name", 2, 100);
  if (row.approvedReference !== undefined) data.approvedReference = optionalText(row.approvedReference, "Approved reference", 160);
  if (row.active !== undefined) {
    if (typeof row.active !== "boolean") throw new TransportError("Stop active state is invalid.");
    data.active = row.active;
  }
  if (!Object.keys(data).length) throw new TransportError("No supported stop changes were supplied.");
  return client.$transaction(async (tx: any) => {
    const current = await tx.transportStop.findUnique({ where: { publicKey: key } });
    if (!current) throw new TransportError("Stop not found.", 404, "TRANSPORT_NOT_FOUND");
    if (data.active === false) {
      const inUse = await tx.transportStudentAssignment.count({ where: { AND: [{ OR: [{ effectiveTo: null }, { effectiveTo: { gte: todayUtc() } }] }, { OR: [{ pickupRouteStop: { stopId: current.id } }, { dropRouteStop: { stopId: current.id } }] }] } });
      if (inUse) throw new TransportError("An assigned stop cannot be made inactive.", 409, "TRANSPORT_STOP_IN_USE");
    }
    const changed = await tx.transportStop.updateMany({ where: { id: current.id, version: expectedVersion }, data: { ...data, version: { increment: 1 } } });
    if (changed.count !== 1) throw new TransportError("The stop changed. Refresh and retry.", 409, "TRANSPORT_STALE_VERSION");
    const stop = await tx.transportStop.findUnique({ where: { id: current.id } });
    await transportAudit(tx, actor, { eventType: "STOP_UPDATED", entityType: "STOP", entityPublicKey: current.publicKey, metadata: { priorName: current.name, name: stop.name, priorApprovedReference: current.approvedReference, approvedReference: stop.approvedReference, priorActive: current.active, active: stop.active } });
    return stop;
  });
}

async function staffReference(client: any, staffCode: unknown, label: string) {
  const value = optionalText(staffCode, label, 40);
  if (!value) return null;
  const staff = await client.staffMember.findUnique({ where: { staffCode: value }, select: { id: true, status: true } });
  if (!staff || staff.status !== "ACTIVE") throw new TransportError(`${label} is not an active Staff reference.`, 409, "TRANSPORT_STAFF_REFERENCE_INVALID");
  return staff.id;
}

async function peakEffectiveAllocation(client: any, routeId: string) {
  const today = todayUtc();
  const rows = await client.transportStudentAssignment.findMany({
    where: { routeId, OR: [{ effectiveTo: null }, { effectiveTo: { gte: today } }] },
    select: { effectiveFrom: true, effectiveTo: true }
  });
  const events: Array<{ at: number; delta: number }> = [];
  for (const row of rows) {
    events.push({ at: Math.max(row.effectiveFrom.getTime(), today.getTime()), delta: 1 });
    if (row.effectiveTo) events.push({ at: row.effectiveTo.getTime() + 86_400_000, delta: -1 });
  }
  events.sort((left, right) => left.at - right.at || left.delta - right.delta);
  let current = 0, peak = 0;
  for (const event of events) { current += event.delta; peak = Math.max(peak, current); }
  return peak;
}

export async function createTransportRoute(client: any, actor: TransportActor, value: unknown) {
  requirePermission(actor, "MANAGE_TRANSPORT_ROUTES");
  const row = object(value), vehicleKey = publicKey(row.vehicleKey, "Vehicle reference");
  try {
    return await client.$transaction(async (tx: any) => {
      const vehicle = await tx.transportVehicle.findUnique({ where: { publicKey: vehicleKey } });
      if (!vehicle || vehicle.status !== "ACTIVE") throw new TransportError("An active vehicle is required.", 409, "TRANSPORT_VEHICLE_INACTIVE");
      const capacity = integer(row.capacity, "Route capacity", 1, 200);
      if (capacity > vehicle.capacity) throw new TransportError("Route capacity cannot exceed vehicle capacity.", 409, "TRANSPORT_CAPACITY_CONFLICT");
      const route = await tx.transportRoute.create({ data: {
        code: code(row.code, "Route code"), name: text(row.name, "Route name", 2, 100),
        directionMode: oneOf(row.directionMode ?? "BOTH", ["MORNING", "EVENING", "BOTH"] as const, "Direction mode"),
        vehicleId: vehicle.id, capacity,
        driverStaffMemberId: await staffReference(tx, row.driverStaffCode, "Driver reference"),
        attendantStaffMemberId: await staffReference(tx, row.attendantStaffCode, "Attendant reference"),
        status: oneOf(row.status ?? "ACTIVE", ["ACTIVE", "INACTIVE"] as const, "Route status")
      } });
      await transportAudit(tx, actor, { eventType: "ROUTE_CREATED", entityType: "ROUTE", entityPublicKey: route.publicKey, metadata: { code: route.code, vehiclePublicKey: vehicle.publicKey, capacity: route.capacity, status: route.status } });
      return route;
    });
  } catch (error) { return prismaConflict(error, "This route code or route configuration already exists."); }
}

export async function updateTransportRoute(client: any, actor: TransportActor, value: unknown) {
  requirePermission(actor, "MANAGE_TRANSPORT_ROUTES");
  const row = object(value), key = publicKey(row.publicKey, "Route reference"), expectedVersion = integer(row.expectedVersion, "Expected version", 1);
  return client.$transaction(async (tx: any) => {
    const current = await tx.transportRoute.findUnique({ where: { publicKey: key }, include: { vehicle: true, driverStaffMember: { select: { staffCode: true } }, attendantStaffMember: { select: { staffCode: true } } } });
    if (!current) throw new TransportError("Route not found.", 404, "TRANSPORT_NOT_FOUND");
    const vehicle = row.vehicleKey === undefined ? current.vehicle : await tx.transportVehicle.findUnique({ where: { publicKey: publicKey(row.vehicleKey, "Vehicle reference") } });
    if (!vehicle || vehicle.status !== "ACTIVE") throw new TransportError("An active vehicle is required.", 409, "TRANSPORT_VEHICLE_INACTIVE");
    const capacity = row.capacity === undefined ? current.capacity : integer(row.capacity, "Route capacity", 1, 200);
    const peakAllocation = await peakEffectiveAllocation(tx, current.id);
    if (capacity < Math.max(current.allocatedSeats, peakAllocation) || capacity > vehicle.capacity) throw new TransportError("Route capacity conflicts with vehicle capacity or effective-dated allocation.", 409, "TRANSPORT_CAPACITY_CONFLICT");
    const data: Record<string, unknown> = { vehicleId: vehicle.id, capacity };
    if (row.name !== undefined) data.name = text(row.name, "Route name", 2, 100);
    if (row.directionMode !== undefined) data.directionMode = oneOf(row.directionMode, ["MORNING", "EVENING", "BOTH"] as const, "Direction mode");
    if (row.driverStaffCode !== undefined) data.driverStaffMemberId = await staffReference(tx, row.driverStaffCode, "Driver reference");
    if (row.attendantStaffCode !== undefined) data.attendantStaffMemberId = await staffReference(tx, row.attendantStaffCode, "Attendant reference");
    if (row.status !== undefined) data.status = oneOf(row.status, ["ACTIVE", "INACTIVE"] as const, "Route status");
    if (data.status === "INACTIVE" && peakAllocation > 0) throw new TransportError("A route with current or scheduled Student assignments cannot be made inactive.", 409, "TRANSPORT_ROUTE_IN_USE");
    const changed = await tx.transportRoute.updateMany({ where: { id: current.id, version: expectedVersion }, data: { ...data, version: { increment: 1 } } });
    if (changed.count !== 1) throw new TransportError("The route changed. Refresh and retry.", 409, "TRANSPORT_STALE_VERSION");
    const route = await tx.transportRoute.findUnique({ where: { id: current.id }, include: { driverStaffMember: { select: { staffCode: true } }, attendantStaffMember: { select: { staffCode: true } } } });
    await transportAudit(tx, actor, { eventType: "ROUTE_UPDATED", entityType: "ROUTE", entityPublicKey: current.publicKey, metadata: { priorName: current.name, name: route.name, priorDirectionMode: current.directionMode, directionMode: route.directionMode, priorVehiclePublicKey: current.vehicle.publicKey, vehiclePublicKey: vehicle.publicKey, priorDriverReference: current.driverStaffMember?.staffCode ?? null, driverReference: route.driverStaffMember?.staffCode ?? null, priorAttendantReference: current.attendantStaffMember?.staffCode ?? null, attendantReference: route.attendantStaffMember?.staffCode ?? null, priorCapacity: current.capacity, capacity, priorStatus: current.status, status: route.status } });
    return route;
  });
}

export async function addTransportRouteStop(client: any, actor: TransportActor, value: unknown) {
  requirePermission(actor, "MANAGE_TRANSPORT_ROUTES");
  const row = object(value), routeKey = publicKey(row.routeKey, "Route reference"), stopKey = publicKey(row.stopKey, "Stop reference"), direction = oneOf(row.direction, ["MORNING", "EVENING"] as const, "Direction");
  try {
    return await client.$transaction(async (tx: any) => {
      const [route, stop] = await Promise.all([tx.transportRoute.findUnique({ where: { publicKey: routeKey } }), tx.transportStop.findUnique({ where: { publicKey: stopKey } })]);
      if (!route || route.status !== "ACTIVE") throw new TransportError("An active route is required.", 409, "TRANSPORT_ROUTE_INACTIVE");
      if (!stop || !stop.active) throw new TransportError("An active stop is required.", 409, "TRANSPORT_STOP_INACTIVE");
      if (route.directionMode !== "BOTH" && route.directionMode !== direction) throw new TransportError("The stop direction is not enabled for this route.", 409, "TRANSPORT_DIRECTION_CONFLICT");
      const routeStop = await tx.transportRouteStop.create({ data: { routeId: route.id, stopId: stop.id, direction, sequence: integer(row.sequence, "Stop order", 1, 200), timingReference: optionalText(row.timingReference, "Approved timing", 80), active: true } });
      await transportAudit(tx, actor, { eventType: "ROUTE_STOP_ADDED", entityType: "ROUTE", entityPublicKey: route.publicKey, metadata: { stopPublicKey: stop.publicKey, direction, sequence: routeStop.sequence } });
      return routeStop;
    });
  } catch (error) { return prismaConflict(error, "This route stop or stop order already exists."); }
}

export async function updateTransportRouteStop(client: any, actor: TransportActor, value: unknown) {
  requirePermission(actor, "MANAGE_TRANSPORT_ROUTES");
  const row = object(value), key = publicKey(row.publicKey, "Route stop reference"), expectedVersion = integer(row.expectedVersion, "Expected version", 1);
  const data: Record<string, unknown> = {};
  if (row.sequence !== undefined) data.sequence = integer(row.sequence, "Stop order", 1, 200);
  if (row.timingReference !== undefined) data.timingReference = optionalText(row.timingReference, "Approved timing", 80);
  if (row.active !== undefined) {
    if (typeof row.active !== "boolean") throw new TransportError("Route stop active state is invalid.");
    data.active = row.active;
  }
  return client.$transaction(async (tx: any) => {
    const current = await tx.transportRouteStop.findUnique({ where: { publicKey: key }, include: { route: true } });
    if (!current) throw new TransportError("Route stop not found.", 404, "TRANSPORT_NOT_FOUND");
    if (data.active === false && await tx.transportStudentAssignment.count({ where: { AND: [{ OR: [{ effectiveTo: null }, { effectiveTo: { gte: todayUtc() } }] }, { OR: [{ pickupRouteStopId: current.id }, { dropRouteStopId: current.id }] }] } })) throw new TransportError("An assigned route stop cannot be made inactive.", 409, "TRANSPORT_STOP_IN_USE");
    try {
      const changed = await tx.transportRouteStop.updateMany({ where: { id: current.id, version: expectedVersion }, data: { ...data, version: { increment: 1 } } });
      if (changed.count !== 1) throw new TransportError("The route stop changed. Refresh and retry.", 409, "TRANSPORT_STALE_VERSION");
      const routeStop = await tx.transportRouteStop.findUnique({ where: { id: current.id } });
      await transportAudit(tx, actor, { eventType: "ROUTE_STOP_UPDATED", entityType: "ROUTE", entityPublicKey: current.route.publicKey, metadata: { routeStopPublicKey: current.publicKey, direction: current.direction, priorSequence: current.sequence, sequence: routeStop.sequence, priorTimingReference: current.timingReference, timingReference: routeStop.timingReference, priorActive: current.active, active: routeStop.active } });
      return routeStop;
    } catch (error) { return prismaConflict(error, "This stop order conflicts with another route stop."); }
  });
}

export async function assignTransportStudent(client: any, actor: TransportActor, value: unknown) {
  requirePermission(actor, "MANAGE_TRANSPORT_ASSIGNMENTS");
  const row = object(value), admissionNo = text(row.admissionNo, "Admission number", 1, 40), routeKey = publicKey(row.routeKey, "Route reference"), pickupKey = publicKey(row.pickupRouteStopKey, "Pickup stop reference"), dropKey = publicKey(row.dropRouteStopKey, "Drop stop reference"), effectiveFrom = dateOnly(row.effectiveFrom, "Effective from"), effectiveTo = row.effectiveTo ? dateOnly(row.effectiveTo, "Effective to") : null, changeReason = text(row.changeReason, "Change reason", 5, 240);
  if (effectiveTo && effectiveTo < effectiveFrom) throw new TransportError("Effective to cannot be before effective from.");
  try {
    return await client.$transaction(async (tx: any) => {
      const [student, route, pickup, drop] = await Promise.all([
        tx.student.findUnique({ where: { admissionNo }, select: { id: true, status: true } }),
        tx.transportRoute.findUnique({ where: { publicKey: routeKey }, include: { vehicle: true } }),
        tx.transportRouteStop.findUnique({ where: { publicKey: pickupKey }, include: { stop: true } }),
        tx.transportRouteStop.findUnique({ where: { publicKey: dropKey }, include: { stop: true } })
      ]);
      if (!student || student.status !== "Active") throw new TransportError("An active Student is required.", 409, "TRANSPORT_STUDENT_INACTIVE");
      if (!route || route.status !== "ACTIVE") throw new TransportError("An active route is required.", 409, "TRANSPORT_ROUTE_INACTIVE");
      if (route.vehicle.status !== "ACTIVE") throw new TransportError("The assigned vehicle is inactive.", 409, "TRANSPORT_VEHICLE_INACTIVE");
      if (!pickup || !pickup.active || !pickup.stop.active || pickup.routeId !== route.id || pickup.direction !== "MORNING") throw new TransportError("Pickup stop must be an active morning stop on the selected route.", 409, "TRANSPORT_PICKUP_INVALID");
      if (!drop || !drop.active || !drop.stop.active || drop.routeId !== route.id || drop.direction !== "EVENING") throw new TransportError("Drop stop must be an active evening stop on the selected route.", 409, "TRANSPORT_DROP_INVALID");
      const current = await tx.transportStudentAssignment.findUnique({ where: { activeStudentId: student.id } });
      if (current && effectiveFrom <= current.effectiveFrom) throw new TransportError("A reassignment must start after the current assignment start date.", 409, "TRANSPORT_EFFECTIVE_DATE_CONFLICT");
      if (current) {
        const expectedCurrentKey = row.expectedCurrentAssignmentKey === undefined ? null : publicKey(row.expectedCurrentAssignmentKey, "Expected current assignment"), expectedCurrentVersion = row.expectedCurrentVersion === undefined ? null : integer(row.expectedCurrentVersion, "Expected current version", 1);
        if (expectedCurrentKey !== current.publicKey || expectedCurrentVersion !== current.version) throw new TransportError("The current assignment changed. Refresh and retry.", 409, "TRANSPORT_STALE_ASSIGNMENT");
        const ended = await tx.transportStudentAssignment.updateMany({ where: { id: current.id, active: true, version: expectedCurrentVersion }, data: { active: false, activeStudentId: null, effectiveTo: new Date(effectiveFrom.getTime() - 86_400_000), version: { increment: 1 } } });
        if (ended.count !== 1) throw new TransportError("The current assignment changed. Refresh and retry.", 409, "TRANSPORT_STALE_ASSIGNMENT");
        const released = await tx.transportRoute.updateMany({ where: { id: current.routeId, allocatedSeats: { gt: 0 } }, data: { allocatedSeats: { decrement: 1 } } });
        if (released.count !== 1) throw new TransportError("Existing route allocation is inconsistent.", 409, "TRANSPORT_ALLOCATION_INCONSISTENT");
      } else if (row.expectedCurrentAssignmentKey !== undefined || row.expectedCurrentVersion !== undefined) throw new TransportError("The current assignment changed. Refresh and retry.", 409, "TRANSPORT_STALE_ASSIGNMENT");
      const overlapping = await tx.transportStudentAssignment.count({ where: { routeId: route.id, ...intervalOverlap(effectiveFrom, effectiveTo) } });
      if (overlapping >= route.capacity) throw new TransportError("Route capacity is full for the requested effective dates.", 409, "TRANSPORT_CAPACITY_FULL");
      const reserved = await tx.transportRoute.updateMany({ where: { id: route.id, status: "ACTIVE", allocatedSeats: { lt: route.capacity } }, data: { allocatedSeats: { increment: 1 } } });
      if (reserved.count !== 1) throw new TransportError("Route capacity is full.", 409, "TRANSPORT_CAPACITY_FULL");
      const assignment = await tx.transportStudentAssignment.create({ data: { studentId: student.id, activeStudentId: student.id, routeId: route.id, pickupRouteStopId: pickup.id, dropRouteStopId: drop.id, routeCodeSnapshot: route.code, routeNameSnapshot: route.name, pickupStopSnapshot: pickup.stop.name, pickupTimingSnapshot: pickup.timingReference ?? pickup.stop.approvedReference, dropStopSnapshot: drop.stop.name, dropTimingSnapshot: drop.timingReference ?? drop.stop.approvedReference, effectiveFrom, effectiveTo, active: true, changeReason, replacesAssignmentId: current?.id ?? null, createdByUserId: actor.id, createdByRole: actor.role } });
      if (current) await transportAudit(tx, actor, { eventType: "ASSIGNMENT_ENDED", entityType: "STUDENT_ASSIGNMENT", entityPublicKey: current.publicKey, metadata: { studentId: student.id, routeId: current.routeId, originalChangeReason: current.changeReason, supersededEffectiveTo: new Date(effectiveFrom.getTime() - 86_400_000).toISOString().slice(0, 10), replacedByPublicKey: assignment.publicKey } });
      await transportAudit(tx, actor, { eventType: current ? "STUDENT_REASSIGNED" : "STUDENT_ASSIGNED", entityType: "STUDENT_ASSIGNMENT", entityPublicKey: assignment.publicKey, metadata: { studentId: student.id, routePublicKey: route.publicKey, routeCode: route.code, routeName: route.name, pickupStopPublicKey: pickup.stop.publicKey, pickupStop: pickup.stop.name, pickupTiming: pickup.timingReference ?? pickup.stop.approvedReference, dropStopPublicKey: drop.stop.publicKey, dropStop: drop.stop.name, dropTiming: drop.timingReference ?? drop.stop.approvedReference, effectiveFrom: effectiveFrom.toISOString().slice(0, 10), effectiveTo: effectiveTo?.toISOString().slice(0, 10) ?? null, changeReason } });
      return assignment;
    });
  } catch (error) { return prismaConflict(error, "The Student already has an active Transport assignment."); }
}

export async function deactivateTransportAssignment(client: any, actor: TransportActor, value: unknown) {
  requirePermission(actor, "MANAGE_TRANSPORT_ASSIGNMENTS");
  const row = object(value), key = publicKey(row.publicKey, "Assignment reference"), expectedVersion = integer(row.expectedVersion, "Expected version", 1), reason = text(row.reason, "Reason", 5, 240), effectiveTo = dateOnly(row.effectiveTo, "Effective to");
  return client.$transaction(async (tx: any) => {
    const current = await tx.transportStudentAssignment.findUnique({ where: { publicKey: key } });
    if (!current) throw new TransportError("Assignment not found.", 404, "TRANSPORT_NOT_FOUND");
    if (!current.active) throw new TransportError("Assignment is already inactive.", 409, "TRANSPORT_ASSIGNMENT_INACTIVE");
    if (effectiveTo < current.effectiveFrom) throw new TransportError("Effective to cannot be before assignment start.");
    const changed = await tx.transportStudentAssignment.updateMany({ where: { id: current.id, active: true, version: expectedVersion }, data: { active: false, activeStudentId: null, effectiveTo, version: { increment: 1 } } });
    if (changed.count !== 1) throw new TransportError("The assignment changed. Refresh and retry.", 409, "TRANSPORT_STALE_VERSION");
    const released = await tx.transportRoute.updateMany({ where: { id: current.routeId, allocatedSeats: { gt: 0 } }, data: { allocatedSeats: { decrement: 1 } } });
    if (released.count !== 1) throw new TransportError("Route allocation is inconsistent.", 409, "TRANSPORT_ALLOCATION_INCONSISTENT");
    await transportAudit(tx, actor, { eventType: "ASSIGNMENT_DEACTIVATED", entityType: "STUDENT_ASSIGNMENT", entityPublicKey: current.publicKey, metadata: { studentId: current.studentId, routeId: current.routeId, originalChangeReason: current.changeReason, deactivationReason: reason, effectiveTo: effectiveTo.toISOString().slice(0, 10) } });
    return tx.transportStudentAssignment.findUnique({ where: { id: current.id } });
  });
}

const workspaceRouteSelect = { publicKey: true, code: true, name: true, directionMode: true, capacity: true, status: true, version: true, vehicle: { select: { publicKey: true, registrationCode: true, displayName: true, capacity: true, status: true } }, driverStaffMember: { select: { staffCode: true, fullName: true } }, attendantStaffMember: { select: { staffCode: true, fullName: true } }, routeStops: { select: { publicKey: true, direction: true, sequence: true, timingReference: true, active: true, version: true, stop: { select: { publicKey: true, code: true, name: true, approvedReference: true, active: true } } }, orderBy: [{ direction: "asc" }, { sequence: "asc" }] } } as const;

export async function transportWorkspace(client: any, actor: TransportActor) {
  requirePermission(actor, "VIEW_TRANSPORT");
  const canManageVehicles = actor.permissions.has("MANAGE_TRANSPORT_VEHICLES"), canManageRoutes = actor.permissions.has("MANAGE_TRANSPORT_ROUTES"), canManageAssignments = actor.permissions.has("MANAGE_TRANSPORT_ASSIGNMENTS"), asOf = todayUtc();
  const [vehicleRows, routeRows, stopRows, assignmentRows, students, staff] = await Promise.all([
    client.transportVehicle.findMany({ select: { publicKey: true, registrationCode: true, displayName: true, capacity: true, status: true, version: true }, orderBy: { displayName: "asc" }, take: 500 }),
    client.transportRoute.findMany({ select: workspaceRouteSelect, orderBy: { code: "asc" }, take: 500 }),
    client.transportStop.findMany({ select: { publicKey: true, code: true, name: true, approvedReference: true, active: true, version: true }, orderBy: { name: "asc" }, take: 1_000 }),
    client.transportStudentAssignment.findMany({ select: { publicKey: true, version: true, active: true, effectiveFrom: true, effectiveTo: true, routeCodeSnapshot: true, routeNameSnapshot: true, pickupStopSnapshot: true, pickupTimingSnapshot: true, dropStopSnapshot: true, dropTimingSnapshot: true, student: { select: { admissionNo: true, studentName: true, className: true, section: true } } }, orderBy: { createdAt: "desc" }, take: 1_000 }),
    canManageAssignments ? client.student.findMany({ where: { status: "Active", deletedAt: null }, select: { admissionNo: true, studentName: true, className: true, section: true }, orderBy: { studentName: "asc" }, take: 5_000 }) : Promise.resolve([]),
    canManageRoutes ? client.staffMember.findMany({ where: { status: "ACTIVE", staffCode: { not: null } }, select: { staffCode: true, fullName: true }, orderBy: { fullName: "asc" }, take: 1_000 }) : Promise.resolve([])
  ]);
  const assignments = assignmentRows.map((row: any) => {
    const current = row.effectiveFrom <= asOf && (!row.effectiveTo || row.effectiveTo >= asOf), scheduled = row.effectiveFrom > asOf;
    return { publicKey: row.publicKey, ...(canManageAssignments ? { version: row.version, open: row.active } : {}), active: current, lifecycleStatus: current ? "CURRENT" : scheduled ? "SCHEDULED" : "HISTORY", effectiveFrom: row.effectiveFrom, effectiveTo: row.effectiveTo, student: row.student, route: { code: row.routeCodeSnapshot, name: row.routeNameSnapshot }, pickupRouteStop: { timingReference: row.pickupTimingSnapshot, stop: { name: row.pickupStopSnapshot } }, dropRouteStop: { timingReference: row.dropTimingSnapshot, stop: { name: row.dropStopSnapshot } } };
  });
  const currentByRoute = new Map<string, number>();
  for (const assignment of assignments) if (assignment.active) currentByRoute.set(assignment.route.code, (currentByRoute.get(assignment.route.code) ?? 0) + 1);
  const vehicles = vehicleRows.map((row: any) => canManageVehicles ? row : (({ version: _version, ...safe }) => safe)(row));
  const routes = routeRows.map((row: any) => ({ ...row, allocatedSeats: currentByRoute.get(row.code) ?? 0, ...(canManageRoutes ? {} : { version: undefined, routeStops: row.routeStops.map(({ version: _version, ...safe }: any) => safe) }) }));
  const stops = stopRows.map((row: any) => canManageRoutes ? row : (({ version: _version, ...safe }) => safe)(row));
  return { vehicles, routes, stops, assignments, students, staff, policy: { capacity: "HARD_BLOCK_EFFECTIVE_INTERVAL", locationData: "APPROVED_STOP_ONLY", gps: false, automaticAlerts: false, financePosting: false } };
}

export async function transportReport(client: any, actor: TransportActor) {
  requirePermission(actor, "EXPORT_TRANSPORT_REPORTS");
  const rows = await client.transportStudentAssignment.findMany({ where: currentOn(todayUtc()), select: { effectiveFrom: true, effectiveTo: true, routeCodeSnapshot: true, routeNameSnapshot: true, pickupStopSnapshot: true, dropStopSnapshot: true, student: { select: { admissionNo: true, studentName: true, className: true, section: true } } }, orderBy: [{ routeCodeSnapshot: "asc" }, { student: { studentName: "asc" } }], take: 10_000 });
  return { generatedAt: new Date().toISOString(), rows, privacy: "NO_HOME_ADDRESSES_OR_PRIVATE_STAFF_CONTACTS" };
}

function csvCell(value: unknown) {
  let textValue = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(textValue)) textValue = `'${textValue}`;
  return `"${textValue.replaceAll('"', '""')}"`;
}

export function transportReportCsv(report: Awaited<ReturnType<typeof transportReport>>) {
  const rows = [["Admission No", "Student", "Class", "Section", "Route Code", "Route", "Pickup Stop", "Drop Stop", "Effective From", "Effective To"], ...report.rows.map((row: any) => [row.student.admissionNo, row.student.studentName, row.student.className, row.student.section ?? "", row.routeCodeSnapshot, row.routeNameSnapshot, row.pickupStopSnapshot, row.dropStopSnapshot, row.effectiveFrom.toISOString().slice(0, 10), row.effectiveTo?.toISOString().slice(0, 10) ?? ""] )];
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export async function parentTransportView(client: any, actor: TransportActor, admissionNo?: string | null) {
  requirePermission(actor, "VIEW_OWN_CHILD_TRANSPORT");
  if (actor.role !== "PARENT" || !actor.id) throw new TransportError("Parent linked-child access is required.", 403, "TRANSPORT_PARENT_ONLY");
  const user = await client.user.findUnique({ where: { id: actor.id }, select: { guardianId: true } });
  if (!user?.guardianId) return { children: [] };
  const links = await client.studentGuardian.findMany({ where: { guardianId: user.guardianId, ...(admissionNo ? { student: { admissionNo } } : {}) }, select: { studentId: true } });
  if (admissionNo && links.length === 0) throw new TransportError("Transport assignment not found.", 404, "TRANSPORT_CHILD_NOT_FOUND");
  const assignments = await client.transportStudentAssignment.findMany({ where: { studentId: { in: links.map((link: any) => link.studentId) }, ...currentOn(todayUtc()) }, select: { effectiveFrom: true, effectiveTo: true, routeCodeSnapshot: true, routeNameSnapshot: true, pickupStopSnapshot: true, pickupTimingSnapshot: true, dropStopSnapshot: true, dropTimingSnapshot: true, student: { select: { admissionNo: true, studentName: true, className: true, section: true } } }, orderBy: { effectiveFrom: "desc" } });
  return { children: assignments.map((assignment: any) => ({ student: assignment.student, route: { code: assignment.routeCodeSnapshot, name: assignment.routeNameSnapshot }, pickup: { stop: assignment.pickupStopSnapshot, timing: assignment.pickupTimingSnapshot }, drop: { stop: assignment.dropStopSnapshot, timing: assignment.dropTimingSnapshot }, effectiveFrom: assignment.effectiveFrom, effectiveTo: assignment.effectiveTo })) };
}
