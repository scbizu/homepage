interface DiscordAttachment {
  id: string;
  filename: string;
  content_type?: string;
  url: string;
  width?: number;
  height?: number;
}

interface DiscordMessage {
  id: string;
  content: string;
  webhook_id?: string;
  author: {
    id: string;
    username: string;
    global_name?: string | null;
    bot?: boolean;
  };
  attachments?: Record<string, DiscordAttachment> | DiscordAttachment[];
}

interface DiscordInteraction {
  id: string;
  application_id: string;
  token?: string;
  type: number;
  guild_id?: string;
  channel_id?: string;
  member?: { permissions?: string };
  data?: {
    type?: number;
    target_id?: string;
    resolved?: {
      messages?: Record<string, DiscordMessage>;
      attachments?: Record<string, DiscordAttachment>;
    };
  };
}

interface PersistedDiscordEvent {
  schema_version: 1;
  interaction_id: string;
  received_at: string;
  guild_id: string;
  channel_id: string;
  message: {
    id: string;
    content: string;
    author: {
      id: string;
      username: string;
      global_name?: string | null;
    };
    attachments: Array<{
      id: string;
      filename: string;
      content_type?: string;
      width?: number;
      height?: number;
      source_url: string;
      public_url?: string;
    }>;
  };
}

type EnvLike = Env & {
  DISCORD_PUBLIC_KEY?: string;
  DISCORD_APPLICATION_ID?: string;
  DISCORD_ALLOWED_GUILD_ID?: string;
  DISCORD_INTERACTIONS_PATH?: string;
  GITHUB_CONTENT_TOKEN?: string;
  GITHUB_GIST_ID?: string;
  GITHUB_GIST_TOKEN?: string;
  GITHUB_GIST_FILENAME?: string;
  GITHUB_REPO_OWNER?: string;
  GITHUB_REPO_NAME?: string;
  GITHUB_REPO_BRANCH?: string;
  GITHUB_REPO_DISPATCH_TOKEN?: string;
};

const administratorPermission = 0x8n;
const ephemeralFlag = 64;
const githubApiBase = "https://api.github.com";

export default {
  async fetch(request: Request, env: EnvLike, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = env.DISCORD_INTERACTIONS_PATH || "/interactions/discord";

    if (request.method === "GET" && url.pathname === "/healthz") {
      return json({ ok: true, service: "discord-interactions" });
    }
    if (url.pathname !== path) {
      return json({ ok: false, error: "not_found" }, 404);
    }
    if (request.method !== "POST") {
      return json({ ok: false, error: "method_not_allowed" }, 405, { Allow: "POST" });
    }

    const body = await request.text();
    if (!(await verifyDiscordRequest(request, body, env.DISCORD_PUBLIC_KEY))) {
      return json({ ok: false, error: "invalid_signature" }, 401);
    }

    let interaction: DiscordInteraction;
    try {
      interaction = JSON.parse(body) as DiscordInteraction;
    } catch {
      return json({ ok: false, error: "invalid_json" }, 400);
    }

    if (interaction.type === 1) {
      return json({ type: 1 });
    }

    const validation = validateMessageCommand(interaction, env);
    if (!validation.ok) {
      return interactionMessage(validation.message);
    }

    ctx.waitUntil(
      publishInteraction(interaction, validation.message, validation.attachments, env).catch(async (error) => {
        console.error(JSON.stringify({ event: "discord_publish_failed", interactionId: interaction.id, error: errorMessage(error) }));
        await updateOriginalResponse(interaction, env, `发布失败：${errorMessage(error)}`);
      }),
    );

    return json({
      type: 5,
      data: { flags: ephemeralFlag },
    });
  },
} satisfies ExportedHandler<EnvLike>;

