# OCR Benchmark 1A Clearance

Verdict: `OCR_BENCHMARK_1A_CLEARED`

Scope: benchmark, security/privacy evaluation, hardware profile and future architecture decision only.

Production OCR status: `NOT_ACTIVATED`.

## Decision receipt

- Starting authoritative main: `1bbc162f9222e4a717ecb01c77f6ef701b4289ee`.
- Latest main observed before reconciliation: `41f1b283694fe9dcddd51a329fb0be2869f9a72b` (`feat: complete synthetic school pilot readiness (#17)`).
- Dedicated branch/worktree: `feature/ocr-benchmark-1a` at `C:\Users\rohit\Documents\school-software-worktrees\ocr-benchmark-1a`.
- Corpus: 50 synthetic documents, 59 files, 77 pages, 3,292,436 bytes, 172,586,069 decoded pixels.
- Corpus manifest: `84c13b92234d3309d51a6bc38883f08cac08034a839d64719eb9219ed9f7ec0c`.
- Selected outcome: `PRINTED_ENGINE_PLUS_HANDWRITING_MANUAL_REVIEW`.
- Primary for future 1B: classic PaddleOCR PP-OCRv5 mobile English/Devanagari/Telugu pipeline.
- Automatic fallback: none; ambiguous/handwriting/complex pages go to human review.
- Narrow baseline: Tesseract 5, not selected as an automatic fallback.
- Rejected: Surya for unresolved model-weight licence; Unlimited-OCR from 1B on this host for custom-code burden and measured 8 GiB capacity failure.
- No Prisma schema or production runtime change.

## Trustworthy benchmark evidence

Paddle, Tesseract and Surya completed the identical corpus locally. Paddle repeated with identical quality metrics: exact field `0.880238`, critical field `0.885238`, critical hallucination `0`, typed field `0.909828`, synthetic handwriting-like `0.722222`, PDF `0.918367`, degradation `0.824074`, p50 `232.867 ms`, p95 `1,161.566 ms`, peak RAM `2,064,748,544`, peak VRAM `958,718,720` and `212.79 pages/min`.

Tesseract produced exact/critical `0.595079`, critical hallucination `0.006667`, PDF `0.5839`, p50 `1,306.66 ms`, p95 `3,585.64 ms`, peak RAM `137,814,016` and no VRAM. Surya produced exact/critical `0.562778`, critical hallucination `0`, PDF `0.246032`, p50 `4,935 ms`, p95 `24,973 ms`, peak RAM `6.48 GB` and peak VRAM `2.502 GB`; its production use remains licence-ineligible.

Unlimited-OCR exact source `d49ff64afffc1f47ab563dc1c589bc2f78808fa4`, model `07dea832e22aefee32ad281d4b80551282e1c168`, 6,672,547,120-byte weight and official vLLM digest `sha256:b7a7be708c9a325107cdeddeba095e5637617716b3ab469c19d34759ec1afa39` were verified. The model loaded inside an internal-only, read-only, no-secrets/no-database sandbox; vLLM then reported no available memory for cache blocks on the 8 GiB GPU at `gpu_memory_utilization=0.85` and 16K context. Therefore it has no accuracy, latency, RAM or VRAM inference metrics. Placeholder zero values for its `UNAVAILABLE` rows are excluded.

## Security and privacy receipt

- Final Standard scan: `627158cb-c31f-4cae-ad63-e2f28ee506e9`.
- Exact workbench snapshot: `238a5c986a694c2de1402a3dec5606efb761a7a51813bd21ae108ae398fd96f6`.
- Coverage: 61/61 files, six threat surfaces, complete.
- Findings: zero; no target warning or unresolved Critical/High.
- Malformed/security admission probe: 9/9 expected outcomes.
- Deterministic field validation probe: 10/10 expected outcomes.
- Unlimited custom-code review: `trust_remote_code=True`; built-in `eval()` over parsed/model text requires the documented container boundary and can never run in the ERP process.
- Candidate inference was local. Paddle had `--network none`; Unlimited used an internal-only network with no external route; Tesseract was a local bounded process. Surya used authenticated loopback and offline/proxy flags, but outbound denial was not OS-enforced, so no stronger claim is made.
- `pip-audit 2.10.1` found no known vulnerability in the core locked environment or the exact installed Paddle container inventory. The local benchmark package is unpublished and skipped; the custom-index `paddlepaddle-gpu==3.3.1` distribution is not present on PyPI and could not be advisory-resolved, so exact lock/hash/container isolation remains its compensating supply-chain control.
- No model weights, generated corpus, OCR raw output, virtual environment, private document, token or binary release is tracked.

## Operational database boundary

The operational database is outside the dedicated worktree and was never mounted or opened by a candidate. Baseline identity:

- Path: `C:\Users\rohit\Documents\school software\prisma\dev.db`.
- Size: 8,409,088 bytes.
- UTC mtime: `2026-08-10T10:55:19.8897824Z`.
- SHA-256 before: `65F47EFA37DA321023439303770645F8D656F2BE58458C1A03B341408EF9A6FA`.
- WAL/SHM/journal before: absent.

The terminal after-hash and sidecar check are release gates and must match before merge/tag.

## Release gates

The release is permitted only after all of the following are recorded green on the reconciled exact head:

- focused OCR unit/probe suite;
- dependency/security and public-repository scans;
- corpus verification and reproducible report generation;
- `pnpm.cmd typecheck`;
- `pnpm.cmd test`;
- `pnpm.cmd build`;
- `pnpm.cmd git:safety-check`;
- repository final-scope/release evidence gates;
- exact-head CI after a normal PR;
- unchanged operational DB hash and absent sidecars.

PR, exact feature head, merge SHA, tag and tracker readbacks are terminal release metadata and are reported in the final handoff rather than embedded as self-referential source identifiers.

## Meaning of clearance

`OCR_BENCHMARK_1A_CLEARED` means the benchmark is reproducible, the candidate/security/licence decisions are documented, and a future implementation path is ready. It does not mean that real documents may be processed, OCR is integrated, OCR is authoritative, cloud inference is enabled, or any production/user rollout is approved.
