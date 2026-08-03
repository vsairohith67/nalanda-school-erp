import { runAdmissionsQa } from "./qa23h-harness";

runAdmissionsQa("implementation").catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
