"use client";
import { useState } from "react";

type Payload = { cardNumber?: string | null; effectiveStatus?: string; currentVersionNumber?: number; snapshot: any; barcodeSvg?: string | null };

function fieldValue(field: string, payload: Payload) {
  const s = payload.snapshot, identity = s.identity ?? {}, school = s.school ?? {};
  const values: Record<string, { label: string; value: any }> = {
    schoolName: { label: "School", value: school.name },
    schoolAddress: { label: "School address", value: school.address },
    schoolOfficeContact: { label: "School office", value: school.officeContact },
    cardNumber: { label: "Card number", value: payload.cardNumber ?? s.cardNumber ?? "Allocated only at issue" },
    studentName: { label: "Student", value: identity.name },
    admissionNumber: { label: "Admission number", value: identity.admissionNumber },
    className: { label: "Class", value: identity.className },
    section: { label: "Section", value: identity.section },
    academicYear: { label: "Academic year", value: s.academicYear },
    dateOfBirth: { label: "Date of birth", value: identity.dateOfBirth ? String(identity.dateOfBirth).slice(0, 10) : null },
    guardianName: { label: "Parent / Guardian", value: identity.guardianName },
    staffName: { label: "Staff", value: identity.name },
    staffCode: { label: "Staff code", value: identity.staffCode },
    designation: { label: "Designation", value: identity.designation },
    department: { label: "Department", value: identity.department },
    primarySubject: { label: "Subject", value: identity.primarySubject },
    validFrom: { label: "Valid from", value: String(s.validFrom ?? "").slice(0, 10) },
    validUntil: { label: "Valid until", value: String(s.validUntil ?? "").slice(0, 10) },
    returnToSchool: { label: "", value: s.returnToSchool },
    issuingRole: { label: "Issued by", value: s.issuingRole },
    versionStatus: { label: "Version / status", value: `v${payload.currentVersionNumber ?? s.versionNumber ?? 0} · ${payload.effectiveStatus ?? s.status ?? "DRAFT"}` }
  };
  return values[field];
}

function Side({ side, payload }: { side: any; payload: Payload }) {
  const status = payload.effectiveStatus ?? payload.snapshot.status ?? "DRAFT";
  return <article className="identity-card-cr80" style={{ "--id-card-accent": side.accent ?? "#163b63" } as React.CSSProperties}>
    {["REVOKED", "EXPIRED", "SUPERSEDED"].includes(status) ? <span className="identity-card-watermark">{status}</span> : null}
    <header><strong>{side.title}</strong><span>{status}</span></header>
    <div className="identity-card-body">
      {side.fields.includes("schoolLogo") && payload.snapshot.school?.logoPath ? <img className="identity-card-logo" src={payload.snapshot.school.logoPath} alt={`${payload.snapshot.school.name} logo`} /> : null}
      {side.fields.includes("photoPlaceholder") ? <div className="identity-card-photo" aria-label="Photo placeholder">PHOTO<br/>NOT AVAILABLE</div> : null}
      <div className="identity-card-fields">
        {side.fields.filter((field: string) => !["schoolLogo", "photoPlaceholder", "barcode"].includes(field)).map((field: string) => {
          const item = fieldValue(field, payload); return item?.value ? <p key={field}>{item.label ? <small>{item.label}</small> : null}<span>{String(item.value)}</span></p> : null;
        })}
      </div>
    </div>
    {side.fields.includes("barcode") && payload.barcodeSvg ? <div className="identity-card-barcode" aria-label={`Code 39 card-number barcode ${payload.cardNumber}`} dangerouslySetInnerHTML={{ __html: payload.barcodeSvg }} /> : null}
    {side.footer ? <footer>{side.footer}</footer> : null}
  </article>;
}

export function IdentityCardView({ payload, printPair = false, printMode }: { payload: Payload; printPair?: boolean; printMode?: "front" | "back" | "pair" }) {
  const [side, setSide] = useState<"front" | "back">("front");
  const definition = payload.snapshot.template?.definition ?? payload.snapshot.templateDefinition ?? {};
  const front = definition.front ?? { title: `${payload.snapshot.cardType ?? "SCHOOL"} ID CARD`, fields: ["schoolName", "studentName", "staffName", "cardNumber", "versionStatus"] };
  const back = definition.back ?? { title: "SCHOOL ID CARD", fields: ["validFrom", "validUntil", "returnToSchool"] };
  if (printPair || printMode) return <div className="identity-card-print-pair">{printMode !== "back" ? <Side side={front} payload={payload}/> : null}{printMode !== "front" ? <Side side={back} payload={payload}/> : null}</div>;
  return <div className="virtual-id-card">
    <div className="segmented-control" aria-label="Choose ID-card side"><button type="button" className={side === "front" ? "active" : "secondary"} aria-pressed={side === "front"} onClick={() => setSide("front")}>Front</button><button type="button" className={side === "back" ? "active" : "secondary"} aria-pressed={side === "back"} onClick={() => setSide("back")}>Back</button></div>
    <Side side={side === "front" ? front : back} payload={payload}/>
    <p className="muted identity-card-notice">This card is an operational school identity card. It is not a government identity document.</p>
  </div>;
}
