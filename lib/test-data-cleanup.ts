const SAFE_RECEIPT_PREFIXES = ["QA", "TEST", "DEMO", "SAMPLE", "PILOT-R"] as const;
const SAFE_STUDENT_PREFIXES = ["QA", "TEST", "DEMO", "SAMPLE"] as const;
export const TEST_DATA_CLEANUP_CONFIRMATION = "DELETE_TEST_DATA";
export const LIVE_CLEANUP_OVERRIDE_ENV = "QA_CLEANUP_ALLOW_LIVE";

type DeleteManyResult = { count: number };

type CleanupPayment = {
  id: string;
  receiptNo: string;
  admissionNo: string;
  studentName?: string | null;
  amountPaid?: number | null;
};

type CleanupAudit = {
  id: string;
  paymentId: string;
  action?: string | null;
};

type CleanupReceiptNote = {
  id: string;
  receiptNo: string;
  status?: string | null;
};

type CleanupImportBatch = {
  id: string;
  fileName: string;
  type?: string | null;
  mode?: string | null;
};

type CleanupStudent = {
  id: string;
  admissionNo: string;
  studentName: string;
};

type CleanupClient = {
  payment: {
    findMany(args: unknown): Promise<CleanupPayment[]>;
    deleteMany(args: unknown): Promise<DeleteManyResult>;
  };
  paymentAudit: {
    findMany(args: unknown): Promise<CleanupAudit[]>;
    deleteMany(args: unknown): Promise<DeleteManyResult>;
  };
  receiptNote: {
    findMany(args: unknown): Promise<CleanupReceiptNote[]>;
    deleteMany(args: unknown): Promise<DeleteManyResult>;
  };
  importBatch: {
    findMany(args: unknown): Promise<CleanupImportBatch[]>;
    deleteMany(args: unknown): Promise<DeleteManyResult>;
  };
  student: {
    findMany(args: unknown): Promise<CleanupStudent[]>;
    deleteMany(args: unknown): Promise<DeleteManyResult>;
  };
  $transaction?: <T>(callback: (tx: CleanupClient) => Promise<T>) => Promise<T>;
};

export type CleanupSelector = {
  receipts?: string[];
  prefixes?: string[];
};

export type CleanupCandidate = {
  id: string;
  label: string;
  reason: string;
};

export type ManualReviewItem = {
  scope: "receipt" | "prefix" | "student" | "importBatch";
  label: string;
  reason: string;
};

export type TestDataCleanupPreview = {
  safeReceipts: string[];
  safePrefixes: string[];
  payments: CleanupCandidate[];
  paymentAudits: CleanupCandidate[];
  receiptNotes: CleanupCandidate[];
  importBatches: CleanupCandidate[];
  students: CleanupCandidate[];
  manualReview: ManualReviewItem[];
  totals: {
    payments: number;
    paymentAudits: number;
    receiptNotes: number;
    importBatches: number;
    students: number;
  };
};

export type TestDataCleanupResult = {
  applied: boolean;
  preview: TestDataCleanupPreview;
  deleted: TestDataCleanupPreview["totals"];
};

export function normalizeCleanupValue(value: string) {
  return value.trim().toUpperCase();
}

export function isNumericOnlyReceipt(value: string) {
  return /^\d+$/.test(value.trim());
}

export function isSafeReceiptPrefix(prefix: string) {
  const normalized = normalizeCleanupValue(prefix);
  return (SAFE_RECEIPT_PREFIXES as readonly string[]).includes(normalized);
}

