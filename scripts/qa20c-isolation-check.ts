import { assertQa20cIsolatedEnvironment } from "../lib/qa20c-isolation";

const evidence = assertQa20cIsolatedEnvironment(process.env);
if (!evidence.enabled) throw new Error("QA20C_ISOLATION_NOT_ENABLED");
console.log(JSON.stringify(evidence));
