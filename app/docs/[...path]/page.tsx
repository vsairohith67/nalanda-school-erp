import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";

const DOCUMENTS = new Map<string, { file: string; title: string }>([
  ["runbooks/OBS_CORE_DATABASE_RUNBOOK.md", { file: "runbooks/OBS_CORE_DATABASE_RUNBOOK.md", title: "Core Database Runbook" }],
  ["runbooks/OBS_BACKUP_RESTORE_RUNBOOK.md", { file: "runbooks/OBS_BACKUP_RESTORE_RUNBOOK.md", title: "Backup and Restore Runbook" }],
  ["runbooks/OBS_LOW_STORAGE_RUNBOOK.md", { file: "runbooks/OBS_LOW_STORAGE_RUNBOOK.md", title: "Low Storage Runbook" }],
  ["runbooks/OBS_INCIDENT_RESPONSE_RUNBOOK.md", { file: "runbooks/OBS_INCIDENT_RESPONSE_RUNBOOK.md", title: "Incident Response Runbook" }],
  ["runbooks/OBS_JOB_OUTBOX_RUNBOOK.md", { file: "runbooks/OBS_JOB_OUTBOX_RUNBOOK.md", title: "Job and Outbox Runbook" }],
  ["OBS_CLIENT_RELEASE_VERSION_SPECIFICATION.md", { file: "OBS_CLIENT_RELEASE_VERSION_SPECIFICATION.md", title: "Client Release and Version Specification" }],
  ["OBS_PROVIDER_STATUS_POLICY.md", { file: "OBS_PROVIDER_STATUS_POLICY.md", title: "Provider Status Policy" }],
  ["RELEASE_AND_ROLLBACK_RUNBOOK.md", { file: "RELEASE_AND_ROLLBACK_RUNBOOK.md", title: "Release and Rollback Runbook" }],
  ["RELEASE_ENVIRONMENT_AND_SECRET_MATRIX.md", { file: "RELEASE_ENVIRONMENT_AND_SECRET_MATRIX.md", title: "Release Environment and Secret Matrix" }],
  ["RELEASE_CLIENT_PWA_NATIVE_COMPATIBILITY.md", { file: "RELEASE_CLIENT_PWA_NATIVE_COMPATIBILITY.md", title: "Client Compatibility Contract" }],
  ["evidence/RELEASE_OPS_1A_QA_CLEARANCE.md", { file: "evidence/RELEASE_OPS_1A_QA_CLEARANCE.md", title: "Release Operations QA Clearance" }]
]);

export const dynamic = "force-dynamic";

export default async function OperationalDocumentPage({ params }: { params: Promise<{ path: string[] }> }) {
  noStore();
  await requirePermission("VIEW_TECHNICAL_OPERATIONS_SUMMARY");
  const requestedPath = (await params).path.join("/");
  const document = DOCUMENTS.get(requestedPath);
  if (!document) notFound();

  const docsRoot = path.resolve(process.cwd(), "docs");
  const absolutePath = path.resolve(docsRoot, document.file);
  if (!absolutePath.startsWith(`${docsRoot}${path.sep}`)) notFound();
  const contents = await readFile(absolutePath, "utf8").catch(() => null);
  if (contents === null) notFound();

  return (
    <div className="page technical-operations-page">
      <PageHeader title={document.title} description="Authenticated, repository-backed operational guidance." />
      <div className="page-actions"><Link className="button secondary" href="/technical-operations">Back to Technical Operations</Link></div>
      <article className="card" aria-label={document.title}>
        <pre style={{ margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontFamily: "inherit", lineHeight: 1.6 }}>{contents}</pre>
      </article>
    </div>
  );
}
