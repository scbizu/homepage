import { mkdtempSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, test, vi } from "vitest";

const syncPath = resolve(process.cwd(), "scripts/sync-channels.ts");

describe("multi-channel sync", () => {
  test("merges telegram and discord entries in global publish order", async () => {
    const mod = await import(syncPath);
    const tempDir = mkdtempSync(join(tmpdir(), "channels-sync-"));
    const telegramPath = join(tempDir, "telegram.jsonl");
    const discordPath = join(tempDir, "discord.jsonl");
    const outputPath = join(tempDir, "channels-feed.json");

    await writeFile(
      telegramPath,
      JSON.stringify({
        schema_version: 1,
        event_type: "channel_post",
        update_id: 1,
        received_at: "2026-06-14T08:00:00.000Z",
        chat: { id: -1001, username: "scnace", type: "channel" },
        message: { message_id: 1, date: 1700000000, text: "Telegram older" },
      }),
    );
    await writeFile(
      discordPath,
      JSON.stringify({
        schema_version: 1,
        interaction_id: "1400000000000000000",
        received_at: "2026-06-14T08:00:00.000Z",
        guild_id: "100",
        channel_id: "200",
        message: {
          id: "1200000000000000000",
          content: "Discord newer",
          author: { id: "300", username: "nace" },
          attachments: [],
        },
      }),
    );

    const result = await mod.syncChannelsFeed({
      telegramInputPath: telegramPath,
      discordInputPath: discordPath,
      outputPath,
    });

    expect(result.entries.map((entry: { id: string }) => entry.id)).toEqual([
      "discord-1200000000000000000",
      "telegram-1",
    ]);
    expect(JSON.parse(readFileSync(outputPath, "utf8")).entries).toHaveLength(2);
  });

  test("can read both channel streams from remote urls", async () => {
    const mod = await import(syncPath);
    const tempDir = mkdtempSync(join(tmpdir(), "channels-sync-remote-"));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 200 }))
      .mockResolvedValueOnce(new Response("", { status: 200 }));

    await mod.syncChannelsFeed({
      telegramInputUrl: "https://example.com/telegram.jsonl",
      discordInputUrl: "https://example.com/discord.jsonl",
      outputPath: join(tempDir, "channels-feed.json"),
      fetchImpl: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
