import Link from "next/link";
import { ScannerAssist } from "@/components/library-barcode-forms";
import { LibraryNav } from "@/components/library-nav";
import { PageHeader, PageShell } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
export default async function LibraryScannerPage() { await requirePermission("USE_LIBRARY_SCANNER"); return <PageShell className="library-page"><PageHeader title="Library Scanner Assistance" description="USB scanners act like keyboards. Exact lookup and a visible confirmation are required; existing issue and return policy checks remain authoritative." action={<div className="page-actions"><Link className="button secondary" href="/library/circulation">Back to circulation</Link><Link className="button secondary" href="/library/stock-verification">Stock verification</Link></div>} /><LibraryNav current="scanner" /><ScannerAssist /></PageShell>; }
