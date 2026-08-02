# Prompt 23E Browser Checkpoint 3 — Teacher and Multi-Role Context

Date: 2026-08-02

Environment: copied database, rebuilt production runtime, short isolated batch.

Teacher QA passed at exact 390 x 844 and 1366 x 768 in dark and light. Teacher context showed the assigned A event, Staff event, school-wide changed event and current A examination reference; B and leadership remained absent. Teacher print preserved that exact projection.

The Teacher + Parent account switched into Parent context before selecting child B. Parent context hid Staff/A/leadership and showed B only. Re-entering Teacher context dropped the child identity and restored A/Staff without B. A child URL captured from a different session could not reveal its former A scope and safely resolved only the current authorised context. Controls were at least 44 px, with no overflow, native dialog, console/hydration error, warning or production stderr.

The Browser viewport override was reset, tabs were finalized, the runtime was stopped and the copied fixture was destroyed. Cleanup was inspected twice: no CAL23E path/artifact or port listener remained.

