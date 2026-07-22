import type { AiProviderInput, AiProviderOutput } from "@/lib/ai-assistant-types";

export async function callMockProvider(input: AiProviderInput): Promise<AiProviderOutput> {
  const q = input.question.toLowerCase();
  if (q.includes("qa20a malformed output")) return { answer: "<script>unsafe</script>", citationIds: ["fabricated"] };
  if (q.includes("qa20a missing citation")) return { answer: "A factual answer without evidence.", citationIds: [] };
  if (q.includes("qa20a timeout")) throw new Error("PROVIDER_TIMEOUT");
  if (!input.context.length) {
    return { answer: "I do not have enough authorised information to answer that.", citationIds: [], refusal: "INSUFFICIENT_AUTHORISED_EVIDENCE" };
  }
  const evidence = input.context.map((item) => item.text).join("\n").slice(0, 6000);
  const prefix = input.context[0].sourceCategory === "DOCUMENT"
    ? "Documentation evidence"
    : "Aggregate operational evidence";
  return {
    answer: `${prefix}:\n\n${evidence}\n\nInterpretation: this is a read-only summary. Verify important decisions against the cited source; operational decisions remain with authorised school leadership.`,
    citationIds: input.context.map((item) => item.citation.id),
    uncertaintyNotice: input.context.some((item) => item.completeness !== "COMPLETE")
      ? "Some authorised evidence is partial, stale, or unavailable."
      : undefined
  };
}
