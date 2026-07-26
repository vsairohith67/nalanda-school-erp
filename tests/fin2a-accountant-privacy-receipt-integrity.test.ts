import { readFileSync } from "node:fs";
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { calculateCashSources } from "../lib/cash-book";
import { allocateFees } from "../lib/fee-allocation";
import {
  collectionPaymentResponse,
  financeStudentIdentity,
  ledgerPaymentResponse,
  parseFinanceDateRange,
  paymentExportRow,
  paymentManagementResponse,
  pendingDuesExportRow,
  pendingDuesFinanceRow,
  pendingDuesViewerAggregate,
  privateFinanceJson
} from "../lib/finance-privacy";
import { toCsv } from "../lib/format";
import {
  assertReceiptAcceptsActiveComponent,
  assertReceiptIsNewForCreate,
  cancelWholeReceipt,
  effectiveActiveReceiptPayments,
  effectiveActiveSelectedReceiptPayments,
  effectiveReceiptState,
  isReceiptCancellationAuthority,
  loadReceiptStateMap,
  receiptVersion,
  restoreWholeReceipt,
} from "../lib/receipt-integrity";
import { receiptAuditSnapshot, sanitizedPaymentAuditJson } from "../lib/receipt";
import {
  parseReceiptAuditRange,
  RECEIPT_AUDIT_RANGE_LIMIT
} from "../lib/receipt-audit";
import {
  ensureDefaultRolePermissions,
  getEffectivePermissions,
  getRolePermissionMatrix,
  hasRolePermission,
  validateRolePermissionPayload
} from "../lib/role-permissions";

const forbiddenStudentFields = [
  "id", "dateOfBirth", "fatherName", "motherName", "phone1", "phone2",
  "whatsappNumber", "address", "aadhaarNumber", "remarks", "studentId",
  "guardianId", "documentPath", "passwordHash"
];

const paymentRow = {
  id: "payment-private-id",
  date: new Date("2026-07-26T00:00:00.000Z"),
  receiptNo: "FIN2A-100",
  admissionNo: "FIN2A-STUDENT",
  studentName: "=FIN2A Student",
  className: "VI",
  section: "A",
  amountPaid: 6_000,
  paymentMode: "Cash",
  receivedAccount: "Cash",
  transactionRefNo: null,
  feeType: "Current Year Fee",
  termHint: "Term 1",
  isCancelled: false,
  cancelledAt: null,
  cancellationReason: null,
  updatedAt: new Date("2026-07-26T01:00:00.000Z")
};

const dueRow = {
  academicYear: "2026-27",
  status: "Active",
  admissionNo: "FIN2A-STUDENT",
  studentName: "=FIN2A Student",
  className: "VI",
  section: "A",
  annualFee: 24_000,
  discountPercent: 0,
  annualFeeAfterDiscount: 24_000,
  totalCurrentYearPaid: 6_000,
  term1Paid: 6_000,
  term1Due: 0,
  term2Paid: 0,
  term2Due: 6_000,
  term3Paid: 0,
  term3Due: 6_000,
  term4Paid: 0,
  term4Due: 6_000,
  totalPending: 18_000,
  dueStatus: "Partial Paid"
};

