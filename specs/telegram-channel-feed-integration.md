# Telegram Channel Feed Integration Spec

## Summary

- Add a channel-based ingestion architecture with Telegram as the first platform adapter.
- Store raw source events as per-platform JSONL streams under `data/channels/<platform>/messages.jsonl`.
- Parse lightweight inline markup, extract leading control tags, normalize into a shared `ChannelPost` model, then build generated homepage feed data.
- Keep v1 automatic rendering intentionally narrow: generated channel entries become `text` or `image` feed items.

## Key Changes

### Source architecture

- Introduce `src/channels/core/*` for shared channel abstractions and transformations.
- Introduce `src/channels/telegram/*` for Telegram-specific raw event types and normalization.
- Reserve sibling platform directories for `x`, `discord`, and `app`.
- Keep channel ingestion separate from `src/content/homepage.ts`; generated content flows through `src/content/generated/channels/*`.

### Raw event storage

- Store Telegram raw events in `data/channels/telegram/messages.jsonl`.
- Use one JSON object per line, append-only.
- Each line represents one Telegram update event with at least:
  - `schema_version`
  - `event_type`
  - `update_id`
  - `received_at`
  - `chat`
  - `message`
- Do not overwrite prior lines for edits; append edited events and resolve final state during sync.

### Shared content model

- Define `ChannelPlatform` as `"telegram" | "x" | "discord" | "app"`.
- Define `ChannelPost` as the normalized cross-platform post shape with `platform`, `externalId`, `threadId?`, `url?`, `publishedAt`, `editedAt?`, `author?`, `content`, `media`, and `metadata`.
- Define `ChannelMedia` for `image`, `video`, `link`, and `file`.

### Telegram normalization

- `src/channels/telegram/types.ts` defines Telegram raw event types for the JSONL schema used by the project.
- `src/channels/telegram/normalize.ts` exposes `normalizeTelegramEvent(event, options)`.
- Normalization rules:
  - `content = message.text ?? message.caption ?? ""`
  - `externalId = String(message.message_id)`
  - `threadId = message.media_group_id` when present
  - `publishedAt = message.date`
  - `editedAt = message.edit_date` when present
  - `media` maps supported Telegram media to shared `ChannelMedia`
  - skip events with neither content nor supported media

### Control tags and inline markup

- Support leading control tags only at the top of the message body.
- Parse tags from the initial contiguous tag block.
- Remove those control tags from the body before markup parsing.
- Use the first recognized leading tag as `meta.prefix`.
- Do not apply any fallback prefix when no tag is present.
- Do not remap tag values for presentation.
- Support inline markup syntax:
  - `<anno note="...">...</anno>`
  - `<highlight>...</highlight>`
  - `<link href="...">...</link>`
- No nested custom tags in v1.
- Malformed or unknown tags degrade to plain text.

### Feed generation

- Add shared feed builder in `src/channels/core/feed.ts`.
- Input: normalized `ChannelPost[]` plus markup parsing context.
- Output: homepage-compatible `FeedEntry[]` plus skipped diagnostics.
- Posts with at least one image become `image`; posts without images become `text`.
- `EntryMeta` should allow `prefix?: string`.
- `meta.source` should be platform-based display text such as `发表于 Telegram`.
- `meta.date` should be derived from `publishedAt`.
- `id` should be stable and platform-qualified.

### Sync pipeline

- Add `scripts/sync-telegram.ts` responsible for:
  - reading `data/channels/telegram/messages.jsonl`
  - parsing JSONL safely line by line
  - grouping events by `message_id`
  - selecting the latest effective state per message
  - normalizing each effective message into `ChannelPost`
  - extracting control tags
  - parsing markup
  - building homepage feed entries
  - writing generated output to `src/content/generated/channels/telegram-feed.json`

## Tests

- Unit tests for Telegram normalization, control tag extraction, markup parsing, feed building, and the JSONL sync flow.
