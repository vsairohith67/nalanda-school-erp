import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader, StatusBadge } from "@/components/ui";
import { CertificateRequestForm } from "@/components/certificate-forms";
import { PrintButton } from "@/components/print-button";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getParentCertificatePortal } from "@/lib/certificate-portals";
import { CertificateWorkflowError } from "@/lib/certificate-requests";
import { getSchoolSettings } from "@/lib/school-settings";
import { displayDate } from "@/lib/format";

export default async function ParentCertificatesPage({ searchParams }: { searchParams: Promise<{ student?: string; certificate?: string }> }) {
  const user = await requirePermission("VIEW_OWN_CHILD_CERTIFICATES");
  const query = await searchParams;
  let data;
  try {
    data = await getParentCertificatePortal(prisma, user, query.student);
  } catch (error) {
    if (error instanceof CertificateWorkflowError && error.status === 403) redirect("/unauthorized");
    throw error;
  }
  const settings = await getSchoolSettings(prisma);
  const selected = data.certificates.find((certificate: any) => certificate.certificateNumber === query.certificate) as any;
  return (
    <div className="page parent-certificates-page">
      <PageHeader title="Certificates" description="Request and view issued certificates for linked children only. Parents cannot edit certificate facts." />
      <div className="page-actions">{data.children.map(child => <Link key={child.id} className="button secondary" href={`/parent/certificates?student=${child.id}`}>{child.studentName}</Link>)}</div>
      {data.selectedChild ? <>
        <section><h3>Request a Certificate for {data.selectedChild.studentName}</h3><CertificateRequestForm parent students={[data.selectedChild]} academicYear={settings.academicYear} /></section>
        <section className="card">
          <h3>Request History</h3>
          <div className="table-wrap"><table><thead><tr><th>Request</th><th>Type</th><th>Purpose</th><th>Status</th></tr></thead><tbody>{data.requests.map((request: any) => <tr key={request.requestNumber}><td>{request.requestNumber}</td><td>{request.certificateType}</td><td>{request.purpose}</td><td><StatusBadge status={request.status} /></td></tr>)}</tbody></table></div>
        </section>
        <section className="card">
          <h3>Issued Certificates</h3>
          <div className="table-wrap"><table><thead><tr><th>Number</th><th>Type</th><th>Status</th><th>Issued</th><th>View</th></tr></thead><tbody>{data.certificates.map((certificate: any) => <tr key={certificate.certificateNumber}><td>{certificate.certificateNumber}</td><td>{certificate.certificateType}</td><td><StatusBadge status={certificate.status} /></td><td>{displayDate(certificate.issuedAt)}</td><td><Link href={`/parent/certificates?student=${data.selectedChild!.id}&certificate=${encodeURIComponent(certificate.certificateNumber)}`}>Open Issued Certificate</Link></td></tr>)}</tbody></table></div>
        </section>
      </> : <p className="notice">No child is linked to this Parent account.</p>}
      {selected ? <section className="card parent-issued-certificate">
        <div className="section-title"><div><h3>{selected.snapshot.template?.definition?.heading ?? selected.certificateType}</h3><p>{selected.certificateNumber} · Version {selected.versionNumber}</p></div><PrintButton /></div>
        {selected.status === "CANCELLED" ? <div className="certificate-watermark">CANCELLED</div> : null}
        <p>{selected.snapshot.template?.definition?.body?.replaceAll("{{studentName}}", selected.snapshot.student?.name ?? "")}</p>
        <dl className="detail-grid"><div><dt>Student</dt><dd>{selected.snapshot.student?.name}</dd></div><div><dt>Admission Number</dt><dd>{selected.snapshot.student?.admissionNumber}</dd></div><div><dt>Academic Year</dt><dd>{selected.snapshot.academicYear}</dd></div><div><dt>Purpose</dt><dd>{selected.snapshot.purpose}</dd></div></dl>
        <p>Typed signatory labels are not digital signatures.</p>
      </section> : null}
    </div>
  );
}
