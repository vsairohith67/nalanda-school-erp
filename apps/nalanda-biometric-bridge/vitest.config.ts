import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./contract-fixture", import.meta.url)) } },
  test: {
    include: ["src/**/*.test.ts"],
    // File/ACL subprocess integration must not contend with timing-sensitive
    // retained queue regressions. Assertions and five-second limits stay intact.
    fileParallelism: false,
    environment: "node"
  }
});
