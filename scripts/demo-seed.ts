import { spawnSync } from "node:child_process";
import { loadEnvFile } from "node:process";
import { requireDemoBusinessSeed } from "../lib/demo-business-seed-safety";

loadEnvFile();

try {
  requireDemoBusinessSeed(process.env, process.cwd());
} catch (error) {
  console.error(error instanceof Error ? error.message : "DEMO_BUSINESS_DATA_SAFETY_CHECK_FAILED");
  process.exit(1);
}

console.log("Adding or refreshing documented demo records in an isolated database. Existing unrelated records are not deleted.");
const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const result = spawnSync(command, ["db:seed"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    NALANDA_DEMO_SEED_OPT_IN: "true",
    ALLOW_DEMO_USERS: "true",
    DEMO_USER_DATABASE_ROOT: process.env.DEMO_BUSINESS_DATA_ROOT
  },
  stdio: "inherit"
});

process.exit(result.status ?? 1);
