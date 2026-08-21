import { createHash, randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { AuthUser } from "@/lib/auth";
import type { CanonicalPermission, Role } from "@/lib/permissions";
import { bumpAuthorizationAndRevokeSessions } from "@/lib/iam/security";
import { logUserAction } from "@/lib/user-audit";

type AcademicIntegrityClient = PrismaClient | Prisma.TransactionClient | any;
type MarksActor = Pick<AuthUser, "id" | "name" | "role">;

export const MARKS_ENTRY_OPERATOR_PROFILE = "MARKS_ENTRY_OPERATOR";
export const MARKS_ENTRY_OPERATOR_NORMALIZED = "marks_entry_operator";
export const MARKS_DELEGATION_PREFIX = "ACADEMIC_INTEGRITY_V1_1_SCOPE:";

export const MARKS_DELEGATION_PERMISSIONS = [
  "ENTER_MARKS",
  "SUBMIT_MARKS",
  "VIEW_OWN_EXAM_MARKS",
  "ENTER_ASSIGNED_EXAM_MARKS",
  "SUBMIT_ASSIGNED_EXAM_MARKS",
  "REQUEST_EXAM_MARK_CORRECTION"
] as const satisfies readonly CanonicalPermission[];

export const MARKS_DELEGATION_ELIGIBLE_ROLES = new Set<Role>([
  "ADMIN",
  "ACCOUNTANT",
  "COMPUTER_OPERATOR",
  "VIEWER"
]);

export type LegacyMarksDelegationScope = {
  kind: "LEGACY_ASSESSMENT";
  academicYear: string;
  examId: string;
  examCode: string;
  assessmentId: string;
  className: string;
  section: string;
  subjectId: string | null;
  subjectName: string;
  componentName: string;
};

export type GovernedMarksDelegationScope = {
  kind: "GOVERNED_COMPONENT";
  academicYear: string;
  examinationId: string;
  examCode: string;
  classScopeId: string;
  subjectPaperId: string;
  componentId: string;
  className: string;
  section: string;
  subjectName: string;
  componentName: string;
};

export type MarksDelegationScope = LegacyMarksDelegationScope | GovernedMarksDelegationScope;

type ScopeGrant = {
  scope: MarksDelegationScope;
  reason: string;
  grantedByUserId: string;
  grantedAt: string;
};

type DelegationEnvelope = {
  policy: "ACADEMIC_INTEGRITY_V1_1";
  grants: ScopeGrant[];
};

export type MarksAuthority = {
  mode: "LEADERSHIP" | "DELEGATED";
  profileName: string | null;
  assignmentId: string | null;
  assignmentHandle: string | null;
  scope: MarksDelegationScope | null;
  grantSource: string;
};

export function marksAuthorityAuditContext(authority: MarksAuthority) {
  return [
    "policy=ACADEMIC_INTEGRITY_V1_1",
    `authority=${authority.mode}`,
    authority.profileName ? `profile=${authority.profileName}` : null,
    authority.assignmentHandle ? `grant=${authority.assignmentHandle}` : null,
    `source=${authority.grantSource}`
  ].filter(Boolean).join("; ");
}

export class AcademicIntegrityError extends Error {
  constructor(message: string, readonly status = 403, readonly code = "ACADEMIC_INTEGRITY_DENIED") {
    super(message);
    this.name = "AcademicIntegrityError";
  }
}

function boundedText(value: unknown, label: string, min: number, max: number) {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");
  if (text.length < min || text.length > max || /[\u0000-\u001F\u007F]/.test(text)) {
    throw new AcademicIntegrityError(`${label} must be ${min}-${max} characters.`, 400, "ACADEMIC_INTEGRITY_INPUT_INVALID");
  }
  return text;
}

function safeId(value: unknown, label: string) {
  const text = String(value ?? "").trim();
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(text)) {
    throw new AcademicIntegrityError(`${label} is invalid.`, 400, "ACADEMIC_INTEGRITY_INPUT_INVALID");
  }
  return text;
}

