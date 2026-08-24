-- OPTIONAL-OPS-V1_5-1A is additive. It creates separate Transport and Cafeteria foundations.
-- No payment, receipt, GPS, address, health-record, vendor or background-job table is added.
-- CreateTable
CREATE TABLE "TransportVehicle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "registrationCode" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TransportVehicle_capacity_check" CHECK ("capacity" > 0)
);

-- CreateTable
CREATE TABLE "TransportRoute" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "directionMode" TEXT NOT NULL DEFAULT 'BOTH',
    "vehicleId" TEXT NOT NULL,
    "driverStaffMemberId" TEXT,
    "attendantStaffMemberId" TEXT,
    "capacity" INTEGER NOT NULL,
    "allocatedSeats" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TransportRoute_capacity_check" CHECK ("capacity" > 0),
    CONSTRAINT "TransportRoute_allocatedSeats_check" CHECK ("allocatedSeats" >= 0 AND "allocatedSeats" <= "capacity"),
    CONSTRAINT "TransportRoute_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "TransportVehicle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TransportRoute_driverStaffMemberId_fkey" FOREIGN KEY ("driverStaffMemberId") REFERENCES "StaffMember" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TransportRoute_attendantStaffMemberId_fkey" FOREIGN KEY ("attendantStaffMemberId") REFERENCES "StaffMember" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TransportStop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "approvedReference" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TransportRouteStop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "stopId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "timingReference" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TransportRouteStop_sequence_check" CHECK ("sequence" > 0),
    CONSTRAINT "TransportRouteStop_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "TransportRoute" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TransportRouteStop_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "TransportStop" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TransportStudentAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "activeStudentId" TEXT,
    "routeId" TEXT NOT NULL,
    "pickupRouteStopId" TEXT NOT NULL,
    "dropRouteStopId" TEXT NOT NULL,
    "routeCodeSnapshot" TEXT NOT NULL,
    "routeNameSnapshot" TEXT NOT NULL,
    "pickupStopSnapshot" TEXT NOT NULL,
    "pickupTimingSnapshot" TEXT,
    "dropStopSnapshot" TEXT NOT NULL,
    "dropTimingSnapshot" TEXT,
    "effectiveFrom" DATETIME NOT NULL,
    "effectiveTo" DATETIME,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "changeReason" TEXT NOT NULL,
    "replacesAssignmentId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdByRole" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TransportStudentAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TransportStudentAssignment_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "TransportRoute" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TransportStudentAssignment_pickupRouteStopId_fkey" FOREIGN KEY ("pickupRouteStopId") REFERENCES "TransportRouteStop" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TransportStudentAssignment_dropRouteStopId_fkey" FOREIGN KEY ("dropRouteStopId") REFERENCES "TransportRouteStop" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TransportStudentAssignment_replacesAssignmentId_fkey" FOREIGN KEY ("replacesAssignmentId") REFERENCES "TransportStudentAssignment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TransportAuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityPublicKey" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "safeMetadataJson" TEXT,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CafeteriaCatalogItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CafeteriaMenu" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "menuDate" DATETIME NOT NULL,
    "dayLabel" TEXT NOT NULL,
    "mealPlanName" TEXT NOT NULL DEFAULT 'STANDARD',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CafeteriaMenuItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "menuId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "mealSlot" TEXT NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CafeteriaMenuItem_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "CafeteriaMenu" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CafeteriaMenuItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CafeteriaCatalogItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CafeteriaStudentEnrollment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "activeStudentId" TEXT,
    "mealPlanName" TEXT,
    "effectiveFrom" DATETIME NOT NULL,
    "effectiveTo" DATETIME,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "changeReason" TEXT NOT NULL,
    "replacesEnrollmentId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdByRole" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CafeteriaStudentEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CafeteriaStudentEnrollment_replacesEnrollmentId_fkey" FOREIGN KEY ("replacesEnrollmentId") REFERENCES "CafeteriaStudentEnrollment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CafeteriaMealRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "serviceDateKey" TEXT NOT NULL,
    "mealSlot" TEXT NOT NULL,
    "recordType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECORDED',
    "idempotencyKey" TEXT NOT NULL,
    "recordedByUserId" TEXT NOT NULL,
    "recordedByRole" TEXT NOT NULL,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CafeteriaMealRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CafeteriaMealRecord_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "CafeteriaStudentEnrollment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CafeteriaMealRecord_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "CafeteriaMenuItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CafeteriaAuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicKey" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityPublicKey" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "safeMetadataJson" TEXT,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "TransportVehicle_publicKey_key" ON "TransportVehicle"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "TransportVehicle_registrationCode_key" ON "TransportVehicle"("registrationCode");

