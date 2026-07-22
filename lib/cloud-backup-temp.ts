import { lstat, mkdir, realpath, readdir, rm } from "node:fs/promises";
import path from "node:path";

export function cloudBackupTempRoot() {
  const configured = process.env.CLOUD_BACKUP_TEMP_DIR?.trim();
  const root = path.resolve(configured || path.join(process.cwd(), "data", "cloud-backup-temp"));
  const publicRoot = path.resolve(process.cwd(), "public");
  if (root === publicRoot || root.startsWith(`${publicRoot}${path.sep}`)) throw new Error("Cloud backup temp storage must not be inside public.");
  return root;
}

export async function cleanupStaleCloudBackupTempFiles(maximumAgeHours = 24, now = new Date()) {
  if (!Number.isFinite(maximumAgeHours) || maximumAgeHours < 1 || maximumAgeHours > 720) throw new Error("Stale temp age must be between 1 and 720 hours.");
  const configured = cloudBackupTempRoot();
  await mkdir(configured, { recursive: true });
  const root = await realpath(configured);
  const entries = await readdir(root, { withFileTypes: true });
  let removed = 0;
  for (const entry of entries) {
    if (!/^[a-f0-9]{32,64}\.(tmp|json|npsbackup)$/.test(entry.name)) continue;
    const target = path.resolve(root, entry.name);
    if (!target.startsWith(`${root}${path.sep}`)) continue;
    const stat = await lstat(target);
    if (!stat.isFile() || stat.isSymbolicLink()) continue;
    if (now.getTime() - stat.mtimeMs < maximumAgeHours * 3_600_000) continue;
    await rm(target, { force: true });
    removed++;
  }
  return { inspected: entries.length, removed };
}
