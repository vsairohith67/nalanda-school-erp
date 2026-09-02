import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const required = ["OCR_WORKER_BASE_URL", "OCR_WORKER_HMAC_SECRET"];
for (const name of required) if (!process.env[name]) throw new Error(`OCR_WORKER_CONFIGURATION_MISSING:${name}`);
const allowed = ["PATH", "Path", "PATHEXT", "SystemRoot", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "LOCALAPPDATA", "NODE_ENV", "OCR_WORKER_BASE_URL", "OCR_WORKER_HMAC_SECRET", "OCR_WORKER_ID", "OCR_WORKER_CONCURRENCY", "NALANDA_OCR_MODEL_ROOT", "OCR_WORKER_IMAGE"];
const environment = Object.fromEntries(allowed.flatMap((name) => process.env[name] === undefined ? [] : [[name, process.env[name]]]));
const child = spawn(process.execPath, [join(root, "node_modules", "tsx", "dist", "cli.mjs"), join(root, "tools", "ocr-worker", "worker.ts")], { cwd: root, env: environment, stdio: "inherit", windowsHide: true });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("error", (error) => { throw error; });
child.on("exit", (code) => process.exit(code ?? 1));
