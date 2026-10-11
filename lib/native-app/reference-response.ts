import { createHash, randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { logAuthSecurityEvent } from "@/lib/auth-security";
import { parseReferenceObservation, referenceJson, type ReferenceObservation } from "./reference-observation";

export const REFERENCE_RESPONSE_EVENT = "NATIVE_REFERENCE_RESPONSE_PREPARED";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
type Client = Pick<PrismaClient, "authSecurityEvent">;
export async function prepareReferenceResponse(db: Client, pack: { snapshotVersion: string; students: { admissionNo: string }[] }, identity: Pick<ReferenceObservation, "userId" | "sessionId" | "deviceId" | "publicDeviceId">, nonce: string) {
  // Hash the actual JSON representation (Dates/Decimals/undefined have already
  // acquired their wire semantics), not a second query of mutable population.
  const wire = JSON.parse(JSON.stringify(pack));
  const observation = parseReferenceObservation({ version: 1, responseId: randomUUID(), ...identity,
    requestHash: hash(nonce), snapshotHash: hash(wire.snapshotVersion), contentHash: hash(referenceJson(wire)),
    populationHash: hash(JSON.stringify(wire.students.map((s: { admissionNo: string }) => s.admissionNo).sort())), studentCount: wire.students.length });
  await logAuthSecurityEvent(db, { eventType: REFERENCE_RESPONSE_EVENT, userId: identity.userId, actorUserId: identity.userId,
    subjectType: "NATIVE_REFERENCE_RESPONSE", subjectId: observation.responseId, details: { ...observation } });
  return { ...wire, observation };
}
export async function readReferenceResponse(db: Client, responseId: string, identity: Pick<ReferenceObservation, "userId" | "sessionId" | "deviceId" | "publicDeviceId">): Promise<ReferenceObservation | null> {
  if (!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(responseId)) throw Error("REFERENCE_RESPONSE_ID_INVALID");
  const rows = await db.authSecurityEvent.findMany({ where: { eventType: REFERENCE_RESPONSE_EVENT, subjectType: "NATIVE_REFERENCE_RESPONSE", subjectId: responseId, userId: identity.userId, actorUserId: identity.userId }, select: { detailsJson: true }, take: 2 });
  if (!rows.length) return null;
  if (rows.length !== 1) throw Error("REFERENCE_RESPONSE_CONFLICT");
  const result = parseReferenceObservation(JSON.parse(rows[0].detailsJson ?? "null"));
  if (result.responseId !== responseId || Object.entries(identity).some(([k, v]) => result[k as keyof ReferenceObservation] !== v)) throw Error("REFERENCE_RESPONSE_BINDING");
  return result;
}
