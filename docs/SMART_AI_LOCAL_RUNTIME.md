# Smart AI Local Runtime

Status: qualified on 22 August 2026 for one workstation only.

The committed safe default remains `SMART_AI_PROVIDER=DISABLED`. This document qualifies an optional `LOCAL` runtime; it does not activate Cloud AI, AI actions, direct SQL, embeddings, a vector database, web browsing, file ingestion, or autonomous tools.

## Governed boundary

- Smart AI remains `SUPER_ADMIN` only and read-only.
- Universal Search is the only ERP retrieval layer. The model receives only the bounded, permission-filtered Search evidence selected by the existing Smart AI service.
- The ERP calls the local gateway at `127.0.0.1`; the gateway calls Ollama at `127.0.0.1`. Neither listener may use `0.0.0.0`, a LAN address, or a public address.
- The gateway refuses non-loopback peers and every browser `Origin`. It does not enable CORS.
- The model returns only `answer` and `citations`, with optional `uncertainty`. The existing Smart AI validator rejects malformed JSON, unknown citation IDs, generated URLs, oversized answers, and unsupported claims.
- Questions, retrieved ERP context, and answers are not logged by the gateway or stored as chat history.

## Measured workstation

The audit excluded serial numbers and other device identifiers.

| Component | Measured result |
| --- | --- |
| CPU | Intel Core i7-11800H, 8 cores / 16 logical processors |
| System RAM | 40.0 GiB installed; 22.32 GiB available at audit |
| Discrete GPU | NVIDIA GeForce RTX 3070 Laptop GPU |
| GPU VRAM | 8,192 MiB |
| Integrated GPU | Intel UHD Graphics; deliberately not selected for inference |
| GPU runtime | NVIDIA driver 591.59; CUDA 13.1; compute capability 8.6 |
| Disk | 805.85 GiB total on the system volume; 384.81 GiB available at audit |
| Windows | Windows 11 Home Single Language, 64-bit, version 10.0.26200 build 26200 |
| Other acceleration | Ollama CUDA and Vulkan discovery available; ROCm and OpenCL command-line runtimes were not detected |

The available 8 GiB of discrete VRAM, not the product name alone, determined the model-size boundary. A 7B-class model was not assumed to be appropriate.

## Runtime discovery and selection

Ollama 0.32.13 was already installed at user level. No administrator privilege, system-wide service installation, or second inference runtime was needed. No active LM Studio local server or separate llama.cpp-compatible server was selected.

Ollama was chosen because it is the existing user-level, headless-capable runtime, exposes a stable local `/api/chat` contract, supports constrained JSON output, and can be bound to one exact loopback address. The qualification used only the official Ollama Library registry. No random model URL or executable model artifact was used.

The desktop/tray launch path was not accepted for ERP inference because its initial default listener was broader than the governed boundary and its updater can perform catalog/update traffic. The accepted runtime is a separate headless `ollama serve` process with `OLLAMA_HOST=127.0.0.1:11434` and `OLLAMA_NO_CLOUD=1`.

## Model qualification

Both candidates used Apache-2.0 licensed Qwen models from the official Ollama Library and an 8,192-token bounded context. Registry digests are the model-file integrity pins available from Ollama.

| Candidate | Exact tag and configuration | Registry digest | Download | Result |
| --- | --- | --- | --- | --- |
| Selected | `qwen3:4b-instruct-2507-q4_K_M`, 4.0B, GGUF `Q4_K_M`, thinking disabled | `0edcdef34593eac1aa2be9c7d06c432dcf81945adca5eca2f27662c18f168ba0` | 2,497,293,803 bytes | 19/19 synthetic cases passed; best fit for this workstation |
| Compared | `qwen3:8b-q4_K_M`, 8.2B, GGUF `Q4_K_M`, thinking disabled | `500a1f067a9f782620b40bee6f7b0c89e17ae61f686b92c24933e4ca4b2b8b41` | 5,225,388,164 bytes | 19/19 passed, but slower and spilled about 1.52 GB outside VRAM |

