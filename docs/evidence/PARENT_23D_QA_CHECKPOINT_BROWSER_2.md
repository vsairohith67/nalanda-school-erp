# Prompt 23D-QA Browser Checkpoint 2

Date: 2026-08-02
Runtime: copied `PARENT23DQA` production database, port 3219
Accounts: multi-child Parent and Teacher + Parent fixtures

## Multi-child Parent

- The governed linked-child selector has an explicit accessible name and exactly the two authorised children.
- Desktop actions remain within the 1366x768 viewport; all selector controls are at least 44px.
- Selecting the first child refreshed attendance to Aarav only with five official fixture records.
- Selecting the second child refreshed attendance to Diya only with the authoritative no-record state.
- Diya's exact cohort showed no current published timetable and disclosed no Aarav identity.
- Mobile 390x844 dark-theme selector remained labelled, keyboard-operable, 44px, and free of page-level overflow.
- Child switches produced an accessible live status message.

## Multi-role and session enforcement

- Teacher + Parent signed in to Teacher context and a direct Parent attendance URL redirected to a safe access-restricted page.
- Teacher context rendered no Parent navigation, linked-child selector, Student identity, or attendance data.
- Switching to Parent context removed Teacher navigation and did not carry a linked-child selection across the role boundary.
- Explicit child selection in Parent context restored only that linked child's official attendance.
- Switching back to Teacher from the still-open Parent attendance page refreshed it to access-restricted state with no Student data.
- Logout followed by a direct Parent URL redirected to login and disclosed no Student data.

## Runtime evidence

- Exact viewports used: 1366x768 and 390x844.
- Page-level overflow: zero.
- Browser console warnings/errors: zero.
- Native dialogs: zero.
- Clean production stderr: zero bytes.
- The copied runtime was stopped after the batch; no operational database mutation occurred.
