# OCR Benchmark 1A

OCR Benchmark 1A is a local, synthetic-only architecture evaluation. It adds no production OCR endpoint, model server, database model, camera permission, scanner driver, Admissions mutation or automatic ERP write.

## Current-main reconciliation

The benchmark began from `origin/main` at `1bbc162f9222e4a717ecb01c77f6ef701b4289ee`. Current OCR-related source was classified as follows:

| Surface | Classification | Evidence |
| --- | --- | --- |
| Handwritten fee-register upload/review staging | `ALREADY_IMPLEMENTED` | Private upload, deterministic `MOCK`/manual review and explicit approval controls already exist. |
| Real local fee-register OCR engine | `PLANNED` | `LOCAL_HTTP` is rejected by the active provider path and tests. |
| Cloud OCR provider | `PLANNED` and disabled | `CLOUD_API` is rejected; no provider was activated. |
| General Admissions/Student/Guardian/Staff document OCR | `NOT_PRESENT` | No production parser or authoritative write path exists. |
| Tooling in `tools/ocr-benchmark` | `BENCHMARK_ONLY` | Isolated locks, synthetic generator, adapters, metrics and launchers; no Next.js import or route. |

Therefore `OCR_AND_SCANNING = NOT SOFTWARE-CLEARED` remains true. The existing fee-register review foundation is not evidence of a general OCR engine.

## Question and method

The decision question is: which local architecture offers useful document extraction while remaining private, secure, affordable, maintainable and realistic for school hardware?

The reproducible sequence is:

1. Generate and checksum the deterministic corpus.
2. Reject unsafe/malformed inputs before a candidate runs.
3. Run each engine against the same 50-document / 77-page corpus without removing difficult pages.
4. Normalize output into benchmark-only `DocumentResult`, `PageResult`, `TextBlock`, `FieldCandidate`, `TableCell`, `SourceRegion` and `EngineMetadata` structures.
5. Score text, fields, critical fields, layout/order, tables, omission, hallucination, language, handwriting, degradation, scanner and PDF slices.
6. Record cold/warm latency, throughput, CPU, RAM and VRAM when the runtime exposes them.
7. Test a production-observable cascade selector, preprocessing, malformed input, prompt-injection-like text and deterministic format validation.
8. Combine raw quality with licence, custom-code, offline, hardware, security, maintenance and integration evidence.

The immutable corpus manifest SHA-256 is `84c13b92234d3309d51a6bc38883f08cac08034a839d64719eb9219ed9f7ec0c`. See [OCR_SYNTHETIC_CORPUS.md](OCR_SYNTHETIC_CORPUS.md), [OCR_HARDWARE_PROFILE.md](OCR_HARDWARE_PROFILE.md) and [OCR_SECURITY_AND_PRIVACY.md](OCR_SECURITY_AND_PRIVACY.md).

## Metric interpretation

- Exact-field accuracy is literal normalized expected-value presence, not semantic similarity.
- Critical-field accuracy gives dates, phone-like values, identities and identifiers full weight; a wrong digit is a miss.
- Field precision/recall/F1 in 1A are target-field recognition scores. The benchmark does not claim a production field-mapping model.
- Table-cell F1 is expected-cell text recovery. It does not prove merged-cell semantics or a production spreadsheet representation.
- Language aggregates retain every document with that language label. Because the corpus intentionally has different categories per language, they must be read beside category and raw rows rather than as matched translation pairs.
- Handwriting samples use synthetic handwriting-like fonts. They are not proof for natural Telugu or Hindi handwriting.
- Generative engines without field confidence have `confidence_coverage = 0`; no percentage is invented.
- A blank or unreadable value should be omitted. Hallucination is scored separately and blocks silent automation even when aggregate accuracy is high.

Raw normalized results, JSONL metrics, summaries and run manifests live in the ignored `.codex/artifacts/OCR-BENCHMARK-1A/results` directory. The committed candidate lock records exact source/model revisions, licences and expected hashes.

## Result and architecture outcome

The benchmark selects `PRINTED_ENGINE_PLUS_HANDWRITING_MANUAL_REVIEW` for the future 1B implementation. Classic PaddleOCR PP-OCRv5 mobile is the primary engine; there is no automatic secondary OCR engine. Difficult, low-confidence, omitted, complex-table and handwriting-like pages go to mandatory human review.

Paddle completed all 50 documents and 77 pages with exact-field `0.8802`, critical-field `0.8852`, critical hallucination `0`, PDF exact-field `0.9184`, degradation robustness `0.8241`, 98% confidence coverage and 212.8 pages/minute. Its reading-order `0.5627`, table-cell `0.2688`, CER `1.0102` and WER `0.9858` prevent any claim of complete form understanding or safe automation.

Tesseract is retained as a low-cost CPU baseline, not an automatic fallback: Paddle-to-Tesseract reduced critical-field accuracy from `0.8852` to `0.8795`. Paddle-to-Surya increased it to `0.9100`, but Surya's unresolved weight licence and heavier runtime override that small gain. Unlimited-OCR loaded its exact 6.67 GB model in the custom-code sandbox but the 8 GiB GPU had no remaining vLLM cache blocks, so it produced no inference metrics and is excluded from scoring.

See [OCR_ARCHITECTURE_DECISION.md](OCR_ARCHITECTURE_DECISION.md) for raw metrics, the weighted matrix, hybrid/preprocessing results and hardware recommendations.

## Reproduction

```powershell
uv sync --project tools/ocr-benchmark --frozen
pnpm.cmd ocr:qa
pnpm.cmd ocr:corpus:generate
pnpm.cmd ocr:security:probe
pnpm.cmd ocr:validation:probe
pnpm.cmd ocr:containers:prepare
pnpm.cmd ocr:benchmark:tesseract
pnpm.cmd ocr:benchmark:paddle
pnpm.cmd ocr:benchmark:unlimited
pnpm.cmd ocr:benchmark:surya
pnpm.cmd ocr:preprocess
pnpm.cmd ocr:report
```

Model acquisition is a separate online preparation step. Inference launchers fail closed when a pinned model/image is absent and do not download while processing documents. Exact preparation requirements are in `tools/ocr-benchmark/README.md` and `tools/ocr-benchmark/candidates/candidate-lock.json`.

## Non-activation statement

All OCR output remains untrusted candidate text. Even a future `GREEN` candidate requires human confirmation and must pass through existing authoritative domain services. Raw OCR and source documents do not automatically enter Universal Search or Smart AI. Production activation belongs only to the unexecuted OCR Scanning Foundation 1B prompt.
