import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { buildChannelFeed } from "../src/channels/core/feed";
import { parseMarkup } from "../src/channels/core/markup";
import { normalizeTelegramEvent } from "../src/channels/telegram/normalize";
import type { TelegramRawEvent } from "../src/channels/telegram/types";

export interface SyncTelegramFeedOptions {
  inputPath?: string;
  outputPath?: string;
}

export async function syncTelegramFeed(options: SyncTelegramFeedOptions = {}) {
  const inputPath = options.inputPath ?? resolve(process.cwd(), "data/channels/telegram/messages.jsonl");
  const outputPath =
    options.outputPath ?? resolve(process.cwd(), "src/content/generated/channels/telegram-feed.json");
  const jsonl = await readFile(inputPath, "utf8");
  const events = parseJsonl(jsonl);
  const latestEvents = selectLatestEvents(events);
  const posts = latestEvents
    .map((event) => normalizeTelegramEvent(event).post)
    .filter((post): post is NonNullable<typeof post> => post !== null);
  const generatedFeed = buildChannelFeed(posts, {
    parseMarkup: (input) => parseMarkup(input).document,
  });

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(generatedFeed, null, 2)}\n`, "utf8");

  return generatedFeed;
}

function parseJsonl(jsonl: string): TelegramRawEvent[] {
  return jsonl
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as TelegramRawEvent);
}

function selectLatestEvents(events: TelegramRawEvent[]): TelegramRawEvent[] {
  const latestByMessageId = new Map<number, TelegramRawEvent>();

  for (const event of events) {
    const previous = latestByMessageId.get(event.message.message_id);

    if (!previous || compareEventRecency(event, previous) >= 0) {
      latestByMessageId.set(event.message.message_id, event);
    }
  }

  return [...latestByMessageId.values()].sort((left, right) => right.message.date - left.message.date);
}

function compareEventRecency(left: TelegramRawEvent, right: TelegramRawEvent): number {
  const leftTimestamp = left.message.edit_date ?? left.message.date;
  const rightTimestamp = right.message.edit_date ?? right.message.date;

  if (leftTimestamp !== rightTimestamp) {
    return leftTimestamp - rightTimestamp;
  }

  return left.update_id - right.update_id;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await syncTelegramFeed();
}
