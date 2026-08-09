import "dotenv/config";

import { defineConfig, devices } from "@playwright/test";

const databaseBackedWorkerConfig =
  process.env.DATABASE_URL === undefined ? {} : { workers: 1 };
const databaseBacked = process.env.DATABASE_URL !== undefined;
const appPort = databaseBacked ? 5183 : 5173;
const mockPort = 5184;
const appUrl = `http://127.0.0.1:${String(appPort)}`;
const mockUrl = `http://127.0.0.1:${String(mockPort)}`;
const databaseAppWebServer = {
  command:
    "npm run build && node node_modules/@react-router/serve/dist/cli.js build/server/*/index.js",
  url: appUrl,
  // Database-backed generation must always start the process with the mock
  // provider and encryption environment below; never attach to stale local
  // code on the shared development port.
  reuseExistingServer: databaseBacked ? false : !process.env.CI,
  timeout: 120_000,
};
const localAppWebServer = {
  command: `npm run dev -- --host 127.0.0.1 --port ${String(appPort)}`,
  url: appUrl,
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
};
const webServer =
  !databaseBacked
    ? localAppWebServer
    : [
        {
          command: "node tests/e2e/gemini-mock-server.ts",
          url: `${mockUrl}/health`,
          reuseExistingServer: false,
          env: { ...process.env, GEMINI_MOCK_PORT: String(mockPort) },
          timeout: 30_000,
        },
        {
          ...databaseAppWebServer,
          env: {
            ...process.env,
            APP_URL: appUrl,
            BETTER_AUTH_URL: appUrl,
            HOST: "127.0.0.1",
            PORT: String(appPort),
            TRUSTED_ORIGINS: appUrl,
            GOOGLE_GEMINI_BASE_URL: mockUrl,
            QUESTION_GENERATION_ENCRYPTION_KEYS: JSON.stringify({
              1: Buffer.alloc(32, 7).toString("base64"),
            }),
            QUESTION_GENERATION_ACTIVE_ENCRYPTION_KEY_VERSION: "1",
          },
        },
      ];

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"]],
  use: {
    baseURL: appUrl,
    trace: "on-first-retry",
  },
  webServer,
  ...databaseBackedWorkerConfig,
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
    },
  ],
});
