import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertProtocolActivation, biometricProtocolProfile, GENERIC_CONTRACT_PROFILES, protocolProfileStatus, VENDOR_PROTOCOL_PROFILES } from "@/lib/biometric-attendance/profiles";
import { normalizeBridgeJwk } from "@/lib/biometric-attendance/jwk";

type Db = PrismaClient | Prisma.TransactionClient;
const BRIDGE_STATUSES = ["PENDING_APPROVAL", "ACTIVE", "REVOKED", "RETIRED"] as const;
const DEVICE_STATUSES = ["PENDING_APPROVAL", "ACTIVE", "REVOKED", "RETIRED"] as const;

export async function createBiometricBridge(input: unknown, actorUserId: string) {
  const source = object(input);
  const label = text(source.label, "Bridge label", 100);
  const key = normalizeBridgeJwk(source.publicSigningKey);
  const serialized = JSON.stringify(key.jwk);
  return prisma.$transaction(async (tx) => {
    const bridge = await tx.biometricBridge.create({ data: { label, publicSigningKey: serialized, publicKeyHash: sha256(serialized), keyAlgorithm: key.algorithm } });
    await event(tx, "BRIDGE", bridge.id, "BRIDGE_REGISTRATION_PREPARED", actorUserId, { keyVersion: 1 });
    return safeBridge(bridge);
  });
}

export async function transitionBiometricBridge(id: string, action: "APPROVE" | "REVOKE" | "RETIRE", actorUserId: string, reason?: unknown) {
  return prisma.$transaction(async (tx) => {
    const bridge = await tx.biometricBridge.findUnique({ where: { id } });
    if (!bridge) throw new Error("BIOMETRIC_BRIDGE_NOT_FOUND");
    if (action === "APPROVE") {
      if (bridge.status !== "PENDING_APPROVAL") throw new Error("BIOMETRIC_BRIDGE_APPROVAL_STATE_INVALID");
      const changed = await tx.biometricBridge.updateMany({ where: { id, status: "PENDING_APPROVAL" }, data: { status: "ACTIVE", approvedByUserId: actorUserId, approvedAt: new Date() } });
      if (changed.count !== 1) throw new Error("BIOMETRIC_BRIDGE_CONCURRENT_TRANSITION");
      const updated = (await tx.biometricBridge.findUnique({ where: { id } }))!;
      await event(tx, "BRIDGE", id, "BRIDGE_APPROVED", actorUserId);
      return safeBridge(updated);
    }
    const explanation = text(reason, "Revocation reason", 500);
    if (!(["ACTIVE", "PENDING_APPROVAL"] as string[]).includes(bridge.status)) throw new Error("BIOMETRIC_BRIDGE_REVOCATION_STATE_INVALID");
    const status = action === "RETIRE" ? "RETIRED" : "REVOKED";
    const changed = await tx.biometricBridge.updateMany({ where: { id, status: bridge.status }, data: { status, revokedByUserId: actorUserId, revokedAt: new Date(), revocationReason: explanation } });
    if (changed.count !== 1) throw new Error("BIOMETRIC_BRIDGE_CONCURRENT_TRANSITION");
    const updated = (await tx.biometricBridge.findUnique({ where: { id } }))!;
    await tx.biometricDevice.updateMany({ where: { bridgeId: id, status: { in: ["ACTIVE", "PENDING_APPROVAL"] } }, data: { status: "REVOKED", revokedByUserId: actorUserId, revokedAt: new Date(), revocationReason: "Parent bridge revoked" } });
    await event(tx, "BRIDGE", id, `BRIDGE_${status}`, actorUserId, { devicesRevoked: true });
    return safeBridge(updated);
  });
}