function canonicalScope(scope: MarksDelegationScope): MarksDelegationScope {
  return Object.fromEntries(Object.entries(scope).map(([key, value]) => [key, typeof value === "string" ? value.trim() : value])) as MarksDelegationScope;
}

export function marksDelegationScopeKey(scope: MarksDelegationScope) {
  const identity = scope.kind === "LEGACY_ASSESSMENT"
    ? `${scope.kind}|${scope.assessmentId}`
    : `${scope.kind}|${scope.examinationId}|${scope.classScopeId}|${scope.subjectPaperId}|${scope.componentId}`;
  return createHash("sha256").update(identity).digest("hex").slice(0, 24).toUpperCase();
}

export function parseMarksDelegationEnvelope(reason: unknown): DelegationEnvelope | null {
  const text = String(reason ?? "");
  if (!text.startsWith(MARKS_DELEGATION_PREFIX)) return null;
  try {
    const parsed = JSON.parse(text.slice(MARKS_DELEGATION_PREFIX.length)) as DelegationEnvelope;
    if (parsed?.policy !== "ACADEMIC_INTEGRITY_V1_1" || !Array.isArray(parsed.grants)) return null;
    const grants = parsed.grants.filter((grant) => grant && grant.scope && ["LEGACY_ASSESSMENT", "GOVERNED_COMPONENT"].includes(grant.scope.kind));
    if (grants.length !== parsed.grants.length || grants.length > 100) return null;
    return { policy: "ACADEMIC_INTEGRITY_V1_1", grants: grants.map((grant) => ({ ...grant, scope: canonicalScope(grant.scope) })) };
  } catch {
    return null;
  }
}

function encodeMarksDelegationEnvelope(envelope: DelegationEnvelope) {
  const encoded = `${MARKS_DELEGATION_PREFIX}${JSON.stringify(envelope)}`;
  if (encoded.length > 40_000) throw new AcademicIntegrityError("This operator has too many delegated scopes.", 409, "ACADEMIC_INTEGRITY_SCOPE_LIMIT");
  return encoded;
}

function scopeMatches(scope: MarksDelegationScope, target: Partial<MarksDelegationScope>) {
  if (scope.kind !== target.kind) return false;
  if (scope.kind === "LEGACY_ASSESSMENT") {
    const candidate = target as Partial<LegacyMarksDelegationScope>;
    return scope.assessmentId === candidate.assessmentId &&
      scope.examId === candidate.examId &&
      scope.academicYear === candidate.academicYear &&
      scope.className === candidate.className &&
      scope.section === candidate.section &&
      scope.subjectName === candidate.subjectName &&
      scope.componentName === candidate.componentName &&
      scope.subjectId === (candidate.subjectId ?? null);
  }
  const candidate = target as Partial<GovernedMarksDelegationScope>;
  return scope.examinationId === candidate.examinationId &&
    scope.classScopeId === candidate.classScopeId &&
    scope.subjectPaperId === candidate.subjectPaperId &&
    scope.componentId === candidate.componentId &&
    scope.academicYear === candidate.academicYear &&
    scope.className === candidate.className &&
    scope.section === candidate.section;
}

function activeWhere(now: Date) {
  return {
    status: "ACTIVE",
    validFrom: { lte: now },
    OR: [{ validUntil: null }, { validUntil: { gt: now } }]
  };
}

async function hasActiveTeacherRole(client: AcademicIntegrityClient, userId: string, now: Date) {
  return Boolean(await client.userRoleAssignment.findFirst({
    where: { userId, role: "TEACHER", ...activeWhere(now) },
    select: { id: true }
  }));
}