async function verifyDiscordRequest(request: Request, body: string, publicKeyHex?: string): Promise<boolean> {
  const signatureHex = request.headers.get("x-signature-ed25519");
  const timestamp = request.headers.get("x-signature-timestamp");
  if (!publicKeyHex || !signatureHex || !timestamp) {
    return false;
  }

  try {
    const timestampSeconds = Number(timestamp);
    if (!Number.isFinite(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > 300) {
      return false;
    }
    const publicKey = await crypto.subtle.importKey(
      "raw",
      fromHex(publicKeyHex),
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    return crypto.subtle.verify(
      { name: "Ed25519" },
      publicKey,
      fromHex(signatureHex),
      new TextEncoder().encode(timestamp + body),
    );
  } catch {
    return false;
  }
}

function validateMessageCommand(
  interaction: DiscordInteraction,
  env: EnvLike,
):
  | { ok: false; message: string }
  | { ok: true; message: DiscordMessage; attachments: DiscordAttachment[] } {
  if (interaction.type !== 2 || interaction.data?.type !== 3) {
    return { ok: false, message: "不支持这个 Interaction。" };
  }
  if (env.DISCORD_APPLICATION_ID && interaction.application_id !== env.DISCORD_APPLICATION_ID) {
    return { ok: false, message: "这个 Interaction 不属于当前 Discord 应用。" };
  }
  if (!interaction.guild_id || !interaction.channel_id) {
    return { ok: false, message: "只能从 Discord 服务器频道发布。" };
  }
  if (env.DISCORD_ALLOWED_GUILD_ID && interaction.guild_id !== env.DISCORD_ALLOWED_GUILD_ID) {
    return { ok: false, message: "这个服务器不在允许发布的范围内。" };
  }
  if (!hasAdministratorPermission(interaction.member?.permissions)) {
    return { ok: false, message: "只有服务器管理员可以发布。" };
  }

  const targetId = interaction.data.target_id;
  const message = targetId ? interaction.data.resolved?.messages?.[targetId] : undefined;
  if (!message) {
    return { ok: false, message: "Discord 没有提供目标消息。" };
  }
  if (message.author.bot || message.webhook_id) {
    return { ok: false, message: "不能发布 Bot 或 Webhook 消息。" };
  }

  const attachments = Object.values(interaction.data.resolved?.attachments ?? message.attachments ?? {});
  const images = attachments.filter((attachment) => attachment.content_type?.startsWith("image/"));
  if (!message.content.trim() && images.length === 0) {
    return { ok: false, message: "这条消息没有可发布的正文或图片。" };
  }

  return { ok: true, message, attachments: images.slice(0, 1) };
}

function hasAdministratorPermission(permissions?: string): boolean {
  if (!permissions) return false;
  try {
    return (BigInt(permissions) & administratorPermission) === administratorPermission;
  } catch {
    return false;
  }
}

async function publishInteraction(
  interaction: DiscordInteraction,
  message: DiscordMessage,
  attachments: DiscordAttachment[],
  env: EnvLike,
) {
  assertPublishConfig(env);
  const persistedAttachments = [];

  for (const attachment of attachments) {
    const extension = safeExtension(attachment.filename, attachment.content_type);
    const path = `public/images/channels/discord/${message.id}-${attachment.id}.${extension}`;
    const bytes = await downloadAttachment(attachment.url);
    await putRepositoryFile(path, bytes, env);
    persistedAttachments.push({
      id: attachment.id,
      filename: attachment.filename,
      content_type: attachment.content_type,
      width: attachment.width,
      height: attachment.height,
      source_url: attachment.url,
      public_url: `/${path.replace(/^public\//, "")}`,
    });
  }

  const event: PersistedDiscordEvent = {
    schema_version: 1,
    interaction_id: interaction.id,
    received_at: new Date().toISOString(),
    guild_id: interaction.guild_id!,
    channel_id: interaction.channel_id!,
    message: {
      id: message.id,
      content: message.content,
      author: {
        id: message.author.id,
        username: message.author.username,
        global_name: message.author.global_name,
      },
      attachments: persistedAttachments,
    },
  };

  const stored = await appendGistEvent(event, env);
  if (stored) {
    await triggerRepositoryDispatch(event, env);
  }
  await updateOriginalResponse(interaction, env, stored ? "已发布到首页。" : "这次发布已经处理过。");
}

function assertPublishConfig(env: EnvLike): asserts env is EnvLike & Required<Pick<
  EnvLike,
  "GITHUB_CONTENT_TOKEN" | "GITHUB_GIST_ID" | "GITHUB_GIST_TOKEN" | "GITHUB_REPO_OWNER" | "GITHUB_REPO_NAME"
>> {
  const required = ["GITHUB_CONTENT_TOKEN", "GITHUB_GIST_ID", "GITHUB_GIST_TOKEN", "GITHUB_REPO_OWNER", "GITHUB_REPO_NAME"] as const;
  for (const key of required) {
    if (!env[key]) throw new Error(`missing_${key.toLowerCase()}`);
  }
}

async function downloadAttachment(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`attachment_download_failed_${response.status}`);
  return response.arrayBuffer();
}

async function putRepositoryFile(path: string, bytes: ArrayBuffer, env: EnvLike) {
  const apiUrl = `${githubApiBase}/repos/${env.GITHUB_REPO_OWNER}/${env.GITHUB_REPO_NAME}/contents/${path}`;
  const branch = env.GITHUB_REPO_BRANCH || "main";
  const headers = githubHeaders(env.GITHUB_CONTENT_TOKEN!, "discord-interactions-worker");
  const existing = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, { headers });

  if (existing.ok) {
    const data = (await existing.json()) as { content?: string };
    if (normalizeBase64(data.content) === toBase64(bytes)) return;
    throw new Error("repository_image_conflict");
  }
  if (existing.status !== 404) throw new Error(`repository_image_lookup_failed_${existing.status}`);

  const response = await fetch(apiUrl, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      message: `data: add Discord image ${path.split("/").at(-1)}`,
      content: toBase64(bytes),
      branch,
    }),
  });
  if (!response.ok) throw new Error(`repository_image_upload_failed_${response.status}`);
}