export async function rotateBiometricBridgeKey(id: string, publicSigningKey: unknown, actorUserId: string) {
  const key = normalizeBridgeJwk(publicSigningKey), serialized = JSON.stringify(key.jwk);
  return prisma.$transaction(async (tx) => {
    const bridge = await tx.biometricBridge.findUnique({ where: { id } });
    if (!bridge || bridge.status !== "ACTIVE") throw new Error("BIOMETRIC_BRIDGE_NOT_ACTIVE");
    if (sha256(serialized) === bridge.publicKeyHash) throw new Error("BIOMETRIC_BRIDGE_KEY_UNCHANGED");
    const changed = await tx.biometricBridge.updateMany({ where: { id, status: "ACTIVE", keyVersion: bridge.keyVersion }, data: { publicSigningKey: serialized, publicKeyHash: sha256(serialized), keyAlgorithm: key.algorithm, keyVersion: { increment: 1 } } });
    if (changed.count !== 1) throw new Error("BIOMETRIC_BRIDGE_KEY_ROTATION_CONFLICT");
    const updated = (await tx.biometricBridge.findUnique({ where: { id } }))!;
    await event(tx, "BRIDGE", id, "BRIDGE_KEY_ROTATED", actorUserId, { priorKeyVersion: bridge.keyVersion, keyVersion: updated.keyVersion });
    return safeBridge(updated);
  });
}

export async function registerBiometricDevice(input: unknown, actorUserId: string) {
  const source = object(input);
  const bridgeId = id(source.bridgeId, "Bridge");
  const profile = biometricProtocolProfile(source.protocolProfile);
  const proofStatus = VENDOR_PROTOCOL_PROFILES.has(profile) ? "NOT_PROVIDED" : GENERIC_CONTRACT_PROFILES.has(profile) ? "ADAPTER_CONTRACT_PENDING" : "NOT_REQUIRED";
  const serialReferenceMasked = maskSerial(source.serialReference);
  return prisma.$transaction(async (tx) => {
    const bridge = await tx.biometricBridge.findUnique({ where: { id: bridgeId } });
    if (!bridge || bridge.status !== "ACTIVE") throw new Error("BIOMETRIC_BRIDGE_NOT_ACTIVE");
    const device = await tx.biometricDevice.create({ data: {
      bridgeId,
      vendor: text(source.vendor, "Device vendor", 80),
      model: text(source.model, "Device model", 100),
      firmware: optionalText(source.firmware, 100),
      serialReferenceMasked,
      campus: text(source.campus, "Campus", 100),
      location: text(source.location, "Location", 120),
      protocolProfile: profile,
      protocolProofStatus: proofStatus
    } });
    await event(tx, "DEVICE", device.id, "DEVICE_REGISTRATION_PREPARED", actorUserId, { profile, vendorProtocolBlocked: VENDOR_PROTOCOL_PROFILES.has(profile) });
    return safeDevice(device);
  });
}

