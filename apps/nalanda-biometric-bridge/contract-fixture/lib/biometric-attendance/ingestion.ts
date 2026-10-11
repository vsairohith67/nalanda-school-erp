import { Prisma, type BiometricBridge, type BiometricDevice } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertProtocolActivation } from "@/lib/biometric-attendance/profiles";
import { biometricEventIdentity, type BiometricIngestEnvelope, type NormalizedBiometricEvent, sha256Hex, stableJson } from "@/lib/biometric-attendance/contracts";
import { recordBiometricNonce } from "@/lib/biometric-attendance/trust";

type VerifiedRequest = { bridge: BiometricBridge; nonceHash: string; keyVersion: number; nonceExpiresAt: Date };
type DeviceState = { row: BiometricDevice; epoch: number; lastSequence: number | null; touched: boolean; lastEventAt: Date | null; lastSyncAt: Date | null; clockDriftSeconds: number | null; clockDriftStatus: string };

export async function ingestBiometricBatch(input: { envelope: BiometricIngestEnvelope; rawBody: string; verified: VerifiedRequest }) {
  if (input.verified.bridge.status !== "ACTIVE") throw new Error(input.verified.bridge.status === "REVOKED" ? "BIOMETRIC_BRIDGE_REVOKED" : "BIOMETRIC_BRIDGE_NOT_ACTIVE");
  const deviceIds = [...new Set(input.envelope.events.map((event) => event.deviceId))];
  const registeredDevices = await prisma.biometricDevice.findMany({ where: { publicDeviceId: { in: deviceIds } } });
  const registeredByPublicId = new Map(registeredDevices.map((device) => [device.publicDeviceId, device]));
  for (const event of input.envelope.events) {
    const device = registeredByPublicId.get(event.deviceId);
    if (!device || device.bridgeId !== input.verified.bridge.id) throw new Error("BIOMETRIC_DEVICE_NOT_REGISTERED");
    if (device.status !== "ACTIVE") throw new Error(device.status === "REVOKED" ? "BIOMETRIC_DEVICE_REVOKED" : "BIOMETRIC_DEVICE_NOT_ACTIVE");
    assertProtocolActivation(event.protocolProfile, device.protocolProofStatus);
    if (device.protocolProfile !== event.protocolProfile) throw new Error("BIOMETRIC_DEVICE_PROFILE_MISMATCH");
  }
  const requestHash = sha256Hex(input.rawBody);
  const priorBatch = await prisma.biometricIngestBatch.findUnique({ where: { bridgeId_batchReference: { bridgeId: input.verified.bridge.id, batchReference: input.envelope.batchReference } } });
  if (priorBatch && priorBatch.requestHash !== requestHash) {
    await audit(prisma, "BATCH", priorBatch.id, "BIOMETRIC_CHANGED_BATCH_REPLAY_REJECTED", null, { priorRequestHash: priorBatch.requestHash, rejectedRequestHash: requestHash });
    throw new Error("BIOMETRIC_CHANGED_BATCH_REPLAY_REJECTED");
  }
  for (const event of input.envelope.events) {
    const identity = biometricEventIdentity(event), payloadHash = biometricEventPayloadHash(event);
    const existing = await prisma.biometricRawPunch.findUnique({ where: { eventIdentityHash: identity }, select: { id: true, eventPayloadHash: true } });
    if (existing && existing.eventPayloadHash !== payloadHash) {
      await audit(prisma, "RAW_PUNCH", existing.id, "BIOMETRIC_CHANGED_EVENT_REPLAY_REJECTED", null, { eventIdentityHash: identity, priorPayloadHash: existing.eventPayloadHash, rejectedPayloadHash: payloadHash });
      throw new Error("BIOMETRIC_CHANGED_EVENT_REPLAY_REJECTED");
    }
  }
  return prisma.$transaction(async (tx) => {
    await recordBiometricNonce(tx, { bridgeId: input.verified.bridge.id, nonceHash: input.verified.nonceHash, expiresAt: input.verified.nonceExpiresAt });
    const prior = await tx.biometricIngestBatch.findUnique({ where: { bridgeId_batchReference: { bridgeId: input.verified.bridge.id, batchReference: input.envelope.batchReference } } });
    if (prior) return { schemaVersion: 1, batchReference: prior.batchReference, status: "DUPLICATE_ACCEPTED" as const, accepted: prior.eventCount, duplicates: prior.eventCount, exceptions: 0, serverTime: new Date().toISOString() };

    const states = new Map<string, DeviceState>();
    for (const event of input.envelope.events) {
      if (states.has(event.deviceId)) continue;
      const device = await tx.biometricDevice.findUnique({ where: { publicDeviceId: event.deviceId } });
      if (!device || device.bridgeId !== input.verified.bridge.id) throw new Error("BIOMETRIC_DEVICE_NOT_REGISTERED");
      if (device.status !== "ACTIVE") throw new Error(device.status === "REVOKED" ? "BIOMETRIC_DEVICE_REVOKED" : "BIOMETRIC_DEVICE_NOT_ACTIVE");
      assertProtocolActivation(event.protocolProfile, device.protocolProofStatus);
      if (device.protocolProfile !== event.protocolProfile) throw new Error("BIOMETRIC_DEVICE_PROFILE_MISMATCH");
      states.set(event.deviceId, { row: device, epoch: device.sequenceEpoch, lastSequence: device.lastSequence, touched: false, lastEventAt: device.lastEventAt, lastSyncAt: device.lastSyncAt, clockDriftSeconds: device.clockDriftSeconds, clockDriftStatus: device.clockDriftStatus });
    }

    const sequences = input.envelope.events.map((event) => event.sequenceNumber).filter((value): value is number => value !== null);
    const batch = await tx.biometricIngestBatch.create({ data: {
      batchReference: input.envelope.batchReference,
      bridgeId: input.verified.bridge.id,
      requestHash,
      nonceHash: input.verified.nonceHash,
      keyVersion: input.verified.keyVersion,
      eventCount: input.envelope.events.length,
      sequenceStart: sequences.length ? Math.min(...sequences) : null,
      sequenceEnd: sequences.length ? Math.max(...sequences) : null
    } });

    let accepted = 0, duplicates = 0, exceptions = 0, lastEventAt: Date | null = null;
    for (const event of input.envelope.events) {
      const state = states.get(event.deviceId)!;
      const identity = biometricEventIdentity(event);
      const eventPayloadHash = biometricEventPayloadHash(event);
      const existing = await tx.biometricRawPunch.findUnique({ where: { eventIdentityHash: identity } });
      if (existing) { if (existing.eventPayloadHash !== eventPayloadHash) throw new Error("BIOMETRIC_CHANGED_EVENT_REPLAY_REJECTED"); duplicates++; continue; }
      await updateSequenceEvidence(tx, state, batch.id, event);
      const punchedAt = new Date(event.punchTimestamp);
      const mappings = await tx.biometricStaffMapping.findMany({
        where: {
          deviceId: state.row.id,
          opaqueDeviceUserId: event.opaqueDeviceUserId,
          status: "ACTIVE",
          effectiveFrom: { lte: punchedAt },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: punchedAt } }]
        },
        include: { staffMember: { select: { id: true, status: true } } },
        orderBy: { effectiveFrom: "desc" },
        take: 2
      });
      const mapping = mappings.length === 1 ? mappings[0] : null;
      const staffActive = mapping?.staffMember.status === "ACTIVE";
      const clockDriftSeconds = event.estimatedClockDriftSeconds;
      const clockDriftStatus = biometricClockDriftStatus(clockDriftSeconds);
      const reconciliationStatus = mappings.length > 1 ? "MAPPING_CONFLICT" : !mapping ? "UNMAPPED_STAFF" : !staffActive ? "INACTIVE_STAFF" : event.punchCode === "UNKNOWN" ? "DEVICE_EXCEPTION" : clockDriftStatus === "UNTRUSTED_TIME" ? "DEVICE_TIME_UNTRUSTED" : "MAPPED_PENDING";
      if (reconciliationStatus !== "MAPPED_PENDING") exceptions++;
      const received = new Date();
      await tx.biometricRawPunch.create({ data: {
        eventIdentityHash: identity,
        eventPayloadHash,
        batchId: batch.id,
        bridgeId: input.verified.bridge.id,
        deviceId: state.row.id,
        mappingId: mapping?.id ?? null,
        staffMemberId: staffActive ? mapping!.staffMember.id : null,
        opaqueDeviceUserId: event.opaqueDeviceUserId,
        punchTimestamp: punchedAt,
        bridgeReceivedTimestamp: new Date(event.bridgeReceivedTimestamp),
        receivedTimestamp: received,
        verificationMethod: event.verificationMethod,
        punchCode: event.punchCode,
        statusCode: event.statusCode,
        sequenceNumber: event.sequenceNumber,
        sequenceEpoch: event.sequenceEpoch,
        eventReference: event.eventReference,
        protocolProfile: event.protocolProfile,
        clockDriftSeconds,
        clockDriftStatus,
        reconciliationStatus
      } });
      state.touched = true;
      state.lastEventAt = !state.lastEventAt || punchedAt > state.lastEventAt ? punchedAt : state.lastEventAt;
      state.lastSyncAt = received;
      state.clockDriftSeconds = clockDriftSeconds;
      state.clockDriftStatus = clockDriftStatus;
      accepted++;
      if (!lastEventAt || punchedAt > lastEventAt) lastEventAt = punchedAt;
    }
    for (const state of states.values()) if (state.touched) {
      const updated = await tx.biometricDevice.updateMany({ where: { id: state.row.id, status: "ACTIVE", version: state.row.version }, data: { lastEventAt: state.lastEventAt, lastSyncAt: state.lastSyncAt, lastHealthAt: state.lastSyncAt, healthStatus: state.clockDriftStatus === "UNTRUSTED_TIME" ? "DEGRADED" : state.clockDriftStatus === "WARNING" ? "WARNING" : "HEALTHY", clockDriftSeconds: state.clockDriftSeconds, clockDriftStatus: state.clockDriftStatus, sequenceEpoch: state.epoch, lastSequence: state.lastSequence, version: { increment: 1 } } });
      if (updated.count !== 1) throw new Error("BIOMETRIC_DEVICE_SEQUENCE_CONCURRENT_UPDATE");
    }
    const completedAt = new Date();
    await tx.biometricIngestBatch.update({ where: { id: batch.id }, data: { status: "COMPLETED", completedAt } });
    await tx.biometricBridge.update({ where: { id: input.verified.bridge.id }, data: { lastSyncAt: completedAt, lastEventAt: lastEventAt ?? input.verified.bridge.lastEventAt, lastHealthAt: completedAt } });
    await audit(tx, "BATCH", batch.id, "BIOMETRIC_BATCH_INGESTED", null, { accepted, duplicates, exceptions, eventCount: input.envelope.events.length });
    return { schemaVersion: 1, batchReference: batch.batchReference, status: "ACCEPTED" as const, accepted, duplicates, exceptions, serverTime: completedAt.toISOString() };
  }, { maxWait: 10_000, timeout: 30_000 });
}

