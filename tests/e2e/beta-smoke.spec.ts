import { expect, test, type BrowserContext } from "@playwright/test";
import { Pool } from "@neondatabase/serverless";

import { betaFixture, createBetaSessionCookie, seedBetaFixtures } from "../../scripts/seed-beta.mjs";

const databaseUrl = process.env.DATABASE_URL;
const playwrightAppUrl = "http://127.0.0.1:5173";
const authSecret = process.env.BETTER_AUTH_SECRET;

test.describe("beta seeded smoke", () => {
  test.skip(
    databaseUrl === undefined,
    "DATABASE_URL is unavailable; skipping DB-backed beta smoke tests.",
  );
  test.describe.configure({ mode: "serial" });

  let pool: Pool | undefined;

  test.beforeAll(() => {
    pool = new Pool({ connectionString: getDatabaseUrl() });
  });

  test.afterAll(async () => {
    await pool?.end();
  });

  test.beforeEach(async () => {
    await seedBetaFixtures({
      pool: getPool(pool),
      ...(authSecret === undefined ? {} : { secret: authSecret }),
    });
  });

  test("setup renders for a seeded incomplete session", async ({ context, page }) => {
    await signInAs(context, betaFixture.users.incomplete);

    await page.goto("/setup");

    await expect(
      page.getByRole("heading", {
        name: "Choose the profile people will use to ask you questions.",
      }),
    ).toBeVisible();
  });

  test.describe("without JavaScript", () => {
    test.use({ javaScriptEnabled: false });

    test("public ask submits through the server route", async ({
      context,
      page,
    }) => {
      await context.clearCookies();
      await page.goto(`/${betaFixture.profiles.owner.username}`);
      await page.waitForTimeout(1_600);

      await page
        .getByLabel("Question")
        .fill("No-JavaScript beta smoke question?");
      await page.getByRole("button", { name: "Send question" }).click();

      await expect(page.getByRole("status")).toContainText("Question sent.");
    });
  });

  test("owner can open inbox and filtered folders", async ({ context, page }) => {
    await signInAs(context, betaFixture.users.owner);

    await page.goto("/dashboard/inbox");
    await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
    await expect(page.getByText(betaFixture.questions.inbox.text)).toBeVisible();

    await page.goto("/dashboard/filtered");
    await expect(page.getByRole("heading", { name: "Filtered" })).toBeVisible();
    await expect(page.getByText(betaFixture.questions.filtered.text)).toBeVisible();
  });

  test("owner can create, answer, publish, and view a starter prompt", async ({
    context,
    page,
  }) => {
    await signInAs(context, betaFixture.users.owner);

    await page.goto("/dashboard/prompts");
    await expect(page.getByTestId("starter-prompt-picker")).toBeVisible();
    await page
      .getByRole("button", {
        name: "Use starter prompt: What has been taking up most of your attention lately?",
      })
      .click();
    await expect(page).toHaveURL(/\/dashboard\/answer\/qst_/);

    await page
      .getByRole("textbox", { name: "Answer" })
      .fill("A focused beta starter-prompt answer.");
    await page.getByRole("button", { name: "Publish" }).click();

    await expect(page).toHaveURL(
      new RegExp(`/${betaFixture.profiles.owner.username}#published-answers$`),
    );
    await expect(
      page.locator("p").filter({
        hasText: "A focused beta starter-prompt answer.",
      }),
    ).toBeVisible();
  });

  test("viewer can ask a follow-up on a public thread", async ({
    context,
    page,
  }) => {
    await signInAs(context, betaFixture.users.viewer);

    await page.goto(
      `/${betaFixture.profiles.owner.username}/a/${betaFixture.threads.published.publicId}`,
    );
    await page.getByRole("link", { name: "Ask a follow-up" }).click();
    await page.waitForTimeout(1_600);
    await page
      .getByRole("textbox", { name: "Follow-up" })
      .fill("Can you expand on that seeded answer?");
    await page.getByRole("button", { name: "Send follow-up" }).click();

    await expect(page.getByRole("status")).toContainText("Follow-up sent.");
  });

  test("viewer can like an answer and follow a profile", async ({
    context,
    page,
  }) => {
    await signInAs(context, betaFixture.users.viewer);

    await page.goto(`/${betaFixture.profiles.owner.username}`);
    await page.getByRole("button", { name: "Follow" }).click();
    await expect(page.getByRole("button", { name: "Following" })).toBeVisible();

    await page
      .getByRole("button", { name: /Like answer/ })
      .first()
      .click();
    await expect(
      page.getByRole("button", { name: /Unlike answer/ }).first(),
    ).toBeVisible();
  });

  test("owner can create a report from inbox", async ({ context, page }) => {
    await signInAs(context, betaFixture.users.owner);

    await page.goto("/dashboard/inbox");
    await page.getByRole("button", { name: "Report" }).first().click();
    await page.getByLabel("Reason").selectOption("other");
    await page.getByLabel("Details").fill("Beta smoke report.");
    await page.getByRole("button", { name: "Submit report" }).click();

    await expect(page.getByRole("status")).toContainText("Report submitted");
  });

  test("admin can dismiss a seeded report", async ({ context, page }) => {
    await signInAs(context, betaFixture.users.admin);

    await page.goto(`/admin/reports/${betaFixture.report.id}`);
    await expect(page.getByRole("heading", { name: "Report review" })).toBeVisible();
    await page.getByLabel("Action").selectOption("dismiss");
    await page.getByRole("button", { name: "Apply action" }).click();

    await expect(page.getByRole("status")).toContainText(
      "Dismiss report applied.",
    );
  });

  test("mobile public profile smoke", async ({ context, page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chrome", "Mobile-only smoke.");
    await context.clearCookies();

    await page.goto(`/${betaFixture.profiles.owner.username}`);

    await expect(page.getByRole("heading", { name: "Beta Owner" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Ask me anything/ })).toBeVisible();
  });

  test("mobile inbox smoke", async ({ context, page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chrome", "Mobile-only smoke.");
    await signInAs(context, betaFixture.users.owner);

    await page.goto("/dashboard/inbox");

    await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
    await expect(page.getByText(betaFixture.questions.inbox.text)).toBeVisible();
  });
});

async function signInAs(
  context: BrowserContext,
  user: Parameters<typeof createBetaSessionCookie>[0]["user"],
) {
  await context.addCookies([
    createBetaSessionCookie({
      appUrl: playwrightAppUrl,
      ...(authSecret === undefined ? {} : { secret: authSecret }),
      user,
    }),
  ]);
}

function getDatabaseUrl() {
  if (databaseUrl === undefined) {
    throw new Error("DATABASE_URL is required for beta smoke tests.");
  }

  return databaseUrl;
}

function getPool(pool: Pool | undefined) {
  if (pool === undefined) {
    throw new Error("Beta smoke test pool was not initialized.");
  }

  return pool;
}