export async function transitionBiometricDevice(idValue: string, action: "APPROVE" | "REVOKE" | "RETIRE" | "VERIFY_PROTOCOL", actorUserId: string, reason?: unknown) {
  return prisma.$transaction(async (tx) => {
    const device = await tx.biometricDevice.findUnique({ where: { id: idValue }, include: { bridge: true } });
    if (!device) throw new Error("BIOMETRIC_DEVICE_NOT_FOUND");
    if (action === "VERIFY_PROTOCOL") {
      const profile = biometricProtocolProfile(device.protocolProfile), vendor = VENDOR_PROTOCOL_PROFILES.has(profile), generic = GENERIC_CONTRACT_PROFILES.has(profile);
      if (!vendor && !generic) throw new Error("BIOMETRIC_PROTOCOL_PROOF_NOT_REQUIRED");
      const proof = text(reason, vendor ? "Official protocol evidence reference" : "Approved generic adapter contract reference", 300);
      const changed = await tx.biometricDevice.updateMany({ where: { id: idValue, status: "PENDING_APPROVAL", version: device.version }, data: { protocolProofStatus: vendor ? "OFFICIAL_VERIFIED" : "ADAPTER_CONTRACT_APPROVED", version: { increment: 1 } } });
      if (changed.count !== 1) throw new Error("BIOMETRIC_DEVICE_CONCURRENT_TRANSITION");
      const updated = (await tx.biometricDevice.findUnique({ where: { id: idValue } }))!;
      await event(tx, "DEVICE", idValue, vendor ? "DEVICE_OFFICIAL_PROTOCOL_VERIFIED" : "DEVICE_GENERIC_ADAPTER_CONTRACT_APPROVED", actorUserId, { evidenceReferenceHash: sha256(proof) });
      return safeDevice(updated);
    }
    if (action === "APPROVE") {
      if (device.status !== "PENDING_APPROVAL" || device.bridge.status !== "ACTIVE") throw new Error("BIOMETRIC_DEVICE_APPROVAL_STATE_INVALID");
      assertProtocolActivation(biometricProtocolProfile(device.protocolProfile), device.protocolProofStatus);
      const changed = await tx.biometricDevice.updateMany({ where: { id: idValue, status: "PENDING_APPROVAL", version: device.version }, data: { status: "ACTIVE", approvedByUserId: actorUserId, approvedAt: new Date(), healthStatus: "AWAITING_FIRST_SYNC", version: { increment: 1 } } });
      if (changed.count !== 1) throw new Error("BIOMETRIC_DEVICE_CONCURRENT_TRANSITION");
      const updated = (await tx.biometricDevice.findUnique({ where: { id: idValue } }))!;
      await event(tx, "DEVICE", idValue, "DEVICE_APPROVED", actorUserId, { profile: device.protocolProfile });
      return safeDevice(updated);
    }
    const explanation = text(reason, "Device revocation reason", 500);
    if (!(["ACTIVE", "PENDING_APPROVAL"] as string[]).includes(device.status)) throw new Error("BIOMETRIC_DEVICE_REVOCATION_STATE_INVALID");
    const status = action === "RETIRE" ? "RETIRED" : "REVOKED";
    const changed = await tx.biometricDevice.updateMany({ where: { id: idValue, status: device.status, version: device.version }, data: { status, revokedByUserId: actorUserId, revokedAt: new Date(), revocationReason: explanation, healthStatus: status, version: { increment: 1 } } });
    if (changed.count !== 1) throw new Error("BIOMETRIC_DEVICE_CONCURRENT_TRANSITION");
    const updated = (await tx.biometricDevice.findUnique({ where: { id: idValue } }))!;
    await tx.biometricStaffMapping.updateMany({ where: { deviceId: idValue, status: { in: ["ACTIVE", "PENDING_APPROVAL"] } }, data: { status: "REVOKED", revokedByUserId: actorUserId, revokedAt: new Date(), revocationReason: "Device revoked" } });
    await event(tx, "DEVICE", idValue, `DEVICE_${status}`, actorUserId);
    return safeDevice(updated);
  });
}

export async function prepareBiometricMapping(input: unknown, actorUserId: string) {
  const source = object(input), deviceId = id(source.deviceId, "Device"), staffMemberId = id(source.staffMemberId, "Staff member");
  const opaqueDeviceUserId = opaqueId(source.opaqueDeviceUserId), effectiveFrom = date(source.effectiveFrom, "Mapping effective date"), effectiveTo = optionalDate(source.effectiveTo, "Mapping end date");
  if (effectiveTo && effectiveTo < effectiveFrom) throw new Error("BIOMETRIC_MAPPING_DATE_RANGE_INVALID");
  const reason = text(source.reason, "Mapping reason", 500);
  return prisma.$transaction(async (tx) => {
    const [device, staff, conflict] = await Promise.all([
      tx.biometricDevice.findUnique({ where: { id: deviceId } }),
      tx.staffMember.findUnique({ where: { id: staffMemberId } }),
      tx.biometricStaffMapping.findFirst({ where: { deviceId, opaqueDeviceUserId, status: { in: ["PENDING_APPROVAL", "ACTIVE"] }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveFrom } }] } })
    ]);
    if (!device || device.status !== "ACTIVE") throw new Error("BIOMETRIC_DEVICE_NOT_ACTIVE");
    if (!staff || staff.status !== "ACTIVE") throw new Error("BIOMETRIC_MAPPING_INACTIVE_STAFF");
    if (conflict) throw new Error("BIOMETRIC_MAPPING_CONFLICT");
    const mapping = await tx.biometricStaffMapping.create({ data: { deviceId, opaqueDeviceUserId, staffMemberId, effectiveFrom, effectiveTo, preparedByUserId: actorUserId, preparationReason: reason } });
    await event(tx, "MAPPING", mapping.id, "MAPPING_PREPARED", actorUserId, { deviceId, staffMemberId });
    return mapping;
  });
}

