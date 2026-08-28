import { money } from "@/lib/format";
import { AlertTriangle, CheckCircle2, CircleDashed, Clock3, LockKeyhole, OctagonX, WifiOff } from "lucide-react";

export function PageShell({
  children,
  className = ""
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`page page-shell ${className}`.trim()}>{children}</div>;
}

export function PageHeader({
  title,
  description,
  action
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className = ""
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`card section-card ${className}`.trim()}>
      {title || description || action ? (
        <div className="section-title">
          <div>
            {title ? <h3>{title}</h3> : null}
            {description ? <p>{description}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card stat">
      <span>{label}</span>
      <strong>{typeof value === "number" ? money(value) : value}</strong>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.trim().replaceAll(" ", "_").toUpperCase();
  const label = status.replaceAll("_", " ");
  const tone = /COMPLETED|COMPLETE|SUCCESS|ACTIVE|APPROVED|ACCEPTED|SYNCED|GOOD|FULLY_PAID|HEALTHY|AVAILABLE/.test(normalized)
    ? "success"
    : /FAILED|FAILURE|ERROR|CRITICAL|MISSING|DEFAULTER|CONFLICT/.test(normalized)
      ? "error"
      : /REJECTED|DENIED|CANCELLED|REVOKED/.test(normalized)
        ? "rejected"
        : /LOCKED/.test(normalized)
          ? "locked"
          : /OFFLINE|SERVER_UNAVAILABLE/.test(normalized)
            ? "offline"
            : /DEGRADED|WARNING|WARN|PARTIAL|NEEDS_REVIEW|DRY_RUN|STALE/.test(normalized)
              ? "warning"
              : /PENDING|QUEUED|SYNCING|SUBMITTED|PROCESSING/.test(normalized)
                ? "pending"
                : /DRAFT|LOCAL_ONLY|SAVED_LOCALLY/.test(normalized)
                  ? "draft"
                  : /DISABLED|INACTIVE/.test(normalized)
                    ? "disabled"
                    : /UNAVAILABLE|EXPIRED/.test(normalized)
                      ? "unavailable"
                      : "draft";
  const Icon = tone === "success" ? CheckCircle2
    : tone === "error" || tone === "rejected" ? OctagonX
      : tone === "warning" ? AlertTriangle
        : tone === "pending" ? Clock3
          : tone === "locked" || tone === "disabled" ? LockKeyhole
            : tone === "offline" || tone === "unavailable" ? WifiOff
              : CircleDashed;
  return <span className={`status-badge status-${tone}`} aria-label={`Status: ${label}`}><Icon aria-hidden />{label}</span>;
}

export function EmptyState({
  title,
  description,
  action
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  );
}
