# Prompt 23D-QA Browser Checkpoint 1

Date: 2026-08-02
Runtime: copied `PARENT23DQA` production database, port 3219
Account: one-child Parent fixture

## Passed checks

- Exact desktop viewport: 1366x768.
- Exact mobile viewport: 390x844.
- Light and dark themes.
- Attendance shows the five approved fixture states with counts of one each and five official recorded days.
- The empty month states zero official days and explicitly distinguishes no record from absent or non-working.
- No inferred attendance percentage or working-day formula.
- Current published replacement timetable shows only two exact-cohort papers, reporting times, venue, bounded Parent instructions, publication time, and updated status.
- Attendance and timetable print routes remain authenticated and linked-child scoped.
- No unrelated Student, Teacher-private note, internal Principal note, draft remark, marks, moderation data, raw database identifier, or internal version value was rendered.
- No page-level horizontal overflow at either viewport; mobile timetable tables fit their containers.
- All visible actions measured at least 44px in both viewports.
- Keyboard focus used `:focus-visible` with a two-pixel solid outline.
- Mobile navigation opened with an accessible labelled button and closed with Escape.
- Successful Parent pages produced zero console warnings/errors and no native dialog.

## Defect found and corrected

A tampered opaque linked-child handle correctly disclosed no Student identity, but the authenticated print route rendered through the framework error boundary and emitted a production console error. Both Parent print routes now catch only `ParentAcademicAccessError` and render a generic authenticated denial with no Student information; unexpected errors continue to propagate.

The copied runtime was stopped before the correction. No operational database mutation occurred.

## Multi-child accessibility correction

The next copied-runtime attempt exposed invalid shared IAM control structure: each role/child `<select>` and its action button were nested inside one `<label>`, and a fixed context-switcher width exceeded the account popover. The controls now use explicit `htmlFor`/`id` label associations, separate action-button structure, bounded `min-width: 0`, and a context switcher that fits its popover. The runtime was stopped before this shared correction and the full multi-child/multi-role batch will be rerun from a clean production build.
