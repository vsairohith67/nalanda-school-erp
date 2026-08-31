import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const packageManager = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
for (const script of [
  "ocr:benchmark:tesseract",
  "ocr:benchmark:paddle",
  "ocr:benchmark:unlimited",
  "ocr:benchmark:surya",
]) {
  const result = spawnSync(packageManager, [script], {
    cwd: repositoryRoot,
    stdio: "inherit",
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
