# Report-Card R8 Digital Approval and Physical Print Gate

**Status:** `R8_DIGITAL_DESIGN_APPROVED`

**Scope:** Classes I-X V1 only; KG/LKG/UKG remains preserved/default-off and deferred to V1.5

**Approval:** The user's normal-language statement, “I am satisfied and we can proceed,” is accepted as final R8 digital approval.

## Approved digital contract

- The source-locked Classes I-X visual architecture, frozen calculations and displayed-value invariants are approved.
- Colour and true-monochrome rendering are approved for physical acceptance testing.
- Future minor visual changes must use governed, versioned template maintenance; R1-R8 history remains preserved.
- No real report has been issued or published. Physical colour, monochrome and photocopy acceptance remains pending.

## Verified checkpoint

- Existing branch: `reporting/canonical-template-print-acceptance`.
- R8 feature commit: `6e61570072fc547ddf6b0a104d6d5d55d70dc453`, synchronized to the private origin before this approval record.
- `main` and `origin/main` remain at `6693f8d3e4c975be748e8d7f103cd72f2ee36cfc`; no report-card release tag exists.
- Operational database SHA-256 remains `65F47EFA37DA321023439303770645F8D656F2BE58458C1A03B341408EF9A6FA` with the exact zero-business/four-protected-account baseline.
- Git safety passed; no source report PDF/ZIP, generated report pack or local comparison is tracked.

## Existing pack verification

The already-generated packs were verified in place without regeneration:

| Pack | Pages | SHA-256 |
| --- | ---: | --- |
| `FINAL-DIGITAL-REVIEW-R8.pdf` | 8 | `ED439BEFA348EF503E4D63730A8A04EBE85BF52F8715E86E3A240DC762B3E2FD` |
| `R8-DETAIL-CHECKS.pdf` | 6 | `60673DAD6EC52797F7734B3387B2F54711B97178D2D7E3055C52B94E99A0B2BD` |
| `PHYSICAL-ACCEPTANCE-CLASSES-I-X-COLOUR.pdf` | 8 | `BC6C258819B3D220B5A2A16EF5940D346A8C89CBBAB139353C8916404AAA05FD` |
| `PHYSICAL-ACCEPTANCE-CLASSES-I-X-MONOCHROME.pdf` | 8 | `7A8EB13FB40A6B3A7C75FB7BE1C206CCB91D368F9A28BEFFE155DE10C0FCF2C0` |

All 30 pages opened without repair, rendered at 300 DPI, used exact A4 media/crop boxes, were nonblank and showed no clipping in the governed outer band. Every synthetic page visibly carries `SYNTHETIC SAMPLE — NOT FOR ISSUE`. The eight colour and eight monochrome acceptance pages have matching geometry; monochrome pages contained zero meaningful chromatic pixels. The manifest has unique, consecutive specimen IDs/pages, contains no KG/LKG/UKG entry, and identifies `R8-MONO-03` on page 3 as the required one-generation photocopy specimen.

## Physical gate

Print both complete Classes I-X acceptance packs on ordinary A4 office paper at Actual Size / 100%, one page per sheet, single-sided, with borderless and fit/shrink disabled. Use native colour for the colour pack and native B/W or grayscale for the monochrome pack. Follow PDF orientation and record any printer-enforced scaling. Photocopy `R8-MONO-03` (monochrome page 3) exactly once.

Record printer/model, paper, requested and actual scale, clipping, text and marks-table readability, chart values, monochrome patterns, alignment, white background, logo sharpness, signature space, page order, blank pages and every failed specimen/page. Photographs are optional and must contain synthetic printouts only.

The gate is `PHYSICAL_PRINT_GATE_PENDING`. Do not merge, tag, deploy, publish a real report or begin V1-FINAL-1A before physical acceptance.
