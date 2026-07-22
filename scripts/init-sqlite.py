import sqlite3
from pathlib import Path

db_path = Path("prisma/dev.db")
db_path.parent.mkdir(parents=True, exist_ok=True)
conn = sqlite3.connect(db_path)
cur = conn.cursor()

cur.executescript(
    """
PRAGMA foreign_keys=OFF;

CREATE TABLE IF NOT EXISTS Student (
  id TEXT PRIMARY KEY NOT NULL,
  academicYear TEXT NOT NULL DEFAULT '2026-27',
  admissionNo TEXT NOT NULL UNIQUE,
  studentName TEXT NOT NULL,
  fatherName TEXT NOT NULL,
  motherName TEXT,
  className TEXT NOT NULL,
  section TEXT,
  rollNo TEXT,
  phone1 TEXT NOT NULL,
  phone2 TEXT,
  whatsappNumber TEXT,
  address TEXT,
  status TEXT NOT NULL DEFAULT 'Active',
  studentType TEXT NOT NULL DEFAULT 'Normal',
  discountPercent REAL NOT NULL DEFAULT 0,
  startMonth TEXT NOT NULL DEFAULT 'June',
  remarks TEXT,
  deletedAt DATETIME,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS Student_academicYear_idx ON Student(academicYear);
CREATE INDEX IF NOT EXISTS Student_className_section_idx ON Student(className, section);
CREATE INDEX IF NOT EXISTS Student_status_idx ON Student(status);

CREATE TABLE IF NOT EXISTS FeeStructure (
  id TEXT PRIMARY KEY NOT NULL,
  academicYear TEXT NOT NULL DEFAULT '2026-27',
  className TEXT NOT NULL,
  termAmount REAL NOT NULL,
  term1Month TEXT NOT NULL,
  term2Month TEXT NOT NULL,
  term3Month TEXT NOT NULL,
  term4Month TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS FeeStructure_academicYear_className_key ON FeeStructure(academicYear, className);
CREATE INDEX IF NOT EXISTS FeeStructure_academicYear_idx ON FeeStructure(academicYear);

CREATE TABLE IF NOT EXISTS Payment (
  id TEXT PRIMARY KEY NOT NULL,
  date DATETIME NOT NULL,
  receiptNo TEXT NOT NULL,
  admissionNo TEXT NOT NULL,
  studentId TEXT,
  studentName TEXT NOT NULL,
  className TEXT NOT NULL,
  section TEXT,
  amountPaid REAL NOT NULL,
  paymentMode TEXT NOT NULL,
  receivedAccount TEXT NOT NULL,
  transactionRefNo TEXT,
  feeType TEXT NOT NULL,
  termHint TEXT NOT NULL DEFAULT 'Auto',
  remarks TEXT,
  enteredBy TEXT NOT NULL DEFAULT 'Director',
  editedBy TEXT,
  deletedAt DATETIME,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT Payment_studentId_fkey FOREIGN KEY (studentId) REFERENCES Student(id) ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS Payment_date_idx ON Payment(date);
CREATE INDEX IF NOT EXISTS Payment_receiptNo_idx ON Payment(receiptNo);
CREATE INDEX IF NOT EXISTS Payment_admissionNo_idx ON Payment(admissionNo);
CREATE INDEX IF NOT EXISTS Payment_feeType_idx ON Payment(feeType);
CREATE INDEX IF NOT EXISTS Payment_paymentMode_idx ON Payment(paymentMode);
CREATE INDEX IF NOT EXISTS Payment_receivedAccount_idx ON Payment(receivedAccount);

CREATE TABLE IF NOT EXISTS ReceiptNote (
  id TEXT PRIMARY KEY NOT NULL,
  receiptNo TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'Cancelled',
  remarks TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS User (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  email TEXT UNIQUE,
  passwordHash TEXT NOT NULL,
  role TEXT NOT NULL,
  isActive BOOLEAN NOT NULL DEFAULT true,
  lastLoginAt DATETIME,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS User_role_idx ON User(role);
CREATE INDEX IF NOT EXISTS User_isActive_idx ON User(isActive);

CREATE TABLE IF NOT EXISTS PaymentAudit (
  id TEXT PRIMARY KEY NOT NULL,
  paymentId TEXT NOT NULL,
  action TEXT NOT NULL,
  oldValueJson TEXT,
  newValueJson TEXT,
  changedByUserId TEXT NOT NULL,
  changedByName TEXT NOT NULL,
  reason TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT PaymentAudit_paymentId_fkey FOREIGN KEY (paymentId) REFERENCES Payment(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT PaymentAudit_changedByUserId_fkey FOREIGN KEY (changedByUserId) REFERENCES User(id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS PaymentAudit_paymentId_idx ON PaymentAudit(paymentId);
CREATE INDEX IF NOT EXISTS PaymentAudit_changedByUserId_idx ON PaymentAudit(changedByUserId);
CREATE INDEX IF NOT EXISTS PaymentAudit_action_idx ON PaymentAudit(action);
CREATE INDEX IF NOT EXISTS PaymentAudit_createdAt_idx ON PaymentAudit(createdAt);

CREATE TABLE IF NOT EXISTS SchoolSettings (
  id TEXT PRIMARY KEY NOT NULL DEFAULT 'school',
  schoolName TEXT NOT NULL DEFAULT 'Nalanda Public School',
  addressLine1 TEXT NOT NULL DEFAULT 'Nanalnagar, Mehdipatnam',
  city TEXT NOT NULL DEFAULT 'Hyderabad',
  phone TEXT NOT NULL DEFAULT '040-23513913',
  academicYear TEXT NOT NULL DEFAULT '2026-27',
  receiptPrefix TEXT,
  defaultCurrency TEXT NOT NULL DEFAULT 'INR',
  whatsappReminderFooter TEXT NOT NULL DEFAULT 'Nalanda Public School',
  logoPath TEXT NOT NULL DEFAULT '/nalanda-logo.jpg',
  receiptTitle TEXT NOT NULL DEFAULT 'FEE RECEIPT',
  showSchoolPhone BOOLEAN NOT NULL DEFAULT true,
  showSchoolAddress BOOLEAN NOT NULL DEFAULT true,
  defaultPrintSize TEXT NOT NULL DEFAULT 'A5',
  signatureLabel TEXT NOT NULL DEFAULT 'Receiver Signature',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS UserAudit (
  id TEXT PRIMARY KEY NOT NULL,
  action TEXT NOT NULL,
  actorUserId TEXT NOT NULL,
  actorName TEXT NOT NULL,
  targetUserId TEXT,
  detailsJson TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS UserAudit_action_idx ON UserAudit(action);
CREATE INDEX IF NOT EXISTS UserAudit_actorUserId_idx ON UserAudit(actorUserId);
CREATE INDEX IF NOT EXISTS UserAudit_targetUserId_idx ON UserAudit(targetUserId);
CREATE INDEX IF NOT EXISTS UserAudit_createdAt_idx ON UserAudit(createdAt);

CREATE TABLE IF NOT EXISTS ImportBatch (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL,
  fileName TEXT NOT NULL,
  importedByUserId TEXT NOT NULL,
  importedByName TEXT NOT NULL,
  importedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  mode TEXT NOT NULL,
  totalRows INTEGER NOT NULL,
  createdCount INTEGER NOT NULL DEFAULT 0,
  updatedCount INTEGER NOT NULL DEFAULT 0,
  skippedCount INTEGER NOT NULL DEFAULT 0,
  errorCount INTEGER NOT NULL DEFAULT 0,
  warningCount INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  notes TEXT,
  detailsJson TEXT,
  CONSTRAINT ImportBatch_importedByUserId_fkey FOREIGN KEY (importedByUserId) REFERENCES User(id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS ImportBatch_type_idx ON ImportBatch(type);
CREATE INDEX IF NOT EXISTS ImportBatch_status_idx ON ImportBatch(status);
CREATE INDEX IF NOT EXISTS ImportBatch_importedAt_idx ON ImportBatch(importedAt);
CREATE INDEX IF NOT EXISTS ImportBatch_importedByUserId_idx ON ImportBatch(importedByUserId);

CREATE TABLE IF NOT EXISTS GoLiveChecklist (
  id TEXT PRIMARY KEY NOT NULL DEFAULT 'go-live',
  backupTaken BOOLEAN NOT NULL DEFAULT false,
  schoolSettingsVerified BOOLEAN NOT NULL DEFAULT false,
  realUsersCreated BOOLEAN NOT NULL DEFAULT false,
  defaultPasswordsChanged BOOLEAN NOT NULL DEFAULT false,
  studentMasterImported BOOLEAN NOT NULL DEFAULT false,
  randomStudentsVerified BOOLEAN NOT NULL DEFAULT false,
  paymentTrialCompleted BOOLEAN NOT NULL DEFAULT false,
  paymentTotalsMatched BOOLEAN NOT NULL DEFAULT false,
  randomPaymentsVerified BOOLEAN NOT NULL DEFAULT false,
  testReceiptPrinted BOOLEAN NOT NULL DEFAULT false,
  pendingDuesChecked BOOLEAN NOT NULL DEFAULT false,
  backupAfterImportTaken BOOLEAN NOT NULL DEFAULT false,
  updatedBy TEXT,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
"""
)

payment_columns = {row[1] for row in cur.execute("PRAGMA table_info(Payment)")}
payment_alters = {
    "isCancelled": "ALTER TABLE Payment ADD COLUMN isCancelled BOOLEAN NOT NULL DEFAULT false",
    "cancelledAt": "ALTER TABLE Payment ADD COLUMN cancelledAt DATETIME",
    "cancelledByUserId": "ALTER TABLE Payment ADD COLUMN cancelledByUserId TEXT",
    "cancellationReason": "ALTER TABLE Payment ADD COLUMN cancellationReason TEXT",
}
for column, statement in payment_alters.items():
    if column not in payment_columns:
        cur.execute(statement)

cur.execute("CREATE INDEX IF NOT EXISTS Payment_isCancelled_idx ON Payment(isCancelled)")
cur.execute(
    """
UPDATE Payment
SET isCancelled = true,
    cancelledAt = COALESCE(cancelledAt, deletedAt),
    cancellationReason = COALESCE(cancellationReason, 'Migrated from legacy soft delete')
WHERE deletedAt IS NOT NULL
"""
)

conn.commit()
conn.close()
print(f"SQLite database ready: {db_path.resolve()}")
