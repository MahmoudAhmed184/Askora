import "dotenv/config";

import { defineConfig, devices } from "@playwright/test";

const databaseBackedWorkerConfig =
  process.env.DATABASE_URL === undefined ? {} : { workers: 1 };
const appWebServer = {
  command: "npm run dev -- --host 127.0.0.1 --port 5173",
  url: "http://127.0.0.1:5173",
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
};
const webServer =
  process.env.DATABASE_URL === undefined
    ? appWebServer
    : [
        {
          command: "node tests/e2e/gemini-mock-server.ts",
          url: "http://127.0.0.1:5174/health",
          reuseExistingServer: !process.env.CI,
          timeout: 30_000,
        },
        {
          ...appWebServer,
          env: {
            ...process.env,
            GOOGLE_GEMINI_BASE_URL: "http://127.0.0.1:5174",
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
    baseURL: "http://127.0.0.1:5173",
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
