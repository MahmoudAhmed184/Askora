import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { Pool } from "pg";

import {
  betaFixture,
  createBetaSessionCookie,
  seedBetaFixtures,
} from "../../scripts/seed-beta.mjs";

const databaseUrl = process.env.DATABASE_URL;
const playwrightAppUrl = "http://127.0.0.1:5173";
const authSecret = process.env.BETTER_AUTH_SECRET;
const noJavaScriptQuestionText = "No-JavaScript beta smoke question?";

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
    await getPool(pool).query("delete from rate_limits");
    await seedBetaFixtures({
      pool: getPool(pool),
      ...(authSecret === undefined ? {} : { secret: authSecret }),
    });
  });

  test("profile setup is a single step that continues to feed", async ({
    context,
    page,
  }) => {
    await signInAs(context, betaFixture.users.incomplete);

    await page.goto("/setup");

    await expect(
      page.getByRole("heading", {
        name: "Choose the profile people will use to ask you questions.",
      }),
    ).toBeVisible();
    await expect(page.getByText(/step \d+ of \d+/i)).not.toBeVisible();

    await page.getByLabel("Username").fill("beta_new_profile");
    await expect(
      page.getByText("@beta_new_profile is available."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Create profile" }).click();

    await expect(page).toHaveURL(/\/feed$/);
    await expect(
      page.getByRole("navigation", {
        name: "Primary app navigation",
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

      const submitResponse = page.waitForResponse((response) => {
        const request = response.request();

        return (
          request.method() === "POST" &&
          response
            .url()
            .includes(`/${betaFixture.profiles.owner.username}/questions`)
        );
      });

      await page
        .getByRole("textbox", { name: "Question", exact: true })
        .fill(noJavaScriptQuestionText);
      await page.getByRole("button", { name: "Send question" }).click();
      const response = await submitResponse;
      await page.waitForLoadState("domcontentloaded");

      expect(response.status()).toBeGreaterThanOrEqual(300);
      expect(response.status()).toBeLessThan(400);
      await expect(page).toHaveURL(
        new RegExp(`/${betaFixture.profiles.owner.username}#ask$`),
      );
    });
  });

  test("owner can open inbox and filtered folders", async ({
    context,
    page,
  }) => {
    await signInAs(context, betaFixture.users.owner);

    await page.goto("/inbox");
    await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
    await expect(
      page.getByText(betaFixture.questions.inbox.text),
    ).toBeVisible();
    const inboxCard = page
      .getByRole("article")
      .filter({ hasText: betaFixture.questions.inbox.text });

    await expect(
      inboxCard.getByRole("button", { name: "Drop" }),
    ).not.toBeVisible();
    await inboxCard.getByRole("button", { name: "Question actions" }).click();
    await expect(page.getByRole("menuitem", { name: "Drop" })).toBeVisible();
    await page.getByRole("menuitem", { name: "Drop" }).click();
    await expect(
      page.getByRole("alertdialog", { name: "Delete this question?" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();

    await page.goto("/filtered");
    await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Filtered/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(
      page.getByText(betaFixture.questions.filtered.text),
    ).toBeVisible();
  });

  test("owner can ask themselves with and without attribution", async ({
    context,
    page,
  }) => {
    await signInAs(context, betaFixture.users.owner);

    await page.goto(`/${betaFixture.profiles.owner.username}`);
    const identitySwitch = page.getByRole("switch", {
      name: "Your profile",
    });
    await expect(identitySwitch).not.toBeChecked();

    await page
      .getByRole("textbox", { name: "Question", exact: true })
      .fill("Which self-question should be attributed?");
    await page.waitForTimeout(1_600);
    await page.getByRole("button", { name: "Send question" }).click();
    await expectToast(page, "Question sent.");

    await page.goto("/inbox");
    const attributedQuestion = page
      .getByRole("article")
      .filter({ hasText: "Which self-question should be attributed?" });
    await expect(
      attributedQuestion.getByRole("link", {
        name: "Beta Owner",
        exact: true,
      }),
    ).toHaveAttribute("href", `/${betaFixture.profiles.owner.username}`);

    await page.goto(`/${betaFixture.profiles.owner.username}`);
    await page.getByRole("switch", { name: "Your profile" }).click();
    await expect(page.getByRole("switch", { name: "Anonymous" })).toBeChecked();
    await page
      .getByRole("textbox", { name: "Question", exact: true })
      .fill("Which self-question should stay anonymous?");
    await page.waitForTimeout(1_600);
    await page.getByRole("button", { name: "Send question" }).click();
    await expectToast(page, "Question sent.");

    await page.goto("/inbox");
    const anonymousQuestion = page
      .getByRole("article")
      .filter({ hasText: "Which self-question should stay anonymous?" });
    await expect(
      anonymousQuestion.getByText("Anonymous", { exact: true }),
    ).toBeVisible();
    await expect(
      anonymousQuestion.getByRole("link", {
        name: "Beta Owner",
        exact: true,
      }),
    ).not.toBeVisible();
  });

  test("thread popup keeps follow-up composition inline", async ({
    context,
    page,
  }) => {
    await signInAs(context, betaFixture.users.viewer);

    await page.goto(`/${betaFixture.profiles.owner.username}`);
    await page.getByRole("link", { name: "Thread" }).first().click();

    const dialog = page.getByRole("dialog", { name: "Public thread" });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Close thread" }),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Answer actions" }).click();
    await expect(
      page.getByRole("menuitem", { name: "Report answer" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    await dialog
      .getByRole("textbox", { name: "Follow-up" })
      .fill("Can the popup keep this follow-up in context?");
    await page.waitForTimeout(1_600);
    await dialog.getByRole("button", { name: "Send follow-up" }).click();

    await expectToast(page, "Follow-up sent.");
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("textbox", { name: "Follow-up" }),
    ).toHaveValue("");

    await dialog.getByRole("button", { name: "Close thread" }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page).toHaveURL(
      new RegExp(`/${betaFixture.profiles.owner.username}$`),
    );
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

    await expectToast(page, "Follow-up sent.");
  });

  test("viewer can like an answer and follow a profile", async ({
    context,
    page,
  }) => {
    await signInAs(context, betaFixture.users.viewer);

    await page.goto(`/${betaFixture.profiles.owner.username}`);
    await page.getByRole("button", { name: "Follow" }).click();
    await expectToast(page, "Profile followed.");
    await expect(page.getByRole("button", { name: "Following" })).toBeVisible();

    await page
      .getByRole("button", { name: /Like answer/ })
      .first()
      .click();
    await expectToast(page, "Reaction added.");
    await expect(
      page.getByRole("button", { name: /Unlike answer/ }).first(),
    ).toBeVisible();
  });

  test("owner answer actions open below the trigger and preserve asker identity in drafts", async ({
    context,
    page,
  }) => {
    await signInAs(context, betaFixture.users.owner);
    await page.goto(`/${betaFixture.profiles.owner.username}`);

    await page.getByRole("button", { name: "Answer actions" }).click();
    const actions = page.getByRole("menu", { name: "Answer actions" });

    await expect(actions).toHaveAttribute("data-side", "bottom");
    await page.getByRole("menuitem", { name: "Unpublish" }).click();
    await page.getByRole("button", { name: "Unpublish answer" }).click();
    await expect(
      page
        .getByRole("article")
        .filter({ hasText: betaFixture.questions.answered.text }),
    ).not.toBeVisible();

    await page.goto("/drafts");
    const draft = page
      .getByRole("article")
      .filter({ hasText: betaFixture.questions.answered.text });

    await expect(
      draft.getByRole("link", {
        name: betaFixture.profiles.viewer.displayName,
        exact: true,
      }),
    ).toHaveAttribute("href", `/${betaFixture.profiles.viewer.username}`);
    await draft.getByRole("link", { name: "Continue" }).click();

    const editor = page.getByRole("form", { name: "Answer editor" });

    await expect(editor.getByText("Question from")).toBeVisible();
    await expect(
      editor.getByRole("link", {
        name: betaFixture.profiles.viewer.displayName,
        exact: true,
      }),
    ).toHaveAttribute("href", `/${betaFixture.profiles.viewer.username}`);
    await expect(editor.getByText("Attributed")).toBeVisible();
    await expect(editor.getByText("Prepare response")).not.toBeVisible();
    await expect(editor.getByText("Thread context")).not.toBeVisible();
  });

  test("owner can mark notifications read with a toast", async ({
    context,
    page,
  }) => {
    await signInAs(context, betaFixture.users.owner);

    await page.goto("/notifications");
    await page.getByRole("button", { name: "Mark all read" }).click();

    await expectToast(page, "All notifications marked read.");
    await expect(page.getByText("0 unread")).toBeVisible();
  });

  test("owner can create a report from inbox", async ({ context, page }) => {
    await signInAs(context, betaFixture.users.owner);

    await page.goto("/inbox");
    await page
      .getByRole("button", { name: "Question actions" })
      .first()
      .click();
    await page.getByRole("menuitem", { name: "Report" }).first().click();
    await page.getByLabel("Reason").selectOption("other");
    await page.getByLabel("Details").fill("Beta smoke report.");
    await page.getByRole("button", { name: "Submit report" }).click();

    await expectToast(page, "Report submitted");
  });

  test("admin can dismiss a seeded report", async ({ context, page }) => {
    await signInAs(context, betaFixture.users.admin);

    await page.goto(`/admin/reports/${betaFixture.report.id}`);
    await expect(
      page.getByRole("heading", { name: "Report review" }),
    ).toBeVisible();
    await page.getByLabel("Action").selectOption("dismiss");
    await page.getByRole("button", { name: "Apply action" }).click();

    await expectToast(page, "Dismiss report applied.");
  });

  test("mobile public profile smoke", async ({ context, page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chrome", "Mobile-only smoke.");
    await context.clearCookies();

    await page.goto(`/${betaFixture.profiles.owner.username}`);

    await expect(
      page.getByRole("heading", { name: "Beta Owner" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Ask me anything/ }),
    ).toBeVisible();
  });

  test("mobile inbox smoke", async ({ context, page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chrome", "Mobile-only smoke.");
    await signInAs(context, betaFixture.users.owner);

    await page.goto("/inbox");

    await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
    await expect(
      page.getByText(betaFixture.questions.inbox.text),
    ).toBeVisible();
  });

  test("profile back control returns to the previous app page", async ({
    context,
    page,
  }) => {
    await signInAs(context, betaFixture.users.owner);

    await page.goto(`/${betaFixture.profiles.owner.username}`);
    await page
      .getByRole("link", { name: /Beta Viewer/ })
      .first()
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/${betaFixture.profiles.viewer.username}$`),
    );
    await page.getByRole("link", { name: "Back" }).click();
    await expect(page).toHaveURL(
      new RegExp(`/${betaFixture.profiles.owner.username}$`),
    );
  });

  test("navigation labels collapse on mobile while icons stay visible", async ({
    context,
    page,
  }, testInfo) => {
    await signInAs(context, betaFixture.users.owner);
    await page.goto("/feed");

    const navigation = page.getByRole("navigation", {
      name: "Primary app navigation",
    });
    await expect(navigation.getByRole("link", { name: "Feed" })).toBeVisible();
    await expect(
      navigation.locator('[data-slot="floating-pill-nav-icon"]').first(),
    ).toBeVisible();

    const feedLabel = navigation
      .getByRole("link", { name: "Feed" })
      .locator('[data-slot="floating-pill-nav-label"]');
    const labelBox = await feedLabel.boundingBox();

    if (testInfo.project.name === "mobile-chrome") {
      expect(labelBox?.width).toBeLessThanOrEqual(1);
      expect(labelBox?.height).toBeLessThanOrEqual(1);
    } else {
      await expect(feedLabel).toBeVisible();
      expect(labelBox?.width).toBeGreaterThan(1);
    }
  });

  test("desktop navigation stays wide and animates across profile route boundaries", async ({
    context,
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Desktop-only geometry.");
    await signInAs(context, betaFixture.users.owner);
    await page.goto("/feed");

    const navigation = page.getByRole("navigation", {
      name: "Primary app navigation",
    });
    const navigationBox = await navigation.boundingBox();

    expect(navigationBox?.width).toBeGreaterThan(700);
    await navigation.evaluate((element) => {
      element.dataset.instanceMarker = "persistent-navigation";
    });
    await navigation.getByRole("link", { name: "Profile" }).click();
    await expect(page).toHaveURL(
      new RegExp(`/${betaFixture.profiles.owner.username}$`),
    );
    await expect(navigation).toHaveAttribute(
      "data-instance-marker",
      "persistent-navigation",
    );
    await navigation.getByRole("link", { name: "Settings" }).click();
    await expect(page).toHaveURL(/\/settings\/profile$/);
    await expect(navigation).toHaveAttribute(
      "data-instance-marker",
      "persistent-navigation",
    );
    await navigation.getByRole("link", { name: "Profile" }).click();
    await expect(page).toHaveURL(
      new RegExp(`/${betaFixture.profiles.owner.username}$`),
    );
    await expect(navigation).toHaveAttribute("data-active-value", "profile");
  });

  test("desktop ask prompts fill the composer without clipping beside pinned threads", async ({
    context,
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Desktop-only geometry.");
    await signInAs(context, betaFixture.users.owner);
    await page.goto(`/${betaFixture.profiles.owner.username}`);

    const composer = page.getByRole("region", { name: "Public ask form" });
    const prompts = composer.getByRole("button", { name: /Use prompt:/ });

    await expect(prompts).toHaveCount(4);
    const composerBox = await composer.boundingBox();

    if (composerBox === null) {
      throw new Error("expected the ask composer to have visible geometry");
    }

    for (let index = 0; index < 4; index += 1) {
      const promptBox = await prompts.nth(index).boundingBox();

      if (promptBox === null) {
        throw new Error(`expected prompt ${String(index + 1)} to be visible`);
      }

      expect(promptBox.x).toBeGreaterThanOrEqual(composerBox.x);
      expect(promptBox.x + promptBox.width).toBeLessThanOrEqual(
        composerBox.x + composerBox.width,
      );
    }
  });

  test("privacy and safety settings use switches", async ({
    context,
    page,
  }) => {
    await signInAs(context, betaFixture.users.owner);

    await page.goto("/settings/privacy");
    await expect(
      page.getByRole("switch", { name: "Anonymous questions" }),
    ).toBeVisible();
    await expect(
      page.getByRole("switch", { name: "Follower and following counts" }),
    ).toBeVisible();
    await expect(
      page.getByRole("switch", { name: "Reaction counts" }),
    ).toBeVisible();
    await expect(page.locator('[data-slot="checkbox"]')).toHaveCount(0);

    await page.goto("/settings/safety");
    await expect(
      page.getByRole("switch", { name: "Accept new questions" }),
    ).toBeVisible();
    await expect(page.locator('[data-slot="checkbox"]')).toHaveCount(0);
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

async function expectToast(page: Page, text: string | RegExp) {
  await expect(
    page.locator("[data-sonner-toast]").filter({ hasText: text }).first(),
  ).toBeVisible();
}
