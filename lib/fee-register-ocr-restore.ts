export async function restoreFeeRegisterOcrData(
  client: any,
  backup: any,
  studentMap: Map<string, string>,
  paymentMap: Map<string, string>,
  result: any
) {
  const profileMap = new Map<string, string>(), batchMap = new Map<string, string>(), pageMap = new Map<string, string>(), rowMap = new Map<string, string>(), runMap = new Map<string, string>();
  const paymentLinks = new Set<string>();

  for (const [index, row] of backup.feeRegisterOcrProfiles.entries()) try {
    const id = text(row.id, "OCR profile ID"), profileCode = text(row.profileCode, "OCR profile code"), providerKind = text(row.providerKind, "OCR provider kind");
    const [byId, byCode] = await Promise.all([client.feeRegisterOcrProfile.findUnique({ where: { id } }), client.feeRegisterOcrProfile.findUnique({ where: { profileCode } })]);
    if ((byId && byId.profileCode !== profileCode) || (byCode && byCode.id !== id)) { result.feeRegisterOcrProfiles.skipped++; result.warnings.push(`OCR profile ${profileCode} collided with a different local identity and was isolated.`); continue; }
    const data = {
      name: text(row.name, "OCR profile name"), providerKind,
      status: ["MOCK", "MANUAL"].includes(providerKind) ? text(row.status, "OCR profile status") : "DISABLED",
      liveUseEnabled: false, paymentPostingEnabled: false,
      maximumFileBytes: integer(row.maximumFileBytes, "Maximum OCR file bytes"),
      maximumImagePixels: integer(row.maximumImagePixels, "Maximum OCR image pixels"),
      maximumPagesPerBatch: integer(row.maximumPagesPerBatch, "Maximum OCR pages"),
      maximumRowsPerPage: integer(row.maximumRowsPerPage, "Maximum OCR rows"),
      requestTimeoutMs: integer(row.requestTimeoutMs, "OCR timeout"),
      minimumSuggestionConfidence: integer(row.minimumSuggestionConfidence, "OCR suggestion confidence"),
      retentionDays: row.retentionDays == null ? null : integer(row.retentionDays, "OCR retention days")
    };
    if (byId) {
      profileMap.set(id, id);
      if (isNewer(byId, row)) result.feeRegisterOcrProfiles.skipped++;
      else { await client.feeRegisterOcrProfile.update({ where: { id }, data }); result.feeRegisterOcrProfiles.updated++; }
    } else {
      await client.feeRegisterOcrProfile.create({ data: { id, profileCode, ...data, ...dates(row, true) } });
      profileMap.set(id, id); result.feeRegisterOcrProfiles.created++;
    }
  } catch (error) { result.feeRegisterOcrProfiles.errors.push(rowError("OCR profile", index, error)); }

  for (const [index, row] of backup.feeRegisterOcrBatches.entries()) try {
    const id = text(row.id, "OCR batch ID"), batchNumber = text(row.batchNumber, "OCR batch number"), profileId = profileMap.get(text(row.profileId, "OCR profile link"));
    if (!profileId) { result.feeRegisterOcrBatches.skipped++; continue; }
    const [byId, byNumber] = await Promise.all([client.feeRegisterOcrBatch.findUnique({ where: { id } }), client.feeRegisterOcrBatch.findUnique({ where: { batchNumber } })]);
    if ((byId && byId.batchNumber !== batchNumber) || (byNumber && byNumber.id !== id)) { result.feeRegisterOcrBatches.skipped++; result.warnings.push(`OCR batch ${batchNumber} collided and its children were isolated.`); continue; }
    const data = {
      profileId, academicYear: text(row.academicYear, "OCR academic year"), registerName: text(row.registerName, "OCR register name"),
      registerPeriodStart: date(row.registerPeriodStart), registerPeriodEnd: date(row.registerPeriodEnd), status: text(row.status, "OCR batch status"),
      sourcePageCount: integer(row.sourcePageCount, "OCR page count"), extractedRowCount: integer(row.extractedRowCount, "OCR row count"),
      verifiedRowCount: integer(row.verifiedRowCount, "OCR verified count"), duplicateRowCount: integer(row.duplicateRowCount, "OCR duplicate count"),
      rejectedRowCount: integer(row.rejectedRowCount, "OCR rejected count"), postedRowCount: integer(row.postedRowCount, "OCR posted count"),
      postingFailedRowCount: integer(row.postingFailedRowCount, "OCR failed count"), totalExtractedAmountMinor: integer(row.totalExtractedAmountMinor, "OCR extracted amount"),
      totalVerifiedAmountMinor: integer(row.totalVerifiedAmountMinor, "OCR verified amount"), totalPostedAmountMinor: integer(row.totalPostedAmountMinor, "OCR posted amount"),
      reviewVersion: integer(row.reviewVersion, "OCR review version"), approvedReviewVersion: row.approvedReviewVersion == null ? null : integer(row.approvedReviewVersion, "OCR approved version"),
      reviewNotes: nullable(row.reviewNotes), approvalNotes: nullable(row.approvalNotes), rejectionReason: nullable(row.rejectionReason), cancellationReason: nullable(row.cancellationReason),
      submittedAt: date(row.submittedAt), approvedAt: date(row.approvedAt), postedAt: date(row.postedAt), cancelledAt: date(row.cancelledAt)
    };
    if (byId) {
      batchMap.set(id, id);
      if (isNewer(byId, row)) result.feeRegisterOcrBatches.skipped++;
      else { await client.feeRegisterOcrBatch.update({ where: { id }, data }); result.feeRegisterOcrBatches.updated++; }
    } else {
      await client.feeRegisterOcrBatch.create({ data: { id, batchNumber, ...data, ...dates(row, true) } });
      batchMap.set(id, id); result.feeRegisterOcrBatches.created++;
    }
  } catch (error) { result.feeRegisterOcrBatches.errors.push(rowError("OCR batch", index, error)); }

  for (const [index, row] of backup.feeRegisterOcrPages.entries()) try {
    const id = text(row.id, "OCR page ID"), batchId = batchMap.get(text(row.batchId, "OCR batch link")), pageNumber = integer(row.pageNumber, "OCR page number");
    if (!batchId) { result.feeRegisterOcrPages.skipped++; continue; }
    const [byId, byNumber] = await Promise.all([client.feeRegisterOcrPage.findUnique({ where: { id } }), client.feeRegisterOcrPage.findUnique({ where: { batchId_pageNumber: { batchId, pageNumber } } })]);
    if ((byId && (byId.batchId !== batchId || byId.sourceSha256 !== row.sourceSha256)) || (byNumber && byNumber.id !== id)) { result.feeRegisterOcrPages.skipped++; result.warnings.push(`OCR page ${index + 1} collided with unrelated local source metadata and was isolated.`); continue; }
    const data = {
      batchId, pageNumber, originalDisplayName: text(row.originalDisplayName, "OCR display name"), storageKey: text(row.storageKey, "OCR storage key"),
      sourceSha256: text(row.sourceSha256, "OCR source hash"), mimeType: text(row.mimeType, "OCR MIME"), byteSize: integer(row.byteSize, "OCR byte size"),
      width: nullableInteger(row.width), height: nullableInteger(row.height), rotationDegrees: integer(row.rotationDegrees, "OCR rotation"),
      status: row.status === "PURGED" ? "PURGED" : "MISSING_SOURCE", providerKind: text(row.providerKind, "OCR page provider"),
      providerRequestReferenceSafe: nullable(row.providerRequestReferenceSafe), rawOcrText: null, overallConfidence: nullableInteger(row.overallConfidence),
      failureMessageSafe: row.status === "PURGED" ? nullable(row.failureMessageSafe) : "Source image bytes are not embedded in JSON backup",
      processedAt: date(row.processedAt), verifiedAt: date(row.verifiedAt), purgeAfter: date(row.purgeAfter), purgedAt: date(row.purgedAt)
    };
    if (byId) {
      pageMap.set(id, id);
      if (isNewer(byId, row)) result.feeRegisterOcrPages.skipped++;
      else { await client.feeRegisterOcrPage.update({ where: { id }, data }); result.feeRegisterOcrPages.updated++; }
    } else {
      await client.feeRegisterOcrPage.create({ data: { id, ...data, ...dates(row, true) } });
      pageMap.set(id, id); result.feeRegisterOcrPages.created++;
    }
  } catch (error) { result.feeRegisterOcrPages.errors.push(rowError("OCR page", index, error)); }

  for (const [index, row] of backup.feeRegisterOcrRows.entries()) try {
    const id = text(row.id, "OCR row ID"), pageId = pageMap.get(text(row.pageId, "OCR page link")), rowNumber = integer(row.rowNumber, "OCR row number");
    if (!pageId) { result.feeRegisterOcrRows.skipped++; continue; }
    const [byId, byNumber] = await Promise.all([client.feeRegisterOcrRow.findUnique({ where: { id } }), client.feeRegisterOcrRow.findUnique({ where: { pageId_rowNumber: { pageId, rowNumber } } })]);
    if ((byId && byId.pageId !== pageId) || (byNumber && byNumber.id !== id)) { result.feeRegisterOcrRows.skipped++; result.warnings.push(`OCR row ${index + 1} collided and was isolated.`); continue; }
    const backupStudentId = nullable(row.matchedStudentId), matchedStudentId = backupStudentId ? studentMap.get(backupStudentId) ?? null : null;
    const backupPaymentId = nullable(row.postedPaymentId), postedPaymentId = backupPaymentId ? paymentMap.get(backupPaymentId) ?? null : null;
    if (row.status === "POSTED" && !postedPaymentId) { result.feeRegisterOcrRows.skipped++; result.warnings.push(`Posted OCR row ${index + 1} was isolated because its exact Payment link was unavailable.`); continue; }
    if (postedPaymentId && paymentLinks.has(postedPaymentId)) { result.feeRegisterOcrRows.skipped++; result.warnings.push(`OCR row ${index + 1} was isolated because its Payment was already linked.`); continue; }
    if (postedPaymentId) paymentLinks.add(postedPaymentId);
    const safeStatus = backupStudentId && !matchedStudentId && !["REJECTED", "DUPLICATE"].includes(String(row.status)) ? "NEEDS_REVIEW" : text(row.status, "OCR row status");
    const data = {
      pageId, rowNumber, boundingBoxJson: json(row.boundingBoxJson, "OCR bounding box", null), rawText: text(row.rawText, "OCR row text", 2_000),
      extractedFieldsJson: json(row.extractedFieldsJson, "OCR extracted fields"), fieldConfidenceJson: json(row.fieldConfidenceJson, "OCR confidence"),
      candidateMatchesJson: json(row.candidateMatchesJson, "OCR candidates", "[]"), matchedStudentId,
      matchingMethod: matchedStudentId ? text(row.matchingMethod, "OCR matching method") : "NONE", status: safeStatus,
      paymentDate: date(row.paymentDate), amountMinor: nullableInteger(row.amountMinor), paymentMode: nullable(row.paymentMode), receivedAccount: nullable(row.receivedAccount),
      academicTerm: nullable(row.academicTerm), handwrittenReceiptReference: nullable(row.handwrittenReceiptReference), registerRemarks: nullable(row.registerRemarks),
      duplicateClassification: text(row.duplicateClassification, "OCR duplicate class"), duplicateEvidenceJson: json(row.duplicateEvidenceJson, "OCR duplicate evidence", null),
      duplicateResolutionReason: nullable(row.duplicateResolutionReason), verificationChecklistJson: json(row.verificationChecklistJson, "OCR checklist", null),
      verificationSnapshotJson: json(row.verificationSnapshotJson, "OCR snapshot", null), verifiedAt: date(row.verifiedAt),
      rejectedAt: date(row.rejectedAt), rejectionReason: nullable(row.rejectionReason), postedPaymentId, postingFailureSafe: nullable(row.postingFailureSafe), postedAt: date(row.postedAt)
    };
    if (byId) {
      rowMap.set(id, id);
      if (isNewer(byId, row)) result.feeRegisterOcrRows.skipped++;
      else { await client.feeRegisterOcrRow.update({ where: { id }, data }); result.feeRegisterOcrRows.updated++; }
    } else {
      await client.feeRegisterOcrRow.create({ data: { id, ...data, ...dates(row, true) } });
      rowMap.set(id, id); result.feeRegisterOcrRows.created++;
    }
  } catch (error) { result.feeRegisterOcrRows.errors.push(rowError("OCR row", index, error)); }

  for (const [index, row] of backup.feeRegisterOcrRowRevisions.entries()) try {
    const id = text(row.id, "OCR revision ID"), rowId = rowMap.get(text(row.rowId, "OCR row link"));
    if (!rowId) { result.feeRegisterOcrRowRevisions.skipped++; continue; }
    if (await client.feeRegisterOcrRowRevision.findUnique({ where: { id } })) { result.feeRegisterOcrRowRevisions.skipped++; continue; }
    await client.feeRegisterOcrRowRevision.create({ data: { id, rowId, revisionNumber: integer(row.revisionNumber, "OCR revision number"), previousSnapshotJson: json(row.previousSnapshotJson, "OCR previous snapshot"), newSnapshotJson: json(row.newSnapshotJson, "OCR new snapshot"), changeReason: text(row.changeReason, "OCR change reason"), createdAt: dateRequired(row.createdAt, "OCR revision created at") } });
    result.feeRegisterOcrRowRevisions.created++;
  } catch (error) { result.feeRegisterOcrRowRevisions.errors.push(rowError("OCR revision", index, error)); }

  for (const [index, row] of backup.feeRegisterOcrPostingRuns.entries()) try {
    const id = text(row.id, "OCR run ID"), runNumber = text(row.runNumber, "OCR run number"), batchId = batchMap.get(text(row.batchId, "OCR batch link"));
    if (!batchId) { result.feeRegisterOcrPostingRuns.skipped++; continue; }
    const [byId, byNumber] = await Promise.all([client.feeRegisterOcrPostingRun.findUnique({ where: { id } }), client.feeRegisterOcrPostingRun.findUnique({ where: { runNumber } })]);
    if ((byId && byId.runNumber !== runNumber) || (byNumber && byNumber.id !== id)) { result.feeRegisterOcrPostingRuns.skipped++; continue; }
    const selectedBackup = JSON.parse(json(row.selectedRowIdsJson, "OCR selected rows") as string) as string[], selectedRowIds = selectedBackup.map((value) => rowMap.get(value)).filter(Boolean) as string[];
    if (selectedRowIds.length !== selectedBackup.length) { result.feeRegisterOcrPostingRuns.skipped++; continue; }
    const data = {
      batchId, reviewVersion: integer(row.reviewVersion, "OCR run version"), selectedRowIdsJson: JSON.stringify(selectedRowIds), selectedRowCount: selectedRowIds.length,
      attemptedAmountMinor: integer(row.attemptedAmountMinor, "OCR attempted amount"), postedRowCount: integer(row.postedRowCount, "OCR posted count"),
      postedAmountMinor: integer(row.postedAmountMinor, "OCR posted amount"), failedRowCount: integer(row.failedRowCount, "OCR failure count"),
      status: text(row.status, "OCR run status"), financialPreviewJson: json(row.financialPreviewJson, "OCR preview"),
      postingPolicySnapshotJson: json(row.postingPolicySnapshotJson, "OCR posting policy"), approvalReason: nullable(row.approvalReason),
      failureSummaryJson: json(row.failureSummaryJson, "OCR failure summary", null), approvedAt: date(row.approvedAt), processedAt: date(row.processedAt)
    };
    if (byId) {
      runMap.set(id, id);
      if (isNewer(byId, row)) result.feeRegisterOcrPostingRuns.skipped++;
      else { await client.feeRegisterOcrPostingRun.update({ where: { id }, data }); result.feeRegisterOcrPostingRuns.updated++; }
    } else {
      await client.feeRegisterOcrPostingRun.create({ data: { id, runNumber, ...data, ...dates(row, true) } });
      runMap.set(id, id); result.feeRegisterOcrPostingRuns.created++;
    }
  } catch (error) { result.feeRegisterOcrPostingRuns.errors.push(rowError("OCR posting run", index, error)); }

  for (const [index, row] of backup.feeRegisterOcrEvents.entries()) try {
    const id = text(row.id, "OCR event ID"), batchId = batchMap.get(text(row.batchId, "OCR event batch"));
    if (!batchId || await client.feeRegisterOcrEvent.findUnique({ where: { id } })) { result.feeRegisterOcrEvents.skipped++; continue; }
    const pageId = row.pageId ? pageMap.get(String(row.pageId)) ?? null : null, rowId = row.rowId ? rowMap.get(String(row.rowId)) ?? null : null, postingRunId = row.postingRunId ? runMap.get(String(row.postingRunId)) ?? null : null;
    if ((row.pageId && !pageId) || (row.rowId && !rowId) || (row.postingRunId && !postingRunId)) { result.feeRegisterOcrEvents.skipped++; continue; }
    await client.feeRegisterOcrEvent.create({ data: { id, batchId, pageId, rowId, postingRunId, eventType: text(row.eventType, "OCR event type"), safeReason: nullable(row.safeReason), safeMetadataJson: json(row.safeMetadataJson, "OCR event metadata", null), createdAt: dateRequired(row.createdAt, "OCR event created at") } });
    result.feeRegisterOcrEvents.created++;
  } catch (error) { result.feeRegisterOcrEvents.errors.push(rowError("OCR event", index, error)); }
}

