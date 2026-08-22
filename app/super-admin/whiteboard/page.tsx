import { unstable_noStore as noStore } from "next/cache";
import { ExternalLink, LockKeyhole, ShieldCheck, TriangleAlert } from "lucide-react";
import { PageHeader, PageShell, SectionCard } from "@/components/ui";
import { requireRolePermission } from "@/lib/auth";
import { resolveSuperAdminWhiteboardDestination } from "@/lib/super-admin-whiteboard";

export const dynamic = "force-dynamic";

export default async function SuperAdminWhiteboardPage() {
  noStore();
  await requireRolePermission("VIEW_DASHBOARD", "SUPER_ADMIN");
  const destination = resolveSuperAdminWhiteboardDestination();
  const available = destination.status === "AVAILABLE";

  return (
    <PageShell className="whiteboard-page">
      <PageHeader
        title="Whiteboard"
        description="Nalanda ERP planning and project visualization through the canonical external Canvs workspace."
        action={<span className="command-read-only"><LockKeyhole size={17} aria-hidden /> Super Admin only</span>}
      />

      <SectionCard
        title="Canonical Nalanda ERP board"
        description="One governed planning destination; the ERP does not accept alternate board links."
        className="whiteboard-launch-card"
      >
        <div className="whiteboard-card-body">
          <dl className="whiteboard-status-grid" aria-label="Whiteboard bridge status">
            <div>
              <dt>Canonical-board status</dt>
              <dd className={available ? "whiteboard-status-available" : "whiteboard-status-unavailable"}>
                {available ? <ShieldCheck size={18} aria-hidden /> : <TriangleAlert size={18} aria-hidden />}
                {available ? "Verified and available" : "Unavailable"}
              </dd>
            </div>
            <div>
              <dt>Workspace</dt>
              <dd><ExternalLink size={18} aria-hidden /> External workspace</dd>
            </div>
          </dl>

          {available ? (
            <div className="whiteboard-actions">
              <a
                className="button whiteboard-primary-action"
                href={destination.url}
                target="_blank"
                rel="noopener noreferrer"
                referrerPolicy="no-referrer"
                aria-describedby="whiteboard-external-notice"
              >
                Open Canvs Whiteboard <ExternalLink size={18} aria-hidden />
              </a>
              <span>Opens in a new tab</span>
            </div>
          ) : (
            <div className="whiteboard-unavailable" role="alert">
              <TriangleAlert size={22} aria-hidden />
              <div>
                <strong>Whiteboard is unavailable</strong>
                <p>The configured destination does not match the canonical Nalanda ERP board. No external link has been provided.</p>
              </div>
            </div>
          )}

          <div className="whiteboard-external-notice" id="whiteboard-external-notice" role="note">
            <ExternalLink size={20} aria-hidden />
            <div>
              <strong>Board editing happens in Canvs</strong>
              <p>Changes made in Canvs are not stored by the ERP. The ERP does not fetch, copy, cache, or synchronize board contents.</p>
            </div>
          </div>
        </div>
      </SectionCard>
    </PageShell>
  );
}
