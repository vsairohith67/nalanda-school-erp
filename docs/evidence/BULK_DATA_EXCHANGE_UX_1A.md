# BULK-DATA-EXCHANGE-UX-1A

Status: BULK_DATA_EXCHANGE_UX_1A_IMPLEMENTED_PENDING_RELEASE_GATE. Implementation and hosted synthetic acceptance complete; no release or operational clearance.

Base: origin/main 104aacc7bd314cae82e60bb02b5c8a965c7ffedd; tree 2c7f1a129e6b98abb9689abf7c989b0ed8468561; backup v45.
Dedicated retained worktree: bulk-data-exchange-ux-1a; branch feature/bulk-data-exchange-ux-1a.

## Ownership before writing

This task: Student import projection and panels; marks CSV adapters, existing import routes and narrow governed sheet-route additions; Student list/export filter helper; task-specific tests/evidence. Finance owns concession/item/payment logic, schema, backup, permissions/flag infrastructure, shared registers and shared release contracts. These dependencies initially remained read-only; the owner later expressly authorised the four shared CI reconciliation repairs described below. Status-only inspection identified no existing finance edit in the Student export dispatcher. Its change is Student-only. Serial integration is required for shared register/release contracts; no foreign implementation copied.

Protected operational DB: C:/Users/rohit/Documents/school software/prisma/dev.db; SHA256 65F47EFA37DA321023439303770645F8D656F2BE58458C1A03B341408EF9A6FA; size 8409088; no sidecars at baseline. Never used as fixture. Local main is 16 commits behind origin/main and was not updated.
Parked PR19: 1ba360b123ded770f1554d59fbd21c86b9943427; PR24: 5bf70e4c4be07b706224debe01a27c54fd0af096; PR25: 67c504be6230f763663cf19faf50d9bc46dc6902. All verified OPEN; untouched.

## Finding-to-fix-to-test ledger

| Original finding | Fix retained | Demonstrated evidence / remaining gate |
|---|---|---|
| P1 original Student rows sent | New approved-field projection; independently bounded server envelope and field allowlist | Normal UI request capture excludes forbidden sentinel; forged-field and malformed-JSON tests pass |
| P2 source aliases/class-section | Versioned deterministic headings; duplicate targets block; explicit class+section pair mapping | Alias/conflict/text-ID tests pass; actual mapping rendered |
| P2 legacy template discovery | Legacy header-only CSV download; controlled XLSX link and explicit workflow | Actual menu rendered; controlled canonical package roundtrip passes |
| P2 generic marks template | Exact authorised legacy assessment/year/roster CSV | Source + focused tests; authenticated roster-template bytes PASS in hosted run 34700775013 |
| P2 governed import missing | Separate signed CSV/XLSX adapter through existing governed draft save | Blank/zero/states/max/precision tests pass; actual services, retries, concurrency, stale authority and readback PASS in hosted run 34700775013 |
| P2 disabled feedback | Server capabilities before confirmation, refresh on focus/interval, API gates | OFF controls demonstrated; production OFF HTTP PASS in hosted run 34700775013 |
| P2 focus/Escape | Existing native dialog with contained focus/Escape/focus return | Browser open, Tab, Escape, restored trigger pass |
| P2 stale onboarding bundle | New worker-only canonical package; reset eligibility/file/decisions; obsolete requests ignored | Actual XLSX worker, bundle change, same file again and local cancel pass; authority loss clears retained history |
| P2 mobile errors | Wrapped expandable row/field/reason with optional wide tables | 320/390/768/1440 light/dark layouts and expanded long Unicode errors do not overflow |
| P2 Student export ignores scope | Shared listing/filter semantics, selected-year enrollments and minimal eight columns | Query/history/invalid-filter tests pass; actual historical/empty/five-filter CSV bytes and Teacher/Parent/Viewer refusals PASS in hosted run 34700775013 |
| P3 misleading trial wording | Explicit batch/audit metadata wording | Rendered wording distinguishes local review, server preview, saved report and mutation |

Historical parent review is preserved: 43 probes, 42 passed/completed, one failed optional-contact expectation. This was component evidence, not E2E. Legacy missing father/phone remains WARNING; controlled Student father/phone and Guardian mobile remain BLOCKING. No dummy contacts or real source workbook used.

