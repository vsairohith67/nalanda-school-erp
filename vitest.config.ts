import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // PDF rasterization and clean-install migration suites run concurrently
    // with lightweight contract tests in the canonical full regression.
    testTimeout: 15_000
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname)
    }
  }
});
