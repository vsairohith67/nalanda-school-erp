import { afterEach, expect, it, vi } from "vitest";
import React from "react";
import { SubstituteForm } from "../components/substitute-form";

// Actual component/event/fetch contract with mocked React hook storage, router
// and HTTP response. This is not browser/device or authenticated-route evidence.
const harness = vi.hoisted(() => ({ values: [] as any[], index: 0, push: vi.fn(), refresh: vi.fn() }));
vi.mock("react", async (original) => {
  const actual = await original<typeof import("react")>();
  return { ...actual, useState: (initial: any) => {
    const index = harness.index++;
    if (!(index in harness.values)) harness.values[index] = initial;
    return [harness.values[index], (value: any) => { harness.values[index] = typeof value === "function" ? value(harness.values[index]) : value; }];
  } };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: harness.push, refresh: harness.refresh }) }));
afterEach(() => { harness.values = []; harness.index = 0; harness.push.mockReset(); harness.refresh.mockReset(); vi.unstubAllGlobals(); });

const assignment = { id: "SYNTHETIC-B-ASSIGNMENT", updatedAt: "2026-10-08T00:00:00.123Z", assignmentDate: "2026-10-05T00:00:00.000Z", academicYear: "2026-27", absentStaffMemberId: "SYNTHETIC-ABSENT", substituteStaffMemberId: "SYNTHETIC-SUBSTITUTE", className: "VI", section: "A", subject: "Synthetic Math", periodLabel: "Period I", periodStartTime: "09:00", periodEndTime: "09:40", reason: "MANUAL", priority: "NORMAL", status: "ASSIGNED", notes: null, cancellationReason: null, leaveRequestId: null, timetableAssignmentId: null };
function nodes(tree: any): any[] { return tree && typeof tree === "object" ? [tree, ...React.Children.toArray(tree.props?.children).flatMap(nodes)] : []; }
function render(canAssign = true) { vi.stubGlobal("React", React); harness.index = 0; return SubstituteForm({ staff: [], timetableAssignments: [], assignment, canManage: true, canAssign, canConfirm: true }); }

it("UNIT_COMPONENT_CONTRACT sends the current persisted snapshot in assignment and confirmation requests", async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ assignment })); vi.stubGlobal("fetch", fetcher);
  const tree = render();
  await nodes(tree).find((node) => node.type === "button" && node.props.children === "Assign Substitute").props.onClick();
  expect(fetcher.mock.calls[0][0]).toBe(`/api/substitutes/${assignment.id}`);
  expect(fetcher.mock.calls[0][1].method).toBe("PATCH");
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ action: "assign", expectedUpdatedAt: assignment.updatedAt, academicYear: assignment.academicYear, periodStartTime: "09:00", periodEndTime: "09:40" });
  await nodes(tree).find((node) => node.type === "button" && node.props.children === "Confirm Duty").props.onClick();
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toMatchObject({ action: "confirm", expectedUpdatedAt: assignment.updatedAt });
});

it("UNIT_COMPONENT_CONTRACT sends a changed explicit academic year to advisory suggestions", async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ suggestions: [] })); vi.stubGlobal("fetch", fetcher);
  let tree = render();
  nodes(tree).find((node) => node.props?.["aria-label"] === "Academic Year").props.onChange({ target: { value: "2027-28" } });
  tree = render();
  await nodes(tree).find((node) => node.type === "button" && node.props.children === "Show Safe Suggestions").props.onClick();
  const query = new URL(fetcher.mock.calls[0][0], "https://synthetic.invalid").searchParams;
  expect(query.get("academicYear")).toBe("2027-28"); expect(query.get("assignmentDate")).toBe("2026-10-05"); expect(query.get("excludeId")).toBe(assignment.id);
});

it("UNIT_COMPONENT_CONTRACT surfaces stale-save refusal and keeps assignment controls permission-gated", async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ error: "The assignment changed; refresh before saving" }, { status: 409 })); vi.stubGlobal("fetch", fetcher);
  const tree = render(false);
  expect(nodes(tree).some((node) => node.type === "button" && node.props.children === "Assign Substitute")).toBe(false);
  await nodes(tree).find((node) => node.type === "button" && node.props.children === "Save Changes").props.onClick();
  expect(harness.values[2]).toBe("The assignment changed; refresh before saving"); expect(harness.refresh).not.toHaveBeenCalled();
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ action: "edit", expectedUpdatedAt: assignment.updatedAt });
});
