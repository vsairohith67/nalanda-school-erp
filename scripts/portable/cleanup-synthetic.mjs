import { lstat, realpath, rm } from "node:fs/promises";
import path from "node:path";

const workspace = path.resolve(".");
const target = path.resolve(process.env.PORTABLE_SYNTHETIC_ROOT || path.join(workspace, "tmp", "portable-staging"));
const approved = path.resolve(workspace, "tmp", "portable-staging");
if (target !== approved) throw new Error("SYNTHETIC_CLEANUP_TARGET_INVALID");
const stat = await lstat(target).catch(() => null);
if (stat) {
  if (!stat.isDirectory() || stat.isSymbolicLink() || await realpath(target) !== target) throw new Error("SYNTHETIC_CLEANUP_TARGET_UNSAFE");
  await rm(target, { recursive: true, force: false });
}
console.log("PORTABLE_SYNTHETIC_CLEANUP_COMPLETE");