export async function resolveMarksWriteAuthority(
  client: AcademicIntegrityClient,
  actor: MarksActor,
  target?: Partial<MarksDelegationScope>,
  permission: CanonicalPermission = "ENTER_MARKS",
  now = new Date()
): Promise<MarksAuthority> {
  if (actor.role === "TEACHER") {
    throw new AcademicIntegrityError("Teacher accounts cannot enter or submit marks under Academic Integrity v1.1.");
  }
  if (actor.role === "SUPER_ADMIN" || actor.role === "PRINCIPAL") {
    return { mode: "LEADERSHIP", profileName: null, assignmentId: null, assignmentHandle: null, scope: null, grantSource: actor.role };
  }
  if (!MARKS_DELEGATION_ELIGIBLE_ROLES.has(actor.role)) {
    throw new AcademicIntegrityError("This role has no marks-write authority by default.");
  }
  if (await hasActiveTeacherRole(client, actor.id, now)) {
    throw new AcademicIntegrityError("A user with an active Teacher role cannot receive delegated marks-entry authority.");
  }
  const assignments = await client.userPermissionProfileAssignment.findMany({
    where: {
      userId: actor.id,
      ...activeWhere(now),
      profile: {
        normalizedName: MARKS_ENTRY_OPERATOR_NORMALIZED,
        status: "ACTIVE",
        entries: { some: { permission, effect: "ALLOW", status: "ACTIVE", revokedAt: null, validFrom: { lte: now }, OR: [{ validUntil: null }, { validUntil: { gt: now } }] } }
      }
    },
    include: { profile: true },
    orderBy: { createdAt: "desc" }
  });
  for (const assignment of assignments) {
    const envelope = parseMarksDelegationEnvelope(assignment.reason);
    if (!envelope) continue;
    const grant = target ? envelope.grants.find((candidate) => scopeMatches(candidate.scope, target)) : envelope.grants[0];
    if (!grant) continue;
    return {
      mode: "DELEGATED",
      profileName: assignment.profile.name,
      assignmentId: assignment.id,
      assignmentHandle: assignment.publicKey,
      scope: grant.scope,
      grantSource: `PROFILE:${assignment.profile.name}`
    };
  }
  throw new AcademicIntegrityError("No active delegated marks-entry grant matches this exact scope.");
}

export async function listActorMarksDelegationScopes(client: AcademicIntegrityClient, actor: MarksActor, now = new Date()) {
  if (actor.role === "TEACHER") return [] as MarksDelegationScope[];
  if (actor.role === "SUPER_ADMIN" || actor.role === "PRINCIPAL") return null;
  if (!MARKS_DELEGATION_ELIGIBLE_ROLES.has(actor.role) || await hasActiveTeacherRole(client, actor.id, now)) return [] as MarksDelegationScope[];
  const assignments = await client.userPermissionProfileAssignment.findMany({
    where: { userId: actor.id, ...activeWhere(now), profile: { normalizedName: MARKS_ENTRY_OPERATOR_NORMALIZED, status: "ACTIVE" } },
    select: { reason: true }
  });
  return assignments.flatMap((assignment: { reason: string }) => parseMarksDelegationEnvelope(assignment.reason)?.grants.map((grant) => grant.scope) ?? []);
}

export async function assertNoDelegatedFamilyConflict(
  client: AcademicIntegrityClient,
  actor: MarksActor,
  studentIds: string[],
  authority: MarksAuthority,
  targetLabel: string
) {
  if (authority.mode !== "DELEGATED" || !studentIds.length) return;
  const user = await client.user.findUnique({ where: { id: actor.id }, select: { guardianId: true } });
  if (!user?.guardianId) return;
  const linked = await client.studentGuardian.findFirst({
    where: { guardianId: user.guardianId, studentId: { in: [...new Set(studentIds)] } },
    select: { studentId: true }
  });
  if (!linked) return;
  await client.authSecurityEvent.create({
    data: {
      eventType: "MARKS_DELEGATION_FAMILY_CONFLICT_DENIED",
      userId: actor.id,
      actorUserId: actor.id,
      subjectType: "STUDENT_MARK_SCOPE",
      subjectId: linked.studentId,
      detailsJson: JSON.stringify({ policy: "ACADEMIC_INTEGRITY_V1_1", scope: targetLabel.slice(0, 120), result: "DENIED" })
    }
  });
  throw new AcademicIntegrityError("Delegated operators cannot edit marks for their own linked child.", 403, "ACADEMIC_INTEGRITY_FAMILY_CONFLICT");
}

