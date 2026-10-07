import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { ExpenseForm } from "@/components/expense-form";
import { PublisherBillForm } from "@/components/books-finance-forms";

// COMPONENT_CONTRACT: actual components/events with hook state, router,
// confirmation and fetch doubles. This does not prove browser/device behavior,
// authentication, receipt acceptance or the real database service journey.
const hooks = vi.hoisted(() => ({ values: [] as any[], index: 0 }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(),
  useState: (initial: any) => { const i = hooks.index++; if (!(i in hooks.values)) hooks.values[i] = typeof initial === "function" ? initial() : initial;
    return [hooks.values[i], (value: any) => { hooks.values[i] = typeof value === "function" ? value(hooks.values[i]) : value; }]; },
  useMemo: (fn: () => unknown) => fn()
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/components/security-dialog-provider", () => ({ useSecurityDialog: () => async () => true }));
afterEach(() => { hooks.values = []; hooks.index = 0; vi.unstubAllGlobals(); });
const row = { id: "invented", updatedAt: "2026-10-08T00:00:00.000Z", academicYear: "2026-27", annualCashService: true,
  vendor: { id: "invented-payee" }, category: { id: "invented-category" }, department: { id: "invented-library" },
  expenseDate: "2026-10-08", description: "Books + Examination Cell + library annual service", grossAmount: "123.45", netAmount: "123.45", taxAmount: "0", deductionAmount: "0", paymentMethod: "CASH", paymentStatus: "UNPAID", approvalStatus: "DRAFT", payments: [] };
const props = { masters: { vendors: [], categories: [], departments: [] }, permissions: { manage: true, approve: true, pay: true, cancel: true } };
function nodes(tree: any): any[] { return !tree || typeof tree !== "object" ? [] : [tree, ...React.Children.toArray(tree.props?.children).flatMap(nodes)]; }
function render(expense = row) { vi.stubGlobal("React", React); hooks.index = 0; return ExpenseForm({ ...props, expense }); }

it("locks selected annual payee, purpose and period and renders only CASH", () => {
  const tree = render();
  for (const label of ["Academic Year", "Category", "Vendor", "Department", "Expense Description"])
    expect(nodes(tree).find(n => n.props?.["aria-label"] === label)?.props.disabled).toBe(true);
  const method = nodes(tree).find(n => n.props?.["aria-label"] === "Payment Method");
  expect(nodes(method).filter(n => n.type === "option").map(n => n.props.children)).toEqual(["CASH"]);
  expect(renderToStaticMarkup(tree)).toContain("Books + Examination Cell + library annual service");
});
it("retains generic selectable payment methods", () => {
  const tree = render({ ...row, annualCashService: false });
  const method = nodes(tree).find(n => n.props?.["aria-label"] === "Payment Method");
  expect(nodes(method).filter(n => n.type === "option").map(n => n.props.children)).toContain("UPI");
});
it("uses the just-saved authoritative version for Save and Submit", async () => {
  const savedVersion = "2026-10-08T00:01:00.000Z";
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ expense: { ...row, updatedAt: savedVersion } })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ expense: { ...row, updatedAt: "2026-10-08T00:02:00.000Z" } })));
  vi.stubGlobal("fetch", fetcher);
  const button = nodes(render()).find(n => n.type === "button" && n.props.children === "Save and Submit");
  await button.props.onClick();
  expect(JSON.parse(fetcher.mock.calls[0][1].body).expectedUpdatedAt).toBe(row.updatedAt);
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ action: "submit", expectedUpdatedAt: savedVersion });
});
it("requires an explicitly supplied annual interval instead of choosing academic year as the period", () => {
  vi.stubGlobal("React", React);
  const tree = PublisherBillForm({ vendors: [], academicYear: "2026-27", today: "2026-10-08", service: true });
  expect(hooks.values[1].servicePeriod).toBe("");
  const html = renderToStaticMarkup(tree);
  expect(html).toContain("Explicit annual service period"); expect(html).toContain("not a receipt acknowledgement");
});
