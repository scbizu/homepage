import type { AnnotatedSegment, FeedEntry, InlineToken, LineSegment } from "../../content/homepage";
import type { BuildChannelFeedResult, ChannelPlatform, ChannelPost } from "./types";
import { extractControlTags, type MarkupDocument, type MarkupNode } from "./markup";

export interface FeedBuildIssue {
  platform: ChannelPlatform;
  externalId: string;
  reason: string;
}

export interface FeedBuildContext {
  parseMarkup: (input: string) => MarkupDocument;
}

export type FeedBuildResult = BuildChannelFeedResult<FeedEntry>;

const platformSourceLabel: Record<ChannelPlatform, string> = {
  telegram: "发表于 Telegram",
  x: "发表于 X",
  discord: "发表于 Discord",
  app: "发表于 App",
};

export function buildChannelFeed(posts: ChannelPost[], context: FeedBuildContext): FeedBuildResult {
  const entries: FeedEntry[] = [];
  const skipped: FeedBuildIssue[] = [];

  for (const post of [...posts].sort((left, right) => right.publishedAt - left.publishedAt)) {
    const { tags, content } = extractControlTags(post.content);
    const prefix = tags[0];
    const document = context.parseMarkup(content);
    const lines = toLines(document);

    if (lines.length === 0 && !post.media.some((media) => media.kind === "image")) {
      skipped.push({
        platform: post.platform,
        externalId: post.externalId,
        reason: "empty_renderable_content",
      });
      continue;
    }

    const meta = {
      prefix,
      source: platformSourceLabel[post.platform],
      date: formatChineseDate(post.publishedAt),
    };

    const image = post.media.find((media) => media.kind === "image");

    if (image) {
      const plainText = plainTextFromDocument(document);
      entries.push({
        type: "image",
        id: `${post.platform}-${post.externalId}`,
        image: {
          src: image.url ?? "",
          alt: plainText || image.alt || "Telegram image",
          caption: plainText,
        },
        lines: lines.length > 0 ? lines : plainText ? [[plainText]] : [],
        meta,
      });
      continue;
    }

    entries.push({
      type: "text",
      id: `${post.platform}-${post.externalId}`,
      lines,
      meta,
    });
  }

  return { entries, skipped };
}

function toLines(document: MarkupDocument): LineSegment[][] {
  const rawLines = document.raw.length === 0 ? [""] : document.raw.split(/\r?\n/);
  const nodesByLine = splitNodesByNewline(document.nodes);

  return rawLines
    .map((_, index) => nodesByLine[index] ?? [])
    .map(nodesToLineSegments)
    .filter((line) => line.length > 0 && !(line.length === 1 && line[0] === ""));
}

function splitNodesByNewline(nodes: MarkupNode[]): MarkupNode[][] {
  const lines: MarkupNode[][] = [[]];

  for (const node of nodes) {
    if (node.type !== "text") {
      lines[lines.length - 1].push(node);
      continue;
    }

    const parts = node.value.split(/\r?\n/);
    parts.forEach((part, index) => {
      if (part) {
        lines[lines.length - 1].push({ type: "text", value: part });
      }

      if (index < parts.length - 1) {
        lines.push([]);
      }
    });
  }

  return lines;
}

function nodesToLineSegments(nodes: MarkupNode[]): LineSegment[] {
  const segments: LineSegment[] = [];

  for (const node of nodes) {
    if (node.type === "text") {
      segments.push(node.value);
      continue;
    }

    if (node.type === "anno") {
      const annotation: AnnotatedSegment = {
        type: "annotation",
        target: node.value,
        note: node.note,
        mode: "inline",
      };
      segments.push(annotation);
      continue;
    }

    const token: InlineToken =
      node.type === "highlight"
        ? { text: node.value, mark: "highlight" }
        : { text: node.value, mark: "plain", href: node.href };

    const previous = segments[segments.length - 1];
    if (Array.isArray(previous)) {
      previous.push(token);
    } else {
      segments.push([token]);
    }
  }

  return segments;
}

function plainTextFromDocument(document: MarkupDocument): string {
  return document.nodes
    .map((node) => {
      if (node.type === "anno" || node.type === "highlight" || node.type === "link") {
        return node.value;
      }

      return node.value;
    })
    .join("")
    .trim();
}

function formatChineseDate(unixSeconds: number): string {
  const formatter = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });

  const parts = formatter.formatToParts(new Date(unixSeconds * 1000));
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";

  return `${year}年${month}月${day}日`;
}
