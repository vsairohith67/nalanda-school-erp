import { StatusBadge } from "@/components/ui";
import type { AppInfo } from "@/lib/app-info";
import type { SystemHealth } from "@/lib/system-health";
import { roleDisplayLabel } from "@/lib/role-presentation";

export function SystemHealthPanel({
  health,
  appInfo
}: {
  health: SystemHealth;
  appInfo: AppInfo;
}) {
  return (
    <section className="card card-pad">
      <div className="section-title inline-section-title">
        <div>
          <h3>Core application health</h3>
          <p>Restricted technical details for authorised school leadership.</p>
        </div>
        <StatusBadge status={health.status} />
      </div>

      <div className="health-panel-section">
        <h4>Core application health</h4>
        <div className="system-info-grid">
          <div><span>Application</span><strong>{appInfo.name}</strong></div>
          <div><span>Version</span><strong>{appInfo.version}</strong></div>
          <div><span>Build mode</span><strong>{appInfo.buildMode}</strong></div>
          <div><span>Data provider</span><strong>{appInfo.databaseProvider}</strong></div>
        </div>
      </div>

      <div className="health-panel-section">
        <div className="section-title inline-section-title">
          <div>
            <h4>Deployment readiness</h4>
            <p>Release gates and account-origin checks; this is not continuous monitoring.</p>
          </div>
          <StatusBadge status={health.issues.length ? "Review" : "Ready"} />
        </div>
        {health.seedAccounts.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Seed-origin role</th>
                  <th>Enabled</th>
                  <th>Documented-password matches</th>
                  <th>Operator decision</th>
                </tr>
              </thead>
              <tbody>
                {health.seedAccounts.map((row) => (
                  <tr key={row.role}>
                    <td>{roleDisplayLabel(row.role)}</td>
                    <td>{row.activeCount}</td>
                    <td>{row.defaultPasswordMatches}</td>
                    <td>{row.decisionRecorded ? "Recorded" : "Required"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {health.issues.length ? (
          <div className="health-issues">
            {health.issues.map((issue) => (
              <div className={`health-issue ${issue.severity}`} key={issue.code}>
                <div>
                  <strong>{issue.message}</strong>
                  <p>{issue.action}</p>
                </div>
                <StatusBadge status={issue.severity === "critical" ? "Critical" : "Warning"} />
              </div>
            ))}
          </div>
        ) : (
          <p className="success-text">All deployment-readiness checks passed.</p>
        )}
      </div>
    </section>
  );
}
