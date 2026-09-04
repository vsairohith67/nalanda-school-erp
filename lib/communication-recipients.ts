import type { CommunicationChannel, ResolvedCommunicationRecipient } from "@/lib/communication-types";
import { safeDestinationDigest } from "@/lib/communication-policy";

export const RECIPIENT_POLICIES = [
  "CURRENT_USER",
  "ACTIVE_GUARDIANS_FOR_STUDENTS",
  "ACTIVE_STAFF_RELATION",
  "AUTHORISED_LEADERSHIP",
  "EXACT_SUPPORT_PARTICIPANTS",
  "EXACT_INVITATION_CANDIDATE"
] as const;
export type RecipientPolicy = (typeof RECIPIENT_POLICIES)[number];

export async function resolveCommunicationRecipients(client: any, input: {
  policy: RecipientPolicy;
  scope: Record<string, unknown>;
  actorUserId: string;
  now?: Date;
}): Promise<ResolvedCommunicationRecipient[]> {
  const now = input.now ?? new Date();
  if (input.policy === "CURRENT_USER") {
    const user = await client.user.findFirst({ where: { id: input.actorUserId, isActive: true, lifecycleStatus: "ACTIVE" }, select: { id: true, role: true } });
    return user ? [recipient(user.id, "USER", user.id, user.role)] : [];
  }
  if (input.policy === "ACTIVE_GUARDIANS_FOR_STUDENTS") {
    const studentIds = boundedIdentifiers(input.scope.studentIds, 800);
    if (!studentIds.length) return [];
    const links = await client.studentGuardian.findMany({
      where: { studentId: { in: studentIds }, canReceiveReminders: true, student: { deletedAt: null, status: { notIn: ["TRANSFERRED", "INACTIVE", "ARCHIVED"] } }, guardian: { status: "Active" } },
      select: { guardianId: true, guardian: { select: { users: { where: { isActive: true, lifecycleStatus: "ACTIVE" }, select: { id: true, role: true } } } } },
      orderBy: [{ guardianId: "asc" }, { studentId: "asc" }],
      take: 2_400
    });
    const rows = new Map<string, ResolvedCommunicationRecipient>();
    for (const link of links) for (const user of link.guardian.users) rows.set(link.guardianId, recipient(user.id, "GUARDIAN", link.guardianId, user.role));
    return [...rows.values()];
  }
  if (input.policy === "ACTIVE_STAFF_RELATION") {
    const staffIds = boundedIdentifiers(input.scope.staffIds, 200);
    const staff = await client.staffMember.findMany({ where: { id: { in: staffIds }, status: "ACTIVE", user: { isActive: true, lifecycleStatus: "ACTIVE" } }, select: { id: true, user: { select: { id: true, role: true } } }, orderBy: { id: "asc" }, take: 200 });
    return staff.flatMap((row: any) => row.user ? [recipient(row.user.id, "STAFF", row.id, row.user.role)] : []);
  }
  if (input.policy === "AUTHORISED_LEADERSHIP") {
    const requested = boundedIdentifiers(input.scope.roles, 3).filter((role) => ["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL"].includes(role));
    const roles = requested.length ? requested : ["SUPER_ADMIN", "DIRECTOR"];
    const users = await client.user.findMany({
      where: { isActive: true, lifecycleStatus: "ACTIVE", iamRoleAssignments: { some: { role: { in: roles }, status: "ACTIVE", validFrom: { lte: now }, OR: [{ validUntil: null }, { validUntil: { gt: now } }] } } },
      select: { id: true, role: true }, orderBy: { id: "asc" }, take: 50
    });
    return users.map((user: any) => recipient(user.id, "USER", user.id, user.role));
  }
  if (input.policy === "EXACT_SUPPORT_PARTICIPANTS") {
    const ids = boundedIdentifiers(input.scope.participantUserIds, 50);
    const users = await client.user.findMany({ where: { id: { in: ids }, isActive: true, lifecycleStatus: "ACTIVE" }, select: { id: true, role: true }, orderBy: { id: "asc" }, take: 50 });
    return users.map((user: any) => recipient(user.id, "USER", user.id, user.role));
  }
  if (input.policy === "EXACT_INVITATION_CANDIDATE") {
    const accessRequestId = singleIdentifier(input.scope.accessRequestId);
    const request = accessRequestId ? await client.userAccessRequest.findFirst({ where: { id: accessRequestId, status: { in: ["APPROVED", "INVITATION_CREATED", "INVITATION_SENT"] } }, select: { candidateUser: { select: { id: true, role: true, isActive: true, lifecycleStatus: true } } } }) : null;
    const user = request?.candidateUser;
    return user && !user.isActive && user.lifecycleStatus === "PENDING_ACTIVATION" ? [recipient(user.id, "USER", user.id, user.role)] : [];
  }
  return [];
}

