-- CROSS-PLATFORM-APPS-1A is additive, default-off and stores no private device
-- keys, passwords, PINs, plaintext drafts or plaintext bearer credentials.
CREATE TABLE "NativeAuthRequest" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "publicRequestId" TEXT NOT NULL,
  "challengeHash" TEXT NOT NULL,
  "stateHash" TEXT NOT NULL,
  "nonceHash" TEXT NOT NULL,
  "pkceChallenge" TEXT NOT NULL,
  "pkceMethod" TEXT NOT NULL DEFAULT 'S256',
  "appId" TEXT NOT NULL,
  "appVersion" TEXT NOT NULL,
  "redirectUri" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "deviceLabel" TEXT NOT NULL,
  "publicDeviceId" TEXT NOT NULL,
  "publicSigningKey" TEXT NOT NULL,
  "publicKeyHash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING_BROWSER_AUTH',
  "userId" TEXT,
  "webSessionId" TEXT,
  "roleAssignmentId" TEXT,
  "expiresAt" DATETIME NOT NULL,
  "authorizedAt" DATETIME,
  "consumedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "NativeAuthRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "NativeAuthRequest_status_check" CHECK ("status" IN ('PENDING_BROWSER_AUTH','DEVICE_APPROVAL_REQUIRED','AUTHORIZED','CONSUMED','EXPIRED','DENIED')),
  CONSTRAINT "NativeAuthRequest_pkce_check" CHECK ("pkceMethod" = 'S256')
);

CREATE UNIQUE INDEX "NativeAuthRequest_publicRequestId_key" ON "NativeAuthRequest"("publicRequestId");
CREATE UNIQUE INDEX "NativeAuthRequest_challengeHash_key" ON "NativeAuthRequest"("challengeHash");
CREATE INDEX "NativeAuthRequest_publicDeviceId_status_idx" ON "NativeAuthRequest"("publicDeviceId", "status");
CREATE INDEX "NativeAuthRequest_userId_createdAt_idx" ON "NativeAuthRequest"("userId", "createdAt");
CREATE INDEX "NativeAuthRequest_expiresAt_idx" ON "NativeAuthRequest"("expiresAt");

CREATE TABLE "NativeAuthorizationCode" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "codeHash" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "roleAssignmentId" TEXT NOT NULL,
  "credentialVersion" INTEGER NOT NULL,
  "authorizationVersion" INTEGER NOT NULL,
  "appId" TEXT NOT NULL,
  "redirectUri" TEXT NOT NULL,
  "pkceChallenge" TEXT NOT NULL,
  "expiresAt" DATETIME NOT NULL,
  "usedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NativeAuthorizationCode_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "NativeAuthRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "NativeAuthorizationCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "NativeAuthorizationCode_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "OfflineSyncDevice" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "NativeAuthorizationCode_codeHash_key" ON "NativeAuthorizationCode"("codeHash");
CREATE UNIQUE INDEX "NativeAuthorizationCode_requestId_key" ON "NativeAuthorizationCode"("requestId");
CREATE INDEX "NativeAuthorizationCode_userId_expiresAt_idx" ON "NativeAuthorizationCode"("userId", "expiresAt");
CREATE INDEX "NativeAuthorizationCode_deviceId_expiresAt_idx" ON "NativeAuthorizationCode"("deviceId", "expiresAt");

CREATE TABLE "NativeSession" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "publicSessionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "roleAssignmentId" TEXT NOT NULL,
  "accessTokenHash" TEXT NOT NULL,
  "refreshTokenHash" TEXT NOT NULL,
  "credentialVersion" INTEGER NOT NULL,
  "authorizationVersion" INTEGER NOT NULL,
  "scopesJson" TEXT NOT NULL,
  "tokenVersion" INTEGER NOT NULL DEFAULT 1,
  "accessExpiresAt" DATETIME NOT NULL,
  "refreshExpiresAt" DATETIME NOT NULL,
  "absoluteExpiresAt" DATETIME NOT NULL,
  "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" DATETIME,
  "revocationReason" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "NativeSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "NativeSession_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "OfflineSyncDevice" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "NativeSession_publicSessionId_key" ON "NativeSession"("publicSessionId");
