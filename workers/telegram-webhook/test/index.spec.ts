import {
	env,
	createExecutionContext,
	waitOnExecutionContext,
	SELF,
} from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../src";

afterEach(() => {
	vi.restoreAllMocks();
});

describe("telegram webhook worker", () => {
	it("responds to /healthz", async () => {
		const response = await SELF.fetch("http://example.com/healthz");

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({
			ok: true,
			service: "telegram-webhook",
		});
	});

	it("rejects requests with the wrong method", async () => {
		const response = await SELF.fetch("http://example.com/webhooks/telegram");

		expect(response.status).toBe(405);
		expect(response.headers.get("allow")).toBe("POST");
	});

	it("rejects unauthorized webhook calls when a secret is configured", async () => {
		const request = new Request("http://example.com/webhooks/telegram", {
			method: "POST",
			body: JSON.stringify({ update_id: 1 }),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(
			request,
			{ ...env, TELEGRAM_WEBHOOK_SECRET: "expected-secret" },
			ctx,
		);

		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(401);
	});

	it("rejects invalid JSON payloads", async () => {
		const request = new Request("http://example.com/webhooks/telegram", {
			method: "POST",
			headers: {
				"x-telegram-bot-api-secret-token": "expected-secret",
			},
			body: "{",
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(
			request,
			{ ...env, TELEGRAM_WEBHOOK_SECRET: "expected-secret" },
			ctx,
		);

		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({
			error: "invalid_json",
		});
	});

	it("surfaces a gist persistence error detail when gist storage fails", async () => {
		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					message: "Bad credentials",
				}),
				{ status: 401, headers: { "content-type": "application/json" } },
			),
		);

		const request = new Request("http://example.com/webhooks/telegram", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-telegram-bot-api-secret-token": "expected-secret",
			},
			body: JSON.stringify({
				update_id: 8,
				channel_post: {
					message_id: 200,
					date: 1780833600,
					text: "hello",
				},
			}),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(
			request,
			{
				...env,
				TELEGRAM_WEBHOOK_SECRET: "expected-secret",
				GITHUB_GIST_ID: "35f145e6898bd0c46977fe222a512ae1",
				GITHUB_GIST_TOKEN: "github-token",
				GITHUB_GIST_FILENAME: "telegram_message.jsonl",
			},
			ctx,
		);

		await waitOnExecutionContext(ctx);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(response.status).toBe(502);
		await expect(response.json()).resolves.toMatchObject({
			error: "gist_persist_failed",
			detail: "Failed to fetch gist 35f145e6898bd0c46977fe222a512ae1: 401 Bad credentials",
		});
	});

	it("acknowledges unsupported updates instead of returning 400", async () => {
		const request = new Request("http://example.com/webhooks/telegram", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-telegram-bot-api-secret-token": "expected-secret",
			},
			body: JSON.stringify({
				update_id: 9,
				message: {
					message_id: 999,
				},
			}),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(
			request,
			{ ...env, TELEGRAM_WEBHOOK_SECRET: "expected-secret" },
			ctx,
		);

		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(202);
		await expect(response.json()).resolves.toMatchObject({
			ok: true,
			accepted: false,
			ignored: true,
			reason: "unsupported_update",
			updateId: 9,
		});
	});

	it("accepts Telegram channel posts and returns an ack payload", async () => {
		const request = new Request<unknown, IncomingRequestCfProperties>(
			"http://example.com/webhooks/telegram",
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					"x-telegram-bot-api-secret-token": "expected-secret",
				},
				body: JSON.stringify({
					update_id: 10,
					channel_post: {
						message_id: 201,
						date: 1780833600,
						text: "hello",
					},
				}),
			},
		);
		const ctx = createExecutionContext();
		const response = await worker.fetch(
			request,
			{ ...env, TELEGRAM_WEBHOOK_SECRET: "expected-secret" },
			ctx,
		);

		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(202);
		await expect(response.json()).resolves.toMatchObject({
			ok: true,
			accepted: true,
			updateId: 10,
			eventType: "channel_post",
			messageId: 201,
		});
	});

	it("persists accepted updates into the configured gist JSONL file", async () => {
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						files: {
							"telegram_message.jsonl": {
								content: "",
							},
						},
					}),
					{ status: 200, headers: { "content-type": "application/json" } },
				),
			)
			.mockResolvedValueOnce(new Response(null, { status: 200 }));

		const request = new Request("http://example.com/webhooks/telegram", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-telegram-bot-api-secret-token": "expected-secret",
			},
			body: JSON.stringify({
				update_id: 11,
				channel_post: {
					message_id: 202,
					date: 1780833600,
					text: "hello gist",
				},
			}),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(
			request,
			{
				...env,
				TELEGRAM_WEBHOOK_SECRET: "expected-secret",
				GITHUB_GIST_ID: "35f145e6898bd0c46977fe222a512ae1",
				GITHUB_GIST_TOKEN: "github-token",
				GITHUB_GIST_FILENAME: "telegram_message.jsonl",
			},
			ctx,
		);

		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(202);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(fetchMock.mock.calls[0]?.[0]).toBe(
			"https://api.github.com/gists/35f145e6898bd0c46977fe222a512ae1",
		);
		expect(fetchMock.mock.calls[1]?.[0]).toBe(
			"https://api.github.com/gists/35f145e6898bd0c46977fe222a512ae1",
		);

		const patchInit = fetchMock.mock.calls[1]?.[1] as RequestInit;
		expect(patchInit.method).toBe("PATCH");
		expect(patchInit.headers).toMatchObject({
			authorization: "Bearer github-token",
			"user-agent": "telegram-webhook-worker",
		});
		const patchBody = JSON.parse(String(patchInit.body)) as {
			files: Record<string, { content: string }>;
		};
		expect(patchBody.files["telegram_message.jsonl"]?.content).toContain('"update_id":11');
	});

	it("does not patch the gist again when the update already exists", async () => {
		const existingLine = JSON.stringify({
			schema_version: 1,
			update_id: 12,
			event_type: "channel_post",
			received_at: "2026-06-07T09:00:00.000Z",
			chat: { id: -1001, type: "channel" },
			message: { message_id: 203, date: 1780833600, text: "hello again" },
		});
		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					files: {
						"telegram_message.jsonl": {
							content: existingLine,
						},
					},
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			),
		);

		const request = new Request("http://example.com/webhooks/telegram", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-telegram-bot-api-secret-token": "expected-secret",
			},
			body: JSON.stringify({
				update_id: 12,
				channel_post: {
					message_id: 203,
					date: 1780833600,
					text: "hello again",
				},
			}),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(
			request,
			{
				...env,
				TELEGRAM_WEBHOOK_SECRET: "expected-secret",
				GITHUB_GIST_ID: "35f145e6898bd0c46977fe222a512ae1",
				GITHUB_GIST_TOKEN: "github-token",
				GITHUB_GIST_FILENAME: "telegram_message.jsonl",
			},
			ctx,
		);

		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(202);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		await expect(response.json()).resolves.toMatchObject({
			stored: false,
			duplicate: true,
		});
	});

	it("triggers a GitHub repository dispatch after storing a new update", async () => {
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						files: {
							"telegram_message.jsonl": {
								content: "",
							},
						},
					}),
					{ status: 200, headers: { "content-type": "application/json" } },
				),
			)
			.mockResolvedValueOnce(new Response(null, { status: 200 }))
			.mockResolvedValueOnce(new Response(null, { status: 204 }));

		const request = new Request("http://example.com/webhooks/telegram", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-telegram-bot-api-secret-token": "expected-secret",
			},
			body: JSON.stringify({
				update_id: 13,
				channel_post: {
					message_id: 204,
					date: 1780833600,
					text: "dispatch me",
				},
			}),
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(
			request,
			{
				...env,
				TELEGRAM_WEBHOOK_SECRET: "expected-secret",
				GITHUB_GIST_ID: "35f145e6898bd0c46977fe222a512ae1",
				GITHUB_GIST_TOKEN: "github-token",
				GITHUB_GIST_FILENAME: "telegram_message.jsonl",
				GITHUB_REPO_OWNER: "scbizu",
				GITHUB_REPO_NAME: "homepage",
				GITHUB_REPO_DISPATCH_TOKEN: "dispatch-token",
			},
			ctx,
		);

		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(202);
		expect(fetchMock).toHaveBeenCalledTimes(3);
		expect(fetchMock.mock.calls[2]?.[0]).toBe("https://api.github.com/repos/scbizu/homepage/dispatches");
		expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({
			method: "POST",
			headers: expect.objectContaining({
				authorization: "Bearer dispatch-token",
				"user-agent": "telegram-webhook-worker",
			}),
		});
		const dispatchBody = JSON.parse(String((fetchMock.mock.calls[2]?.[1] as RequestInit).body)) as {
			event_type: string;
			client_payload: { platform: string; update_id: number; message_id: number };
		};
		expect(dispatchBody).toMatchObject({
			event_type: "telegram-sync",
			client_payload: {
				platform: "telegram",
				update_id: 13,
				message_id: 204,
			},
		});
	});
});
