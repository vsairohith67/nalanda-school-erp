import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { assertPortableRuntimeConfiguration } from "../../lib/portable-runtime/config";
import { readPortableSecret } from "../../lib/portable-runtime/secrets";
import { hashPassword } from "../../lib/password";
import { ensureDefaultRolePermissions } from "../../lib/role-permissions";

/** Shared supported synthetic initialisation, not a backup catalogue import. */
export async function initializeSyntheticFoundation(prisma:PrismaClient) {
 const configuration=assertPortableRuntimeConfiguration(process.env,"seed-synthetic");
 const target=new URL(configuration.databaseUrl);
 if(configuration.environment!=="synthetic-staging"||process.env.NALANDA_SYNTHETIC_STAGING!=="true"||process.env.STAGING_SYNTHETIC_SEED_OPT_IN!=="true"||!new Set(["postgres","localhost","127.0.0.1","::1"]).has(target.hostname)||!/(?:^|_)synthetic(?:_|$)/i.test(target.pathname))throw Error("ISOLATED_SYNTHETIC_FOUNDATION_REQUIRED");
 const markerId="portable-synthetic-marker",actorId="portable-synthetic-director";
  const directorPassword = readPortableSecret("STAGING_SYNTHETIC_DIRECTOR_PASSWORD", process.env, { required: true });
  if (directorPassword.length < 24) throw new Error("PORTABLE_SYNTHETIC_PASSWORD_INVALID");
  const passwordHash = await hashPassword(directorPassword);
  const disabledPasswordHash = await hashPassword(randomBytes(48).toString("base64url"));

  await prisma.schoolSettings.upsert({
    where: { id: markerId },
    update: { schoolName: "PORTABLE SYNTHETIC STAGING - NO REAL DATA", academicYear: "2026-27" },
    create: { id: markerId, schoolName: "PORTABLE SYNTHETIC STAGING - NO REAL DATA", academicYear: "2026-27", phone: "0000000000", addressLine1: "Synthetic staging only", city: "Test City" }
  });
  await prisma.schoolSettings.upsert({
    where: { id: "school" },
    update: { schoolName: "Nalanda Portable Synthetic School", academicYear: "2026-27" },
    create: { id: "school", schoolName: "Nalanda Portable Synthetic School", academicYear: "2026-27", phone: "0000000000", addressLine1: "Synthetic staging only", city: "Test City" }
  });
  await prisma.user.upsert({
    where: { id: actorId },
    update: { passwordHash, isActive: true, role: "DIRECTOR", mustChangePassword: true },
    create: { id: actorId, name: "Portable Synthetic Director", username: "portable-synthetic-director", email: "director@portable.invalid", role: "DIRECTOR", isActive: true, mustChangePassword: true, passwordHash }
  });
  await prisma.user.upsert({
    where: { id: "portable-synthetic-structural-actor" },
    update: { passwordHash: disabledPasswordHash, isActive: false, mustChangePassword: true },
    create: { id: "portable-synthetic-structural-actor", name: "Portable Synthetic Structural Actor", username: "portable-synthetic-structural-actor", email: "structural@portable.invalid", role: "DIRECTOR", isActive: false, mustChangePassword: true, passwordHash: disabledPasswordHash }
  });
  await ensureDefaultRolePermissions(prisma);

  const backupProfile = await prisma.cloudBackupProfile.upsert({
    where: { profileCode: "PORTABLE-SYNTHETIC-S3" },
    update: { status: "ACTIVE", liveUseEnabled: true, providerKind: "OBJECT_STORAGE", destinationLabel: "Private synthetic S3-compatible destination" },
    create: {
      id: "portable-synthetic-backup-profile",
      profileCode: "PORTABLE-SYNTHETIC-S3",
      name: "Portable Synthetic S3-Compatible Backup",
      providerKind: "OBJECT_STORAGE",
      status: "ACTIVE",
      liveUseEnabled: true,
      destinationLabel: "Private synthetic S3-compatible destination",
      destinationReferenceMasked: "nalanda-portable-synthetic-private/private/backups/***",
      encryptionKeyVersion: "V1",
      verificationRequired: true,
      privateAssetsIncluded: false,
      activatedByUserId: actorId
    }
  });
  await prisma.cloudBackupRetentionPolicy.upsert({
    where: { profileId: backupProfile.id },
    update: { keepLatestVerifiedCount: 2, minimumVerifiedCopies: 2, autoPruneEnabled: false },
    create: {
      id: "portable-synthetic-retention-policy",
      policyCode: "PORTABLE-SYNTHETIC-RETENTION",
      profileId: backupProfile.id,
      keepLatestVerifiedCount: 2,
      minimumVerifiedCopies: 2,
      autoPruneEnabled: false,
      createdByUserId: actorId
    }
  });

}
