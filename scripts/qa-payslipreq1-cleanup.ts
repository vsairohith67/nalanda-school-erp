import { existsSync, rmSync } from "node:fs";
import path from "node:path";

const workspace = path.resolve(".");
const temporaryRoot = path.resolve(workspace, "tmp");
const names = [
  "payslip-request-processing",
  "payslipreq1-migration-smoke-20260808-2339",
  "payslipreq1-tools"
] as const;

const removed: string[] = [];
for (const name of names) {
  const target = path.resolve(temporaryRoot, name);
  if (path.dirname(target) !== temporaryRoot || target === temporaryRoot) throw new Error("PAYSLIPREQ1_CLEANUP_SCOPE_REFUSED");
  if (!existsSync(target)) continue;
  rmSync(target, { recursive: true, force: true });
  removed.push(name);
}

const remaining = names.filter((name) => existsSync(path.resolve(temporaryRoot, name)));
if (remaining.length) throw new Error("PAYSLIPREQ1_CLEANUP_INCOMPLETE");
console.log(JSON.stringify({ result: "PAYSLIPREQ1_PROVEN_QA_ARTIFACTS_REMOVED", removed, remaining }));
