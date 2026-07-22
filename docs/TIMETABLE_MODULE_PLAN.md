# Timetable Module Plan

## Current scope

The Timetable module now has four completed layers:

1. foundation data for teachers, subjects, class sections, period templates, workload assignments, teacher unavailability, and fixed periods;
2. a manual timetable builder with saved drafts, workload progress, class and teacher previews, and live conflict checking;
3. a deterministic automatic generator that previews a safe new draft before saving it; and
4. the completed Prompt 7D class-wise and teacher-wise print views, workload/free-period summaries, and CSV export.

## Data required before generation

Complete and review the following before opening **Timetable -> Automatic Generator**:

1. active teachers with realistic weekly and daily period limits;
2. active subjects, including whether consecutive periods are allowed;
3. active class sections with the correct group: LKG, UKG, I-V, or VI-X;
4. workload assignments connecting each class, subject, teacher, and required periods per week;
5. teaching-period templates, including the Friday half-day template;
6. teacher unavailable periods; and
7. fixed periods that must be reserved or placed first.

Use the foundation warnings and the manual builder to correct impossible or incomplete data before expecting a complete generated timetable.

## How automatic generation works

1. Select the academic year and generation scope: all active class sections, one class section, or one class group.
2. Optionally select an existing draft as a base.
3. Locked base entries are always preserved. Unlocked manual entries are copied only when **Copy manual unlocked entries** is selected.
4. When **Apply fixed periods first** is selected, valid fixed periods are added as locked entries before automatic placement. When it is cleared, their cells are reserved and left for manual application.
5. Assignments are ordered deterministically using required weekly periods, teacher availability, configured priority, and a stable assignment identifier.
6. Each required assignment unit is scored against available teaching slots.
7. The highest-scoring conflict-free slot is chosen. The score prefers different subject days, avoids consecutive use when not allowed, balances class days, and reduces teacher daily or weekly overload.
8. The existing draft validator checks the complete preview for errors, warnings, workload underfill or overfill, teacher overload, consecutive-subject warnings, and empty teaching periods.

The same unchanged inputs produce the same placement order. The generated name uses `Generated Timetable - YYYY-MM-DD HH:mm`.

## Safety and draft behavior

- Preview generation happens in memory. It does not create database records.
- **Save Generated Draft** creates a new normal `TimetableDraft` with status `DRAFT`.
- The generator never updates or replaces the selected base draft.
- It never marks a generated draft `ACTIVE`.
- If a generated name already exists for the academic year, a numeric suffix is added.
- Locked entries and configured fixed slots are never overwritten by generated teaching periods.
- Generated teaching entries remain editable in the manual builder.

Use **Make Active later** only after manual review.

## Hard constraints

The generator does not intentionally place an entry when:

- the class already has an entry in that day and period;
- the teacher is already teaching another class in that day and period;
- the teacher is unavailable;
- the teacher, subject, or class section is inactive;
- the assignment does not belong to the selected class section;
- the slot is not a teaching period for that class group;
- the slot is outside the Friday half-day template; or
- the slot is locked, fixed, or otherwise reserved.

Conflicting data already present in a selected base draft is preserved only when it is locked. It is reported by validation, and the generator avoids adding another conflict around it.

## Soft constraints

Where a perfect result is not possible, the generator tries to:

- avoid consecutive periods for the same subject unless allowed;
- spread a subject across different days;
- keep teacher daily load low and within `maxPeriodsPerDay`;
- keep teacher weekly load within `maxPeriodsPerWeek`;
- balance the number of class periods across days; and
- fill remaining teaching periods while required assignment workload remains.

These are preferences rather than promises. The result summary and validator show where a preference could not be satisfied.

## Why unresolved periods happen

An assignment remains unresolved when no hard-conflict-free slot is available. Common causes are:

- the teacher is unavailable in every remaining class slot;
- the teacher is already assigned to another class in every remaining slot;
- all teaching periods for the class are occupied by locked, fixed, or copied manual entries;
- the class has too few teaching periods for its total workload;
- a required teacher or subject is inactive; or
- the class has no teaching-period template.

The **Unresolved Periods** table shows the class section, subject, teacher, remaining count, and the most specific reason available.

## How to fix unresolved periods

