# Report-Card Template Gap and Print Acceptance

**Requirement:** `V1-EXAM-RC-TEMPLATE-001`

**Status:** V1 narrowed to Classes I-X; correction list remains open; physical colour/monochrome/photocopy gate is paused

The 2026-08-12 scope amendment preserves KG implementation but moves LKG/UKG operational activation and physical acceptance to V1.5 as `IMPLEMENTED_FOUNDATION_DEFERRED_TO_V1_5`. Classes I-X remain V1 with status `IN_PROGRESS_PHYSICAL_ACCEPTANCE_PENDING`. R4.2 packs are `SUPERSEDED_PENDING_CLASSES_I_X_CORRECTIONS` and must not be printed. See `docs/REPORT_CARD_V1_SCOPE_AMENDMENT.md`.

## Closed digital gaps

- Five canonical families replace the earlier four-family approximation for new bindings.
- KG has a fixed ten-page ordinary-A4 canonical sequence.
- Classes I-II and III-V are separate versioned families.
- Classes VI-VIII and IX-X have separate grouped-subject families.
- CT, Session, Revision, Preboard, and Combined capability are explicit variants where supported.
- School identity, Parent/Guardian mode, signature labels, chart visibility, and combined capability are frozen configuration.
- Output is exact A4 at 100%; unused fields are dynamically omitted and internal IDs are never printed.
- Monochrome charts use shape/pattern plus direct numeric labels.
- Synthetic coverage includes all required states and print stress cases.

## Remaining gates

1. Receive the user's complete Classes I-X correction list and explicit register confirmation.
2. Apply the bounded R5 corrections without redesigning the approved family.
3. Generate a replacement pack containing only genuinely distinct Classes I-X colour and true-monochrome layouts.
4. Print every distinct Classes I-X specimen and photocopy one approved monochrome page.
5. Record printer, scale, clipping, readability, alignment, logo, chart, signature space, reference readability, page order, and pass/fail.
6. Correct and reprint only failed Classes I-X structures.
7. After independent digital and physical acceptance, run final release gates before any authorised merge/tag.

## Physical acceptance rule

A specimen passes only if all content remains within the printable area; the smallest text is comfortably readable; rules remain visible; dark areas do not merge; colour is balanced; monochrome series and the photocopy remain distinguishable; chart labels do not collide; signature areas remain usable; no page is unintentionally scaled, cropped, reordered, or blank; the logo and school name are sharp; and all data is unmistakably synthetic.

Passing automated renderer tests alone is not physical acceptance.
