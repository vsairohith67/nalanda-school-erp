import Link from "next/link";
import { LabelPrintClient } from "@/components/library-barcode-forms";
import { LibraryNav } from "@/components/library-nav";
import { PageHeader, PageShell } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function BarcodeLabelsPage({ searchParams }: { searchParams: Promise<{ accession?: string | string[] }> }) {
  const params = await searchParams;
  await requirePermission("PRINT_LIBRARY_BARCODE_LABELS");
  const rawAccessions = Array.isArray(params.accession) ? params.accession : params.accession?.split(",") ?? [];
  const selected = rawAccessions.map((value) => value.trim().toUpperCase()).filter(Boolean);
  const copies = await prisma.libraryCopy.findMany({ where: selected.length ? { accessionNumber: { in: selected } } : { barcodeValue: { not: null } }, select: { accessionNumber: true }, orderBy: { accessionNumber: "asc" }, take: 100 });
  return <PageShell className="library-page barcode-print-page"><PageHeader title="Print Library Barcode Labels" description="Black-and-white 50 mm x 25 mm labels. Selected copies only; copies without valid Code 39 values are skipped." action={<Link className="button secondary" href="/library/barcodes">Back to coverage</Link>} /><LibraryNav current="barcodes" /><LabelPrintClient accessions={copies.map((copy) => copy.accessionNumber)} /></PageShell>;
}
