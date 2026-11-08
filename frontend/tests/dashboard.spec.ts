import { test, expect } from "@playwright/test";
async function ready(page: import("@playwright/test").Page) {
  await page.goto("/?mode=demo");
  await expect(page.locator(".map-canvas")).toHaveAttribute(
    "data-boundaries-ready",
    "true",
    { timeout: 45000 },
  );
  await expect(page.locator(".map-canvas")).toHaveAttribute(
    "data-camera-moving",
    "false",
    { timeout: 20000 },
  );
  await page.evaluate(() => document.fonts.ready);
}

test("GeoCast layout, mascot, radar playback, and event exploration", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  await expect(
    page.getByRole("heading", { name: "Disaster explorer", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator(".primary-tabs")
      .getByRole("button", { name: "Map", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".disaster-marker")).toHaveCount(2);
  await expect(
    page.getByRole("img", { name: /GEO, our globe mascot/ }),
  ).toBeVisible();
  expect(
    await page
      .getByRole("img", { name: /GEO, our globe mascot/ })
      .evaluate(
        (img) =>
          (img as HTMLImageElement).complete &&
          (img as HTMLImageElement).naturalWidth > 0,
      ),
  ).toBe(true);
  expect(
    await page.evaluate(() => getComputedStyle(document.body).fontFamily),
  ).toContain("Segoe UI");
  await expect(page.locator(".map-canvas")).toHaveAttribute(
    "data-map-idle",
    "true",
  );
  await page.screenshot({
    path: "test-results/geocast-overview.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Meet GEO, our mascot", exact: true })
    .click();
  await expect(page.locator(".mascot-tip")).toContainText("Hi, I'm GEO!");
  await page
    .getByRole("button", { name: "Close GEO tip", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Play radar simulation", exact: true })
    .click();
  await expect(page.locator(".radar-frame-label small")).not.toContainText(
    "Demo frame 1 / 6",
  );
  await page
    .getByRole("button", { name: "Pause radar simulation", exact: true })
    .click();
  await page.getByRole("slider", { name: "Radar simulation frame" }).focus();
  await page
    .getByRole("slider", { name: "Radar simulation frame" })
    .press("End");
  await expect(page.locator(".radar-frame-label small")).toContainText(
    "Demo frame 6 / 6",
  );
  await page
    .getByRole("button", { name: "Radar simulation", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Radar simulation", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await page
    .getByRole("button", { name: "Radar simulation", exact: true })
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
  await page
    .locator(".disaster-popup")
    .getByRole("button", { name: "Explore affected communities" })
    .click();
  await expect(page.locator(".community-heading h2")).toHaveText(
    "Orleans Parish",
  );
  await expect(page.locator(".risk-note")).toContainText("94");
  await page.getByRole("button", { name: "Close details panel" }).click();
  await page.getByRole("button", { name: "Toggle night view" }).click();
  await expect(page.locator(".geocast")).toHaveClass(/night-mode/);
  expect(errors).toEqual([]);
});

test("population filters, resources, insights, and local assistance remain functional", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  await page
    .locator(".filter-footer")
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
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
    .locator(".need-category")
    .filter({ hasText: "Basic necessities" })
    .locator("summary > svg")
    .click();
  await page
    .getByRole("button", { name: "Food Insecurity", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Shelter Shortages", exact: true })
    .click();
  await page.getByRole("button", { name: "All", exact: true }).click();
  await page
    .getByRole("button", { name: "Apply filters", exact: true })
    .click();
  await expect(page.locator(".result-summary")).toContainText(
    "2 matching counties",
  );
  await page
    .locator(".need-category")
    .filter({ hasText: "Medical urgency" })
    .locator("summary > svg")
    .click();
  await page
    .getByRole("button", { name: "Healthcare Access", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Medical Equipment", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Apply filters", exact: true })
    .click();
  await expect(page.locator(".map-empty-state")).toBeVisible();
  await page.getByRole("button", { name: "Any", exact: true }).click();
  await page
    .getByRole("button", { name: "Apply filters", exact: true })
    .click();
  await expect(page.locator(".result-summary")).toContainText(
    "2 matching counties",
  );
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
  await page
    .getByRole("combobox", { name: "Status for Medication delivery" })
    .selectOption("Resolved");
  await expect(
    page
      .locator(".request-item")
      .filter({ hasText: "Medication delivery" })
      .locator(".request-status"),
  ).toHaveText("Resolved");
  await page.getByRole("button", { name: "Close details panel" }).click();
  await page
    .getByRole("button", { name: "View relief resources", exact: true })
    .click();
  await expect(
    page
      .locator(".primary-tabs")
      .getByRole("button", { name: "Resources", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".overview-content")).toContainText(
    "Florida response hub",
  );
  await expect(page.locator(".resource-marker")).toHaveCount(1);
  await page
    .locator(".primary-tabs")
    .getByRole("button", { name: "Insights", exact: true })
    .click();
  await expect(page.locator(".overview-content")).toContainText("Miami-Dade");
  await page
    .getByRole("button", { name: "About the data", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "The interface uses Segoe UI",
  );
  await page.keyboard.press("Escape");
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export snapshot", exact: true })
    .click();
  expect((await downloadPromise).suggestedFilename()).toBe(
    "geocast-demo-snapshot.json",
  );
  expect(errors).toEqual([]);
});

test("mobile keeps the radar, mascot, and expandable filters usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await page.screenshot({
    path: "test-results/geocast-mobile.png",
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
    .getByRole("button", { name: "Apply filters", exact: true })
    .click();
  await expect(page.locator(".sidebar-container")).not.toBeVisible();
  await expect(page.locator(".result-summary")).toContainText(
    "1 matching county",
  );
  await expect(page.locator(".disaster-marker")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Play radar simulation", exact: true }),
  ).toBeDisabled();
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

