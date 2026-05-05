import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/__tests__/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    testTimeout: 5000,
    hookTimeout: 5000,
    pool: "forks",
    singleFork: true,
  },
  resolve: {
    alias: {
      "@/*": path.resolve(__dirname, "./src"),
      "@charlybot/shared": path.resolve(__dirname, "../../packages/shared/src"),
    },
  },
});
