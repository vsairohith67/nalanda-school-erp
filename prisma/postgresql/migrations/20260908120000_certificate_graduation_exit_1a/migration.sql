ALTER TABLE "StudentCertificate" ADD COLUMN "workflowKey" TEXT;
ALTER TABLE "StudentCertificate" ADD COLUMN "supersedesCertificateId" TEXT;
CREATE UNIQUE INDEX "StudentCertificate_workflowKey_key" ON "StudentCertificate"("workflowKey");
CREATE TABLE "CertificateRequestCharge" (
 "id" TEXT NOT NULL PRIMARY KEY, "requestId" TEXT NOT NULL, "studentId" TEXT NOT NULL,
 "academicYear" TEXT NOT NULL, "snapshotJson" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL', "receiptId" TEXT,
 "preparedBy" TEXT NOT NULL, "approvedBy" TEXT, "approvedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "CertificateRequestCharge_requestId_key" ON "CertificateRequestCharge"("requestId");
CREATE UNIQUE INDEX "CertificateRequestCharge_receiptId_key" ON "CertificateRequestCharge"("receiptId");
CREATE TABLE "CertificateBulkBatch" (
 "id" TEXT NOT NULL PRIMARY KEY, "batchKey" TEXT NOT NULL, "uploadDigest" TEXT NOT NULL,
 "templateId" TEXT NOT NULL, "mappingVersion" TEXT NOT NULL, "rowsJson" TEXT NOT NULL,
 "approvalJson" TEXT, "preparedBy" TEXT NOT NULL, "approvedBy" TEXT,
 "status" TEXT NOT NULL DEFAULT 'VALIDATED',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "CertificateBulkBatch_batchKey_key" ON "CertificateBulkBatch"("batchKey");
CREATE TABLE "CertificateIssueArtifact" (
 "id" TEXT NOT NULL PRIMARY KEY, "versionId" TEXT NOT NULL, "certificateId" TEXT NOT NULL,
 "tokenHash" TEXT NOT NULL, "pdfBase64" TEXT NOT NULL, "pdfHash" TEXT NOT NULL, "renderProvenanceJson" TEXT NOT NULL,
 "snapshotHash" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "CertificateIssueArtifact_versionId_key" ON "CertificateIssueArtifact"("versionId");
CREATE UNIQUE INDEX "CertificateIssueArtifact_tokenHash_key" ON "CertificateIssueArtifact"("tokenHash");
CREATE INDEX "CertificateIssueArtifact_certificateId_idx" ON "CertificateIssueArtifact"("certificateId");