Sources: [official Ollama tag registry](https://ollama.com/library/qwen3/tags), [Ollama structured outputs](https://docs.ollama.com/capabilities/structured-outputs), and [Qwen3 licensing/model information](https://qwenlm.github.io/blog/qwen3/).

The 4B instruct model was selected because it had reliable JSON and citation behavior while leaving materially more VRAM headroom. The 8B comparison is not the workstation default.

## Quality and performance evidence

The synthetic set covered Students, Admissions, Staff, Diary, Tasks, Contacts, Exams, Reports, Support, no-evidence refusal, the four retrieved-content injection phrases, and five prohibited write requests. It used no real school records.

| Measurement | Selected 4B | Compared 8B |
| --- | ---: | ---: |
| Cases | 19/19 pass | 19/19 pass |
| Citation validity | 100% | 100% |
| Instruction following | 100% | 100% |
| Cold total response | 5,833.16 ms | 8,097.05 ms |
| Cold first token | 5,425.92 ms | 6,902.41 ms |
| Model load duration | 5,228.25 ms | 6,514.64 ms |
| Warm median | 648.00 ms | 2,089.45 ms |
| Warm p95 | 936.81 ms | 2,839.97 ms |
| Median generation rate | 107.87 tokens/s | 17.85 tokens/s |
| Two concurrent requests | 1,033.16 ms; no leakage | 2,892.00 ms; no leakage |
| Runtime allocation reported by Ollama | 5,081,325,895 bytes, all in VRAM | 7,783,369,931 bytes total; 6,264,811,683 bytes in VRAM |

The acceptance target for this measured workstation is: cold answer and first token within 10 seconds, warm p95 within 3 seconds, at least 15 tokens/s, two bounded concurrent requests within 5 seconds without context leakage or crash, and no more than 6 GiB selected-model VRAM allocation. The selected model passed every target.

During an integrated cold answer, end-to-end gateway time was 5,235.04 ms. The sampled peak was 87% GPU use and 5,013 MiB GPU memory; total CPU use averaged about 0.6% of the 16-logical-processor machine during the sample. The Ollama parent process working set was 162 MiB at that point; runner and operating-system allocations vary.

## Privacy and network evidence

- Ollama listened only on `127.0.0.1:11434`; the gateway listened only on `127.0.0.1:11435`.
- A LAN-address connection attempt failed. An unapproved web origin received HTTP 403 with no `Access-Control-Allow-Origin` response header.
- Process-owned TCP connections were sampled throughout live inference. There were zero external inference connections and zero cloud fallbacks.
- The gateway writes no prompts or ERP context to logs. Ollama request-body debug logging was explicitly disabled.
- Initial GUI updater/catalog traffic was observed and separated from inference. It occurred before the accepted headless configuration. With `OLLAMA_NO_CLOUD=1`, inference remained local; model download traffic occurred only while pulling the two official registry candidates.
- The committed repository contains no model file, machine-specific executable path, prompt log, temporary model output, or workstation secret.

## Start and verify

Quit any Ollama tray application first so that a default listener cannot compete with the governed headless listener.

In PowerShell terminal 1:

```powershell
$env:OLLAMA_HOST = "127.0.0.1:11434"
$env:OLLAMA_NO_CLOUD = "1"
$env:OLLAMA_DEBUG_LOG_REQUESTS = "0"
$env:OLLAMA_ORIGINS = "http://localhost:3000,http://127.0.0.1:3000"
$env:OLLAMA_NUM_PARALLEL = "2"
$env:OLLAMA_MAX_LOADED_MODELS = "1"
$env:OLLAMA_KEEP_ALIVE = "5m"
ollama serve
```

The already-qualified model can be restored only from the official registry if it is missing:

```powershell
ollama pull qwen3:4b-instruct-2507-q4_K_M
$tags = Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/tags"
$tags.models | Where-Object name -eq "qwen3:4b-instruct-2507-q4_K_M" | Select-Object name, digest, size
```

Do not continue unless the displayed digest exactly matches the selected digest above.

In PowerShell terminal 2:

```powershell
$env:SMART_AI_LOCAL_MODEL = "qwen3:4b-instruct-2507-q4_K_M"
$env:SMART_AI_LOCAL_MODEL_DIGEST = "0edcdef34593eac1aa2be9c7d06c432dcf81945adca5eca2f27662c18f168ba0"
$env:SMART_AI_OLLAMA_ENDPOINT = "http://127.0.0.1:11434/api/chat"
$env:SMART_AI_LOCAL_GATEWAY_PORT = "11435"
$env:SMART_AI_LOCAL_GATEWAY_TIMEOUT_MS = "25000"
pnpm.cmd smart-ai:local-gateway
```

The gateway verifies the installed registry digest before it starts. Verify both listeners:

```powershell
Get-NetTCPConnection -State Listen -LocalPort 11434,11435 |
  Select-Object LocalAddress, LocalPort, OwningProcess
```

Every `LocalAddress` must be `127.0.0.1`.

## Enable LOCAL on this workstation

Use only a private workstation environment override; do not edit the committed default:

```dotenv
SMART_AI_PROVIDER=LOCAL
SMART_AI_LOCAL_ENDPOINT=http://127.0.0.1:11435/generate
SMART_AI_LOCAL_TIMEOUT_MS=30000
```

Restart the ERP after changing the override. Start order is Ollama, local gateway, then ERP. The page and API continue to enforce `SUPER_ADMIN`, and the service continues to call Universal Search before the model.

## Stop or revert

Use `Ctrl+C` in the ERP, gateway, and Ollama terminals. Confirm that ports 11434 and 11435 no longer have listeners. To disable local inference, set the private override back to:

```dotenv
SMART_AI_PROVIDER=DISABLED
```

Restart the ERP. `DISABLED` is the repository default and the emergency rollback.

## Failure behavior

| Failure | Required behavior, verified in QA |
| --- | --- |
| Runtime stopped | HTTP failure is converted to a safe provider-failure message; authorised Search evidence may be previewed; no generated answer is accepted |
| Model missing or digest changed | Gateway refuses to start |
| Timeout | Smart AI reports that the local runtime timed out; no ERP record changes |
| Malformed JSON or citation | Existing schema/citation validation rejects the output safely |
| Simulated out-of-memory/runtime error | Generic safe failure; runtime details, paths, and model error text are not exposed |
| Too many concurrent requests | Gateway returns a bounded busy failure instead of expanding memory without limit |
| No Search evidence | Smart AI refuses to guess and preserves degraded/unavailable Search states |

Desktop and 390 by 844 mobile browser QA confirmed the ready state, grounded answer, validated Sources, no-evidence refusal, timeout, runtime-unavailable behavior, and no horizontal overflow. A Principal received `Access Restricted`; the API role tests independently deny every non-`SUPER_ADMIN` role.

Cloud AI remains **NOT ACTIVATED**. AI Actions remain **FUTURE/BLOCKED**.
