import Link from "next/link";
import { BookSettlementForm } from "@/components/books-finance-forms";
import { PageHeader, PageShell } from "@/components/ui";
import { requirePermission, hasUserPermission } from "@/lib/auth";
import { bookSettlementInclude, expectedBookCashForDate, serializeBookSettlement } from "@/lib/book-cash-settlement";
import { localDate } from "@/lib/expenses";
import { prisma } from "@/lib/prisma";

import { getSchoolSettings } from "@/lib/school-settings";

export default async function BookSettlementDatePage({ params }: { params: Promise<{ date: string }> }) {
  const user = await requirePermission("VIEW_BOOKS_FINANCE");
  const { date } = await params;
  let settlementDate: Date;
  try { settlementDate = localDate(date, "Settlement date"); } catch { return <PageShell><PageHeader title="Invalid book-cash settlement date" description="Use a real India-local calendar date in YYYY-MM-DD format." /></PageShell>; }
  const [settings, settlement, expected, manage, submit, approve] = await Promise.all([
    getSchoolSettings(prisma),
    prisma.bookCashSettlement.findUnique({ where: { settlementDate }, include: bookSettlementInclude }),
    expectedBookCashForDate(prisma, settlementDate),
    hasUserPermission(user, "MANAGE_BOOK_CASH_SETTLEMENT"),
    hasUserPermission(user, "SUBMIT_BOOK_CASH_SETTLEMENT"),
    hasUserPermission(user, "APPROVE_BOOK_CASH_SETTLEMENT")
  ]);
  const serialized = settlement ? serializeBookSettlement(settlement, expected.amount, manage) : null;
  return <PageShell>
    <PageHeader title={`Book-Cash Settlement — ${date}`} description={`${expected.receiptCount} active CASH book-sale receipt(s). Handed-to-cash-counter and retained amounts remain school physical cash and create no outflow.`} action={<div className="page-actions"><Link className="button secondary" href="/books/settlements">Back</Link><Link className="button secondary" href={`/cash-book/${date}`}>Open cash-book day</Link></div>} />
    <BookSettlementForm date={date} academicYear={settlement?.academicYear ?? settings.academicYear} settlement={serialized} expectedLive={expected.amount.toString()} permissions={{ manage, submit, approve }} />
  </PageShell>;
}
