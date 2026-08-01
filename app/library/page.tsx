import Link from "next/link";
import { LibraryNav } from "@/components/library-nav";
import { PageHeader, PageShell, StatusBadge } from "@/components/ui";
import { requirePermission, hasUserPermission } from "@/lib/auth";
import { displayDate } from "@/lib/format";
import { loadLibraryReports } from "@/lib/library-reports";
import { prisma } from "@/lib/prisma";


export default async function LibraryPage() {
  const user = await requirePermission("VIEW_LIBRARY");
  const [report, canCatalog, canCopies, canImport, canCirculate, canPolicies, canCirculationReports, canStock] = await Promise.all([
    loadLibraryReports(prisma),
    hasUserPermission(user, "MANAGE_LIBRARY_CATALOG"), hasUserPermission(user, "MANAGE_LIBRARY_COPIES"),
    hasUserPermission(user, "IMPORT_LIBRARY_CATALOG"), hasUserPermission(user, "VIEW_LIBRARY_CIRCULATION"),
    hasUserPermission(user, "MANAGE_LIBRARY_POLICIES"), hasUserPermission(user, "VIEW_LIBRARY_CIRCULATION_REPORTS"),
    hasUserPermission(user, "VIEW_LIBRARY_STOCK_VERIFICATION")
  ]);
  const cards = [["Bibliographic titles", report.summary.titles], ["Physical copies", report.summary.copies], ["Available", report.summary.available], ["Under repair", report.summary.underRepair], ["Missing", report.summary.missing], ["Withdrawn", report.summary.withdrawn], ["Title metadata gaps", report.summary.titleMetadataGaps], ["Copy metadata gaps", report.summary.copyMetadataGaps]];
  return <PageShell className="library-page"><PageHeader title="Library Catalog, Circulation & Stock Control" description="Permanent catalog/accession records, circulation, barcode assistance, accountability cases, and controlled stock-verification snapshots. No RFID or location tracking." action={<div className="page-actions">{canCatalog?<Link className="button" href="/library/catalog/new">Create title</Link>:null}{canCopies?<Link className="button secondary" href="/library/copies/new">Accession copy</Link>:null}{canCirculate?<Link className="button secondary" href="/library/circulation">Open circulation</Link>:null}{canStock?<Link className="button secondary" href="/library/stock-verification">Stock verification</Link>:null}</div>}/><LibraryNav current="dashboard" canImport={canImport} canCirculate={canCirculate} canManagePolicies={canPolicies} canCirculationReports={canCirculationReports}/><div className="stats library-stats">{cards.map(([label,value])=><div className="card stat" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><section className="card"><div className="section-title"><div><h3>Recent accession and copy events</h3><p>Append-only history; actor labels are safe display names.</p></div></div><div className="table-wrap"><table><thead><tr><th>Date</th><th>Accession</th><th>Title</th><th>Event</th><th>Change</th><th>Recorded by</th></tr></thead><tbody>{report.recentEvents.slice(0,15).map((event,i)=><tr key={`${event.accessionNumber}-${event.eventDate}-${i}`}><td>{displayDate(event.eventDate)}</td><td>{event.accessionNumber}</td><td>{event.titleCode} - {event.title}</td><td><StatusBadge status={event.eventType}/></td><td>{[event.previousStatus&&`${event.previousStatus} → ${event.newStatus}`,event.previousCondition&&`${event.previousCondition} → ${event.newCondition}`,event.previousShelfCode&&`${event.previousShelfCode} → ${event.newShelfCode}`].filter(Boolean).join("; ")||event.reason||"Recorded"}</td><td>{event.actorLabel}</td></tr>)}{!report.recentEvents.length?<tr><td colSpan={6}>No library events have been recorded yet.</td></tr>:null}</tbody></table></div></section></PageShell>;
}