1. Correct inactive or missing master data.
2. Reduce or redistribute unrealistic assignment workload.
3. Review teacher unavailable periods and daily or weekly limits.
4. Move or unlock a manual base entry when appropriate.
5. Correct conflicting fixed periods.
6. Add valid teaching capacity to the correct class-group template.
7. Regenerate a preview.
8. Save the best draft and finish exceptional placements in the manual builder.

## Manual builder after generation

Open **Timetable -> Manual Builder** after saving. Select the generated DRAFT, then:

- review each class timetable;
- inspect teacher previews;
- resolve errors before warnings;
- place unresolved periods manually;
- check workload completion;
- adjust optional soft-preference issues; and
- mark the draft ACTIVE only after school approval.

The generator is an assistant, not magic. School events, teacher preferences, room limits, unusual double periods, and local operational judgment still require manual review.

## How to print a class-wise timetable

1. Open **Timetable -> Print & Export**.
2. Select the academic year.
3. Select the approved draft. The ACTIVE draft is selected automatically when one exists.
4. Choose **All class-wise timetables** or **One class timetable**.
5. For one class, select the class section.
6. Select **Open Print View**, review the white print preview, and select **Print**.

Each class document includes the school name, academic year, draft name and status, class and section, Monday-to-Saturday grid, period labels and timings, subject, teacher short name, fixed/activity/free labels, non-teaching schedule labels such as Diary Period, and print date.

## How to print a teacher-wise timetable

1. Open **Timetable -> Print & Export**.
2. Select the academic year and draft.
3. Choose **All teacher-wise timetables** or **One teacher timetable**.
4. For one teacher, select the teacher.
5. Select **Open Print View**, review the weekly grid, and select **Print**.

Each teacher document includes the teacher name, department, class and section, subject, visible free periods, total weekly periods, day-wise load, draft status, and print date.

## How to export CSV

After selecting a draft, use:

- **Export Class Timetable CSV**
- **Export Teacher Timetable CSV**
- **Export Workload CSV**
- **Export Free Period CSV**

Class and teacher exports use one row per timetable period so the file can be filtered, sorted, or opened in Excel. When the current view is one class or one teacher, that matching export is limited to the selected record. Browser print is the supported PDF path for now.

## Workload Summary

Choose **Workload summary** to compare each active teacher's configured `maxPeriodsPerWeek` with the assigned periods in the selected draft. The table shows remaining capacity, Monday-to-Saturday load, and an overload warning when assigned periods exceed the configured maximum.

Use this before marking a draft ACTIVE and again after manual substitutions or fixed-period changes.

## Free Period Summary

Choose **Free-period summary** to see each active teacher's free configured teaching periods by day and total weekly free periods. This view is intended for substitution planning.

Free periods are calculated from the academic year's configured class-group teaching-period templates. Closed and non-teaching periods are not counted as free teaching capacity.

## Recommended timetable workflow

1. Add teachers.
2. Add subjects.
3. Add class sections.
4. Add assignments.
5. Add unavailable and fixed periods.
6. Generate a draft.
7. Review the draft in the manual builder.
8. Fix conflicts manually.
9. Mark the approved draft ACTIVE.
10. Print and export the class, teacher, workload, and free-period views.

## Principal Quick Guide

- Treat the ACTIVE badge as the approved operational timetable for that academic year.
- Print one class first and one teacher first to spot-check names, timings, Friday periods, and fixed activities.
- Review **Workload Summary** for overloads before publishing.
- Keep **Free Period Summary** available for substitution planning.
- Use CSV exports when office staff need sorting or spreadsheet analysis.
- If no draft is ACTIVE, the print center shows a warning. Select a draft deliberately; do not treat an unreviewed generated DRAFT as approved.
- After timetable changes, take a fresh full backup. Drafts and entries are included in backup version 4.

## Backup and restore

Full backup version 4 already includes `timetableDrafts` and `timetableEntries`, so saved generated drafts and their entries are covered automatically. Restore maps entries to restored or existing class sections, teachers, subjects, assignments, and drafts. Entries with unsafe missing mappings are skipped with warnings. Older backups without draft arrays remain valid.

## Prompt 7D limitations

- Browser print is used instead of server-generated PDF.
- CSV is the supported spreadsheet export. XLSX is not required for the operational workflow.
- Free periods are based on configured teaching templates and do not model rooms, substitute eligibility, or leave records.
- Print/export does not change the selected draft or generator placement behavior.
