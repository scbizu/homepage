import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { buildChannelFeed } from "../src/channels/core/feed";
import { parseMarkup } from "../src/channels/core/markup";
import { normalizeTelegramEvent } from "../src/channels/telegram/normalize";
import type { TelegramRawEvent } from "../src/channels/telegram/types";

export const DEFAULT_TELEGRAM_GIST_RAW_URL =
  "https://gist.githubusercontent.com/scbizu/35f145e6898bd0c46977fe222a512ae1/raw/telegram_message.jsonl";

export interface SyncTelegramFeedOptions {
  inputPath?: string;
  inputUrl?: string;
  outputPath?: string;
  fetchImpl?: typeof fetch;
}

export async function syncTelegramFeed(options: SyncTelegramFeedOptions = {}) {
  const inputPath = options.inputPath ?? resolve(process.cwd(), "data/channels/telegram/messages.jsonl");
  const inputUrl =
    options.inputUrl ??
    process.env.TELEGRAM_GIST_RAW_URL ??
    (options.inputPath ? undefined : DEFAULT_TELEGRAM_GIST_RAW_URL);
  const outputPath =
    options.outputPath ?? resolve(process.cwd(), "src/content/generated/channels/telegram-feed.json");
  const jsonl = inputUrl
    ? await readRemoteJsonl(inputUrl, options.fetchImpl ?? fetch)
    : await readFile(inputPath, "utf8");
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

async function readRemoteJsonl(inputUrl: string, fetchImpl: typeof fetch): Promise<string> {
  const response = await fetchImpl(inputUrl, {
    headers: {
      Accept: "text/plain, application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch telegram JSONL from ${inputUrl}: ${response.status}`);
  }

  return response.text();
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
