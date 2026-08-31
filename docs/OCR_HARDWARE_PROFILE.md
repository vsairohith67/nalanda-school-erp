# OCR Benchmark 1A Hardware Profile

Captured locally on 2026-08-30. This is a development-machine profile, not a claim about school hardware.

## Development host

| Component | Observed value |
| --- | --- |
| OS | Windows 11 Home Single Language, build 26200 |
| CPU | Intel Core i7-11800H, 8 physical / 16 logical cores |
| RAM | 42,636,668,928 bytes installed, approximately 39.7 GiB |
| Discrete GPU | NVIDIA GeForce RTX 3070 Laptop GPU, compute capability 8.6 |
| VRAM | 8,192 MiB nominal; 8,018 MiB reported by the local llama.cpp Vulkan runtime |
| NVIDIA driver | 591.59; driver API reports CUDA 13.1 capability |
| Integrated GPU | Intel UHD Graphics |
| Free system-disk space at baseline | 377,511,239,680 bytes |
| Python | CPython 3.12.10 for the benchmark; `uv` 0.12.5 |
| Container runtime | Docker Desktop 29.7.2, Linux containers, NVIDIA runtime present |
| Local VLM runtime | llama.cpp build 10679, commit `50f068fff`, Vulkan backend |

Classification: `MID_RANGE_GPU`. The GPU is useful for small document VLMs and mobile OCR pipelines, but 8 GiB is a hard boundary rather than comfortable capacity for BF16 3B-class models.

## Runtime observations

The benchmark records per-document latency, cold start, process RAM and, where the runtime exposes it, VRAM. Generative engines that do not expose calibrated field confidence are marked unsupported rather than assigned a fabricated score. Container/image sizes and model weights are reported separately from working memory.

The Windows Paddle GPU wheel was probed and could enumerate the RTX 3070, but its installation check failed because `cublas64_12.dll` was not installed system-wide. The final benchmark therefore uses a pinned Linux GPU container whose CUDA libraries are isolated from the host. This avoids a broad CUDA Toolkit installation merely for a benchmark.

## Deployment classes

### Low-cost office CPU machine

- Modern 8-core / 16-thread x86-64 CPU with AVX2.
- 16 GiB RAM minimum; 32 GiB preferred for concurrent scan queues.
- SSD with at least 50 GiB free for bounded temporary pages, logs and model cache.
- No requirement for a 3B-class model.
- Intended architecture: small printed-text engine plus explicit human review; handwriting and complex pages remain manual or go to an optional dedicated worker.

### Office machine with a modest GPU

- NVIDIA GPU with at least 8 GiB VRAM, current driver, 32 GiB system RAM.
- Suitable for PP-OCR mobile models and small document VLM experiments.
- Not a promise that every 3B BF16 model will start reliably alongside a desktop ERP workload.

### Dedicated OCR workstation

- NVIDIA GPU with 12–16 GiB VRAM, 32–64 GiB RAM and a fast SSD.
- Recommended only if measured fallback volume justifies a local document VLM.
- Run the OCR worker as a separate, sandboxed service; do not co-locate model caches or arbitrary custom code with the ERP process.

### Developer high-performance workstation

- 24 GiB or more VRAM and 64 GiB RAM is the comfortable class for evaluating multiple document VLMs, long contexts and concurrent jobs.
- This is a development/test profile, not the default purchase recommendation for a school office.

The final purchase recommendation must follow the measured throughput and fallback rate in `OCR_ARCHITECTURE_DECISION.md`; model popularity is not a hardware requirement.
