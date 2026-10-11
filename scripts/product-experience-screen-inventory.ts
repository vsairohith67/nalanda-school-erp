import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deriveScreenRegister, ordinalCompare, serializeScreenRegister, type ScreenSource } from "./product-experience-screen-register";

const relativeOutput = "config/product-experience-screen-register.json";

export function loadScreenSources(root: string): ScreenSource[] {
  const appRoot = path.join(root, "app");
  const walk = (directory: string): string[] => readdirSync(directory).sort(ordinalCompare).flatMap(entry => {
    const full = path.join(directory, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
  const isFile = (file: string) => { try { return statSync(file).isFile(); } catch { return false; } };
  return walk(appRoot).filter(file => /(?:^|[\\/])page\.tsx?$/.test(file)).map(file => ({
    file: path.relative(root, file).split(path.sep).join("/"),
    source: readFileSync(file, "utf8"),
    loading: ["loading.tsx", "loading.ts"].some(entry => isFile(path.join(path.dirname(file), entry))),
    error: ["error.tsx", "error.ts"].some(entry => isFile(path.join(path.dirname(file), entry)))
  }));
}

export function inventory(root: string, mode: "--check" | "--write") {
  const register = deriveScreenRegister(loadScreenSources(root));
  const expected = serializeScreenRegister(register);
  const output = path.join(root, relativeOutput);
  if (mode === "--write") writeFileSync(output, expected, "utf8");
  else {
    let current: string;
    try { current = readFileSync(output, "utf8"); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new Error("SCREEN_REGISTER_MISSING: run inventory:product-experience after source review");
      throw error;
    }
    try { JSON.parse(current); } catch { throw new Error("SCREEN_REGISTER_MALFORMED: review the tracked register"); }
    // Git may materialize CRLF on Windows; this is the sole representation normalization.
    if (current.replaceAll("\r\n", "\n") !== expected) throw new Error("SCREEN_REGISTER_STALE: review source changes, then run inventory:product-experience");
  }
  return { verdict: "PASS", mode, output: relativeOutput, ...register.completeness };
}

export function parseInventoryMode(args: readonly string[]): "--check" | "--write" {
  if (args.length === 0) return "--check";
  if (args.length === 1 && (args[0] === "--check" || args[0] === "--write")) return args[0];
  throw new Error("SCREEN_INVENTORY_ARGUMENTS_INVALID: expected --check or --write");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(inventory(process.cwd(), parseInventoryMode(process.argv.slice(2))))); }
  catch (error) { console.error(error instanceof Error ? error.message : "SCREEN_INVENTORY_FAILED"); process.exitCode = 1; }
}
