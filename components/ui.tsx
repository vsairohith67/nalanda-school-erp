import { money } from "@/lib/format";

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
        <h2>{title}</h2>
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
  const className =
    status === "Fully Paid" || status === "Good" || status === "COMPLETED" || status === "Completed"
      ? "badge success"
      : status === "Defaulter" || status === "Needs Review" || status === "Missing" || status === "Critical" || status === "FAILED" || status === "Failed"
        ? "badge danger"
        : status === "Partial Paid" || status === "Split Payment" || status === "Warning" || status === "PARTIAL" || status === "DRY_RUN" || status === "Partial" || status === "Dry Run"
          ? "badge warn"
          : "badge";
  return <span className={className}>{status.replaceAll("_", " ")}</span>;
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