async function resolveScopeInput(client: AcademicIntegrityClient, input: Record<string, unknown>): Promise<MarksDelegationScope> {
  const kind = String(input.kind ?? "");
  const targetId = safeId(input.targetId, "Delegation target");
  if (kind === "LEGACY_ASSESSMENT") {
    const assessment = await client.examAssessment.findUnique({ where: { id: targetId }, include: { examCycle: true } });
    if (!assessment || assessment.examCycle.status === "CANCELLED") throw new AcademicIntegrityError("The exact assessment scope is unavailable.", 404);
    return {
      kind,
      academicYear: assessment.academicYear,
      examId: assessment.examCycleId,
      examCode: assessment.examCycle.examCode,
      assessmentId: assessment.id,
      className: assessment.className,
      section: assessment.section,
      subjectId: assessment.timetableSubjectId,
      subjectName: assessment.subjectName,
      componentName: assessment.componentName
    };
  }
  if (kind === "GOVERNED_COMPONENT") {
    const assignment = await client.teacherExamAssignment.findUnique({
      where: { id: targetId },
      include: { examination: true, classScope: true, subjectPaper: true, component: true, schemeVersion: true }
    });
    if (!assignment || assignment.status !== "ACTIVE" || assignment.examination.status !== "ACTIVE" || assignment.classScope.status !== "ACTIVE" || assignment.subjectPaper.status !== "ACTIVE" || assignment.schemeVersion.status !== "ACTIVE") {
      throw new AcademicIntegrityError("The exact governed component scope is unavailable.", 404);
    }
    return {
      kind,
      academicYear: assignment.academicYear,
      examinationId: assignment.examinationId,
      examCode: assignment.examination.examCode,
      classScopeId: assignment.classScopeId,
      subjectPaperId: assignment.subjectPaperId,
      componentId: assignment.componentId,
      className: assignment.className,
      section: assignment.section,
      subjectName: assignment.subjectPaper.subjectNameSnapshot,
      componentName: assignment.component.name
    };
  }
  throw new AcademicIntegrityError("Choose an exact marks delegation scope.", 400, "ACADEMIC_INTEGRITY_INPUT_INVALID");
}

async function ensureMarksOperatorProfile(tx: AcademicIntegrityClient, actor: MarksActor) {
  const existing = await tx.permissionProfile.findUnique({
    where: { normalizedName: MARKS_ENTRY_OPERATOR_NORMALIZED },
    include: { entries: { where: { status: "ACTIVE", revokedAt: null } } }
  });
  if (existing) {
    const permissions = new Set(existing.entries.filter((entry: any) => entry.effect === "ALLOW").map((entry: any) => entry.permission));
    if (existing.status !== "ACTIVE" || permissions.size !== MARKS_DELEGATION_PERMISSIONS.length || MARKS_DELEGATION_PERMISSIONS.some((permission) => !permissions.has(permission))) {
      throw new AcademicIntegrityError("The reserved MARKS_ENTRY_OPERATOR profile is not in its approved state.", 409, "ACADEMIC_INTEGRITY_PROFILE_INVALID");
    }
    return existing;
  }
  const profile = await tx.permissionProfile.create({
    data: {
      publicKey: randomUUID(),
      name: MARKS_ENTRY_OPERATOR_PROFILE,
      normalizedName: MARKS_ENTRY_OPERATOR_NORMALIZED,
      description: "Academic Integrity v1.1 exact-scope marks entry for authorised non-teaching operators.",
      createdByUserId: actor.id,
      updatedByUserId: actor.id,
      entries: {
        create: MARKS_DELEGATION_PERMISSIONS.map((permission) => ({
          permission,
          effect: "ALLOW",
          reason: "Academic Integrity v1.1 reserved scoped profile",
          createdByUserId: actor.id,
          activeKey: `${randomUUID()}:${permission}`
        }))
      }
    },
    include: { entries: true }
  });
  await tx.permissionProfileVersion.create({
    data: {
      profileId: profile.id,
      versionNumber: 1,
      snapshotJson: JSON.stringify({ name: profile.name, policy: "ACADEMIC_INTEGRITY_V1_1", permissions: MARKS_DELEGATION_PERMISSIONS }),
      reason: "Academic Integrity v1.1 reserved scoped profile",
      createdByUserId: actor.id
    }
  });
  return profile;
}

