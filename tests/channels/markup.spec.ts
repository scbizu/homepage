import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const root = process.cwd();
const markupPath = resolve(root, "src/channels/core/markup.ts");

describe("channel control tags", () => {
  test("extracts leading control tags and strips them from content", async () => {
    const mod = await import(markupPath);
    expect(mod.extractControlTags("#photo #daily\n今天傍晚的光线很好。")).toEqual({
      tags: ["photo", "daily"],
      content: "今天傍晚的光线很好。",
    });
  });

  test("ignores hashtags that are not in the leading control tag block", async () => {
    const mod = await import(markupPath);
    expect(mod.extractControlTags("今天的 #daily 很轻松。")).toEqual({
      tags: [],
      content: "今天的 #daily 很轻松。",
    });
  });
});

describe("channel markup parser", () => {
  test("parses anno, highlight, and link nodes", async () => {
    const mod = await import(markupPath);
    const result = mod.parseMarkup(
      '今天专注于做<anno note="这不是口号">减法</anno>，它喜欢<highlight>引起注意力</highlight>，移步<link href="https://blog.scnace.me">我的技术博客</link>。',
    );

    expect(result.errors).toEqual([]);
    expect(result.document.nodes).toEqual([
      { type: "text", value: "今天专注于做" },
      { type: "anno", value: "减法", note: "这不是口号" },
      { type: "text", value: "，它喜欢" },
      { type: "highlight", value: "引起注意力" },
      { type: "text", value: "，移步" },
      { type: "link", value: "我的技术博客", href: "https://blog.scnace.me" },
      { type: "text", value: "。" },
    ]);
  });

  test("degrades malformed custom tags to plain text while reporting an error", async () => {
    const mod = await import(markupPath);
    const result = mod.parseMarkup('hello<anno note="oops">world</note>');

    expect(result.document.nodes).toEqual([{ type: "text", value: 'hello<anno note="oops">world</note>' }]);
    expect(result.errors[0]).toMatchObject({
      code: "invalid_markup",
    });
  });

  test("treats unknown tags as plain text", async () => {
    const mod = await import(markupPath);
    const result = mod.parseMarkup("hello<unknown>world</unknown>");

    expect(result.errors).toEqual([]);
    expect(result.document.nodes).toEqual([{ type: "text", value: "hello<unknown>world</unknown>" }]);
  });
});