async function appendGistEvent(event: PersistedDiscordEvent, env: EnvLike): Promise<boolean> {
  const filename = env.GITHUB_GIST_FILENAME || "discord_message.jsonl";
  const headers = githubHeaders(env.GITHUB_GIST_TOKEN!, "discord-interactions-worker");
  const gistUrl = `${githubApiBase}/gists/${env.GITHUB_GIST_ID}`;
  const response = await fetch(gistUrl, { headers });
  if (!response.ok) throw new Error(`gist_fetch_failed_${response.status}`);
  const gist = (await response.json()) as { files?: Record<string, { content?: string }> };
  const content = normalizeGistContent(gist.files?.[filename]?.content);

  if (content.split("\n").some((line) => interactionIdFromLine(line) === event.interaction_id)) {
    return false;
  }

  const nextContent = content ? `${content}\n${JSON.stringify(event)}` : JSON.stringify(event);
  const patch = await fetch(gistUrl, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ files: { [filename]: { content: nextContent } } }),
  });
  if (!patch.ok) throw new Error(`gist_update_failed_${patch.status}`);
  return true;
}

async function triggerRepositoryDispatch(event: PersistedDiscordEvent, env: EnvLike) {
  if (!env.GITHUB_REPO_DISPATCH_TOKEN) return;
  const response = await fetch(
    `${githubApiBase}/repos/${env.GITHUB_REPO_OWNER}/${env.GITHUB_REPO_NAME}/dispatches`,
    {
      method: "POST",
      headers: githubHeaders(env.GITHUB_REPO_DISPATCH_TOKEN, "discord-interactions-worker"),
      body: JSON.stringify({
        event_type: "discord-sync",
        client_payload: {
          platform: "discord",
          interaction_id: event.interaction_id,
          message_id: event.message.id,
        },
      }),
    },
  );
  if (!response.ok) throw new Error(`repository_dispatch_failed_${response.status}`);
}

async function updateOriginalResponse(interaction: DiscordInteraction, env: EnvLike, content: string) {
  if (!interaction.token) return;
  const applicationId = env.DISCORD_APPLICATION_ID || interaction.application_id;
  await fetch(`https://discord.com/api/v10/webhooks/${applicationId}/${interaction.token}/messages/@original`, {
    method: "PATCH",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ content, flags: ephemeralFlag }),
  });
}

function interactionMessage(content: string): Response {
  return json({ type: 4, data: { content, flags: ephemeralFlag } });
}

function githubHeaders(token: string, userAgent: string): HeadersInit {
  return {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "content-type": "application/json; charset=utf-8",
    "user-agent": userAgent,
    "x-github-api-version": "2022-11-28",
  };
}

function safeExtension(filename: string, contentType?: string): string {
  const extension = filename.split(".").at(-1)?.toLowerCase();
  if (extension && /^[a-z0-9]{1,8}$/.test(extension)) return extension;
  return contentType?.split("/")[1]?.replace("jpeg", "jpg") || "bin";
}

function normalizeGistContent(content?: string): string {
  const trimmed = content?.trim() ?? "";
  return trimmed === "{}" ? "" : trimmed;
}

function interactionIdFromLine(line: string): string | undefined {
  try {
    return (JSON.parse(line) as { interaction_id?: string }).interaction_id;
  } catch {
    return undefined;
  }
}

function normalizeBase64(value?: string): string {
  return value?.replace(/\s/g, "") ?? "";
}

function toBase64(bytes: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromHex(value: string): Uint8Array {
  if (value.length % 2 !== 0) throw new Error("invalid_hex");
  return new Uint8Array(value.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? []);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown_error";
}

function json(body: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}
