import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    globals: true,
    setupFiles: [],
    pool: "forks",
    poolOptions: {
      forks: { singleFork: true }, // SQLite single-file, avoid concurrent writes
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
