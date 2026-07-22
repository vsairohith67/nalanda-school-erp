import { LibraryImportPanel } from "@/components/library-forms";
import { LibraryNav } from "@/components/library-nav";
import { PageHeader, PageShell } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
export default async function LibraryImportPage() { await requirePermission("IMPORT_LIBRARY_CATALOG"); return <PageShell className="library-page"><PageHeader title="Library Import" description="Preview title and physical-copy files, review every warning/error, then explicitly confirm. Matching is exact and existing records are never overwritten silently." /><LibraryNav current="import" canImport /><LibraryImportPanel /></PageShell>; }
