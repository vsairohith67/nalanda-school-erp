import { describe, expect, it } from "vitest";
import {
  buildGuardianImportPreview,
  createParentUserFromGuardian,
  guardianSearchWhere,
  importGuardianLinks,
  normalizeGuardianImportRows,
  normalizeMobileForStorage,
  validateGuardianPayload,
  type GuardianImportStudent
} from "../lib/guardians";

const students: GuardianImportStudent[] = [
  { id: "student-1", admissionNo: "NPS26001", studentName: "Aarav Reddy", className: "LKG", section: "A" },
  { id: "student-2", admissionNo: "NPS26002", studentName: "Sara Reddy", className: "I", section: "B" }
];

describe("guardian foundation helpers", () => {
  it("builds guardian search across guardian and linked student fields", () => {
    expect(guardianSearchWhere("")).toEqual({});
    const whereText = JSON.stringify(guardianSearchWhere("reddy"));
    expect(whereText).toContain("displayName");
    expect(whereText).toContain("primaryMobile");
    expect(whereText).toContain("alternateMobile");
    expect(whereText).toContain("email");
    expect(whereText).toContain("admissionNo");
    expect(whereText).toContain("studentName");
    expect(whereText).toContain("reddy");
  });

  it("normalizes guardian creation input safely", () => {
    expect(validateGuardianPayload({
      displayName: "SURESH REDDY",
      primaryMobile: "+91 90000 00001",
      alternateMobile: "09000000101",
      email: " Parent@Example.COM ",
      relationship: "Father",
      status: "Inactive"
    })).toMatchObject({
      displayName: "Suresh Reddy",
      primaryMobile: "9000000001",
      alternateMobile: "9000000101",
      email: "parent@example.com",
      relationship: "Father",
      status: "Inactive"
    });
    expect(() => validateGuardianPayload({ displayName: "", primaryMobile: "" }))
      .toThrow("Guardian name is required");
    expect(normalizeMobileForStorage("90000-00001")).toBe("9000000001");
  });

  it("previews the same mobile linked to multiple students as one sibling guardian group", () => {
    const preview = normalizeGuardianImportRows([
      { admissionNo: "NPS26001", guardianName: "Suresh Reddy", mobile: "9000000001", relationship: "Father" },
      { admissionNo: "NPS26002", guardianName: "Suresh Reddy", mobile: "+91 9000000001", relationship: "Father" }
    ], students);

    expect(preview.counts.valid).toBe(2);
    expect(preview.counts.newGuardians).toBe(1);
    expect(preview.rows[1].warnings).toContain("Same guardian mobile/email appears earlier in this upload; this row will link another student to the same guardian.");
  });

  it("matches duplicate guardians by mobile first and email second", () => {
    const preview = normalizeGuardianImportRows([
      { admissionNo: "NPS26001", guardianName: "Suresh Reddy", mobile: "9000000001", email: "new@example.com" },
      { admissionNo: "NPS26002", guardianName: "Lakshmi Reddy", mobile: "9000000099", email: "parent@example.com" }
    ], students, [{
      id: "guardian-1",
      displayName: "Existing Parent",
      primaryMobile: "9000000001",
      email: "parent@example.com"
    }]);

    expect(preview.rows[0].matchedGuardian?.id).toBe("guardian-1");
    expect(preview.rows[1].matchedGuardian?.id).toBe("guardian-1");
    expect(preview.counts.matchedGuardians).toBe(2);
  });

  it("warns when an import row repeats an existing guardian-student link", () => {
    const preview = normalizeGuardianImportRows([
      { admissionNo: "NPS26001", guardianName: "Suresh Reddy", mobile: "9000000001" }
    ], students, [{
      id: "guardian-1",
      displayName: "Suresh Reddy",
      primaryMobile: "9000000001",
      email: null
    }], [{ guardianId: "guardian-1", studentId: "student-1" }]);

    expect(preview.counts.existingLinks).toBe(1);
    expect(preview.rows[0].warnings).toContain("Guardian is already linked to this student; settings may be updated on confirm.");
  });

  it("keeps dry-run preview read-only", async () => {
    const fake = fakeGuardianClient();
    const preview = await buildGuardianImportPreview(fake as never, [
      { admissionNo: "NPS26001", guardianName: "Suresh Reddy", mobile: "9000000001" }
    ]);

    expect(preview.counts.valid).toBe(1);
    expect(fake.state.guardians).toEqual([]);
    expect(fake.state.links).toEqual([]);
  });

  it("confirmed import creates one guardian and links two siblings", async () => {
    const fake = fakeGuardianClient();
    const preview = normalizeGuardianImportRows([
      { admissionNo: "NPS26001", guardianName: "Suresh Reddy", mobile: "9000000001", isPrimaryContact: "yes" },
      { admissionNo: "NPS26002", guardianName: "Suresh Reddy", mobile: "9000000001" }
    ], students);

    const result = await importGuardianLinks(fake as never, preview);

    expect(result.guardiansCreated).toBe(1);
    expect(result.linksCreated).toBe(2);
    expect(fake.state.guardians).toHaveLength(1);
    expect(fake.state.links.map((link) => link.studentId).sort()).toEqual(["student-1", "student-2"]);
  });

  it("reports missing and unknown admission numbers as clear row errors", () => {
    const missing = normalizeGuardianImportRows([
      { guardianName: "Suresh Reddy", mobile: "9000000001" }
    ], students);
    const preview = normalizeGuardianImportRows([
      { admissionNo: "MISSING", guardianName: "Suresh Reddy", mobile: "9000000001" }
    ], students);

    expect(missing.counts.errors).toBe(1);
    expect(missing.rows[0].errors).toContain("Missing admissionNo (student admission number is required).");
    expect(preview.counts.errors).toBe(1);
    expect(preview.rows[0].errors).toContain("Admission number MISSING was not found in Student Master.");
  });

  it("creates a Parent user only from explicit guardian account input", async () => {
    const fake = fakeGuardianClient();
    fake.state.guardians.push({
      id: "guardian-1",
      displayName: "Suresh Reddy",
      primaryMobile: "9000000001",
      email: "parent@example.com",
      users: []
    });

    const user = await createParentUserFromGuardian(fake as never, "guardian-1", {
      username: "Parent9000000001",
      email: "",
      password: "Reviewed@123"
    });

    expect(user).toMatchObject({
      username: "parent9000000001",
      role: "PARENT",
      guardianId: "guardian-1"
    });
    expect(fake.state.users[0].passwordHash).not.toBe("Reviewed@123");
  });
});