-- CreateIndex
CREATE INDEX "TransportVehicle_status_displayName_idx" ON "TransportVehicle"("status", "displayName");

-- CreateIndex
CREATE UNIQUE INDEX "TransportRoute_publicKey_key" ON "TransportRoute"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "TransportRoute_code_key" ON "TransportRoute"("code");

-- CreateIndex
CREATE INDEX "TransportRoute_status_code_idx" ON "TransportRoute"("status", "code");

-- CreateIndex
CREATE INDEX "TransportRoute_vehicleId_status_idx" ON "TransportRoute"("vehicleId", "status");

-- CreateIndex
CREATE INDEX "TransportRoute_driverStaffMemberId_idx" ON "TransportRoute"("driverStaffMemberId");

-- CreateIndex
CREATE INDEX "TransportRoute_attendantStaffMemberId_idx" ON "TransportRoute"("attendantStaffMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "TransportStop_publicKey_key" ON "TransportStop"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "TransportStop_code_key" ON "TransportStop"("code");

-- CreateIndex
CREATE INDEX "TransportStop_active_name_idx" ON "TransportStop"("active", "name");

-- CreateIndex
CREATE UNIQUE INDEX "TransportRouteStop_publicKey_key" ON "TransportRouteStop"("publicKey");

-- CreateIndex
CREATE INDEX "TransportRouteStop_routeId_direction_active_idx" ON "TransportRouteStop"("routeId", "direction", "active");

-- CreateIndex
CREATE INDEX "TransportRouteStop_stopId_active_idx" ON "TransportRouteStop"("stopId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "TransportRouteStop_routeId_direction_sequence_key" ON "TransportRouteStop"("routeId", "direction", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "TransportRouteStop_routeId_stopId_direction_key" ON "TransportRouteStop"("routeId", "stopId", "direction");

-- CreateIndex
CREATE UNIQUE INDEX "TransportStudentAssignment_publicKey_key" ON "TransportStudentAssignment"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "TransportStudentAssignment_activeStudentId_key" ON "TransportStudentAssignment"("activeStudentId");

-- CreateIndex
CREATE UNIQUE INDEX "TransportStudentAssignment_replacesAssignmentId_key" ON "TransportStudentAssignment"("replacesAssignmentId");

-- CreateIndex
CREATE INDEX "TransportStudentAssignment_studentId_effectiveFrom_idx" ON "TransportStudentAssignment"("studentId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "TransportStudentAssignment_routeId_active_effectiveFrom_idx" ON "TransportStudentAssignment"("routeId", "active", "effectiveFrom");

-- CreateIndex
CREATE INDEX "TransportStudentAssignment_active_effectiveFrom_effectiveTo_idx" ON "TransportStudentAssignment"("active", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "TransportAuditEvent_publicKey_key" ON "TransportAuditEvent"("publicKey");

-- CreateIndex
CREATE INDEX "TransportAuditEvent_entityType_entityPublicKey_occurredAt_idx" ON "TransportAuditEvent"("entityType", "entityPublicKey", "occurredAt");

-- CreateIndex
CREATE INDEX "TransportAuditEvent_eventType_occurredAt_idx" ON "TransportAuditEvent"("eventType", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "CafeteriaCatalogItem_publicKey_key" ON "CafeteriaCatalogItem"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "CafeteriaCatalogItem_code_key" ON "CafeteriaCatalogItem"("code");

-- CreateIndex
CREATE INDEX "CafeteriaCatalogItem_status_available_category_idx" ON "CafeteriaCatalogItem"("status", "available", "category");

-- CreateIndex
CREATE UNIQUE INDEX "CafeteriaMenu_publicKey_key" ON "CafeteriaMenu"("publicKey");

-- CreateIndex
CREATE INDEX "CafeteriaMenu_status_menuDate_idx" ON "CafeteriaMenu"("status", "menuDate");

-- CreateIndex
CREATE UNIQUE INDEX "CafeteriaMenu_menuDate_mealPlanName_key" ON "CafeteriaMenu"("menuDate", "mealPlanName");

-- CreateIndex
CREATE UNIQUE INDEX "CafeteriaMenuItem_publicKey_key" ON "CafeteriaMenuItem"("publicKey");

-- CreateIndex
CREATE INDEX "CafeteriaMenuItem_menuId_mealSlot_available_idx" ON "CafeteriaMenuItem"("menuId", "mealSlot", "available");

-- CreateIndex
CREATE INDEX "CafeteriaMenuItem_itemId_available_idx" ON "CafeteriaMenuItem"("itemId", "available");

-- CreateIndex
CREATE UNIQUE INDEX "CafeteriaMenuItem_menuId_itemId_mealSlot_key" ON "CafeteriaMenuItem"("menuId", "itemId", "mealSlot");

-- CreateIndex
CREATE UNIQUE INDEX "CafeteriaStudentEnrollment_publicKey_key" ON "CafeteriaStudentEnrollment"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "CafeteriaStudentEnrollment_activeStudentId_key" ON "CafeteriaStudentEnrollment"("activeStudentId");

-- CreateIndex
CREATE UNIQUE INDEX "CafeteriaStudentEnrollment_replacesEnrollmentId_key" ON "CafeteriaStudentEnrollment"("replacesEnrollmentId");

-- CreateIndex
CREATE INDEX "CafeteriaStudentEnrollment_studentId_effectiveFrom_idx" ON "CafeteriaStudentEnrollment"("studentId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "CafeteriaStudentEnrollment_active_effectiveFrom_effectiveTo_idx" ON "CafeteriaStudentEnrollment"("active", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "CafeteriaMealRecord_publicKey_key" ON "CafeteriaMealRecord"("publicKey");

-- CreateIndex
CREATE UNIQUE INDEX "CafeteriaMealRecord_idempotencyKey_key" ON "CafeteriaMealRecord"("idempotencyKey");

-- CreateIndex
CREATE INDEX "CafeteriaMealRecord_serviceDateKey_mealSlot_status_idx" ON "CafeteriaMealRecord"("serviceDateKey", "mealSlot", "status");

-- CreateIndex
CREATE INDEX "CafeteriaMealRecord_enrollmentId_recordedAt_idx" ON "CafeteriaMealRecord"("enrollmentId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CafeteriaMealRecord_studentId_serviceDateKey_mealSlot_recordType_key" ON "CafeteriaMealRecord"("studentId", "serviceDateKey", "mealSlot", "recordType");

-- CreateIndex
CREATE UNIQUE INDEX "CafeteriaAuditEvent_publicKey_key" ON "CafeteriaAuditEvent"("publicKey");

-- CreateIndex
CREATE INDEX "CafeteriaAuditEvent_entityType_entityPublicKey_occurredAt_idx" ON "CafeteriaAuditEvent"("entityType", "entityPublicKey", "occurredAt");

-- CreateIndex
CREATE INDEX "CafeteriaAuditEvent_eventType_occurredAt_idx" ON "CafeteriaAuditEvent"("eventType", "occurredAt");
