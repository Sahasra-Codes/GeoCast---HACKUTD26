import { expect, test } from "@playwright/test";

test("login preview supports password visibility and honest sign-in feedback", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Good to see you." })).toBeVisible();
  await page.getByLabel("Email address").fill("demo@example.com");
  await page.getByLabel("Password", { exact: true }).fill("example-password");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Hide password" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("not connected yet");
  await page.screenshot({ path: "test-results/login-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: "Good to see you." })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "test-results/login-mobile.png", fullPage: true });
  await page.getByRole("link", { name: "Explore the demo" }).last().click();
  await expect(page.getByRole("link", { name: "State Farm GeoCast home" })).toBeVisible();
});
