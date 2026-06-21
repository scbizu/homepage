import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const root = process.cwd();
const normalizePath = resolve(root, "src/channels/telegram/normalize.ts");

describe("telegram normalization", () => {
  test("normalizes a text-only channel post", async () => {
    const mod = await import(normalizePath);
    const result = mod.normalizeTelegramEvent({
      schema_version: 1,
      event_type: "channel_post",
      update_id: 1,
      received_at: "2026-06-07T12:00:00.000Z",
      chat: { id: -1001, title: "Nace", username: "scnace", type: "channel" },
      message: {
        message_id: 101,
        date: 1780833600,
        text: "重新开始总是既令人畏惧又让人兴奋。",
      },
    });

    expect(result.skippedReason).toBeUndefined();
    expect(result.post).toMatchObject({
      platform: "telegram",
      externalId: "101",
      publishedAt: 1780833600,
      content: "重新开始总是既令人畏惧又让人兴奋。",
      media: [],
    });
  });

  test("normalizes a captioned photo post and keeps media metadata", async () => {
    const mod = await import(normalizePath);
    const result = mod.normalizeTelegramEvent({
      schema_version: 1,
      event_type: "channel_post",
      update_id: 2,
      received_at: "2026-06-07T12:10:00.000Z",
      chat: { id: -1001, title: "Nace", username: "scnace", type: "channel" },
      message: {
        message_id: 102,
        date: 1780834200,
        media_group_id: "album-1",
        caption: "#photo\n今天的光很好。",
        photo: [
          { file_id: "small", file_unique_id: "small-1", width: 300, height: 200 },
          {
            file_id: "large",
            file_unique_id: "large-1",
            width: 1280,
            height: 720,
            file_size: 123456,
            public_url: "/images/channels/telegram/102-large-1.jpg",
          },
        ],
      },
    });

    expect(result.post).toMatchObject({
      externalId: "102",
      threadId: "album-1",
      content: "#photo\n今天的光很好。",
      media: [
        {
          kind: "image",
          sourceId: "large",
          url: "/images/channels/telegram/102-large-1.jpg",
          width: 1280,
          height: 720,
        },
      ],
    });
  });

  test("preserves edited timestamps on edited posts", async () => {
    const mod = await import(normalizePath);
    const result = mod.normalizeTelegramEvent({
      schema_version: 1,
      event_type: "edited_channel_post",
      update_id: 3,
      received_at: "2026-06-07T12:30:00.000Z",
      chat: { id: -1001, title: "Nace", username: "scnace", type: "channel" },
      message: {
        message_id: 103,
        date: 1780830000,
        edit_date: 1780835400,
        text: "修订后的内容",
      },
    });

    expect(result.post?.editedAt).toBe(1780835400);
  });

  test("skips empty posts with no supported media", async () => {
    const mod = await import(normalizePath);
    const result = mod.normalizeTelegramEvent({
      schema_version: 1,
      event_type: "channel_post",
      update_id: 4,
      received_at: "2026-06-07T12:40:00.000Z",
      chat: { id: -1001, title: "Nace", username: "scnace", type: "channel" },
      message: {
        message_id: 104,
        date: 1780836000,
      },
    });

    expect(result.post).toBeNull();
    expect(result.skippedReason).toBe("empty_message");
  });
});
