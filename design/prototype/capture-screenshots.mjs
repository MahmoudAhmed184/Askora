import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:5177/";
const outputDir = fileURLToPath(new URL("./screenshots/", import.meta.url));

const viewports = [
  { height: 844, name: "mobile", width: 390 },
  { height: 1050, name: "desktop", width: 1440 },
];

const states = [
  {
    name: "feed",
    setup: async () => {},
  },
  {
    name: "notifications",
    setup: async (page) => {
      await clickNav(page, "Notifications");
    },
  },
  {
    name: "profile-me",
    setup: async (page) => {
      await clickNav(page, "Profile");
    },
  },
  {
    name: "profile-public-preview",
    setup: async (page) => {
      await clickNav(page, "Profile");
      await clickVisibleButtonWithText(page, "Public preview");
    },
  },
  {
    name: "profile-ask-attributed",
    setup: async (page) => {
      await clickNav(page, "Profile");
      await page.getByText("Send anonymously").click();
    },
  },
  {
    name: "profile-ask-logged-in",
    setup: async (page) => {
      await clickNav(page, "Profile");
      await clickVisibleButtonWithText(page, "Logged-in only");
    },
  },
  {
    name: "profile-follow-up-unavailable",
    setup: async (page) => {
      await clickNav(page, "Profile");
      await page.getByRole("button", { name: "Close follow-ups" }).click();
    },
  },
  {
    name: "inbox-questions",
    setup: async (page) => {
      await clickNav(page, "Inbox");
    },
  },
  {
    name: "inbox-answer-editor",
    setup: async (page) => {
      await clickNav(page, "Inbox");
      await page.getByRole("button", { name: "Answer question" }).first().click();
    },
  },
  {
    name: "settings-profile",
    setup: async (page) => {
      await clickNav(page, "Settings");
    },
  },
  {
    name: "settings-deletion-pending",
    setup: async (page) => {
      await clickNav(page, "Settings");
      await clickVisibleButtonWithText(page, "Account");
      await page.getByLabel("Type DELETE to confirm").fill("DELETE");
      await page.getByRole("button", { name: "Request account deletion" }).click();
    },
  },
  {
    name: "admin-detail",
    setup: async (page) => {
      await clickNav(page, "Admin");
    },
  },
  {
    name: "admin-required-notes",
    setup: async (page) => {
      await clickNav(page, "Admin");
      await page.getByRole("button", { name: "Prepare removal" }).click();
      await page.getByRole("button", { name: "Record action" }).click();
    },
  },
];

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch();
const results = [];

for (const viewport of viewports) {
  for (const state of states) {
    const context = await browser.newContext({
      deviceScaleFactor: 1,
      viewport: { height: viewport.height, width: viewport.width },
    });
    const page = await context.newPage();
    const consoleIssues = [];

    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") {
        consoleIssues.push(`${message.type()}: ${message.text()}`);
      }
    });

    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.locator("#root").waitFor();
    await state.setup(page);
    await page.screenshot({
      fullPage: state.name !== "inbox-answer-editor",
      path: join(outputDir, `${viewport.name}-${state.name}.png`),
    });

    const overflow = await page.evaluate(() => ({
      body: document.body.scrollWidth - document.body.clientWidth,
      html:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
      viewport: window.innerWidth,
    }));

    results.push({
      consoleIssues,
      overflow,
      screenshot: `${viewport.name}-${state.name}.png`,
    });

    await context.close();
  }
}

await browser.close();

console.log(JSON.stringify(results, null, 2));

async function clickNav(page, name) {
  await page.getByRole("button", { name }).click();
}

async function clickVisibleButtonWithText(page, text) {
  await page.locator("button").filter({ hasText: text }).evaluateAll(
    (buttons, buttonText) => {
      const target = buttons.find((button) => {
        const rect = button.getBoundingClientRect();
        const style = window.getComputedStyle(button);

        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== "none" &&
          style.visibility !== "hidden"
        );
      });

      if (!target) {
        throw new Error(`No visible button found for ${buttonText}`);
      }

      target.click();
    },
    text,
  );
}