export async function transitionBiometricMapping(idValue: string, action: "APPROVE" | "REVOKE", actorUserId: string, reason?: unknown) {
  return prisma.$transaction(async (tx) => {
    const mapping = await tx.biometricStaffMapping.findUnique({ where: { id: idValue }, include: { staffMember: true, device: true } });
    if (!mapping) throw new Error("BIOMETRIC_MAPPING_NOT_FOUND");
    if (action === "APPROVE") {
      if (mapping.status !== "PENDING_APPROVAL" || mapping.preparedByUserId === actorUserId) throw new Error("BIOMETRIC_MAPPING_DUAL_CONTROL_REQUIRED");
      if (mapping.staffMember.status !== "ACTIVE" || mapping.device.status !== "ACTIVE") throw new Error("BIOMETRIC_MAPPING_LINK_INACTIVE");
      const conflict = await tx.biometricStaffMapping.findFirst({ where: { id: { not: mapping.id }, deviceId: mapping.deviceId, opaqueDeviceUserId: mapping.opaqueDeviceUserId, status: "ACTIVE", OR: [{ effectiveTo: null }, { effectiveTo: { gte: mapping.effectiveFrom } }] } });
      if (conflict) throw new Error("BIOMETRIC_MAPPING_CONFLICT");
      const changed = await tx.biometricStaffMapping.updateMany({ where: { id: idValue, status: "PENDING_APPROVAL", version: mapping.version }, data: { status: "ACTIVE", approvedByUserId: actorUserId, approvedAt: new Date(), version: { increment: 1 } } });
      if (changed.count !== 1) throw new Error("BIOMETRIC_MAPPING_CONCURRENT_TRANSITION");
      const updated = (await tx.biometricStaffMapping.findUnique({ where: { id: idValue } }))!;
      await event(tx, "MAPPING", idValue, "MAPPING_APPROVED", actorUserId, { staffMemberId: mapping.staffMemberId });
      return updated;
    }
    const explanation = text(reason, "Mapping revocation reason", 500);
    if (!(["ACTIVE", "PENDING_APPROVAL"] as string[]).includes(mapping.status)) throw new Error("BIOMETRIC_MAPPING_REVOCATION_STATE_INVALID");
    const changed = await tx.biometricStaffMapping.updateMany({ where: { id: idValue, status: mapping.status, version: mapping.version }, data: { status: "REVOKED", effectiveTo: mapping.effectiveTo ?? new Date(), revokedByUserId: actorUserId, revokedAt: new Date(), revocationReason: explanation, version: { increment: 1 } } });
    if (changed.count !== 1) throw new Error("BIOMETRIC_MAPPING_CONCURRENT_TRANSITION");
    const updated = (await tx.biometricStaffMapping.findUnique({ where: { id: idValue } }))!;
    await event(tx, "MAPPING", idValue, "MAPPING_REVOKED", actorUserId);
    return updated;
  });
}

