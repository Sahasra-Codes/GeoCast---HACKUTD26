import { test, expect } from "@playwright/test";

test("explore disaster scenarios, county predictions, needs and resources", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "A clearer picture. A stronger response.",
    }),
  ).toBeVisible();
  await expect(page.locator(".disaster-marker")).toHaveCount(5, {
    timeout: 45000,
  });
  await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible();
  await expect(page.locator(".map-canvas")).toHaveAttribute(
    "data-boundaries-ready",
    "true",
  );
  await page.screenshot({
    path: "test-results/desktop-overview.png",
    fullPage: true,
  });
  await page
    .getByRole("button", {
      name: "Explore Sierra wildfire scenario",
      exact: true,
    })
    .click();
  await expect(page.locator(".disaster-popup")).toContainText(
    "Sierra wildfire scenario",
  );
  await page.getByRole("button", { name: "Close event card" }).click();
  await page
    .getByRole("button", { name: "Reset map to United States" })
    .click();
  await page
    .getByRole("button", {
      name: "Explore Gulf hurricane scenario",
      exact: true,
    })
    .click();
  await expect(page.locator(".disaster-popup")).toContainText(
    "Gulf hurricane scenario",
  );
  await expect(page.locator(".disaster-popup")).toContainText(
    "Simulated declaration",
  );
  await page
    .locator(".disaster-popup")
    .getByRole("button", { name: "Explore affected communities" })
    .click();
  await expect(page.locator(".insights-section h2")).toHaveText(
    "Orleans Parish",
  );
  await expect(page.locator(".score-value")).toContainText("94");
  await expect(page.locator(".insights-section h2")).toBeVisible();
  await expect(page.locator(".layer-controls button.selected")).toContainText(
    "AI risk predictions",
  );
  await expect(page.locator(".disaster-marker")).toHaveCount(0);
  await page.getByRole("button", { name: "Unmet needs", exact: true }).click();
  await expect(page.locator(".map-legend")).toContainText(
    "EST. HOUSEHOLDS WITH NEEDS",
  );
  await page
    .getByRole("button", { name: "Available assistance", exact: true })
    .click();
  await expect(page.locator(".resource-marker")).toHaveCount(4);
  await page
    .locator(".resource-list")
    .getByRole("button", { name: /Houston response hub/ })
    .click();
  await expect(page.locator(".resource-detail")).toContainText(
    "Availability and location have not been verified",
  );
  const search = page.getByRole("combobox", {
    name: "Search states or counties",
  });
  await search.fill("Harris");
  await page.getByRole("option", { name: /Harris County Texas/ }).click();
  await expect(page.locator(".insights-section h2")).toHaveText(
    "Harris County",
  );
  await expect(page.locator(".score-value")).toContainText("87");
  await page
    .getByRole("button", { name: "AI risk predictions", exact: true })
    .click();
  await expect(page.locator(".map-canvas")).toHaveAttribute(
    "data-boundaries-ready",
    "true",
  );
  await page.screenshot({
    path: "test-results/county-risk.png",
    fullPage: true,
  });
  await search.fill("Vermont");
  await page
    .getByRole("option", { name: "Vermont State", exact: true })
    .click();
  await expect(page.locator(".empty-insights")).toContainText(
    "No prediction for this area",
  );
  await page.getByRole("button", { name: "Data & settings" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText(
    "No live disaster feed or trained model is connected",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export snapshot" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("sentinel-demo-snapshot.json");
  expect(errors).toEqual([]);
});

test("mobile map workspace remains usable without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".disaster-marker")).toHaveCount(5, {
    timeout: 45000,
  });
  await expect(page.getByRole("combobox")).toBeVisible();
  await page
    .getByRole("button", { name: "AI risk predictions", exact: true })
    .click();
  await expect(page.locator(".map-legend")).toContainText("PREDICTED RISK");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
});
