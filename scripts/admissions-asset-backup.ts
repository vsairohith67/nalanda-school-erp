import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createAndVerifyAdmissionsAssetBackup } from "../lib/admissions-asset-backup";
import { prisma } from "../lib/prisma";

async function main() {
  const keyText = process.env.ADMISSIONS_ASSET_BACKUP_KEY?.trim(); const key = keyText ? Buffer.from(keyText, "base64") : process.env.NODE_ENV === "test" ? randomBytes(32) : null;
  if (!key || key.length !== 32) throw new Error("ADMISSIONS_ASSET_BACKUP_KEY must be a base64-encoded 32-byte key.");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z"); const root = path.resolve(process.env.ADMISSIONS_ASSET_BACKUP_ROOT?.trim() || path.join(process.cwd(), "backups", `ADMIT23H-ASSETS-${stamp}`)); await mkdir(root, { recursive: true });
  const artifactPath = path.join(root, `admissions-assets-${stamp}.npsbackup`); if (process.env.ADMISSIONS_ASSET_BACKUP_WRITE_KEY === "true") await writeFile(path.join(root, `admissions-assets-${stamp}.key`), key.toString("base64"), { flag: "wx", mode: 0o600 });
  const proof = await createAndVerifyAdmissionsAssetBackup(prisma, { artifactPath, key, keyVersion: "V1", restoreRoots: [path.join(root, "restore-a"), path.join(root, "restore-b")] }); if ((await readFile(artifactPath)).length !== proof.encryptedBytes) throw new Error("ADMISSIONS_ASSET_BACKUP_PERSISTENCE_FAILED"); console.log(JSON.stringify({ result: "ADMISSIONS_ASSET_BACKUP_DOUBLE_RESTORE_VERIFIED", artifactPath, keyWritten: process.env.ADMISSIONS_ASSET_BACKUP_WRITE_KEY === "true", ...proof }, null, 2));
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "ADMISSIONS_ASSET_BACKUP_FAILED"); process.exitCode = 1; }).finally(() => prisma.$disconnect());