export async function recheckDispatchDestination(client: any, item: {
  channel: CommunicationChannel;
  recipientUserId?: string | null;
  recipientSubjectType: string;
  recipientSubjectReferenceId: string;
  contactVersion?: number | null;
  destinationDigest?: string | null;
}, pepper: string) {
  if (item.channel === "IN_APP") {
    const user = item.recipientUserId ? await client.user.findFirst({ where: { id: item.recipientUserId, isActive: true, lifecycleStatus: "ACTIVE" }, select: { id: true } }) : null;
    return user ? { eligible: true, destination: null, digest: null, masked: null } : { eligible: false, reason: "RECIPIENT_INACTIVE" } as const;
  }
  const source = await authoritativeContact(client, item);
  if (!source) return { eligible: false, reason: "AUTHORITATIVE_CONTACT_UNAVAILABLE" } as const;
  const digest = safeDestinationDigest(item.channel, source.destination, pepper);
  if (item.recipientSubjectType === "SYNTHETIC") {
    if (item.destinationDigest && item.destinationDigest !== digest) return { eligible: false, reason: "CONTACT_CHANGED" } as const;
    return { eligible: true, destination: source.destination, digest, masked: mask(item.channel, source.destination), contactPointId: null, contactVersion: item.contactVersion ?? 1 } as const;
  }
  const contactPoint = await client.communicationContactPoint.findFirst({
    where: {
      subjectType: item.recipientSubjectType,
      subjectReferenceId: item.recipientSubjectReferenceId,
      channel: item.channel,
      status: "VERIFIED",
      invalidatedAt: null
    },
    orderBy: { version: "desc" },
    select: { id: true, version: true, destinationDigest: true, destinationMasked: true }
  });
  if (!contactPoint || contactPoint.destinationDigest !== digest) return { eligible: false, reason: "VERIFIED_CONTACT_POINT_UNAVAILABLE" } as const;
  if (item.contactVersion != null && item.contactVersion !== contactPoint.version) return { eligible: false, reason: "CONTACT_VERSION_CHANGED" } as const;
  if ((item as any).contactPointId && (item as any).contactPointId !== contactPoint.id) return { eligible: false, reason: "CONTACT_POINT_CHANGED" } as const;
  if (item.destinationDigest && item.destinationDigest !== digest) return { eligible: false, reason: "CONTACT_CHANGED" } as const;
  return { eligible: true, destination: source.destination, digest, masked: contactPoint.destinationMasked || mask(item.channel, source.destination), contactPointId: contactPoint.id, contactVersion: contactPoint.version } as const;
}

async function authoritativeContact(client: any, item: { channel: CommunicationChannel; recipientSubjectType: string; recipientSubjectReferenceId: string }) {
  const field = item.channel === "EMAIL" ? "email" : "primaryMobile";
  if (item.recipientSubjectType === "GUARDIAN") {
    const row = await client.guardian.findFirst({ where: { id: item.recipientSubjectReferenceId, status: "Active" }, select: { email: true, primaryMobile: true } });
    const destination = row?.[field];
    return destination ? { destination: String(destination).trim() } : null;
  }
  if (item.recipientSubjectType === "STAFF") {
    const row = await client.staffMember.findFirst({ where: { id: item.recipientSubjectReferenceId, status: "ACTIVE", user: { isActive: true, lifecycleStatus: "ACTIVE" } }, select: { email: true, mobile: true } });
    const destination = item.channel === "EMAIL" ? row?.email : row?.mobile;
    return destination ? { destination: String(destination).trim() } : null;
  }
  if (item.recipientSubjectType === "USER" && item.channel === "EMAIL") {
    const row = await client.user.findFirst({ where: { id: item.recipientSubjectReferenceId, isActive: true, lifecycleStatus: { in: ["ACTIVE", "PENDING_ACTIVATION"] } }, select: { email: true } });
    return row?.email ? { destination: String(row.email).trim() } : null;
  }
  if (item.recipientSubjectType === "SYNTHETIC") {
    if (item.channel === "EMAIL") return { destination: `${item.recipientSubjectReferenceId}@example.invalid` };
    const prefix = item.channel === "NATIVE_PUSH" ? "push" : item.channel.toLowerCase();
    return { destination: `synthetic:${prefix}:${item.recipientSubjectReferenceId}` };
  }
  return null;
}

function recipient(userId: string | null, subjectType: ResolvedCommunicationRecipient["subjectType"], subjectReferenceId: string, role: string): ResolvedCommunicationRecipient {
  return { userId, subjectType, subjectReferenceId, role, locale: "en-IN" };
}
function boundedIdentifiers(value: unknown, maximum: number) {
  if (!Array.isArray(value) || value.length > maximum) throw new Error("COMMUNICATION_RECIPIENT_SCOPE_INVALID");
  const result = value.map(singleIdentifier);
  if (result.some((entry) => !entry)) throw new Error("COMMUNICATION_RECIPIENT_SCOPE_INVALID");
  return [...new Set(result as string[])];
}
function singleIdentifier(value: unknown) { const text = String(value ?? "").trim(); return /^[A-Za-z0-9_-]{1,128}$/.test(text) ? text : ""; }
function mask(channel: CommunicationChannel, destination: string) {
  if (channel === "EMAIL") { const [local, domain] = destination.split("@"); return `${local?.slice(0, 1) || "*"}***@${domain || "invalid"}`; }
  return `***${destination.slice(-4)}`;
}
