import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const root = process.cwd();
const contentPath = resolve(root, "src/content/homepage.ts");
const pagePath = resolve(root, "src/pages/index.astro");
const profileCardPath = resolve(root, "src/components/ProfileCard.astro");

describe("homepage content model", () => {
  test("defines typed homepage content and leaves feed items to generated channel data", async () => {
    expect(existsSync(contentPath)).toBe(true);

    const module = await import(contentPath);
    expect(module.homepage.siteTitle).toBeTruthy();
    expect(module.homepage.hero.title).toBeTruthy();
    expect(Array.isArray(module.homepage.feed)).toBe(true);
    expect(module.homepage.feed).toHaveLength(0);
  });
});

describe("homepage page shell", () => {
  test("creates the Astro single-page entrypoint", () => {
    expect(existsSync(pagePath)).toBe(true);
  });
});

describe("profile card rendering", () => {
  test("renders role tokens through the rich inline renderer", () => {
    const source = readFileSync(profileCardPath, "utf8");
    expect(source).toContain("<RichLine tokens={profile.role} />");
  });

  test("does not render a follow button", () => {
    const source = readFileSync(profileCardPath, "utf8");
    expect(source).not.toContain("profile.buttonLabel");
    expect(source).not.toContain("<button");
  });
});
