import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { closeSync, copyFileSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, readSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cleanupIsolatedDatabase, createEmptyIsolatedDatabase } from "./migration-isolation";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactRoot = path.join(workspaceRoot, ".qa-artifacts", "final-scope-qa");
const rawResult = path.join(artifactRoot, "focused-tests-raw.json");
const summaryResult = path.join(artifactRoot, "focused-tests.json");
const operationalCopySource = path.join(workspaceRoot, "prisma", "dev.db");

const focusedTests = [
  "tests/auth2b.test.ts",
  "tests/iam1a.test.ts",
  "tests/academic-integrity-1a.test.ts",
  "tests/guardians.test.ts",
  "tests/parent-portal.test.ts",
  "tests/super-admin-work.test.ts",
  "tests/universal-search.test.ts",
  "tests/smart-ai.test.ts",
  "tests/event-media-governance.test.ts",
  "tests/kg-report-card.test.ts",
  "tests/release-operations.test.ts",
  "tests/payment-controls.test.ts",
  "tests/fee-structures.test.ts",
  "tests/expenses.test.ts",
  "tests/budgets.test.ts",
  "tests/misc-income.test.ts",
  "tests/cash-book.test.ts",
  "tests/student-attendance.test.ts",
  "tests/parent-attendance-exam-timetable.test.ts",
  "tests/timetable.test.ts",
  "tests/student-safe-exit.test.ts",
  "tests/backup.test.ts",
  "tests/restore.test.ts",
  "tests/clean-install-migrations.test.ts",
  "tests/sec1-secret-scan.test.ts",
  "tests/v1-final-security.test.ts",
  "tests/git-safety-check.test.ts",
  "tests/final-corrected-scope-acceptance.test.ts"
] as const;

function inside(parent: string, candidate: string) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function sha256(filePath: string) {
  const hash = createHash("sha256");
  const handle = openSync(filePath, "r");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let bytesRead = 0;
    do {
      bytesRead = readSync(handle, buffer, 0, buffer.length, null);
      if (bytesRead > 0) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead > 0);
  } finally {
    closeSync(handle);
  }
  return hash.digest("hex").toUpperCase();
}

