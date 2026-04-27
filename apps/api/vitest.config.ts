import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    env: {
      JWT_SECRET: "test-secret",
    },
  },
  resolve: {
    alias: {
      "@charlybot/shared": path.resolve(__dirname, "../../packages/shared/src"),
    },
  },
});
