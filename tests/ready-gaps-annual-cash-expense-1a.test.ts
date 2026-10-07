import { randomUUID, randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, lstatSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync, backup } from "node:sqlite";
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { defaultPermissionMatrix } from "@/lib/role-permissions";
import { createPersistedSession } from "@/lib/auth-sessions";
import { createLibraryManagementServiceDraft } from "@/lib/publisher-bills";
import { createExpenseDraft, expenseDetailInclude, recordExpensePayment, serializeExpense, transitionExpense, updateExpenseDraft } from "@/lib/expenses";
import { calculateCashSources } from "@/lib/cash-book";
import { POST as workflow } from "@/app/api/expenses/[id]/workflow/route";

// Dependency/client routing and framework cookie transport are the only doubles
// below. Real persisted sessions, IAM, route permission decisions and mutations
// execute; no authorization, service, transaction or database result is mocked.
const harness = vi.hoisted(() => ({ db: null as PrismaClient | null, cookie: undefined as string | undefined }));
vi.mock("@/lib/prisma", () => ({ prisma: new Proxy({}, { get: (_target, key) => {
  if (!harness.db) throw new Error("OWNED_SYNTHETIC_DATABASE_REQUIRED");
  const value = Reflect.get(harness.db, key); return typeof value === "function" ? value.bind(harness.db) : value;
} }) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: harness.cookie }) }) }));

