import { mkdtempSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";

const root = process.cwd();
const syncPath = resolve(root, "scripts/sync-telegram.ts");

describe("telegram sync integration", () => {
  test("merges edited events and writes deterministic generated feed output", async () => {
    const mod = await import(syncPath);
    const tempDir = mkdtempSync(join(tmpdir(), "telegram-sync-"));
    const inputPath = join(tempDir, "messages.jsonl");
    const outputPath = join(tempDir, "telegram-feed.json");

    await writeFile(
      inputPath,
      [
        JSON.stringify({
          schema_version: 1,
          event_type: "channel_post",
          update_id: 1,
          received_at: "2026-06-07T12:00:00.000Z",
          chat: { id: -1001, title: "Nace", username: "scnace", type: "channel" },
          message: {
            message_id: 201,
            date: 1780833600,
            text: "第一版",
          },
        }),
        JSON.stringify({
          schema_version: 1,
          event_type: "edited_channel_post",
          update_id: 2,
          received_at: "2026-06-07T12:05:00.000Z",
          chat: { id: -1001, title: "Nace", username: "scnace", type: "channel" },
          message: {
            message_id: 201,
            date: 1780833600,
            edit_date: 1780833900,
            text: "#photo\n修订版",
            photo: [{ file_id: "photo-1", file_unique_id: "uniq-1", width: 1000, height: 800 }],
          },
        }),
      ].join("\n"),
      "utf8",
    );

    const result = await mod.syncTelegramFeed({ inputPath, outputPath });
    const written = JSON.parse(readFileSync(outputPath, "utf8"));

    expect(result.skipped).toEqual([]);
    expect(written.entries).toMatchObject([
      {
        id: "telegram-201",
        type: "image",
        meta: {
          prefix: "photo",
        },
      },
    ]);
  });
});
