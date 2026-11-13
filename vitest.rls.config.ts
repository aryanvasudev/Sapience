import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * `pnpm test:rls` — tests that need the local Supabase stack (`pnpm db:start`): RLS (Section 7.4),
 * the job functions, and the lesson pipeline with a mock model.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/support/empty-module.ts", import.meta.url)),
    },
  },
  test: {
    include: ["tests/rls/**/*.test.ts", "tests/integration/**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
