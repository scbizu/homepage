import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const root = process.cwd();
const pagePath = resolve(root, "src/pages/index.astro");
const textEntryPath = resolve(root, "src/components/TextEntry.astro");
const imageEntryPath = resolve(root, "src/components/ImageEntry.astro");

describe("generated channel feed integration", () => {
  test("merges generated channel entries into the homepage notebook feed", () => {
    const source = readFileSync(pagePath, "utf8");
    expect(source).toContain("channels-feed.json");
    expect(source).toContain("const mergedFeed: FeedEntry[] = [...generatedEntries, ...homepage.feed];");
    expect(source).toContain("<NotebookFeed feed={mergedFeed} />");
  });

  test("renders text entry meta without forcing a prefix", () => {
    const source = readFileSync(textEntryPath, "utf8");
    expect(source).toContain("entry.meta.prefix ? `${entry.meta.prefix} / ` : \"\"");
  });

  test("renders image entry meta without forcing a prefix", () => {
    const source = readFileSync(imageEntryPath, "utf8");
    expect(source).toContain("entry.meta.prefix ? `${entry.meta.prefix} / ` : \"\"");
  });
});