## Checkpoints and verification

- Projection checkpoint: cc764128ec56817f51663c7858c911755219417e.
- Separate marks checkpoint: 2af541af2a8b8b8d88cc93fa0bb883818ca6e239.
- Canonical onboarding/state/export checkpoint: 8cb1742d31ba7d21e4a8d5890b9fb869e86e3007.
- Final feature SHA and PR/CI are recorded by the retained Git history and final handoff. This document does not self-certify release.
- Focused final run: 7 files, 79 tests PASS. Includes unknown values, bounded streams, duplicate mappings, required-field differences, canonical ZIP byte stability across different clocks, independent marks states and enrollment scope.
- Full regression initial run: 244 files passed, 4 failed, 1 skipped; 2299 tests passed, 4 failed, 16 skipped. Recovery suite setup additionally failed because this worktree has no prisma/dev.db. The operational DB was not copied to satisfy it.
- Scoped source guard failure was fixed: capability uses read-only availability, and mutation guard remains after preview. Remaining shared failures: source-hash master audit and unclassified governed roster-template route. No shared test/manifest/register was weakened or overwritten.
- Full pinned typecheck completed PASS. Subsequent changed partitions (API, components, libraries, tools, affected tests) completed PASS; latest acceptance-script correction is checked with final CI.
- Independent read-only review found and resolved JSON echo, marks projection, enrollment status, onboarding race/history, class/section collapse, canonical ZIP timestamps, status-code assertions and teardown defects. It supports pushing for CI after the optimisticVersion fixture correction; it does not waive release gates.

## Browser evidence and privacy proof

The available Codex Browser tool exercised actual changed React components using scripts/bulk-data-exchange-browser.ts, an isolated loopback static harness on 47831 with no ERP/database. No Playwright fallback. Synthetic fetch replies establish component behavior only.

BULK_DATA_EXCHANGE_UX_1A-network.json contains sanitized actual requests (keys/action/boolean only). A forbidden sentinel in an excluded legacy column was absent from the preview body. A sentinel placed in controlled workbook ancillary instructions was absent from the rebuilt multipart XLSX contents. The harness captured that upload then refused it with 403; no mock success or ERP write was claimed. Legacy marks preview used the exact reconstructed CSV contract. No source values were retained in the capture.

Actual Browser probes: selected mapping; legacy warnings; disabled mutation; import-mode invalidation; controlled worker; changing bundle clears upload; same file reselect; local cancellation; 401/403 handling; modal open/focus/Tab containment/Escape/focus return; Student/marks/onboarding layouts at 320/390/768/1440 in light/dark; expanded long Unicode errors without horizontal overflow; no warning/error console entries during probes. Static harness stopped after capture.

## Formats and paths

- /import-export: Legacy Student CSV/safe XLSX local source review and mapping; legacy canonical CSV template; controlled source conversion creates a NEW Student/Enrollment XLSX package. Operator must complete real Guardian/link rows in the controlled template before authoritative onboarding validation.
- /onboarding: Controlled Student/Guardian, Staff and Combined XLSX; local safe parser reconstructs a canonical package before upload; server independently parses/rebuilds before private storage. Original ZIP content is never reused. No XLS/macros/formulas/external links/hidden sheets admitted.
- /marks: exact legacy nine-column CSV draft import and roster template.
- /marks/governed: separate governed v1 CSV/safe XLSX, signed assignment/scheme/roster/version context, existing 200-row draft-save limit. Import is not submission/moderation/publication. Signed template and preview expire after 15 minutes.
- /students: Export all results matching academic year, class, section, status and search; selected-year enrollment fields; private minimal CSV; invalid filters/over-limit exports refuse; empty results retain header.

## Runtime and platform boundaries

