import { expect, test } from "@playwright/test";

test("public foundation routes render", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: /one link for people to ask you anything/i,
    }),
  ).toBeVisible();

  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: /sign in to q&a platform/i }),
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
