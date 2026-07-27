import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { can } from "../lib/permissions";
import {
  cancelWholeReceipt,
  receiptVersion,
  ReceiptLockedDayError
} from "../lib/receipt-integrity";
import {
  publishReceiptLeadershipNotification,
  receiptLeadershipEventKey
} from "../lib/receipt-leadership-notifications";
import { receiptCorrectionDisplay } from "../lib/receipt";

describe("FIN-2B backup safety", () => {
  it("keeps CLI backup generation read-only", () => {
    const backupScript = source("scripts/backup.ts");
    expect(backupScript).not.toContain("ensureDefaultRolePermissions");
    expect(backupScript).toContain("generateFullBackup");
  });

  it("preserves immutable payment audits when the original actor login is unavailable during restore", () => {
    const restore = source("lib/restore-database.ts");
    expect(restore).toContain("mappedChangedByUserId ?? restoredBy.id");
    expect(restore).toContain("preserved its original actor label");
    expect(restore).not.toContain("Payment audit ${index + 1} skipped because its user account could not be matched safely.");
  });
});

describe("FIN-2B narrow permission and route policy", () => {
  it("allows only Super Admin, Director, and Accountant by default", () => {
    for (const permission of ["CANCEL_FINAL_RECEIPT", "CORRECT_FINAL_RECEIPT"] as const) {
      for (const role of ["SUPER_ADMIN", "DIRECTOR", "ACCOUNTANT"] as const) {
        expect(can(role, permission)).toBe(true);
      }
      for (const role of ["PRINCIPAL", "ADMIN", "VIEWER", "TEACHER", "PARENT"] as const) {
        expect(can(role, permission)).toBe(false);
      }
    }
  });

  it("uses exact server permissions without a hard-coded Accountant denial or broad substitute", () => {
    const paymentRoute = source("app/api/payments/[id]/route.ts");
    const auditRoute = source("app/api/receipt-audit/route.ts");
    const paymentPage = source("app/payments/[id]/edit/page.tsx");
    expect(paymentRoute).toContain('requireApiPermission("CORRECT_FINAL_RECEIPT")');
    expect(paymentRoute).toContain('requireApiPermission("CANCEL_FINAL_RECEIPT")');
    expect(auditRoute).toContain('requireApiPermission("CANCEL_FINAL_RECEIPT")');
    expect(paymentPage).toContain('permissionSetCan(permissions, "CORRECT_FINAL_RECEIPT")');
    expect(paymentPage).toContain('permissionSetCan(permissions, "CANCEL_FINAL_RECEIPT")');
    expect(paymentPage).toContain('if (!canRestore && !canCancel && !canCorrect) redirect("/unauthorized")');
    expect(`${paymentRoute}\n${auditRoute}`).not.toMatch(/MANAGE_FINANCE|Only the Director or Super Admin can cancel/);
    expect(paymentPage).not.toContain('requirePermission("VIEW_PAYMENTS")');
  });

  it("requires the exact helper authorization and rejects blank, short, oversized, and unsafe reasons", async () => {
    const base = {
      authorization: "CANCEL_FINAL_RECEIPT" as const,
      receiptNo: "FIN2B-REASON",
      expectedVersion: "1:0:1",
      actor: { id: "accountant-1", name: "FIN2B Accountant", role: "ACCOUNTANT" }
    };
    await expect(cancelWholeReceipt({} as any, {
      ...base,
      authorization: "CANCEL_PAYMENTS" as any,
      reason: "Verified duplicate"
    })).rejects.toMatchObject({ status: 403 });
    for (const reason of ["", "x", "x".repeat(501), "<script>unsafe</script>", "javascript:unsafe"]) {
      await expect(cancelWholeReceipt({} as any, { ...base, reason }))
        .rejects.toMatchObject({ status: 400 });
    }
  });

  it("preserves version, whole-receipt, reissue, audit, and private response guards", () => {
    const integrity = source("lib/receipt-integrity.ts");
    const paymentRoute = source("app/api/payments/[id]/route.ts");
    const middleware = source("middleware.ts");
    for (const token of [
      "assertExpectedVersion",
      "updateMany",
      "RECEIPT_CANCELLED",
      "RECEIPT_CORRECTED",
      "RECEIPT_SUPERSEDED",
      "RECEIPT_REISSUED",
      "replacementReceiptNo",
      "fin2bIdempotencyKey",
      "ReceiptLockedDayError"
    ]) {
      expect(integrity).toContain(token);
    }
    expect(paymentRoute).toContain("privateFinanceJson");
    expect(paymentRoute).toContain('authorization: "CORRECT_FINAL_RECEIPT"');
    expect(paymentRoute).toContain('authorization: "CANCEL_FINAL_RECEIPT"');
    expect(middleware).toContain("requestBodyTooLarge");
    expect(middleware).toContain("unsafeRequestOriginAllowed");
  });

  it("labels corrected, superseded, and replacement receipts for print/export", () => {
    expect(receiptCorrectionDisplay([
      {
        action: "RECEIPT_SUPERSEDED",
        newValueJson: JSON.stringify({
          originalReceiptNo: "R-1",
          replacementReceiptNo: "R-1-R1"
        })
      }
    ], "CANCELLED")).toEqual({
      lifecycleStatus: "SUPERSEDED",
      originalReceiptNo: "R-1",
      replacementReceiptNo: "R-1-R1"
    });
    expect(receiptCorrectionDisplay([
      {
        action: "RECEIPT_REISSUED",
        newValueJson: JSON.stringify({
          originalReceiptNo: "R-1",
          replacementReceiptNo: "R-1-R1"
        })
      }
    ], "ACTIVE").lifecycleStatus).toBe("CORRECTED_REPLACEMENT");
    expect(source("app/receipts/[receiptNo]/print/page.tsx")).toContain("receiptCorrectionDisplay");
    expect(source("app/api/export/[type]/route.ts")).toContain("receiptCorrectionDisplay");
  });

  it("uses accessible in-app dialogs with required reasons and no native dialogs", () => {
    const form = source("components/payment-edit-form.tsx");
    const audit = source("components/receipt-audit.tsx");
    for (const ui of [form, audit]) {
      expect(ui).toContain('role="dialog"');
      expect(ui).toContain('aria-modal="true"');
      expect(ui).toContain("minLength={3}");
      expect(ui).toContain("maxLength={500}");
      expect(ui).toContain('event.key === "Escape"');
      expect(ui).toMatch(/event\.key\s*[!=]==?\s*"Tab"/);
      expect(ui).not.toMatch(/\b(?:alert|confirm|prompt)\s*\(/);
    }
  });
});

describe("FIN-2B leadership notifications", () => {
  it("publishes exactly one minimized unread in-app row per active Director and Super Admin", async () => {
    const fixture = notificationClient([
      { id: "director-1", role: "DIRECTOR" },
      { id: "super-1", role: "SUPER_ADMIN" }
    ]);
    const input = {
      eventKey: "audit-event-1",
      action: "CANCELLED" as const,
      receiptNo: "FIN2B-100",
      amount: 6_000,
      receiptDate: new Date("2026-07-27T00:00:00.000Z"),
      actor: { id: "accountant-1", name: "FIN2B Accountant", role: "ACCOUNTANT" },
      reason: "Duplicate final receipt"
    };
    const first = await publishReceiptLeadershipNotification(fixture.client, input);
    const retry = await publishReceiptLeadershipNotification(fixture.client, input);
    expect(first).toMatchObject({ recipients: 2, idempotent: false, missingLeadership: false });
    expect(retry).toMatchObject({ recipients: 2, idempotent: true });
    expect(fixture.campaigns).toHaveLength(1);
    expect(fixture.recipients).toHaveLength(2);
    expect(fixture.recipients.map((row) => row.recipientRoleSnapshot).sort()).toEqual(["DIRECTOR", "SUPER_ADMIN"]);
    expect(fixture.recipients.every((row) => row.deliveryStatus === "AVAILABLE" && row.readAt === undefined)).toBe(true);
    const serialized = JSON.stringify({ campaign: fixture.campaigns[0], recipients: fixture.recipients });
    for (const forbidden of ["guardian", "aadhaar", "dateOfBirth", "medical", "password", "session"]) {
      expect(serialized.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
    expect(fixture.campaigns[0].actionPath).toBe("/receipt-audit");
    expect(fixture.campaigns[0].channel).toBe("IN_APP");
  });

  it("redacts sensitive-looking reason content from notification text", async () => {
    const fixture = notificationClient([{ id: "director-1", role: "DIRECTOR" }]);
    await publishReceiptLeadershipNotification(fixture.client, {
      eventKey: "audit-event-sensitive",
      action: "CORRECTED",
      receiptNo: "FIN2B-101",
      amount: 2_000,
      receiptDate: new Date("2026-07-27T00:00:00.000Z"),
      actor: { id: "accountant-1", name: "FIN2B Accountant", role: "ACCOUNTANT" },
      reason: "Guardian mobile 9999999999 was written in remarks"
    });
    expect(fixture.campaigns[0].body).toContain("Sensitive details withheld");
    expect(fixture.campaigns[0].body).not.toContain("9999999999");
  });

  it("records a preserved warning and does not fail when no active leader exists", async () => {
    const fixture = notificationClient([]);
    const result = await publishReceiptLeadershipNotification(fixture.client, {
      eventKey: "audit-event-no-leader",
      action: "CANCELLED",
      receiptNo: "FIN2B-102",
      amount: 1_000,
      receiptDate: new Date("2026-07-27T00:00:00.000Z"),
      actor: { id: "accountant-1", name: "FIN2B Accountant", role: "ACCOUNTANT" },
      reason: "Receipt issued twice"
    });
    expect(result).toMatchObject({ recipients: 0, missingLeadership: true });
    expect(fixture.skipped).toHaveLength(1);
    expect(fixture.events[0].eventType).toBe("FINANCE_RECEIPT_LEADERSHIP_MISSING");
  });
});

describe("FIN-2B locked-day routing", () => {
  it("blocks Accountant cancellation, preserves payments, and creates an idempotent leadership review alert", async () => {
    const rows = splitRows();
    const notifications = notificationClient([
      { id: "director-1", role: "DIRECTOR" },
      { id: "super-1", role: "SUPER_ADMIN" }
    ]);
    const client: any = {
      payment: {
        findMany: async () => rows.map((row) => ({ ...row })),
        updateMany: async () => {
          throw new Error("Payment update must not run for a locked day");
        }
      },
      cashBookDay: { findFirst: async () => ({ status: "LOCKED" }) },
      ...notifications.client
    };
    client.$transaction = async (callback: (tx: any) => Promise<unknown>) => callback(client);
    const input = {
      authorization: "CANCEL_FINAL_RECEIPT" as const,
      receiptNo: "FIN2B-LOCKED",
      reason: "Verified duplicate receipt",
      expectedVersion: receiptVersion(rows),
      actor: { id: "accountant-1", name: "FIN2B Accountant", role: "ACCOUNTANT" }
    };
    await expect(cancelWholeReceipt(client, input)).rejects.toBeInstanceOf(ReceiptLockedDayError);
    expect(rows.every((row) => !row.isCancelled)).toBe(true);
    expect(notifications.campaigns).toHaveLength(1);
    expect(notifications.recipients).toHaveLength(2);
    expect(notifications.campaigns[0].title).toMatch(/leadership review/i);
    await expect(cancelWholeReceipt(client, input)).rejects.toBeInstanceOf(ReceiptLockedDayError);
    expect(notifications.campaigns).toHaveLength(1);
  });

  it("derives stable review-alert keys from action, receipt, version, and day status", () => {
    expect(receiptLeadershipEventKey(["CANCEL", "R-1", "3:0:1", "LOCKED"]))
      .toBe(receiptLeadershipEventKey(["CANCEL", "R-1", "3:0:1", "LOCKED"]));
    expect(receiptLeadershipEventKey(["CANCEL", "R-1", "3:0:1", "LOCKED"]))
      .not.toBe(receiptLeadershipEventKey(["CORRECT", "R-1", "3:0:1", "LOCKED"]));
  });
});

function source(path: string) {
  return readFileSync(path, "utf8");
}

function splitRows() {
  const updatedAt = new Date("2026-07-27T01:00:00.000Z");
  return [
    { id: "cash", receiptNo: "FIN2B-LOCKED", amountPaid: 1_000, date: new Date("2026-07-27T00:00:00.000Z"), isCancelled: false, deletedAt: null, updatedAt },
    { id: "upi-1", receiptNo: "FIN2B-LOCKED", amountPaid: 2_000, date: new Date("2026-07-27T00:00:00.000Z"), isCancelled: false, deletedAt: null, updatedAt },
    { id: "upi-2", receiptNo: "FIN2B-LOCKED", amountPaid: 3_000, date: new Date("2026-07-27T00:00:00.000Z"), isCancelled: false, deletedAt: null, updatedAt }
  ];
}

function notificationClient(leaders: Array<{ id: string; role: string }>) {
  const campaigns: any[] = [];
  const recipients: any[] = [];
  const skipped: any[] = [];
  const events: any[] = [];
  const client = {
    user: {
      findMany: async () => leaders.map((leader) => ({ ...leader }))
    },
    notificationCampaign: {
      findUnique: async ({ where }: any) => {
        const row = campaigns.find((campaign) => campaign.campaignNumber === where.campaignNumber);
        return row
          ? { id: row.id, campaignNumber: row.campaignNumber, totalRecipientRows: row.totalRecipientRows }
          : null;
      },
      create: async ({ data }: any) => {
        const row = { id: `campaign-${campaigns.length + 1}`, ...data };
        campaigns.push(row);
        return row;
      }
    },
    notificationRecipient: {
      create: async ({ data }: any) => {
        const row = { id: `recipient-${recipients.length + 1}`, ...data };
        recipients.push(row);
        return row;
      }
    },
    notificationSkippedRecipient: {
      create: async ({ data }: any) => {
        const row = { id: `skipped-${skipped.length + 1}`, ...data };
        skipped.push(row);
        return row;
      }
    },
    notificationEvent: {
      create: async ({ data }: any) => {
        const row = { id: `event-${events.length + 1}`, ...data };
        events.push(row);
        return row;
      }
    }
  };
  return { client, campaigns, recipients, skipped, events };
}
