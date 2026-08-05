import { defineConfig, devices } from "@playwright/test";

// Use the same hostname Next advertises in development. Next 16 rejects dev
// chunks requested through an unlisted alternate origin (for example 127.0.0.1
// while the server is running as localhost), which prevents React hydration.
const requestedBaseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const baseURL = requestedBaseURL.endsWith("/") ? requestedBaseURL : `${requestedBaseURL}/`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop-chrome",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"], channel: "chrome" },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "node node_modules/next/dist/bin/next dev",
        url: `${baseURL}diagnostico/`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          NEXT_PUBLIC_SITE_URL: baseURL,
          NEXT_PUBLIC_PRIVACY_POLICY_URL: "https://example.test/privacy",
          NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
          NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
        },
      },
});
