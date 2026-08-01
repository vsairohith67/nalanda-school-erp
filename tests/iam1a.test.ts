import { describe, expect, it } from "vitest";
import { evaluatePermissionFromSnapshot } from "@/lib/iam/effective-access";
import { permissionDelegability, immutablePermissionDenial } from "@/lib/iam/permission-governance";
import { profileEntriesInput, rolesInput } from "@/lib/iam/validation";
import { createBackupDocument, serializeBackup } from "@/lib/backup";
import { parseAndValidateBackup } from "@/lib/restore";
import { requestBodyLimitBytes } from "@/lib/request-security";

const at = new Date("2026-08-01T10:00:00.000Z");
const baseUser = { id: "u1", isActive: true, lifecycleStatus: "ACTIVE", authorizationVersion: 3, designation: "Associate Director" };
const baseSession = { id: "s1", userId: "u1", revokedAt: null, expiresAt: new Date("2026-08-02T10:00:00.000Z"), authorizationVersion: 3, activeRoleAssignmentId: "r1" };
const assignment = { id: "r1", userId: "u1", role: "DIRECTOR", status: "ACTIVE", validFrom: new Date("2026-07-01T00:00:00.000Z"), validUntil: null };

function snapshot(input: { user?: object | null; session?: object | null; assignment?: object | null; overrides?: object[]; entries?: object[]; base?: string[] } = {}) {
  const entries = input.entries ?? [];
  return {
    now: at,
    user: input.user === null ? null : { ...baseUser, ...(input.user ?? {}) },
    session: input.session === null ? null : { ...baseSession, ...(input.session ?? {}) },
    sessionRequested: false,
    selectedAssignmentId: "r1",
    roleAssignment: input.assignment === null ? null : { ...assignment, ...(input.assignment ?? {}) },
    overrides: input.overrides ?? [],
    profileAssignments: entries.length ? [{ profile: { name: "IAM1A Limited", entries } }] : [],
    basePermissions: new Set(input.base ?? [])
  } as never;
}

async function decide(permission: string, input: Parameters<typeof snapshot>[0] = {}, objectScopeSatisfied?: boolean) {
  return evaluatePermissionFromSnapshot({} as never, snapshot(input), permission, objectScopeSatisfied);
}

describe("IAM-1A authoritative permission precedence", () => {
  it("fails closed for account, session, assignment, invariant, object scope and unknown permissions", async () => {
    expect((await decide("VIEW_STUDENTS", { user: { isActive: false } })).source).toBe("ACCOUNT");
    expect((await decide("VIEW_STUDENTS", { session: { revokedAt: at } })).source).toBe("SESSION");
    const missingSessionSnapshot = snapshot({ session: null }) as unknown as Record<string, unknown>;
    expect((await evaluatePermissionFromSnapshot({} as never, { ...missingSessionSnapshot, sessionRequested: true } as never, "VIEW_STUDENTS")).source).toBe("SESSION");
    expect((await decide("VIEW_STUDENTS", { session: { activeRoleAssignmentId: "other-role" } })).source).toBe("SESSION");
    expect((await decide("VIEW_STUDENTS", { assignment: { status: "ENDED" } })).source).toBe("ROLE_ASSIGNMENT");
    expect((await decide("GRANT_SUPER_ADMIN", { overrides: [{ permission: "GRANT_SUPER_ADMIN", effect: "ALLOW" }] })).source).toBe("SYSTEM_RESTRICTION");
    expect((await decide("VIEW_PAYMENTS", { overrides: [{ permission: "VIEW_PAYMENTS", effect: "ALLOW" }] }, false)).source).toBe("OBJECT_SCOPE");
    expect((await decide("NOT_A_PERMISSION")).source).toBe("DEFAULT_DENY");
  });

  it("applies deny before every allow source", async () => {
    const profileAllow = { permission: "VIEW_STUDENTS", effect: "ALLOW", status: "ACTIVE", revokedAt: null, validFrom: at, validUntil: null };
    const profileDeny = { ...profileAllow, effect: "DENY" };
    expect((await decide("VIEW_STUDENTS", { overrides: [{ permission: "VIEW_STUDENTS", effect: "ALLOW" }, { permission: "VIEW_STUDENTS", effect: "DENY" }], entries: [profileAllow], base: ["VIEW_STUDENTS"] })).source).toBe("USER_DENY");
    expect((await decide("VIEW_STUDENTS", { overrides: [{ permission: "VIEW_STUDENTS", effect: "ALLOW" }], entries: [profileDeny], base: ["VIEW_STUDENTS"] })).source).toBe("PROFILE_DENY");
    expect((await decide("VIEW_STUDENTS", { overrides: [{ permission: "VIEW_STUDENTS", effect: "ALLOW" }] })).source).toBe("USER_ALLOW");
    expect((await decide("VIEW_STUDENTS", { entries: [profileAllow] })).source).toBe("PROFILE_ALLOW");
    expect((await decide("VIEW_STUDENTS", { base: ["VIEW_STUDENTS"] })).source).toBe("BASE_ROLE");
    expect((await decide("VIEW_STUDENTS")).allowed).toBe(false);
  });
});

