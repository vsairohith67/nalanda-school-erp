# MOBILE-IMPORT-A11Y-CLOSURE-1B

**MOBILE_IMPORT_A11Y_PARTIAL_TOOLING_GATE - LOCAL / UNMERGED**

Two demonstrated accessibility defects corrected; final rendered suite 38 PASS, zero FAIL. Genuine browser zoom/text enlargement, native picker cancellation and independent review remain unexecuted. This is not parent-task, authenticated ERP, native-device or release clearance.

## Identity And Ownership

- Frozen start SHA `2aa461b7e0388db6b79afe1e4421a5dc1d9e8dda`; tree `16004fe31ae0ad8a21dcf861430859250fc1be27`.
- Final implementation SHA `c1c179d1ee8bc9a4c29f72049e1b689195f7d688`; tree `b54b84a2391a492b0f1df561cc0a2c78d8196961`. The later handoff-only commit contains this document; its exact identity is available with `git log -1 --format="%H %T"`. A document cannot embed its own commit hash.
- Branch `recovery/mobile-import-a11y-1b`; worktree `C:/Users/rohit/.codex/worktrees/mobile-import-a11y-1b/school software`.
- Codex managed worktree creation used the explicit pinned SHA. The repository helper was inspected: its only creation interface selects origin/main and feature/<name>, so it was not used to silently adopt an older base. No helper edit or execution-policy bypass.
- Exact changed files: `components/student-import-panel.tsx`, `components/marks-importer.tsx`, `components/onboarding-centre.tsx`, `scripts/bulk-data-exchange-browser.ts`, `scripts/qa-mobile-import-a11y-1b.ts`, and this handoff.
- Harness/runner/handoff reserved first; production scope reserved after observed failures. No extra implementer. No change to shared CSS/dialog, parsers/services, schemas, flags, lockfiles, workflows, registers or release ledger.
- Primary still resolved to the pinned source at the last pre-handoff read. Its dirty certificate integration was neither read nor copied. Certificate source `ef006773`, backend companion, PR29, PR30, main and earlier read-only mobile worktree remain separately owned. Any later advance needs serial compatibility review, not automatic rebase.

## Source And Browser Boundaries

The real StudentImportPanel, legacy MarksImporter (no governedAssignments), OnboardingCentre and ImportRowErrors are bundled with their real local parsing workers. This does **not** load the governed marks interface or any authenticated route.

Unchanged Git blobs:
- Original CSS `app/globals.css`: `5f88522df70f6ac441669db6411bfaa800c6a327`.
- Shared ImportReviewDialog: `343a422b5d415080e6309054511556033b200d54`; ImportRowErrors: `e7c24116423748100cecce972683be667d182965`.
- Student worker: `47fce7a8a4d0e12d7d7167ba966ff73650338797`; onboarding worker: `a01b0cf0432b0bdf66bb3a8b89bb65e2bca30fe1`.
- Student component baseline/final: `8261de6d56e1e75168d8141d24e18a892854d619` / `4b9ce8f8fcafa51fadc25356f50ce6a86d4d9be6`.
- Marks component baseline/final: `7874394a1d8c74fb3be28585f0280810edc66127` / `102d374916869bbe236afb1119796404e4336333`.
- Onboarding component baseline/final: `4498f5efcba394110f7bededcea95862d0daccf8` / `564420c339444235e38349cfe5042cb8c0d62560`.

Installed frontend-testing and React guidance read. Browser plugin/skill absent; the frontend skill explicitly permits regular Playwright fallback. Installed Playwright 1.63.0 / Chromium 153.0.8010.12 launched without installing dependencies. Main-chat model switching is not exposed; no claim that its model changed. GPT-6 Astra is listed for reviewers, but no reviewer was launched because the four project-owner slots stayed occupied; **REVIEW_PENDING**, not independent acceptance.

Harness address was `127.0.0.1:47834`, with task-only `IMPORT_BROWSER_A11Y=1` and `IMPORT_BROWSER_PORT=47834`. Default behavior was separately checked at `127.0.0.1:47831`: all four original component choices render; task-only review option absent. Both listeners stopped. No Next.js server, app image, backend, database, public tunnel, provider or native app.

Original CSS ancestry classes (app-shell, page, marks-page/onboarding-page) are supplied around the components. The harness container uses display:block only; no test CSS disables motion. The original stylesheet requests an Inter/system stack; CDP confirms actual Segoe UI Bold for the harness heading. Geometry claims apply to this observed system fallback, not unprovided Inter. No font bytes copied or distributed. Georgia Bold school rendering/template contract is unchanged.

