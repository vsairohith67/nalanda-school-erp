import { PageHeader, StatusBadge } from "@/components/ui";
import { AiEvaluationRunButton } from "@/components/ai-assistant-ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureAiAssistantFoundation } from "@/lib/ai-assistant-profiles";

export default async function AiAssistantEvaluationsPage() {
  await requirePermission("RUN_AI_ASSISTANT_EVALUATIONS"); await ensureAiAssistantFoundation(prisma);
  const [cases, runs] = await Promise.all([prisma.aiAssistantEvaluationCase.findMany({ orderBy: { caseCode: "asc" } }), prisma.aiAssistantEvaluationRun.findMany({ take: 20, orderBy: { createdAt: "desc" } })]);
  return <div className="page ai-assistant-page"><PageHeader title="AI Assistant Evaluations" description="Synthetic deterministic safety, permission, citation and retrieval regression cases. No real Student or Staff data is used." action={<AiEvaluationRunButton />} />
    <section className="card"><h3>Active synthetic cases</h3><div className="table-wrap"><table><thead><tr><th>Case</th><th>Category</th><th>Expected</th><th>Question</th></tr></thead><tbody>{cases.map((row) => <tr key={row.id}><td>{row.caseCode}</td><td>{row.category}</td><td><StatusBadge status={row.expectedDecision} /></td><td>{row.question}</td></tr>)}</tbody></table></div></section>
    <section className="card"><h3>MOCK runs</h3><div className="table-wrap"><table><thead><tr><th>Run</th><th>Completed</th><th>Passed</th><th>Failed</th><th>Blocked decisions</th></tr></thead><tbody>{runs.map((row) => <tr key={row.id}><td>{row.runNumber}</td><td>{row.completedAt?.toLocaleString("en-IN") ?? "Running"}</td><td>{row.passedCases}/{row.totalCases}</td><td>{row.failedCases}</td><td>{row.blockedCases}</td></tr>)}{!runs.length ? <tr><td colSpan={5}>No evaluation run yet.</td></tr> : null}</tbody></table></div></section>
  </div>;
}
