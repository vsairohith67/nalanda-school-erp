import Link from "next/link";
import { LibraryNav } from "@/components/library-nav";
import { PageHeader, PageShell, StatusBadge } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { displayDate } from "@/lib/format";
import { loadLibraryStockReports, stockObservationLabel } from "@/lib/library-stock-reports";
import { prisma } from "@/lib/prisma";
import { hasRolePermission } from "@/lib/role-permissions";

export default async function StockReportsPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
  const user=await requirePermission("VIEW_LIBRARY_STOCK_REPORTS");
  const q=await searchParams;
  const [report,canExport]=await Promise.all([
    loadLibraryStockReports(prisma,{academicYear:q.academicYear,status:q.status},user.role==="VIEWER"),
    hasRolePermission(prisma,user.role,"EXPORT_LIBRARY_STOCK_REPORTS")
  ]);
  const records=report.sessions.flatMap((session)=>session.records.map((record)=>({session,record})));
  const scans=report.sessions.flatMap((session)=>session.scanEvents.map((event)=>({session,event})));

  return <PageShell className="library-page">
    <PageHeader title="Library Stock-Verification Reports" description="Safe expected-versus-verified, exceptions, discrepancies, corrections, shelf/title/category/subject scope, progress, and locked history." action={canExport?<Link className="button" href={`/api/library/stock-verification/reports/export?academicYear=${encodeURIComponent(q.academicYear??"")}&status=${encodeURIComponent(q.status??"")}`}>Export formula-safe CSV</Link>:undefined}/>
    <LibraryNav current="stock-reports"/>
    <div className="stats"><div className="card stat"><span>Sessions</span><strong>{report.totals.sessions}</strong></div><div className="card stat"><span>Expected</span><strong>{report.totals.expected}</strong></div><div className="card stat"><span>Verified</span><strong>{report.totals.verified}</strong></div><div className="card stat"><span>Unresolved</span><strong>{report.totals.unresolved}</strong></div><div className="card stat"><span>Applied corrections</span><strong>{report.totals.corrections}</strong></div></div>

    <section className="card"><h2 className="card-title">Session summary and locked history</h2><div className="table-wrap"><table><thead><tr><th>Session</th><th>Status</th><th>Scope</th><th>Expected / verified</th><th>Exceptions</th><th>Discrepancies</th></tr></thead><tbody>{report.sessions.map((s)=><tr key={s.sessionNumber}><td>{s.id?<Link href={`/library/stock-verification/${s.id}`}><strong>{s.sessionNumber}</strong></Link>:<strong>{s.sessionNumber}</strong>}<br/>{displayDate(s.verificationDate)}</td><td><StatusBadge status={s.status}/></td><td>{s.scopeType}<br/>{s.scopeLabel}</td><td>{s.expectedCopyCount} / {s.verifiedCopyCount}</td><td>Issued {s.issuedOffsiteCount} · Repair {s.knownRepairCount}</td><td>Missing {s.missingCount} · Mis-shelved {s.misShelvedCount} · Damaged {s.damagedCount} · Unexpected {s.unexpectedCount} · Unresolved {s.unresolvedCount}</td></tr>)}</tbody></table></div></section>

    <section className="card"><h2 className="card-title">Verification records</h2><div className="table-wrap"><table><thead><tr><th>Session</th><th>Copy</th><th>Expected snapshot</th><th>Observation</th><th>Resolution</th></tr></thead><tbody>{records.map(({session,record},index)=><tr key={`${session.sessionNumber}-${record.accessionNumber}-${index}`}><td>{session.sessionNumber}</td><td><strong>{record.accessionNumber}</strong><br/>{record.title}</td><td>{record.expectedStatus} · {record.expectedCondition}<br/>Shelf {record.expectedShelfCode??"—"}{record.expectedLoanStatus?<><br/>{record.expectedLoanStatus}{record.borrowerType?` · ${record.borrowerType}`:""}</>:null}</td><td>{stockObservationLabel(record)}<br/>Shelf {record.observedShelfCode??"—"} · {record.observedCondition??"—"}</td><td>{record.resolutionStatus}{record.correctionApplied?" · APPLIED":""}</td></tr>)}</tbody></table></div></section>

    <section className="card"><h2 className="card-title">Recent scan events</h2><div className="table-wrap"><table><thead><tr><th>Session</th><th>Date</th><th>Normalized input</th><th>Method</th><th>Result</th></tr></thead><tbody>{scans.map(({session,event},index)=><tr key={`${session.sessionNumber}-${index}`}><td>{session.sessionNumber}</td><td>{displayDate(event.scannedAt)}</td><td>{event.normalizedInput}</td><td>{event.scanMethod}</td><td>{event.resultType}</td></tr>)}</tbody></table></div></section>
  </PageShell>;
}
