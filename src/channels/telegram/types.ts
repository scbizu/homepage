export type TelegramEventType = "channel_post" | "edited_channel_post";

export interface TelegramPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

export interface TelegramEntity {
  type: string;
  offset: number;
  length: number;
  url?: string;
}

export interface TelegramChat {
  id: number;
  title?: string;
  username?: string;
  type: "channel";
}

export interface TelegramMessage {
  message_id: number;
  date: number;
  edit_date?: number;
  author_signature?: string;
  media_group_id?: string;
  text?: string;
  caption?: string;
  entities?: TelegramEntity[];
  caption_entities?: TelegramEntity[];
  photo?: TelegramPhotoSize[];
}

export interface TelegramRawEvent {
  schema_version: 1;
  event_type: TelegramEventType;
  update_id: number;
  received_at: string;
  chat: TelegramChat;
  message: TelegramMessage;
}
