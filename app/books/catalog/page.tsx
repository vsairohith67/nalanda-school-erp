import Link from "next/link";
import { BookCatalogManager } from "@/components/books-finance-forms";
import { PageHeader, PageShell, StatusBadge } from "@/components/ui";
import { requirePermission, hasUserPermission } from "@/lib/auth";
import { moneyExact } from "@/lib/format";
import { prisma } from "@/lib/prisma";

import { getSchoolSettings } from "@/lib/school-settings";

export default async function BookCatalogPage() {
  const user = await requirePermission("VIEW_BOOKS_FINANCE");
  const [settings, items, vendors, canCatalog, canRates] = await Promise.all([
    getSchoolSettings(prisma),
    prisma.bookCatalogItem.findMany({
      include: {
        publisherVendor: { select: { id: true, name: true } },
        rates: { orderBy: [{ academicYear: "desc" }, { effectiveFrom: "desc" }] }
      },
      orderBy: { title: "asc" }
    }),
    prisma.vendor.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true, vendorCode: true }, orderBy: { name: "asc" } }),
    hasUserPermission(user, "MANAGE_BOOK_CATALOG"),
    hasUserPermission(user, "MANAGE_BOOK_RATES")
  ]);
  const serialized = items.map((item) => ({
    id: item.id,
    itemCode: item.itemCode,
    title: item.title,
    itemType: item.itemType,
    publisherVendorId: item.publisherVendorId,
    publisherVendor: item.publisherVendor,
    className: item.className,
    subject: item.subject,
    description: item.description,
    studentLinkRequired: item.studentLinkRequired,
    status: item.status,
    rates: item.rates.map((rate) => ({
      id: rate.id,
      itemId: rate.itemId,
      academicYear: rate.academicYear,
      amount: rate.amount.toString(),
      effectiveFrom: rate.effectiveFrom?.toISOString() ?? null,
      effectiveTo: rate.effectiveTo?.toISOString() ?? null,
      status: rate.status,
      notes: rate.notes
    }))
  }));
  return <PageShell>
    <PageHeader title="Book Catalog & Academic-Year Rates" description="Prices remain year-specific and historical receipt lines keep item, class, publisher, and rate snapshots." action={<Link className="button secondary" href="/books">Back</Link>} />
    <BookCatalogManager items={serialized} vendors={vendors} academicYear={settings.academicYear} canCatalog={canCatalog} canRates={canRates} />
    <section className="card"><div className="table-wrap"><table><thead><tr><th>Code</th><th>Title</th><th>Type</th><th>Class / subject</th><th>Publisher</th><th>Student link</th><th>Rates</th><th>Status</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td>{item.itemCode}</td><td>{item.title}</td><td>{item.itemType.replaceAll("_", " ")}</td><td>{[item.className, item.subject].filter(Boolean).join(" / ") || "—"}</td><td>{item.publisherVendor?.name ?? "—"}</td><td>{item.studentLinkRequired ? "Required" : "Optional"}</td><td>{item.rates.map((rate) => `${rate.academicYear}: ${moneyExact(Number(rate.amount))}`).join("; ") || "Rate gap"}</td><td><StatusBadge status={item.status} /></td></tr>)}</tbody></table></div></section>
  </PageShell>;
}
