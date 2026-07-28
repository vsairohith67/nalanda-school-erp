import { StatusBadge } from "@/components/ui";
import type { AppInfo } from "@/lib/app-info";
import type { SystemHealth } from "@/lib/system-health";

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
          <h3>System Health</h3>
          <p>Production-readiness checks for this local school computer.</p>
        </div>
        <StatusBadge status={health.status} />
      </div>

      <div className="system-info-grid">
        <div><span>App</span><strong>{appInfo.name}</strong></div>
        <div><span>Version</span><strong>{appInfo.version}</strong></div>
        <div><span>Build Mode</span><strong>{appInfo.buildMode}</strong></div>
        <div><span>Database</span><strong>{appInfo.databaseProvider}</strong></div>
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
                  <td>{row.role.replaceAll("_", " ")}</td>
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
        <p className="success-text">All readiness checks passed.</p>
      )}
    </section>
  );
}
