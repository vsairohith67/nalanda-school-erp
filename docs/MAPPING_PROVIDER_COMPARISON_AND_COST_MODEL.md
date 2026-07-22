# Mapping Provider Comparison and Cost Model

## Status and safe-use boundary

This is a desk review dated 2026-07-19. No provider account was created, no credential was requested, no API was called, and no Student address was processed. Prices and terms can change; procurement must re-check official pages immediately before any commitment.

Decision for Prompt 21B and 21C: **NO LIVE GEOCODING PROVIDER**.

Decision for Prompt 21D: re-evaluate Google Maps Platform, Mapbox permanent geocoding, and a contracted OSM-based provider only after legal, privacy, storage, attribution, data-residency, deletion, accuracy, and budget review. Public Nominatim is prohibited.

## Comparison

| Option | Current pricing signal | Storage/display constraints | Privacy/operations | Suitability |
| --- | --- | --- | --- | --- |
| No provider / manual address only | $0 provider cost; staff verification time | No external terms | Lowest egress risk; address quality depends on workflow | **Recommended for 21B** |
| Google Maps Platform | India Dynamic Maps and Geocoding each currently have 70,000 monthly free usage; paid tiers after cap | Geocoding storage/caching and map-display policies require careful review; place IDs have different treatment | Paid billing, restricted keys, quotas, processor/transfer review | Possible 21D candidate, not approved |
| Mapbox | GL JS first 50,000 monthly map loads free; temporary geocoding first 100,000 free; permanent geocoding paid from first request | Temporary results cannot be stored; permanent mode is required for stored results; attribution applies | Token restrictions, permanent-mode account/contract, processor review | Possible 21D candidate, not approved |
| Public OSM Nominatim + OSM tiles | Nominally free, donated shared infrastructure | Public-use limits; tile and attribution rules; no SLA | Nominatim policy says not to submit personal/confidential material | **Prohibited for Student addresses** |
| Self-hosted Nominatim / OSM stack | Infrastructure, storage, updates, backup, monitoring, staff time | ODbL/attribution and data-update duties still apply | Keeps query traffic under school control but adds substantial operations/security burden | Disproportionate now; quote/benchmark only |
| Contracted OSM-based provider | Quote required | Provider-specific storage, tiles, attribution, SLA, deletion | Can avoid public endpoints; still a processor and transfer decision | Consider in 21D |

### Due-diligence matrix

All official documentation was reviewed on 2026-07-19.

| Option | Data sent / key handling | Permanent storage and attribution | Quota/bulk/India considerations | Privacy, lock-in, offline, complexity |
| --- | --- | --- | --- | --- |
| Manual/no provider | No external address or key | School-controlled record; no map attribution | Staff capacity is the quota; India quality depends on verification | Lowest provider risk/lock-in; fully local; medium staff workflow |
| Google | Minimum address would go server-to-provider; environment-only restricted server key; separate map browser key only if terms require | Written determination required for coordinate storage/display; Google attribution/map-policy obligations | Current India-specific pricing; quotas/budgets mandatory; no consumer-page scraping | Provider logs/transfers/processors need review; high ecosystem lock-in; no self-host; medium implementation |
| Mapbox | Minimum address to API; secret/server token protected, public rendering token URL/scopes restricted | Temporary results cannot be stored; permanent geocoding required; Mapbox/OSM attribution | Published request/map-load tiers; India accuracy must be piloted; no uncontrolled bulk | Provider logs/transfers/processors need review; moderate/high token/style lock-in; no geocoder self-host through this option; medium |
| Contracted OSM-based service | Minimum address to contracted endpoint; provider-specific server credential | Contract must grant storage; OSM/ODbL and provider attribution apply | Quote/SLA/bulk terms; India coverage varies by provider | Processor and jurisdiction review; potentially lower map lock-in; no offline unless contracted; medium |
| Public Nominatim/tiles | Address would go to public community service; identifying User-Agent required, no secret | Cache per policy; OSM attribution; not a confidential-data service | Absolute max 1 request/second, no autocomplete, bulk discouraged/limited, no SLA; India data varies | Explicit personal/confidential warning; policy can change; prohibited; deceptively low initial complexity |
| Self-hosted Nominatim | Address stays on controlled server; internal authentication required | School stores results; ODbL attribution/share-alike analysis applies | Capacity set by school; India extract quality/updates must be measured | Lowest query egress but high infrastructure/security/DB/update/backup/on-call burden; lowest vendor lock-in; high complexity |