function text(value: unknown, label: string, maximum = 1_000) { const result = String(value ?? "").trim(); if (!result || result.length > maximum) throw new Error(`${label} is required`); return result; }
function nullable(value: unknown) { const result = String(value ?? "").trim(); return result || null; }
function integer(value: unknown, label: string) { const result = Number(value); if (!Number.isInteger(result) || result < 0) throw new Error(`${label} must be a non-negative integer`); return result; }
function nullableInteger(value: unknown) { return value == null || value === "" ? null : integer(value, "Optional OCR integer"); }
function date(value: unknown) { if (value == null || value === "") return null; return dateRequired(value, "OCR date"); }
function dateRequired(value: unknown, label: string) { const result = new Date(String(value)); if (Number.isNaN(result.getTime())) throw new Error(`${label} is invalid`); return result; }
function dates(row: any, includeUpdated = false) { return { ...(row.createdAt ? { createdAt: dateRequired(row.createdAt, "createdAt") } : {}), ...(includeUpdated && row.updatedAt ? { updatedAt: dateRequired(row.updatedAt, "updatedAt") } : {}) }; }
function isNewer(existing: { updatedAt: Date }, row: any) { return row.updatedAt ? existing.updatedAt > dateRequired(row.updatedAt, "updatedAt") : false; }
function json(value: unknown, label: string, fallback: string | null = "{}") { if (value == null || value === "") return fallback; const result = text(value, label, 100_000); try { JSON.parse(result); return result; } catch { throw new Error(`${label} is invalid JSON`); } }
function rowError(entity: string, index: number, error: unknown) { return `${entity} ${index + 1}: ${error instanceof Error ? error.message : "Unknown restore error"}`; }
