# Classes I-X Report-Card Print Acceptance and Release Closure

**Prompt:** `REPORT-PRINT-ACCEPT-1A-P2`  
**Date:** 2026-08-14  
**Result:** `REPORT_PRINT_ACCEPTANCE_CLEARED`  
**Scope:** Classes I-X V1 only; KG/LKG/UKG remains `IMPLEMENTED_FOUNDATION_DEFERRED_TO_V1_5`

## Physical evidence received

The user completed the full R8 synthetic colour and true-monochrome print test and reported, in normal language, that all items were acceptable and that no correction was required.

| Evidence field | Recorded observation |
| --- | --- |
| Printer/model | Canon imageCLASS MF244dw |
| Paper | A4 |
| Scale | Not separately stated; the user reported the governed test completed successfully with no scaling or cropping defect |
| Colour mode | Not separately stated; the complete colour pack was accepted |
| Monochrome mode | Not separately stated; the complete monochrome pack and its three chart treatments were accepted |
| Printer-enforced scaling | None reported |
| Cropping and white page background | Accepted; no failed page reported |
| Text, marks tables, columns and borders | Accepted as readable and aligned |
| Chart values and colour balance | Accepted; no merging or readability defect reported |
| Monochrome pattern distinction | Accepted in the native monochrome pack |
| Logo and school-name sharpness | Accepted |
| Signature usability | Accepted |
| Page order and blank pages | Accepted; no blank or misordered page reported |
| Photocopy | The required dense monochrome specimen was photocopied once and accepted; its text and all three chart series remained distinguishable |
| Failed specimen/page | None |
| Photographs or scans retained | None |

The blank detail fields are not supplemented with invented driver settings. The user's explicit overall pass covers the required acceptance observations and is sufficient under the normal-language gate.

## Final technical verification

- The existing feature branch was clean, synchronized and based on the approved R8 renderer. No renderer or application source changed after R8.
- `main` had not advanced unexpectedly before the governed fast-forward release.
- The private repository, exact zero-business/four-protected-account baseline and byte-identical operational database were reverified.
- The operational database SHA-256 remained `65F47EFA37DA321023439303770645F8D656F2BE58458C1A03B341408EF9A6FA` at 8,409,088 bytes.
- All 18 migrations were applied and the Prisma migration state was current.
- Focused report-card regression, TypeScript validation, backup version 41 and Git safety passed sequentially.
- No real report was published or issued. No KG template was activated. No generated/source report PDF or ZIP was tracked.
- Cleanup was inspected twice and found no report-card QA residue requiring removal.

## Approved family and release boundary

The V1 Classes I-X family is frozen as:

- `NALANDA_LEGACY_REFINED_COLOUR`
- `NALANDA_LEGACY_REFINED_MONOCHROME`

The approved physical conditions are A4 office paper, Actual Size / 100% governed instructions, single-sided initial acceptance, and native colour plus native B/W/grayscale output. Canon imageCLASS MF244dw physical output and the required one-generation dense monochrome photocopy were accepted.

The release is local/private source control only. No deployment, public exposure, real Student data, real report issuance or KG operational activation occurred. The next governed phase is `V1-FINAL-1A`.

