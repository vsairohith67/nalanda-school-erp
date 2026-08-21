import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  MARKS_DELEGATION_PREFIX,
  MARKS_DELEGATION_PERMISSIONS,
  marksDelegationScopeKey,
  parseMarksDelegationEnvelope,
  resolveMarksWriteAuthority,
  type LegacyMarksDelegationScope
} from "@/lib/academic-integrity";
import { immutablePermissionDenial } from "@/lib/iam/permission-governance";
import { permissionCanAppearInProfile } from "@/lib/iam/permission-governance";
import { RECOMMENDED_ROLE_PERMISSIONS } from "@/lib/permissions";

const exactScope: LegacyMarksDelegationScope = {
  kind: "LEGACY_ASSESSMENT",
  academicYear: "2026-27",
  examId: "exam-1",
  examCode: "TERM-1",
  assessmentId: "assessment-1",
  className: "VI",
  section: "A",
  subjectId: "subject-1",
  subjectName: "Mathematics",
  componentName: "Theory"
};

function envelope(scope = exactScope) {
  return `${MARKS_DELEGATION_PREFIX}${JSON.stringify({ policy: "ACADEMIC_INTEGRITY_V1_1", grants: [{ scope, reason: "Approved examination data entry", grantedByUserId: "principal-1", grantedAt: "2026-08-21T12:00:00.000Z" }] })}`;
}

function delegatedClient(options: { assignments?: any[]; teacherRole?: boolean } = {}) {
  return {
    userRoleAssignment: { findFirst: async () => options.teacherRole ? { id: "teacher-role" } : null },
    userPermissionProfileAssignment: { findMany: async () => options.assignments ?? [{ id: "grant-1", publicKey: "grant-handle", reason: envelope(), profile: { name: "MARKS_ENTRY_OPERATOR" } }] },
    authSecurityEvent: { create: async (input: unknown) => input }
  } as any;
}

