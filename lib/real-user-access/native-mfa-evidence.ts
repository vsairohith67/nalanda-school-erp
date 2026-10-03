import type { Prisma, PrismaClient } from "@prisma/client";

export type NativeMfaEvidence =
  | { status: "NOT_RECORDED" | "NOT_YET_ISSUED" | "CONFLICT" }
  | { status: "VERIFIED"; factor: "TOTP" | "RECOVERY_CODE" | "WEBAUTHN"; challengeId: string; verifiedAt: string; webSessionId: string; userId: string; requestId: string; nativeSessionId: string };
type Client = PrismaClient | Prisma.TransactionClient;
const conflict = (): NativeMfaEvidence => ({ status: "CONFLICT" });
function metadata(raw: string | null, keys: string[]) {
  if (!raw || raw.length > 2048) return null;
  try {
    const value = JSON.parse(raw);
    if (!value || Array.isArray(value) || typeof value !== "object" || Object.keys(value).sort().join() !== keys.sort().join()) return null;
    return value as Record<string, unknown>;
  } catch { return null; }
}
const id = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);

/** Historical evidence only, never an authorization decision. Exact IDs only;
 * no latest-event or proximity search, no credentials, no read-time writes.
 * The two login audit records plus the native exchange record retain minimal proof if a transient challenge is
 * removed under existing retention. Missing retained evidence stays unknown. */
export async function readNativeMfaEvidence(db: Client, input: { userId: string; requestId: string; nativeSessionId: string | null; environment: string }): Promise<NativeMfaEvidence> {
  if (!id(input.userId) || !id(input.requestId) || (input.nativeSessionId !== null && !id(input.nativeSessionId))) return conflict();
  const request = await db.nativeAuthRequest.findUnique({ where: { publicRequestId: input.requestId }, select: { id: true, userId: true, webSessionId: true, roleAssignmentId: true, status: true, authorizedAt: true, consumedAt: true, authorizationCode: { select: { userId: true, deviceId: true, roleAssignmentId: true, usedAt: true } } } });
  if (!request || (request.userId !== null && request.userId !== input.userId)) return conflict();
  if (!input.nativeSessionId) return request.status === "CONSUMED" ? conflict() : { status: "NOT_YET_ISSUED" };
  const session = await db.nativeSession.findUnique({ where: { publicSessionId: input.nativeSessionId }, select: { userId: true, deviceId: true, roleAssignmentId: true, credentialVersion: true, authorizationVersion: true } });
  if (!session || request.status !== "CONSUMED" || !request.webSessionId || !request.authorizedAt || !request.consumedAt || !request.authorizationCode?.usedAt || request.userId !== input.userId || session.userId !== input.userId || request.authorizationCode.userId !== input.userId || session.deviceId !== request.authorizationCode.deviceId || session.roleAssignmentId !== request.roleAssignmentId || session.roleAssignmentId !== request.authorizationCode.roleAssignmentId) return conflict();
  const nativeEvents = await db.authSecurityEvent.findMany({ where: { eventType: "NATIVE_SESSION_CREATED", subjectType: "NATIVE_SESSION", subjectId: input.nativeSessionId }, select: { userId: true, detailsJson: true }, take: 2 });
  if (!nativeEvents.length) return { status: "NOT_RECORDED" };
  if (nativeEvents.length !== 1 || nativeEvents[0].userId !== input.userId) return conflict();
  const native = metadata(nativeEvents[0].detailsJson, ["requestId", "rotationVersion", "keyVersion", "lineageVersion", "webSessionId", "environment"]);
  if (!native) {
    const historical = metadata(nativeEvents[0].detailsJson, ["requestId", "rotationVersion", "keyVersion"]);
    return historical?.requestId === input.requestId ? { status: "NOT_RECORDED" } : conflict();
  }
  if (native.lineageVersion !== 1 || native.rotationVersion !== 1 || native.requestId !== input.requestId || native.webSessionId !== request.webSessionId || native.environment !== input.environment) return conflict();
  const web = await db.authSession.findUnique({ where: { id: request.webSessionId }, select: { userId: true, credentialVersion: true, authorizationVersion: true, createdAt: true } });
  if (!web) return { status: "NOT_RECORDED" };
  if (web.userId !== input.userId || web.credentialVersion !== session.credentialVersion || web.authorizationVersion !== session.authorizationVersion) return conflict();
  const issued = await db.authSecurityEvent.findMany({ where: { eventType: "MFA_LOGIN_SESSION_ISSUED", subjectType: "AUTH_SESSION", subjectId: request.webSessionId }, select: { userId: true, actorUserId: true, detailsJson: true }, take: 2 });
  if (!issued.length) return { status: "NOT_RECORDED" };
  if (issued.length !== 1 || issued[0].userId !== input.userId || issued[0].actorUserId !== input.userId) return conflict();
  const proof = metadata(issued[0].detailsJson, ["version", "challengeId", "factorType", "environment", "verifiedAt", "roleAssignmentId", "credentialVersion", "authorizationVersion"]);
  if (!proof || proof.version !== 1 || !id(proof.challengeId) || !id(proof.roleAssignmentId) || !["TOTP", "RECOVERY_CODE", "WEBAUTHN"].includes(String(proof.factorType)) || proof.environment !== input.environment || proof.verifiedAt !== web.createdAt.toISOString() || web.createdAt > request.authorizedAt || proof.credentialVersion !== web.credentialVersion || proof.authorizationVersion !== web.authorizationVersion) return conflict();
  const verified = await db.authSecurityEvent.findMany({ where: { eventType: "MFA_LOGIN_SUCCEEDED", subjectType: "MFA_CHALLENGE", subjectId: proof.challengeId }, select: { userId: true, actorUserId: true, detailsJson: true }, take: 2 });
  if (!verified.length) return { status: "NOT_RECORDED" };
  const factor = verified.length === 1 ? metadata(verified[0].detailsJson, ["factorType", "environment", "verifiedAt", "webSessionId"]) : null;
  if (!factor || verified[0].userId !== input.userId || verified[0].actorUserId !== input.userId || factor.factorType !== proof.factorType || factor.environment !== proof.environment || factor.verifiedAt !== proof.verifiedAt || factor.webSessionId !== request.webSessionId) return conflict();
  const challenge = await db.mfaChallenge.findUnique({ where: { id: proof.challengeId }, select: { userId: true, sessionId: true, roleAssignmentId: true, type: true, action: true, environment: true, usedAt: true } });
  // Submission expiry is deliberately not reinterpreted as verification expiry.
  if (challenge && (challenge.userId !== input.userId || challenge.sessionId !== request.webSessionId || challenge.roleAssignmentId !== proof.roleAssignmentId || challenge.type !== "LOGIN" || challenge.action !== "LOGIN" || challenge.environment !== input.environment || challenge.usedAt?.toISOString() !== proof.verifiedAt)) return conflict();
  return { status: "VERIFIED", factor: proof.factorType as "TOTP" | "RECOVERY_CODE" | "WEBAUTHN", challengeId: proof.challengeId, verifiedAt: proof.verifiedAt as string, webSessionId: request.webSessionId, userId: input.userId, requestId: input.requestId, nativeSessionId: input.nativeSessionId };
}
