import { unstable_noStore as noStore } from "next/cache";
import { LockKeyhole, Search } from "lucide-react";
import { UniversalSearchWorkspace } from "@/components/universal-search-workspace";
import { PageHeader, PageShell } from "@/components/ui";
import { requireRolePermission } from "@/lib/auth";
import { UNIVERSAL_SEARCH_SOURCES } from "@/lib/universal-search-contract";

export const dynamic = "force-dynamic";

export default async function SuperAdminSearchPage() {
  noStore();
  await requireRolePermission("VIEW_DASHBOARD", "SUPER_ADMIN");
  return (
    <PageShell className="universal-search-page">
      <PageHeader
        title="Search"
        description="Deterministic, permission-scoped search across authorised Nalanda ERP records. Search finds and navigates; it never changes a record."
        action={<span className="command-read-only"><LockKeyhole size={17} aria-hidden /> Private · read-only</span>}
      />
      <UniversalSearchWorkspace sources={UNIVERSAL_SEARCH_SOURCES.map((source) => ({ ...source }))} />
      <p className="universal-search-boundary"><Search size={16} aria-hidden /> No AI, semantic matching, external provider or shared cache is used.</p>
    </PageShell>
  );
}