Authenticated synthetic E2E PASSED at source/acceptance head 62be2ebba4dad1e1144e35bf20da61c17e87d2af, hosted run 34700775013. Sanitized immutable results are in BULK_DATA_EXCHANGE_UX_1A-hosted.json. scripts/qa-ux-bulk-data-exchange-e2e.ts is guarded against local execution and requires GitHub-hosted runner, exact head, one absolute synthetic DB path and loopback networking. Observed assertions: production OFF, controlled upload/approval/execution and Student readback, metadata-only saved validation, Student legacy execution, legacy roster template and zero marks, governed draft retry and single-winner concurrent edit with version readback, changed-content/stale receipts, Teacher denial, delegated revocation/expiry/family conflict with unchanged marks/sheets and audit checks, actual historical/empty/all-five-filter CSV downloads, linked Parent/Viewer export denial, exam report download and disabled Principal session rejection. OFF retained 3 invented Students and zero marks/batches; ON ended with 5 invented Students, 1 legacy mark, 2 governed entries and 2 legacy import batches. Draft entries were not submitted, moderated, locked or published. Teardown verified TCP listener closed and every owned synthetic database/private-upload directory removed.

Responsive browser: demonstrated above. Installed Windows/WebView: UNEXECUTED. Android emulator: UNEXECUTED. iOS simulator: UNEXECUTED. Physical devices: UNEXECUTED. Native file-picker cancel/Back/safe-area/download, keyboard zoom/reduced-motion and disconnected/session-expiry native acceptance remain open. Existing Tauri/encrypted offline finance foundations unchanged. No local production ERP server, public tunnel, real-data write or operational flag activation.

## Shared register/governance repair authorised by the owner

Finance PR26 retains its implementation. After CI identified shared governance drift, the owner explicitly authorised this task to decide and apply the necessary repairs. Temporary ownership in this branch covers only config/master-requirements-register.json, tests/master-requirements-reconciliation.test.ts, tools/release-evidence/bulk-export-contracts.json and tests/bulk-export-governance.test.ts. No finance code or worktree was copied, edited or merged.

The register changes only four reviewed source digests and preserves all requirement statuses and finance claims. The released historical audit file is unchanged. A separate task-specific reviewed-source snapshot binds each authorised changed/new application file to its exact digest and original digest; all other source, schema, deployment and default-off flags still match the original audit. Next and Sharp dependency transitions are explicit. Export discovery remains active: 62 surfaces, 43 bulk, 19 non-bulk; both roster templates are bulk, and only the Student branch is mapped to bulk-exports. Governance metadata does not claim Student release clearance. Broader product-register proposals remain in BULK_DATA_EXCHANGE_UX_1A-register.patch.md for later serial integration.

## Release and tracker gates

No merge or tag authorised by the current evidence. Mandatory exact-head CI, SQLite/PostgreSQL/backup/security/native contracts and the independently recorded shared-runtime advisory conflict must resolve. Green feature runtime CI alone cannot clear those gates. Tracker updates append terminal results to implementation task 1218286239401466 and parent review 1218294223162480 without modifying finance task 1218283703395328 or completing physical acceptance. Canonical Notion/Canvs query/readback remains part of the final handoff.

### Historical failures before the owner-authorised CI repair — 12 September 2026

Dependency audit (`pnpm audit --audit-level high`) FAILED: two Critical, one High and two Moderate advisories in unchanged dependencies (Next.js, Sharp, Vitest/mocker). This initial failure preceded the owner-authorised dependency repairs below; no waiver or suppression was applied. This is additional to the retained shared-runtime OCI advisory conflict.

The existing onboarding public-artifact scanner FAILED at lib/onboarding-workbooks.ts because it scans the whole touched file and finds pre-existing generated-template example contact strings. The sole task edit there exports the existing Georgia cover-style helper. The failure is retained; the scanner was not weakened. All newly published fixture contents are invented and reviewed. No binary/source workbook or DB is staged.


### Terminal evidence — 12 September 2026

PR27: https://github.com/vsairohith67/nalanda-school-erp/pull/27. Retained source/acceptance head: 62be2ebba4dad1e1144e35bf20da61c17e87d2af. Subsequent evidence-only head and its exact checks are recorded on PR27 and in the handoff. Main remains 104aacc7bd314cae82e60bb02b5c8a965c7ffedd. Finance PR26 remains separate at d784262ccc78ae431a72a3934ced45198e4bfb4c.

