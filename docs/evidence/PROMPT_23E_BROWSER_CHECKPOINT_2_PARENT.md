# Prompt 23E Browser Checkpoint 2 — Parent

Date: 2026-08-02

Environment: copied database, rebuilt production runtime, short isolated batch.

Parent QA passed at exact 390 x 844 and 1366 x 768 in light and dark. The active child A view showed school-wide/changed events, exact section-A activity, approved operational days and current published examination timetable v2. It did not show section B, Staff, leadership, marks or moderation content. Authenticated print retained the same scope.

Switching to child B immediately removed A and its examination reference, exposed only B cohort content, and continued to hide Staff/leadership. Month view used seven scoped column headers. Every visible action was at least 44 px, there was no page overflow, native dialog, console/hydration error, warning or production stderr. The runtime was stopped after the batch.

