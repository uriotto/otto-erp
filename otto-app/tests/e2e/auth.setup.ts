import { test as setup } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { AUTH_FILE } from "../../playwright.config";
import { existsSync } from "fs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const testEmail = process.env.E2E_TEST_EMAIL!;

setup("authenticate", async ({ page }) => {
  // skip setup if auth file already exists (session was saved manually or in a prior run)
  if (existsSync(AUTH_FILE)) {
    return;
  }

  if (!supabaseUrl || !serviceRoleKey || !testEmail) {
    throw new Error(
      "Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, E2E_TEST_EMAIL",
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // generate magic link without sending email
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: testEmail,
  });

  if (error || !data?.properties?.action_link) {
    throw new Error(`Failed to generate magic link: ${error?.message}`);
  }

  // follow the Supabase verify URL server-side to capture the redirect Location header
  // Supabase puts access_token in the Location: hash — fetch with redirect:manual captures it
  const verifyRes = await fetch(data.properties.action_link, {
    redirect: "manual",
    headers: { "User-Agent": "playwright-e2e" },
  });
  const location = verifyRes.headers.get("location") ?? "";
  if (!location.includes("access_token=")) {
    throw new Error(`Unexpected redirect location: ${location}`);
  }

  // extract tokens from hash
  const hash = location.includes("#") ? location.split("#")[1] : "";
  const params = new URLSearchParams(hash);
  const access_token = params.get("access_token")!;
  const refresh_token = params.get("refresh_token")!;

  if (!access_token || !refresh_token) {
    throw new Error("Could not extract tokens from redirect");
  }

  // set session as Supabase SSR cookies directly in the browser context
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const cookieName = `sb-${projectRef}-auth-token`;
  const sessionJson = JSON.stringify({ access_token, refresh_token, token_type: "bearer" });

  await page.context().addCookies([
    {
      name: cookieName,
      value: sessionJson,
      domain: "localhost",
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
  ]);

  await page.goto("http://localhost:3000/dashboard");
  await page.waitForURL("**/dashboard**", { timeout: 20_000 });

  // save auth state for all other tests
  await page.context().storageState({ path: AUTH_FILE });
});