Earlier hosted attempts remain failures: 34699378071 failed a UTF-8 build input, corrected before later successful builds; 34699518385 reached login503 with missing production limiter configuration; 34700216559 passed OFF and stopped at the synthetic expiry date constraint; 34700562973 completed 20 ON assertions then the protected last-Super-Admin constraint refused the final fixture step. Neither guard was weakened: the released complete rehearsal isolation contract was supplied, valid expiry dates were used and the final disabled-account probe targets the synthetic Principal. All runs retained verified teardown. These partial attempts are not relabelled passes.

Native/shared software checks: 22 ERP contracts, 6 app tests and 7 Rust tests PASS; app typecheck and web build PASS. Installed Windows/WebView, Android emulator, iOS simulator and physical devices remain UNEXECUTED. adb/emulator/xcrun/xcodebuild are unavailable on this Windows host. Browser keyboard zoom shortcuts had no measurable effect; reduced-motion emulation is not exposed by the available Browser API; file chooser empty selection is unsupported. These remain explicit gates, not passes. The latest actual-component harness additionally verified source/preview clear on component unmount/remount, no console warnings/errors, and a fresh allowlisted Student preview capture. Its own loopback listener was stopped.

Full regression omissions are explicit: 13 recovery tests skipped after missing-worktree-DB setup failure and 3 governed qpdf tests skipped. No operational DB was copied. The corrected marks-source guard and 53 focused import/flag/security-resilience assertions subsequently passed. Mandatory exact-head Real-User Access CI on 62be2eb failed the dependency/security gate; downstream full regression, backup/restore and shared-platform steps were skipped. PostgreSQL17 migrations/constraints/parity passed. Cross-provider CI is separately tracked on the PR; no unexecuted job is a pass.

Blockers at that earlier checkpoint were Critical/High dependency advisories, shared source/register and export-manifest reconciliation, public-artifact refusal, the separate shared-runtime OCI advisory conflict and remaining exact-head checks. The CI repair below supersedes the first three categories only after validation. No waiver, suppression, default change, merge, tag, deployment or operational activation. Physical/native acceptance is not closed by software evidence. Protected DB hash/size/mtime and absence of sidecars match; parked PR19/24/25, review worktree, schema and backup v45 remain unchanged.


### Consolidated CI repair — 12 September 2026

The owner requested repair of failing GitHub runs and explicitly authorised temporary shared governance ownership. Next is updated to 15.5.24 and Sharp to 0.35.4, including the global Sharp override so the nested Next dependency also uses the patched version. The high-severity dependency audit now passes; two Moderate Vitest/mocker findings remain disclosed. The package manager is pinned to the repository workflow version, pnpm 11.21.0. Migration QA no longer hands a native pnpm ELF/PE executable to Node as JavaScript; it selects an available JavaScript entry, including Unix Corepack. The new synthetic launcher regression and all nine clean-install/migration/v45 restore tests passed.

The public-artifact scanner now passes without rule changes: instruction-only example contacts are blank, the synthetic hosted acceptance script lives in the existing scripts/qa-*.ts fixture convention and an unnecessary numeric job identifier was removed from prose. Required contacts in actual entry rows remain required. The earlier scanner failure and historical contact probe remain recorded above.

Focused governance, template and launcher checks passed. Independent review verified the narrow repairs, immutable historical audit, exact source overlay, schema/flag preservation and both manifest corrections; no material finding remains in that review. Final-head full regression, build/runtime and mandatory hosted checks remain required. Existing older-head portable stack CI also reports object-bootstrap exit 1; the available job output does not establish the cause, and this is not relabelled a dependency failure or a pass. No parked portable implementation is copied to resolve it.

Primary patch evidence: https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36 ; https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4 ; https://github.com/lovell/sharp/security/advisories/GHSA-rgj7-g3m4-5g8c .


Consolidated local regression: 248 files passed, one recovery suite failed its missing isolated-worktree prisma/dev.db setup, one qpdf file skipped; 2306 tests passed and 16 skipped. All prior application/governance assertion failures are resolved. The recovery fixture limitation is not counted as a pass; the exact-head hosted workflow supplies its own synthetic database for that suite. The separately executed clean-install and v45 restore group passed all nine tests. Public-artifact scan passed on the complete 50-file feature diff. The protected operational database was independently rehashed again and remains exactly at the supplied baseline with no sidecars. Parked PRs and finance PR26 heads remain unchanged.

