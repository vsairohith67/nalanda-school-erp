import path from "node:path";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// Exercise the actual root guard with both Node path implementations. This is
// synthetic path logic, not proof of Linux filesystem custody or artifact admission.
const source = readFileSync(path.resolve("lib/private-storage-root.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true }
}).outputText;

for (const [platform, api, workspace, external] of [
  ["Windows", path.win32, "C:\\synthetic\\workspace", "D:\\synthetic-private\\objects"],
  ["POSIX", path.posix, "/synthetic/workspace", "/synthetic-private/objects"]
] as const) {
  describe(`${platform} runtime storage guard retains deployment neighbours`, () => {
    const module = { exports: {} as { validatedPrivateStorageRoot: (value: string, label: string) => string } };
    runInNewContext(compiled, {
      module, exports: module.exports, process: { cwd: () => workspace },
      require: (name: string) => {
        if (name !== "node:path") throw Error("SYNTHETIC_PATH_ONLY_MODULE_REQUIRED");
        return api;
      }
    });
    const validate = (value: string) => module.exports.validatedPrivateStorageRoot(value, "Synthetic private storage");

    it("accepts the independently mounted runtime root", () => {
      expect(validate(external)).toBe(api.resolve(external));
    });

    for (const parts of [["public"], [".next", "static"], ["release-artifacts"], ["artifacts"]]) {
      const forbidden = api.join(workspace, ...parts);
      it(`refuses ${parts.join("/")} and its descendants`, () => {
        expect(() => validate(forbidden)).toThrow("must not overlap a public or release-artifact directory");
        expect(() => validate(api.join(forbidden, "invented.txt"))).toThrow("must not overlap a public or release-artifact directory");
      });
      it(`preserves the ${parts.join("/")}-neighbour instead of overmatching it`, () => {
        const neighbour = `${forbidden}-neighbour`;
        expect(validate(neighbour)).toBe(api.resolve(neighbour));
      });
    }

    it("refuses a normalised traversal into public storage", () => {
      expect(() => validate(api.join(workspace, "private", "..", "public", "invented.txt")))
        .toThrow("must not overlap a public or release-artifact directory");
    });
  });
}
