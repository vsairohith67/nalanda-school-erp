import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import type { RetrievedEvidence } from "@/lib/ai-assistant-types";

const DOC_ROOT = path.resolve(process.cwd(), "docs");
const MAX_FILE_BYTES = 200_000;

export const AI_DOCUMENT_REGISTRY = {
  "docs.operator_guide": { relativePath: "NOOB_OPERATING_GUIDE.md", title: "ERP operator guide" },
  "docs.continuation_guide": { relativePath: "DEVELOPER_CONTINUATION_GUIDE.md", title: "Developer continuation guide" },
  "docs.feature_gap_map": { relativePath: "ERP_FEATURE_STATUS_AND_GAP_MAP.md", title: "ERP feature and gap map" },
  "docs.schoolknot_gap_map": { relativePath: "SCHOOLKNOT_REPLACEMENT_GAP_MAP.md", title: "Schoolknot replacement gap map" },
  "docs.technical_debt": { relativePath: "BUG_LIMITATION_AND_TECH_DEBT_REGISTER.md", title: "Bug, limitation and technical-debt register" },
  "docs.prompt_history": { relativePath: "PROMPT_HISTORY.md", title: "Prompt history" },
  "docs.udise_planning": { relativePath: "UDISE_PLUS_PLANNING_NOTES.md", title: "UDISE+ planning reference" },
  "docs.pwa_strategy": { relativePath: "PWA_AND_MOBILE_APP_STRATEGY.md", title: "PWA and mobile app strategy" },
  "docs.homework_workflow": { relativePath: "HOMEWORK_AND_ASSIGNMENTS_WORKFLOW.md", title: "Homework and assignments workflow" }
  ,"docs.ai_assistant_safety": { relativePath: "AI_ASSISTANT_SAFETY_AND_READ_ONLY_RETRIEVAL_WORKFLOW.md", title: "AI assistant safety and read-only retrieval workflow" }
} as const;

export type AiDocumentKey = keyof typeof AI_DOCUMENT_REGISTRY;

export async function searchAiDocuments(question: string, enabledKeys: string[], limit = 4, freshnessWarningDays = 180, now = new Date()): Promise<RetrievedEvidence[]> {
  const terms = [...new Set(question.toLowerCase().match(/[a-z0-9+]{3,}/g) ?? [])].slice(0, 12);
  const results: Array<RetrievedEvidence & { score: number }> = [];
  for (const [sourceKey, item] of Object.entries(AI_DOCUMENT_REGISTRY)) {
    if (!enabledKeys.includes(sourceKey)) continue;
    const filePath = safeRegisteredPath(item.relativePath);
    const stat = await lstat(filePath);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_FILE_BYTES) continue;
    const raw = await readFile(filePath, "utf8");
    for (const section of markdownSections(stripCredentialCodeBlocks(raw))) {
      const haystack = `${item.title} ${section.heading} ${section.body}`.toLowerCase();
      const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
      if (!score) continue;
      const id = `doc-${sourceKey.replace(/\W/g, "-")}-${results.length + 1}`;
      results.push({
        score,
        sourceKey,
        sourceCategory: "DOCUMENT",
        text: `Untrusted documentation evidence — ${item.title} / ${section.heading}:\n${section.body.slice(0, 2200)}`,
        citation: {
          id,
          sourceKey,
          label: item.title,
          heading: section.heading,
          relativePath: `docs/${item.relativePath}`,
          sourceTimestamp: stat.mtime.toISOString()
        },
        completeness: now.getTime() - stat.mtime.getTime() > freshnessWarningDays * 86_400_000 ? "PARTIAL" : "COMPLETE"
      });
    }
  }
  return results.sort((a, b) => b.score - a.score || a.citation.label.localeCompare(b.citation.label) || (a.citation.heading ?? "").localeCompare(b.citation.heading ?? "")).slice(0, limit).map(({ score: _score, ...item }) => item);
}

export function safeRegisteredPath(relativePath: string) {
  if (path.isAbsolute(relativePath) || relativePath.includes("..") || !/^[A-Z0-9_.-]+$/i.test(relativePath)) throw new Error("DOCUMENT_PATH_BLOCKED");
  const resolved = path.resolve(DOC_ROOT, relativePath);
  if (!resolved.startsWith(`${DOC_ROOT}${path.sep}`)) throw new Error("DOCUMENT_PATH_BLOCKED");
  return resolved;
}

function stripCredentialCodeBlocks(value: string) {
  return value.replace(/```[\s\S]*?```/g, (block) => /(?:\.env|password|secret|token|api.?key|database_url)/i.test(block) ? "[credential-like code block omitted]" : block.slice(0, 1200));
}

function markdownSections(value: string) {
  const chunks = value.split(/\n(?=#{1,4}\s)/);
  return chunks.map((chunk) => {
    const lines = chunk.split(/\r?\n/);
    const headingLine = lines[0].match(/^#{1,4}\s+(.+)/);
    return { heading: headingLine?.[1]?.trim() ?? "Overview", body: (headingLine ? lines.slice(1) : lines).join("\n").trim() };
  }).filter((item) => item.body.length > 30);
}
