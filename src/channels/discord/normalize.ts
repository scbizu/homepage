import type { ChannelMedia, ChannelPost } from "../core/types";
import type { DiscordRawEvent } from "./types";

const discordEpochMs = 1420070400000n;

export interface NormalizeDiscordEventResult {
  post: ChannelPost | null;
  skippedReason?: string;
}

export function normalizeDiscordEvent(event: DiscordRawEvent): NormalizeDiscordEventResult {
  const media = normalizeMedia(event);

  if (!event.message.content && media.length === 0) {
    return { post: null, skippedReason: "empty_message" };
  }

  return {
    post: {
      platform: "discord",
      externalId: event.message.id,
      threadId: event.channel_id,
      url: `https://discord.com/channels/${event.guild_id}/${event.channel_id}/${event.message.id}`,
      publishedAt: snowflakeToUnixSeconds(event.message.id),
      author: {
        id: event.message.author.id,
        name: event.message.author.global_name ?? event.message.author.username,
        handle: event.message.author.username,
      },
      content: event.message.content,
      media,
      metadata: {
        interactionId: event.interaction_id,
        receivedAt: event.received_at,
        guildId: event.guild_id,
        channelId: event.channel_id,
      },
    },
  };
}

export function snowflakeToUnixSeconds(snowflake: string): number {
  return Number(((BigInt(snowflake) >> 22n) + discordEpochMs) / 1000n);
}

function normalizeMedia(event: DiscordRawEvent): ChannelMedia[] {
  const image = event.message.attachments.find(
    (attachment) => attachment.content_type?.startsWith("image/") && attachment.public_url,
  );

  if (!image) {
    return [];
  }

  return [
    {
      kind: "image",
      sourceId: image.id,
      url: image.public_url,
      width: image.width,
      height: image.height,
      alt: image.filename,
    },
  ];
}
