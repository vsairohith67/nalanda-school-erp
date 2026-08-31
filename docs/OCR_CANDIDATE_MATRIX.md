# OCR Candidate Matrix

The candidate lock at `tools/ocr-benchmark/candidates/candidate-lock.json` is authoritative for immutable revisions and expected hashes. Repository licences and model-weight licences were reviewed separately.

## Supply chain and capability

| Candidate | Pinned source/model | Licence result | Local runtime | Document/language fit | Trust boundary |
| --- | --- | --- | --- | --- | --- |
| Baidu Unlimited-OCR 3B | Git `d49ff64afffc1f47ab563dc1c589bc2f78808fa4`; HF `07dea832e22aefee32ad281d4b80551282e1c168` | Code/model metadata and downloaded weight licence: MIT | Official vLLM image by digest; Transformers path exists; SGLang support not verified | Single-page image parsing with structured detector tokens; PDFs require bounded page rasterization; multilingual claim requires measured Indic evidence | Mandatory `trust_remote_code`; built-in `eval()` over parsed/model strings; only permitted in the no-outbound custom-code sandbox |
| PaddleOCR classic PP-OCRv5 mobile | Git `2661c7c0ef5c613e8f93c6e93b2e052399f0f854`; `paddleocr==3.7.0`; four model revisions in lock | Apache-2.0 code and selected official weights | Locked Paddle 3.3.1 GPU environment in pinned Linux base | Dedicated English, Devanagari and Telugu recognizers, geometric regions and recognition confidence; PDFs rasterized page-by-page | Native/CUDA dependencies, but no remote model code; network disabled and input/model mounts read-only |
| Tesseract baseline | Stable tag 5.5.3 reviewed; measured runtime 5.4.0.20240606; tessdata_best `e12c65a` | Apache-2.0 code/traineddata | Native CPU process with bounded argv/output/time and minimal environment | Simple offline printed OCR for English/Hindi/Telugu; no form semantics; PDFs rasterized | Lowest runtime complexity; confidence exists but benchmark calibration is required |
| Surya OCR 2 GGUF | Source v0.22.1 `3a70081f6a60013dab818c82ab99451aa290f389`; HF `6a3a4c30e5e74446d4f8b6afd05b2f2da970f470` | Code Apache-2.0; weights modified OpenRAIL-M with organization/revenue/competitive-use restrictions. Production eligibility unresolved. | llama.cpp build 10679 / `50f068fff`, authenticated loopback, Vulkan GPU | Strong structured HTML/bounding-box output on simple forms and synthetic handwriting; page-sequential PDF wrapper | No trustworthy field confidence; restrictive weight terms block recommendation until counsel/rights-holder clearance |

