import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { SEED_USER_DEFINITIONS } from "../../lib/seed-users";
import { assertSyntheticSqliteTransfer } from "./synthetic-qa";

assertSyntheticSqliteTransfer();

const seedEnvironment: NodeJS.ProcessEnv = { ...process.env };
for (const definition of SEED_USER_DEFINITIONS) {
  seedEnvironment[definition.env] = `CI-${randomBytes(24).toString("hex")}!`;
}

const tsxCli = path.resolve("node_modules", "tsx", "dist", "cli.mjs");
const result = spawnSync(process.execPath, [tsxCli, "prisma/seed.ts"], {
  cwd: process.cwd(),
  env: seedEnvironment,
  stdio: "inherit"
});
if (result.error) throw new Error("POSTGRES_READINESS_SYNTHETIC_SQLITE_SEED_SPAWN_FAILED", { cause: result.error });
if (result.status !== 0) throw new Error(`POSTGRES_READINESS_SYNTHETIC_SQLITE_SEED_FAILED:${result.status ?? "NO_STATUS"}`);
console.log("POSTGRES_READINESS_SYNTHETIC_SQLITE_SEED_PASSED");
