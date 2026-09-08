# BULK-DATA-EXCHANGE-UX-1A

Status: IMPLEMENTATION_IN_PROGRESS. No release or operational clearance.

Base: origin/main 104aacc7bd314cae82e60bb02b5c8a965c7ffedd; tree 2c7f1a129e6b98abb9689abf7c989b0ed8468561; backup v45.
Dedicated retained worktree: bulk-data-exchange-ux-1a; branch feature/bulk-data-exchange-ux-1a.

## Ownership before writing

This task: Student import projection and panels; marks CSV adapters, existing import routes and narrow governed sheet-route additions; Student list/export filter helper; task-specific tests/evidence. Finance owns concession/item/payment logic, schema, backup, permissions/flag infrastructure, shared registers and shared release contracts. These dependencies remain read-only. Status-only inspection identified no existing finance edit in the Student export dispatcher. Its change is Student-only. Serial integration is required for shared register/release contracts; no foreign implementation copied.

Protected operational DB: C:/Users/rohit/Documents/school software/prisma/dev.db; SHA256 65F47EFA37DA321023439303770645F8D656F2BE58458C1A03B341408EF9A6FA; size 8409088; no sidecars at baseline. Never used as fixture. Local main is 16 commits behind origin/main and was not updated.
Parked PR19: 1ba360b123ded770f1554d59fbd21c86b9943427; PR24: 5bf70e4c4be07b706224debe01a27c54fd0af096; PR25: 67c504be6230f763663cf19faf50d9bc46dc6902. All verified OPEN; untouched.

## Finding ledger

| Finding | Implementation | Evidence / gate |
|---|---|---|
| P1 original legacy Student rows leave browser | New allowlisted object; strict bounded server envelope/row validation; raw Student error metadata removed | Sentinel unit test PASS; actual UI network capture pending |
| P2 source aliases / class-section | Versioned exact header suggestions, explicit duplicate-target resolution and reference selection | Focused tests PASS; Browser pending |
| P2 legacy template discovery | Header-only legacy CSV template; controlled XLSX path linked | Browser download pending |
| P2 generic legacy marks template | Authorised assessment/year-specific roster CSV | Focused API/runtime pending |
| P2 governed CSV absent | Narrow signed-context adapter through existing draft service; 200-row existing limit | Focused/runtime pending |
| P2 disabled import feedback | Server-owned capabilities; periodic refresh and boundary checks | Browser/ON-OFF runtime pending |
| P2 focus/Escape | Native modal dialog with focus restoration and busy-state semantics | Browser pending |
| P2 stale onboarding bundle eligibility | File/batch/approval reset; late-response epoch; decision edits require revalidation | Browser pending |
| P2 mobile errors | Wrapped expandable row issue summaries, optional tables | Browser pending |
| P2 Student export scope | Shared list/export filters and historical enrollment projection, header-only zero result | Actual CSV checks pending |
| P3 misleading trial wording | Explicit batch/audit metadata wording | Component changed; Browser pending |

Historical review remains 43 probes, 42 passed/completed and one failed optional-contact expectation. It was not E2E. New tests confirm legacy omissions WARN, controlled omissions BLOCK. Names and admission text are preserved. No real source workbook opened.

## Checkpoint evidence

First focused run: 68 passed / 2 failed (new contact assertion used inaccurate legacy issue labels; existing source-markup dialog test did not follow extracted component). Corrected assertions, unchanged policy. Rerun: 5 files / 70 tests passed. Component and library TypeScript partitions passed before later review fixes; final rerun required.

Independent source review identified malformed JSON error echo, marks pre-upload column admission, historical status mapping, stale onboarding decisions, and local session cleanup. Fixes applied; final review/readback pending. Initial fresh-sheet version concern was withdrawn after tracing existing synthesized row versions.

## Platforms and runtime

Responsive Browser: pending. Windows/WebView, Android emulator, iOS simulator, physical devices: UNEXECUTED. Shared native foundations unchanged. Authenticated application E2E: UNEXECUTED; only EPHEMERAL_EXACT_HEAD_CI_ONLY may host full-stack execution. No local production server, public tunnel, operational flag activation or real-data write authorised.

## Proposed register patch (pending serial integration)

Record reviewed-field Student exchange, separate governed draft CSV adapter, filter-scoped historical Student exports, truthful validation metadata and modal/error improvements only after terminal evidence. Keep runtime/device and release-security gates open. Do not overwrite finance register updates.

## Release gates

Exact-head full regression/build/security, admitted authenticated synthetic E2E, affected native checks and separately recorded shared-runtime advisory conflict remain mandatory. No merge/tag before all applicable gates resolve. Controlled source-format conversion to a new canonical package is currently not implemented; canonical controlled template upload remains the supported controlled path. No schema change proposed.