function fakeGuardianClient() {
  const state = {
    guardians: [] as Array<Record<string, any>>,
    links: [] as Array<Record<string, any>>,
    users: [] as Array<Record<string, any>>
    ,aliases: [] as Array<Record<string, any>>
  };
  return {
    state,
    student: {
      findMany: async () => students
    },
    guardian: {
      findMany: async () => state.guardians,
      findUnique: async ({ where }: { where: { id: string } }) => {
        const guardian = state.guardians.find((row) => row.id === where.id) ?? null;
        return guardian ? { ...guardian, users: state.users.filter((user) => user.guardianId === guardian.id) } : null;
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const guardian = { id: `guardian-${state.guardians.length + 1}`, ...data, users: [] };
        state.guardians.push(guardian);
        return guardian;
      }
    },
    studentGuardian: {
      findMany: async () => state.links,
      findUnique: async ({ where }: { where: { guardianId_studentId: { guardianId: string; studentId: string } } }) =>
        state.links.find((link) =>
          link.guardianId === where.guardianId_studentId.guardianId &&
          link.studentId === where.guardianId_studentId.studentId
        ) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const link = { id: `link-${state.links.length + 1}`, ...data };
        state.links.push(link);
        return link;
      },
      update: async ({ where, data }: { where: { guardianId_studentId: { guardianId: string; studentId: string } }; data: Record<string, unknown> }) => {
        const link = state.links.find((row) =>
          row.guardianId === where.guardianId_studentId.guardianId &&
          row.studentId === where.guardianId_studentId.studentId
        );
        Object.assign(link!, data);
        return link;
      },
      updateMany: async ({ where, data }: { where: { studentId: string; guardianId: { not: string } }; data: Record<string, unknown> }) => {
        for (const link of state.links) {
          if (link.studentId === where.studentId && link.guardianId !== where.guardianId.not) {
            Object.assign(link, data);
          }
        }
      }
    },
    user: {
      create: async ({ data, select }: { data: Record<string, any>; select: Record<string, boolean> }) => {
        const user: Record<string, any> = { id: `user-${state.users.length + 1}`, ...data };
        state.users.push(user);
        return Object.fromEntries(Object.keys(select).map((key) => [key, user[key]]));
      },
      findUnique: async ({ where }: { where: { username?: string; id?: string } }) =>
        state.users.find((user) => user.username === where.username || user.id === where.id) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const user = state.users.find((row) => row.id === where.id);
        Object.assign(user!, data);
        return user;
      }
    },
    authLoginAlias: {
      create: async ({ data }: { data: Record<string, any> }) => {
        const alias = { id: data.id ?? `alias-${state.aliases.length + 1}`, ...data };
        state.aliases.push(alias);
        return alias;
      }
    }
  };
}
