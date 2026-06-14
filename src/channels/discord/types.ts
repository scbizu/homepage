export interface DiscordAuthor {
  id: string;
  username: string;
  global_name?: string | null;
}

export interface DiscordAttachment {
  id: string;
  filename: string;
  content_type?: string;
  width?: number;
  height?: number;
  source_url: string;
  public_url?: string;
}

export interface DiscordPersistedMessage {
  id: string;
  content: string;
  author: DiscordAuthor;
  attachments: DiscordAttachment[];
}

export interface DiscordRawEvent {
  schema_version: 1;
  interaction_id: string;
  received_at: string;
  guild_id: string;
  channel_id: string;
  message: DiscordPersistedMessage;
}
