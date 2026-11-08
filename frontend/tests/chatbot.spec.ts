import { expect, test } from "@playwright/test";

test("GEO Guide chats inside GeoCast and opens data information", async ({
  page,
}) => {
  await page.route("**/api/chat", (route) =>
    route.fulfill({
      json: { reply: "Use the location search to find a county." },
    }),
  );
  await page.goto("/?mode=demo");
  await page.getByRole("button", { name: "Open GEO Guide chatbot" }).click();
  const mascot = page.getByRole("img", {
    name: "Geo, a smiling globe wearing a red cap",
  });
  await expect(mascot).toBeVisible();
  await expect
    .poll(() => mascot.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
  await expect(
    page.getByRole("heading", { name: "Chat with Geo" }),
  ).toBeVisible();
  await page
    .getByRole("dialog", { name: "GEO Guide chatbot" })
    .screenshot({ path: "test-results/geo-chat-preview.png" });
  await page
    .getByRole("textbox", { name: "Message GEO Guide" })
    .fill("How do I search?");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(
    page.getByText("Use the location search to find a county."),
  ).toBeVisible();
  await page
    .getByRole("dialog", { name: "GEO Guide chatbot" })
    .getByRole("button", { name: "About the data", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Close data information" }),
  ).toBeVisible();
});

test("mobile chat stays inside the screen and preserves failed messages", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/chat", (route) =>
    route.fulfill({
      status: 503,
      json: { detail: "AI is unavailable. Please retry." },
    }),
  );
  await page.goto("/?mode=demo");
  await page.getByRole("button", { name: "Open GEO Guide chatbot" }).click();
  const panel = page.getByRole("dialog", { name: "GEO Guide chatbot" });
  const box = await panel.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  await page
    .getByRole("textbox", { name: "Message GEO Guide" })
    .fill("Help me navigate");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "AI is unavailable. Please retry.",
  );
  await expect(
    page.getByRole("textbox", { name: "Message GEO Guide" }),
  ).toHaveValue("Help me navigate");
  await page.keyboard.press("Escape");
  await expect(panel).not.toBeVisible();
});

test("chat navigation shortcuts open GeoCast filters and resources", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?mode=demo");
  await page.getByRole("button", { name: "Open GEO Guide chatbot" }).click();
  await page
    .getByRole("button", { name: "Check my area's risk", exact: true })
    .click();
  await expect(page.locator(".sidebar-container")).toBeVisible();
  await expect(
    page.getByRole("combobox", {
      name: "Search city, county, state, or ZIP code",
    }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Open GEO Guide chatbot" }).click();
  await page
    .getByRole("button", { name: "Find nearby resources", exact: true })
    .click();
  await expect(
    page
      .locator(".primary-tabs")
      .getByRole("button", { name: "Resources", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".sidebar-container")).not.toBeVisible();
});
