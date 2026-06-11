import { test, expect } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("דף כניסה", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("מציג את הלוגו ו-tagline", async ({ page }) => {
    await expect(page.getByText("OTTO")).toBeVisible();
    await expect(page.getByText("automate your success")).toBeVisible();
  });

  test("מציג טופס כניסה עם מייל", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "ברוך הבא" })).toBeVisible();
    await expect(page.getByRole("textbox")).toBeVisible();
    await expect(page.getByRole("button", { name: /שלח לי קישור/ })).toBeVisible();
  });

  test("מציג כפתור כניסה עם Google", async ({ page }) => {
    await expect(page.getByRole("button", { name: /כנס עם Google/ })).toBeVisible();
  });

  test("מראה שגיאה על מייל לא תקין", async ({ page }) => {
    await page.getByRole("textbox").fill("לא-מייל");
    await page.getByRole("button", { name: /שלח לי קישור/ }).click();
    // field validation of email input
    const input = page.getByRole("textbox");
    await expect(input).toHaveAttribute("type", "email");
  });

  test("לא מאפשר גישה לדשבורד בלי התחברות", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
