import { randomBytes } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createAndVerifyPayslipRequestAssetBackup } from "../lib/payslip-request-asset-backup";
import { prisma } from "../lib/prisma";

async function main() {
  const keyText = process.env.PAYSLIP_ASSET_BACKUP_KEY?.trim();
  const key = keyText ? Buffer.from(keyText, "base64") : process.env.NODE_ENV === "test" ? randomBytes(32) : null;
  if (!key || key.length !== 32) throw new Error("PAYSLIP_ASSET_BACKUP_KEY must be a base64-encoded 32-byte key supplied through approved secret management.");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const root = path.resolve(process.env.PAYSLIP_ASSET_BACKUP_ROOT?.trim() || path.join(process.cwd(), "backups", `PAYSLIPREQ1-ASSETS-${stamp}`));
  await mkdir(root, { recursive: true });
  const artifactPath = path.join(root, `payslip-request-assets-${stamp}.npsbackup`);
  const proof = await createAndVerifyPayslipRequestAssetBackup(prisma, { artifactPath, key, keyVersion: process.env.PAYSLIP_ASSET_BACKUP_KEY_VERSION?.trim() || "V1", restoreRoots: [path.join(root, "restore-a"), path.join(root, "restore-b")] });
  if ((await readFile(artifactPath)).length !== proof.encryptedBytes) throw new Error("PAYSLIP_ASSET_BACKUP_PERSISTENCE_FAILED");
  console.log(JSON.stringify({ result: "PAYSLIP_ASSET_BACKUP_DOUBLE_RESTORE_VERIFIED", artifactPath, keyWritten: false, ...proof }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : "PAYSLIP_ASSET_BACKUP_FAILED"); process.exitCode = 1; }).finally(() => prisma.$disconnect());
