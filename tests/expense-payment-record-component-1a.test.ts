import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { ExpensePaymentRecordDraft } from "../components/expense-payment-record";
import type { ExpensePaymentRecord } from "../lib/expense-payment-record";

// COMPONENT_CONTRACT: the real handler with controlled hook/HTTP/print
// transports. Actual current IAM and read-only persistence are tested in the
// separate expense-payment-record-1a service/route suite, never inferred here.
const hooks = vi.hoisted(() => ({ values: [] as any[], index: 0 }));
vi.mock("react", async original => {
  const actual = await original<typeof import("react")>();
  return { ...actual, useState: (initial: unknown) => {
    const index = hooks.index++; if (!(index in hooks.values)) hooks.values[index] = initial;
    return [hooks.values[index], (value: unknown) => { hooks.values[index] = value; }];
  } };
});
afterEach(() => { hooks.values = []; hooks.index = 0; vi.unstubAllGlobals(); });
const record: ExpensePaymentRecord = {
  documentKind: "PAYMENT_RECORD_ACKNOWLEDGEMENT_DRAFT", officialReceipt: false, acknowledgementRecorded: false,
  schoolName: "Invented School", expenseId: "SYNTHETIC/EXPENSE", paymentId: "SYNTHETIC/PAYMENT", expenseReference: "SYNTHETIC-001",
  payeeId: "SYNTHETIC-PAYEE", payeeName: "Invented Teacher", purpose: "Books + Examination Cell + library annual responsibility",
  coveredInterval: "Explicit invented interval", academicYear: "2026-27", amount: "123.45", currency: "INR", paymentMethod: "CASH",
  paymentDate: "2026-10-08", approvalStatus: "APPROVED", paymentStatus: "PAID", expenseUpdatedAt: "2026-10-08T19:00:00.000Z",
  paymentCreatedAt: "2026-10-08T19:00:00.000Z", version: "a".repeat(64)
};
function nodes(tree: any): any[] { return tree && typeof tree === "object" ? [tree, ...React.Children.toArray(tree.props?.children).flatMap(nodes)] : []; }
function button() { vi.stubGlobal("React", React); hooks.index = 0; return nodes(ExpensePaymentRecordDraft({ record })).find(node => node.type === "button"); }

it("COMPONENT_CONTRACT revalidates the exact snapshot before every print and closes print visibility afterward", async () => {
  const fetcher = vi.fn().mockImplementation(async () => Response.json({ record }));
  const printer = vi.fn(() => expect(hooks.values[1]).toBe(true));
  vi.stubGlobal("fetch", fetcher); vi.stubGlobal("window", { print: printer });
  for (let i = 0; i < 2; i++) { await button().props.onClick(); expect(hooks.values[1]).toBe(false); }
  expect(fetcher).toHaveBeenCalledTimes(2); expect(printer).toHaveBeenCalledTimes(2);
  const [url, options] = fetcher.mock.calls[0];
  expect(url).toContain("SYNTHETIC%2FEXPENSE/payment-record?");
  const query = new URL(url, "https://synthetic.invalid").searchParams;
  expect(query.get("paymentId")).toBe(record.paymentId); expect(query.get("version")).toBe(record.version);
  expect(options).toEqual({ cache: "no-store" }); // No mutation request/body.
});

it.each([403, 409])("COMPONENT_CONTRACT refuses printing after fresh server denial %s", async status => {
  const printer = vi.fn(); vi.stubGlobal("window", { print: printer });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "SYNTHETIC permission or stale refusal" }, { status })));
  await button().props.onClick(); expect(printer).not.toHaveBeenCalled();
  expect(hooks.values[1]).toBe(false); expect(hooks.values[2]).toContain("refusal");
});

it("COMPONENT_CONTRACT refuses mismatched successful responses and settles after a print failure", async () => {
  const printer = vi.fn(); vi.stubGlobal("window", { print: printer });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ record: { ...record, version: "b".repeat(64) } })));
  await button().props.onClick(); expect(printer).not.toHaveBeenCalled();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ record })));
  printer.mockImplementation(() => { throw new Error("SYNTHETIC print unavailable"); });
  await button().props.onClick(); expect(printer).toHaveBeenCalledTimes(1);
  expect(hooks.values[0]).toBe(false); expect(hooks.values[1]).toBe(false); expect(hooks.values[2]).toContain("print unavailable");
});
