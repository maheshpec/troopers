import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
      // Trust boundary code (routes, reminders, flags, config) must stay well covered.
      thresholds: { lines: 70, functions: 70, branches: 65, statements: 70 },
    },
  },
});
