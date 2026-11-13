import { defineConfig, devices } from "@playwright/test";

/**
 * `pnpm test:e2e` (Section 12.3): one end-to-end test against the local Supabase stack.
 *
 * Runs against E2E_BASE_URL when set (for example a `pnpm build && pnpm start -p 3517` you
 * started yourself); otherwise builds and starts a production server on port 3517, so it never
 * touches a dev server on :3000. Needs `.env.local` pointing at the local stack (`pnpm db:start`),
 * with the fixture lesson from `supabase/seed.sql`. Set PLAYWRIGHT_CHANNEL (e.g. `msedge`,
 * `chrome`) to use an installed browser instead of `pnpm exec playwright install chromium`.
 */
const port = 3517;
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
    ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `pnpm build && pnpm start -p ${port}`,
        url: baseURL,
        reuseExistingServer: true,
        timeout: 600_000,
      },
});
