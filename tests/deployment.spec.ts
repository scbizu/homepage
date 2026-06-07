import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const root = process.cwd();
const packageJsonPath = resolve(root, "package.json");
const wranglerConfigPath = resolve(root, "wrangler.jsonc");
const workerPath = resolve(root, "src/worker.ts");

describe("cloudflare workers deployment files", () => {
  test("includes the Wrangler config needed for Workers deploys", () => {
    expect(existsSync(wranglerConfigPath)).toBe(true);
  });

  test("deploys the Astro build output as static assets", () => {
    const packageJson = readFileSync(packageJsonPath, "utf8");
    const wranglerConfig = readFileSync(wranglerConfigPath, "utf8");

    expect(packageJson).toContain("\"deploy\"");
    expect(packageJson).toContain("wrangler deploy");
    expect(wranglerConfig).toContain("\"assets\":");
    expect(wranglerConfig).toContain("\"directory\": \"./dist\"");
  });

  test("attaches the worker to the scnace.me custom domain", () => {
    const wranglerConfig = readFileSync(wranglerConfigPath, "utf8");

    expect(wranglerConfig).toContain("\"pattern\": \"scnace.me\"");
    expect(wranglerConfig).toContain("\"custom_domain\": true");
  });

  test("attaches the worker to the www subdomain and runs code before assets", () => {
    const wranglerConfig = readFileSync(wranglerConfigPath, "utf8");

    expect(wranglerConfig).toContain("\"pattern\": \"www.scnace.me\"");
    expect(wranglerConfig).toContain("\"main\": \"./src/worker.ts\"");
    expect(wranglerConfig).toContain("\"binding\": \"ASSETS\"");
    expect(wranglerConfig).toContain("\"run_worker_first\": true");
  });

  test("redirects www requests to the apex domain", () => {
    const worker = readFileSync(workerPath, "utf8");

    expect(worker).toContain("url.hostname === \"www.scnace.me\"");
    expect(worker).toContain("Response.redirect");
    expect(worker).toContain("env.ASSETS.fetch(request)");
  });
});
