import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // File/ACL subprocess integration must not contend with timing-sensitive
    // retained queue regressions. Assertions and five-second limits stay intact.
    fileParallelism: false,
    environment: "node"
  }
});