export function biometricEventPayloadHash(event: NormalizedBiometricEvent) { return sha256Hex(`biometric-event-payload-v1\n${stableJson(event)}`); }
export function biometricClockDriftStatus(seconds: number | null) { if (seconds === null) return "UNKNOWN"; const absolute = Math.abs(seconds); return absolute > 10 * 60 ? "UNTRUSTED_TIME" : absolute > 2 * 60 ? "WARNING" : "HEALTHY"; }

async function updateSequenceEvidence(tx: Prisma.TransactionClient, state: DeviceState, batchId: string, event: NormalizedBiometricEvent) {
  if (event.sequenceNumber === null) return;
  if (event.sequenceEpoch > state.epoch) { state.epoch = event.sequenceEpoch; state.lastSequence = event.sequenceNumber; return; }
  if (event.sequenceEpoch < state.epoch) return;
  if (state.lastSequence !== null && event.sequenceNumber > state.lastSequence + 1) {
    await tx.biometricSequenceGap.upsert({
      where: { deviceId_sequenceEpoch_expectedSequence_receivedSequence: { deviceId: state.row.id, sequenceEpoch: state.epoch, expectedSequence: state.lastSequence + 1, receivedSequence: event.sequenceNumber } },
      update: {},
      create: { deviceId: state.row.id, batchId, sequenceEpoch: state.epoch, expectedSequence: state.lastSequence + 1, receivedSequence: event.sequenceNumber }
    });
  }
  if (state.lastSequence === null || event.sequenceNumber > state.lastSequence) state.lastSequence = event.sequenceNumber;
}

export async function recordBiometricAudit(input: { entityType: string; entityId: string; eventType: string; actorUserId?: string | null; safeMetadata?: Record<string, string | number | boolean | null> }) {
  return audit(prisma, input.entityType, input.entityId, input.eventType, input.actorUserId ?? null, input.safeMetadata);
}

async function audit(client: Pick<typeof prisma, "biometricAuditEvent"> | Prisma.TransactionClient, entityType: string, entityId: string, eventType: string, actorUserId: string | null, safeMetadata?: Record<string, string | number | boolean | null>) {
  return client.biometricAuditEvent.create({ data: { entityType, entityId, eventType, actorUserId, safeMetadataJson: safeMetadata ? JSON.stringify(safeMetadata) : null } });
}
