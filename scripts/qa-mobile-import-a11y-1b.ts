import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import path from "node:path";
import { chromium, type Page } from "playwright";
import { generateOnboardingTemplate } from "../lib/onboarding-workbooks";

// This runner only drives the existing synthetic component harness, never ERP.
async function main() {
const port = Number(process.env.IMPORT_BROWSER_PORT ?? 47834);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid harness port");
const origin = `http://127.0.0.1:${port}`;
const run = process.env.IMPORT_BROWSER_RUN ?? "mobile-import-a11y-1b";
if (!/^[a-z0-9-]+$/.test(run)) throw new Error("Invalid harness run label");
const r1Only = process.argv.includes("--r1-only");
const label = process.argv.find(a => a.startsWith("--label="))?.slice(8) ?? "candidate";
if (!/^[a-z0-9-]+$/.test(label)) throw new Error("Unsafe evidence label");
const out = mkdtempSync(path.join(tmpdir(), `nalanda-mobile-a11y-${label}-`));
const studentFile = { name: "invented.csv", mimeType: "text/csv", buffer: readFileSync(`tmp/${run}/student-sentinel.csv`) };
const marksFile = { name: "invented-marks.csv", mimeType: "text/csv", buffer: readFileSync(`tmp/${run}/marks.csv`) };
const workbook = { name: "invented-empty-template.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from(generateOnboardingTemplate({ bundle: "STUDENT_GUARDIAN" })) };
const results: { scenario: string; status: string; detail?: unknown }[] = [];
const sourceHashes = Object.fromEntries(["components/student-import-panel.tsx", "components/marks-importer.tsx", "components/onboarding-centre.tsx", "components/import-review-dialog.tsx", "components/import-row-errors.tsx", "app/globals.css", "lib/student-source.worker.ts", "lib/onboarding-upload.worker.ts", "scripts/bulk-data-exchange-browser.ts", "scripts/qa-mobile-import-a11y-1b.ts"].map(file => [file, createHash("sha256").update(readFileSync(file, "utf8").replaceAll("\r\n", "\n")).digest("hex")]));
const consoleEvents: { type: string; text: string }[] = [];
const requests: { path: string; method: string; action?: string; keys?: string[]; sentinel?: boolean; currentTarget?: boolean }[] = [];
let expectedForbidden = 0;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, serviceWorkers: "block" });
const allowed = new Set(["/", "/app.js", "/style.css", "/worker.js", "/onboarding-worker.js", "/favicon.ico", "/api/import/students", "/api/marks/import", "/api/onboarding/batches", "/api/onboarding/batches/SYNTHETIC-A11Y/approve"]);
let holdStudent = false, holdMarks = false, holdApproval = false, refuseApproval = false;
let refusal = "SYNTHETIC refusal: approval unavailable. No data imported.";
let release: (() => void) | undefined, observed: (() => void) | undefined;
await context.route("**/*", async route => {
  const req = route.request(), url = new URL(req.url());
  if (url.origin !== origin || !allowed.has(url.pathname)) {
    results.push({ scenario: "network allowlist", status: "FAIL", detail: "Unexpected request blocked" });
    await route.abort("blockedbyclient"); return;
  }
  const body = req.method() === "POST" && req.headers()["content-type"]?.includes("application/json") ? req.postDataJSON() : null;
  requests.push({ path: url.pathname, method: req.method(), ...(body ? { action: body.action, keys: Object.keys(body), sentinel: JSON.stringify(body).includes("FORBIDDEN_SYNTHETIC_SENTINEL_1A"), currentTarget: body.assessmentId === "synthetic-assessment" && body.academicYear === "2026-27" && body.model === "LEGACY_ASSESSMENT" } : {}) });
  if ((holdStudent && url.pathname === "/api/import/students" || holdMarks && url.pathname === "/api/marks/import" || holdApproval && url.pathname === "/api/onboarding/batches/SYNTHETIC-A11Y/approve") && req.method() === "POST") {
    observed?.(); await new Promise<void>(resolve => { release = resolve; });
  }
  if (refuseApproval && url.pathname === "/api/onboarding/batches/SYNTHETIC-A11Y/approve") {
    await route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: refusal }) }); return;
  }
  try { await route.continue(); } catch (error) { if (!String(error).includes("closed")) throw error; }
});
const page = await context.newPage();
page.on("pageerror", error => consoleEvents.push({ type: "pageerror", text: error.message }));
page.on("console", message => { if (["error", "warning"].includes(message.type())) consoleEvents.push({ type: message.type(), text: message.text() }); });
async function scenario(name: string, run: () => Promise<unknown>) {
  try { results.push({ scenario: name, status: "PASS", detail: await run() }); }
  catch (error) { results.push({ scenario: name, status: "FAIL", detail: error instanceof Error ? error.message : String(error) }); await page.screenshot({ path: path.join(out, name.replace(/[^a-z0-9]/gi, "-") + "-failure.png"), fullPage: true }); }
}
async function select(kind: string) {
  await page.goto(origin);
  await page.getByLabel("Harness component").selectOption(kind);
  const heading = kind === "student" ? "Student Master Import" : kind === "marks" ? "Legacy assessment CSV import" : "Governed workflow";
  if (kind !== "errors") await page.getByRole("heading", { name: heading, exact: false }).first().waitFor();
}
async function geometry() {
  return page.evaluate(() => {
    const offenders = [...document.querySelectorAll<HTMLElement>("button,input,select,textarea,label,p,h1,h2,h3,summary,li")].filter(e => {
      if (e.closest(".table-wrap")) return false;
      const r = e.getBoundingClientRect();
      return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1);
    }).map(e => ({ tag: e.tagName, text: e.textContent?.slice(0, 60) }));
    return { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, dpr: devicePixelRatio, visualScale: visualViewport?.scale, theme: document.documentElement.dataset.theme, offenders };
  });
}
async function associated(control: ReturnType<Page["getByLabel"]>, expected: string) {
  const described = await control.evaluate(e => (e.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean).map(id => document.getElementById(id)?.textContent ?? "").join(" "));
  assert.ok(described.includes(expected), "Relevant input does not describe its visible feedback");
}
async function idReferences() {
  return page.evaluate(() => {
    const ids = [...document.querySelectorAll("[id]")].map(e => e.id);
    const duplicate = ids.filter((id, i) => ids.indexOf(id) !== i);
    const missing = [...document.querySelectorAll("[aria-describedby],[aria-labelledby]")].flatMap(e =>
      ["aria-describedby", "aria-labelledby"].flatMap(attr => (e.getAttribute(attr) ?? "").split(/\s+/).filter(Boolean).filter(id => !document.getElementById(id)).map(id => ({ tag: e.tagName, attr, id }))));
    return { duplicate, missing };
  });
}
async function validReferences() { assert.deepEqual(await idReferences(), { duplicate: [], missing: [] }); }
async function prepareStudent() {
  await select("student");
  await page.getByLabel("Academic year").selectOption("2026-27");
  await page.getByLabel("Source CSV / XLSX").setInputFiles(studentFile);
  await page.getByText("Review the mapping before validation.", { exact: false }).waitFor();
  await page.getByRole("button", { name: "Validate approved fields locally" }).click();
}
async function prepareMarks() {
  await select("marks");
  await page.getByLabel("Exact context").selectOption("synthetic-assessment");
  await page.getByLabel("Completed CSV", { exact: true }).setInputFiles(marksFile);
  await page.getByText("Exact columns validated", { exact: false }).waitFor();
  await page.getByRole("button", { name: "Server validation / preview" }).click();
  await page.getByRole("button", { name: "Review and confirm draft import" }).waitFor();
}
async function modalKeyboard(triggerName: string) {
  const trigger = page.getByRole("button", { name: triggerName, exact: true });
  await trigger.focus(); await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  const focus = [];
  for (const key of ["Tab", "Tab", "Shift+Tab", "Shift+Tab", "Tab", "Tab"]) {
    await page.keyboard.press(key);
    focus.push(await page.evaluate(() => {
      const e = document.activeElement as HTMLElement;
      return { inside: Boolean(e.closest("dialog")), documentFocus: document.hasFocus(), tag: e.tagName, name: e.getAttribute("aria-label") ?? e.textContent?.slice(0, 60), outline: getComputedStyle(e).outlineWidth };
    }));
  }
  // Native dialogs permit Tab into browser chrome, but never into inert page controls.
  assert.ok(focus.every(f => f.documentFocus ? f.inside && parseFloat(f.outline) > 0 : f.tag === "BODY"), JSON.stringify(focus));
  await trigger.focus();
  assert.equal(await trigger.evaluate(e => e === document.activeElement), false);
  await dialog.getByRole("button", { name: "Go back", exact: true }).last().focus();
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached" });
  assert.equal(await trigger.evaluate(e => e === document.activeElement), true);
  return focus;
}
try {
  if (!r1Only) {
  await scenario("identity-fonts-console", async () => {
    await select("student");
    assert.equal(await page.title(), "Bulk exchange synthetic QA");
    assert.equal(page.url(), origin + "/");
    assert.ok(await page.getByText("SYNTHETIC COMPONENT QA — NO ERP CONNECTION / NO SCHOOL DATA IMPORTED.", { exact: true }).isVisible());
    assert.equal(await page.locator("nextjs-portal,vite-error-overlay").count(), 0);
    const cdp = await context.newCDPSession(page);
    await cdp.send("DOM.enable"); await cdp.send("CSS.enable");
    const doc = await cdp.send("DOM.getDocument");
    const node = await cdp.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: "h1" });
    const fonts = await cdp.send("CSS.getPlatformFontsForNode", { nodeId: node.nodeId });
    await cdp.detach();
    return { browser: browser.version(), fonts, originalCss: "app/globals.css", noOverlay: true };
  });
  for (const viewport of [{ width: 1366, height: 768 }, { width: 390, height: 844 }, { width: 320, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (const kind of ["student", "marks", "onboarding", "errors"]) {
      for (const theme of ["light", "dark"]) await scenario(kind + "-" + viewport.width + "-" + theme, async () => {
        await select(kind);
        if (theme === "dark") await page.getByRole("button", { name: "Toggle light/dark" }).click();
        if (kind === "errors") await page.locator("summary").click();
        const dimensions = await geometry();
        assert.deepEqual(dimensions.offenders, []);
        assert.equal(dimensions.scrollWidth, viewport.width);
        if (viewport.width === 390 || viewport.width === 320) await page.screenshot({ path: path.join(out, kind + "-" + viewport.width + "-" + theme + ".png"), fullPage: true });
        return dimensions;
      });
    }
  }
  results.push({ scenario: "genuine-200-percent-and-400-percent-zoom", status: "NOT_EXECUTED", detail: "Retained measured capability limitation; no supported browser zoom API or new mechanism. Previous ineffective shortcuts are not repeated. Viewport checks are reflow only." });
  await scenario("reduced-motion-original-css", async () => {
    await select("onboarding"); await page.emulateMedia({ reducedMotion: "no-preference" });
    const before = await page.locator(".onboarding-progress > span").evaluate(e => ({ query: matchMedia("(prefers-reduced-motion: reduce)").matches, duration: getComputedStyle(e).transitionDuration }));
    await page.emulateMedia({ reducedMotion: "reduce" });
    const after = await page.locator(".onboarding-progress > span").evaluate(e => ({ query: matchMedia("(prefers-reduced-motion: reduce)").matches, duration: getComputedStyle(e).transitionDuration, scroll: getComputedStyle(e).scrollBehavior }));
    assert.equal(before.query, false); assert.equal(after.query, true); assert.equal(before.duration, "0.2s"); assert.ok(parseFloat(after.duration) < 0.001);
    assert.ok(await page.getByRole("progressbar").isVisible());
    return { before, after };
  });
  await scenario("student-year-error-association", async () => {
    await page.setViewportSize({ width: 320, height: 844 }); await select("student");
    await page.getByLabel("Source CSV / XLSX").setInputFiles(studentFile);
    await page.getByText("Review the mapping before validation.", { exact: false }).waitFor();
    await page.getByRole("button", { name: "Validate approved fields locally" }).click();
    await page.getByText("Select the academic year explicitly.", { exact: true }).waitFor();
    await associated(page.getByLabel("Academic year"), "Select the academic year explicitly.");
    await page.getByLabel("Academic year").selectOption("2026-27");
    assert.notEqual(await page.getByLabel("Academic year").getAttribute("aria-invalid"), "true");
    await page.getByRole("button", { name: "Validate approved fields locally" }).click();
    assert.ok(await page.getByRole("button", { name: "Server validation / preview" }).isEnabled());
  });
  await scenario("file-error-associations", async () => {
    const measurements = [];
    for (const kind of ["student", "marks", "onboarding"]) {
      await select(kind); if (kind === "marks") await page.getByLabel("Exact context").selectOption("synthetic-assessment");
      const input = page.locator('input[type="file"]');
      await input.setInputFiles({ name: "invented-invalid.txt", mimeType: "text/plain", buffer: Buffer.from("invalid synthetic input") });
      const feedback = kind === "student" ? "Source refused." : kind === "marks" ? "Choose a CSV" : "Workbook refused locally.";
      await page.getByText(feedback, { exact: false }).waitFor();
      const text = await input.evaluate(e => (e.getAttribute("aria-describedby") ?? "").split(/\s+/).map(id => document.getElementById(id)?.textContent ?? "").join(" "));
      measurements.push({ kind, associated: text.includes(feedback) });
    }
    assert.ok(measurements.every(m => m.associated), JSON.stringify(measurements));
    return measurements;
  });
  await scenario("student-preview-clear-reselect-mode-and-required-contacts", async () => {
    await prepareStudent(); await page.getByRole("button", { name: "Server validation / preview" }).click();
    await page.getByText("Server preview complete;", { exact: false }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Confirm Student import" }).isDisabled(), true);
    await page.getByLabel("Import mode").selectOption("update");
    assert.equal(await page.getByRole("button", { name: "Confirm Student import" }).count(), 0);
    await page.getByRole("button", { name: "Cancel / clear review" }).click();
    assert.equal(await page.locator('input[type="file"]').inputValue(), "");
    await page.getByLabel("Source CSV / XLSX").setInputFiles(studentFile);
    await page.getByText("Review the mapping before validation.", { exact: false }).waitFor();
    await page.getByRole("button", { name: "Validate approved fields locally" }).click();
    await page.getByText("Local validation only:", { exact: false }).waitFor();
    await page.getByLabel("Target workflow").selectOption("controlled");
    await page.getByLabel("Source CSV / XLSX").setInputFiles(studentFile);
    await page.getByText("Review the mapping before validation.", { exact: false }).waitFor();
    await page.getByRole("button", { name: "Validate approved fields locally" }).click();
    await page.getByText("Controlled onboarding requires father name and phone.", { exact: false }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Download new clean canonical workbook" }).count(), 0);
    return { legacyWarningsPreserved: true, controlledContactBlockPreserved: true };
  });
  await scenario("student-pending-cancel-obsolete-reply", async () => {
    await prepareStudent(); holdStudent = true;
    const pending = new Promise<void>(resolve => { observed = resolve; });
    await page.getByRole("button", { name: "Server validation / preview" }).click(); await pending;
    assert.ok(await page.getByLabel("Import mode").isDisabled());
    await page.getByRole("button", { name: "Cancel / clear review" }).click(); holdStudent = false; release?.();
    await page.getByText("Review cleared.", { exact: false }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Confirm Student import" }).count(), 0);
    await page.getByLabel("Source CSV / XLSX").setInputFiles(studentFile);
    await page.getByText("Review the mapping before validation.", { exact: false }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Confirm Student import" }).count(), 0);
  });
  await scenario("marks-modal-keyboard-reflow-and-context", async () => {
    await prepareMarks();
    const focus = await modalKeyboard("Review and confirm draft import");
    await page.getByRole("button", { name: "Review and confirm draft import" }).click();
    assert.deepEqual((await geometry()).offenders, []);
    await page.screenshot({ path: path.join(out, "marks-dialog-320.png"), fullPage: false });
    await page.getByRole("button", { name: "Go back", exact: true }).click();
    await page.getByLabel("Exact context").selectOption("");
    assert.equal(await page.getByRole("button", { name: "Review and confirm draft import" }).count(), 0);
    await prepareMarks(); await page.getByRole("button", { name: "Clear review", exact: true }).click();
    await page.getByLabel("Completed CSV", { exact: true }).setInputFiles(marksFile);
    await page.getByText("Exact columns validated", { exact: false }).waitFor();
    return focus;
  });
  await scenario("onboarding-worker-clear-reselect-bundle", async () => {
    await select("onboarding");
    await page.getByLabel("Completed XLSX workbook").setInputFiles(workbook);
    await page.getByText("Validated and rebuilt locally", { exact: false }).waitFor();
    assert.ok(await page.getByRole("button", { name: "Upload canonical fields privately" }).isEnabled());
    await page.getByLabel("Import bundle").selectOption("STAFF");
    assert.ok(await page.getByRole("button", { name: "Upload canonical fields privately" }).isDisabled());
    assert.equal(await page.getByLabel("Completed XLSX workbook").inputValue(), "");
    await page.getByLabel("Import bundle").selectOption("STUDENT_GUARDIAN");
    await page.getByLabel("Completed XLSX workbook").setInputFiles(workbook);
    await page.getByText("Validated and rebuilt locally", { exact: false }).waitFor();
    await page.getByRole("button", { name: "Cancel local review" }).click();
    assert.ok(await page.getByRole("button", { name: "Upload canonical fields privately" }).isDisabled());
    await page.getByLabel("Completed XLSX workbook").setInputFiles(workbook);
    await page.getByText("Validated and rebuilt locally", { exact: false }).waitFor();
    await page.getByLabel("Completed XLSX workbook").setInputFiles([]);
    assert.ok(await page.getByRole("button", { name: "Upload canonical fields privately" }).isDisabled());
    results.push({ scenario: "native-file-picker-cancel", status: "NOT_EXECUTED", detail: "setInputFiles([]) proves component clearing only, not an OS picker cancellation." });
  });
  await scenario("onboarding-modal-refusal-accessibility", async () => {
    await select("onboarding-review");
    const focus = await modalKeyboard("Approve current plan");
    await page.getByRole("button", { name: "Approve current plan" }).click();
    await page.getByLabel("Reason", { exact: true }).fill("Invented review reason");
    await page.getByLabel("Re-authentication password").fill("SYNTHETIC-ONLY");
    refuseApproval = true;
    await page.getByRole("button", { name: "Approve", exact: true }).click();
    await page.getByText("SYNTHETIC refusal:", { exact: false }).waitFor();
    const inModal = await page.getByRole("alert").evaluate(e => Boolean(e.closest("dialog")));
    await page.screenshot({ path: path.join(out, "onboarding-refusal-320.png"), fullPage: false });
    assert.ok(inModal, "Refusal is outside the active modal and inaccessible behind it");
    await associated(page.getByRole("textbox", { name: "Reason", exact: true }), "SYNTHETIC refusal:");
    assert.deepEqual((await geometry()).offenders, []);
    await page.keyboard.press("Escape");
    assert.equal(await page.getByRole("dialog").count(), 0);
    return focus;
  });
  await scenario("boundary-and-console-health", async () => {
    assert.equal(requests.filter(r => r.sentinel).length, 0);
    assert.equal(consoleEvents.filter(e => e.type === "pageerror" || !/409 \(Conflict\)|net::ERR_ABORTED/.test(e.text)).length, 0, JSON.stringify(consoleEvents));
    for (const endpoint of ["/api/import/students", "/api/marks/import"]) for (const action of ["confirm", "import", "dry-run", "execute"]) {
      const response = await context.request.post(origin + endpoint, { data: { action } }); assert.equal(response.status(), 403);
    }
    assert.equal((await context.request.get(origin + "/unknown")).status(), 404);
    assert.equal((await context.request.get(origin + "/api/unknown")).status(), 403);
    assert.equal((await context.request.post(origin + "/app.js")).status(), 405);
    assert.equal((await context.request.post(origin + "/api/import/students", { data: Buffer.from("{"), headers: { "content-type": "application/json" } })).status(), 400);
    assert.equal((await context.request.post(origin + "/api/onboarding/batches", { multipart: { bundle: "STUDENT_GUARDIAN" } })).status(), 400);
    assert.equal((await context.request.get(origin + "/")).status(), 200);
    return { sentinelAbsent: true, refusedMutations: true, expectedConsole: consoleEvents };
  });
  await scenario("pending-legacy-preview-unmount-and-fresh-context", async () => {
    await select("marks");
    await page.getByLabel("Exact context").selectOption("synthetic-assessment");
    await page.getByLabel("Completed CSV", { exact: true }).setInputFiles(marksFile);
    await page.getByText("Exact columns validated", { exact: false }).waitFor();
    holdMarks = true;
    const pending = new Promise<void>(resolve => { observed = resolve; });
    await page.getByRole("button", { name: "Server validation / preview" }).click(); await pending;
    assert.ok(await page.getByLabel("Exact context").isDisabled());
    assert.ok(await page.getByRole("button", { name: "Clear review", exact: true }).isDisabled());
    await page.getByLabel("Harness component").selectOption("student");
    holdMarks = false; release?.();
    await page.getByLabel("Harness component").selectOption("marks");
    await page.getByLabel("Exact context").selectOption("synthetic-assessment");
    assert.equal(await page.getByRole("button", { name: "Review and confirm draft import" }).count(), 0);
    assert.equal(await page.getByLabel("Completed CSV", { exact: true }).inputValue(), "");
    await page.getByLabel("Completed CSV", { exact: true }).setInputFiles(marksFile);
    await page.getByText("Exact columns validated", { exact: false }).waitFor();
    await page.getByRole("button", { name: "Server validation / preview" }).click();
    await page.getByRole("button", { name: "Review and confirm draft import" }).waitFor();
    return { pendingDisabled: true, oldEligibilityCleared: true, freshPreviewEnabled: true };
  });
  await scenario("demanding-states-motion-targets-and-keyboard", async () => {
    const observations = [];
    await page.setViewportSize({ width: 320, height: 844 });
    for (const theme of ["light", "dark"]) {
      await prepareStudent();
      if (theme === "dark") await page.getByRole("button", { name: "Toggle light/dark" }).click();
      await page.getByRole("button", { name: "Server validation / preview" }).click();
      await page.getByText("Server preview complete;", { exact: false }).waitFor();
      await page.getByText("Row 2", { exact: false }).click();
      await page.getByText("Optional preview table", { exact: true }).click();
      assert.deepEqual((await geometry()).offenders, []);
      assert.equal(await page.locator("table tbody tr").count(), 1);
      await page.getByRole("button", { name: "Cancel / clear review" }).focus();
      assert.ok(await page.evaluate(() => parseFloat(getComputedStyle(document.activeElement!).outlineWidth) > 0));
      await page.screenshot({ path: path.join(out, "student-review-320-" + theme + ".png"), fullPage: true });
      observations.push({ kind: "student", theme, geometry: await geometry(), table: await page.locator(".table-wrap").evaluate(e => ({ width: e.clientWidth, scroll: e.scrollWidth, overflow: getComputedStyle(e).overflowX })) });
      await prepareMarks();
      if (theme === "dark") await page.getByRole("button", { name: "Toggle light/dark" }).click();
      await page.getByRole("button", { name: "Review and confirm draft import" }).click();
      await page.emulateMedia({ reducedMotion: "reduce" });
      const motion = await page.getByRole("dialog").evaluate(e => ({ animations: e.getAnimations({ subtree: true }).length, duration: getComputedStyle(e).transitionDuration, scroll: getComputedStyle(e).scrollBehavior }));
      assert.equal(motion.animations, 0);
      const targets = await page.getByRole("dialog").locator("button").evaluateAll(es => es.map(e => ({ name: e.textContent, height: e.getBoundingClientRect().height })));
      assert.ok(targets.every(t => t.height >= 44), JSON.stringify(targets));
      assert.deepEqual((await geometry()).offenders, []);
      await page.screenshot({ path: path.join(out, "marks-dialog-320-" + theme + ".png") });
      observations.push({ kind: "legacy-marks", theme, motion, targets });
      await page.keyboard.press("Escape");
      await select("onboarding-review");
      if (theme === "dark") await page.getByRole("button", { name: "Toggle light/dark" }).click();
      await page.getByRole("button", { name: "Approve current plan" }).click();
      assert.ok(await page.getByRole("button", { name: "Approve", exact: true }).isDisabled());
      await page.getByLabel("Reason", { exact: true }).fill("Invented review reason");
      await page.getByLabel("Re-authentication password").fill("SYNTHETIC-ONLY");
      await page.getByRole("button", { name: "Approve", exact: true }).click();
      await page.getByRole("dialog").getByRole("alert").waitFor();
      await page.getByRole("dialog").getByRole("alert").scrollIntoViewIfNeeded();
      assert.deepEqual((await geometry()).offenders, []);
      const targetHeights = await page.getByRole("dialog").locator("button").evaluateAll(es => es.map(e => e.getBoundingClientRect().height));
      assert.ok(targetHeights.every(h => h >= 44));
      await page.screenshot({ path: path.join(out, "onboarding-refusal-320-" + theme + ".png") });
      observations.push({ kind: "onboarding", theme, targetHeights, geometry: await geometry() });
      await page.keyboard.press("Escape");
    }
    return observations;
  });
  }
  for (const kind of ["student", "marks", "onboarding"]) await scenario("r1-two-widgets-" + kind, async () => {
    await select(kind); await page.getByRole("button", { name: "Toggle second widget" }).click();
    assert.equal(await page.getByTestId(/^import-widget-/).count(), 2);
    for (const widget of await page.getByTestId(/^import-widget-/).all()) {
      if (kind === "marks") await widget.getByLabel("Exact context").selectOption("synthetic-assessment");
      await widget.locator('input[type="file"]').setInputFiles({ name: "invented-invalid.txt", mimeType: "text/plain", buffer: Buffer.from("invalid synthetic input") });
      await widget.getByText(kind === "student" ? "Source refused." : kind === "marks" ? "Choose a CSV" : "Workbook refused locally.", { exact: false }).waitFor();
    }
    await validReferences();
    return { widgets: 2, references: await idReferences() };
  });
  await scenario("6a-two-onboarding-dialog-names-and-stable-headings", async () => {
    await select("onboarding-review"); await page.getByRole("button", { name: "Toggle second widget" }).click();
    const widgets = page.getByTestId(/^import-widget-/);
    assert.equal(await widgets.count(), 2);
    const headings = await widgets.getByRole("heading", { name: "Governed workflow", exact: true }).evaluateAll(es => es.map(e => e.id));
    assert.equal(new Set(headings).size, 2);
    for (const widget of await widgets.all()) {
      assert.equal(await widget.getByRole("region", { name: "Governed workflow", exact: true }).count(), 1);
      const trigger = widget.getByRole("button", { name: "Approve current plan", exact: true });
      await trigger.click();
      const dialog = widget.getByRole("dialog", { name: "Review onboarding action", exact: true });
      await dialog.waitFor();
      assert.equal(await dialog.getByRole("heading", { name: "Approve Dry-run Plan", exact: true }).count(), 1);
      assert.equal(await dialog.getByRole("textbox", { name: "Reason", exact: true }).count(), 1);
      assert.equal(await dialog.getByLabel("Re-authentication password", { exact: true }).count(), 1);
      await validReferences(); await page.keyboard.press("Escape"); await dialog.waitFor({ state: "detached" });
      assert.ok(await trigger.evaluate(e => e === document.activeElement));
    }
    await page.getByRole("button", { name: "Toggle light/dark" }).click();
    assert.deepEqual(await widgets.getByRole("heading", { name: "Governed workflow", exact: true }).evaluateAll(es => es.map(e => e.id)), headings);
    return { namedDialogs: 2, distinctStableHeadingIds: true, focusReturned: true };
  });
  await scenario("6a-onboarding-pending-and-new-refusal-after-reopen", async () => {
    await select("onboarding-review");
    const trigger = page.getByRole("button", { name: "Approve current plan", exact: true });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Review onboarding action", exact: true });
    const reason = dialog.getByRole("textbox", { name: "Reason", exact: true });
    const password = dialog.getByLabel("Re-authentication password", { exact: true });
    await reason.fill("Invented pending review reason"); await password.fill("SYNTHETIC-ONLY");
    holdApproval = true; refuseApproval = true; refusal = "SYNTHETIC first operation refusal";
    const pending = new Promise<void>(resolve => { observed = resolve; });
    try {
      await dialog.getByRole("button", { name: "Approve", exact: true }).click(); await pending;
      await dialog.getByText("Request in progress.", { exact: false }).waitFor();
      await page.keyboard.press("Escape"); assert.ok(await dialog.isVisible());
      for (const cancel of await dialog.getByRole("button", { name: "Go back", exact: true }).all()) assert.ok(await cancel.isDisabled());
      assert.equal(await reason.inputValue(), "Invented pending review reason");
    } finally { holdApproval = false; release?.(); }
    await dialog.getByRole("alert").getByText(refusal, { exact: true }).waitFor();
    await page.keyboard.press("Escape"); await dialog.waitFor({ state: "detached" });
    await trigger.click(); await dialog.waitFor();
    assert.equal(await dialog.getByRole("alert").count(), 0);
    assert.ok(await dialog.getByRole("button", { name: "Approve", exact: true }).isDisabled());
    await reason.fill("Invented new operation reason"); await password.fill("SYNTHETIC-ONLY");
    refusal = "SYNTHETIC new operation refusal";
    await dialog.getByRole("button", { name: "Approve", exact: true }).click();
    await dialog.getByRole("alert").getByText(refusal, { exact: true }).waitFor();
    await associated(reason, refusal); await validReferences(); await page.keyboard.press("Escape");
    return { pendingPreserved: true, obsoleteRefusalCleared: true, newRefusalVisible: true };
  });
  await scenario("r1-marks-dialog-idrefs-and-current-target", async () => {
    await prepareMarks(); await validReferences();
    await page.getByRole("button", { name: "Review and confirm draft import" }).click();
    await validReferences();
    const response = page.waitForResponse(r => r.url() === origin + "/api/marks/import" && r.request().method() === "POST");
    await page.getByRole("button", { name: "Confirm draft import", exact: true }).click();
    assert.equal((await response).status(), 403); expectedForbidden++;
    await page.getByText("Synthetic harness refuses execution.", { exact: true }).waitFor();
    assert.equal(requests.filter(r => r.action === "confirm").length, 1);
    assert.ok(requests.find(r => r.action === "confirm")?.currentTarget);
    assert.equal(await page.getByRole("dialog").count(), 0);
    assert.equal(await page.getByRole("button", { name: "Review and confirm draft import" }).count(), 0);
    await validReferences();
    return { confirmationRefused: true, staleEligibilityRemoved: true };
  });
  await scenario("r1-student-invalid-to-valid", async () => {
    await select("student");
    await page.getByLabel("Source CSV / XLSX").setInputFiles(studentFile);
    await page.getByText("Review the mapping before validation.", { exact: false }).waitFor();
    await page.getByRole("button", { name: "Validate approved fields locally" }).click();
    assert.equal(await page.getByLabel("Academic year").getAttribute("aria-invalid"), "true");
    await associated(page.getByLabel("Academic year"), "Select the academic year explicitly.");
    await page.getByLabel("Academic year").selectOption("2026-27");
    assert.notEqual(await page.getByLabel("Academic year").getAttribute("aria-invalid"), "true");
    assert.equal(await page.getByText("Select the academic year explicitly.", { exact: true }).count(), 0);
    await page.getByText("Legacy required:", { exact: false }).waitFor();
    await validReferences();
  });
  await scenario("r1-file-replacement-removes-prior-preview", async () => {
    await prepareStudent(); await page.getByRole("button", { name: "Server validation / preview" }).click();
    await page.getByText("Server preview complete;", { exact: false }).waitFor();
    await page.getByLabel("Source CSV / XLSX").setInputFiles({ ...studentFile, name: "invented-replacement.csv", buffer: Buffer.from(studentFile.buffer.toString().replace("00001", "00002")) });
    await page.getByText("Review the mapping before validation.", { exact: false }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Confirm Student import" }).count(), 0);
    await page.getByRole("button", { name: "Validate approved fields locally" }).click();
    await page.getByRole("button", { name: "Server validation / preview" }).click();
    await page.getByText("Server preview complete;", { exact: false }).waitFor();
    await page.getByText("Optional preview table", { exact: true }).click();
    assert.ok((await page.locator("table tbody").innerText()).includes("00002"));
    assert.equal((await page.locator("table tbody").innerText()).includes("00001"), false);
    assert.ok(await page.getByRole("button", { name: "Confirm Student import" }).isDisabled());
    return { priorPreviewRemoved: true, newTargetOnly: true, importDisabled: true };
  });
  for (const width of [320, 390]) for (const theme of ["light", "dark"]) await scenario(`r1-long-refusal-${width}-${theme}`, async () => {
    await page.setViewportSize({ width, height: 844 }); await select("onboarding-review");
    if (theme === "dark") await page.getByRole("button", { name: "Toggle light/dark" }).click();
    const trigger = page.getByRole("button", { name: "Approve current plan" });
    await trigger.click();
    await page.getByRole("textbox", { name: "Reason", exact: true }).fill("Invented review reason");
    await page.getByLabel("Re-authentication password").fill("SYNTHETIC-ONLY");
    refusal = "SYNTHETIC refusal: " + "విద్యార్థి हिन्दी العربية ".repeat(35); refuseApproval = true;
    const start = requests.length;
    await page.getByRole("button", { name: "Approve", exact: true }).click();
    const dialog = page.getByRole("dialog"), alert = dialog.getByRole("alert");
    await alert.waitFor();
    await associated(page.getByRole("textbox", { name: "Reason", exact: true }), refusal);
    await associated(page.getByLabel("Re-authentication password"), refusal);
    await validReferences();
    assert.deepEqual((await geometry()).offenders, []);
    assert.deepEqual(requests.slice(start).filter(r => r.method === "POST").map(r => r.path), ["/api/onboarding/batches/SYNTHETIC-A11Y/approve"]);
    await alert.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(out, `r1-long-refusal-${width}-${theme}.png`) });
    const dimensions = await geometry();
    const cancel = dialog.getByRole("button", { name: "Go back", exact: true }).last();
    await cancel.focus();
    assert.ok(await cancel.evaluate(e => e === document.activeElement && parseFloat(getComputedStyle(e).outlineWidth) > 0));
    await page.keyboard.press(theme === "light" ? "Escape" : "Enter");
    await dialog.waitFor({ state: "detached" });
    assert.ok(await trigger.evaluate(e => e === document.activeElement));
    await page.keyboard.press("Enter"); await dialog.waitFor();
    assert.equal(await dialog.getByRole("alert").count(), 0, "Previous refusal describes fresh dialog controls");
    assert.equal(await page.getByRole("textbox", { name: "Reason", exact: true }).inputValue(), "");
    assert.equal(await page.getByLabel("Re-authentication password").inputValue(), "");
    assert.equal(await page.getByLabel("Re-authentication password").getAttribute("aria-describedby"), null);
    await validReferences(); await page.keyboard.press("Escape");
    return { dimensions, refusalInside: true, onlyApprovalRefusal: true, staleErrorCleared: true };
  });
  await scenario("final-console-no-unexplained-errors", async () => {
    assert.equal(consoleEvents.filter(e => /403 \(Forbidden\)/.test(e.text)).length, expectedForbidden);
    assert.deepEqual(consoleEvents.filter(e => e.type === "pageerror" || !/409 \(Conflict\)|403 \(Forbidden\)|net::ERR_ABORTED/.test(e.text)), []);
    return { expectedSyntheticRefusals: consoleEvents.filter(e => /409/.test(e.text)).length, pageErrors: 0 };
  });
} finally {
  release?.();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await context.close(); await browser.close();
  writeFileSync(path.join(out, "results.json"), JSON.stringify({ label, at: new Date().toISOString(), sourceHashes, results, requests, consoleEvents, cleanup: "Owned browser/context closed; harness listener owned separately." }, null, 2));
}
console.log(JSON.stringify({ label, out, pass: results.filter(r => r.status === "PASS").length, fail: results.filter(r => r.status === "FAIL"), notExecuted: results.filter(r => r.status === "NOT_EXECUTED") }));
process.exitCode = results.some(r => r.status === "FAIL") ? 1 : 0;
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
