import { test, expect } from "@playwright/test";

async function ready(page: import("@playwright/test").Page) {
  await page.goto("/");
  await expect(page.locator(".map-canvas")).toHaveAttribute(
    "data-boundaries-ready",
    "true",
    { timeout: 45000 },
  );
  await expect(page.locator(".map-canvas")).toHaveAttribute(
    "data-camera-moving",
    "false",
  );
  await page.evaluate(() => document.fonts.ready);
}

test("GEO uses Instrument Serif and supports geographic disaster exploration", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  await expect(
    page.getByRole("heading", { name: "Explore GEO." }),
  ).toBeVisible();
  await expect(page.locator(".disaster-marker")).toHaveCount(5);
  await expect(page.locator(".community-panel")).toHaveCount(0);
  expect(
    await page.evaluate(() => getComputedStyle(document.body).fontFamily),
  ).toContain("Instrument Serif");
  expect(
    await page.evaluate(() => document.fonts.check('17px "Instrument Serif"')),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/geo-overview.png",
    fullPage: true,
  });
  await page
    .getByLabel("Disaster type", { exact: true })
    .selectOption("Hurricane");
  await expect(page.locator(".disaster-marker")).toHaveCount(2);
  await page
    .getByRole("button", {
      name: "Explore Gulf hurricane scenario",
      exact: true,
    })
    .click();
  await expect(page.locator(".disaster-popup")).toContainText(
    "Gulf hurricane scenario",
  );
  await expect(page.locator(".community-panel")).toContainText(
    "synthetic scenario",
  );
  await page
    .locator(".disaster-popup")
    .getByRole("button", { name: "Explore affected communities" })
    .click();
  await expect(page.locator(".community-heading h2")).toHaveText(
    "Orleans Parish",
  );
  await expect(page.locator(".risk-note")).toContainText("94");
  await page.getByRole("button", { name: "Close details panel" }).click();
  await expect(page.locator(".community-panel")).toHaveCount(0);
  await page
    .getByLabel("Disaster type", { exact: true })
    .selectOption("Tornado");
  await expect(page.locator(".disaster-marker")).toHaveCount(0);
  await expect(page.locator(".map-empty-state")).toContainText(
    "No matching areas",
  );
  expect(errors).toEqual([]);
});

test("needs filtering handles any/all matches and local assistance updates", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  await page
    .getByLabel("Disaster type", { exact: true })
    .selectOption("Hurricane");
  const search = page.getByRole("combobox", {
    name: "Search city, county, state, or ZIP code",
  });
  await search.fill("Florida");
  await page
    .getByRole("option", { name: "Florida State · United States", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Food Insecurity", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Shelter Shortages", exact: true })
    .click();
  await page.getByRole("button", { name: "All", exact: true }).click();
  await page
    .getByRole("button", { name: "Find affected areas", exact: true })
    .click();
  await expect(page.locator(".result-summary")).toContainText(
    "2 matching counties",
  );
  await expect(page.locator(".map-canvas")).toHaveAttribute(
    "data-camera-moving",
    "false",
  );
  await expect(page.locator(".map-canvas")).toHaveAttribute(
    "data-map-idle",
    "true",
  );
  await page.screenshot({
    path: "test-results/geo-filtered.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Healthcare Access", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Medical Equipment", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Find affected areas", exact: true })
    .click();
  await expect(page.locator(".result-summary")).toContainText(
    "0 matching counties",
  );
  await expect(page.locator(".map-empty-state")).toBeVisible();
  await page.getByRole("button", { name: "Any", exact: true }).click();
  await page
    .getByRole("button", { name: "Find affected areas", exact: true })
    .click();
  await expect(page.locator(".result-summary")).toContainText(
    "2 matching counties",
  );
  await expect(page.locator(".map-empty-state")).toHaveCount(0);
  await search.fill("33101");
  await page.getByRole("option", { name: /Miami, Florida/ }).click();
  await expect(page.locator(".community-heading h2")).toHaveText(
    "Miami-Dade County",
  );
  await page
    .locator(".request-summary")
    .filter({ hasText: "Medication delivery" })
    .click();
  await page
    .getByRole("combobox", { name: "Assignee for Medication delivery" })
    .selectOption("Medical support team");
  await expect(
    page
      .locator(".request-item")
      .filter({ hasText: "Medication delivery" })
      .locator(".request-status"),
  ).toHaveText("Assigned");
  await page
    .getByRole("combobox", { name: "Status for Medication delivery" })
    .selectOption("Resolved");
  await expect(
    page
      .locator(".request-item")
      .filter({ hasText: "Medication delivery" })
      .locator(".request-status"),
  ).toHaveText("Resolved");
  await expect(page.locator(".coordination-summary")).toContainText(
    "1Resolved",
  );
  await page.getByRole("button", { name: "Map layers", exact: true }).click();
  await page
    .getByRole("button", { name: "Available assistance", exact: true })
    .click();
  await expect(page.locator(".resource-marker")).toHaveCount(1);
  await page
    .getByRole("button", { name: "About the data", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Instrument Serif is bundled locally",
  );
  await page.keyboard.press("Escape");
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export snapshot", exact: true })
    .click();
  expect((await downloadPromise).suggestedFilename()).toBe(
    "geo-demo-snapshot.json",
  );
  expect(errors).toEqual([]);
});

test("mobile preserves map access and usable filters without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await expect(page.locator(".disaster-marker")).toHaveCount(5);
  await page.screenshot({
    path: "test-results/geo-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Toggle filters", exact: true })
    .click();
  await page
    .getByLabel("Disaster type", { exact: true })
    .selectOption("Wildfire");
  await page
    .getByRole("button", { name: "Find affected areas", exact: true })
    .click();
  await expect(page.locator(".sidebar-container")).not.toBeVisible();
  await expect(page.locator(".result-summary")).toContainText(
    "1 matching county",
  );
  await expect(page.locator(".disaster-marker")).toHaveCount(1);
  await page
    .getByRole("button", {
      name: "Explore Sierra wildfire scenario",
      exact: true,
    })
    .click();
  await expect(page.locator(".disaster-popup")).toContainText(
    "Sierra wildfire scenario",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
