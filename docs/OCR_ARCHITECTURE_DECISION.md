# OCR Architecture Decision

Status: `ACCEPTED_FOR_FUTURE_1B_ONLY`

Decision date: 2026-08-31

Outcome: `PRINTED_ENGINE_PLUS_HANDWRITING_MANUAL_REVIEW`

This decision clears a benchmark and a future implementation direction. It does not activate OCR, add an ERP route, accept real documents, or authorize an OCR-driven record write.

## Decision

Use the classic PaddleOCR PP-OCRv5 mobile detector with separate English, Devanagari and Telugu recognizers as the future 1B primary extraction engine. Run it as a separate local worker with pinned models, no outbound network, read-only admitted inputs and bounded transient output. Preserve page polygons and recognition scores as evidence, but never interpret a score as approval.

There is no automatic secondary OCR engine in the selected 1B architecture. Low-confidence, incomplete, complex-table and handwriting-like pages go directly to human review. Tesseract remains a qualified benchmark baseline and may later be evaluated as a narrow CPU-only printed-text contingency; it is not the Paddle fallback because the measured Paddle-to-Tesseract cascade reduced critical-field accuracy.

Surya is rejected from production selection because its model-weight licence is unresolved for Nalanda and its runtime is materially heavier. Unlimited-OCR is rejected from the selected 1B path on this hardware: the exact model loaded in the hardened sandbox, but an 8 GiB RTX 3070 had no remaining memory for vLLM cache blocks at the bounded 16K context. It may be reconsidered only as a research-only optional heavy engine on a dedicated 12–16 GiB GPU after the complete corpus is measured under the same custom-code sandbox.

## Selected flow

```text
bounded local file/import
  -> MIME/decode/page/pixel/time admission
  -> metadata-stripped page raster
  -> pinned local PaddleOCR worker
  -> untrusted text + region + engine confidence
  -> deterministic format flags (never correction)
  -> GREEN / AMBER / RED review state
  -> mandatory human source comparison and approval
  -> existing authoritative Admissions/Student/Guardian/Staff service
```

Raw OCR, rejected candidates and private source pages must not enter Universal Search or Smart AI. No direct Prisma write or second admissions truth is permitted.

## Raw evidence

All completed engines used the same deterministic 50-document, 77-page corpus at manifest SHA-256 `84c13b92234d3309d51a6bc38883f08cac08034a839d64719eb9219ed9f7ec0c`.

| Metric | PaddleOCR | Tesseract 5 | Surya OCR 2 | Unlimited-OCR |
| --- | ---: | ---: | ---: | --- |
| Run status | 50/50 `OK` | 50/50 `OK` | 50/50 `OK` | 50/50 `UNAVAILABLE`; no inference metrics |
| Normalized exact-field / field F1 | 0.8802 | 0.5951 | 0.5628 | Not measured |
| Critical-field exact | 0.8852 | 0.5951 | 0.5628 | Not measured |
| Character error rate | 1.0102 | 0.7015 | 0.9024 | Not measured |
| Word error rate | 0.9858 | 0.9912 | 0.7082 | Not measured |
| Critical hallucination | 0.0000 | 0.0067 | 0.0000 | Not measured |
| Typed-field accuracy | 0.9098 | 0.6331 | 0.5561 | Not measured |
| Synthetic handwriting-like accuracy | 0.7222 | 0.0000 | 1.0000 | Not measured |
| Table-cell F1 | 0.2688 | 0.0600 | 0.2363 | Not measured |
| Reading-order accuracy | 0.5627 | 0.6009 | 0.5599 | Not measured |
| PDF exact-field accuracy | 0.9184 | 0.5839 | 0.2460 | Not measured |
| Page omission rate | 0.0200 | 0.0200 | 0.3667 | Not measured |
| Degradation robustness | 0.8241 | 0.5833 | 0.3148 | Not measured |
| Rotation robustness | 0.5000 | 0.2500 | 0.6667 | Not measured |
| Confidence coverage | 0.9800 | available in raw engine rows | 0.0000 | Not measured |

Paddle's CER and WER are deliberately not hidden: they are poor because the engine often returns extra full-page transcription or differently ordered text even when target values are present. The stronger field/PDF scores do not prove complete document understanding. Low table and reading-order scores require source-region review and bar any silent form-to-record automation.

### Language and scanner slices

| Slice | PaddleOCR | Tesseract | Surya |
| --- | ---: | ---: | ---: |
| English exact field | 0.9042 | 0.6458 | 0.4917 |
| Hindi exact field | 0.8750 | 0.0833 | 1.0000 |
| Telugu exact field | 0.8333 | 0.1667 | 1.0000 |
| English + Hindi | 0.7540 | 0.6587 | 1.0000 |
| English + Telugu | 1.0000 | 0.0000 | 1.0000 |
| English + Hindi + Telugu | 1.0000 | 0.8056 | 0.7361 |
| 150 / 200 / 300 / 600 DPI | 1.000 / 0.944 / 1.000 / 1.000 | 0.333 / 1.000 / 1.000 / 1.000 | 1.000 / 1.000 / 0.667 / 0.667 |

Language slices contain different document categories and are not matched translations. The benchmark therefore reports them as diagnostic slices, not universal language scores. Synthetic handwriting-like fonts do not establish natural Hindi or Telugu handwriting quality.

