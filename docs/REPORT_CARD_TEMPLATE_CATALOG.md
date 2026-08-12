# Report-Card Template Catalog

**Catalog ID:** `REPORT-PRINT-ACCEPT-1A-TEMPLATE-CATALOG`

**Calibration date:** 2026-08-12

**Status:** four Classes I-X families remain V1; R5 corrections are ready for digital review and physical acceptance remains pending; the KG foundation is preserved and operationally deferred to V1.5

## Canonical inventory

| Canonical family | Authorised class scope | Variants | Distinct structure | Frozen policy inputs | Renderer |
| --- | --- | --- | --- | --- | --- |
| `KG_DEVELOPMENTAL_BOOKLET` | LKG/UKG — V1.5 only | Developmental booklet | Ten A4 pages; five evaluations; intellectual, detailed language/number/EVS/rhymes/story, personality, monthly attendance, growth, comments, signatures, promotion | KG scheme, response/grade legend, attendance basis, signature configuration, template/publication versions | `lib/report-pdf.ts`; status `IMPLEMENTED_FOUNDATION_DEFERRED_TO_V1_5`; default-off in V1 |
| `LOWER_PRIMARY_I_II` | Classes I-II | CT, Session, Combined | Variable components, configured combined result, skills table | Frozen scheme, components/maxima/weights, grade scale, rank/pass visibility, attendance, skills, signatures | `lib/report-pdf.ts` |
| `UPPER_PRIMARY_III_V` | Classes III-V | CT, Session, Combined | Separate Science and Social rows, configured combined result, skills | Same frozen policy inputs | `lib/report-pdf.ts` |
| `MIDDLE_VI_VIII_GROUPED` | Classes VI-VIII | CT, Session, Combined | English papers; History/Geography/Social and Physics/Chemistry/Biology/Science groups; personality | Same frozen policy inputs plus subject/paper/group configuration | `lib/report-pdf.ts` |
| `SECONDARY_IX_X` | Classes IX-X | CT, Session, Revision, Preboard, Combined | Grouped subjects, personality, configured combined capability | Same frozen policy inputs; combined and chart capability remain configuration-driven | `lib/report-pdf.ts` |

Legacy family identifiers remain readable for already-issued snapshots. They cannot be used for new canonical bindings.

## Activation and immutability

Template availability is not activation. A new examination binding requires an active, versioned canonical template whose configured family matches the class and report type. Combined-result variants additionally require an approval reference. Issued reports retain the exact template definition, calculation snapshot, grade-scale version, scheme references, attendance basis, signature configuration, and publication version; later template changes cannot alter them.

For V1, `kg-report-cards-v1-5` is default-off through the existing release-policy framework. New KG scheme/template creation, activation, examination binding, batch generation, entry, issue and correction fail closed. Ordinary operational selectors omit KG. The restricted Super Admin release view may show **KG report-card family — planned for V1.5**. Historical and already-issued snapshots remain readable.

No template definition contains universal component maxima, weightages, or grade scales. In particular, historical 10+40, 20+80, 25+25, or multi-term arithmetic is not encoded as a canonical rule.

## Rendering and packaging capability

| Capability | Digital calibration status |
| --- | --- |
| Exact A4 media boxes and 100% output scale | Passed in generated synthetic pack |
| Georgia Bold school name with safe fallback | Implemented; font substitution remains part of independent PDF inspection |
| Approved transparent ERP logo | Implemented with `/nalanda-logo-transparent.png` |
| Inclusive Parent/Guardian and explicit father-name compatibility modes | Covered synthetically |
| Zero / Absent / Not Entered / Exempt / N/A distinctions | Covered synthetically |
| Long names and subjects, multiple papers, grouped subjects, decimals, legends, remarks, attendance extremes, signatures | Covered synthetically |
| Colour and monochrome | Both generated for every distinct structure |
| Three-series chart | Student Marks solid, Class Average diagonal hatch, High Score horizontal pattern, all with numeric labels |
| Individual PDF, merged PDF, ZIP | Deterministic generated artifacts in ignored pack |
| Class/section jobs and Parent issued-only delivery | Existing immutable publication pipeline retained; full independent QA pending |
| Classes I-X R5 digital review | Ten representative colour/true-monochrome pages plus a separate six-page edge pack generated locally and ignored; user review pending |
| Classes I-X physical colour, grayscale, and photocopy acceptance | Paused until R5 user approval and later regeneration of a Classes I-X-only physical pack |
| KG physical acceptance | Deferred to V1.5; not part of the V1 release-candidate gate |

## Physical specimens

The ignored R4.2 packs are preserved as technical evidence and marked `SUPERSEDED_PENDING_CLASSES_I_X_CORRECTIONS`; they must not be printed because they include KG and predate the final Classes I-X correction register. R5 generated only digital-review evidence, not a physical pack. The future V1 acceptance pack will contain only genuinely distinct Classes I-X structures after the user approves the R5 visuals. See `docs/REPORT_CARD_V1_SCOPE_AMENDMENT.md`.
