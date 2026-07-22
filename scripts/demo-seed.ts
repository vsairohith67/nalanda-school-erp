import { spawnSync } from "node:child_process";

if (process.env.NODE_ENV === "production") {
  console.error("Demo seeding is disabled when NODE_ENV=production.");
  process.exit(1);
}

console.log("Adding or refreshing documented demo records. Existing unrelated records are not deleted.");
const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const result = spawnSync(command, ["db:seed"], {
  cwd: process.cwd(),
  env: { ...process.env, NALANDA_DEMO_SEED_OPT_IN: "true" },
  stdio: "inherit"
});

process.exit(result.status ?? 1);