### Runtime and footprint

| Candidate | Cold start | Warm p50 | p95 | Throughput | Peak RAM | Peak VRAM | Selected model size |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| PaddleOCR | 2,769 ms | 232 ms | 1,162 ms | 212.8 pages/min | 2.06 GB | 0.96 GB | 28.1 MB |
| Tesseract | 1,307 ms | 1,307 ms | 3,586 ms | 45.5 pages/min | 137.8 MB | 0 | 47.0 MB traineddata |
| Surya | 5,899 ms | 4,914 ms | 24,973 ms | 11.2 pages/min | 6.48 GB | 2.50 GB | 1.47 GB |
| Unlimited-OCR | server never became ready | Not measured | Not measured | Not measured | Not measured | model admission exhausted 8 GiB-class capacity before KV cache | 6.67 GB weight |

The Unlimited values emitted for `UNAVAILABLE` rows are bookkeeping durations and zero placeholders; they are explicitly excluded from accuracy and performance comparison.

## Hybrid and preprocessing decisions

| Architecture | Fallback rate | Exact field | Critical field | Critical hallucination | Decision |
| --- | ---: | ---: | ---: | ---: | --- |
| Paddle -> Tesseract | 10% | 0.8745 | 0.8795 | 0.0000 | Reject: worse than Paddle alone and adds a runtime |
| Paddle -> Surya | 10% | 0.9050 | 0.9100 | 0.0000 | Reject: small gain cannot override licence and runtime gates |
| Tesseract -> Surya | 54% | 0.7189 | 0.7189 | 0.0067 | Reject: high fallback load and inferior result |

On 30 degraded/scanner documents, targeted Tesseract upscale-and-sharpen improved exact fields from 0.6833 to 0.7556, while CER worsened from 0.6298 to 0.6788. Global adaptive thresholding, contrast/denoise and deskew/contrast regressed field accuracy. Future 1B may expose upscale/sharpen only as an observable, reversible low-resolution retry; it must not silently preprocess every page.

## Weighted matrix

Scores are 0–10 and weighted to 100. Recognition and multilingual scores derive primarily from exact-field slices; layout combines table, reading-order and PDF evidence. The operational dimensions use the recorded runtime, licence, isolation and maintenance evidence. Licence and mandatory-custom-code gates are applied before the score, so a numerically high but ineligible model cannot win.

| Dimension (weight) | Paddle | Tesseract | Surya |
| --- | ---: | ---: | ---: |
| Recognition quality (18) | 8.80 | 5.95 | 5.63 |
| Multilingual quality (14) | 8.94 | 3.93 | 8.71 |
| Document/layout (10) | 5.30 | 4.15 | 3.47 |
| Hallucination resistance (12) | 10.00 | 9.93 | 10.00 |
| Local privacy (8) | 10.00 | 10.00 | 7.00 |
| Hardware practicality (8) | 9.00 | 10.00 | 4.00 |
| Latency/throughput (7) | 9.00 | 6.00 | 4.00 |
| Licence (8) | 10.00 | 10.00 | 0.00 |
| Security/supply chain (7) | 9.00 | 9.00 | 5.00 |
| Maintainability (3) | 8.00 | 10.00 | 5.00 |
| Offline operation (3) | 10.00 | 10.00 | 5.00 |
| Integration simplicity (2) | 8.00 | 9.00 | 4.00 |
| **Weighted result / 100** | **88.46** | **74.58** | **56.70 (ineligible)** |

Unlimited-OCR is not scored because no page inference occurred. Its MIT licence is acceptable, but mandatory remote custom code and the measured 8 GiB capacity failure make it ineligible for this 1B decision.

## Hardware recommendation

- Ordinary office CPU: 8-core AVX2 CPU, 16 GiB RAM minimum, SSD. Do not promise the selected GPU throughput. A CPU Paddle profile must be measured in 1B before procurement; Tesseract is only a narrow printed-text contingency.
- Modest-GPU office worker: NVIDIA 8 GiB GPU, 32 GiB RAM and SSD. This is the recommended measured class for one Paddle queue; observed Paddle peak was about 0.96 GB VRAM and 2.06 GB RAM.
- Dedicated heavy OCR worker: 12–16 GiB GPU and 32–64 GiB RAM only if future measured manual-review volume justifies reconsidering a document VLM.
- Development workstation: 24 GiB GPU and 64 GiB RAM for multi-engine research, not the default school purchase.

## Acceptance constraints for 1B

1. Keep the feature default-off and local-only.
2. Reuse the 1A admission limits and immutable model locks.
3. Preserve source page/region evidence and explicit missing/ambiguous states.
4. Require human approval for every record; prohibit high-confidence bulk approval of critical fields.
5. Use existing authoritative services with normal authorization and concurrency checks.
6. Keep source documents, raw OCR and rejected candidates outside Search/Smart AI.
7. Define and test short retention/deletion rules before any real document pilot.
8. Use only synthetic data until a separately approved private pilot and legal/retention review.
9. Requalify natural handwriting; 1A proves only synthetic handwriting-like behavior.
10. Treat the low layout/table scores as a hard review requirement, not as a backlog item that can be waived.
