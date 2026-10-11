import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
// @ts-expect-error Existing source-bound Node control is an ESM script.
import { admittedWindowsQaPolicy } from "../scripts/portable/windows-qa-window.mjs";

const window = JSON.parse(readFileSync("config/current-candidate-qualification-5a-window.json", "utf8"));
const head = "a".repeat(40), repository = "vsairohith67/nalanda-school-erp";
const env = { GITHUB_ACTIONS: "true", RUNNER_OS: "Windows", GITHUB_EVENT_NAME: "pull_request", GITHUB_REPOSITORY: repository, GITHUB_RUN_ATTEMPT: "1" };
const event = (time: string) => ({ action: "synchronize", number: 28, pull_request: { number: 28, updated_at: time, head: { sha: head, ref: "release/recovery-integration-1a", repo: { full_name: repository } }, base: { repo: { full_name: repository } } } });

it.each(["2026-10-11T03:10:00.961Z", "2026-10-11T05:00:00Z", "2026-10-12T12:00:00Z", "2026-11-01T00:00:00Z"])("admits only exact ordinary publication after the prospective amendment: %s", time => {
  expect(admittedWindowsQaPolicy(event(time), env, head, window).policy).toBe("RemoteSigned");
});
it.each(["2026-10-09T12:00:00Z", "2026-10-11T03:10:00.960Z", "not-a-date", "2026-10-11T14:50:19+00:00"])("refuses events before the prospective amendment or malformed time: %s", time => {
  expect(admittedWindowsQaPolicy(event(time), env, head, window).policy).toBe("");
});
it.each([
  { GITHUB_RUN_ATTEMPT: "2" }, { GITHUB_EVENT_NAME: "workflow_dispatch" }, { GITHUB_REPOSITORY: "foreign/repo" },
  { GITHUB_ACTIONS: "false" }, { RUNNER_OS: "Linux" }
])("refuses unrelated or repeated hosted context %j", changed => {
  expect(admittedWindowsQaPolicy(event("2026-10-11T05:00:00Z"), { ...env, ...changed }, head, window).policy).toBe("");
});
it("refuses forks, other heads/branches/PRs and any substituted source authority", () => {
  const valid = event("2026-10-11T05:00:00Z");
  for (const change of [
    { ...valid, number: 29 }, { ...valid, pull_request: { ...valid.pull_request, number: 29 } },
    { ...valid, pull_request: { ...valid.pull_request, head: { ...valid.pull_request.head, ref: "main" } } },
    { ...valid, pull_request: { ...valid.pull_request, head: { ...valid.pull_request.head, repo: { full_name: "foreign/fork" } } } }
  ]) expect(admittedWindowsQaPolicy(change, env, head, window).policy).toBe("");
  expect(admittedWindowsQaPolicy(valid, env, "b".repeat(40), window).policy).toBe("");
  expect(admittedWindowsQaPolicy(valid, env, head, { ...window, eventEndExclusiveUtc: "2026-10-11T14:50:20.001Z" }).policy).toBe("");
  expect(admittedWindowsQaPolicy(valid, env, head, { ...window, policy: "Bypass" }).policy).toBe("");
  const consumed = JSON.parse(readFileSync("config/overnight-repair-product-1a-window.json", "utf8"));
  expect(admittedWindowsQaPolicy(valid, env, head, consumed).policy).toBe("");
  expect(admittedWindowsQaPolicy(valid, env, head, { ...window, instructionSha256: consumed.instructionSha256 }).policy).toBe("");
  expect(admittedWindowsQaPolicy(valid, env, head, { ...window, previousAllowancesRemainConsumed: false }).policy).toBe("");
  expect(admittedWindowsQaPolicy(valid, env, head, { ...window, amendmentSha256: "0".repeat(64) }).policy).toBe("");
  expect(admittedWindowsQaPolicy(valid, env, head, { ...window, maximumStepMinutes: 121 }).policy).toBe("");
  const prior3a = JSON.parse(readFileSync("config/bridge-packaging-qualification-3a-window.json", "utf8"));
  expect(admittedWindowsQaPolicy(valid, env, head, prior3a).policy).toBe("");
  const prior2a = JSON.parse(readFileSync("config/release-blocker-removal-2a-window.json", "utf8"));
  expect(admittedWindowsQaPolicy(valid, env, head, prior2a).policy).toBe("");
  expect(admittedWindowsQaPolicy(valid, env, head, { ...window, publicationCeiling: 3 }).policy).toBe("");
  expect(admittedWindowsQaPolicy(valid, env, head, { ...window, additionalPublicationBudgetCreated: false }).policy).toBe("");
  expect(admittedWindowsQaPolicy(valid, env, head, { ...window, transferredPublicationSlots: [1, 2] }).policy).toBe("");
});

it.each(["reopened", "edited", "labeled", "opened", "closed", ""])("does not spend source-publication policy authority on a %s event", action => {
  expect(admittedWindowsQaPolicy({ ...event("2026-10-11T05:00:00Z"), action }, env, head, window).policy).toBe("");
});
