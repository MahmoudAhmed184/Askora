import { expect, test } from "@playwright/test";

test("public foundation routes render", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: /one public link for questions worth answering/i,
    }),
  ).toBeVisible();

  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: /sign in to continue/i }),
  ).toBeVisible();

  await page.goto("/terms");
  await expect(page.getByRole("heading", { name: "Terms" })).toBeVisible();

  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Privacy" })).toBeVisible();
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("legal pages still render", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { name: "Privacy" })).toBeVisible();
  });
});
