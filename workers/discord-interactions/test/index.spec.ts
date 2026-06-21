import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import worker from "../src";

let privateKey: CryptoKey;
let publicKeyHex: string;
const allowedGuildId = "733013633336082543";

beforeAll(async () => {
  const keys = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  privateKey = keys.privateKey;
  publicKeyHex = toHex(await crypto.subtle.exportKey("raw", keys.publicKey));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("discord interactions worker", () => {
  it("verifies and responds to Discord PING", async () => {
    const response = await sendInteraction({ type: 1 });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ type: 1 });
  });

  it("rejects requests with an invalid signature", async () => {
    const response = await worker.fetch(
      new Request("http://example.com/interactions/discord", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-signature-ed25519": "00".repeat(64),
          "x-signature-timestamp": String(Math.floor(Date.now() / 1000)),
        },
        body: JSON.stringify({ type: 1 }),
      }),
      { ...env, DISCORD_PUBLIC_KEY: publicKeyHex },
      createExecutionContext(),
    );
    expect(response.status).toBe(401);
  });

  it("rejects signed requests with an expired timestamp", async () => {
    const body = JSON.stringify({ type: 1 });
    const timestamp = String(Math.floor(Date.now() / 1000) - 301);
    const signature = await crypto.subtle.sign(
      { name: "Ed25519" },
      privateKey,
      new TextEncoder().encode(timestamp + body),
    );
    const response = await worker.fetch(
      new Request("http://example.com/interactions/discord", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-signature-ed25519": toHex(signature),
          "x-signature-timestamp": timestamp,
        },
        body,
      }),
      { ...env, DISCORD_PUBLIC_KEY: publicKeyHex },
      createExecutionContext(),
    );
    expect(response.status).toBe(401);
  });

  it("rejects non-administrators with an ephemeral response", async () => {
    const response = await sendInteraction(messageInteraction({ permissions: "0" }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      type: 4,
      data: { flags: 64 },
    });
  });

  it("rejects interactions from another guild", async () => {
    const response = await sendInteraction(messageInteraction({ guildId: "other" }), {
      DISCORD_ALLOWED_GUILD_ID: "allowed",
    });
    await expect(response.json()).resolves.toMatchObject({
      type: 4,
      data: { content: expect.stringContaining("服务器") },
    });
  });

  it("rejects interactions for another application", async () => {
    const response = await sendInteraction(messageInteraction(), {
      DISCORD_APPLICATION_ID: "different-application",
    });
    await expect(response.json()).resolves.toMatchObject({
      type: 4,
      data: { content: expect.stringContaining("应用") },
    });
  });

  it("publishes text and the first image, then dispatches a sync", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "Not Found" }), { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ content: { sha: "image-sha" } }), { status: 201 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ files: { "discord_message.jsonl": { content: "" } } }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    const response = await sendInteraction(
      messageInteraction({
        content: "hello",
        attachments: {
          "400": {
            id: "400",
            filename: "photo.png",
            content_type: "image/png",
            url: "https://cdn.discordapp.com/photo.png",
            width: 1200,
            height: 800,
          },
        },
      }),
      githubEnv(),
    );
    const ctx = lastContext;

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ type: 5, data: { flags: 64 } });
    await waitOnExecutionContext(ctx);

    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/contents/public/images/channels/discord/"))).toBe(true);
    const gistPatch = fetchMock.mock.calls.find(
      ([url, init]) => String(url).includes("/gists/") && (init as RequestInit)?.method === "PATCH",
    );
    const gistPatchBody = JSON.parse(String(gistPatch?.[1]?.body)) as {
      files: Record<string, { content: string }>;
    };
    expect(JSON.parse(gistPatchBody.files["discord_message.jsonl"].content)).toMatchObject({
      interaction_id: "interaction-1",
    });
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/dispatches"))).toBe(true);
  });

  it("does not append or dispatch a duplicate interaction", async () => {
    const existing = JSON.stringify({
      schema_version: 1,
      interaction_id: "interaction-1",
      message: { id: "300" },
    });
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ files: { "discord_message.jsonl": { content: existing } } }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    const response = await sendInteraction(messageInteraction(), {
      ...githubEnv(),
      GITHUB_CONTENT_TOKEN: "content-token",
    });
    await waitOnExecutionContext(lastContext);

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls.some(([, init]) => (init as RequestInit)?.method === "PATCH" && String(init?.body).includes("files"))).toBe(false);
  });

  it("does not publish empty or bot-authored messages", async () => {
    const empty = await sendInteraction(messageInteraction({ content: "" }));
    await expect(empty.json()).resolves.toMatchObject({ type: 4, data: { flags: 64 } });

    const bot = await sendInteraction(messageInteraction({ bot: true }));
    await expect(bot.json()).resolves.toMatchObject({ type: 4, data: { flags: 64 } });
  });
});

let lastContext: ExecutionContext;

async function sendInteraction(payload: unknown, overrides: Record<string, string> = {}) {
  const body = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = await crypto.subtle.sign(
    { name: "Ed25519" },
    privateKey,
    new TextEncoder().encode(timestamp + body),
  );
  lastContext = createExecutionContext();
  return worker.fetch(
    new Request("http://example.com/interactions/discord", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-signature-ed25519": toHex(signature),
        "x-signature-timestamp": timestamp,
      },
      body,
    }),
    { ...env, DISCORD_PUBLIC_KEY: publicKeyHex, ...overrides },
    lastContext,
  );
}

function messageInteraction(options: {
  permissions?: string;
  guildId?: string;
  content?: string;
  attachments?: Record<string, unknown>;
  bot?: boolean;
} = {}) {
  return {
    id: "interaction-1",
    application_id: "application-1",
    type: 2,
    guild_id: options.guildId ?? allowedGuildId,
    channel_id: "200",
    member: { permissions: options.permissions ?? "8" },
    data: {
      type: 3,
      target_id: "300",
      resolved: {
        messages: {
          "300": {
            id: "300",
            content: options.content ?? "hello",
            author: {
              id: "author-1",
              username: "nace",
              global_name: "Nace",
              bot: options.bot,
            },
            attachments: options.attachments ?? {},
          },
        },
        attachments: options.attachments ?? {},
      },
    },
  };
}

function githubEnv() {
  return {
    DISCORD_APPLICATION_ID: "application-1",
    GITHUB_CONTENT_TOKEN: "content-token",
    GITHUB_GIST_ID: "gist-id",
    GITHUB_GIST_TOKEN: "gist-token",
    GITHUB_GIST_FILENAME: "discord_message.jsonl",
    GITHUB_REPO_OWNER: "scbizu",
    GITHUB_REPO_NAME: "homepage",
    GITHUB_REPO_BRANCH: "main",
    GITHUB_REPO_DISPATCH_TOKEN: "dispatch-token",
  };
}

function toHex(value: ArrayBuffer): string {
  return [...new Uint8Array(value)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
