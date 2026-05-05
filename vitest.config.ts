import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    globals: true,
    setupFiles: [],
    pool: "forks",
    fileParallelism: false, // SQLite single-file: don't run test files in parallel
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
