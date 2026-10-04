import { createServer } from "node:http";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import { createHash } from "node:crypto";
import { generateOnboardingTemplate, parseOnboardingWorkbook } from "../lib/onboarding-workbooks";

/** Actual component/CSS with invented transport only. Never an ERP proxy or database server. */
async function main() {
  const port = Number(process.env.ONBOARDING_REVIEW_COMPONENT_PORT ?? 47835);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("SYNTHETIC_COMPONENT_PORT_INVALID");
  const parent = path.resolve("tmp/onboarding-review-component"); mkdirSync(parent, { recursive: true });
  const out = mkdtempSync(path.join(parent, "owned-"));
  const fixtureFile = path.join(out, "SYNTHETIC-review.xlsx");
  writeFileSync(fixtureFile, generateOnboardingTemplate({ bundle: "STUDENT_GUARDIAN", rows: {
    students: [{ "Import Row Key": "SRC:SYNTH-STUDENTS-A:2", "Admission Number": "SYNTH-0001", "Student Full Name": "SYNTHETIC విద్యార్థి", "Father Name": "SYNTHETIC Father", Phone: "8000000001", "Academic Year": "2026-27", Class: "I", Section: "A", "Student Status": "ACTIVE" }],
    guardians: [{ "Guardian Row Key": "SYNTH-GUARDIAN", Name: "SYNTHETIC Guardian", Relationship: "Father", Mobile: "8000000001" }],
    links: [{ "Link Row Key": "SYNTH-LINK", "Student Row Key": "SRC:SYNTH-STUDENTS-A:2", "Guardian Row Key": "SYNTH-GUARDIAN", "Relationship to Student": "Father" }],
    enrollments: [{ "Enrollment Row Key": "SYNTH-ENROLLMENT", "Student Row Key": "SRC:SYNTH-STUDENTS-A:2", "Academic Year": "2026-27", Class: "I", Section: "A", Status: "ACTIVE" }], staff: []
  } }), { flag: "wx" });
  const counts = { uploads: 0, validations: 0, approvals: 0, executions: 0, executionKeyHashes: [] as string[] };
  let delay = 0;
  const record = () => writeFileSync(path.join(out, "aggregate-requests.json"), JSON.stringify(counts));
  const permissions = { upload: true, validate: true, resolve: true, approve: true, execute: true, audit: true, rollback: true };
  const batches = ["A", "B"].map(suffix => ({ batchReference: `SYNTHETIC-${suffix}`, bundleType: "STUDENT_GUARDIAN", status: "VALIDATED", version: 1, workbookHash: `synthetic-workbook-${suffix}`, templateVersion: "1.0", schemaVersion: "IMPORT-1A-2026-08-10", createdAt: "2026-10-04T00:00:00Z", planHash: `synthetic-plan-${suffix}`, plan: { sheetRows: { Students: 1, Guardians: 1, "Student-Guardian Links": 1, Enrollments: 1 }, createCount: 2, linkCount: 1, enrollmentCount: 1, blockingErrorCount: 0, unresolvedDecisionCount: 1, duplicateCount: 1 }, issues: [{ code: "POSSIBLE_STUDENT_MATCH", severity: "REQUIRES_USER_DECISION", sheet: "Students", row: 2, rowKey: `SRC:SYNTH-STUDENTS-${suffix}:2`, column: "Student Full Name", message: "One synthetic existing Student shares this contact. Review the source row before linking or creating.", suggestion: "Record an explicit supported decision and reason, then validate again." }] }));
  const entry = `import React from "react"; import {createRoot} from "react-dom/client"; import {OnboardingCentre} from "${path.resolve("components/onboarding-centre.tsx").replaceAll("\\", "/")}"; const batches=${JSON.stringify(batches)}; createRoot(document.getElementById("root")).render(<main className="page page-shell onboarding-page"><h1>Invented onboarding component review</h1><p>No ERP or database is connected. Actions below affect this test-local transport only.</p><OnboardingCentre initialBatches={batches} role="DIRECTOR" permissions={${JSON.stringify(permissions)}}/></main>);`;
  writeFileSync(path.join(out, "entry.tsx"), entry);
  await build({ entryPoints: [path.join(out, "entry.tsx")], bundle: true, outfile: path.join(out, "app.js"), format: "esm", jsx: "automatic", define: { "process.env.NODE_ENV": '"development"' }, plugins: [{ name: "owned-worker", setup(builder) { builder.onLoad({ filter: /onboarding-centre\.tsx$/ }, args => ({ contents: readFileSync(args.path, "utf8").replaceAll('new URL("../lib/onboarding-upload.worker.ts", import.meta.url)', 'new URL("/worker.js", window.location.href)'), loader: "tsx" })); } }] });
  await build({ entryPoints: ["lib/onboarding-upload.worker.ts"], bundle: true, outfile: path.join(out, "worker.js"), format: "iife" });
  const server = createServer(async (req, res) => {
    res.setHeader("cache-control", "private, no-store");
    res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; worker-src 'self'; object-src 'none'; frame-ancestors 'none'");
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
    const json = (status: number, value: unknown) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(value)); };
    try {
      if (req.method === "GET" && url.pathname === "/api/onboarding/batches" && url.search === "?capability=1") return json(200, { actorContext: "SYNTHETIC-COMPONENT-ACTOR", role: "DIRECTOR", permissions });
      if (req.method === "POST" && url.pathname === "/api/onboarding/batches") {
        let size = 0; const chunks: Buffer[] = []; for await (const chunk of req) { size += chunk.length; if (size > 6 * 1024 * 1024) return json(413, { error: "Synthetic upload limit" }); chunks.push(chunk); }
        const upload = new Request(`http://127.0.0.1:${port}`, { method: "POST", headers: { "content-type": req.headers["content-type"] ?? "" }, body: Buffer.concat(chunks) });
        const form = await upload.formData(); const file = form.get("workbook");
        if (!(file instanceof File) || form.get("bundle") !== "STUDENT_GUARDIAN") return json(400, { error: "Invented Student/Guardian workbook required" });
        parseOnboardingWorkbook(new Uint8Array(await file.arrayBuffer()), "STUDENT_GUARDIAN");
        counts.uploads++; record(); return json(200, { batch: batches[0] });
      }
      const match = /^\/api\/onboarding\/batches\/(SYNTHETIC-[AB])\/(validate|approve|execute|rollback)$/.exec(url.pathname);
      if (req.method === "POST" && match) {
        let size = 0; const chunks: Buffer[] = []; for await (const chunk of req) { size += chunk.length; if (size > 65536) return json(413, { error: "Synthetic body limit" }); chunks.push(chunk); }
        const body = JSON.parse(Buffer.concat(chunks).toString()); const batch = batches.find(item => item.batchReference === match[1])!;
        if (match[2] === "validate") {
          counts.validations++; record();
          if (delay) await new Promise(resolve => setTimeout(resolve, delay));
          const rowKey = batch.issues[0]?.rowKey ?? `SRC:SYNTH-STUDENTS-${match[1].slice(-1)}:2`;
          const resolution = body.resolutions?.[rowKey]; const ready = resolution && ["LINK_EXISTING", "CREATE_NEW"].includes(resolution.decision) && resolution.reason?.trim();
          return json(200, { batch: { ...batch, status: ready ? "APPROVAL_REQUIRED" : "VALIDATED", version: ++batch.version, planVersion: batch.version, planHash: `synthetic-current-${batch.version}`, resolutions: body.resolutions, issues: ready ? [] : batch.issues, plan: { ...batch.plan, unresolvedDecisionCount: ready ? 0 : 1 } } });
        }
        if (match[2] === "approve") { counts.approvals++; record(); return json(200, { batch: { ...batch, status: "APPROVED", version: ++batch.version, planHash: body.planHash, issues: [], resolutions: {}, plan: { ...batch.plan, unresolvedDecisionCount: 0 } } }); }
        if (match[2] === "execute") { counts.executions++; counts.executionKeyHashes.push(createHash("sha256").update(String(body.idempotencyKey)).digest("hex")); record(); }
        // Deliberate test-local refusal verifies honest retry feedback, without pretending to import.
        return json(409, { error: "Synthetic test-local refusal. Reconcile batch history before retrying." });
      }
      if (url.pathname.startsWith("/api/")) return json(403, { error: "Synthetic harness denies unsupported actions." });
      if (req.method !== "GET") return json(405, { error: "Method refused" });
      if (url.pathname === "/") { delay = url.searchParams.get("scenario") === "late" ? 8000 : 0; res.writeHead(200, { "content-type": "text/html" }); return res.end(`<!doctype html><html class="${url.searchParams.get("theme") === "dark" ? "dark" : ""}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Invented onboarding component review</title><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>`); }
      const files: Record<string, string> = { "/app.js": path.join(out, "app.js"), "/worker.js": path.join(out, "worker.js"), "/style.css": path.resolve("app/globals.css") };
      if (!files[url.pathname]) return json(404, { error: "Not found" });
      res.setHeader("content-type", url.pathname.endsWith(".css") ? "text/css" : "application/javascript"); res.end(readFileSync(files[url.pathname]));
    } catch { json(400, { error: "Invalid invented component request" }); }
  });
  server.listen(port, "127.0.0.1", () => process.stdout.write(`SYNTHETIC_COMPONENT_READY port=${port} pid=${process.pid} ownedRoot=${path.basename(out)}\n`));
}
void main().catch(() => { process.stderr.write("SYNTHETIC_COMPONENT_FAILED\n"); process.exitCode = 1; });