export function isSafeTestReceiptNo(receiptNo: string) {
  const normalized = normalizeCleanupValue(receiptNo);
  return !isNumericOnlyReceipt(normalized) && SAFE_RECEIPT_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function isSafeTestStudentAdmissionNo(admissionNo: string) {
  const normalized = normalizeCleanupValue(admissionNo);
  return !isNumericOnlyReceipt(normalized) && SAFE_STUDENT_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function isClearlyTestImportBatchName(fileName: string) {
  const normalized = normalizeCleanupValue(fileName);
  return (
    normalized.startsWith("QA") ||
    normalized.startsWith("TEST") ||
    normalized.startsWith("DEMO") ||
    normalized.startsWith("SAMPLE") ||
    normalized.includes("TEST") ||
    normalized.includes("DEMO") ||
    normalized.includes("SAMPLE")
  );
}

export function isLiveDatabaseUrl(databaseUrl: string | undefined, environment: Record<string, string | undefined> = {}) {
  const value = String(databaseUrl ?? "").toLowerCase();
  return environment.NODE_ENV === "production" || /\b(prod|production|live)\b/.test(value);
}

export function assertCleanupEnvironmentAllowed(
  databaseUrl: string | undefined,
  environment: Record<string, string | undefined> = {}
) {
  const override = environment[LIVE_CLEANUP_OVERRIDE_ENV] === "true" || environment[LIVE_CLEANUP_OVERRIDE_ENV] === "1";
  if (isLiveDatabaseUrl(databaseUrl, environment) && !override) {
    throw new Error(
      `Refusing test-data cleanup on a production/live database. Set ${LIVE_CLEANUP_OVERRIDE_ENV}=true only after confirming this is a copied test database.`
    );
  }
}

export async function previewTestDataCleanup(
  client: CleanupClient,
  selector: CleanupSelector
): Promise<TestDataCleanupPreview> {
  const manualReview: ManualReviewItem[] = [];
  const requestedReceipts = unique((selector.receipts ?? []).map(normalizeCleanupValue).filter(Boolean));
  const requestedPrefixes = unique((selector.prefixes ?? []).map(normalizeCleanupValue).filter(Boolean));
  const safeReceipts = requestedReceipts.filter((receiptNo) => {
    if (isSafeTestReceiptNo(receiptNo)) return true;
    manualReview.push({
      scope: "receipt",
      label: receiptNo,
      reason: isNumericOnlyReceipt(receiptNo)
        ? "Numeric-only receipt numbers can be real school receipts, so they are never cleaned automatically."
        : "Receipt number does not use an obvious QA/TEST/DEMO/SAMPLE/PILOT-R test prefix."
    });
    return false;
  });
  const safePrefixes = requestedPrefixes.filter((prefix) => {
    if (isSafeReceiptPrefix(prefix)) return true;
    manualReview.push({
      scope: "prefix",
      label: prefix,
      reason: isNumericOnlyReceipt(prefix)
        ? "Numeric-only prefixes are blocked because they can match real receipt books."
        : "Only QA, TEST, DEMO, SAMPLE, and PILOT-R prefixes are allowed for prefix cleanup."
    });
    return false;
  });

  const paymentMap = new Map<string, CleanupCandidate & CleanupPayment>();
  for (const receiptNo of safeReceipts) {
    const rows = await client.payment.findMany({
      where: { receiptNo },
      select: paymentSelect
    });
    for (const row of rows) {
      paymentMap.set(row.id, {
        ...row,
        label: `${row.receiptNo} / ${row.admissionNo} / ${row.amountPaid ?? ""}`,
        reason: `Exact requested receipt ${row.receiptNo} uses a safe test prefix.`
      });
    }
  }
  for (const prefix of safePrefixes) {
    const rows = await client.payment.findMany({
      where: { receiptNo: { startsWith: prefix } },
      select: paymentSelect
    });
    for (const row of rows) {
      if (!isSafeTestReceiptNo(row.receiptNo)) {
        manualReview.push({
          scope: "receipt",
          label: row.receiptNo,
          reason: `Matched prefix ${prefix}, but the full receipt does not look like a safe test receipt.`
        });
        continue;
      }
      paymentMap.set(row.id, {
        ...row,
        label: `${row.receiptNo} / ${row.admissionNo} / ${row.amountPaid ?? ""}`,
        reason: `Receipt starts with safe test prefix ${prefix}.`
      });
    }
  }

  const payments = [...paymentMap.values()];
  const paymentIds = payments.map((payment) => payment.id);
  const receiptNos = unique(payments.map((payment) => payment.receiptNo));
  const paymentAudits = paymentIds.length
    ? (await client.paymentAudit.findMany({
        where: { paymentId: { in: paymentIds } },
        select: { id: true, paymentId: true, action: true }
      })).map((audit) => ({
        id: audit.id,
        label: `${audit.action ?? "Audit"} for payment ${audit.paymentId}`,
        reason: "Audit belongs to a payment selected for safe test cleanup."
      }))
    : [];
  const receiptNotes = receiptNos.length
    ? (await client.receiptNote.findMany({
        where: { receiptNo: { in: receiptNos } },
        select: { id: true, receiptNo: true, status: true }
      })).map((note) => ({
        id: note.id,
        label: `${note.receiptNo} / ${note.status ?? "Receipt note"}`,
        reason: "Receipt note belongs to a safe test receipt selected for cleanup."
      }))
    : [];
  const importBatches = await findSafeImportBatches(client, { safeReceipts, safePrefixes, manualReview });
  const students = await findSafeStudents(client, {
    safePrefixes,
    selectedPayments: payments,
    selectedReceiptNos: receiptNos,
    manualReview
  });

  return {
    safeReceipts,
    safePrefixes,
    payments: payments.map(toCandidate),
    paymentAudits,
    receiptNotes,
    importBatches,
    students,
    manualReview,
    totals: {
      payments: payments.length,
      paymentAudits: paymentAudits.length,
      receiptNotes: receiptNotes.length,
      importBatches: importBatches.length,
      students: students.length
    }
  };
}

export async function cleanupTestData(
  client: CleanupClient,
  options: CleanupSelector & {
    apply?: boolean;
    confirm?: string;
    databaseUrl?: string;
    environment?: Record<string, string | undefined>;
  }
): Promise<TestDataCleanupResult> {
  assertCleanupEnvironmentAllowed(options.databaseUrl, options.environment);
  if (options.apply && options.confirm !== TEST_DATA_CLEANUP_CONFIRMATION) {
    throw new Error(`Apply mode requires --confirm ${TEST_DATA_CLEANUP_CONFIRMATION}`);
  }
  const preview = await previewTestDataCleanup(client, options);
  const emptyDeleted = { payments: 0, paymentAudits: 0, receiptNotes: 0, importBatches: 0, students: 0 };
  if (!options.apply || isPreviewEmpty(preview)) {
    return { applied: false, preview, deleted: emptyDeleted };
  }

  const run = async (tx: CleanupClient) => {
    const paymentAuditIds = preview.paymentAudits.map((audit) => audit.id);
    const paymentIds = preview.payments.map((payment) => payment.id);
    const receiptNoteIds = preview.receiptNotes.map((note) => note.id);
    const importBatchIds = preview.importBatches.map((batch) => batch.id);
    const studentIds = preview.students.map((student) => student.id);
    const paymentAudits = paymentAuditIds.length
      ? await tx.paymentAudit.deleteMany({ where: { id: { in: paymentAuditIds } } })
      : { count: 0 };
    const payments = paymentIds.length
      ? await tx.payment.deleteMany({ where: { id: { in: paymentIds } } })
      : { count: 0 };
    const receiptNotes = receiptNoteIds.length
      ? await tx.receiptNote.deleteMany({ where: { id: { in: receiptNoteIds } } })
      : { count: 0 };
    const importBatches = importBatchIds.length
      ? await tx.importBatch.deleteMany({ where: { id: { in: importBatchIds } } })
      : { count: 0 };
    const students = studentIds.length
      ? await tx.student.deleteMany({ where: { id: { in: studentIds } } })
      : { count: 0 };
    return {
      paymentAudits: paymentAudits.count,
      payments: payments.count,
      receiptNotes: receiptNotes.count,
      importBatches: importBatches.count,
      students: students.count
    };
  };

  const deleted = client.$transaction ? await client.$transaction(run) : await run(client);
  return { applied: true, preview, deleted };
}

function isPreviewEmpty(preview: TestDataCleanupPreview) {
  return Object.values(preview.totals).every((count) => count === 0);
}

const paymentSelect = {
  id: true,
  receiptNo: true,
  admissionNo: true,
  studentName: true,
  amountPaid: true
};

function toCandidate(row: CleanupCandidate): CleanupCandidate {
  return { id: row.id, label: row.label, reason: row.reason };
}

async function findSafeImportBatches(
  client: CleanupClient,
  input: {
    safeReceipts: string[];
    safePrefixes: string[];
    manualReview: ManualReviewItem[];
  }
) {
  if (!input.safeReceipts.length && !input.safePrefixes.length) return [];
  const batches = await client.importBatch.findMany({
    orderBy: { importedAt: "asc" },
    select: { id: true, fileName: true, type: true, mode: true }
  });
  return batches.flatMap((batch) => {
    const fileName = normalizeCleanupValue(batch.fileName);
    const matchesSelector =
      input.safeReceipts.some((receiptNo) => fileName.includes(receiptNo)) ||
      input.safePrefixes.some((prefix) => fileName.startsWith(prefix) || fileName.includes(`${prefix}-`) || fileName.includes(`${prefix}_`)) ||
      (input.safePrefixes.includes("SAMPLE") && fileName.includes("SAMPLE"));
    if (!matchesSelector) return [];
    if (!isClearlyTestImportBatchName(batch.fileName)) {
      input.manualReview.push({
        scope: "importBatch",
        label: batch.fileName,
        reason: "Import batch matched the selector but its filename is not clearly sample/test/demo/QA."
      });
      return [];
    }
    return [{
      id: batch.id,
      label: `${batch.fileName} / ${batch.type ?? "import"} / ${batch.mode ?? "mode unknown"}`,
      reason: "Import batch filename is clearly sample/test/demo/QA and matches the cleanup selector."
    }];
  });
}

async function findSafeStudents(
  client: CleanupClient,
  input: {
    safePrefixes: string[];
    selectedPayments: Array<CleanupPayment & CleanupCandidate>;
    selectedReceiptNos: string[];
    manualReview: ManualReviewItem[];
  }
) {
  const candidateAdmissions = new Set<string>();
  const reviewedAdmissions = new Set<string>();
  for (const payment of input.selectedPayments) {
    if (isSafeTestStudentAdmissionNo(payment.admissionNo)) {
      candidateAdmissions.add(payment.admissionNo);
    } else if (!reviewedAdmissions.has(payment.admissionNo)) {
      reviewedAdmissions.add(payment.admissionNo);
      input.manualReview.push({
        scope: "student",
        label: payment.admissionNo,
        reason: "Student was not removed because the admission number does not use a QA/TEST/DEMO/SAMPLE prefix."
      });
    }
  }
  for (const prefix of input.safePrefixes.filter((value) => (SAFE_STUDENT_PREFIXES as readonly string[]).includes(value))) {
    const rows = await client.student.findMany({
      where: { admissionNo: { startsWith: prefix } },
      select: { id: true, admissionNo: true, studentName: true }
    });
    rows.forEach((student) => candidateAdmissions.add(student.admissionNo));
  }
  if (!candidateAdmissions.size) return [];

  const students = await client.student.findMany({
    where: { admissionNo: { in: [...candidateAdmissions] } },
    select: { id: true, admissionNo: true, studentName: true }
  });
  const safeStudents: CleanupCandidate[] = [];
  for (const student of students) {
    const payments = await client.payment.findMany({
      where: { admissionNo: student.admissionNo },
      select: paymentSelect
    });
    const nonTestPayments = payments.filter((payment) =>
      !input.selectedReceiptNos.includes(payment.receiptNo) && !isSafeTestReceiptNo(payment.receiptNo)
    );
    if (nonTestPayments.length) {
      input.manualReview.push({
        scope: "student",
        label: student.admissionNo,
        reason: "Student has non-test payment records remaining, so the student was skipped."
      });
      continue;
    }
    safeStudents.push({
      id: student.id,
      label: `${student.admissionNo} / ${student.studentName}`,
      reason: "Student admission number is clearly QA/TEST/DEMO/SAMPLE and no real-looking payments remain."
    });
  }
  return safeStudents;
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}