function requireDelegationManager(actor: MarksActor) {
  if (!(["SUPER_ADMIN", "PRINCIPAL"] as Role[]).includes(actor.role)) {
    throw new AcademicIntegrityError("Only the Principal or Super Admin may manage marks-entry delegation.");
  }
}

function optionalExpiry(value: unknown) {
  if (value == null || String(value).trim() === "") return null;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.valueOf()) || parsed <= new Date()) throw new AcademicIntegrityError("Delegation expiry must be in the future.", 400);
  return parsed;
}

export async function grantMarksDelegation(client: PrismaClient, actor: MarksActor, input: Record<string, unknown>) {
  requireDelegationManager(actor);
  const decisionAt = new Date();
  const userHandle = safeId(input.userHandle, "User");
  const reason = boundedText(input.reason, "Delegation reason", 8, 500);
  const validUntilInput = optionalExpiry(input.validUntil);
  const [target, scope] = await Promise.all([
    client.user.findUnique({
      where: { iamPublicKey: userHandle },
      include: { iamRoleAssignments: { where: activeWhere(decisionAt) } }
    }),
    resolveScopeInput(client, input)
  ]);
  if (!target || !target.isActive || target.lifecycleStatus !== "ACTIVE") throw new AcademicIntegrityError("The named user is unavailable.", 404);
  const roles = target.iamRoleAssignments.map((assignment: any) => assignment.role as Role);
  if (target.role === "TEACHER" || roles.includes("TEACHER")) throw new AcademicIntegrityError("Teacher accounts cannot receive marks-entry delegation.");
  if (!roles.some((role: Role) => MARKS_DELEGATION_ELIGIBLE_ROLES.has(role))) {
    throw new AcademicIntegrityError("The named user has no eligible non-teaching role context.");
  }
  return client.$transaction(async (tx) => {
    const profile = await ensureMarksOperatorProfile(tx, actor);
    const existing = await tx.userPermissionProfileAssignment.findFirst({
      where: { userId: target.id, profileId: profile.id, status: "ACTIVE" },
      orderBy: { createdAt: "desc" }
    });
    const envelope = existing ? parseMarksDelegationEnvelope(existing.reason) : { policy: "ACADEMIC_INTEGRITY_V1_1" as const, grants: [] };
    if (!envelope) throw new AcademicIntegrityError("The existing marks delegation record is invalid and must be independently reviewed.", 409);
    const key = marksDelegationScopeKey(scope);
    if (envelope.grants.some((grant) => marksDelegationScopeKey(grant.scope) === key)) {
      throw new AcademicIntegrityError("This exact marks scope is already delegated.", 409);
    }
    const now = new Date();
    if (existing?.validUntil && validUntilInput && validUntilInput > existing.validUntil) {
      throw new AcademicIntegrityError("A new scope cannot extend the expiry of existing delegated scopes. Revoke and re-grant separately.", 409, "ACADEMIC_INTEGRITY_EXPIRY_EXPANSION_DENIED");
    }
    const grants = [...envelope.grants, { scope, reason, grantedByUserId: actor.id, grantedAt: now.toISOString() }];
    if (existing) {
      await tx.userPermissionProfileAssignment.update({
        where: { id: existing.id },
        data: { status: "ENDED", endedAt: now, endedByUserId: actor.id, activeKey: null, version: { increment: 1 } }
      });
    }
    const assignment = await tx.userPermissionProfileAssignment.create({
      data: {
        publicKey: randomUUID(),
        userId: target.id,
        profileId: profile.id,
        reason: encodeMarksDelegationEnvelope({ policy: "ACADEMIC_INTEGRITY_V1_1", grants }),
        assignedByUserId: actor.id,
        validUntil: existing?.validUntil && validUntilInput ? (validUntilInput < existing.validUntil ? validUntilInput : existing.validUntil) : validUntilInput ?? existing?.validUntil ?? null,
        activeKey: `${target.id}:${profile.id}`
      }
    });
    await bumpAuthorizationAndRevokeSessions(tx, target.id, "MARKS_DELEGATION_CHANGED", now);
    await logUserAction(tx, {
      action: "MARKS_ENTRY_DELEGATION_GRANTED",
      actor,
      targetUserId: target.id,
      details: { policy: "ACADEMIC_INTEGRITY_V1_1", profile: profile.name, scopeKey: key, kind: scope.kind, academicYear: scope.academicYear, className: scope.className, section: scope.section, validUntil: assignment.validUntil?.toISOString() ?? null, reason }
    });
    return { assignmentHandle: assignment.publicKey, scopeKey: key, targetUserHandle: userHandle };
  });
}

