# OCR Benchmark 1A Security and Privacy

## Boundary

OCR is assistive extraction only. A future flow is `Document -> bounded local extraction -> validation -> human review -> existing authoritative service`. OCR output never directly creates or mutates Student, Guardian, Staff, finance, attendance, medical, academic or identity data. Unknown remains unknown.

This benchmark adds no ERP route, Prisma model, camera permission, scanner integration, Universal Search adapter or Smart AI action. It uses no real people and no hosted OCR API.

## Threats and controls

| Threat | Control in 1A |
| --- | --- |
| Real/private document disclosure | Canonical manifest SHA, schema, seed, synthetic-only flag, file allowlist and every declared size/hash are enforced; no production database mount or cloud inference |
| Oversized/decompression-bomb input | MIME/decode checks plus per-document and aggregate manifest/file/page/pixel/time/output limits before candidate invocation |
| Duplicate replay | SHA-256 duplicate rejection in batch admission |
| EXIF/metadata leakage | Every image/PDF page is decoded to RGB pixels and re-encoded as PNG before the candidate boundary |
| Prompt injection in visible document text | Model output is parsed as untrusted text only; no tool, shell, network, approval or ERP action is available |
| Hallucinated blank values | Blank critical regions are scored separately; omission is preferred to plausible invention |
| Secret/environment theft | Candidate launchers use explicit environment allowlists; tokens, database URLs and cloud credentials are absent |
| Malicious custom model code | Immutable revision, source inspection and container isolation; no host execution |
| Supply-chain drift | Exact Python locks, model/runtime revisions, file allowlists and hashes, container digests/build-input labels and downstream result receipts |
| Persistence through cache/output | Model mounts read-only where applicable; outputs are synthetic, bounded and ignored; no raw OCR retention decision is implemented |

## Unlimited-OCR custom-code finding

Pinned model revision: `07dea832e22aefee32ad281d4b80551282e1c168`.

The Hugging Face usage path explicitly requires `trust_remote_code=True`. Static review found Python built-in `eval()` over parsed/model-generated strings in `modeling_unlimitedocr.py` at lines 66 and 1099–1128. This is materially different from harmless PyTorch `.eval()` calls. The upstream batch wrapper also copies the complete inherited environment at `infer.py:91` before spawning a server. Running this path inside the ERP process or a secrets-bearing host environment is rejected.

The benchmark's only permitted Unlimited-OCR execution profile is:

- official vLLM release image pinned by immutable digest;
- Docker internal network with no external route during inference;
- model directory mounted read-only;
- no repository, operational database, user profile, SSH directory or host cache mount;
- no inherited host environment or authentication token;
- read-only container filesystem, dropped capabilities and `no-new-privileges`;
- a separate client container that sees only the read-only canonical corpus and its bounded writable result directory;
- exact model prompt/decode contract; document output treated as text.

If this sandbox cannot start on the 8 GiB GPU, the result is `BLOCKED_ENVIRONMENT`; weakening isolation is not an acceptable workaround.

## Other candidate isolation

- Paddle runs in a pinned GPU container with `--network none`. Corpus and model directories are separate read-only mounts; only the ignored results directory is writable. No repository or database is mounted.
- Surya runs from hash-verified local GGUF weights and a verified llama.cpp bundle through an authenticated loopback-only server with a random per-run API key and a stripped environment. No hosted inference is used. Outbound traffic is not OS-denied, so this benchmark does not label Surya `offline=true`; future production use would require container isolation equivalent to Paddle.
- Tesseract receives only admitted/rasterized synthetic paths and a minimal environment with a pinned tessdata directory.

## Data retention recommendation

Retention categories must stay separate in a future release:

- Source document: retain only for the shortest operational review window defined by school policy; encrypted and access-controlled.
- Raw OCR output: transient by default; delete after approval/rejection unless a specific audit policy requires it.
- Rejected candidates and crops: transient; never index in Universal Search or Smart AI.
- Approved authoritative values: persist only through existing domain services and their normal retention rules.
- OCR audit metadata: engine/revision, document hash, timestamps, validation states and operator decision may be retained without copying raw document text unnecessarily.

No retention implementation or deletion claim is made in 1A.

## Public repository policy

Never commit weights, caches, document images/PDFs, raw OCR output, screenshots with private data, tokens, absolute user-profile paths or candidate repository clones. Public-repository and secret scans are release gates. Sanitized evidence may contain synthetic `OCRTEST` strings, hashes, versions and aggregate metrics only.

## Final independent security result

The exact source-frozen 61-file `tools/ocr-benchmark` snapshot received a complete independent Standard security scan: scan `627158cb-c31f-4cae-ad63-e2f28ee506e9`, snapshot `238a5c986a694c2de1402a3dec5606efb761a7a51813bd21ae108ae398fd96f6`, six threat surfaces closed, zero findings and no target warning. The final focused benchmark/security suite passed 36 tests. Third-party upstream internals were covered by immutable metadata/hashes and targeted Unlimited-OCR custom-code review, not by claiming a full audit of every dependency source file.

Unlimited-OCR's final bounded admission reached model load, compiler initialization and memory profiling after routing Triton/TorchInductor helpers to an executable compiler-only ephemeral tmpfs while keeping general `/tmp` non-executable. vLLM then failed with `No available memory for the cache blocks` at 0.85 GPU utilization and 16K context. This is a genuine 8 GiB host-capacity result. It does not justify weakening the custom-code sandbox, and the generated `UNAVAILABLE` zero placeholders are not OCR metrics.
