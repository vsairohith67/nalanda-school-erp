import { describe, expect, it } from "vitest";
import { applyStaffImport, buildStaffImportPreview, buildStaffSearchWhere, friendlyStaffError, validateStaffInput } from "../lib/staff";

function fakeClient(existing: Array<Record<string, any>> = []) {
  const rows = existing.map((row) => ({ ...row }));
  return { rows, staffMember: {
    findUnique: async ({ where }: any) => rows.find((row) => (where.staffCode && row.staffCode === where.staffCode) || (where.id && row.id === where.id)) ?? null,
    findFirst: async ({ where }: any) => rows.find((row) => (where.email && row.email === where.email) || (where.mobile && row.mobile === where.mobile)) ?? null,
    findMany: async ({ where, take }: any) => rows.filter((row) => (where.email && row.email === where.email) || (where.mobile && row.mobile === where.mobile)).slice(0, take),
    create: async ({ data }: any) => { const value = { id: `staff-${rows.length + 1}`, ...data }; rows.push(value); return value; },
    update: async ({ where, data }: any) => { const index = rows.findIndex((row) => row.id === where.id); rows[index] = { ...rows[index], ...data }; return rows[index]; }
  }};
}

describe("staff foundation", () => {
  it("validates staff creation and update fields", () => {
    const value = validateStaffInput({ staffCode: " t-01 ", fullName: "Asha Rao", staffType: "teaching", designation: "Teacher", experienceYears: "4.5", status: "active" });
    expect(value).toMatchObject({ staffCode: "T-01", fullName: "Asha Rao", staffType: "TEACHING", designation: "Teacher", experienceYears: 4.5, status: "ACTIVE" });
    expect(() => validateStaffInput({ fullName: "", designation: "Teacher" })).toThrow("Full name is required");
    expect(() => validateStaffInput({ fullName: "A", designation: "Teacher", mobile: "123" })).toThrow("Mobile must contain 7 to 15 digits");
    expect(() => validateStaffInput({ fullName: "A", designation: "Teacher", mobile: "abc9876543210" })).toThrow("Mobile contains unsupported characters");
    expect(() => validateStaffInput({ fullName: "A", designation: "Teacher", email: "bad-email" })).toThrow("Email is invalid");
    expect(() => validateStaffInput({ fullName: "A", designation: "Teacher", dateOfJoining: "2026-02-30" })).toThrow("Date of joining is invalid");
    expect(validateStaffInput({ fullName: "A", designation: "Teacher", dateOfJoining: "27/06/2026" }).dateOfJoining?.toISOString()).toBe("2026-06-27T00:00:00.000Z");
  });

  it("builds search across name/code/mobile/email/subject/designation", () => {
    const where = buildStaffSearchWhere({ query: "math", staffType: "TEACHING", status: "ACTIVE", designation: "Teacher", subject: "Science" });
    expect(JSON.stringify(where)).toContain("staffCode"); expect(JSON.stringify(where)).toContain("fullName");
    expect(JSON.stringify(where)).toContain("mobile"); expect(JSON.stringify(where)).toContain("email");
    expect(JSON.stringify(where)).toContain("primarySubject"); expect(JSON.stringify(where)).toContain("designation");
  });

  it("previews without mutation and matches staffCode first", async () => {
    const client = fakeClient([{ id: "existing", staffCode: "T-01", email: "old@example.com", mobile: "9000", fullName: "Old" }]);
    const preview = await buildStaffImportPreview(client as never, [{ staffCode: "T-01", fullName: "Updated", staffType: "TEACHING", designation: "Teacher", email: "new@example.com" }]);
    expect(preview.rows[0]).toMatchObject({ action: "update", matchId: "existing", matchBy: "staffCode" });
    expect(client.rows[0].fullName).toBe("Old");
  });

  it("matches by email then mobile only when staffCode is missing", async () => {
    const client = fakeClient([{ id: "email", email: "a@example.com" }, { id: "mobile", mobile: "9876543210" }]);
    const preview = await buildStaffImportPreview(client as never, [
      { fullName: "A", designation: "Teacher", email: "a@example.com" },
      { fullName: "B", designation: "Helper", mobile: "9876543210", staffType: "SUPPORT" }
    ]);
    expect(preview.rows.map((row) => row.matchBy)).toEqual(["email", "mobile"]);
  });

  it("confirmed import creates and updates valid rows safely", async () => {
    const client = fakeClient([{ id: "existing", staffCode: "T-01", fullName: "Old" }]);
    const preview = await buildStaffImportPreview(client as never, [
      { staffCode: "T-01", fullName: "Updated", designation: "Teacher" },
      { staffCode: "N-01", fullName: "New Clerk", staffType: "NON_TEACHING", designation: "Clerk" }
    ]);
    const result = await applyStaffImport(client as never, preview);
    expect(result).toMatchObject({ created: 1, updated: 1, skipped: 0 });
    expect(client.rows.map((row) => row.fullName)).toEqual(["Updated", "New Clerk"]);
  });

  it("reports duplicate and invalid rows clearly", async () => {
    const preview = await buildStaffImportPreview(fakeClient() as never, [
      { staffCode: "T-01", fullName: "A", designation: "Teacher" },
      { staffCode: "T-01", fullName: "B", designation: "Teacher" },
      { staffCode: "T-03", fullName: "", designation: "Teacher" }
    ]);
    expect(preview.rows[1].errors).toContain("Duplicate staff identity in uploaded file");
    expect(preview.rows[2].errors).toContain("Full name is required");
  });

  it("keeps invalid import values as row errors instead of failing the whole preview", async () => {
    const preview = await buildStaffImportPreview(fakeClient() as never, [
      { staffCode: "T-01", fullName: "A", designation: "Teacher", email: "not-email" },
      { staffCode: "T-02", fullName: "B", designation: "Teacher", mobile: "12" },
      { staffCode: "T-03", fullName: "C", designation: "Teacher", dateOfJoining: "2026-02-30" },
      { staffCode: "T-04", fullName: "D", designation: "Teacher", experienceYears: "many" }
    ]);
    expect(preview.counts.errors).toBe(4);
    expect(preview.rows.map((row) => row.errors[0])).toEqual([
      "Email is invalid", "Mobile must contain 7 to 15 digits", "Date of joining is invalid", "Experience years must be a number"
    ]);
  });

  it("refuses ambiguous email or mobile matches", async () => {
    const client = fakeClient([{ id: "a", email: "same@example.com" }, { id: "b", email: "same@example.com" }]);
    const preview = await buildStaffImportPreview(client as never, [{ fullName: "A", designation: "Teacher", email: "same@example.com" }]);
    expect(preview.rows[0].action).toBe("error");
    expect(preview.rows[0].errors[0]).toContain("Multiple existing staff profiles");
  });

  it("returns beginner-friendly unique-link errors", () => {
    expect(friendlyStaffError(new Error("Unique constraint failed on the fields: (`staffCode`)"))).toBe("Staff code is already in use");
    expect(friendlyStaffError(new Error("Unique constraint failed on the fields: (`userId`)"))).toContain("Teacher login");
    expect(friendlyStaffError(new Error("Unique constraint failed on the fields: (`timetableTeacherId`)"))).toContain("timetable teacher");
  });
});
