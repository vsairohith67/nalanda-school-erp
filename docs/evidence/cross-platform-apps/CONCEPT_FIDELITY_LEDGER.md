# Concept-to-implementation fidelity ledger

Compared 2026-08-26 using the accepted desktop concept and rendered screenshots at 1280×820 and 390×844.

| Reference point | Rendered evidence | Decision |
|---|---|---|
| Official Nalanda emblem, school name and institutional navy | Exact repository logo appears in the desktop sidebar and lock screen; navy shell retained | matched |
| Teal navigation accent and amber caution/status treatment | Teal active rail/buttons, teal/amber summary tiles and amber offline/draft warning | matched |
| Three cleared finance draft workflows | Fee payment, expense draft and miscellaneous income are the only select options; no broader ERP mutation appears | matched |
| Explicit local/offline/sync/conflict meaning | Unconfigured/offline banner, local-only badge, accepted/ready/retry/conflict text and “not a receipt” warning | matched with safer copy |
| Dense desktop workspace with responsive mobile reduction | Desktop uses navigation rail, summary row, form and queue; mobile collapses to stacked cards and a five-action bottom rail | matched and adapted |

## Intentional differences

- The concept’s “Device approved” and “Sync now” example is not rendered in the committed build. The implementation truthfully shows `No remote server is configured` because activation and real device approval are out of scope.
- The concept’s separate workflow tiles and history table became one bounded form plus a live queue. This gives users a verifiable action and keeps every result beside the originating draft.
- The concept’s “changes will sync when online” language became “sync only after server permission, device and business-rule checks.” This prevents implying automatic or unconditional posting.
- Desktop retains the concept’s rail, while mobile uses a fixed five-action bottom rail. Browser QA found manual lock was missing from the first mobile pass; the final rail adds `Lock` and the follow-up screenshot proves the lock screen.
- Browser preview says `Preview`; installed builds use Stronghold and ciphertext restoration. Preview mode never claims native encryption is active.

## Evidence

- `concepts/desktop-offline-workspace.png`
- `concepts/mobile-fee-draft.png`
- `concepts/app-lock.png`
- `browser-desktop-before.png`
- `browser-desktop-workspace.png`
- `browser-mobile-workspace.png`
- `browser-mobile-lock.png`
