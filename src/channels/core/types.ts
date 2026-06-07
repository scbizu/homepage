export type ChannelPlatform = "telegram" | "x" | "discord" | "app";

export interface ChannelAuthor {
  id?: string;
  name?: string;
  handle?: string;
}

export type ChannelMedia =
  | {
      kind: "image";
      sourceId?: string;
      url?: string;
      width?: number;
      height?: number;
      alt?: string;
    }
  | {
      kind: "video";
      sourceId?: string;
      url?: string;
      width?: number;
      height?: number;
    }
  | {
      kind: "link";
      url: string;
      title?: string;
    }
  | {
      kind: "file";
      sourceId?: string;
      url?: string;
      filename?: string;
      mimeType?: string;
    };

export interface ChannelPost {
  platform: ChannelPlatform;
  externalId: string;
  threadId?: string;
  url?: string;
  publishedAt: number;
  editedAt?: number;
  author?: ChannelAuthor;
  content: string;
  media: ChannelMedia[];
  metadata: Record<string, unknown>;
}

export interface BuildChannelFeedResult<TEntry> {
  entries: TEntry[];
  skipped: Array<{
    platform: ChannelPlatform;
    externalId: string;
    reason: string;
  }>;
}