## Official findings

### Google Maps Platform

The official India pricing page, last updated 2026-07-15 UTC at review time, listed:

- Dynamic Maps: 70,000 free monthly events, then $2.10 per 1,000 through 5,000,000 and $0.53 per 1,000 above that tier;
- Geocoding: 70,000 free monthly events, then $1.50 per 1,000 through 5,000,000 and $0.38 per 1,000 above that tier.

Google’s geocoding policy generally restricts caching/storage and links display of geocoding results to Google Maps, while place IDs have a distinct indefinite-storage allowance. A school intending to persist coordinates must obtain a written terms determination rather than infer that a low price permits storage. Keys must be restricted by application and API; web-service keys stay server-side. Quotas and alerts are required because billing reports and budgets are not a guaranteed instantaneous hard stop.

References:

- [Google Maps Platform pricing in India](https://developers.google.com/maps/billing-and-pricing/pricing-india)
- [Geocoding API policies](https://developers.google.com/maps/documentation/geocoding/policies)
- [API security best practices](https://developers.google.com/maps/api-security-best-practices)
- [Manage costs, quotas, and alerts](https://developers.google.com/maps/billing-and-pricing/manage-costs)

### Mapbox

The official pricing page listed at review time:

- Mapbox GL JS: first 50,000 monthly map loads free; then $5, $4, $3, and $2.50 per 1,000 across increasing tiers;
- temporary Geocoding API: first 100,000 monthly requests free; then $0.75, $0.60, and $0.45 per 1,000 across increasing tiers;
- permanent Geocoding API: $5 per 1,000 for the first 500,000 and $4 per 1,000 thereafter, with no free first tier shown.

Mapbox distinguishes temporary and permanent geocoding. Temporary results cannot be cached; storing results requires permanent mode and its applicable billing/account conditions. Tokens need minimum scopes, URL restrictions where applicable, and separate public/server treatment. Mapbox and OpenStreetMap attribution requirements apply to maps.

References:

- [Mapbox pricing](https://www.mapbox.com/pricing)
- [Mapbox Geocoding API and temporary/permanent storage](https://docs.mapbox.com/api/search/geocoding/)
- [Mapbox token security](https://docs.mapbox.com/help/dive-deeper/how-to-use-mapbox-securely/)
- [Mapbox attribution](https://docs.mapbox.com/help/glossary/attribution/)

### OpenStreetMap and Nominatim

The public Nominatim service is capacity-limited, requires a valid application identity, caps use at an absolute maximum of one request per second, discourages bulk/recurring jobs, prohibits autocomplete and systematic queries, and explicitly says not to submit personal or confidential material. It is not a production Student-address service.

The current policy also says a public Nominatim API must not be generically built into or automatically generated by no-code/low-code/LLM-assisted platforms. The deliberate production prohibition in this plan is therefore both a child-privacy decision and a service-policy decision.

OpenStreetMap tile servers are best-effort community infrastructure rather than a free commercial tile SLA. They require attribution and compliant caching and prohibit bulk/offline behavior. OSM data is licensed under ODbL; distribution of derived databases requires legal review.

Self-hosting removes queries from the public endpoint but is not “free”. Official Nominatim guidance lists at least 2 GB RAM for installation and, for a full-planet deployment, strongly recommends 128 GB or more RAM, 1 TB disk, NVMe storage, and multi-day imports. An India extract may be materially smaller, but it still needs measured sizing, updates, PostgreSQL operations, monitoring, security, backup, and on-call ownership.

References:

- [Public Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/)
- [OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/)
- [OpenStreetMap copyright and ODbL attribution](https://www.openstreetmap.org/copyright)
- [Nominatim installation guidance](https://nominatim.org/release-docs/latest/admin/Installation/)

## Configurable cost model

All values are estimates. Provider prices are USD before tax; staff time is INR. Do not convert currencies until Finance enters a current approved exchange rate. Exclude GST, bank/FX charges, support plans, committed-use discounts, data-transfer charges, map-provider changes, and procurement overhead unless a quote includes them.

### Variables

| Variable | Planning default | Meaning |
| --- | ---: | --- |
| `S` | 800 / 1,000 / 2,000 | Student cohort |
| `R` | 15% | Initial retry/manual re-request rate |
| `T` | 15% | Annual turnover/new records |
| `C` | 8% | Annual address correction rate |
| `M` | 4 minutes | Manual verification per address |
| `W` | INR 300/hour | Configurable staff cost |
| `U` | 6 | Leadership map users |
| `Q` | 12 | Map sessions per user per month |
| `L` | 2 | Map loads per session |
| `E` | 25% | Development/staging allowance |
| `H` | Quote required | Monthly self-host compute/database cost |
| `D` | Quote required | Monthly storage, snapshot, and transfer cost |
| `O` | Quote required | Monthly staff operations/security hours |
| `A` | Configurable INR/hour | Infrastructure administrator cost |

Formulas:

- initial geocodes = `S × (1 + R)`;
- annual new-admission geocodes = `ceil(S × T × (1 + R))`;
- annual correction geocodes = `ceil(S × C × (1 + R))`;
- annual maintenance geocodes = new-admission calls plus correction calls;
- monthly map loads = `U × Q × L`;
- development/staging geocode capacity = `ceil((initial geocodes + annual maintenance geocodes) × E)`;
- development/staging map capacity = `ceil(monthly map loads × E)`;
- manual initial verification cost = `S × M / 60 × W`;
- self-hosted monthly cost = `H + D + (O × A)`, keeping provider currency and staff INR separate until Finance supplies FX;
- apply `E` only to budget capacity, not to fabricate actual usage.

### Expected small-school demand

The following planning worksheet uses the 2026-07-19 assumptions above. Counts are requests/loads, provider rates are USD, and staff time is INR. Development/staging values are capacity allowances, not forecasts or permission to use real Student data.

| Cohort | Initial calls incl. retry | Annual new admissions | Annual corrections | Annual total | Dev/staging geocode allowance | Monthly production map loads | Dev/staging map allowance | Initial manual verification |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 800 | 920 | 138 | 74 | 212 | 283 | 144 | 36 | INR 16,000 |
| 1,000 | 1,150 | 173 | 92 | 265 | 354 | 144 | 36 | INR 20,000 |
| 2,000 | 2,300 | 345 | 184 | 529 | 708 | 144 | 36 | INR 40,000 |

The corresponding planning capacity is 180 monthly map loads after adding the 36-load development/staging allowance. Development and staging must remain synthetic; this allowance exists only for quota/cost planning.

Current reviewed allowances:

- Google India Dynamic Maps and Geocoding: 70,000 monthly events at no cost before the current paid tiers;
- Mapbox GL JS: 50,000 monthly map loads at no cost before the current paid tiers;
- Mapbox temporary geocoding: 100,000 monthly requests at no cost, but temporary results cannot be stored;
- Mapbox permanent geocoding: no free first tier was shown in the expanded detailed pricing reviewed for this model.

An allowance is not a guarantee of free operation. Billing setup, taxes, account minimums/support, future price/term changes, abusive traffic, and other SKUs can create charges.

At current published caps, these expected volumes would remain inside Google’s India monthly free usage and Mapbox GL JS free map-load allowance. Mapbox permanent geocoding would be approximately:

| Cohort | One-time permanent geocoding | Annual maintenance |
| ---: | ---: | ---: |
| 800 | USD 4.60 | USD 1.06 |
| 1,000 | USD 5.75 | USD 1.33 |
| 2,000 | USD 11.50 | USD 2.65 |

The nominal API bill is therefore not the main decision factor. Staff verification, legal review, security, data governance, correction handling, and incident response dominate the real cost.

No defensible self-hosted India-extract amount is available from the official installation guide alone. Before 21D, benchmark the chosen extract and obtain quotes for VM/database, NVMe storage, snapshots, outbound transfer, monitoring, patching, replication/recovery, and administrator/on-call time. Record provider minimum monthly fees separately; the reviewed usage-based Google/Mapbox pages do not guarantee a permanently free operation or exclude a future account/support minimum.

### Misuse and failure examples

These examples show why quotas matter; they are not forecasts:

- 1,000,000 Google India geocoding events in one month: about USD 1,395 after the current 70,000 free cap, before tax and other charges;
- 1,000,000 Mapbox permanent geocodes: about USD 4,500 under the current first two tiers;
- 1,000,000 Mapbox GL JS map loads: about USD 3,050 under the current tiers.

Re-check exact tier aggregation and contract billing before relying on these calculations.

## Mandatory budget and abuse controls for a future 21D

- live profile off by default, with an immediate kill switch;
- separate staging and production projects, keys, and quotas;
- explicit single-address request only; no automatic load-time geocode;
- at most one bounded retry after a timeout;
- initial daily cap of 25 and an approved batch ceiling;
- monthly internal pilot budget of USD 10 and production budget of USD 25 until evidence supports a change;
- provider quota at or below the internal cap;
- alerts at 50%, 75%, and 90%;
- no wildcard key, unrestricted referrer, mobile-bundled secret, or source-controlled credential;
- cost dashboard showing calls, retries, failures, provider status, and remaining internal budget without address bodies;
- reconciliation for requested, accepted, rejected, deleted, and billed calls;
- documented response to pricing change, quota exhaustion, provider outage, wrong result, and key compromise.

## Accuracy and operational comparison

Provider coverage claims are not enough for a school deployment. A future pilot must use synthetic or explicitly authorised addresses across Hyderabad/Telangana patterns:

- apartment names and blocks;
- repeated locality names;
- new layouts and informal addresses;
- six-digit postal codes;
- transliteration and spelling variants;
- rural/village/mandal/district formats if applicable;
- missing landmarks and ambiguous roads.

Measure exact match to intended locality, false confidence, manual correction time, retry rate, no-result rate, and deletion behavior. Never equate a high provider confidence score with a verified home.

When confidence is low, multiple candidates are returned, or the result falls outside the expected country/state/district, save no coordinate. Keep the verified postal address, show a plain uncertainty message, allow manual locality/approximate selection, and require an authorised reviewer rather than repeat paid requests automatically.

## Procurement questions

Before selecting a provider, obtain written answers for:

- Is a school allowed to submit child residential addresses?
- Where are requests, logs, support data, and backups processed?
- Which subprocessors receive them?
- How long are request/response logs retained and how are they deleted?
- Can coordinates and formatted results be stored permanently?
- Must stored results be displayed only on the provider’s map?
- What attribution is required in browser, print, and export?
- Is customer data used for service improvement or model training, and can that be disabled?
- What security, breach, audit, DPA, support, SLA, and termination terms apply?
- How are stored results handled after contract termination?
- Can spend be hard-capped, and what billing delay exists?

## Recommendation

Use **NO PROVIDER / MANUAL ADDRESS ONLY** in Prompt 21B. If an approved operational need survives the privacy and necessity test, store only a manually confirmed coarse point. In Prompt 21D, compare written provider terms and a contracted OSM-based service alongside Google and Mapbox. Do not use public Nominatim, temporary Mapbox results for persistent storage, or any provider whose storage/display/deletion terms remain ambiguous.
