import { CashBookCreateForm, CashBookEditor } from "@/components/cash-book-form";
import { PageHeader, PageShell } from "@/components/ui";
import { requirePermission, hasUserPermission } from "@/lib/auth";
import { cashBookInclude, cashBookView, suggestedOpeningBalance } from "@/lib/cash-book";
import { localDate } from "@/lib/expenses";
import { displayDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

import { getSchoolSettings } from "@/lib/school-settings";

export default async function CashBookDetailPage({ params }: { params: Promise<{ date: string }> }) {
  const user = await requirePermission("VIEW_CASH_BOOK");
  const { date } = await params;
  let cashDate: Date;
  try {
    cashDate = localDate(date, "Cash date");
  } catch {
    return (
      <PageShell>
        <PageHeader title="Invalid cash-book date" description="Use a real India-local calendar date in YYYY-MM-DD format." />
      </PageShell>
    );
  }

  const [row, settings, manage, submit, approve, lock, cancel] = await Promise.all([
    prisma.cashBookDay.findUnique({ where: { cashDate }, include: cashBookInclude }),
    getSchoolSettings(prisma),
    hasUserPermission(user, "MANAGE_CASH_BOOK"),
    hasUserPermission(user, "SUBMIT_CASH_BOOK"),
    hasUserPermission(user, "APPROVE_CASH_BOOK"),
    hasUserPermission(user, "LOCK_CASH_BOOK"),
    hasUserPermission(user, "CANCEL_CASH_BOOK")
  ]);

  if (!row) {
    if (!manage) {
      return (
        <PageShell>
          <PageHeader title={`Cash Book — ${displayDate(date)}`} description="No cash day exists and this role cannot create one." />
        </PageShell>
      );
    }
    const previous = await suggestedOpeningBalance(prisma, cashDate);
    return (
      <PageShell>
        <PageHeader title={`Create Cash Book — ${displayDate(date)}`} description="Opening cash normally carries from the previous locked day's counted closing cash." />
        <CashBookCreateForm date={date} academicYear={settings.academicYear} suggestedOpening={previous?.amount.toString() ?? "0.00"} hasPrevious={Boolean(previous)} />
      </PageShell>
    );
  }

  const day = await cashBookView(prisma, row, manage);
  return (
    <PageShell>
      <PageHeader title={`Cash Book — ${displayDate(date)}`} description={`Status: ${row.status.replaceAll("_", " ")} · Approval and locking are separate.`} />
      <CashBookEditor day={day} permissions={{ manage, submit, approve, lock, cancel }} />
    </PageShell>
  );
}
