import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/__tests__/**/*.test.ts"],
    testTimeout: 5000,
    hookTimeout: 5000,
    pool: "forks",
    singleFork: true,
  },
  resolve: {
    alias: {
      "@charlybot/shared": path.resolve(__dirname, "./src"),
    },
  },
});