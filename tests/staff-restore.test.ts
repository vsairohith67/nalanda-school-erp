import { describe, expect, it } from "vitest";
import { emptyEntityResult } from "../lib/restore";
import { restoreStaffData } from "../lib/restore-database";

function clientFixture() {
  const staff: any[] = [];
  const users = [{ id: "local-teacher", role: "TEACHER" }];
  const teachers = [{ id: "tt-1" }];
  const model = {
    findUnique: async ({ where }: any) => staff.find((row) =>
      (where.id && row.id === where.id) || (where.staffCode && row.staffCode === where.staffCode) ||
      (where.userId && row.userId === where.userId) || (where.timetableTeacherId && row.timetableTeacherId === where.timetableTeacherId)) ?? null,
    findMany: async ({ where, take }: any) => staff.filter((row) =>
      (where.email && row.email === where.email) || (where.mobile && row.mobile === where.mobile)).slice(0, take),
    create: async ({ data }: any) => { const row = { ...data }; staff.push(row); return row; },
    update: async ({ where, data }: any) => { const index = staff.findIndex((row) => row.id === where.id); staff[index] = { ...staff[index], ...data }; return staff[index]; }
  };
  return { staff, client: { staffMember: model, user: { findUnique: async ({ where }: any) => users.find((row) => row.id === where.id) ?? null }, timetableTeacher: { findUnique: async ({ where }: any) => teachers.find((row) => row.id === where.id) ?? null } } };
}

const backupStaff = (overrides: Record<string, unknown> = {}) => ({
  id: "staff-1", staffCode: "T-01", fullName: "Asha Rao", displayName: "Asha",
  staffType: "TEACHING", designation: "Teacher", department: "Academics",
  primarySubject: "Mathematics", additionalSubjects: "Science", qualification: "B.Ed",
  experienceYears: 5, dateOfJoining: "2024-06-01T00:00:00.000Z", mobile: "9876543210",
  alternateMobile: "9876543211", email: "asha@example.com", address: "Hyderabad",
  emergencyContactName: "Rao", emergencyContactMobile: "9876543212", status: "ACTIVE",
  notes: "Senior teacher", userId: "backup-teacher", timetableTeacherId: "tt-1", ...overrides
});

describe("staff restore safety", () => {
  it("restores staff fields and safe User/TimetableTeacher links", async () => {
    const fixture = clientFixture(); const result = { staffMembers: emptyEntityResult(), warnings: [] as string[] };
    await restoreStaffData(fixture.client as never, { staffMembers: [backupStaff()] }, new Map([["backup-teacher", "local-teacher"]]), result);
    expect(result.staffMembers.created).toBe(1);
    expect(fixture.staff[0]).toMatchObject({ staffType: "TEACHING", designation: "Teacher", status: "ACTIVE", mobile: "9876543210", userId: "local-teacher", timetableTeacherId: "tt-1" });
  });

  it("prevents duplicate links and preserves an existing safe local link", async () => {
    const fixture = clientFixture();
    fixture.staff.push({ id: "occupied", staffCode: "O-1", userId: "local-teacher", timetableTeacherId: "tt-1" });
    fixture.staff.push({ id: "staff-1", staffCode: "T-01", userId: "keep-user", timetableTeacherId: "keep-tt" });
    const result = { staffMembers: emptyEntityResult(), warnings: [] as string[] };
    await restoreStaffData(fixture.client as never, { staffMembers: [backupStaff()] }, new Map([["backup-teacher", "local-teacher"]]), result);
    expect(fixture.staff.find((row) => row.id === "staff-1")).toMatchObject({ userId: "keep-user", timetableTeacherId: "keep-tt" });
    expect(result.warnings).toHaveLength(2);
  });

  it("refuses ambiguous email matching", async () => {
    const fixture = clientFixture();
    fixture.staff.push({ id: "a", email: "same@example.com" }, { id: "b", email: "same@example.com" });
    const result = { staffMembers: emptyEntityResult(), warnings: [] as string[] };
    await restoreStaffData(fixture.client as never, { staffMembers: [backupStaff({ id: "new", staffCode: null, email: "same@example.com", userId: null, timetableTeacherId: null })] }, new Map(), result);
    expect(result.staffMembers.errors[0]).toContain("Multiple local staff profiles use this email");
  });
});