export async function revokeMarksDelegation(client: PrismaClient, actor: MarksActor, input: Record<string, unknown>) {
  requireDelegationManager(actor);
  const assignmentHandle = safeId(input.assignmentHandle, "Delegation");
  const scopeKey = boundedText(input.scopeKey, "Scope", 24, 24);
  const reason = boundedText(input.reason, "Revocation reason", 8, 500);
  return client.$transaction(async (tx) => {
    const existing = await tx.userPermissionProfileAssignment.findFirst({
      where: { publicKey: assignmentHandle, status: "ACTIVE", profile: { normalizedName: MARKS_ENTRY_OPERATOR_NORMALIZED } },
      include: { profile: true }
    });
    if (!existing) throw new AcademicIntegrityError("The active marks delegation was not found.", 404);
    const envelope = parseMarksDelegationEnvelope(existing.reason);
    if (!envelope) throw new AcademicIntegrityError("The marks delegation record is invalid.", 409);
    const removed = envelope.grants.find((grant) => marksDelegationScopeKey(grant.scope) === scopeKey);
    if (!removed) throw new AcademicIntegrityError("The exact delegated scope was not found.", 404);
    const remaining = envelope.grants.filter((grant) => marksDelegationScopeKey(grant.scope) !== scopeKey);
    const now = new Date();
    await tx.userPermissionProfileAssignment.update({
      where: { id: existing.id },
      data: { status: "ENDED", endedAt: now, endedByUserId: actor.id, activeKey: null, version: { increment: 1 } }
    });
    let replacement = null;
    if (remaining.length) {
      replacement = await tx.userPermissionProfileAssignment.create({
        data: {
          publicKey: randomUUID(),
          userId: existing.userId,
          profileId: existing.profileId,
          reason: encodeMarksDelegationEnvelope({ policy: "ACADEMIC_INTEGRITY_V1_1", grants: remaining }),
          assignedByUserId: actor.id,
          validUntil: existing.validUntil,
          activeKey: `${existing.userId}:${existing.profileId}`
        }
      });
    }
    await bumpAuthorizationAndRevokeSessions(tx, existing.userId, "MARKS_DELEGATION_REVOKED", now);
    await logUserAction(tx, {
      action: "MARKS_ENTRY_DELEGATION_REVOKED",
      actor,
      targetUserId: existing.userId,
      details: { policy: "ACADEMIC_INTEGRITY_V1_1", profile: existing.profile.name, scopeKey, kind: removed.scope.kind, academicYear: removed.scope.academicYear, className: removed.scope.className, section: removed.scope.section, reason, remainingScopes: remaining.length }
    });
    return { replacementHandle: replacement?.publicKey ?? null, remainingScopes: remaining.length };
  });
}

