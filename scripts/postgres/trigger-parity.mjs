#!/usr/bin/env node

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const workspace = path.resolve(".");
const temporaryRoot = path.resolve(workspace, "tmp", `postgres-trigger-parity-${process.pid}`);
const allowedRoot = path.resolve(workspace, "tmp");
const relative = path.relative(allowedRoot, temporaryRoot);
if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error("POSTGRES_TRIGGER_PARITY_TMP_INVALID");
const databasePath = path.join(temporaryRoot, "synthetic-trigger-parity.db");
const inventoryPath = path.join(temporaryRoot, "inventory.json");

function run(args, environment = process.env) {
  const result = spawnSync(process.execPath, args, { cwd: workspace, env: environment, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, windowsHide: true });
  if (result.status !== 0 || result.error) throw new Error(result.error?.message ?? result.stderr.trim() ?? result.stdout.trim() ?? `POSTGRES_TRIGGER_PARITY_COMMAND_FAILED:${args.join(" ")}`);
  return result.stdout.trim();
}

mkdirSync(temporaryRoot, { recursive: true });
try {
  writeFileSync(databasePath, "", { flag: "wx", mode: 0o600 });
  const environment = { ...process.env, DATABASE_PROVIDER: "sqlite", DATABASE_URL: `file:../tmp/${path.basename(temporaryRoot)}/synthetic-trigger-parity.db` };
  delete environment.DIRECT_URL;
  run(["scripts/postgres/select-provider.mjs", "migrate", "--provider=sqlite"], environment);
  run(["scripts/postgres/sqlite-schema-inventory.mjs", databasePath, `--out=${inventoryPath}`], environment);
  const output = run(["scripts/postgres/trigger-contract.mjs", inventoryPath, "--check"], environment);
  console.log(output);
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
