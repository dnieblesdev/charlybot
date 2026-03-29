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
    // Coverage configuration (optional, can be enabled when needed)
    // coverage: {
    //   provider: "v8",
    //   reporter: ["text", "json", "html"],
    //   include: ["src/**/*.ts"],
    //   exclude: ["src/index.ts"],
    // },
  },
  resolve: {
    alias: {
      "@charlybot/shared": path.resolve(__dirname, "../../packages/shared/src"),
    },
  },
});
