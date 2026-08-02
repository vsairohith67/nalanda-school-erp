# Prompt 23D-QA Browser Checkpoint 3

Date: 2026-08-02
Runtime: copied `PARENT23DQA` production database, port 3219
Account: Principal fixture

## Principal governance workflow

- Opened exact-cohort timetable version 3 as a two-paper draft with Parent preview and append-only history.
- Cleared a required end time and proved Save Draft was refused with the safe row-specific validation error.
- Reload restored the last persisted valid draft; no invalid mutation was saved.
- Mark Ready used a labelled modal dialog and changed Draft to Ready For Publication.
- Publish Timetable required a bounded publication reason; because the draft replaced an earlier version, it also required a bounded replacement reason.
- Replacement publication succeeded transactionally and rendered Published state plus Create Replacement and Withdraw actions.
- Version history preserved clone, draft-save, ready, and replacement-publication events with actor, status transition, timestamp, and governed replacement reason.
- Parent preview continued to show only the exact two subject papers, dates, times, reporting times, venue, and bounded Parent instructions.

## Responsive and accessibility evidence

- Exact desktop viewport: 1366x768.
- Exact mobile viewport: 390x844.
- Light and dark themes.
- Page-level overflow: zero.
- Wide preview/history tables remained inside explicit horizontally scrollable containers on mobile.
- All visible actions and dialog controls measured at least 44px.
- The mobile Withdraw dialog stayed within the viewport, used `role=dialog`, `aria-modal=true`, and a labelled title; it was cancelled without mutation.
- Native dialogs: zero.
- Browser console warnings/errors: zero.
- Clean production stderr: zero bytes.

The copied runtime was stopped and Browser QA was finalized. No operational database mutation occurred.
