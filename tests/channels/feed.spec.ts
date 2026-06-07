import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const root = process.cwd();
const feedPath = resolve(root, "src/channels/core/feed.ts");
const markupPath = resolve(root, "src/channels/core/markup.ts");

describe("channel feed builder", () => {
  test("builds a text entry without a prefix when no control tag is present", async () => {
    const feed = await import(feedPath);
    const markup = await import(markupPath);
    const result = feed.buildChannelFeed(
      [
        {
          platform: "telegram",
          externalId: "101",
          publishedAt: 1780833600,
          content: "今天只是普通地记一笔。",
          media: [],
          metadata: {},
        },
      ],
      {
        parseMarkup: (input: string) => markup.parseMarkup(input).document,
      },
    );

    expect(result.skipped).toEqual([]);
    expect(result.entries).toMatchObject([
      {
        type: "text",
        id: "telegram-101",
        meta: {
          prefix: undefined,
          source: "发表于 Telegram",
          date: "2026年6月7日",
        },
      },
    ]);
  });

  test("uses the first leading control tag as the rendered prefix", async () => {
    const feed = await import(feedPath);
    const markup = await import(markupPath);
    const result = feed.buildChannelFeed(
      [
        {
          platform: "telegram",
          externalId: "102",
          publishedAt: 1780834200,
          content: '#photo\n今天，我专注于做<anno note="这不是口号">减法</anno>。',
          media: [],
          metadata: {},
        },
      ],
      {
        parseMarkup: (input: string) => markup.parseMarkup(input).document,
      },
    );

    expect(result.entries[0]).toMatchObject({
      type: "text",
      meta: {
        prefix: "photo",
      },
      lines: [
        [
          "今天，我专注于做",
          {
            type: "annotation",
            target: "减法",
            note: "这不是口号",
          },
          "。",
        ],
      ],
    });
  });

  test("builds an image entry when the post contains an image", async () => {
    const feed = await import(feedPath);
    const markup = await import(markupPath);
    const result = feed.buildChannelFeed(
      [
        {
          platform: "telegram",
          externalId: "103",
          publishedAt: 1780834800,
          content: "#photo\n今天的光很好。",
          media: [{ kind: "image", url: "https://example.com/photo.jpg", alt: "原图" }],
          metadata: {},
        },
      ],
      {
        parseMarkup: (input: string) => markup.parseMarkup(input).document,
      },
    );

    expect(result.entries[0]).toMatchObject({
      type: "image",
      image: {
        src: "https://example.com/photo.jpg",
        alt: "今天的光很好。",
      },
      meta: {
        prefix: "photo",
      },
    });
  });
});
