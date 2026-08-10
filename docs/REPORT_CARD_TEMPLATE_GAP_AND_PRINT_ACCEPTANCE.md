# Report-Card Template Gap and Print Acceptance

**Requirement:** `V1-EXAM-RC-TEMPLATE-001`

**Status:** digital calibration in progress; physical colour/monochrome/photocopy gate remains mandatory

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

1. Complete sequential full tests/build/backup/Git safety and Browser QA on a copied synthetic database.
2. Push the feature branch without merge or tag.
3. Print every distinct colour and monochrome specimen, both full KG booklets, and one photocopy of a monochrome page.
4. Record printer, scale, clipping, readability, alignment, logo, chart, signature space, reference readability, page order, and pass/fail.
5. Correct and reprint only failed structures.
6. After independent digital and physical acceptance, fast-forward main and create the governed acceptance tag.

## Physical acceptance rule

A specimen passes only if all content remains within the printable area; the smallest text is comfortably readable; rules remain visible; dark areas do not merge; colour is balanced; monochrome series and the photocopy remain distinguishable; chart labels do not collide; signature areas remain usable; no page is unintentionally scaled, cropped, reordered, or blank; the logo and school name are sharp; and all data is unmistakably synthetic.

Passing automated renderer tests alone is not physical acceptance.
