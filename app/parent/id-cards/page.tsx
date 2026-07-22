import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { IdentityCardView } from "@/components/identity-card-view";
import { PrintButton } from "@/components/print-button";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parentIdentityCards } from "@/lib/id-card-portals";
import { renderCode39Svg } from "@/lib/library-barcode-svg";

export default async function ParentIdentityCardsPage({ searchParams }: { searchParams: Promise<{ admissionNo?: string }> }) {
  const user = await requirePermission("VIEW_OWN_STUDENT_ID_CARDS"), data = await parentIdentityCards(prisma, user, (await searchParams).admissionNo);
  const cards = (data.cards as any[]).map((payload) => ({ ...payload, barcodeSvg: payload.cardNumber && payload.snapshot.barcodeEnabled ? renderCode39Svg(payload.cardNumber) : null }));
  return <div className="page parent-id-cards"><PageHeader title="My Child's ID Card" description="Issued school ID cards for children linked to this Parent account only."/>
    {data.children.length > 1 ? <nav className="page-actions" aria-label="Choose linked child">{data.children.map((child) => <Link className={`button ${data.selectedChild?.admissionNo === child.admissionNo ? "" : "secondary"}`} key={child.admissionNo} href={`/parent/id-cards?admissionNo=${encodeURIComponent(child.admissionNo)}`}>{child.studentName}</Link>)}</nav> : null}
    {!data.selectedChild ? <p className="notice">No Student is linked to this Parent account.</p> : !cards.length ? <p className="notice">No issued Student ID card is available for {data.selectedChild.studentName}.</p> : <><div className="no-print"><PrintButton/></div>{cards.map((payload) => <IdentityCardView key={payload.cardNumber} payload={payload}/>)}</>}
    <p className="notice">This card is an operational school identity card. It is not a government identity document. A barcode identifies the card number; it does not authenticate the holder.</p>
  </div>;
}
