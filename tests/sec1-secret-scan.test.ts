import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SECRET_PATTERNS = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bAIza[0-9A-Za-z_-]{20,}\b/,
  /\bgh[pousr]_[0-9A-Za-z]{20,}\b/,
  /\bsk-(?:proj-)?[0-9A-Za-z_-]{20,}\b/,
  /\bxox[baprs]-[0-9A-Za-z-]{20,}\b/
];

describe("SEC-1 production secret scan", () => {
  it("contains no recognizable private key or provider-token material", () => {
    const files = execFileSync("rg", ["--files", "app", "components", "lib"], { encoding: "utf8" })
      .trim()
      .split(/\r?\n/)
      .filter((file) => /\.(?:ts|tsx|js|mjs|json)$/.test(file));
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const pattern of SECRET_PATTERNS) {
        expect(source, `${file}: ${pattern}`).not.toMatch(pattern);
      }
    }
  });
});
