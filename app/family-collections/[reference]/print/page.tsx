import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { hasUserPermission, requireUser } from "@/lib/auth";
import { familyReceiptForUser } from "@/lib/family-collections";
import { displayDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getSchoolSettings } from "@/lib/school-settings";

export default async function FamilyReceiptPrintPage({ params, searchParams }: { params: Promise<{ reference: string }>; searchParams: Promise<{ child?: string }> }) {
  const user = await requireUser();
  const reference = decodeURIComponent((await params).reference);
  const sp = await searchParams;
  const allowed = user.role === "PARENT" ? await hasUserPermission(user, "VIEW_OWN_FAMILY_RECEIPTS") : await hasUserPermission(user, "ISSUE_FAMILY_RECEIPTS") || await hasUserPermission(user, "VIEW_FAMILY_COLLECTIONS");
  if (!allowed) redirect("/unauthorized");
  let row: any;
  try { row = await familyReceiptForUser(prisma, reference, user, sp.child); } catch { notFound(); }
  const settings = await getSchoolSettings(prisma);
  return <div className="page print-route-page"><style>{`@media print { @page { size: A4 portrait; margin: 10mm; } }`}</style><div className="print-toolbar no-print"><PrintButton label="Print / Save PDF" /></div><article className={`print-document family-receipt-print ${row.status !== "ISSUED" ? "receipt-cancelled" : ""}`}>{row.status !== "ISSUED" ? <div className="cancelled-watermark">{row.status}</div> : null}<header className="receipt-header"><Image src={settings.logoPath} alt={settings.schoolName} width={74} height={74} priority /><div><h1>{settings.schoolName}</h1>{settings.showSchoolAddress ? <p>{settings.addressLine1}, {settings.city}</p> : null}{settings.showSchoolPhone ? <p>Tel: {settings.phone}</p> : null}</div></header><div className="receipt-title">CONSOLIDATED FAMILY FEE RECEIPT</div><section className="receipt-meta"><div><span>Collection reference</span><strong>{row.publicReference}</strong></div><div><span>Issue version</span><strong>{row.receipt?.issueReference}</strong></div><div><span>Date</span><strong>{displayDate(row.collectionDate)}</strong></div><div><span>Payer</span><strong>{row.payer?.displayName ?? "Authorised child extract"}</strong></div><div><span>Status</span><strong>{row.status}</strong></div><div><span>Overall total</span><strong>{formatPaise(row.totalPaise)}</strong></div></section>{row.instruments.length ? <section className="receipt-breakup"><h2>Instrument summary</h2>{row.instruments.map((instrument: any) => <div key={instrument.ordinal}><span>{instrument.mode} · {instrument.referenceMasked ?? "Cash"}</span><strong>{formatPaise(instrument.amountPaise)}</strong></div>)}</section> : null}<section><h2>Child-specific allocation sections</h2>{groupChildren(row.allocations).map((child) => <div className="family-print-child" key={child.admissionNo}><h3>{child.studentName} · {child.className}{child.section ? `-${child.section}` : ""}</h3><p>{child.admissionNo}</p><table className="receipt-table"><thead><tr><th>Academic year</th><th>Installment</th><th>Fee head</th><th>Allocated</th><th>Remaining</th></tr></thead><tbody>{child.rows.map((allocation: any, index: number) => <tr key={index}><td>{allocation.academicYear}</td><td>{allocation.installment}</td><td>{allocation.feeHead}</td><td>{formatPaise(allocation.amountPaise)}</td><td>{formatPaise(allocation.dueAfterPaise)}</td></tr>)}</tbody><tfoot><tr><th colSpan={3}>Child total</th><th colSpan={2}>{formatPaise(child.rows.reduce((sum: number, allocation: any) => sum + allocation.amountPaise, 0))}</th></tr></tfoot></table></div>)}</section><footer className="receipt-footer"><div><span>Receipt status</span><strong>{row.status}</strong></div><div className="signature-line">{settings.signatureLabel}</div></footer></article></div>;
}

function groupChildren(rows: any[]) { const map = new Map<string, any>(); for (const row of rows) { const current = map.get(row.admissionNo) ?? { admissionNo: row.admissionNo, studentName: row.studentName, className: row.className, section: row.section, rows: [] }; current.rows.push(row); map.set(row.admissionNo, current); } return [...map.values()]; }
function formatPaise(value: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(value / 100); }