The consolidated full typecheck passed all 21 partitions. Git safety and public-artifact scans both pass using the unchanged scanner rules. The hosted synthetic script follows the existing scripts/qa-ux*.ts convention and remains included by the existing QA typecheck partition. Final hosted coordinates and terminal job results are recorded on PR27 and the tracker handoff, without claiming a release from an earlier head.


### Hosted repair verification and workspace-config scanner repair

Commit 17d738a3b973e2145b501e2eb99c82d168a34e5b passed authenticated production-OFF and synthetic-ON HTTP acceptance, including verified teardown, in https://github.com/vsairohith67/nalanda-school-erp/actions/runs/34703196588 . Its sanitized results are appended to the hosted evidence JSON; the earlier successful evidence remains intact. The portable OCI image/supply-chain, full stack, object-storage/recovery and distributed-runtime jobs also passed on that head. The historical object-bootstrap failure did not recur without any deployment edit; its original cause remains unproven. A green feature OCI scan does not adjudicate the separately retained shared-runtime advisory conflict.

Two broader workflows then exposed the same scope-catalogue omission: the Real-User Access and Communication public-source scanners did not recognise pnpm-workspace.yaml. The narrow repair recognises only this existing dependency configuration file; its contents still undergo all secret, contact, size and text checks. Actual scanner regressions in disposable synthetic Git repositories prove safe YAML is admitted, private-key content in that same file is rejected, and an unknown root YAML file remains rejected. All three launcher/scanner tests and all five local safety/public-artifact scans pass. Independent review found no bypass or material finding. No security pattern, severity threshold or unknown-file refusal was removed. These scanner repairs require fresh exact-head CI; they do not change application source or the accepted HTTP fixture.


### Final scanner-head acceptance and bounded Android CI repair

Head 2d40a7c7b14c2d3b857768dc208d7dcb0034abc1 passed all four production-OFF and 24 synthetic-ON HTTP assertions plus verified teardown in https://github.com/vsairohith67/nalanda-school-erp/actions/runs/34703700234 . Sanitized results are appended without replacing prior evidence. Exact-head Access and Master workflows passed their formerly failing public/security/focused gates and continued into full regression. All six portable jobs passed on application head17d738a in run34703199941. No failed historical run is relabelled.

The hosted cross-platform run34703702490 on2d40a7c passed TypeScript/contracts/bundled shell, unsigned Windows NSIS compilation and actual iPhone/iPad simulator boot/install/launch, light/dark screenshots, invalid callback and relaunch. These are existing offline shell foundations (NO_REMOTE_SERVER_CONFIGURED), not authenticated import/export file-picker or physical-device acceptance. Installed owner Windows/WebView and task-specific Android/iOS import/download tests remain open. This later CI evidence supplements the earlier local-tooling UNEXECUTED entries above.

Android compiled and installed its APK and reached the resumed Nalanda activity, then failed because a one-shot accessibility dump returned a null root and produced no XML. The narrow workflow repair waits for a fresh, nonempty hierarchy containing the expected package. Each attempt first deletes both prior remote/local XML, then uses individually bounded commands; a 120-second retry window plus the final bounded attempt ends in an explicit failure if no valid tree appears. Existing foreground, content, crash and artifact checks are preserved. Bash syntax validation and an execution of the exact block with synthetic ADB responses proved failed pull -> null root -> fresh third-attempt acceptance without reusing stale XML. This probe is CI-helper evidence only. Independent review found no remaining material issue after the per-attempt deletion correction. The next exact-head Android emulator run remains mandatory; no framework/product/IPC change or fake native pass is introduced.

Asana implementation and parent-review notes, the canonical Notion Completion Index and one task card on the existing Canvs board were updated and read back. Original review and finance records were preserved. Later final-head results remain linked through PR27; no physical acceptance or release was closed.

Ownership follow-up: read-only path inventories show parked PR24 and PR25 also touch the two public-scanner files. This task independently added only the exact pnpm-workspace.yaml scope entry from released main; no parked implementation was read/copied or integrated. Preserve both parked heads and deliberately reconcile those scanner edits during their later owner-controlled integration. The Android workflow repair has no matching path collision with PR19/24/25 or finance PR26.