// Actual production services and transactions on a freshly migrated invented
// SQLite file. No copied operational database, payroll/payee mapping, signature,
// receipt acknowledgement, server launch or school disbursement is exercised.
let db: PrismaClient;
let root: string;
let identity: ReturnType<typeof lstatSync>;
let maker: { id: string; name: string }, checker: { id: string; name: string };
let vendorId: string, categoryId: string, departmentId: string;
beforeAll(async () => {
  if (process.env.DATABASE_PROVIDER === "postgresql") throw new Error("THIS_FIXTURE_REQUIRES_OWNED_SQLITE");
  root = mkdtempSync(path.join(tmpdir(), "nalanda-ready-gaps-annual-cash-")); identity = lstatSync(root);
  const sql = new DatabaseSync(":memory:");
  try {
    for (const name of readdirSync("prisma/migrations", { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort())
      sql.exec(readFileSync(path.join("prisma/migrations", name, "migration.sql"), "utf8"));
    expect(sql.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    await backup(sql, path.join(root, "synthetic.db"));
  } finally { sql.close(); }
  db = new PrismaClient({ datasourceUrl: `file:${path.join(root, "synthetic.db").replaceAll("\\", "/")}` });
  harness.db = db;
  vi.stubEnv("AUTH_SECRET", randomBytes(48).toString("base64url"));
  await db.schoolSettings.create({ data: { id: "school", schoolName: "Invented School", addressLine1: "Synthetic", city: "Synthetic", phone: "NO-CONTACT", academicYear: "2026-27" } });
  await db.rolePermission.createMany({ data: Object.entries(defaultPermissionMatrix()).flatMap(([role, entries]) => Object.entries(entries).map(([permission, enabled]) => ({ role, permission, enabled }))) });
  const actor = (name: string) => db.user.create({ data: { username: `invented-${randomUUID()}`, name, role: "SUPER_ADMIN", passwordHash: "UNUSABLE_SYNTHETIC_NO_LOGIN" } });
  maker = await actor("Invented expense preparer"); checker = await actor("Invented independent approver");
  vendorId = (await db.vendor.create({ data: { vendorCode: "INVENTED-TEACHER-PAYEE", name: "Invented combined-duty payee" } })).id;
  categoryId = (await db.expenseCategory.create({ data: { name: "Invented Professional Fees", code: "PROFESSIONAL" } })).id;
  departmentId = (await db.expenseDepartment.create({ data: { name: "Invented Library", code: "LIBRARY" } })).id;
  // Unrelated, explicitly unapproved payroll/salary fixture sentinels. They
  // are not the expense payee or a school remuneration policy.
  const unrelatedPolicy = await db.payrollPolicyVersion.create({ data: { policyCode: "INVENTED-UNRELATED-DO-NOT-APPROVE", versionNumber: 1, name: "Invented unrelated payroll sentinel", effectiveFrom: new Date("2026-01-01") } });
  await db.salaryStructureVersion.create({ data: { structureCode: "INVENTED-UNRELATED-SALARY", versionNumber: 1, name: "Invented unrelated salary sentinel", policyVersionId: unrelatedPolicy.id, effectiveFrom: new Date("2026-01-01"), estimatedGrossPaise: 432100 } });
});
afterAll(async () => {
  await db?.$disconnect();
  vi.unstubAllEnvs();
  if (root) {
    if (!identity) throw new Error("Owned synthetic fixture identity is missing; cleanup refused");
    const current = lstatSync(root);
    expect(current.isSymbolicLink()).toBe(false); expect(current.ino).toBe(identity.ino); expect(current.dev).toBe(identity.dev);
    expect(path.dirname(path.resolve(root))).toBe(path.resolve(tmpdir()));
    rmSync(root, { recursive: true });
  }
});
const input = (extra: Record<string, unknown> = {}) => ({ vendorId, academicYear: "2026-27", servicePeriod: "INVENTED explicitly supplied annual interval; convention undecided", expenseDate: "2026-10-08", amount: "123.45", ...extra });
const version = (row: { updatedAt: Date }) => row.updatedAt.toISOString();
async function approved() {
  const draft = await createLibraryManagementServiceDraft(db, input(), maker);
  const submitted = await transitionExpense(db, draft.id, "submit", maker, undefined, version(draft));
  return transitionExpense(db, draft.id, "approve", checker, undefined, version(submitted));
}
const payment = (row: { updatedAt: Date; netAmount: Prisma.Decimal }, extra: Record<string, unknown> = {}) => ({ amount: "123.45", paymentDate: "2026-10-08", paymentMethod: "CASH", expectedUpdatedAt: version(row), expectedNetAmount: row.netAmount.toFixed(2), ...extra });

describe.sequential("019 bounded annual CASH expense service", () => {
  it("preserves one Vendor and the combined Books, Examination Cell and library purpose in draft", async () => {
    const row = await createLibraryManagementServiceDraft(db, input(), maker);
    expect(row.vendorId).toBe(vendorId); expect(row.paymentMethod).toBe("CASH");
    expect(row.description).toContain("Books + Examination Cell + library");
    expect(row.description).toContain(input().servicePeriod);
    expect(row.approvalStatus).toBe("DRAFT"); expect(row.payments).toEqual([]);
  });
  it("rejects noncash template tampering rather than silently coercing it", async () => {
    await expect(createLibraryManagementServiceDraft(db, input({ paymentMethod: "UPI" }), maker)).rejects.toThrow(/CASH/);
  });
  it("rejects noncash payment tampering in the production expense service", async () => {
    const row = await approved();
    await expect(recordExpensePayment(db, row.id, payment(row, { paymentMethod: "UPI", transactionReference: "INVENTED-ONLY" }), maker)).rejects.toThrow(/CASH/);
    expect(await db.expensePayment.count({ where: { expenseRecordId: row.id } })).toBe(0);
  });
  it("requires an independent approver for this operation", async () => {
    const row = await createLibraryManagementServiceDraft(db, input(), maker);
    const submitted = await transitionExpense(db, row.id, "submit", maker, undefined, version(row));
    expect(submitted.updatedAt.getTime()).toBeGreaterThan(row.updatedAt.getTime());
    await expect(transitionExpense(db, row.id, "submit", maker, undefined, version(row))).rejects.toThrow(/changed/);
    expect(await db.expenseAudit.count({ where: { expenseRecordId: row.id, action: "SUBMIT" } })).toBe(1);
    await expect(transitionExpense(db, row.id, "approve", maker, undefined, version(submitted))).rejects.toThrow(/independent/);
  });
  it("rejects missing, inactive and wrong payees and unspecified periods", async () => {
    await expect(createLibraryManagementServiceDraft(db, input({ vendorId: "invented-missing" }), maker)).rejects.toThrow(/active/);
    await expect(createLibraryManagementServiceDraft(db, input({ servicePeriod: "" }), maker)).rejects.toThrow(/period/);
    const inactive = await db.vendor.create({ data: { vendorCode: `INVENTED-INACTIVE-${randomUUID()}`, name: "Invented inactive payee", status: "INACTIVE" } });
    await expect(createLibraryManagementServiceDraft(db, input({ vendorId: inactive.id }), maker)).rejects.toThrow(/active/);
    for (const amount of ["0", "-1", "1.001", "1e2"]) await expect(createLibraryManagementServiceDraft(db, input({ amount }), maker)).rejects.toThrow();
  });
  it("rejects stale or changed amount approval/payment snapshots", async () => {
    const row = await approved();
    await expect(recordExpensePayment(db, row.id, payment(row, { expectedUpdatedAt: "2000-01-01T00:00:00.000Z" }), maker)).rejects.toThrow(/changed|Refresh/);
    await expect(recordExpensePayment(db, row.id, payment(row, { expectedNetAmount: "999.99" }), maker)).rejects.toThrow(/amount|changed/);
    expect(await db.expensePayment.count({ where: { expenseRecordId: row.id } })).toBe(0);
  });
  it("preserves selected payee/purpose/period through generic draft edits and rejects stale amount approval", async () => {
    const row = await createLibraryManagementServiceDraft(db, input(), maker);
    const edit = { expenseDate: "2026-10-08", academicYear: row.academicYear, vendorId: row.vendorId, categoryId: row.categoryId, departmentId: row.departmentId, description: row.description, grossAmount: "130.25", netAmount: "130.25", paymentMethod: "CASH", expectedUpdatedAt: version(row) };
    await expect(updateExpenseDraft(db, row.id, { ...edit, vendorId: "invented-different" }, maker)).rejects.toThrow(/payee/);
    await expect(updateExpenseDraft(db, row.id, { ...edit, description: "Replace combined purpose" }, maker)).rejects.toThrow(/purpose/);
    await expect(updateExpenseDraft(db, row.id, { ...edit, paymentMethod: "UPI" }, maker)).rejects.toThrow(/CASH/);
    const edited = await updateExpenseDraft(db, row.id, edit, maker);
    expect(edited.updatedAt.getTime()).toBeGreaterThan(row.updatedAt.getTime());
    await expect(transitionExpense(db, row.id, "submit", maker, undefined, version(row))).rejects.toThrow(/changed/);
    const submitted = await transitionExpense(db, row.id, "submit", maker, undefined, version(edited));
    await expect(transitionExpense(db, row.id, "approve", checker, undefined, version(edited))).rejects.toThrow(/changed/);
    const reviewed = await transitionExpense(db, row.id, "approve", checker, undefined, version(submitted));
    expect(reviewed.netAmount.toFixed(2)).toBe("130.25"); expect(reviewed.vendorId).toBe(vendorId);
  });
  it("keeps partial retry stale and permits a newly reviewed remaining CASH payment", async () => {
    const row = await approved();
    const partial = await recordExpensePayment(db, row.id, payment(row, { amount: "23.45" }), maker);
    expect(partial.updatedAt.getTime()).toBeGreaterThan(row.updatedAt.getTime());
    await expect(recordExpensePayment(db, row.id, payment(row, { amount: "23.45" }), maker)).rejects.toThrow(/changed/);
    const paid = await recordExpensePayment(db, row.id, payment(partial, { amount: "100.00" }), maker);
    expect(paid.payments).toHaveLength(2); expect(paid.paymentStatus).toBe("PAID");
    await transitionExpense(db, row.id, "cancel", checker, "Invented partial control settles", version(paid));
  });
  it("revalidates payee active status at approval and payment", async () => {
    const payee = await db.vendor.create({ data: { vendorCode: `INVENTED-ACTIVE-${randomUUID()}`, name: "Invented changeable payee" } });
    const row = await createLibraryManagementServiceDraft(db, input({ vendorId: payee.id }), maker);
    const submitted = await transitionExpense(db, row.id, "submit", maker, undefined, version(row));
    await db.vendor.update({ where: { id: payee.id }, data: { status: "INACTIVE" } }); // Fixture authority change, not operation under test.
    await expect(transitionExpense(db, row.id, "approve", checker, undefined, version(submitted))).rejects.toThrow(/active/);
    await db.vendor.update({ where: { id: payee.id }, data: { status: "ACTIVE" } });
    const reviewed = await transitionExpense(db, row.id, "approve", checker, undefined, version(submitted));
    await db.vendor.update({ where: { id: payee.id }, data: { status: "INACTIVE" } });
    await expect(recordExpensePayment(db, row.id, payment(reviewed), maker)).rejects.toThrow(/active/);
  });
  it("denies absent, unauthorized and revoked actors through the real route and IAM", async () => {
    const row = await approved();
    const request = () => workflow(new NextRequest("https://synthetic.invalid/api/expenses/owned/workflow", { method: "POST", body: JSON.stringify({ action: "pay", ...payment(row) }), headers: { "content-type": "application/json" } }), { params: Promise.resolve({ id: row.id }) });
    harness.cookie = undefined; expect((await request()).status).toBe(401);
    const actor = await db.user.create({ data: { username: `invented-viewer-${randomUUID()}`, name: "Invented unauthorized actor", role: "VIEWER", passwordHash: "UNUSABLE_SYNTHETIC_NO_LOGIN", isActive: true, lifecycleStatus: "ACTIVE", mustChangePassword: false } });
    await db.userRoleAssignment.create({ data: { userId: actor.id, role: "VIEWER", validFrom: new Date(Date.now() - 60_000), reason: "Invented already-effective fixture authority", activeKey: `${actor.id}:VIEWER` } });
    const session = await createPersistedSession(db, actor, new Headers()); harness.cookie = session.cookieValue;
    expect((await request()).status).toBe(403);
    await db.authSession.update({ where: { id: session.sessionId }, data: { revokedAt: new Date() } });
    expect((await request()).status).toBe(401);
    expect(await db.expensePayment.count({ where: { expenseRecordId: row.id } })).toBe(0);
  });
  it("executes draft, submit, independent approval, payment and ONE cash-book outflow without payroll effects", async () => {
    const salaryBefore = await db.$queryRawUnsafe<Array<{ name: string }>>("SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE '%Payroll%' OR name LIKE '%Salary%') ORDER BY name");
    const salarySnapshot = async () => Promise.all(salaryBefore.map(async table => ({ table: table.name, rows: await db.$queryRawUnsafe(`SELECT * FROM \"${table.name}\" ORDER BY id`) })));
    const payrollBefore = await salarySnapshot();
    expect(await db.payrollPolicyVersion.count()).toBe(1); expect(await db.salaryStructureVersion.count()).toBe(1);
    const unrelatedSnapshot = async (excludeId?: string) => ({
      expenses: await db.expenseRecord.findMany({ where: excludeId ? { id: { not: excludeId } } : {}, orderBy: { id: "asc" } }),
      payments: await db.expensePayment.findMany({ where: excludeId ? { expenseRecordId: { not: excludeId } } : {}, orderBy: { id: "asc" } }),
      audits: await db.expenseAudit.findMany({ where: excludeId ? { expenseRecordId: { not: excludeId } } : {}, orderBy: { id: "asc" } })
    });
    const unrelatedBefore = await unrelatedSnapshot();
    const before = await calculateCashSources(db, new Date("2026-10-08"), new Prisma.Decimal(1000));
    const row = await approved();
    const paid = await recordExpensePayment(db, row.id, payment(row), maker);
    expect(paid.vendorId).toBe(vendorId); expect(paid.description).toBe(row.description);
    expect(paid.approvalStatus).toBe("APPROVED"); expect(paid.paymentStatus).toBe("PAID");
    expect(paid.payments).toHaveLength(1); expect(paid.payments[0].amount.toFixed(2)).toBe("123.45");
    expect(paid.audits.map(a => a.action)).toEqual(["CREATED_FROM_LIBRARY_SERVICE_TEMPLATE", "SUBMIT", "APPROVE", "PAYMENT_RECORDED"]);
    const projection = serializeExpense(paid);
    expect(projection.vendor?.id).toBe(vendorId); expect(projection.description).toBe(row.description);
    const after = await calculateCashSources(db, new Date("2026-10-08"), new Prisma.Decimal(1000));
    expect(after.cashExpense.sub(before.cashExpense).toFixed(2)).toBe("123.45");
    expect(after.counts.expensePayments - before.counts.expensePayments).toBe(1);
    expect(after.manualOutflow.equals(before.manualOutflow)).toBe(true);
    expect(after.expectedClosing.sub(before.expectedClosing).toFixed(2)).toBe("-123.45");
    expect(await salarySnapshot()).toEqual(payrollBefore);
    expect(await unrelatedSnapshot(row.id)).toEqual(unrelatedBefore);
    await expect(recordExpensePayment(db, row.id, payment(row), maker)).rejects.toThrow();
    expect(await db.expensePayment.count({ where: { expenseRecordId: row.id } })).toBe(1);
    const cancelled = await transitionExpense(db, row.id, "cancel", checker, "Invented cancellation control", version(paid));
    expect(cancelled.payments).toHaveLength(1); expect(cancelled.approvalStatus).toBe("CANCELLED");
    await expect(recordExpensePayment(db, row.id, payment(cancelled), maker)).rejects.toThrow(/Only an approved/);
    expect(await db.expensePayment.count({ where: { expenseRecordId: row.id } })).toBe(1);
    const reversed = await calculateCashSources(db, new Date("2026-10-08"), new Prisma.Decimal(1000));
    expect(reversed.cashExpense.equals(before.cashExpense)).toBe(true);
  });
  it("retains generic expense noncash and partial-payment behavior", async () => {
    const row = await createExpenseDraft(db, { expenseDate: "2026-10-08", academicYear: "2026-27", vendorId, categoryId, departmentId, description: "Invented ordinary expense", grossAmount: "100", netAmount: "100", paymentMethod: "UPI" }, maker);
    await transitionExpense(db, row.id, "submit", maker); await transitionExpense(db, row.id, "approve", maker);
    await recordExpensePayment(db, row.id, { amount: "40", paymentDate: "2026-10-08", paymentMethod: "UPI", transactionReference: "INVENTED-GENERIC" }, maker);
    const remaining = await db.expenseRecord.findUniqueOrThrow({ where: { id: row.id }, include: expenseDetailInclude });
    expect(remaining.paymentStatus).toBe("PARTIALLY_PAID"); expect(remaining.payments[0].paymentMethod).toBe("UPI");
  });
});
