import { runPayrollQa } from "./qa23i-harness";
runPayrollQa("implementation").catch(error=>{console.error(error instanceof Error?error.message:error);process.exitCode=1;});
