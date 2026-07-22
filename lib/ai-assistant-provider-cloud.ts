import type { AiProviderInput, AiProviderOutput } from "@/lib/ai-assistant-types";

export async function callCloudProvider(_input: AiProviderInput): Promise<AiProviderOutput> {
  throw new Error("CLOUD_PROVIDER_DISABLED_PENDING_REVIEW");
}
