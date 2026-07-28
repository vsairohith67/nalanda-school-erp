import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const databasePath = path.resolve(process.argv[2] || path.join(workspace, "prisma", "dev.db"));
const backupDirectory = path.resolve(process.argv[3] || path.join(workspace, "backups"));
const sampleAdmissions = Array.from({ length: 8 }, (_, index) => `NPS2600${index + 1}`);

const sourceStudents = [
  ["NPS26001", "LKG", "A", "1", "Normal", 0, "June", "LKG normal sample"],
  ["NPS26002", "I", "B", "4", "Normal", 0, "June", "Class I normal sample"],
  ["NPS26003", "III", "A", "8", "Faculty Child", 50, "June", "Faculty child 50 percent discount"],
  ["NPS26004", "IX", "A", "12", "Normal", 0, "April", "IX due schedule sample"],
  ["NPS26005", "X", "A", "15", "Normal", 0, "April", "Class X part payment sample"],
  ["NPS26006", "VI", "C", "6", "Normal", 0, "June", "Cash plus UPI split payment"],
  ["NPS26007", "IV", "B", "9", "Normal", 0, "June", "Full annual fee paid at once"],
  ["NPS26008", "II", "A", "10", "Normal", 0, "June", "Multiple small payments"]
];

const sourcePayments = [
  ["2026-06-05", "12501", "NPS26002", 8600, "Cash", "Cash", null, "Current Year Fee", "Term 1", "Exact Term 1 payment"],
  ["2026-06-06", "12502", "NPS26003", 4600, "UPI", "Director Sir GPay", "GPAY4600", "Current Year Fee", "Term 1", "Faculty child discounted term"],
  ["2026-04-10", "12503", "NPS26004", 11300, "UPI", "NPS Current Account UPI", "NPSIXT1", "Current Year Fee", "Term 1", "IX April term paid"],
  ["2026-04-11", "12504", "NPS26005", 6000, "Cash", "Cash", null, "Current Year Fee", "Term 1", "Class X part payment"],
  ["2026-06-08", "12505", "NPS26006", 5000, "Cash", "Cash", null, "Current Year Fee", "Multiple", "Split receipt cash row"],
  ["2026-06-08", "12505", "NPS26006", 5000, "UPI", "Director Sir GPay", "GPAYSPLIT", "Current Year Fee", "Multiple", "Split receipt UPI row"],
  ["2026-06-09", "12506", "NPS26007", 36800, "Bank Transfer", "NPS Bank Account", "BANKFULL", "Current Year Fee", "Multiple", "Full annual fee"],
  ["2026-06-10", "12507", "NPS26008", 3000, "Cash", "Cash", null, "Current Year Fee", "Term 1", "Small payment 1"],
  ["2026-06-18", "12508", "NPS26008", 2500, "UPI", "NPS Current Account UPI", "NPS2500", "Current Year Fee", "Term 1", "Small payment 2"],
  ["2026-06-18", "12509", "NPS26001", 7800, "UPI", "NPS Current Account UPI", null, "Current Year Fee", "Term 1", "Reference intentionally missing for audit"],
  ["2026-06-18", "12510", "NPS26001", 1500, "Cash", "Cash", null, "Old Due", "Old Due", "Old due collected separately"]
];

function quote(identifier) {
  return `"${String(identifier).replaceAll('"', '""')}"`;
}

function placeholders(values) {
  return values.map(() => "?").join(",");
}

function scalar(db, sql, ...values) {
  const row = db.prepare(sql).get(...values);
  return Number(row?.value ?? 0);
}

function isoDay(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function digest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").toUpperCase();
}

function maskReceipt(value) {
  const text = String(value ?? "");
  if (text.length <= 4) return `${text.slice(0, 1)}***`;
  return `${text.slice(0, 2)}***${text.slice(-2)}`;
}

