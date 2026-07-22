import type { AiProviderInput, AiProviderOutput } from "@/lib/ai-assistant-types";

export function validateLocalAiEndpoint(value: string) {
  const url = new URL(value);
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "::1"].includes(host) || url.username || url.password) {
    throw new Error("LOCAL_PROVIDER_ENDPOINT_BLOCKED");
  }
  return url;
}

export async function callLocalProvider(_input: AiProviderInput): Promise<AiProviderOutput> {
  const configured = process.env.AI_ASSISTANT_LOCAL_ENDPOINT;
  if (configured) validateLocalAiEndpoint(configured);
  throw new Error("LOCAL_PROVIDER_DISABLED");
}