export async function createBiometricPolicy(input: unknown, actorUserId: string) {
  const source = object(input);
  const start = time(source.shiftStartTime, "Shift start"), end = time(source.shiftEndTime, "Shift end");
  const overnight = source.overnightShiftEnabled === true, split = source.splitShiftEnabled === true;
  const shiftType = choice(source.shiftType, ["DAY", "OVERNIGHT", "SPLIT"], "DAY", "Shift type");
  if (overnight || split || shiftType !== "DAY") throw new Error("BIOMETRIC_COMPLEX_SHIFT_REQUIRES_LATER_CONFIGURATION");
  const halfDayThresholdMinutes = integerDefault(source.halfDayThresholdMinutes, 240, 1, 1_440, "Half-day threshold");
  const fullDayThresholdMinutes = integerDefault(source.fullDayThresholdMinutes, 480, 1, 1_440, "Full-day threshold");
  if (fullDayThresholdMinutes < halfDayThresholdMinutes) throw new Error("BIOMETRIC_POLICY_DURATION_THRESHOLDS_INVALID");
  return prisma.biometricAttendancePolicy.create({ data: {
    name: text(source.name, "Policy name", 120), campus: text(source.campus, "Campus", 100), effectiveFrom: date(source.effectiveFrom, "Effective date"), effectiveTo: optionalDate(source.effectiveTo, "Policy end date"), shiftStartTime: start, shiftEndTime: end,
    workdayBasis: choice(source.workdayBasis, ["PUBLISHED_CALENDAR"], "PUBLISHED_CALENDAR", "Workday basis"), shiftType: "DAY",
    graceMinutes: integerDefault(source.graceMinutes, 0, 0, 240, "Grace minutes"), lateThresholdMinutes: integerDefault(source.lateThresholdMinutes, 0, 0, 240, "Late threshold"),
    earlyDepartureGraceMinutes: integerDefault(source.earlyDepartureGraceMinutes, 0, 0, 240, "Early-departure grace"), earlyDepartureThresholdMinutes: integerDefault(source.earlyDepartureThresholdMinutes, 0, 0, 240, "Early-departure threshold"),
    fullDayThresholdMinutes, halfDayThresholdMinutes, halfDayRule: choice(source.halfDayRule, ["DURATION_THRESHOLD", "CALENDAR_HALF_DAY"], "DURATION_THRESHOLD", "Half-day rule"),
    missingInBehavior: choice(source.missingInBehavior, ["EXCEPTION", "ABSENT_PENDING_REVIEW"], "EXCEPTION", "Missing-IN behavior"), missingOutBehavior: choice(source.missingOutBehavior, ["EXCEPTION", "ABSENT_PENDING_REVIEW"], "EXCEPTION", "Missing-OUT behavior"),
    multiplePunchStrategy: choice(source.multiplePunchStrategy, ["FIRST_IN_LAST_OUT_FLAG", "ADMIN_REVIEW"], "FIRST_IN_LAST_OUT_FLAG", "Multiple-punch strategy"),
    leaveInteraction: choice(source.leaveInteraction, ["APPROVED_LEAVE_GOVERNS", "FLAG_PUNCH"], "APPROVED_LEAVE_GOVERNS", "Leave interaction"), holidayInteraction: choice(source.holidayInteraction, ["FLAG_PUNCH", "IGNORE_NO_PUNCH"], "FLAG_PUNCH", "Holiday interaction"),
    overnightShiftEnabled: false, splitShiftEnabled: false, preparedByUserId: actorUserId
  } });
}

