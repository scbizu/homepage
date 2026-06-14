import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const normalizePath = resolve(process.cwd(), "src/channels/discord/normalize.ts");

describe("discord normalization", () => {
  test("normalizes a message command event with text and a persisted image", async () => {
    const mod = await import(normalizePath);
    const result = mod.normalizeDiscordEvent({
      schema_version: 1,
      interaction_id: "1400000000000000000",
      received_at: "2026-06-14T08:00:00.000Z",
      guild_id: "100",
      channel_id: "200",
      message: {
        id: "1390000000000000000",
        content: "#photo\nDiscord 发布",
        author: {
          id: "300",
          username: "nace",
          global_name: "Nace",
        },
        attachments: [
          {
            id: "400",
            filename: "photo.png",
            content_type: "image/png",
            width: 1200,
            height: 800,
            source_url: "https://cdn.discordapp.com/photo.png",
            public_url: "/images/channels/discord/1390000000000000000-400.png",
          },
        ],
      },
    });

    expect(result.skippedReason).toBeUndefined();
    expect(result.post).toMatchObject({
      platform: "discord",
      externalId: "1390000000000000000",
      threadId: "200",
      url: "https://discord.com/channels/100/200/1390000000000000000",
      author: {
        id: "300",
        name: "Nace",
        handle: "nace",
      },
      content: "#photo\nDiscord 发布",
      media: [
        {
          kind: "image",
          sourceId: "400",
          url: "/images/channels/discord/1390000000000000000-400.png",
          width: 1200,
          height: 800,
        },
      ],
    });
    expect(result.post?.publishedAt).toBeGreaterThan(0);
  });

  test("skips events without text or a persisted image", async () => {
    const mod = await import(normalizePath);
    const result = mod.normalizeDiscordEvent({
      schema_version: 1,
      interaction_id: "1400000000000000001",
      received_at: "2026-06-14T08:00:00.000Z",
      guild_id: "100",
      channel_id: "200",
      message: {
        id: "1390000000000000001",
        content: "",
        author: { id: "300", username: "nace" },
        attachments: [],
      },
    });

    expect(result.post).toBeNull();
    expect(result.skippedReason).toBe("empty_message");
  });
});
