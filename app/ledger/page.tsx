import { Suspense } from "react";
import { PageHeader } from "@/components/ui";
import { LedgerSearch } from "@/components/ledger-search";
import { requirePermission } from "@/lib/auth";

export default async function LedgerPage() {
  await requirePermission("VIEW_LEDGER");
  return (
    <div className="page">
      <PageHeader title="Student Ledger" description="Search one student and review purpose-limited identity, payments, receipt history, and term dues." />
      <Suspense fallback={<div className="card card-pad">Loading ledger...</div>}>
        <LedgerSearch />
      </Suspense>
    </div>
  );
}