export async function approveBiometricPolicy(idValue: string, actorUserId: string) {
  return prisma.$transaction(async (tx) => {
    const policy = await tx.biometricAttendancePolicy.findUnique({ where: { id: idValue } });
    if (!policy || policy.status !== "DRAFT" || policy.preparedByUserId === actorUserId) throw new Error("BIOMETRIC_POLICY_DUAL_CONTROL_REQUIRED");
    const conflict = await tx.biometricAttendancePolicy.findFirst({ where: { id: { not: idValue }, campus: policy.campus, status: "ACTIVE", OR: [{ effectiveTo: null }, { effectiveTo: { gte: policy.effectiveFrom } }] } });
    if (conflict) throw new Error("BIOMETRIC_POLICY_DATE_CONFLICT");
    const changed = await tx.biometricAttendancePolicy.updateMany({ where: { id: idValue, status: "DRAFT", version: policy.version }, data: { status: "ACTIVE", approvedByUserId: actorUserId, approvedAt: new Date(), version: { increment: 1 } } });
    if (changed.count !== 1) throw new Error("BIOMETRIC_POLICY_CONCURRENT_TRANSITION");
    const updated = (await tx.biometricAttendancePolicy.findUnique({ where: { id: idValue } }))!;
    await event(tx, "POLICY", idValue, "POLICY_APPROVED", actorUserId);
    return updated;
  });
}

