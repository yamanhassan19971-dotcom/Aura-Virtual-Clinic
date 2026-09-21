import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const DATABASE_URL = "postgresql://aura:aura_dev_pw@localhost:5432/aura_test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30000,
  expect: { timeout: 8000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      executablePath: "/opt/pw-browsers/chromium",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1920, height: 1080 } },
    },
  ],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 60000,
    env: {
      DATABASE_URL,
      AUTH_SECRET: "e2e-test-secret-0123456789abcdef0123456789",
      NEXTAUTH_URL: `http://localhost:${PORT}`,
    },
  },
});