CREATE UNIQUE INDEX "NativeSession_accessTokenHash_key" ON "NativeSession"("accessTokenHash");
CREATE UNIQUE INDEX "NativeSession_refreshTokenHash_key" ON "NativeSession"("refreshTokenHash");
CREATE INDEX "NativeSession_userId_revokedAt_absoluteExpiresAt_idx" ON "NativeSession"("userId", "revokedAt", "absoluteExpiresAt");
CREATE INDEX "NativeSession_deviceId_revokedAt_idx" ON "NativeSession"("deviceId", "revokedAt");
CREATE INDEX "NativeSession_refreshExpiresAt_idx" ON "NativeSession"("refreshExpiresAt");

CREATE TABLE "NativeRefreshTokenHistory" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sessionId" TEXT NOT NULL,
  "refreshTokenHash" TEXT NOT NULL,
  "tokenVersion" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ROTATED',
  "rotatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reusedAt" DATETIME,
  CONSTRAINT "NativeRefreshTokenHistory_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "NativeSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "NativeRefreshTokenHistory_status_check" CHECK ("status" IN ('ROTATED','REUSED'))
);

CREATE UNIQUE INDEX "NativeRefreshTokenHistory_refreshTokenHash_key" ON "NativeRefreshTokenHistory"("refreshTokenHash");
CREATE INDEX "NativeRefreshTokenHistory_sessionId_tokenVersion_idx" ON "NativeRefreshTokenHistory"("sessionId", "tokenVersion");

CREATE TRIGGER "NativeAuthRequest_security_material_immutable"
BEFORE UPDATE ON "NativeAuthRequest"
WHEN NEW."publicRequestId" <> OLD."publicRequestId"
  OR NEW."challengeHash" <> OLD."challengeHash"
  OR NEW."stateHash" <> OLD."stateHash"
  OR NEW."nonceHash" <> OLD."nonceHash"
  OR NEW."pkceChallenge" <> OLD."pkceChallenge"
  OR NEW."pkceMethod" <> OLD."pkceMethod"
  OR NEW."appId" <> OLD."appId"
  OR NEW."appVersion" <> OLD."appVersion"
  OR NEW."redirectUri" <> OLD."redirectUri"
  OR NEW."platform" <> OLD."platform"
  OR NEW."publicDeviceId" <> OLD."publicDeviceId"
  OR NEW."publicSigningKey" <> OLD."publicSigningKey"
  OR NEW."publicKeyHash" <> OLD."publicKeyHash"
BEGIN SELECT RAISE(ABORT, 'NATIVE_AUTH_REQUEST_SECURITY_MATERIAL_IMMUTABLE'); END;

CREATE TRIGGER "NativeAuthorizationCode_single_use"
BEFORE UPDATE OF "usedAt" ON "NativeAuthorizationCode"
WHEN OLD."usedAt" IS NOT NULL OR NEW."usedAt" IS NULL
BEGIN SELECT RAISE(ABORT, 'NATIVE_AUTHORIZATION_CODE_REUSE'); END;

CREATE TRIGGER "NativeSession_revocation_irreversible"
BEFORE UPDATE ON "NativeSession"
WHEN OLD."revokedAt" IS NOT NULL AND (NEW."revokedAt" IS NULL OR NEW."revokedAt" <> OLD."revokedAt")
BEGIN SELECT RAISE(ABORT, 'NATIVE_SESSION_REVOCATION_IRREVERSIBLE'); END;

CREATE TRIGGER "NativeRefreshTokenHistory_append_only_delete"
BEFORE DELETE ON "NativeRefreshTokenHistory"
BEGIN SELECT RAISE(ABORT, 'NATIVE_REFRESH_HISTORY_APPEND_ONLY'); END;