export async function loadBiometricWorkspace() {
  const [bridges, devices, mappings, policies, punches, reconciliations, gaps, corrections, auditEvents, activeStaff] = await Promise.all([
    prisma.biometricBridge.findMany({ orderBy: { createdAt: "desc" } }), prisma.biometricDevice.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.biometricStaffMapping.findMany({ include: { staffMember: { select: { staffCode: true, fullName: true, status: true } }, device: { select: { publicDeviceId: true, model: true, campus: true } } }, orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.biometricAttendancePolicy.findMany({ orderBy: { effectiveFrom: "desc" } }),
    prisma.biometricRawPunch.findMany({ include: { staffMember: { select: { staffCode: true, fullName: true } }, device: { select: { model: true, campus: true, location: true } } }, orderBy: { receivedTimestamp: "desc" }, take: 500 }),
    prisma.biometricReconciliation.findMany({ include: { staffMember: { select: { staffCode: true, fullName: true, designation: true } }, corrections: { orderBy: { submittedAt: "desc" } } }, orderBy: [{ attendanceDate: "desc" }, { updatedAt: "desc" }], take: 500 }),
    prisma.biometricSequenceGap.findMany({ include: { device: { select: { model: true, campus: true } } }, orderBy: { detectedAt: "desc" }, take: 200 }),
    prisma.biometricCorrection.findMany({ include: { reconciliation: { include: { staffMember: { select: { staffCode: true, fullName: true } } } } }, orderBy: { submittedAt: "desc" }, take: 200 }),
    prisma.biometricAuditEvent.findMany({ orderBy: { occurredAt: "desc" }, take: 200 }),
    prisma.staffMember.findMany({ where: { status: "ACTIVE" }, select: { id: true, staffCode: true, fullName: true, designation: true }, orderBy: { fullName: "asc" } })
  ]);
  return { bridges: bridges.map(safeBridge), devices: devices.map(safeDevice), mappings, policies, punches, reconciliations, gaps, corrections, auditEvents, activeStaff };
}

export function safeBridge<T extends { id: string; publicBridgeId: string; label: string; keyAlgorithm: string; keyVersion: number; status: string; approvedAt: Date | null; revokedAt: Date | null; revocationReason: string | null; lastSyncAt: Date | null; lastEventAt: Date | null; lastHealthAt: Date | null; createdAt: Date; updatedAt: Date }>(row: T) { return { id: row.id, publicBridgeId: row.publicBridgeId, label: row.label, keyAlgorithm: row.keyAlgorithm, keyVersion: row.keyVersion, status: row.status, approvedAt: row.approvedAt, revokedAt: row.revokedAt, revocationReason: row.revocationReason, lastSyncAt: row.lastSyncAt, lastEventAt: row.lastEventAt, lastHealthAt: row.lastHealthAt, createdAt: row.createdAt, updatedAt: row.updatedAt }; }
export function safeDevice<T extends { id: string; publicDeviceId: string; bridgeId: string; vendor: string; model: string; firmware: string | null; serialReferenceMasked: string | null; campus: string; location: string; protocolProfile: string; protocolProofStatus: string; status: string; healthStatus: string; clockDriftSeconds: number | null; clockDriftStatus: string; sequenceEpoch: number; lastSequence: number | null; lastEventAt: Date | null; lastSyncAt: Date | null; lastHealthAt: Date | null; approvedAt: Date | null; revokedAt: Date | null; revocationReason: string | null; createdAt: Date; updatedAt: Date }>(row: T) { return { id: row.id, publicDeviceId: row.publicDeviceId, bridgeId: row.bridgeId, vendor: row.vendor, model: row.model, firmware: row.firmware, serialReferenceMasked: row.serialReferenceMasked, campus: row.campus, location: row.location, protocolProfile: row.protocolProfile, protocolProofStatus: row.protocolProofStatus, profileStatus: protocolProfileStatus(biometricProtocolProfile(row.protocolProfile), row.protocolProofStatus), status: row.status, healthStatus: row.healthStatus, clockDriftSeconds: row.clockDriftSeconds, clockDriftStatus: row.clockDriftStatus, sequenceEpoch: row.sequenceEpoch, lastSequence: row.lastSequence, lastEventAt: row.lastEventAt, lastSyncAt: row.lastSyncAt, lastHealthAt: row.lastHealthAt, approvedAt: row.approvedAt, revokedAt: row.revokedAt, revocationReason: row.revocationReason, createdAt: row.createdAt, updatedAt: row.updatedAt }; }

async function event(client: Db, entityType: string, entityId: string, eventType: string, actorUserId: string, safeMetadata?: Record<string, string | number | boolean | null>) { return client.biometricAuditEvent.create({ data: { entityType, entityId, eventType, actorUserId, safeMetadataJson: safeMetadata ? JSON.stringify(safeMetadata) : null } }); }
function sha256(value: string) { return createHash("sha256").update(value).digest("hex"); }
function object(value: unknown) { if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("BIOMETRIC_INPUT_INVALID"); return value as Record<string, unknown>; }
function text(value: unknown, label: string, max: number) { const result = String(value ?? "").trim(); if (!result || result.length > max || /[\u0000-\u001f\u007f]/.test(result)) throw new Error(`${label} is invalid`); return result; }
function optionalText(value: unknown, max: number) { const result = String(value ?? "").trim(); return result ? text(result, "Value", max) : null; }
function id(value: unknown, label: string) { const result = String(value ?? "").trim(); if (!/^[A-Za-z0-9_-]{8,160}$/.test(result)) throw new Error(`${label} is invalid`); return result; }
function opaqueId(value: unknown) { const result = String(value ?? "").trim(); if (!/^[A-Za-z0-9._:@/-]{1,128}$/.test(result)) throw new Error("Opaque device user ID is invalid"); return result; }
function date(value: unknown, label: string) { const result = new Date(String(value ?? "")); if (Number.isNaN(result.getTime())) throw new Error(`${label} is invalid`); return new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth(), result.getUTCDate())); }
function optionalDate(value: unknown, label: string) { return value == null || String(value).trim() === "" ? null : date(value, label); }
function time(value: unknown, label: string) { const result = String(value ?? "").trim(); if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(result)) throw new Error(`${label} must use HH:MM`); return result; }
function integer(value: unknown, min: number, max: number, label: string) { const result = Number(value); if (!Number.isInteger(result) || result < min || result > max) throw new Error(`${label} is invalid`); return result; }
function integerDefault(value: unknown, fallback: number, min: number, max: number, label: string) { return value == null || String(value).trim() === "" ? fallback : integer(value, min, max, label); }
function choice<T extends string>(value: unknown, choices: readonly T[], fallback: T, label: string) { const result = String(value ?? fallback).trim().toUpperCase() as T; if (!choices.includes(result)) throw new Error(`${label} is invalid`); return result; }
function maskSerial(value: unknown) { const source = String(value ?? "").replace(/[^A-Za-z0-9]/g, ""); if (!source) return null; if (source.length > 64) throw new Error("Device serial reference is invalid"); return `***${source.slice(-4).toUpperCase()}`; }
