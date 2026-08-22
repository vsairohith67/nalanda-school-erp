import {
  SMART_AI_LIMITS,
  type SmartAiProviderInput,
  type SmartAiProviderStatus
} from "@/lib/smart-ai-contract";
import { disabledSmartAiProvider, SmartAiProviderError, type SmartAiProvider } from "@/lib/smart-ai-provider";

const LOOPBACK_ENDPOINT = /^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?(?:\/[^?#\s]*)?$/i;

export function validateSmartAiLocalEndpoint(value: string) {
  const trimmed = value.trim();
  if (!LOOPBACK_ENDPOINT.test(trimmed)) throw new SmartAiProviderError("LOCAL_ENDPOINT_BLOCKED", "The local Smart AI endpoint must use an exact loopback HTTP address.");
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new SmartAiProviderError("LOCAL_ENDPOINT_INVALID", "The local Smart AI endpoint is invalid.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (url.protocol !== "http:" || !["localhost", "127.0.0.1", "::1"].includes(host) || url.username || url.password || url.search || url.hash) {
    throw new SmartAiProviderError("LOCAL_ENDPOINT_BLOCKED", "The local Smart AI endpoint must use an exact loopback HTTP address.");
  }
  if (url.port && (Number(url.port) < 1 || Number(url.port) > 65_535)) {
    throw new SmartAiProviderError("LOCAL_ENDPOINT_INVALID", "The local Smart AI endpoint port is invalid.");
  }
  return url;
}
export function smartAiProviderTimeout(value = process.env.SMART_AI_LOCAL_TIMEOUT_MS) {
  if (!value) return SMART_AI_LIMITS.defaultProviderTimeoutMs;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < SMART_AI_LIMITS.minimumProviderTimeoutMs || parsed > SMART_AI_LIMITS.maximumProviderTimeoutMs) {
    throw new SmartAiProviderError("LOCAL_TIMEOUT_INVALID", `Local provider timeout must be ${SMART_AI_LIMITS.minimumProviderTimeoutMs}-${SMART_AI_LIMITS.maximumProviderTimeoutMs} ms.`);
  }
  return parsed;
}

export function createLocalSmartAiProvider(
  endpointValue: string,
  options: { timeoutMs?: number; fetcher?: typeof fetch } = {}
): SmartAiProvider {
  const endpoint = validateSmartAiLocalEndpoint(endpointValue);
  const timeoutMs = options.timeoutMs ?? smartAiProviderTimeout();
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < SMART_AI_LIMITS.minimumProviderTimeoutMs || timeoutMs > SMART_AI_LIMITS.maximumProviderTimeoutMs) {
    throw new SmartAiProviderError("LOCAL_TIMEOUT_INVALID");
  }
  const status: SmartAiProviderStatus = {
    kind: "LOCAL",
    state: "READY",
    message: "A loopback-only local AI runtime is configured. ERP evidence cannot be redirected to another host."
  };
  return {
    status,
    async generate(input, signal) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(new Error("LOCAL_PROVIDER_TIMEOUT")), timeoutMs);
      const abort = () => controller.abort(signal?.reason);
      signal?.addEventListener("abort", abort, { once: true });
      try {
        const response = await (options.fetcher ?? fetch)(endpoint, {
          method: "POST",
          redirect: "manual",
          cache: "no-store",
          credentials: "omit",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(localProviderPayload(input)),
          signal: controller.signal
        });
        if (response.status >= 300 && response.status < 400) {
          throw new SmartAiProviderError("LOCAL_PROVIDER_REDIRECT_BLOCKED", "Local provider redirects are disabled.");
        }
        if (!response.ok) throw new SmartAiProviderError("LOCAL_PROVIDER_HTTP_ERROR");
        const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
        if (contentType !== "application/json") throw new SmartAiProviderError("LOCAL_PROVIDER_CONTENT_TYPE");
        const declaredLength = Number(response.headers.get("content-length") ?? 0);
        if (declaredLength > SMART_AI_LIMITS.maximumProviderResponseBytes) throw new SmartAiProviderError("LOCAL_PROVIDER_RESPONSE_LARGE");
        const text = await boundedResponseText(response, SMART_AI_LIMITS.maximumProviderResponseBytes);
        try {
          return JSON.parse(text) as unknown;
        } catch {
          throw new SmartAiProviderError("LOCAL_PROVIDER_JSON_INVALID");
        }
      } catch (error) {
        if (error instanceof SmartAiProviderError) throw error;
        if (controller.signal.aborted) throw new SmartAiProviderError("LOCAL_PROVIDER_TIMEOUT", "The local Smart AI runtime timed out.");
        throw new SmartAiProviderError("LOCAL_PROVIDER_UNAVAILABLE");
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
      }
    }
  };
}

export function getSmartAiProvider(): SmartAiProvider {
  const mode = (process.env.SMART_AI_PROVIDER ?? "DISABLED").trim().toUpperCase();
  if (!mode || mode === "DISABLED") return disabledSmartAiProvider();
  if (mode !== "LOCAL") return disabledSmartAiProvider("Smart AI provider configuration is unsupported and has been disabled safely.");
  const endpoint = process.env.SMART_AI_LOCAL_ENDPOINT?.trim();
  if (!endpoint) return disabledSmartAiProvider("The local Smart AI runtime endpoint is not configured.");
  try {
    return createLocalSmartAiProvider(endpoint);
  } catch {
    return {
      ...disabledSmartAiProvider("The local Smart AI runtime configuration is invalid and has been disabled safely."),
      status: { kind: "LOCAL", state: "MISCONFIGURED", message: "The local Smart AI runtime configuration is invalid and has been disabled safely." }
    };
  }
}

export function getSmartAiProviderStatus() {
  return getSmartAiProvider().status;
}

function localProviderPayload(input: SmartAiProviderInput) {
  return {
    system: input.systemInstructions,
    question: input.question,
    conversation: input.conversation,
    sources: input.sources.map((source) => ({
      id: source.id,
      module: source.module,
      type: source.type,
      title: source.title,
      summary: source.summary,
      status: source.status,
      timestamp: source.timestamp
    })),
    context: input.serializedContext,
    output: {
      format: "json",
      schema: { answer: "string", citations: ["SOURCE_ID"], uncertainty: "optional string" },
      maximumAnswerCharacters: input.maximumAnswerCharacters,
      reasoning: "not requested"
    }
  };
}

async function boundedResponseText(response: Response, limit: number) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new SmartAiProviderError("LOCAL_PROVIDER_RESPONSE_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
