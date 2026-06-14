import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildChannelFeed } from "../src/channels/core/feed";
import { parseMarkup } from "../src/channels/core/markup";
import type { ChannelPost } from "../src/channels/core/types";
import { normalizeDiscordEvent } from "../src/channels/discord/normalize";
import type { DiscordRawEvent } from "../src/channels/discord/types";
import { normalizeTelegramEvent } from "../src/channels/telegram/normalize";
import type { TelegramRawEvent } from "../src/channels/telegram/types";
import { DEFAULT_TELEGRAM_GIST_RAW_URL } from "./sync-telegram";

export interface SyncChannelsFeedOptions {
  telegramInputPath?: string;
  telegramInputUrl?: string;
  discordInputPath?: string;
  discordInputUrl?: string;
  outputPath?: string;
  fetchImpl?: typeof fetch;
}

export async function syncChannelsFeed(options: SyncChannelsFeedOptions = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const telegramSource = await readSource({
    path: options.telegramInputPath ?? resolve(process.cwd(), "data/channels/telegram/messages.jsonl"),
    url:
      options.telegramInputUrl ??
      process.env.TELEGRAM_GIST_RAW_URL ??
      (options.telegramInputPath ? undefined : DEFAULT_TELEGRAM_GIST_RAW_URL),
    fetchImpl,
  });
  const discordSource = await readSource({
    path: options.discordInputPath ?? resolve(process.cwd(), "data/channels/discord/messages.jsonl"),
    url: options.discordInputUrl ?? process.env.DISCORD_GIST_RAW_URL,
    fetchImpl,
    optional: !options.discordInputPath && !options.discordInputUrl && !process.env.DISCORD_GIST_RAW_URL,
  });

  const telegramEvents = selectLatestTelegramEvents(parseJsonl<TelegramRawEvent>(telegramSource));
  const discordEvents = selectLatestDiscordEvents(parseJsonl<DiscordRawEvent>(discordSource));
  const posts: ChannelPost[] = [
    ...telegramEvents.map((event) => normalizeTelegramEvent(event).post),
    ...discordEvents.map((event) => normalizeDiscordEvent(event).post),
  ].filter((post): post is ChannelPost => post !== null);

  const generatedFeed = buildChannelFeed(posts, {
    parseMarkup: (input) => parseMarkup(input).document,
  });
  const outputPath =
    options.outputPath ?? resolve(process.cwd(), "src/content/generated/channels/channels-feed.json");

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(generatedFeed, null, 2)}\n`, "utf8");
  return generatedFeed;
}

async function readSource(options: {
  path: string;
  url?: string;
  fetchImpl: typeof fetch;
  optional?: boolean;
}): Promise<string> {
  if (options.url) {
    const response = await options.fetchImpl(options.url, {
      headers: { Accept: "text/plain, application/json" },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch channel JSONL from ${options.url}: ${response.status}`);
    }
    return response.text();
  }

  try {
    return await readFile(options.path, "utf8");
  } catch (error) {
    if (options.optional && (error as NodeJS.ErrnoException).code === "ENOENT") {
      return "";
    }
    throw error;
  }
}

function parseJsonl<T>(jsonl: string): T[] {
  return jsonl
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

function selectLatestTelegramEvents(events: TelegramRawEvent[]): TelegramRawEvent[] {
  const latest = new Map<number, TelegramRawEvent>();
  for (const event of events) {
    const previous = latest.get(event.message.message_id);
    const eventTime = event.message.edit_date ?? event.message.date;
    const previousTime = previous ? previous.message.edit_date ?? previous.message.date : -1;
    if (!previous || eventTime > previousTime || (eventTime === previousTime && event.update_id >= previous.update_id)) {
      latest.set(event.message.message_id, event);
    }
  }
  return [...latest.values()];
}

function selectLatestDiscordEvents(events: DiscordRawEvent[]): DiscordRawEvent[] {
  const latest = new Map<string, DiscordRawEvent>();
  for (const event of events) {
    latest.set(event.message.id, event);
  }
  return [...latest.values()];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await syncChannelsFeed();
}
