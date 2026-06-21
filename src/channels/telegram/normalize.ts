import type { ChannelMedia, ChannelPost } from "../core/types";
import type { TelegramPhotoSize, TelegramRawEvent } from "./types";

export interface NormalizeTelegramEventOptions {
  channelUrlBase?: string;
}

export interface NormalizeTelegramEventResult {
  post: ChannelPost | null;
  skippedReason?: string;
}

export function normalizeTelegramEvent(
  event: TelegramRawEvent,
  options: NormalizeTelegramEventOptions = {},
): NormalizeTelegramEventResult {
  const content = event.message.text ?? event.message.caption ?? "";
  const media = normalizeMedia(event.message.photo);

  if (!content && media.length === 0) {
    return {
      post: null,
      skippedReason: "empty_message",
    };
  }

  return {
    post: {
      platform: "telegram",
      externalId: String(event.message.message_id),
      threadId: event.message.media_group_id,
      url:
        event.chat.username && options.channelUrlBase !== ""
          ? `${options.channelUrlBase ?? `https://t.me/${event.chat.username}`}/${event.message.message_id}`
          : undefined,
      publishedAt: event.message.date,
      editedAt: event.message.edit_date,
      author: event.message.author_signature
        ? {
            name: event.message.author_signature,
          }
        : undefined,
      content,
      media,
      metadata: {
        updateId: event.update_id,
        eventType: event.event_type,
        receivedAt: event.received_at,
        chatId: event.chat.id,
        chatUsername: event.chat.username,
      },
    },
  };
}

function normalizeMedia(photoSizes?: TelegramPhotoSize[]): ChannelMedia[] {
  if (!photoSizes || photoSizes.length === 0) {
    return [];
  }

  const largest = [...photoSizes].sort((left, right) => right.width * right.height - left.width * left.height)[0];

  return [
    {
      kind: "image",
      sourceId: largest.file_id,
      url: largest.public_url,
      width: largest.width,
      height: largest.height,
    },
  ];
}
