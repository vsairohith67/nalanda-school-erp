# Bounded task delta — source closure 2A

**LOCAL / UNMERGED.** Baseline `2aa461b7e0388db6b79afe1e4421a5dc1d9e8dda`, tree `16004fe31ae0ad8a21dcf861430859250fc1be27`. This is a delta from the owner's `NPS_25_Task_Status_2026-10-02.md` and [existing feature reconciliation](../overnight-parallel-1a/FEATURE_COMPLETION.md), not a new requirements register or completion percentage. Exact local commits and final review/check results belong to [HANDOFF](HANDOFF.md).

| Owner task scope | Added or clarified tonight | Status that remains |
| --- | --- | --- |
| Recovery / portable qualification | Coordinator's bounded source work reuses the existing rootless command machinery and records the missing authenticated pre-build qualification contract. Lane A remains PARTIAL; see HANDOFF for its exact manifest and tests. | Product NOT_BUILT; runtime/admission NOT_EXECUTED; two current policy-failed base jobs remain failures, seven held skips remain skips; no new CI. |
| Certificate / mobile usability | One demonstrated acceptance gap corrected in the existing certificate/request action components: selecting a different id with an identical status/update timestamp now invalidates the old confirmation dialog and reason. Two executable dependency-aware hook-emulation regressions cover both components. | Component contract evidence only; integrated rendered/modal/native/device and release acceptance remain open. |
| Bulk import/export | Existing implemented projection, receipt/context binding, controlled-contact blocking, legacy warnings and governed marks paths were inspected. No importer code changed and no second defect was manufactured. Three existing import-action-state tests passed unchanged. | Those helper tests do not establish actual file-change cancellation, browser focus, native file-picker or physical acceptance. No blanket new import-acceptance claim. |
| Staging, web-stack ownership and operational tasks | Seven live task records plus canonical Notion page/discussion read; five consolidated owner decisions in [MORNING_DECISIONS](MORNING_DECISIONS.md), including explicit legacy-provider conflict and pre-build policy contract gap. | All seven remain incomplete; no provider/owner/budget selection, environment activation, live onboarding, actual training/pilot or cutover. |
| Other owner-selected tasks | Existing implementation and deferred/vendor/permission boundaries reused. Payroll/ESS is historically technically cleared; LKG/UKG foundation and training materials already exist. | All 25 selected tasks remain incomplete until their own criteria are satisfied. No PR29/PR30, commercial/media/social/AI or optional transport/cafeteria work started. |

## Lane B evidence and finite scope

Requirement basis: existing `RELEASE_RECOVERY_1C.md` CB7 requires cancellation/error/stale-state closure; its earlier correction already handles authoritative status/version changes. `CertificateRequestActions` is reused at the same position in `certificate-graduation-workspace.tsx` when the selected request changes. React can retain its local state when two records share status and update time. The previous dependency list omitted record identity in both action components.

`tests/portable-certificate-modal.test.ts` previously had four executable markup/effect contracts covering visible modal errors, cancelled/reasonless action availability, authoritative request-state reset and cancelled Graduation print output. They are retained. Existing `portable-certificate-browser.test.ts` also exercises modal focus/Tab/Escape/no-effect readback using a simulated Page; this is recognized as existing orchestration coverage, not rerun or relabelled rendered-browser proof.

The new regression compares actual effect dependencies using React's `Object.is` rule. Its unchanged-identity control preserves the draft; changing only the id must clear both dialog and reason. Before the correction, the targeted file exited 1 with precisely the two new cases failed and all four originals passed. After adding `id` to the two existing effect dependency lists, the same modal tests and existing import helper tests exited 0: **9 PASS / 0 FAIL / 0 SKIP**, Vitest 4.1.11 / Node 24.19.0, one worker. The first corrected pass took 1.58 seconds inside Vitest (2.51 seconds observed process wall). A final rerun after refining the synthetic certificate status to the actually cancellable ISSUED state again passed all nine cases: 5.01 seconds inside Vitest (8.37 seconds process wall). No framework, package, database, ERP launch, login, file-picker, browser security setting, business rule, permission or server concurrency authority changed.

Commands executed from the independent owned worktree:

```text
node node_modules/vitest/vitest.mjs run tests/portable-certificate-modal.test.ts --maxWorkers=1
# Expected regression demonstration: 2 failed, 4 passed, exit 1 before correction.
node node_modules/vitest/vitest.mjs run tests/portable-certificate-modal.test.ts tests/import-action-state.test.ts --maxWorkers=1
# After correction: 9 passed, exit 0.
```

`tsconfig.components.json` passed separately (exit 0). The initial `tsconfig.tests-m-r.json` check failed in the physically copied root-only dependency environment: missing `@tauri-apps/api/core` and `@tauri-apps/plugin-stronghold`, plus a resulting implicit-any diagnostic in the native offline adapter. These are retained environment/validation gaps; no unrelated source or compiler-policy workaround was made. Final validation and independent reviewer findings are recorded in HANDOFF. No model switch is claimed; specialist used the available inherited worker, without independent underlying-model attestation. The coordinator alone stages/commits and updates external records; this specialist performed no external mutation. External synchronization is only established by the coordinator's actual written-content readbacks.
