import { CERTIFICATE_VERIFICATION_FEATURE } from "@/lib/certificate-graduation-policy";
import { assertOperationalReleaseFeature } from "@/lib/release-feature-flag-runtime";
import { sha256Bytes } from "@/lib/certificate-pdf";
import { CertificateWorkflowError } from "@/lib/certificate-requests";

export async function verifyCertificateReference(client: any, token: string, now = new Date()) {
  assertOperationalReleaseFeature(CERTIFICATE_VERIFICATION_FEATURE);
  const unavailable = { status: "UNAVAILABLE", authentic: false };
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return unavailable;
  const artifact = await client.certificateIssueArtifact.findUnique({ where: { tokenHash: sha256Bytes(token) } });
  if (!artifact || artifact.expiresAt <= now) return unavailable;
  const row = await client.studentCertificate.findUnique({ where: { id: artifact.certificateId } });
  if (!row) return unavailable;
  if (row.status === "CANCELLED") return { status: "VOID", authentic: false };
  if (row.status !== "ISSUED") return unavailable;
  const version = await client.studentCertificateVersion.findUnique({ where: { id: artifact.versionId } });
  if (!version || version.certificateId !== row.id || version.snapshotHash !== artifact.snapshotHash || sha256Bytes(version.snapshotJson) !== artifact.snapshotHash) return unavailable;
  if (version.versionNumber !== row.currentVersionNumber) return { status: "SUPERSEDED", authentic: false };
  const successor = await client.studentCertificate.findFirst({ where: { supersedesCertificateId: row.id, status: "ISSUED" }, select: { id: true } });
  if (successor) return { status: "SUPERSEDED", authentic: false };
  // Deliberate allowlist: no number, name, Student ID, dates of birth, relatives,
  // contacts, marks, source evidence or signed asset URLs.
  return { status: "ISSUED", authentic: true, certificateType: row.certificateType, academicYear: row.academicYear, issuerKind: "SCHOOL_INSTITUTIONAL" };
}

export async function issuedCertificatePdf(client: any, id: string, versionNumber?: number) {
  const row = await client.studentCertificate.findUnique({ where: { id } });
  if (!row || row.status !== "ISSUED") throw new CertificateWorkflowError("An active issued certificate is required.", 409);
  const version = await client.studentCertificateVersion.findUnique({ where: { certificateId_versionNumber: { certificateId: id, versionNumber: versionNumber ?? row.currentVersionNumber } } });
  const artifact = version ? await client.certificateIssueArtifact.findUnique({ where: { versionId: version.id } }) : null;
  if (!artifact || artifact.certificateId !== id || artifact.snapshotHash !== version.snapshotHash || sha256Bytes(version.snapshotJson) !== artifact.snapshotHash) throw new CertificateWorkflowError("This historical version has no retained PDF artifact; use its original governed print history.", 409);
  const pdf = Buffer.from(artifact.pdfBase64, "base64");
  if (sha256Bytes(pdf) !== artifact.pdfHash) throw new CertificateWorkflowError("Document integrity verification failed.", 409);
  return pdf;
}