Official references: [Unlimited-OCR repository](https://github.com/baidu/Unlimited-OCR), [Unlimited-OCR model](https://huggingface.co/baidu/Unlimited-OCR), [official vLLM recipe](https://recipes.vllm.ai/baidu/Unlimited-OCR), [PaddleOCR repository](https://github.com/PaddlePaddle/PaddleOCR), [PaddleOCR pipeline documentation](https://www.paddleocr.ai/main/en/version3.x/pipeline_usage/OCR.html), [PP-OCR multilingual models](https://www.paddleocr.ai/v3.3.0/en/version3.x/algorithm/PP-OCRv5/PP-OCRv5_multi_languages.html), [Tesseract documentation](https://github.com/tesseract-ocr/tesseract/blob/main/doc/tesseract.1.asc), [Surya repository](https://github.com/datalab-to/surya) and [Surya GGUF model](https://huggingface.co/datalab-to/surya-ocr-2-gguf).

## Why classic PaddleOCR was selected instead of PaddleOCR-VL

PaddleOCR-VL was reviewed as the current official document-VLM family, including its local pipeline documentation and model revision. For this benchmark, the classic PP-OCRv5 mobile combination is the more relevant stable Paddle candidate because it exposes explicit English, Devanagari and Telugu recognizers, source polygons and recognition scores while fitting ordinary hardware. A second generative document model would duplicate the heavy-engine class already represented by mandatory Unlimited-OCR and additional Surya, increase GPU/runtime burden, and provide less explicit script control. This is a suitability decision, not a claim that PP-OCRv5 is newer or universally more accurate than PaddleOCR-VL.

## Runtime and distribution facts

| Candidate | Selected weight size | Expected hardware | Offline result definition | Distribution/attribution |
| --- | ---: | --- | --- | --- |
| Unlimited-OCR | 6,672,547,120-byte safetensors file plus tokenizer/config | Upstream recipe says at least 8 GiB GPU; 8 GiB is treated as a boundary, not comfortable capacity | Complete pinned snapshot and vLLM image present before Docker internal-network inference | Preserve MIT notice; no weights are committed or released by Nalanda |
| PaddleOCR | 28,124,106 bytes across selected detector/recognizers | CPU feasible; modest NVIDIA GPU optional for queue throughput | All four models preloaded; container runs with `--network none` | Preserve Apache notices/model provenance; weights stay outside Git |
| Tesseract | 46,957,687 bytes across selected `eng`/`hin`/`tel`/`osd` traineddata | Ordinary office CPU | Native executable plus pinned local tessdata; no network call | Preserve Apache notices; traineddata remains external benchmark cache |
| Surya | 1,471,387,552 bytes for GGUF plus projector | 8 GiB-class GPU measured; CPU-only not assessed as practical | Local files and authenticated llama.cpp loopback; proxy/offline flags set, but outbound traffic is not OS-denied | Attribution/share-alike/use restrictions apply; production blocked pending licence determination |

## Confidence and output structure

- PaddleOCR and Tesseract expose recognition confidence and regions. Their numeric scores are evidence, not authoritative probability; calibration tables compare confidence buckets to exact-field accuracy.
- Surya and Unlimited-OCR do not expose trustworthy field confidence in the tested interfaces. They remain `UNKNOWN` unless cross-engine agreement, deterministic validators and source evidence support an `AMBER`/`GREEN` review state.
- Every engine output is normalized as untrusted text/regions inside benchmark tooling. No normalized type is a Prisma model.
- Validators only flag `VALID_FORMAT`, `INVALID_FORMAT`, `AMBIGUOUS` or `MISSING`; they never silently correct OCR text.

## Licence and recommendation rule

An unresolved model-weight licence blocks production recommendation even when quality is strong. A repository's code licence is not substituted for its weights. Custom code with an executable parsing boundary cannot run in the ERP process or inherit secrets. These gates are evaluated before the weighted quality score; a high recognition score cannot override them.

No separate dataset-use restriction was identified in the official selected Unlimited-OCR, Paddle or Tesseract distribution metadata; this benchmark does not redistribute their training data. Surya's modified weight licence explicitly says training data is not licensed and adds output/share-alike and commercial restrictions, which is another reason it remains ineligible for the selected production path.

## Measured decision summary

| Candidate | Exact / critical field | English / Hindi / Telugu | Handwriting-like | Hallucination | Layout / PDF | Runtime | Final role |
| --- | --- | --- | ---: | --- | --- | --- | --- |
| PaddleOCR | 0.8802 / 0.8852 | 0.9042 / 0.8750 / 0.8333 | 0.7222 | critical 0 | table 0.2688; order 0.5627; PDF 0.9184 | p50 232.9 ms; p95 1,161.6 ms; 0.96 GB VRAM | `PRIMARY` for future human-reviewed 1B |
| Tesseract | 0.5951 / 0.5951 | 0.6458 / 0.0833 / 0.1667 | 0 | critical 0.0067 | table 0.0600; order 0.6009; PDF 0.5839 | p50 1,306.7 ms; p95 3,585.6 ms; CPU-only | `CPU_BASELINE`; no automatic fallback |
| Surya | 0.5628 / 0.5628 | 0.4917 / 1.0000 / 1.0000 | 1.0000 synthetic only | critical 0 | table 0.2363; order 0.5599; PDF 0.2460 | p50 4,935 ms; p95 24,973 ms; 2.50 GB VRAM | `REJECTED` by weight-licence gate |
| Unlimited-OCR | Not measured | Not measured | Not measured | Not measured | Not measured | model loaded; 8 GiB host had no KV-cache blocks | `REJECTED` from 1B; research-only reconsideration on 12–16 GiB |

The three completed-engine weighted scores are Paddle `88.46`, Tesseract `74.58` and Surya `56.70` (licence-ineligible). Unlimited is deliberately unscored. Full score inputs and caveats are in [OCR_ARCHITECTURE_DECISION.md](OCR_ARCHITECTURE_DECISION.md).
