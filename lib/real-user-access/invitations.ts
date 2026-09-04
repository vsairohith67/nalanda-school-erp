import { createHash, randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { generateBoundToken, boundTokenMatches, hashBoundToken } from "@/lib/real-user-access/crypto";

export const INVITATION_TTL_MS = 24 * 60 * 60 * 1_000;
export const ACTIVATION_SESSION_TTL_MS = 30 * 60 * 1_000;

type InvitationClient = PrismaClient | Prisma.TransactionClient;

export function roleSnapshotHash(roles: readonly { role: string; validUntil?: Date | null; status?: string }[]) {
  const normalized = roles.map((entry) => ({ role: entry.role, status: entry.status ?? "PENDING", validUntil: entry.validUntil?.toISOString() ?? null })).sort((a, b) => `${a.role}:${a.validUntil}`.localeCompare(`${b.role}:${b.validUntil}`));
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

export async function createOneTimeInvitation(client: InvitationClient, input: { accessRequestId: string; userId: string; issuedByUserId: string; environment: string; roles: readonly { role: string; validUntil?: Date | null; status?: string }[]; credentialVersion: number; now?: Date }, env: NodeJS.ProcessEnv = process.env) {
  const now = input.now ?? new Date();
  const publicKey = randomUUID();
  const secret = generateBoundToken(32);
  const snapshot = roleSnapshotHash(input.roles);
  const subject = invitationSubject(publicKey, input.userId, input.credentialVersion, snapshot);
  const tokenHash = hashBoundToken({ token: secret, purpose: "account-invitation", environment: input.environment, subject }, env);
  const invitation = await client.userInvitation.create({ data: { publicKey, accessRequestId: input.accessRequestId, userId: input.userId, tokenHash, environment: input.environment, roleSnapshotHash: snapshot, credentialVersion: input.credentialVersion, expiresAt: new Date(now.getTime() + INVITATION_TTL_MS), issuedByUserId: input.issuedByUserId, deliveryKind: "LOCAL_TEST_SINK" } });
  return { invitation, oneTimeToken: `${publicKey}.${secret}` };
}

export async function validateOneTimeInvitation(client: InvitationClient, token: string, environment: string, now = new Date(), env: NodeJS.ProcessEnv = process.env) {
  const parsed = parseBoundToken(token);
  if (!parsed) return { valid: false, reason: "INVALID" as const };
  const invitation = await client.userInvitation.findUnique({ where: { publicKey: parsed.publicKey }, include: { user: { include: { iamRoleAssignments: { where: { status: "PENDING" } }, staffMember: true, guardian: true, studentAccount: true } }, accessRequest: true } });
  if (!invitation) return { valid: false, reason: "INVALID" as const };
  const subject = invitationSubject(invitation.publicKey, invitation.userId, invitation.credentialVersion, invitation.roleSnapshotHash);
  const secretMatches = boundTokenMatches({ token: parsed.secret, purpose: "account-invitation", environment, subject, expectedHash: invitation.tokenHash }, env);
  if (!secretMatches || invitation.environment !== environment) return failureWithAttempt(client, invitation.id, invitation.attempts, invitation.maxAttempts, "INVALID");
  if (invitation.revokedAt || invitation.status === "REVOKED") return { valid: false, reason: "REVOKED" as const };
  if (invitation.usedAt || invitation.status === "USED") return { valid: false, reason: "USED" as const };
  if (invitation.expiresAt <= now) { await client.userInvitation.updateMany({ where: { id: invitation.id, status: { in: ["CREATED", "SENT"] } }, data: { status: "EXPIRED" } }); return { valid: false, reason: "EXPIRED" as const }; }
  if (invitation.user.credentialVersion !== invitation.credentialVersion || invitation.user.lifecycleStatus !== "PENDING_ACTIVATION" || invitation.user.isActive) return { valid: false, reason: "ACCOUNT_CHANGED" as const };
  if (roleSnapshotHash(invitation.user.iamRoleAssignments) !== invitation.roleSnapshotHash) return { valid: false, reason: "ROLE_CHANGED" as const };
  if (!personLinkIntact(invitation)) return { valid: false, reason: "PERSON_LINK_CHANGED" as const };
  if (invitation.accessRequest.status !== "INVITATION_CREATED" && invitation.accessRequest.status !== "INVITATION_SENT") return { valid: false, reason: "REQUEST_CHANGED" as const };
  return { valid: true, invitation } as const;
}

export async function acceptOneTimeInvitation(client: PrismaClient, token: string, environment: string, now = new Date(), env: NodeJS.ProcessEnv = process.env) {
  const validated = await validateOneTimeInvitation(client, token, environment, now, env);
  if (!validated.valid || !validated.invitation) return validated;
  const invitation = validated.invitation;
  return client.$transaction(async (tx) => {
    const consumed = await tx.userInvitation.updateMany({ where: { id: invitation.id, usedAt: null, revokedAt: null, expiresAt: { gt: now }, status: { in: ["CREATED", "SENT"] } }, data: { usedAt: now, status: "USED" } });
    if (consumed.count !== 1) return { valid: false, reason: "USED" as const };
    const id = randomUUID();
    const secret = generateBoundToken(32);
    const tokenHash = hashBoundToken({ token: secret, purpose: "activation-session", environment, subject: `${id}:${invitation.userId}` }, env);
    const session = await tx.userActivationSession.create({ data: { id, accessRequestId: invitation.accessRequestId, userId: invitation.userId, tokenHash, expiresAt: new Date(now.getTime() + ACTIVATION_SESSION_TTL_MS) } });
    await tx.userAccessRequest.update({ where: { id: invitation.accessRequestId }, data: { status: "ACTIVATION_PENDING", version: { increment: 1 } } });
    return { valid: true, activationToken: `${id}.${secret}`, session, requirements: {
      roles: parseStoredList(invitation.accessRequest.requestedRolesJson),
      training: parseStoredList(invitation.accessRequest.trainingRequirementsJson),
      mfaRequired: invitation.accessRequest.mfaRequired
    } } as const;
  });
}

export async function validateActivationSession(client: InvitationClient, token: string, environment: string, now = new Date(), env: NodeJS.ProcessEnv = process.env) {
  const parsed = parseBoundToken(token);
  if (!parsed) return { valid: false, reason: "INVALID" as const };
  const session = await client.userActivationSession.findUnique({ where: { id: parsed.publicKey }, include: { user: true, accessRequest: true } });
  if (!session || !boundTokenMatches({ token: parsed.secret, purpose: "activation-session", environment, subject: `${session.id}:${session.userId}`, expectedHash: session.tokenHash }, env)) return { valid: false, reason: "INVALID" as const };
  if (session.usedAt || session.revokedAt) return { valid: false, reason: "INACTIVE" as const };
  if (session.expiresAt <= now) return { valid: false, reason: "EXPIRED" as const };
  if (session.user.lifecycleStatus !== "PENDING_ACTIVATION" || session.user.isActive) return { valid: false, reason: "ACCOUNT_CHANGED" as const };
  if (session.accessRequest.candidateUserId !== session.userId || !["ACTIVATION_PENDING", "MFA_ENROLMENT_PENDING", "TRAINING_PENDING"].includes(session.accessRequest.status)) return { valid: false, reason: "REQUEST_CHANGED" as const };
  return { valid: true, session } as const;
}

export function syntheticInvitationPreview(input: { role: string; expiresAt: Date; activationOrigin: string; oneTimeToken: string }) {
  const origin = new URL(input.activationOrigin);
  if (!["localhost", "127.0.0.1", "::1"].includes(origin.hostname)) throw new Error("SYNTHETIC_INVITATION_LOOPBACK_ONLY");
  const link = `${origin.origin}/activate#token=${encodeURIComponent(input.oneTimeToken)}`;
  return { subject: "Nalanda School Management System account invitation", text: `Nalanda School Management System\nRole: ${input.role}\nExpires: ${input.expiresAt.toISOString()}\nThis is a one-time invitation. Do not share this link.\nOfficial School contact: [APPROVED CONTACT REQUIRED]\nSupport and recovery: ${origin.origin}/forgot-password\n${link}`, link, delivery: "LOCAL_TEST_SINK" as const };
}

function parseBoundToken(token: string) { const match = /^([0-9a-f]{8}-[0-9a-f-]{27})\.([A-Za-z0-9_-]{22,128})$/i.exec(token); return match ? { publicKey: match[1], secret: match[2] } : null; }
function invitationSubject(publicKey: string, userId: string, credentialVersion: number, roleHash: string) { return `${publicKey}:${userId}:${credentialVersion}:${roleHash}`; }
function parseStoredList(value: string) { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : []; } catch { return []; } }
async function failureWithAttempt(client: InvitationClient, id: string, attempts: number, maximum: number, reason: "INVALID") { const next = attempts + 1; await client.userInvitation.updateMany({ where: { id, usedAt: null, revokedAt: null }, data: { attempts: { increment: 1 }, ...(next >= maximum ? { status: "REVOKED", revokedAt: new Date(), revocationReason: "ATTEMPT_LIMIT" } : {}) } }); return { valid: false, reason } as const; }
function personLinkIntact(invitation: {
  accessRequest: { staffMemberId: string | null; guardianId: string | null; studentId: string | null };
  user: { staffMember: { id: string } | null; guardian: { id: string } | null; studentAccount: { id: string } | null };
}) {
  if (invitation.accessRequest.staffMemberId) return invitation.user.staffMember?.id === invitation.accessRequest.staffMemberId;
  if (invitation.accessRequest.guardianId) return invitation.user.guardian?.id === invitation.accessRequest.guardianId;
  if (invitation.accessRequest.studentId) return invitation.user.studentAccount?.id === invitation.accessRequest.studentId;
  return true;
}
