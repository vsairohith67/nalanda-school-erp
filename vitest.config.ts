import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Serialize hosted migration/PDF fixtures to avoid resource contention and
    // overlapping timed-out database operations. Keep every test and timeout.
    maxWorkers: process.env.CI === "true" ? 1 : 2,
    testTimeout: 15_000
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname)
    }
  }
});
