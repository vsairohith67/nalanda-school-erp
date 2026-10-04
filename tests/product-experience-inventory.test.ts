import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, statSync, existsSync, realpathSync, rmSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { deriveScreenRegister, serializeScreenRegister, type ScreenSource } from "../scripts/product-experience-screen-register";
import { inventory, loadScreenSources, parseInventoryMode } from "../scripts/product-experience-screen-inventory";
import { codeIdentity, LAB_BASE, CONNECTION_FILES } from "../scripts/laptop-lab/consumer-identity";

const root = process.cwd(), prefix = path.join(root, "tmp");
const output = "config/product-experience-screen-register.json";
const script = path.join(root, "scripts/product-experience-screen-inventory.ts");
function owned(run: (dir: string) => void) {
  mkdirSync(prefix, { recursive: true }); const dir = mkdtempSync(path.join(prefix, "screen-inventory-"));
  try { run(dir); } finally { const resolved = realpathSync(dir); expect(path.dirname(resolved)).toBe(realpathSync(prefix)); expect(path.basename(resolved)).toMatch(/^screen-inventory-/); rmSync(resolved, { recursive: true }); }
}
function fixture(dir: string) {
  for (const file of ["app/page.tsx", "app/(owned)/Z/page.tsx", "app/(owned)/a/page.ts", "app/certificates/print/page.tsx"]) {
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    writeFileSync(path.join(dir, file), '<PageHeader title="Synthetic screen" description="Invented" />\nrequirePermission("VIEW_CERTIFICATES");\n');
  }
  writeFileSync(path.join(dir, "app/(owned)/Z/loading.tsx"), "// synthetic loading\n");
  mkdirSync(path.join(dir, "config"));
  writeFileSync(path.join(dir, output), serializeScreenRegister(deriveScreenRegister(loadScreenSources(dir))));
}
function cli(dir: string, args: string[], locale = "C") {
  return spawnSync(process.execPath, ["--import", pathToFileURL(path.join(root, "node_modules/tsx/dist/loader.mjs")).href, script, ...args], { cwd: dir, encoding: "utf8", timeout: 10000, env: { ...process.env, LANG: locale, LC_ALL: locale, TSX_DISABLE_CACHE: "1" } });
}
describe("immutable product inventory contract", () => {
  it("derives without input mutation or locale-dependent ordering", () => {
    const pages: ScreenSource[] = ["app/a/page.tsx", "app/(group)/Z/page.tsx", "app/page.tsx"].map(file => ({ file, source: '<h1>Synthetic</h1>', loading: false, error: false }));
    const before = JSON.stringify(pages), a = serializeScreenRegister(deriveScreenRegister(pages));
    expect(a).toBe(serializeScreenRegister(deriveScreenRegister([...pages].reverse()))); expect(JSON.stringify(pages)).toBe(before);
    expect(deriveScreenRegister(pages).screens.map(screen => screen.route)).toEqual(["/", "/Z", "/a"]);
  });
  it.each([[], ["--check"]].map(args => ({ args })))("matching check $args leaves actual bytes and mtime unchanged", ({ args }) => owned(dir => {
    fixture(dir); const file = path.join(dir, output), bytes = readFileSync(file), mtime = statSync(file).mtimeMs;
    const result = cli(dir, args); expect(result.error).toBeUndefined(); expect(result.status, result.stderr).toBe(0); expect(result.stdout).toContain('"mode":"--check"'); expect(readFileSync(file)).toEqual(bytes); expect(statSync(file).mtimeMs).toBe(mtime);
  }));
  it.each(["title", "route", "roles", "permission", "count", "state"])("refuses semantic %s drift without repairing it", field => owned(dir => {
    fixture(dir); const file = path.join(dir, output), value = JSON.parse(readFileSync(file, "utf8"));
    if (field === "title") value.screens[0].primaryTask = "Stale invented title";
    if (field === "route") value.screens[0].route = "/stale";
    if (field === "roles") value.screens[0].roles = ["STALE"];
    if (field === "permission") value.screens[0].permissionRequirements = [];
    if (field === "count") value.completeness.pageFiles++;
    if (field === "state") value.screens[0].states.loading = "STALE";
    writeFileSync(file, JSON.stringify(value, null, 2) + "\n"); const bytes = readFileSync(file), mtime = statSync(file).mtimeMs;
    const result = cli(dir, ["--check"]); expect(result.status).not.toBe(0); expect(result.stderr).toContain("SCREEN_REGISTER_STALE"); expect(readFileSync(file)).toEqual(bytes); expect(statSync(file).mtimeMs).toBe(mtime);
  }));
  it("refuses malformed JSON without repairing bytes", () => owned(dir => {
    fixture(dir); const file = path.join(dir, output); writeFileSync(file, "{"); const result = cli(dir, ["--check"]); expect(result.status).not.toBe(0); expect(result.stderr).toContain("SCREEN_REGISTER_MALFORMED"); expect(readFileSync(file, "utf8")).toBe("{");
  }));
  it("refuses a missing register without creating it", () => owned(dir => {
    mkdirSync(path.join(dir, "app")); mkdirSync(path.join(dir, "config")); const result = cli(dir, ["--check"]); expect(result.status).not.toBe(0); expect(result.stderr).toContain("SCREEN_REGISTER_MISSING"); expect(existsSync(path.join(dir, output))).toBe(false);
  }));
  it("writes explicitly, deterministically across locales, then checks without writes", () => owned(dir => {
    fixture(dir); const file = path.join(dir, output); writeFileSync(file, "stale");
    expect(cli(dir, ["--write"], "en_US.UTF-8").status).toBe(0); const first = readFileSync(file); expect(cli(dir, ["--write"], "tr_TR.UTF-8").status).toBe(0); expect(readFileSync(file)).toEqual(first);
    const mtime = statSync(file).mtimeMs; expect(cli(dir, ["--check"]).status).toBe(0); expect(readFileSync(file)).toEqual(first); expect(statSync(file).mtimeMs).toBe(mtime);
  }));
  it.each([["--unknown"], ["--write", "--unknown"], ["--write", "--check"]].map(args => ({ args })))("refuses arguments $args before writes", ({ args }) => owned(dir => {
    fixture(dir); const file = path.join(dir, output), before = readFileSync(file); const result = cli(dir, args); expect(result.status).not.toBe(0); expect(result.stderr).toContain("SCREEN_INVENTORY_ARGUMENTS_INVALID"); expect(readFileSync(file)).toEqual(before);
  }));
  it("supports CRLF only as a deliberate representation difference, without rewriting it", () => owned(dir => {
    fixture(dir); const file = path.join(dir, output); writeFileSync(file, readFileSync(file, "utf8").replaceAll("\n", "\r\n")); const before = readFileSync(file); expect(cli(dir, ["--check"]).status).toBe(0); expect(readFileSync(file)).toEqual(before);
    writeFileSync(file, " " + readFileSync(file, "utf8")); expect(cli(dir, ["--check"]).stderr).toContain("SCREEN_REGISTER_STALE");
  }));
  it("uses the real unchanged source guard to refuse a fresh unregistered tracked change before effects", () => owned(dir => {
    const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, stdio: "pipe", timeout: 10000 });
    git("init", "--initial-branch=main"); git("fetch", "--no-tags", "--depth=1", root, LAB_BASE); git("update-ref", "HEAD", LAB_BASE);
    for (const file of CONNECTION_FILES) { mkdirSync(path.dirname(path.join(dir, file)), { recursive: true }); writeFileSync(path.join(dir, file), readFileSync(path.join(root, file))); }
    mkdirSync(path.join(dir, "config")); const unregistered = "config/synthetic-qa-source.json"; writeFileSync(path.join(dir, unregistered), "{}\n");
    git("add", "."); git("-c", "user.name=Synthetic QA", "-c", "user.email=qa@example.com", "commit", "-m", "owned source identity fixture");
    expect(codeIdentity(dir).classification).toBe("LOCAL_SOURCE_CANDIDATE"); writeFileSync(path.join(dir, unregistered), '{"invented":true}\n');
    const effects = vi.fn(); expect(() => { codeIdentity(dir); effects(); }).toThrow("LOCAL_UNBOUND_SOURCE_DELTA"); expect(effects).not.toHaveBeenCalled();
  }));
  it("checks the real register contract through the importable side-effect-free entry", () => {
    expect(parseInventoryMode([])).toBe("--check"); expect(inventory(root, "--check").omittedScreens).toBe(0);
  });
});