Every browser request is constrained to the loopback synthetic allowlist; server routes fail closed. All import/dry-run/confirm/execute mutations refuse, including legacy marks. The one fixed synthetic onboarding approval path is intercepted with a 409 refusal solely to reproduce UI behavior; no success/authorization receipt. Invented CSVs and an empty controlled XLSX from the existing generator only. Captures retain bounded action/keys, row counts/key samples and sentinel booleans, never workbook bodies or source filenames.

## Before And After

1. **Input feedback association:** missing-year and invalid-file feedback was visible but not connected to Academic year or the three file inputs. Stable useId/aria-describedby associations now connect existing messages; Academic year exposes invalid state and clears it on context invalidation. Validation/parser/required-field rules unchanged.
2. **Modal refusal:** onboarding 409 errors were outside the active native dialog, behind its inert background. The same error now renders once inside the active dialog and describes its reason/password controls; when no dialog is active, normal page feedback remains.

Private `baseline-reproductions/results.json` preserves 32 PASS and the three failing assertions for these two defects. The same assertions pass after the corrections. Earlier runner failures are retained: ambiguous heading locator; a mistaken native-dialog focus expectation (Tab into browser chrome sets document.hasFocus=false, background remains inert); exact label lookup including a textarea value; and Playwright string serialization in the malformed-JSON probe, corrected to raw bytes. No product timeout/assertion/business-rule relaxation.

## New Rendered Matrix

All results below are new execution on this frozen candidate, not inherited PR27/PR28 acceptance. Individual measurements/requests are in private `final-verified/results.json`.

| Scenario | Result / measured proof |
|---|---|
| Student: 1366x768, 390x844, 320x844, each light/dark | PASS, six cases; document width equals viewport; no out-of-bounds required control/text |
| Legacy marks: same six size/theme cases | PASS |
| Controlled onboarding: same six size/theme cases | PASS |
| Expanded long Unicode row errors: same six size/theme cases | PASS, wrapped/reachable |
| Identity, meaningful content, framework overlay, actual fonts | PASS; correct title/origin; no framework overlay; Segoe UI observed |
| Genuine 200% enlargement / 400% browser zoom | NOT_EXECUTED; shortcut changed neither 1280 CSS px, DPR 1 nor visual scale 1; no exposed Playwright browser-zoom API; 320px reflow is not zoom proof |
| Reduced-motion media preference, original progress style | PASS; query false -> true; width transition 0.2s -> 0.00001s; progress remains visible |
| Student missing-year error plus valid-year positive control | PASS, association/invalid-state clearing and preview availability |
| Student/marks/onboarding invalid-file feedback | PASS, each linked to its real file input |
| Student preview, clear, same-file selection, import mode, controlled mode | PASS; stale confirmation removed; legacy warnings retained; controlled missing contacts still block |
| Student pending preview then cancellation and same-file selection | PASS; mode disabled while pending; obsolete request cannot restore eligibility |
| Legacy modal Tab/Shift+Tab, Escape, trigger return, clear/reselect/context | PASS; focus visible inside dialog or leaves document for browser chrome; background trigger cannot take focus |
| Legacy pending preview, unmount/remount, fresh-context positive control | PASS; pending controls disabled; old eligibility/file absent; fresh preview works |
| Controlled real worker, canonical eligibility, clear, same-file reselect, bundle change | PASS; no stale upload eligibility |
| Programmatic empty file selection | PASS component behavior only |
| Native OS file-picker cancellation | NOT_EXECUTED; empty input selection is not native-picker evidence |
| Onboarding modal refusal, association, Escape and focus return | PASS; visible accessible refusal inside dialog |
| Demanding Student preview/table, marks dialog and onboarding refusal at 320px in both themes | PASS; bounded table scroll (data retained); no page overflow; keyboard cancel reachable |
| Original mobile 44px important-control target, marks/onboarding dialog buttons | PASS; measured >=44 CSS px; project UX requirement, not universal WCAG AA claim |
| Dialog/progress behavior with reduced preference through real worker/preview completion | PASS; no active dialog animations; no completion event dependency observed |
| Unknown route, static wrong method, malformed JSON/multipart, mutation denial | PASS; 404/405/400/403 as appropriate; harness remains alive |
| Sentinel projection and console health | PASS; excluded sentinel absent; zero page errors/unexplained warnings; deliberate synthetic 409 console messages retained |
| Authenticated ERP acceptance | NOT_EXECUTED |
| Windows WebView2, Safari, Android/iOS keyboard/providers/safe areas, installed/native/physical devices | NOT_EXECUTED |