function gitText(args: string[]) {
  const result = spawnSync("git", args, { cwd: workspaceRoot, encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error("FINAL_SCOPE_QA_GIT_STATE_UNAVAILABLE");
  return String(result.stdout).trim();
}

function assertSafeArtifacts() {
  const parent = path.dirname(artifactRoot);
  for (const directory of [parent, artifactRoot]) {
    if (!existsSync(directory)) continue;
    if (lstatSync(directory).isSymbolicLink() || !inside(realpathSync(workspaceRoot), realpathSync(directory))) {
      throw new Error("FINAL_SCOPE_QA_ARTIFACT_ROOT_UNSAFE");
    }
  }
  for (const file of [rawResult, summaryResult]) {
    if (existsSync(file) && (!lstatSync(file).isFile() || lstatSync(file).isSymbolicLink())) throw new Error("FINAL_SCOPE_QA_ARTIFACT_FILE_UNSAFE");
  }
}

function main() {
  if (!inside(workspaceRoot, artifactRoot) || !inside(artifactRoot, rawResult) || !inside(artifactRoot, summaryResult)) {
    throw new Error("FINAL_SCOPE_QA_ARTIFACT_PATH_ESCAPE");
  }
  assertSafeArtifacts();
  for (const file of focusedTests) if (!existsSync(path.join(workspaceRoot, file))) throw new Error(`FINAL_SCOPE_QA_TEST_MISSING:${file}`);
  if (!existsSync(operationalCopySource) || !lstatSync(operationalCopySource).isFile() || lstatSync(operationalCopySource).isSymbolicLink()) throw new Error("FINAL_SCOPE_QA_OPERATIONAL_COPY_SOURCE_MISSING");
  mkdirSync(artifactRoot, { recursive: true });
  assertSafeArtifacts();
  if (existsSync(rawResult)) rmSync(rawResult, { force: true });
  const headSha = gitText(["rev-parse", "HEAD"]);
  const baseSha = gitText(["rev-parse", "origin/main"]);
  const sourceHashBefore = sha256(operationalCopySource);
  const databasePath = createEmptyIsolatedDatabase("operational-copy", "final-scope-focused");
  try {
    copyFileSync(operationalCopySource, databasePath);
    if (sha256(databasePath) !== sourceHashBefore) throw new Error("FINAL_SCOPE_QA_DATABASE_COPY_MISMATCH");
    const vitestPath = path.join(workspaceRoot, "node_modules", "vitest", "vitest.mjs");
    const result = spawnSync(process.execPath, [vitestPath, "run", ...focusedTests, "--reporter=json", "--outputFile", rawResult], {
      cwd: workspaceRoot,
      encoding: "utf8",
      windowsHide: true,
      timeout: 15 * 60_000,
      maxBuffer: 16 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        NODE_ENV: "test",
        DATABASE_URL: `file:${databasePath.replaceAll("\\", "/")}`,
        SMART_AI_PROVIDER: "DISABLED",
        LIVE_PROVIDERS_ENABLED: "false",
        EVENT_MEDIA_PUBLIC_GALLERY_ENABLED: "false"
      }
    });
    if (result.error) throw result.error;
    if (result.status !== 0 || !existsSync(rawResult)) {
      process.stdout.write(result.stdout ?? "");
      process.stderr.write(result.stderr ?? "");
      throw new Error(`FINAL_SCOPE_QA_FOCUSED_TESTS_FAILED:${result.status ?? "NO_STATUS"}`);
    }
    const raw = JSON.parse(readFileSync(rawResult, "utf8")) as {
    success?: boolean;
    numTotalTestSuites?: number;
    numPassedTestSuites?: number;
    numFailedTestSuites?: number;
    numTotalTests?: number;
    numPassedTests?: number;
    numFailedTests?: number;
    numPendingTests?: number;
    testResults?: Array<{ status?: string }>;
    };
    const testFilesPassed = raw.testResults?.filter((entry) => entry.status === "passed").length ?? 0;
    const failedTestFiles = raw.testResults?.filter((entry) => entry.status !== "passed").length ?? 0;
    if (!raw.success || raw.numFailedTestSuites || raw.numFailedTests || raw.numPassedTestSuites !== raw.numTotalTestSuites || testFilesPassed !== focusedTests.length || failedTestFiles !== 0) {
      throw new Error("FINAL_SCOPE_QA_FOCUSED_RESULT_NOT_GREEN");
    }
    if (sha256(operationalCopySource) !== sourceHashBefore) throw new Error("FINAL_SCOPE_QA_OPERATIONAL_COPY_SOURCE_MUTATED");
    const summary = {
      schemaVersion: 1,
      headSha,
      baseSha,
      status: "PASS",
      testFilesPassed,
      testsPassed: raw.numPassedTests ?? 0,
      intentionalSkips: raw.numPendingTests ?? 0,
      failedTestFiles,
      testSuitesPassed: raw.numPassedTestSuites ?? 0,
      failedTests: raw.numFailedTests ?? 0,
      operationalCopyIntegrity: "MATCH",
      coveredTestFiles: focusedTests
    };
    writeFileSync(summaryResult, `${JSON.stringify(summary, null, 2)}\n`, { encoding: "utf8", flag: "w" });
    rmSync(rawResult, { force: true });
    process.stdout.write(`${JSON.stringify({ result: "FINAL_CORRECTED_SCOPE_FOCUSED_ACCEPTANCE_PASSED", testFilesPassed: summary.testFilesPassed, testsPassed: summary.testsPassed, intentionalSkips: summary.intentionalSkips, operationalCopyIntegrity: summary.operationalCopyIntegrity })}\n`);
    const evidenceTool = path.join(workspaceRoot, "tools", "release-evidence", "final-scope-evidence.mjs");
    const evidence = spawnSync(process.execPath, [evidenceTool], {
      cwd: workspaceRoot,
      encoding: "utf8",
      windowsHide: true,
      timeout: 2 * 60_000,
      maxBuffer: 16 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env
      }
    });
    process.stdout.write(evidence.stdout ?? "");
    process.stderr.write(evidence.stderr ?? "");
    if (evidence.error) throw evidence.error;
    if (evidence.status !== 0) throw new Error("FINAL_SCOPE_QA_RELEASE_ACCEPTANCE_REQUIRES_FIXES");
  } finally {
    cleanupIsolatedDatabase(databasePath);
    if (existsSync(rawResult)) rmSync(rawResult, { force: true });
    if (sha256(operationalCopySource) !== sourceHashBefore) throw new Error("FINAL_SCOPE_QA_OPERATIONAL_COPY_SOURCE_CHANGED_AFTER_CLEANUP");
  }
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "FINAL_SCOPE_QA_FAILED"}\n`);
  process.exitCode = 1;
}
