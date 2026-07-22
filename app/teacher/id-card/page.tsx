import { PageHeader } from "@/components/ui";
import { IdentityCardView } from "@/components/identity-card-view";
import { PrintButton } from "@/components/print-button";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { teacherIdentityCard } from "@/lib/id-card-portals";
import { renderCode39Svg } from "@/lib/library-barcode-svg";

export default async function TeacherIdentityCardPage() {
  const user = await requirePermission("VIEW_OWN_STAFF_ID_CARD"), data = await teacherIdentityCard(prisma, user), payload: any = data.card;
  const safe = payload ? { ...payload, barcodeSvg: payload.cardNumber && payload.snapshot.barcodeEnabled ? renderCode39Svg(payload.cardNumber) : null } : null;
  return <div className="page teacher-id-card"><PageHeader title="My Staff ID Card" description="Your own linked StaffMember operational school ID card only."/>
    {!data.linked ? <p className="notice">No StaffMember is linked to this Teacher login. Ask an authorised administrator to link it.</p> : !safe ? <p className="notice">No issued Staff ID card is available.</p> : <><div className="no-print"><PrintButton/></div><IdentityCardView payload={safe}/></>}
    <p className="notice">This card is an operational school identity card. It is not a government identity document. A barcode identifies the card number; it does not authenticate the holder.</p>
  </div>;
}
