import { execFileSync } from "node:child_process";
import { assertSyntheticPostgresQa } from "../scripts/postgres/synthetic-qa";
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
import { GET as readRecordRoute } from "@/app/api/expenses/[id]/payment-record/route";
import { readExpensePaymentRecord, type PaymentRecordActor } from "@/lib/expense-payment-record";
import { ExpensePaymentRecordDraft } from "@/components/expense-payment-record";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

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
// provider target. No copied operational database, payroll/payee mapping, signature,
// receipt acknowledgement, server launch or school disbursement is exercised.
const postgres = process.env.DATABASE_PROVIDER === "postgresql";
const ownedSchema = `nps_cash_draft_${randomUUID().replaceAll("-", "")}`;
let db: PrismaClient;
let root: string;
let identity: ReturnType<typeof lstatSync>;
let maker: { id: string; name: string }, checker: { id: string; name: string };
let vendorId: string, categoryId: string, departmentId: string;
beforeAll(async () => {
  root = mkdtempSync(path.join(tmpdir(), "nalanda-payment-record-1a-")); identity = lstatSync(root);
  let providerUrl = `file:${path.join(root, "synthetic.db").replaceAll("\\", "/")}`;
  if (postgres) {
    expect(process.env.CI).toBe("true"); assertSyntheticPostgresQa();
    const target = new URL(process.env.DATABASE_URL!); target.searchParams.set("schema", ownedSchema); providerUrl = target.toString();
    execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy", "--schema", "prisma/postgresql/schema.prisma"], { env: { ...process.env, DATABASE_URL: providerUrl, DIRECT_URL: providerUrl }, stdio: "pipe", windowsHide: true, timeout: 60_000 });
  } else {
  const sql = new DatabaseSync(":memory:");
  try {
    for (const name of readdirSync("prisma/migrations", { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort())
      sql.exec(readFileSync(path.join("prisma/migrations", name, "migration.sql"), "utf8"));
    expect(sql.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    await backup(sql, path.join(root, "synthetic.db"));
  } finally { sql.close(); }
  }
  db = new PrismaClient({ datasourceUrl: providerUrl });
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
  if (postgres && db) {
    if (!/^nps_cash_draft_[a-f0-9]{32}$/.test(ownedSchema)) throw new Error("OWNED_SCHEMA_REQUIRED");
    await db.$executeRawUnsafe(`DROP SCHEMA "${ownedSchema}" CASCADE`);
  }
  await db?.$disconnect();
  vi.unstubAllEnvs(); vi.unstubAllGlobals();
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

async function reader(role = "SUPER_ADMIN"): Promise<PaymentRecordActor> {
  const user = await db.user.create({ data: { username: `synthetic-reader-${randomUUID()}`, name: "Invented payment reader", role, passwordHash: "SYNTHETIC_NO_LOGIN" } });
  const assignment = await db.userRoleAssignment.create({ data: { userId: user.id, role, reason: "SYNTHETIC", validFrom: new Date(Date.now() - 60_000), activeKey: `${user.id}:${role}` } });
  const session = await createPersistedSession(db, user, new Headers());
  harness.cookie = session.cookieValue;
  return { userId: user.id, roleAssignmentId: assignment.id, sessionId: session.sessionId };
}
async function paidRecord() { const row = await approved(); return recordExpensePayment(db, row.id, payment(row), maker); }

describe.sequential("019 read-only authorized annual CASH payment acknowledgement draft", () => {
  it("renders exact persisted payee, explicit interval, amount/date and blank unofficial acknowledgement", async () => {
    const row = await paidRecord(); const actor = await reader();
    const record = await readExpensePaymentRecord(db, actor, row.id, row.payments[0].id);
    expect(record).toMatchObject({ expenseReference: row.expenseNumber, payeeId: vendorId, payeeName: "Invented combined-duty payee",
      coveredInterval: input().servicePeriod, amount: "123.45", paymentDate: "2026-10-08", paymentMethod: "CASH",
      approvalStatus: "APPROVED", paymentStatus: "PAID", officialReceipt: false, acknowledgementRecorded: false });
    vi.stubGlobal("React", React);
    const html = renderToStaticMarkup(React.createElement(ExpensePaymentRecordDraft, { record }));
    expect(html).toContain("Invented School"); expect(html).toContain("NOT AN OFFICIAL RECEIPT");
    expect(html).toContain("Receiver signature (blank)"); expect(html).toContain("INR 123.45");
    expect(html).toContain('data-print-ready="false"'); expect(html).toContain("Georgia");
    expect(html).not.toContain("passwordHash"); expect(html).not.toContain("tokenHash");
  });

  it("denies another unauthorized reader and revoked/stale sessions using actual IAM", async () => {
    const row = await paidRecord(); const unauthorized = await reader("VIEWER");
    await expect(readExpensePaymentRecord(db, unauthorized, row.id, row.payments[0].id)).rejects.toMatchObject({ status: 403 });
    const revoked = await reader(); await db.authSession.update({ where: { id: revoked.sessionId }, data: { revokedAt: new Date() } });
    await expect(readExpensePaymentRecord(db, revoked, row.id, row.payments[0].id)).rejects.toMatchObject({ status: 403 });
    const stale = await reader(); await db.user.update({ where: { id: stale.userId }, data: { credentialVersion: { increment: 1 } } });
    await expect(readExpensePaymentRecord(db, stale, row.id, row.payments[0].id)).rejects.toMatchObject({ status: 403 });
  });

  it("binds the selected payment to its actual expense and rejects unpaid/cancelled records", async () => {
    const paid = await paidRecord(), unpaid = await approved(), actor = await reader();
    await expect(readExpensePaymentRecord(db, actor, unpaid.id, paid.payments[0].id)).rejects.toMatchObject({ status: 404 });
    await expect(readExpensePaymentRecord(db, actor, unpaid.id, "SYNTHETIC-MISSING")).rejects.toMatchObject({ status: 404 });
    await transitionExpense(db, paid.id, "cancel", checker, "SYNTHETIC cancelled", version(paid));
    await expect(readExpensePaymentRecord(db, actor, paid.id, paid.payments[0].id)).rejects.toMatchObject({ status: 409 });
  });

  it("invalidates a stale preview after a further payment or payee-name change", async () => {
    const row = await approved(), actor = await reader();
    const partial = await recordExpensePayment(db, row.id, payment(row, { amount: "23.45" }), maker);
    const before = await readExpensePaymentRecord(db, actor, row.id, partial.payments[0].id);
    await recordExpensePayment(db, row.id, payment(partial, { amount: "100.00" }), maker);
    await expect(readExpensePaymentRecord(db, actor, row.id, partial.payments[0].id, before.version)).rejects.toMatchObject({ status: 409 });
    const current = await readExpensePaymentRecord(db, actor, row.id, partial.payments[0].id);
    await db.vendor.update({ where: { id: vendorId }, data: { name: "Invented revised payee label" } });
    await expect(readExpensePaymentRecord(db, actor, row.id, partial.payments[0].id, current.version)).rejects.toMatchObject({ status: 409 });
    await db.vendor.update({ where: { id: vendorId }, data: { name: "Invented combined-duty payee" } });
  });

  it("refuses corrupted amount/state or missing original interval rather than synthesizing evidence", async () => {
    const row = await paidRecord(), actor = await reader(); const selected = row.payments[0];
    await db.expensePayment.update({ where: { id: selected.id }, data: { amount: "999.99" } });
    await expect(readExpensePaymentRecord(db, actor, row.id, selected.id)).rejects.toThrow("amounts are inconsistent");
    await db.expensePayment.update({ where: { id: selected.id }, data: { amount: "123.45" } });
    await db.expenseAudit.updateMany({ where: { expenseRecordId: row.id, action: "CREATED_FROM_LIBRARY_SERVICE_TEMPLATE" }, data: { detailsJson: "{}" } });
    await expect(readExpensePaymentRecord(db, actor, row.id, selected.id)).rejects.toThrow("interval is unavailable");
  });

  it("performs repeated real-route print checks with zero extra payment, cash-book, audit or payroll effects", async () => {
    const row = await paidRecord(), actor = await reader();
    const record = await readExpensePaymentRecord(db, actor, row.id, row.payments[0].id);
    const snapshot = async () => ({
      payments: await db.expensePayment.findMany({ orderBy: { id: "asc" } }), audits: await db.expenseAudit.findMany({ orderBy: { id: "asc" } }),
      payroll: await db.payrollPolicyVersion.findMany(), salary: await db.salaryStructureVersion.findMany(),
      cash: await calculateCashSources(db, new Date("2026-10-08"), new Prisma.Decimal(1000))
    });
    const before = await snapshot(); expect(before.payroll).toHaveLength(1); expect(before.salary).toHaveLength(1);
    const url = `https://synthetic.invalid/api/expenses/${row.id}/payment-record?paymentId=${row.payments[0].id}&version=${record.version}`;
    for (let i = 0; i < 3; i++) {
      const response = await readRecordRoute(new NextRequest(url), { params: Promise.resolve({ id: row.id }) });
      expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect((await response.json()).record).toEqual(record);
    }
    expect(await snapshot()).toEqual(before);
    harness.cookie = undefined;
    expect((await readRecordRoute(new NextRequest(url), { params: Promise.resolve({ id: row.id }) })).status).toBe(401);
  });
});