describe("IAM-1A delegation and input policy", () => {
  it("keeps designations separate and protects non-delegable and Computer Operator authority", () => {
    expect(permissionDelegability("GRANT_SUPER_ADMIN")).toBe("SUPER_ADMIN_ONLY_NON_DELEGABLE");
    expect(permissionDelegability("ENTER_ASSIGNED_EXAM_MARKS")).toBe("OBJECT_SCOPED");
    expect(immutablePermissionDenial("COMPUTER_OPERATOR", "VIEW_PAYMENTS")).toContain("cannot be expanded");
    expect(() => profileEntriesInput([{ permission: "GRANT_SUPER_ADMIN", effect: "ALLOW" }])).toThrow("cannot be granted");
    expect(() => profileEntriesInput([{ permission: "VIEW_STUDENTS", effect: "ALLOW" }, { permission: "VIEW_STUDENTS", effect: "DENY" }])).toThrow("Duplicate");
    expect(() => rolesInput(["TEACHER", "TEACHER"])).toThrow("Duplicate");
  });

  it("keeps IAM and context mutations behind bounded global CSRF middleware", () => {
    expect(requestBodyLimitBytes("/api/iam/users")).toBe(64 * 1024);
    expect(requestBodyLimitBytes("/api/auth/context")).toBe(16 * 1024);
  });
});

describe("IAM-1A version-37 backup boundary", () => {
  it("preserves IAM evidence and excludes credentials and live context identifiers", () => {
    const iso = at.toISOString();
    const backup = createBackupDocument({
      generatedAt: at, generatedBy: "IAM1A-QA", students: [], feeStructures: [], payments: [], paymentAudits: [],
      users: [{ id: "u1", name: "IAM QA", username: "iam-qa", role: "SUPER_ADMIN", isActive: true }],
      iamAccess: {
        userStates: [{ userId: "u1", iamPublicKey: "iam-public-u1", designation: "Director", lifecycleStatus: "ACTIVE", isActive: true, authorizationVersion: 3, mustChangePassword: false, temporaryPasswordExpiresAt: null, suspensionReason: null, version: 2, passwordHash: "forbidden" }],
        roleAssignments: [{ id: "r1", publicKey: "role-public", userId: "u1", role: "SUPER_ADMIN", status: "ACTIVE", validFrom: iso, validUntil: null, reason: "IAM1A governed QA evidence", assignedByUserId: "u1", endedByUserId: null, endedAt: null, version: 1, contextVersion: 1, activeKey: "u1:SUPER_ADMIN", createdAt: iso, updatedAt: iso }],
        profiles: [{ id: "p1", publicKey: "profile-public", name: "IAM1A Read Only", normalizedName: "iam1a read only", description: null, status: "ACTIVE", version: 1, createdByUserId: "u1", updatedByUserId: "u1", archivedAt: null, createdAt: iso, updatedAt: iso }],
        profileEntries: [{ id: "pe1", profileId: "p1", permission: "VIEW_STUDENTS", effect: "ALLOW", status: "ACTIVE", validFrom: iso, validUntil: null, reason: "IAM1A governed QA evidence", createdByUserId: "u1", revokedByUserId: null, revokedAt: null, supersedesId: null, version: 1, activeKey: "p1:VIEW_STUDENTS", createdAt: iso }],
        profileVersions: [{ id: "pv1", profileId: "p1", versionNumber: 1, snapshotJson: "{}", reason: "IAM1A governed QA evidence", createdByUserId: "u1", createdAt: iso }],
        profileAssignments: [], overrides: [],
        audits: [{ id: "a1", action: "IAM_PROFILE_CREATED", actorUserId: "u1", actorName: "IAM QA", targetUserId: "u1", detailsJson: "{}", createdAt: iso }]
      }
    });
    const serialized = serializeBackup(backup);
    expect(serialized).not.toContain("forbidden");
    expect(serialized).not.toContain("activeRoleAssignmentId");
    expect(serialized).not.toContain("activeChildLinkId");
    const restored = parseAndValidateBackup(serialized);
    expect(restored.iamAccess.roleAssignments).toHaveLength(1);
    expect(restored.iamAccess.profiles).toHaveLength(1);
    expect(restored.iamAccess.audits).toHaveLength(1);
  });
});
