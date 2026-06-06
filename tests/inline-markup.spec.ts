import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const root = process.cwd();
const parserPath = resolve(root, "src/utils/inlineMarkup.ts");
const profileCardPath = resolve(root, "src/components/ProfileCard.astro");

describe("inline markup parser", () => {
  test("converts supported inline tags into marked tokens", async () => {
    const mod = await import(parserPath);
    expect(
      mod.parseInlineMarkup("热爱<highlight>normality</highlight>与<circle>减法</circle>"),
    ).toEqual([
      { text: "热爱", mark: "plain" },
      { text: "normality", mark: "highlight" },
      { text: "与", mark: "plain" },
      { text: "减法", mark: "circle" },
    ]);
  });

  test("keeps unsupported tags as plain text", async () => {
    const mod = await import(parserPath);
    expect(mod.parseInlineMarkup("hello<unknown>world</unknown>")).toEqual([
      { text: "hello<unknown>world</unknown>", mark: "plain" },
    ]);
  });

  test("converts markdown links into link tokens", async () => {
    const mod = await import(parserPath);
    expect(mod.parseInlineMarkup("移步[我的技术博客](https://blog.scnace.me)")).toEqual([
      { text: "移步", mark: "plain" },
      { text: "我的技术博客", mark: "plain", href: "https://blog.scnace.me" },
    ]);
  });
});

describe("profile intro rendering", () => {
  test("routes profile intro through the annotated line renderer", () => {
    const source = readFileSync(profileCardPath, "utf8");
    expect(source).toContain("<AnnotatedLine line={profile.intro} />");
  });
});
