import { test, expect } from "@playwright/test";
test.skip(!process.env.GEOCAST_TEST_AUTH, "Use the documented isolated Supabase test configuration.");

test("email sign-in shows Supabase errors and allows retry", async ({ page }) => {
  let submitted = false;
  await page.route("**/auth/v1/token**", async route => {
    const body = route.request().postDataJSON();
    submitted = body.email === "test@example.com" && body.password === "incorrect-password";
    await route.fulfill({ status: 400, json: { code: "invalid_credentials", msg: "Invalid login credentials" } });
  });
  await page.goto("/login");
  await page.getByLabel("Email address").fill("test@example.com");
  await page.getByLabel("Password", { exact: true }).fill("incorrect-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Invalid login credentials");
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeEnabled();
  expect(submitted).toBe(true);
});

test("Google sign-in starts OAuth with a PKCE challenge and login redirect", async ({ page }) => {
  let authorizeUrl = "";
  await page.route("**/auth/v1/authorize**", async route => {
    authorizeUrl = route.request().url();
    await route.fulfill({ contentType: "text/html", body: "OAuth provider reached" });
  });
  await page.goto("/login");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect.poll(() => authorizeUrl).not.toBe("");
  const url = new URL(authorizeUrl);
  expect(url.searchParams.get("provider")).toBe("google");
  expect(url.searchParams.get("redirect_to")).toBe("http://127.0.0.1:5173/login");
  expect(url.searchParams.get("code_challenge_method")?.toLowerCase()).toBe("s256");
  expect(url.searchParams.get("code_challenge")).toBeTruthy();
});

test("OAuth denial is visible and removed from the URL", async ({ page }) => {
  await page.goto("/login?error=access_denied&error_description=Google%20sign-in%20cancelled");
  await expect(page.getByRole("alert")).toContainText("Google sign-in cancelled");
  await expect(page).toHaveURL(/\/login$/);
});

test("email session survives reload and sign-out clears it", async ({ page }) => {
  const user = { id: "11111111-1111-4111-8111-111111111111", aud: "authenticated", role: "authenticated", email: "test@example.com", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
  await page.route("**/auth/v1/token**", route => route.fulfill({ json: {
    access_token: "test-access-token", refresh_token: "test-refresh-token", token_type: "bearer", expires_in: 3600, user,
  } }));
  await page.route("**/auth/v1/logout**", route => route.fulfill({ status: 204 }));
  await page.goto("/login");
  await page.getByLabel("Email address").fill("test@example.com");
  await page.getByLabel("Password", { exact: true }).fill("test-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
});
