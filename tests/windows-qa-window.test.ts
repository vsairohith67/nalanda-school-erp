import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
// @ts-expect-error Existing source-bound Node control is an ESM script.
import { admittedWindowsQaPolicy } from "../scripts/portable/windows-qa-window.mjs";

const window = JSON.parse(readFileSync("config/overnight-repair-product-1a-window.json", "utf8"));
const head = "a".repeat(40), repository = "vsairohith67/nalanda-school-erp";
const env = { GITHUB_ACTIONS: "true", RUNNER_OS: "Windows", GITHUB_EVENT_NAME: "pull_request", GITHUB_REPOSITORY: repository, GITHUB_RUN_ATTEMPT: "1" };
const event = (time: string) => ({ number: 28, pull_request: { number: 28, updated_at: time, head: { sha: head, ref: "release/recovery-integration-1a", repo: { full_name: repository } }, base: { repo: { full_name: repository } } } });

it.each(["2026-10-08T19:02:43Z", "2026-10-08T23:59:59Z", "2026-10-09T00:00:00Z", "2026-10-09T05:02:42.999Z"])("admits only exact ordinary publication inside the single approved interval: %s", time => {
  expect(admittedWindowsQaPolicy(event(time), env, head, window).policy).toBe("RemoteSigned");
});
it.each(["2026-10-08T19:02:42.999Z", "2026-10-09T05:02:43Z", "2026-10-10T00:00:00Z", "not-a-date", "2026-10-09T05:02:42+00:00"])("refuses events outside the exact interval or malformed time: %s", time => {
  expect(admittedWindowsQaPolicy(event(time), env, head, window).policy).toBe("");
});
it.each([
  { GITHUB_RUN_ATTEMPT: "2" }, { GITHUB_EVENT_NAME: "workflow_dispatch" }, { GITHUB_REPOSITORY: "foreign/repo" },
  { GITHUB_ACTIONS: "false" }, { RUNNER_OS: "Linux" }
])("refuses unrelated or repeated hosted context %j", changed => {
  expect(admittedWindowsQaPolicy(event("2026-10-08T20:00:00Z"), { ...env, ...changed }, head, window).policy).toBe("");
});
it("refuses forks, other heads/branches/PRs and any silently extended source window", () => {
  const valid = event("2026-10-08T20:00:00Z");
  for (const change of [
    { ...valid, number: 29 }, { ...valid, pull_request: { ...valid.pull_request, number: 29 } },
    { ...valid, pull_request: { ...valid.pull_request, head: { ...valid.pull_request.head, ref: "main" } } },
    { ...valid, pull_request: { ...valid.pull_request, head: { ...valid.pull_request.head, repo: { full_name: "foreign/fork" } } } }
  ]) expect(admittedWindowsQaPolicy(change, env, head, window).policy).toBe("");
  expect(admittedWindowsQaPolicy(valid, env, "b".repeat(40), window).policy).toBe("");
  expect(admittedWindowsQaPolicy(valid, env, head, { ...window, eventEndExclusiveUtc: "2026-10-10T05:02:43.000Z" }).policy).toBe("");
  expect(admittedWindowsQaPolicy(valid, env, head, { ...window, policy: "Bypass" }).policy).toBe("");
});
