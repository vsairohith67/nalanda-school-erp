import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const output = path.resolve("dist", "portable");
await mkdir(output, { recursive: true });

await build({
  entryPoints: {
    "runtime-command": "scripts/portable/runtime-command.ts",
    "seed-synthetic": "scripts/portable/seed-synthetic.ts",
    "object-store-init": "scripts/portable/object-store-init.ts",
    "scheduled-job": "scripts/portable/scheduled-job.ts",
    "integration-qa": "scripts/portable/integration-qa.ts",
    "backup-qa": "scripts/portable/backup-qa.ts",
    "backup-worker": "scripts/portable/backup-worker.ts",
    "retention-maintenance": "scripts/portable/retention-maintenance.ts",
    "cloud-backup-command": "scripts/cloud-backup-command.ts",
    "jobs/parent-meeting-reminders": "scripts/parent-meeting-reminders.ts",
    "jobs/support-sla-check": "scripts/support-sla-check.ts",
    "jobs/cloud-backup-process-due": "scripts/cloud-backup-command.ts"
  },
  outdir: output,
  bundle: true,
  packages: "external",
  platform: "node",
  target: "node24",
  format: "esm",
  outExtension: { ".js": ".mjs" },
  sourcemap: false,
  minify: false,
  legalComments: "none",
  tsconfig: "tsconfig.json",
  logLevel: "info"
});
