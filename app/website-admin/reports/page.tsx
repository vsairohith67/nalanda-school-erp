import { PageHeader, StatusBadge } from "@/components/ui";
import { requirePermission, getCurrentUserEffectivePermissions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissionSetCan } from "@/lib/role-permissions";
import { publicWebsiteReadinessReport } from "@/lib/public-website-reports";

export default async function WebsiteReports() {
  const user = await requirePermission("VIEW_PUBLIC_WEBSITE_REPORTS");
  const [report, permissions] = await Promise.all([
    publicWebsiteReadinessReport(prisma),
    getCurrentUserEffectivePermissions()
  ]);
  const exportAction = permissionSetCan(permissions, "EXPORT_PUBLIC_WEBSITE_REPORTS")
    ? <a className="button" href="/api/website-admin/reports/export">Export Formula-safe CSV</a>
    : undefined;
  const rows = [
    ["Required public pages", report.gaps.unpublishedRequiredPages.length === 0, `${report.gaps.unpublishedRequiredPages.length} unpublished`],
    ["SEO titles", report.gaps.missingSeoTitles.length === 0, `${report.gaps.missingSeoTitles.length} missing`],
    ["SEO descriptions", report.gaps.missingDescriptions.length === 0, `${report.gaps.missingDescriptions.length} missing`],
    ["Heading order", report.gaps.headingIssues.length === 0, `${report.gaps.headingIssues.length} issue(s)`],
    ["Image alt text", report.gaps.invalidAltText.length === 0, `${report.gaps.invalidAltText.length} invalid`],
    ["Broken links", report.gaps.brokenLinks.length === 0, `${report.gaps.brokenLinks.length} broken`],
    ["Public contact", report.gaps.publicContactComplete, report.gaps.publicContactComplete ? "Complete" : `${report.gaps.missingContactFields.length} field(s) missing`],
    ["Navigation", report.gaps.navigationIntegrity, report.gaps.navigationIntegrity ? "Only approved destinations" : "Resolve invalid destination"],
    ["Stale content", report.gaps.staleContent.length === 0, `${report.gaps.staleContent.length} older than 365 days`],
    ["Production indexing", report.gaps.robotsIndexingEnabled, report.gaps.robotsIndexingEnabled ? "Approved host indexing enabled" : "Local/staging noindex is active"],
    ["Robots exclusions", report.gaps.robotsExclusions.length > 0, `${report.gaps.robotsExclusions.length} private route roots excluded`]
  ] as const;
  return (
    <div className="page website-admin-page">
      <PageHeader
        title="Website Content, SEO & Accessibility Readiness"
        description={`Privacy-safe aggregate report generated ${new Date(report.generatedAt).toLocaleString("en-IN")}`}
        action={exportAction}
      />
      <div className="stats-grid">
        <article className="stat-card"><span>Content items</span><strong>{report.counts.totalContentItems}</strong></article>
        <article className="stat-card"><span>Published versions</span><strong>{report.counts.publishedVersions}</strong></article>
        <article className="stat-card"><span>Pending reviews</span><strong>{report.counts.pendingReviews}</strong></article>
        <article className="stat-card"><span>Stale approvals</span><strong>{report.counts.staleApprovals}</strong></article>
        <article className="stat-card"><span>Sitemap entries</span><strong>{report.gaps.sitemapEntries}</strong></article>
      </div>
      <section className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Check</th><th>Result</th><th>Detail</th></tr></thead>
            <tbody>{rows.map(([label, pass, detail]) =>
              <tr key={label}><td>{label}</td><td><StatusBadge status={pass ? "Good" : label === "Production indexing" ? "Warning" : "Needs Review"} /></td><td>{detail}</td></tr>
            )}</tbody>
          </table>
        </div>
      </section>
      {user.role === "VIEWER" ? <div className="notice"><strong>Aggregate-only Viewer access.</strong><span>Draft content bodies, raw actor IDs and CSV export are not available.</span></div> : null}
    </div>
  );
}
