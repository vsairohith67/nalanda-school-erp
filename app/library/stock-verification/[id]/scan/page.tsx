import Link from "next/link";
import { notFound } from "next/navigation";
import { MissingProposal, StockScanner } from "@/components/library-stock-verification-forms";
import { LibraryNav } from "@/components/library-nav";
import { PageHeader, PageShell } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { loadStockSession } from "@/lib/library-stock-verification";
import { prisma } from "@/lib/prisma";

export default async function StockScanPage({params}:{params:Promise<{id:string}>}) {
  await requirePermission("SCAN_LIBRARY_STOCK");
  const id=(await params).id;
  const session:any=await loadStockSession(prisma,id);
  if(!session)notFound();
  const editable=session.status==="IN_PROGRESS";
  return <PageShell className="library-page">
    <PageHeader title={`Scan · ${session.sessionNumber}`} description={`${session.verifiedCopyCount} of ${session.expectedCopyCount} expected copies accounted for. Rapid duplicate transmissions are harmless.`} action={<Link className="button secondary" href={`/library/stock-verification/${id}`}>Back to session</Link>}/>
    <LibraryNav current="stock-verification"/>
    {editable?<><StockScanner id={id} records={session.records}/><MissingProposal id={id}/></>:<section className="card card-pad"><h3>Read-only verification history</h3><p>This session is {String(session.status).toLowerCase().replaceAll("_"," ")}. Scanning, manual observations, and missing proposals are disabled.</p></section>}
  </PageShell>;
}
