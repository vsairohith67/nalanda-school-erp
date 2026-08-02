import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, rmdirSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { fileSha256 } from "./migration-check-utils";

const WORKSPACE = path.resolve(".");
const OPERATIONAL_DATABASE = path.join(WORKSPACE, "prisma", "dev.db");
const QA_PARENT = path.join(WORKSPACE, "tmp", "parent23dqa-baseline");
const ROOT = path.join(QA_PARENT, `PARENT23DQA-${process.pid}-${randomUUID()}`);
const DATABASE = path.join(ROOT, "PARENT23DQA-baseline-probe.db");

function invariant(value: unknown, code: string): asserts value {
  if (!value) throw new Error(code);
}

function databaseUrl(file: string) {
  return `file:${file.replaceAll("\\", "/")}`;
}

function cleanup() {
  const resolved = path.resolve(ROOT);
  invariant(resolved.startsWith(`${path.resolve(QA_PARENT)}${path.sep}`), "PARENT23DQA_BASELINE_CLEANUP_SCOPE_REFUSED");
  if (existsSync(resolved)) rmSync(resolved, { recursive: true, force: true });
  if (existsSync(QA_PARENT) && readdirSync(QA_PARENT).length === 0) rmdirSync(QA_PARENT);
}

async function main() {
  cleanup();
  mkdirSync(ROOT, { recursive: true });
  const operationalBefore = fileSha256(OPERATIONAL_DATABASE);
  copyFileSync(OPERATIONAL_DATABASE, DATABASE);
  const url = databaseUrl(DATABASE);
  const client = new PrismaClient({ datasourceUrl: url });
  try {
    await client.user.create({ data: {
      name: "PARENT23DQA unexpected active Parent",
      username: `parent23dqa-unexpected-${process.pid}`,
      passwordHash: "PARENT23DQA-NO-LOGIN-CREDENTIAL",
      role: "PARENT",
      isActive: true,
      lifecycleStatus: "ACTIVE"
    } });
  } finally {
    await client.$disconnect();
  }

  const pnpmEntry = path.join(process.env.APPDATA ?? "", "npm", "node_modules", "pnpm", "bin", "pnpm.mjs");
  invariant(existsSync(pnpmEntry), "PARENT23DQA_PNPM_RUNTIME_NOT_FOUND");
  const verifier = spawnSync(process.execPath, [pnpmEntry, "qa:23d:baseline"], {
    cwd: WORKSPACE,
    env: { ...process.env, DATABASE_URL: url },
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true
  });
  const combined = `${verifier.stdout ?? ""}\n${verifier.stderr ?? ""}`;
  invariant(verifier.status !== 0 && combined.includes("PARENT23D_OPERATIONAL_USER_SET_CHANGED"), "PARENT23DQA_BASELINE_VERIFIER_DID_NOT_FAIL_CLOSED");
  invariant(fileSha256(OPERATIONAL_DATABASE) === operationalBefore, "PARENT23DQA_OPERATIONAL_DATABASE_MUTATED");
  console.log(JSON.stringify({ result: "PARENT23DQA_BASELINE_ADVERSARIAL_PROBE_PASSED", unexpectedActiveParentDenied: true, operationalDatabaseUnchanged: true }));
}

main().catch((error) => {
  console.error(JSON.stringify({ result: "PARENT23DQA_BASELINE_ADVERSARIAL_PROBE_FAILED", error: error instanceof Error ? error.message : "unknown" }));
  process.exitCode = 1;
}).finally(cleanup);
