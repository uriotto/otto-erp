import { test, expect } from "@playwright/test";

test.describe("דשבורד", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
  });

  test("טוען את הדשבורד בהצלחה", async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator("main")).toBeVisible();
  });

  test("מציג את ה-sidebar עם ניווט", async ({ page }) => {
    await expect(page.getByText("OTTO").first()).toBeVisible();
    const nav = page.getByRole("navigation");
    await expect(nav).toBeVisible();
    // לפחות 3 לינקים ב-sidebar
    await expect(nav.getByRole("link")).toHaveCount(await nav.getByRole("link").count());
    expect(await nav.getByRole("link").count()).toBeGreaterThan(3);
  });

  test("ניווט ללקוחות עובד", async ({ page }) => {
    await page.getByRole("link", { name: "לקוחות", exact: true }).first().click();
    await expect(page).toHaveURL(/\/customers/);
  });

  test("ניווט לשעות עובד", async ({ page }) => {
    await page.getByRole("link", { name: "שעות", exact: true }).click();
    await expect(page).toHaveURL(/\/time/);
  });
});
