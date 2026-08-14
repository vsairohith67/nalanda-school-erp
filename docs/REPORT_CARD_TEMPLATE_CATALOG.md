# Report-Card Template Catalog

**Catalog ID:** `REPORT-PRINT-ACCEPT-1A-TEMPLATE-CATALOG`

**Calibration date:** 2026-08-13

**Status:** four Classes I-X families are digitally and physically accepted for V1; the KG foundation is preserved and operationally deferred to V1.5

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
| Three-series chart | Colour uses the unchanged approved colours. True monochrome uses Student Marks solid 55% neutral grey, Class Average single-direction diagonal slash and High Score diamond/cross-lattice, with matching legend/bar drawing and collision-safe direct labels of at least 7 pt |
| Individual PDF, merged PDF, ZIP | Deterministic generated artifacts in ignored pack |
| Class/section jobs and Parent issued-only delivery | Existing immutable publication pipeline retained; full independent QA pending |
| Classes I-X R5-A1 digital review | Ten representative colour/true-monochrome pages, seven enlarged detail checks and a separate six-page edge pack generated locally and ignored; user review pending |
| Classes I-X R6-A1 digital review | Eight representative pages and twelve enlarged detail checks generated locally and ignored; configured header emphasis, adaptive dense/two-row charts and authoritative monochrome patterns await user review |
| Classes I-X R7 digital review | Eight representative pages and fourteen enlarged detail checks generated locally and ignored; exact 12 pt/11 pt secondary header, dynamic summary cards, balanced signatures and filled-diamond monochrome treatment await user review |
| Classes I-X R8 final digital review | `R8_DIGITAL_DESIGN_APPROVED`; eight representative pages and six detail checks verified locally with measured one-line summaries, dense marks priority, combined VI-X trait/grade, adaptive charts and 15 mm signatures |
| Classes I-X physical colour, grayscale, and photocopy acceptance | `REPORT_PRINT_ACCEPTANCE_CLEARED`; Canon imageCLASS MF244dw/A4 colour, native-monochrome and one-generation dense-page photocopy accepted with no failed specimen |
| KG physical acceptance | Deferred to V1.5; not part of the V1 release-candidate gate |

## Physical specimens

The ignored R4.2 packs are preserved as technical evidence and marked `SUPERSEDED_PENDING_CLASSES_I_X_CORRECTIONS`; they must not be used because they include KG and predate the final Classes I-X correction register. R5, R6 and R7 generated digital-review evidence only. The R8 Classes I-X-only candidates containing eight genuinely distinct layouts are the accepted physical reference. See `docs/REPORT_CARD_PRINT_ACCEPTANCE_RELEASE_CLOSURE.md` and the versioned maintenance policy.