function tableMetadata(db) {
  const tables = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  ).all().map((row) => row.name);
  return new Map(tables.map((name) => {
    const columns = db.prepare(`PRAGMA table_info(${quote(name)})`).all();
    const foreignKeys = db.prepare(`PRAGMA foreign_key_list(${quote(name)})`).all();
    return [name, { columns, foreignKeys }];
  }));
}

function collectDependencyClosure(db, metadata, seedStudentIds, seedPaymentIds, seedReceiptNos) {
  const selected = new Map();
  const add = (table, values) => {
    const current = selected.get(table) ?? new Set();
    const size = current.size;
    values.filter((value) => value != null).forEach((value) => current.add(String(value)));
    selected.set(table, current);
    return current.size !== size;
  };
  add("Student", seedStudentIds);
  add("Payment", seedPaymentIds);

  for (const [table, info] of metadata) {
    const columnNames = new Set(info.columns.map((column) => column.name));
    const pk = info.columns.filter((column) => Number(column.pk) > 0).sort((a, b) => a.pk - b.pk);
    if (pk.length !== 1) continue;
    const pkName = pk[0].name;
    const clauses = [];
    const args = [];
    if (columnNames.has("studentId")) {
      clauses.push(`${quote("studentId")} IN (${placeholders(seedStudentIds)})`);
      args.push(...seedStudentIds);
    }
    if (columnNames.has("admissionNo")) {
      clauses.push(`${quote("admissionNo")} IN (${placeholders(sampleAdmissions)})`);
      args.push(...sampleAdmissions);
    }
    if (columnNames.has("paymentId")) {
      clauses.push(`${quote("paymentId")} IN (${placeholders(seedPaymentIds)})`);
      args.push(...seedPaymentIds);
    }
    if (columnNames.has("receiptNo")) {
      clauses.push(`${quote("receiptNo")} IN (${placeholders(seedReceiptNos)})`);
      args.push(...seedReceiptNos);
    }
    if (clauses.length) {
      const rows = db.prepare(
        `SELECT ${quote(pkName)} AS value FROM ${quote(table)} WHERE ${clauses.join(" OR ")}`
      ).all(...args);
      add(table, rows.map((row) => row.value));
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const [childTable, info] of metadata) {
      const pk = info.columns.filter((column) => Number(column.pk) > 0).sort((a, b) => a.pk - b.pk);
      if (pk.length !== 1) continue;
      const childPk = pk[0].name;
      for (const fk of info.foreignKeys) {
        const parentValues = selected.get(fk.table);
        if (!parentValues?.size) continue;
        const values = [...parentValues];
        const rows = db.prepare(
          `SELECT ${quote(childPk)} AS value FROM ${quote(childTable)} WHERE ${quote(fk.from)} IN (${placeholders(values)})`
        ).all(...values);
        changed = add(childTable, rows.map((row) => row.value)) || changed;
      }
    }
  }

  const linkedGuardianIds = db.prepare(
    `SELECT DISTINCT guardianId AS value FROM StudentGuardian WHERE studentId IN (${placeholders(seedStudentIds)})`
  ).all(...seedStudentIds).map((row) => row.value);
  add("Guardian", linkedGuardianIds);

  const counts = {};
  for (const [table, ids] of [...selected.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (ids.size) counts[table] = ids.size;
  }
  return counts;
}

function databaseEvidence(db) {
  db.exec("PRAGMA query_only=ON");
  db.exec("PRAGMA foreign_keys=ON");
  const metadata = tableMetadata(db);
  const admissionArgs = placeholders(sampleAdmissions);
  const students = db.prepare(
    `SELECT id, admissionNo, className, section, rollNo, studentType, discountPercent, startMonth, remarks,
            phone1, phone2, whatsappNumber, createdAt, updatedAt, deletedAt
       FROM Student WHERE admissionNo IN (${admissionArgs}) ORDER BY admissionNo`
  ).all(...sampleAdmissions);
  const studentFingerprintMatches = students.filter((row) => sourceStudents.some((source) =>
    row.admissionNo === source[0] && row.className === source[1] && (row.section ?? null) === (source[2] ?? null)
    && (row.rollNo ?? null) === (source[3] ?? null) && row.studentType === source[4]
    && Number(row.discountPercent) === Number(source[5]) && row.startMonth === source[6] && row.remarks === source[7]
  )).length;
  const seedStudentIds = students.map((row) => row.id);
  const payments = db.prepare(
    `SELECT id, date, receiptNo, admissionNo, amountPaid, paymentMode, receivedAccount, transactionRefNo,
            feeType, termHint, remarks, enteredBy, createdAt, updatedAt, deletedAt, isCancelled
       FROM Payment WHERE admissionNo IN (${admissionArgs}) ORDER BY receiptNo, id`
  ).all(...sampleAdmissions);
  const exactSourcePaymentMatches = payments.filter((row) => sourcePayments.some((source) =>
    isoDay(row.date) === source[0] && row.receiptNo === source[1] && row.admissionNo === source[2]
    && Number(row.amountPaid) === Number(source[3]) && row.paymentMode === source[4]
    && row.receivedAccount === source[5] && (row.transactionRefNo ?? null) === source[6]
    && row.feeType === source[7] && row.termHint === source[8] && row.remarks === source[9]
  )).length;
  const additionalPayments = payments.filter((row) => !sourcePayments.some((source) =>
    isoDay(row.date) === source[0] && row.receiptNo === source[1] && row.admissionNo === source[2]
    && Number(row.amountPaid) === Number(source[3]) && row.paymentMode === source[4]
    && row.receivedAccount === source[5] && (row.transactionRefNo ?? null) === source[6]
    && row.feeType === source[7] && row.termHint === source[8] && row.remarks === source[9]
  ));
  const additionalReceiptGroups = Object.values(additionalPayments.reduce((groups, row) => {
    const key = row.receiptNo;
    const group = groups[key] ?? {
      maskedReceipt: maskReceipt(row.receiptNo),
      numericOnly: /^\d+$/.test(row.receiptNo),
      qaDemoMarker: /qa|test|demo|sample/i.test(`${row.receiptNo} ${row.remarks ?? ""}`),
      rows: 0,
      amount: 0,
      enteredThroughSeed: 0,
      applicationCreated: 0,
      createdAtDay: isoDay(row.createdAt),
      paymentDate: isoDay(row.date)
    };
    group.rows += 1;
    group.amount += Number(row.amountPaid);
    group.enteredThroughSeed += row.enteredBy === "Seed" ? 1 : 0;
    group.applicationCreated += row.enteredBy === "Seed" ? 0 : 1;
    groups[key] = group;
    return groups;
  }, {})).sort((a, b) => a.maskedReceipt.localeCompare(b.maskedReceipt));
  const seedPaymentIds = payments.map((row) => row.id);
  const seedReceiptNos = [...new Set([...payments.map((row) => row.receiptNo), "12511"])];
  const minMax = (table, column, where = "1=1", args = []) => db.prepare(
    `SELECT MIN(${quote(column)}) AS minimum, MAX(${quote(column)}) AS maximum FROM ${quote(table)} WHERE ${where}`
  ).get(...args);
  const studentCreated = minMax("Student", "createdAt", `admissionNo IN (${admissionArgs})`, sampleAdmissions);
  const paymentCreated = minMax("Payment", "createdAt", `admissionNo IN (${admissionArgs})`, sampleAdmissions);
  const tableCounts = Object.fromEntries([...metadata.keys()].map((table) => [
    table,
    scalar(db, `SELECT COUNT(*) AS value FROM ${quote(table)}`)
  ]));
  const nonZeroOperationalTables = Object.fromEntries(
    Object.entries(tableCounts).filter(([, count]) => count > 0)
  );
  const dependencyCounts = collectDependencyClosure(
    db,
    metadata,
    seedStudentIds,
    seedPaymentIds,
    seedReceiptNos
  );
  const fkCheck = db.prepare("PRAGMA foreign_key_check").all();
  const receiptNotes = db.prepare(
    `SELECT status, remarks FROM ReceiptNote WHERE receiptNo IN (${placeholders(seedReceiptNos)})`
  ).all(...seedReceiptNos);

  return {
    businessBaseline: {
      students: scalar(db, "SELECT COUNT(*) AS value FROM Student WHERE deletedAt IS NULL"),
      activeEnrollments: scalar(db, "SELECT COUNT(*) AS value FROM AcademicYearEnrollment WHERE status='ACTIVE'"),
      payments: scalar(db, "SELECT COUNT(*) AS value FROM Payment WHERE deletedAt IS NULL"),
      collected: scalar(db, "SELECT COALESCE(SUM(amountPaid),0) AS value FROM Payment WHERE deletedAt IS NULL AND isCancelled=0"),
      guardians: scalar(db, "SELECT COUNT(*) AS value FROM Guardian"),
      staff: scalar(db, "SELECT COUNT(*) AS value FROM StaffMember")
    },
    studentEvidence: {
      exactSampleAdmissionMatches: students.length,
      exactSourceFieldFingerprintMatches: studentFingerprintMatches,
      allEightMatchSource: students.length === 8 && studentFingerprintMatches === 8,
      sampleRemarkMarkers: students.filter((row) => /sample|split payment|full annual fee|multiple small payments/i.test(row.remarks ?? "")).length,
      placeholderPhoneFamilyMatches: students.filter((row) =>
        /^9000000\d{3}$/.test(row.phone1 ?? "")
        && (!row.phone2 || /^9000000\d{3}$/.test(row.phone2))
        && (!row.whatsappNumber || /^9000000\d{3}$/.test(row.whatsappNumber))
      ).length,
      createdAtRange: [studentCreated.minimum, studentCreated.maximum],
      updatedAtEqualsCreatedAt: students.filter((row) => row.updatedAt === row.createdAt).length,
      softDeleted: students.filter((row) => row.deletedAt != null).length
    },
    paymentEvidence: {
      rowsLinkedToExactSampleAdmissions: payments.length,
      exactCurrentSeedTupleMatches: exactSourcePaymentMatches,
      additionalRowsBeyondCurrentSeed: payments.length - exactSourcePaymentMatches,
      additionalRowsSummary: {
        rows: additionalPayments.length,
        amount: additionalPayments.reduce((sum, row) => sum + Number(row.amountPaid), 0),
        qaDemoMarkedRows: additionalPayments.filter((row) =>
          /qa|test|demo|sample/i.test(`${row.receiptNo} ${row.remarks ?? ""}`)
        ).length,
        numericOnlyReceiptRows: additionalPayments.filter((row) => /^\d+$/.test(row.receiptNo)).length,
        applicationCreatedRows: additionalPayments.filter((row) => row.enteredBy !== "Seed").length,
        receiptGroups: additionalReceiptGroups
      },
      enteredBySeed: payments.filter((row) => row.enteredBy === "Seed").length,
      deterministicSeedIdShape: payments.filter((row) =>
        row.id === `${row.receiptNo}-${row.admissionNo}-${row.paymentMode}`
      ).length,
      numericReceiptFamily: payments.filter((row) => /^\d{5}$/.test(row.receiptNo)).length,
      sourceLikeRemarks: payments.filter((row) =>
        /sample|term|fee|part payment|split receipt|full annual|small payment|audit|old due/i.test(row.remarks ?? "")
      ).length,
      createdAtRange: [paymentCreated.minimum, paymentCreated.maximum],
      softDeleted: payments.filter((row) => row.deletedAt != null).length,
      cancelled: payments.filter((row) => Number(row.isCancelled) === 1).length,
      receiptCount: new Set(payments.map((row) => row.receiptNo)).size,
      amountTotal: payments.reduce((sum, row) => sum + Number(row.amountPaid), 0)
    },
    auditEvidence: {
      paymentAuditsLinked: scalar(
        db,
        `SELECT COUNT(*) AS value FROM PaymentAudit WHERE paymentId IN (${placeholders(seedPaymentIds)})`,
        ...seedPaymentIds
      ),
      baselineMigrationReason: scalar(
        db,
        `SELECT COUNT(*) AS value FROM PaymentAudit WHERE paymentId IN (${placeholders(seedPaymentIds)}) AND reason='Baseline entry migrated from Phase 1'`,
        ...seedPaymentIds
      ),
      createdActions: scalar(
        db,
        `SELECT COUNT(*) AS value FROM PaymentAudit WHERE paymentId IN (${placeholders(seedPaymentIds)}) AND action='CREATED'`,
        ...seedPaymentIds
      ),
      receiptNotesLinked: receiptNotes.length,
      cancelledSampleReceiptNote: receiptNotes.filter((row) =>
        row.status === "Cancelled" && /sample receipt book/i.test(row.remarks ?? "")
      ).length
    },
    importEvidence: {
      importBatches: tableCounts.ImportBatch ?? 0,
      studentImports: scalar(db, "SELECT COUNT(*) AS value FROM ImportBatch WHERE UPPER(type)='STUDENTS'"),
      paymentImports: scalar(db, "SELECT COUNT(*) AS value FROM ImportBatch WHERE UPPER(type)='PAYMENTS'")
    },
    dependencyCounts,
    nonZeroOperationalTables,
    integrity: {
      foreignKeyViolations: fkCheck.length,
      tableCount: metadata.size,
      aggregateDigest: digest({ dependencyCounts, nonZeroOperationalTables })
    }
  };
}

function backupChangePoints(directory) {
  const files = readdirSync(directory)
    .filter((name) => name.endsWith(".json") && name.includes("-backup-"))
    .map((name) => ({ name, path: path.join(directory, name), stat: statSync(path.join(directory, name)) }))
    .sort((a, b) => a.stat.mtimeMs - b.stat.mtimeMs);
  const points = [];
  let previousKey = null;
  for (const file of files) {
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(file.path, "utf8"));
    } catch {
      continue;
    }
    const students = Array.isArray(parsed.students) ? parsed.students : [];
    const payments = Array.isArray(parsed.payments) ? parsed.payments : [];
    const exactStudents = students.filter((row) => sampleAdmissions.includes(String(row.admissionNo))).length;
    const linkedPayments = payments.filter((row) => sampleAdmissions.includes(String(row.admissionNo))).length;
    const amount = payments
      .filter((row) => sampleAdmissions.includes(String(row.admissionNo)) && !row.deletedAt && !row.isCancelled)
      .reduce((sum, row) => sum + Number(row.amountPaid ?? 0), 0);
    const key = `${students.length}|${payments.length}|${exactStudents}|${linkedPayments}|${amount}`;
    if (key !== previousKey) {
      points.push({
        file: file.name,
        students: students.length,
        payments: payments.length,
        exactSampleAdmissions: exactStudents,
        linkedPayments,
        collected: amount,
        generatedAt: parsed.metadata?.generatedAt ?? null
      });
      previousKey = key;
    }
  }
  return {
    filesInspected: files.length,
    changePoints: points,
    firstMatchingCurrentBaseline: points.find((point) =>
      point.students === 8 && point.payments === 19 && point.exactSampleAdmissions === 8
      && point.linkedPayments === 19 && point.collected === 99100
    )?.file ?? null
  };
}

const db = new DatabaseSync(databasePath, { readOnly: true });
try {
  const evidence = databaseEvidence(db);
  const backups = backupChangePoints(backupDirectory);
  console.log(JSON.stringify({
    database: {
      byteSize: statSync(databasePath).size,
      lastWriteUtc: statSync(databasePath).mtime.toISOString()
    },
    evidence,
    backups
  }, null, 2));
} finally {
  db.close();
}