describe("FIN-2A Accountant data minimisation", () => {
  it("returns the exact finance identity allowlist and excludes unrelated Student fields", () => {
    const response = financeStudentIdentity({
      ...dueRow,
      id: "student-private-id",
      dateOfBirth: new Date("2014-01-01"),
      fatherName: "Private Parent",
      phone1: "9999999999",
      address: "Private address",
      aadhaarNumber: "111122223333",
      remarks: "Private note",
      documentPath: "C:\\private\\student.pdf"
    });
    expect(Object.keys(response)).toEqual([
      "admissionNo", "studentName", "className", "section", "academicYear", "status"
    ]);
    for (const field of forbiddenStudentFields) expect(response).not.toHaveProperty(field);
    const route = readFileSync("app/api/finance/students/lookup/route.ts", "utf8");
    expect(route).toContain("financeStudentCalculationSelect");
    expect(route).toContain("feeAllocation");
    expect(route).toContain('requireApiPermission("CREATE_PAYMENTS")');
  });

  it("uses separate response serializers for payment management, ledger, and collection", () => {
    const management = paymentManagementResponse(paymentRow);
    const ledger = ledgerPaymentResponse(paymentRow);
    const collection = collectionPaymentResponse(paymentRow);
    expect(management).toHaveProperty("id");
    expect(ledger).not.toHaveProperty("id");
    expect(collection).not.toHaveProperty("id");
    for (const result of [management, ledger, collection]) {
      expect(result).not.toHaveProperty("remarks");
      expect(result).not.toHaveProperty("studentId");
      expect(result).not.toHaveProperty("enteredBy");
      expect(result).not.toHaveProperty("cancelledByUserId");
      expect(result).not.toHaveProperty("deletedAt");
    }
  });

  it("returns explicit dues rows and aggregate-only Viewer rows", () => {
    const finance = pendingDuesFinanceRow({
      ...dueRow,
      fatherName: "Private Parent",
      phone1: "9999999999",
      remarks: "Private note"
    });
    expect(finance).toEqual(dueRow);
    const aggregate = pendingDuesViewerAggregate([finance]);
    expect(aggregate).toEqual([{
      academicYear: "2026-27",
      className: "VI",
      section: "A",
      students: 1,
      fullyPaid: 0,
      totalAfterDiscount: 24_000,
      totalPaid: 6_000,
      totalPending: 18_000
    }]);
    expect(JSON.stringify(aggregate)).not.toMatch(/FIN2A-STUDENT|FIN2A Student|phone|parent/i);
  });

  it("sets private no-store JSON headers for finance responses", async () => {
    const response = privateFinanceJson({ ok: true });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("pragma")).toBe("no-cache");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});

describe("FIN-2A export privacy", () => {
  it("keeps payment and dues exports to explicit purpose fields and formula-protects CSV", () => {
    const payment = paymentExportRow(paymentRow, "ACTIVE");
    const dues = pendingDuesExportRow(dueRow);
    for (const row of [payment, dues]) {
      const text = JSON.stringify(row);
      expect(text).not.toMatch(/father|mother|phone|address|birth|aadhaar|document|medical|marks|remarks|actor|password/i);
      expect(row).not.toHaveProperty("id");
    }
    const csv = toCsv([payment]);
    expect(csv).toContain("'=FIN2A Student");
    expect(csv).not.toContain("payment-private-id");
  });

  it("enforces bounded date ranges, rows, private headers, and append-only export audit", () => {
    expect(parseFinanceDateRange("2026-07-01", "2026-07-31").days).toBe(31);
    expect(() => parseFinanceDateRange("2025-01-01", "2026-07-31")).toThrow(/366 days or fewer/);
    const route = readFileSync("app/api/export/[type]/route.ts", "utf8");
    expect(route).toContain("FINANCE_EXPORT_ROW_LIMIT + 1");
    expect(route).toContain('"cache-control": "private, no-store"');
    expect(route).toContain("logFinanceExport");
    expect(route).toContain("pendingDuesViewerAggregate");
    expect(route).toContain("aggregateCollectionRows");
    for (const [specialized, rowLimit] of [
      ["app/api/expenses/reports/export/route.ts", "FINANCE_EXPORT_ROW_LIMIT"],
      ["app/api/budgets/reports/export/route.ts", "FINANCE_EXPORT_ROW_LIMIT"],
      ["app/api/misc-income/reports/export/route.ts", "FINANCE_EXPORT_ROW_LIMIT"],
      ["app/api/cash-book/reports/export/route.ts", "FINANCE_EXPORT_ROW_LIMIT"],
      ["app/api/books/reports/export/route.ts", "FINANCE_EXPORT_ROW_LIMIT"],
      ["app/api/library/charges/reports/export/route.ts", "FINANCE_EXPORT_ROW_LIMIT"],
      ["app/api/class-x-documents/reports/export/route.ts", "CLASS_X_REPORT_ROW_LIMIT"],
      ["app/api/fee-register-ocr/reports/export/route.ts", "FINANCE_EXPORT_ROW_LIMIT"]
    ]) {
      const source = readFileSync(specialized, "utf8");
      expect(source, specialized).toContain("auditedFinanceCsvResponse");
      expect(source, specialized).toContain(rowLimit);
    }
    const responseHelper = readFileSync("lib/finance-export-audit.ts", "utf8");
    expect(responseHelper).toContain('"cache-control": "private, no-store"');
    expect(responseHelper).toContain('"pragma": "no-cache"');
  });

  it("derives a filtered payment export state from every component of the receipt", async () => {
    const rows = splitRows();
    rows[0].isCancelled = true;
    const selected = rows.filter((row) => row.paymentMode === "UPI");
    const client = {
      payment: {
        findMany: async () => rows
      }
    };
    const states = await loadReceiptStateMap(
      client,
      selected.map((row) => row.receiptNo)
    );
    expect(states.get("FIN2A-100")?.status).toBe("INCONSISTENT");
    expect(selected.map((row) =>
      paymentExportRow(row, states.get(row.receiptNo)?.status ?? "INCONSISTENT")
    )).toEqual(expect.arrayContaining([
      expect.objectContaining({ effectiveReceiptStatus: "INCONSISTENT" })
    ]));
    const active = await effectiveActiveSelectedReceiptPayments(client, selected);
    expect(active).toEqual([]);
    const source = readFileSync("app/api/export/[type]/route.ts", "utf8");
    expect(source).toContain("await loadReceiptStateMap");
    expect(source).toContain("receiptRows.map((row) => row.receiptNo)");
  });
});

describe("FIN-2A cancellation authority and receipt integrity", () => {
  it("permits final-receipt cancellation only for Director and Super Admin", () => {
    expect(isReceiptCancellationAuthority("DIRECTOR")).toBe(true);
    expect(isReceiptCancellationAuthority("SUPER_ADMIN")).toBe(true);
    for (const role of ["ACCOUNTANT", "ADMIN", "PRINCIPAL", "VIEWER"]) {
      expect(isReceiptCancellationAuthority(role)).toBe(false);
    }
  });

  it("hard-denies Accountant cancellation and broad Student access even if legacy rows are enabled", async () => {
    const rows = [
      { role: "ACCOUNTANT", permission: "CANCEL_PAYMENTS", enabled: true },
      { role: "ACCOUNTANT", permission: "VIEW_STUDENTS", enabled: true },
      { role: "ACCOUNTANT", permission: "EXPORT_STUDENTS", enabled: true },
      { role: "ACCOUNTANT", permission: "MANAGE_RECEIPTS", enabled: true },
      { role: "ACCOUNTANT", permission: "COMMUNICATE_PARENT", enabled: true },
      { role: "ACCOUNTANT", permission: "EXPORT_REMINDERS", enabled: true },
      { role: "VIEWER", permission: "VIEW_LEDGER", enabled: true },
      { role: "VIEWER", permission: "PRINT_LEDGER", enabled: true },
      { role: "VIEWER", permission: "EXPORT_REPORTS", enabled: true }
    ];
    const client = {
      rolePermission: {
        findMany: async (args?: { where?: { role?: string } }) =>
          args?.where?.role ? rows.filter((row) => row.role === args.where?.role) : rows,
        findUnique: async ({ where }: any) =>
          rows.find((row) =>
            row.role === where.role_permission.role &&
            row.permission === where.role_permission.permission
          ) ?? null
      }
    };
    expect(await hasRolePermission(client as never, "ACCOUNTANT", "CANCEL_PAYMENTS")).toBe(false);
    expect(await hasRolePermission(client as never, "ACCOUNTANT", "VIEW_STUDENTS")).toBe(false);
    expect(await hasRolePermission(client as never, "ACCOUNTANT", "EXPORT_STUDENTS")).toBe(false);
    expect(await hasRolePermission(client as never, "ACCOUNTANT", "COMMUNICATE_PARENT")).toBe(false);
    expect(await hasRolePermission(client as never, "ACCOUNTANT", "EXPORT_REMINDERS")).toBe(false);
    expect(await hasRolePermission(client as never, "VIEWER", "VIEW_LEDGER")).toBe(false);
    expect(await hasRolePermission(client as never, "VIEWER", "PRINT_LEDGER")).toBe(false);
    expect(await hasRolePermission(client as never, "VIEWER", "EXPORT_REPORTS")).toBe(false);
    const effective = await getEffectivePermissions(client as never, "ACCOUNTANT");
    expect(effective.has("CANCEL_PAYMENTS")).toBe(false);
    expect(effective.has("VIEW_STUDENTS")).toBe(false);
    expect(effective.has("EXPORT_STUDENTS")).toBe(false);
    const viewerEffective = await getEffectivePermissions(client as never, "VIEWER");
    expect(viewerEffective.has("VIEW_LEDGER")).toBe(false);
    expect(viewerEffective.has("PRINT_LEDGER")).toBe(false);
    expect(viewerEffective.has("EXPORT_REPORTS")).toBe(false);
    const matrix = await getRolePermissionMatrix(client as never);
    expect(matrix.ACCOUNTANT.CANCEL_PAYMENTS).toBe(false);
    expect(matrix.ACCOUNTANT.EXPORT_STUDENTS).toBe(false);
    expect(matrix.ACCOUNTANT.COMMUNICATE_PARENT).toBe(false);
    expect(matrix.VIEWER.VIEW_LEDGER).toBe(false);
    expect(matrix.VIEWER.PRINT_LEDGER).toBe(false);
    expect(matrix.VIEWER.EXPORT_REPORTS).toBe(false);
    expect(() => validateRolePermissionPayload({
      ACCOUNTANT: { CANCEL_PAYMENTS: true, EXPORT_STUDENTS: true }
    })).toThrow(/cannot be delegated/);
    expect(() => validateRolePermissionPayload({
      VIEWER: { PRINT_LEDGER: true, EXPORT_REPORTS: true }
    })).toThrow(/cannot be delegated/);
  });

  it("keeps backup-time permission seeding non-mutating for existing operational overrides", async () => {
    const calls: Array<{ update: Record<string, unknown> }> = [];
    const client = {
      rolePermission: {
        upsert: async ({ update }: { update: Record<string, unknown> }) => {
          calls.push({ update });
          return {};
        }
      }
    };
    await ensureDefaultRolePermissions(client as never);
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every(({ update }) => Object.keys(update).length === 0)).toBe(true);
  });

  it("treats Payment components as authoritative and fails closed on partial cancellation or note drift", () => {
    const rows = splitRows();
    expect(effectiveReceiptState(rows, { status: "Active" })).toMatchObject({
      status: "ACTIVE",
      noteConsistent: true
    });
    rows[0].isCancelled = true;
    expect(effectiveReceiptState(rows, { status: "Active" })).toMatchObject({
      status: "INCONSISTENT",
      noteConsistent: false
    });
    expect(effectiveActiveReceiptPayments(rows)).toEqual([]);
    for (const row of rows) row.isCancelled = true;
    expect(effectiveReceiptState(rows, { status: "Active" })).toMatchObject({
      status: "CANCELLED",
      noteConsistent: false
    });
  });

  it("accepts only positive safe bounded receipt-audit ranges", () => {
    expect(parseReceiptAuditRange("1", String(RECEIPT_AUDIT_RANGE_LIMIT))).toEqual({
      start: 1,
      end: RECEIPT_AUDIT_RANGE_LIMIT,
      receiptNumbers: Array.from(
        { length: RECEIPT_AUDIT_RANGE_LIMIT },
        (_, index) => String(index + 1)
      )
    });

    for (const [start, end] of [
      ["1e308", "1e308"],
      [String(Number.MAX_SAFE_INTEGER + 1), String(Number.MAX_SAFE_INTEGER + 1)],
      ["0", "1"],
      ["-1", "1"],
      ["2", "1"],
      ["1", String(RECEIPT_AUDIT_RANGE_LIMIT + 1)],
      [null, null]
    ] as Array<[string | null, string | null]>) {
      expect(() => parseReceiptAuditRange(start, end)).toThrow();
    }
  });

  it("reserves new receipt numbers and rejects every cross-request create append", async () => {
    const emptyClient = {
      payment: { findFirst: async () => null },
      receiptNote: { findUnique: async () => null }
    };
    await expect(
      assertReceiptIsNewForCreate(emptyClient, "FIN2A-NEW")
    ).resolves.toBeUndefined();

    const paymentExists = {
      payment: { findFirst: async () => ({ id: "existing-payment" }) },
      receiptNote: { findUnique: async () => null }
    };
    await expect(
      assertReceiptIsNewForCreate(paymentExists, "FIN2A-100")
    ).rejects.toMatchObject({ status: 409 });

    const noteExists = {
      payment: { findFirst: async () => null },
      receiptNote: { findUnique: async () => ({ receiptNo: "FIN2A-100" }) }
    };
    await expect(
      assertReceiptIsNewForCreate(noteExists, "FIN2A-100")
    ).rejects.toMatchObject({ status: 409 });

    const source = readFileSync("app/api/payments/route.ts", "utf8");
    expect(source).toContain("assertReceiptIsNewForCreate");
    expect(source).toContain("tx.receiptNote.create");
    expect(source).not.toContain(
      "assertReceiptAcceptsActiveComponent(tx, firstPayload.receiptNo)"
    );
  });

  it("prevents a split-receipt correction from changing stored logical metadata", async () => {
    const sibling = {
      ...paymentRow,
      id: "sibling",
      date: new Date("2026-07-26T00:00:00.000Z"),
      admissionNo: "FIN2A-STUDENT",
      feeType: "Current Year Fee",
      termHint: "Term 1",
      deletedAt: null
    };
    const client = {
      payment: { findMany: async () => [sibling] },
      receiptNote: { findUnique: async () => ({ status: "Active" }) }
    };
    const matching = {
      receiptNo: "FIN2A-100",
      admissionNo: "FIN2A-STUDENT",
      date: new Date("2026-07-26T00:00:00.000Z"),
      feeType: "Current Year Fee",
      termHint: "Term 1"
    };

    await expect(
      assertReceiptAcceptsActiveComponent(client, matching, "edited")
    ).resolves.toBeUndefined();

    for (const changed of [
      { ...matching, admissionNo: "FIN2A-OTHER" },
      { ...matching, date: new Date("2026-07-27T00:00:00.000Z") },
      { ...matching, feeType: "Old Due" },
      { ...matching, termHint: "Term 2" }
    ]) {
      await expect(
        assertReceiptAcceptsActiveComponent(client, changed, "edited")
      ).rejects.toMatchObject({ status: 409 });
    }
  });

  it("cancels every split component once, records one audit per component, and synchronizes ReceiptNote", async () => {
    const fixture = receiptClient();
    const version = receiptVersion(fixture.rows);
    const result = await cancelWholeReceipt(fixture.client, {
      receiptNo: "FIN2A-100",
      reason: "Duplicate receipt confirmed against the register",
      expectedVersion: version,
      actor: { id: "director-private-id", name: "FIN2A Director" }
    });
    expect(result).toMatchObject({
      status: "CANCELLED",
      idempotent: false,
      componentCount: 3,
      changedComponents: 3,
      totalAmount: 6_000
    });
    expect(fixture.rows.every((row) => row.isCancelled)).toBe(true);
    expect(fixture.audits).toHaveLength(3);
    expect(new Set(fixture.audits.map((audit) => audit.data.paymentId)).size).toBe(3);
    expect(fixture.note).toMatchObject({ status: "Cancelled" });
  });

  it("rejects missing reasons and stale versions without partial mutation", async () => {
    const missing = receiptClient();
    await expect(cancelWholeReceipt(missing.client, {
      receiptNo: "FIN2A-100",
      reason: "",
      actor: { id: "director-private-id", name: "FIN2A Director" }
    })).rejects.toMatchObject({ status: 400 });
    expect(missing.rows.some((row) => row.isCancelled)).toBe(false);

    const missingVersion = receiptClient();
    await expect(cancelWholeReceipt(missingVersion.client, {
      receiptNo: "FIN2A-100",
      reason: "Register reconciliation",
      actor: { id: "director-private-id", name: "FIN2A Director" }
    })).rejects.toMatchObject({ status: 400 });
    expect(missingVersion.rows.some((row) => row.isCancelled)).toBe(false);

    const stale = receiptClient();
    await expect(cancelWholeReceipt(stale.client, {
      receiptNo: "FIN2A-100",
      reason: "Register reconciliation",
      expectedVersion: "stale-version",
      actor: { id: "director-private-id", name: "FIN2A Director" }
    })).rejects.toMatchObject({ status: 409 });
    expect(stale.rows.some((row) => row.isCancelled)).toBe(false);
    expect(stale.audits).toHaveLength(0);
  });

  it("rolls back component state when append-only audit creation fails", async () => {
    const fixture = receiptClient({ failAudit: true });
    await expect(cancelWholeReceipt(fixture.client, {
      receiptNo: "FIN2A-100",
      reason: "Register reconciliation",
      expectedVersion: receiptVersion(fixture.rows),
      actor: { id: "director-private-id", name: "FIN2A Director" }
    })).rejects.toThrow("Synthetic audit failure");
    expect(fixture.rows.every((row) => !row.isCancelled)).toBe(true);
    expect(fixture.audits).toHaveLength(0);
    expect(fixture.note).toBeNull();
  });

  it("makes repeated and concurrent cancellation one harmless logical result", async () => {
    const fixture = receiptClient();
    const input = {
      receiptNo: "FIN2A-100",
      reason: "Register reconciliation",
      expectedVersion: receiptVersion(fixture.rows),
      actor: { id: "director-private-id", name: "FIN2A Director" }
    };
    const concurrent = await Promise.all([
      cancelWholeReceipt(fixture.client, input),
      cancelWholeReceipt(fixture.client, input)
    ]);
    expect(concurrent.every((result) => result.status === "CANCELLED")).toBe(true);
    expect(concurrent.map((result) => result.changedComponents).sort()).toEqual([0, 3]);
    expect(fixture.audits).toHaveLength(3);
    const repeated = await cancelWholeReceipt(fixture.client, input);
    expect(repeated).toMatchObject({ status: "CANCELLED", idempotent: true, changedComponents: 0 });
    expect(fixture.audits).toHaveLength(3);
  });

  it("keeps idempotent cancel and restore branches read-only for ReceiptNote evidence", async () => {
    const cancelled = receiptClient();
    const cancellationInput = {
      receiptNo: "FIN2A-100",
      reason: "Register reconciliation",
      expectedVersion: receiptVersion(cancelled.rows),
      actor: { id: "director-private-id", name: "FIN2A Director" }
    };
    await cancelWholeReceipt(cancelled.client, cancellationInput);
    if (!cancelled.note) throw new Error("Expected synthetic ReceiptNote");
    cancelled.note.status = "Needs Review";
    cancelled.note.remarks = "FIN2A preserved cancellation discrepancy";
    const auditCount = cancelled.audits.length;
    const repeated = await cancelWholeReceipt(cancelled.client, cancellationInput);
    expect(repeated).toMatchObject({ status: "CANCELLED", idempotent: true });
    expect(cancelled.note).toMatchObject({
      status: "Needs Review",
      remarks: "FIN2A preserved cancellation discrepancy"
    });
    expect(cancelled.audits).toHaveLength(auditCount);

    const active = receiptClient();
    active.setNote({
      receiptNo: "FIN2A-100",
      status: "Needs Review",
      remarks: "FIN2A preserved active discrepancy"
    });
    const restored = await restoreWholeReceipt(active.client, {
      receiptNo: "FIN2A-100",
      reason: "No-op restoration must preserve review evidence",
      actor: { id: "director-private-id", name: "FIN2A Director" }
    });
    expect(restored).toMatchObject({ status: "ACTIVE", idempotent: true, changedComponents: 0 });
    expect(active.note).toMatchObject({
      status: "Needs Review",
      remarks: "FIN2A preserved active discrepancy"
    });
    expect(active.audits).toHaveLength(0);
  });

  it("reopens dues and removes cancelled split receipts from collection and Cash Book sources", async () => {
    const rows = splitRows();
    const student = {
      academicYear: "2026-27",
      admissionNo: "FIN2A-STUDENT",
      studentName: "FIN2A Student",
      className: "VI"
    };
    const fee = { className: "VI", termAmount: 6_000 };
    const before = allocateFees(student, fee, effectiveActiveReceiptPayments(rows));
    expect(before.totalCurrentYearPaid).toBe(6_000);
    expect(before.totalPending).toBe(18_000);
    for (const row of rows) row.isCancelled = true;
    const after = allocateFees(student, fee, effectiveActiveReceiptPayments(rows));
    expect(after.totalCurrentYearPaid).toBe(0);
    expect(after.totalPending).toBe(24_000);

    const cash = await calculateCashSources({
      payment: { findMany: async () => rows },
      miscIncomeReceipt: { findMany: async () => [] },
      bookSaleReceipt: { findMany: async () => [] },
      expensePayment: { findMany: async () => [] },
      cashBookMovement: { findMany: async () => [] }
    } as never, new Date("2026-07-26T00:00:00.000Z"), new Prisma.Decimal(0));
    expect(cash.feeCash.toFixed(2)).toBe("0.00");
    expect(cash.counts.feePayments).toBe(0);
  });

  it("uses the shared integrity helper across every affected finance surface", () => {
    const files = [
      "app/receipts/[receiptNo]/print/page.tsx",
      "lib/ledger-data.ts",
      "lib/data.ts",
      "app/api/reports/collection/route.ts",
      "lib/receipt-audit.ts",
      "app/api/export/[type]/route.ts",
      "lib/cash-book.ts"
    ];
    for (const file of files) {
      expect(readFileSync(file, "utf8"), file).toMatch(
        /effectiveReceiptState|effectiveActive(?:Selected)?ReceiptPayments|(?:load)?ReceiptStateMap|groupReceiptPayments/i
      );
    }
    const backup = readFileSync("lib/backup.ts", "utf8");
    const restore = readFileSync("lib/restore-database.ts", "utf8");
    for (const field of ["payments", "paymentAudits", "receiptNotes"]) {
      expect(backup).toContain(field);
      expect(restore).toContain(field);
    }
  });

  it("stores and returns purpose-limited audit snapshots without raw internal identifiers", () => {
    const snapshot = receiptAuditSnapshot({
      ...paymentRow,
      studentId: "private-student-id",
      cancelledByUserId: "private-actor-id",
      enteredByUserId: "private-entry-id",
      deletedAt: new Date(),
      passwordHash: "private-hash"
    });
    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toMatch(/private-(?:student|actor|entry)-id|private-hash/);
    expect(sanitizedPaymentAuditJson(JSON.stringify({
      ...snapshot,
      id: "private-payment-id",
      changedByUserId: "private-actor-id"
    })) ?? "").not.toMatch(/private-payment-id|private-actor-id/);
  });

  it("uses an accessible in-app confirmation and no native destructive dialog", () => {
    for (const file of [
      "components/payment-edit-form.tsx",
      "components/receipt-audit.tsx"
    ]) {
      const source = readFileSync(file, "utf8");
      expect(source).toContain('role="dialog"');
      expect(source).toContain('aria-modal="true"');
      expect(source).toMatch(/Cancellation reason|Reason/);
      expect(source).not.toMatch(/\b(?:alert|confirm|prompt)\s*\(/);
    }
    const directRoute = readFileSync("app/api/payments/[id]/route.ts", "utf8");
    expect(directRoute).toContain('requireApiPermission("CANCEL_PAYMENTS")');
    expect(directRoute).toContain("isReceiptCancellationAuthority");
    expect(directRoute).toContain("cancelWholeReceipt");
    expect(directRoute).toContain("assertReceiptMutationVersion");
    const middleware = readFileSync("middleware.ts", "utf8");
    expect(middleware).toContain("unsafeRequestOriginAllowed");
  });
});

function splitRows() {
  const updatedAt = new Date("2026-07-26T01:00:00.000Z");
  return [
    component("cash", 1_000, "Cash", "Cash", null, updatedAt),
    component("upi-1", 2_000, "UPI", "Director Sir GPay", "FIN2A-UPI-1", updatedAt),
    component("upi-2", 3_000, "UPI", "NPS Current Account UPI", "FIN2A-UPI-2", updatedAt)
  ];
}

function component(
  id: string,
  amountPaid: number,
  paymentMode: string,
  receivedAccount: string,
  transactionRefNo: string | null,
  updatedAt: Date
) {
  return {
    id,
    receiptNo: "FIN2A-100",
    admissionNo: "FIN2A-STUDENT",
    studentName: "FIN2A Student",
    className: "VI",
    section: "A",
    date: new Date("2026-07-26T00:00:00.000Z"),
    amountPaid,
    paymentMode,
    receivedAccount,
    transactionRefNo,
    feeType: "Current Year Fee",
    termHint: "Term 1",
    isCancelled: false,
    cancelledAt: null as Date | null,
    cancelledByUserId: null as string | null,
    cancellationReason: null as string | null,
    deletedAt: null as Date | null,
    updatedAt
  };
}

function receiptClient(options: { failAudit?: boolean } = {}) {
  const state: {
    rows: ReturnType<typeof splitRows>;
    audits: Array<{ data: Record<string, unknown> }>;
    note: null | { receiptNo: string; status: string; remarks: string };
  } = {
    rows: splitRows(),
    audits: [],
    note: null
  };
  let transactionQueue = Promise.resolve();

  function operations(snapshot: typeof state) {
    return {
      payment: {
        findMany: async () => snapshot.rows.map((row) => ({ ...row })),
        updateMany: async ({ where, data }: any) => {
          let count = 0;
          for (const row of snapshot.rows) {
            if (row.receiptNo !== where.receiptNo || row.deletedAt) continue;
            if (typeof where.isCancelled === "boolean" && row.isCancelled !== where.isCancelled) continue;
            Object.assign(row, data, { updatedAt: new Date() });
            count += 1;
          }
          return { count };
        }
      },
      paymentAudit: {
        create: async ({ data }: any) => {
          if (options.failAudit) throw new Error("Synthetic audit failure");
          snapshot.audits.push({ data });
          return data;
        }
      },
      receiptNote: {
        upsert: async ({ where, update, create }: any) => {
          snapshot.note = snapshot.note
            ? { ...snapshot.note, ...update }
            : { ...create, receiptNo: where.receiptNo };
          return snapshot.note;
        },
        findUnique: async () => snapshot.note
      }
    };
  }

  const client: any = {
    ...operations(state),
    $transaction: (callback: (tx: any) => Promise<unknown>) => {
      const run = transactionQueue.then(async () => {
        const snapshot = {
          rows: state.rows.map((row) => ({ ...row })),
          audits: state.audits.map((audit) => ({ data: { ...audit.data } })),
          note: state.note ? { ...state.note } : null
        };
        const result = await callback(operations(snapshot));
        state.rows.splice(0, state.rows.length, ...snapshot.rows);
        state.audits.splice(0, state.audits.length, ...snapshot.audits);
        state.note = snapshot.note;
        return result;
      });
      transactionQueue = run.then(() => undefined, () => undefined);
      return run;
    }
  };
  return {
    client,
    get rows() { return state.rows; },
    get audits() { return state.audits; },
    get note() { return state.note; },
    setNote(note: NonNullable<typeof state.note>) {
      state.note = { ...note };
    }
  };
}