describe("ACADEMIC-INTEGRITY-1A permanent marks-write policy", () => {
  it("allows only Super Admin and Principal directly", async () => {
    await expect(resolveMarksWriteAuthority({} as any, { id: "sa", name: "SA", role: "SUPER_ADMIN" })).resolves.toMatchObject({ mode: "LEADERSHIP" });
    await expect(resolveMarksWriteAuthority({} as any, { id: "p", name: "Principal", role: "PRINCIPAL" })).resolves.toMatchObject({ mode: "LEADERSHIP" });
    for (const role of ["DIRECTOR", "ACCOUNTANT", "ADMIN", "COMPUTER_OPERATOR", "GATE_STAFF", "PARENT", "STUDENT", "VIEWER"] as const) {
      expect(RECOMMENDED_ROLE_PERMISSIONS[role].has("ENTER_MARKS")).toBe(false);
      expect(RECOMMENDED_ROLE_PERMISSIONS[role].has("SUBMIT_MARKS")).toBe(false);
    }
  });

  it("permanently denies Teacher UI/API write permissions despite assignments or overrides", async () => {
    for (const permission of ["ENTER_MARKS", "SUBMIT_MARKS", "ENTER_ASSIGNED_EXAM_MARKS", "SUBMIT_ASSIGNED_EXAM_MARKS", "ENTER_REPORT_CARD_DATA", "SUBMIT_REPORT_CARDS"] as const) {
      expect(RECOMMENDED_ROLE_PERMISSIONS.TEACHER.has(permission)).toBe(false);
      expect(immutablePermissionDenial("TEACHER", permission)).toMatch(/Academic Integrity v1\.1/);
    }
    await expect(resolveMarksWriteAuthority({} as any, { id: "t", name: "Teacher", role: "TEACHER" }, exactScope)).rejects.toThrow(/Teacher accounts cannot/);
    const shell = readFileSync("components/app-shell.tsx", "utf8");
    expect(shell).not.toContain('href="/teacher/marks"');
    const route = readFileSync("app/teacher/marks/page.tsx", "utf8");
    expect(route).toContain('redirect("/unauthorized?policy=academic-integrity")');
  });

  it("keeps Computer Operator and Viewer denied without an explicit reserved profile grant", async () => {
    for (const role of ["COMPUTER_OPERATOR", "VIEWER"] as const) {
      await expect(resolveMarksWriteAuthority(delegatedClient({ assignments: [] }), { id: role, name: role, role }, exactScope)).rejects.toThrow(/No active delegated/);
    }
  });

  it("allows an eligible non-Teacher only inside the exact delegated scope", async () => {
    const actor = { id: "operator-1", name: "Operator", role: "COMPUTER_OPERATOR" as const };
    await expect(resolveMarksWriteAuthority(delegatedClient(), actor, exactScope)).resolves.toMatchObject({ mode: "DELEGATED", profileName: "MARKS_ENTRY_OPERATOR" });
    await expect(resolveMarksWriteAuthority(delegatedClient(), actor, { ...exactScope, section: "B" })).rejects.toThrow(/exact scope/);
    await expect(resolveMarksWriteAuthority(delegatedClient(), actor, { ...exactScope, assessmentId: "tampered" })).rejects.toThrow(/exact scope/);
  });

  it("records privacy-safe denied exact-scope decisions", async () => {
    const events: any[] = [];
    const client = delegatedClient({ assignments: [] });
    client.authSecurityEvent.create = async (input: any) => events.push(input.data);
    await expect(resolveMarksWriteAuthority(client, { id: "operator-1", name: "Operator", role: "COMPUTER_OPERATOR" }, { ...exactScope, section: "B" })).rejects.toThrow(/exact scope/);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ eventType: "MARKS_WRITE_AUTHORITY_DENIED", subjectType: "MARKS_SCOPE" });
    expect(events[0].detailsJson).toContain('"reasonCode":"NO_EXACT_DELEGATED_SCOPE"');
    expect(events[0].detailsJson).not.toContain("Mathematics");
  });

  it("denies revoked, expired/stale, and multi-role Teacher-linked operators", async () => {
    const actor = { id: "operator-1", name: "Operator", role: "VIEWER" as const };
    await expect(resolveMarksWriteAuthority(delegatedClient({ assignments: [] }), actor, exactScope)).rejects.toThrow(/No active delegated/);
    await expect(resolveMarksWriteAuthority(delegatedClient({ teacherRole: true }), actor, exactScope)).rejects.toThrow(/active Teacher role/);
  });

  it("uses stable exact-scope keys and rejects malformed delegation envelopes", () => {
    expect(marksDelegationScopeKey(exactScope)).toHaveLength(24);
    expect(marksDelegationScopeKey({ ...exactScope, assessmentId: "assessment-2" })).not.toBe(marksDelegationScopeKey(exactScope));
    expect(parseMarksDelegationEnvelope(envelope())?.grants).toHaveLength(1);
    expect(parseMarksDelegationEnvelope(`${MARKS_DELEGATION_PREFIX}{bad`)).toBeNull();
  });

  it("keeps the reserved profile exact-scope only and out of generic IAM assignment", () => {
    expect(MARKS_DELEGATION_PERMISSIONS).not.toContain("VIEW_EXAMS");
    expect(MARKS_DELEGATION_PERMISSIONS).not.toContain("VIEW_EXAM_REPORTS");
    expect(readFileSync("lib/iam/users.ts", "utf8")).toContain("Use Marks Entry Delegation to grant the reserved operator profile");
    const profiles = readFileSync("lib/iam/profiles.ts", "utf8");
    expect(profiles).toContain("MARKS_ENTRY_OPERATOR is managed only in Marks Entry Delegation");
    expect(profiles).toContain("normalizedName: { not: RESERVED_MARKS_OPERATOR_PROFILE }");
    for (const permission of MARKS_DELEGATION_PERMISSIONS) {
      if (permission !== "VIEW_OWN_EXAM_MARKS") expect(permissionCanAppearInProfile(permission)).toBe(false);
    }
    const users = readFileSync("lib/iam/users.ts", "utf8");
    expect(users).toContain('profiles.some((profile) => profile.normalizedName === RESERVED_MARKS_OPERATOR_PROFILE)');
    expect(users).toContain("Marks-write authority requires an exact Marks Entry Delegation scope");
    const delegationPage = readFileSync("app/marks/delegation/page.tsx", "utf8");
    expect(delegationPage).toContain('new Set(["PRINCIPAL", "SUPER_ADMIN"])');
    expect(delegationPage).toContain('redirect("/unauthorized")');
  });

  it("lets an exact delegated operator open the legacy entry surface without broad VIEW_EXAMS", () => {
    expect(readFileSync("app/marks/entry/[assessmentId]/page.tsx", "utf8")).toContain('requirePermission("ENTER_MARKS")');
    const route = readFileSync("app/api/marks/entry/[assessmentId]/route.ts", "utf8");
    expect(route).toContain('GET(_: NextRequest');
    expect(route).toContain('requireApiPermission("ENTER_MARKS")');
    expect(route).toContain('loadScopedAssessment(auth.user, id, "WRITE")');
  });

  it("protects every focused mutation surface with server-side academic-integrity enforcement", () => {
    const files = [
      "app/api/marks/entry/[assessmentId]/route.ts",
      "app/api/marks/entry/[assessmentId]/correct/route.ts",
      "app/api/marks/import/route.ts",
      "app/api/exams/[id]/assessments/[assessmentId]/workflow/route.ts",
      "app/api/exam-marks/sheets/[assignmentId]/route.ts",
      "app/api/exam-marks/sheets/[assignmentId]/submit/route.ts",
      "app/api/exam-marks/sheets/[assignmentId]/correction/route.ts",
      "app/api/report-cards/[id]/route.ts",
      "app/api/report-cards/[id]/workflow/route.ts"
    ];
    const combined = files.map((file) => readFileSync(file, "utf8")).join("\n");
    expect(combined).toContain("resolveMarksWriteAuthority");
    expect(combined).not.toContain('requireApiRolePermission("ENTER_ASSIGNED_EXAM_MARKS", "TEACHER")');
    expect(readFileSync("lib/marks-import.ts", "utf8")).toContain("assertNoDelegatedFamilyConflict");
    expect(readFileSync("lib/exam-marks.ts", "utf8")).toContain("assertNoDelegatedFamilyConflict");
  });
});
