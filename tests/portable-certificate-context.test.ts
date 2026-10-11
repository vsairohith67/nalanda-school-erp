import { afterEach, expect, it, vi } from "vitest";
import React from "react";
import { CertificateRequestActions, CertificateWorkflowActions } from "../components/certificate-forms";
import { ImportReviewDialog } from "../components/import-review-dialog";

// UNIT_OR_CONTRACT: execute the real component's event handlers with a small
// hook harness. This is not a DOM, browser, authentication or server test.
const hooks = vi.hoisted(() => ({ values: [] as unknown[], cursor: 0,
  deps: undefined as readonly unknown[] | undefined, effect: undefined as (() => void) | undefined,
  refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: hooks.refresh }) }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(),
  useState: (initial: unknown) => {
    const index = hooks.cursor++;
    if (!(index in hooks.values)) hooks.values[index] = initial;
    return [hooks.values[index], (value: unknown) => { hooks.values[index] = value; }];
  },
  useEffect: (effect: () => void, deps: readonly unknown[]) => {
    if (!hooks.deps || deps.some((value, index) => !Object.is(value, hooks.deps![index]))) hooks.effect = effect;
    hooks.deps = deps;
  }
}));
afterEach(() => { hooks.values = []; hooks.cursor = 0; hooks.deps = undefined; hooks.effect = undefined; vi.clearAllMocks(); vi.unstubAllGlobals(); });
type Element = React.ReactElement<any>;
function elements(node: React.ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!React.isValidElement(node)) return [];
  const element = node as Element;
  return [element, ...elements(element.props.children)];
}
const cases = [
  { kind: "request", component: CertificateRequestActions, status: "APPROVED", label: "Cancel Certificate Request", prefix: "/api/certificates/requests" },
  { kind: "certificate", component: CertificateWorkflowActions, status: "ISSUED", label: "Cancel Issued Certificate", prefix: "/api/certificates" }
];
function mount(spec: typeof cases[number]) {
  vi.stubGlobal("React", React);
  let props = { id: "synthetic-a", status: spec.status, updatedAt: "same-version", type: "GRADUATION", permissions: ["MANAGE_CERTIFICATE_REQUESTS", "CANCEL_ISSUED_CERTIFICATES"] };
  let tree: React.ReactNode;
  function render(change: Partial<typeof props> = {}) {
    props = { ...props, ...change }; hooks.cursor = 0; hooks.effect = undefined;
    tree = spec.component(props);
    const effect = hooks.effect as (() => void) | undefined;
    if (effect) { effect(); hooks.cursor = 0; hooks.effect = undefined; tree = spec.component(props); }
  }
  const dialog = () => elements(tree).find(node => node.type === ImportReviewDialog);
  function open(reason = "Synthetic reviewed reason") {
    const trigger = elements(tree).find(node => node.type === "button" && node.props.children === spec.label)!;
    trigger.props.onClick(); render();
    elements(dialog()!.props.children).find(node => node.type === "textarea")!.props.onChange({ target: { value: reason } }); render();
  }
  function confirm() {
    const button = elements(dialog()!.props.children).find(node => node.type === "button")!;
    expect(button.props.disabled).toBe(false); return button.props.onClick() as Promise<void>;
  }
  render(); return { render, dialog, open, confirm };
}
it.each(cases)("UNIT_OR_CONTRACT: $kind same-context confirmation sends the selected action and resets after success", async spec => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }); vi.stubGlobal("fetch", fetch);
  const view = mount(spec); view.open(); view.render(); expect(view.dialog()).toBeDefined();
  await view.confirm(); view.render();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][0]).toBe(`${spec.prefix}/synthetic-a/workflow`);
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ action: "cancel", expectedUpdatedAt: "same-version", reason: "Synthetic reviewed reason" });
  expect(view.dialog()).toBeUndefined(); expect(hooks.values[3]).toBe("");
});
it.each(cases)("UNIT_OR_CONTRACT: $kind switch discards prior confirmation and a fresh action targets the current record", async spec => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }); vi.stubGlobal("fetch", fetch);
  const view = mount(spec); view.open("Reason for A"); view.render({ id: "synthetic-b" });
  expect(view.dialog()).toBeUndefined(); expect(hooks.values[3]).toBe(""); expect(fetch).not.toHaveBeenCalled();
  view.open("Reason for B"); await view.confirm();
  expect(fetch).toHaveBeenCalledTimes(1); expect(fetch.mock.calls[0][0]).toBe(`${spec.prefix}/synthetic-b/workflow`);
  expect(JSON.parse(fetch.mock.calls[0][1].body).reason).toBe("Reason for B");
});
it.each(cases)("UNIT_OR_CONTRACT: $kind close sends nothing and authoritative version changes reset dialog and reason", spec => {
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch); const view = mount(spec); view.open();
  view.dialog()!.props.onClose(); view.render(); expect(view.dialog()).toBeUndefined(); expect(fetch).not.toHaveBeenCalled();
  view.open(); view.render({ updatedAt: "next-version" }); expect(view.dialog()).toBeUndefined(); expect(hooks.values[3]).toBe("");
  view.open(); view.render({ status: "CANCELLED" }); expect(view.dialog()).toBeUndefined(); expect(hooks.values[3]).toBe(""); expect(fetch).not.toHaveBeenCalled();
});
it.each(cases.flatMap(spec => [true, false].map(ok => ({ ...spec, ok }))))("UNIT_OR_CONTRACT: $kind delayed response ok=$ok cannot restore confirmation after rapid record switches", async spec => {
  let finish!: (response: unknown) => void;
  const fetch = vi.fn((_url: string, _options: RequestInit) => new Promise(resolve => { finish = resolve; })); vi.stubGlobal("fetch", fetch);
  const view = mount(spec); view.open(); const pending = view.confirm();
  view.render({ id: "synthetic-b" }); view.render({ id: "synthetic-c" });
  expect(view.dialog()).toBeUndefined(); expect(hooks.values[3]).toBe("");
  finish({ ok: spec.ok, json: async () => spec.ok ? {} : { error: "Synthetic refusal" } }); await pending; view.render();
  expect(view.dialog()).toBeUndefined(); expect(hooks.values[3]).toBe("");
  expect(fetch).toHaveBeenCalledTimes(1); expect(fetch.mock.calls[0][0]).toBe(`${spec.prefix}/synthetic-a/workflow`);
});
