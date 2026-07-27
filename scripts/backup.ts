import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { formatBackupFilename, generateFullBackup, serializeBackup } from "../lib/backup";
import { prisma } from "../lib/prisma";

async function main() {
  const generatedAt = new Date();
  const backup = await generateFullBackup(prisma, {
    generatedAt,
    generatedBy: process.env.USERNAME || process.env.USER || "Local CLI"
  });
  const backupDirectory = path.resolve(process.env.BACKUP_DIRECTORY?.trim() || path.join(process.cwd(), "backups"));
  const backupPath = path.join(backupDirectory, formatBackupFilename(generatedAt));

  await mkdir(backupDirectory, { recursive: true });
  await writeFile(backupPath, serializeBackup(backup), "utf8");
  console.log(`Backup created: ${backupPath}`);
}

main()
  .catch((error) => {
    console.error("Backup failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