W3C test references, not whole-product certification: [Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html), [Resize Text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html), [C39](https://www.w3.org/WAI/WCAG22/Techniques/css/C39).

## Validation And Private Evidence

- Final runner: `node node_modules/tsx/dist/cli.mjs scripts/qa-mobile-import-a11y-1b.ts --label=final-verified`: **38 PASS / 0 FAIL**, plus two explicit tooling/native check entries NOT_EXECUTED.
- Existing focused Vitest files bulk-data-exchange-ux-1a, onboarding-workbooks, student-import and import-action-state: **4 files / 50 tests PASS**, maxWorkers=1. Inspected first; only pure/doubled contracts exercised, no database created.
- Component partition `tsconfig.components.json`: PASS. Narrow temporary TypeScript project for both harness scripts and four test files: PASS. No full ERP regression/build or CI dispatch.
- Git diff --check, staged manifest, Git safety, onboarding publication and real-user-access publication scanners: PASS.
- Read-only recovery-source-evidence: expected **FAIL** `RECOVERY_SOURCE_DRIFT:components/marks-importer.tsx`. Shared register not edited; serial registration must bind all three changed component hashes and the two harness/runner paths.
- Worktree doctor WARNING (local-only branch). prepare-qa BLOCKED: no upstream, handoff not yet committed at that observation, and its origin/main-wide comparison overlaps other owners' dirty paths. Actual task delta has only the five implementation files above plus this document. No push or foreign cleanup to satisfy a helper.
- Reviewer: **REVIEW_PENDING**. No independent findings/approval are fabricated; self-inspection is not review.

Private root: `C:/Users/rohit/.codex/tmp/mobile-import-a11y-1b/`. Baseline and candidate run folders retain results and failure images. Representative final screenshots:
- `final-verified/onboarding-refusal-320-dark.png`
- `final-verified/marks-dialog-320-light.png`
- `final-verified/student-review-320-dark.png`
- `final-verified/errors-320-light.png`

The runner's private narrow typecheck project was `tmp/mobile-import-a11y-1b/tsconfig.qa.json`, extending the original tsconfig without changing it. The new qa-mobile script needs exact inclusion in an appropriate shared typecheck partition at serial integration; it was explicitly typechecked here.

## Cleanup, Timing And Handoff

Owned exploratory/runner browsers and their per-context preferences were closed/restored. Both task listeners are stopped; no global process kill. No school file, operational DB/vault, certificate, other-owner source or dependency store was modified. Original files were never used as fixtures. No operational fingerprint was read or reused as current evidence.

Automatic approval review rejected removal of the two owned synthetic output directories and the component typecheck cache with **blocked by policy**. No retry or alternate deletion mechanism. Retained residue: worktree `tmp/mobile-import-a11y-1b/`, `tmp/bulk-exchange-browser/`, `tsconfig.components.tsbuildinfo`, plus the owned node_modules junction to the existing recovery dependency store. All are ignored and uncommitted. Private screenshots/results retained intentionally.

Measured UTC landmarks (user date 3 October 2026 IST): first clock 21:05:07; capability/layout/motion/zoom preflight before 21:14; before-fix suite 21:14:20; final rendered source verified by 21:22:57; review capacity still unavailable 21:24:46. Work and validation overlapped review-capacity waiting; no account usage measured. Exact terminal interval is recorded in the final readback below.

Smallest serial integration: review this immutable local source, apply only these five implementation files, register exact source hashes and runner typecheck inclusion, then validate against the owner's actual integrated head. Do not absorb a companion branch or change held flags/runtime/native gates.

**ONE next acceptance action:** when a project worker slot is free, run an independent read-only GPT-6 Astra review of this exact local source and retained before/after browser evidence. Actual zoom and native/authenticated acceptance remain separately open afterward.

## Terminal Record Readback

- PR28: [one terminal comment](https://github.com/vsairohith67/nalanda-school-erp/pull/28#issuecomment-5961748436), exact body read back. PR remains OPEN/DRAFT at the pinned head at this readback.
- Asana review task: comment `1219120417483756` read back; original notes, owner and dates equal pre-update values; completed=false. Implementation task was read only.
- Canonical Notion ledger: comment `3edc9801-27a8-815f-a11c-001dbf849c61` read back; comment only, no page replacement.
- Canvs: only `bulk-data-exchange-ux-1a-status` text patched. Exact new text and unchanged old-text prefix read back; x/y/width/height/angle/font size/font family preserved. Other cards omitted from the mutation.
- Measured interval through record readback: 21:05:07 to 21:28:07 UTC = 23 minutes (02:35:07 to 02:58:07 IST on 3 October). Earlier setup before the first clock is not included. Review-slot unavailability was re-observed from 21:19:48 through this terminal period (at least 8 minutes 19 seconds, overlapping handoff/safeguard work); no extra reviewer or idle hardware wait.
- No push, PR-state change, parent completion, primary integration or automatic follow-on. Source registration and independent review remain required before serial adoption.
