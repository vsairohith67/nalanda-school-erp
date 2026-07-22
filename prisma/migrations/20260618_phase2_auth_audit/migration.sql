ALTER TABLE "Payment" ADD COLUMN "isCancelled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Payment" ADD COLUMN "cancelledAt" DATETIME;
ALTER TABLE "Payment" ADD COLUMN "cancelledByUserId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "cancellationReason" TEXT;

CREATE INDEX "Payment_isCancelled_idx" ON "Payment"("isCancelled");

CREATE TABLE "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "email" TEXT,
  "passwordHash" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastLoginAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

CREATE TABLE "PaymentAudit" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "paymentId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "oldValueJson" TEXT,
  "newValueJson" TEXT,
  "changedByUserId" TEXT NOT NULL,
  "changedByName" TEXT NOT NULL,
  "reason" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentAudit_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PaymentAudit_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "PaymentAudit_paymentId_idx" ON "PaymentAudit"("paymentId");
CREATE INDEX "PaymentAudit_changedByUserId_idx" ON "PaymentAudit"("changedByUserId");
CREATE INDEX "PaymentAudit_action_idx" ON "PaymentAudit"("action");
CREATE INDEX "PaymentAudit_createdAt_idx" ON "PaymentAudit"("createdAt");