export async function listMarksDelegationAdministration(client: PrismaClient, actor: MarksActor, now = new Date()) {
  requireDelegationManager(actor);
  const [users, assignments, legacy, governed] = await Promise.all([
    client.user.findMany({
      where: { isActive: true, lifecycleStatus: "ACTIVE", iamPublicKey: { not: null } },
      select: { iamPublicKey: true, name: true, username: true, designation: true, role: true, guardianId: true, iamRoleAssignments: { where: activeWhere(now), select: { role: true } } },
      orderBy: { name: "asc" },
      take: 300
    }),
    client.userPermissionProfileAssignment.findMany({
      where: { ...activeWhere(now), profile: { normalizedName: MARKS_ENTRY_OPERATOR_NORMALIZED, status: "ACTIVE" } },
      include: { user: { select: { iamPublicKey: true, name: true, username: true } }, profile: true },
      orderBy: { createdAt: "desc" }
    }),
    client.examAssessment.findMany({
      where: { examCycle: { status: { not: "CANCELLED" } } },
      include: { examCycle: true }, orderBy: [{ academicYear: "desc" }, { className: "asc" }, { section: "asc" }, { subjectName: "asc" }], take: 500
    }),
    client.teacherExamAssignment.findMany({
      where: { status: "ACTIVE", examination: { status: "ACTIVE" }, classScope: { status: "ACTIVE" }, subjectPaper: { status: "ACTIVE" }, schemeVersion: { status: "ACTIVE" } },
      include: { examination: true, classScope: true, subjectPaper: true, component: true },
      orderBy: [{ academicYear: "desc" }, { className: "asc" }, { section: "asc" }], take: 1_000
    })
  ]);
  const candidates = users.filter((user: any) => {
    const roles = user.iamRoleAssignments.map((assignment: any) => assignment.role as Role);
    return user.role !== "TEACHER" && !roles.includes("TEACHER") && roles.some((role: Role) => MARKS_DELEGATION_ELIGIBLE_ROLES.has(role));
  }).map((user: any) => ({
    handle: user.iamPublicKey!, name: user.name, username: user.username, designation: user.designation,
    roles: user.iamRoleAssignments.map((assignment: any) => assignment.role), guardianLinked: Boolean(user.guardianId)
  }));
  const scopes: Array<{ key: string; kind: MarksDelegationScope["kind"]; targetId: string; label: string; scope: MarksDelegationScope }> = [];
  for (const assessment of legacy) {
    const scope: LegacyMarksDelegationScope = { kind: "LEGACY_ASSESSMENT", academicYear: assessment.academicYear, examId: assessment.examCycleId, examCode: assessment.examCycle.examCode, assessmentId: assessment.id, className: assessment.className, section: assessment.section, subjectId: assessment.timetableSubjectId, subjectName: assessment.subjectName, componentName: assessment.componentName };
    scopes.push({ key: marksDelegationScopeKey(scope), kind: scope.kind, targetId: assessment.id, label: `${scope.examCode} · ${scope.className}-${scope.section || "Class-wide"} · ${scope.subjectName} · ${scope.componentName || "Main"}`, scope });
  }
  const governedMap = new Map<string, { key: string; kind: "GOVERNED_COMPONENT"; targetId: string; label: string; scope: GovernedMarksDelegationScope }>();
  for (const assignment of governed) {
    const scope: GovernedMarksDelegationScope = { kind: "GOVERNED_COMPONENT", academicYear: assignment.academicYear, examinationId: assignment.examinationId, examCode: assignment.examination.examCode, classScopeId: assignment.classScopeId, subjectPaperId: assignment.subjectPaperId, componentId: assignment.componentId, className: assignment.className, section: assignment.section, subjectName: assignment.subjectPaper.subjectNameSnapshot, componentName: assignment.component.name };
    const key = marksDelegationScopeKey(scope);
    if (!governedMap.has(key)) governedMap.set(key, { key, kind: scope.kind, targetId: assignment.id, label: `${scope.examCode} · ${scope.className}-${scope.section} · ${scope.subjectName} · ${scope.componentName}`, scope });
  }
  scopes.push(...governedMap.values());
  const delegations = assignments.flatMap((assignment: any) => {
    const envelope = parseMarksDelegationEnvelope(assignment.reason);
    if (!envelope) return [];
    return envelope.grants.map((grant) => ({
      assignmentHandle: assignment.publicKey,
      userHandle: assignment.user.iamPublicKey,
      userName: assignment.user.name,
      username: assignment.user.username,
      profile: assignment.profile.name,
      scopeKey: marksDelegationScopeKey(grant.scope),
      scope: grant.scope,
      reason: grant.reason,
      validUntil: assignment.validUntil?.toISOString() ?? null,
      grantedAt: grant.grantedAt
    }));
  });
  return { policy: "ACADEMIC_INTEGRITY_V1_1", candidates, delegations, scopes };
}
