interface TelegramPhotoSize {
	file_id: string;
	file_unique_id: string;
	width: number;
	height: number;
	file_size?: number;
}

interface TelegramChat {
	id: number;
	title?: string;
	username?: string;
	type: "channel";
}

interface TelegramChannelMessage {
	message_id: number;
	date: number;
	edit_date?: number;
	text?: string;
	caption?: string;
	author_signature?: string;
	media_group_id?: string;
	chat?: TelegramChat;
	photo?: TelegramPhotoSize[];
}

interface TelegramWebhookUpdate {
	update_id: number;
	channel_post?: TelegramChannelMessage;
	edited_channel_post?: TelegramChannelMessage;
}

interface PersistResult {
	stored: boolean;
	duplicate: boolean;
}

interface GistResponse {
	files?: Record<string, { content?: string }>;
}

interface PersistedTelegramEvent {
	schema_version: 1;
	update_id: number;
	event_type: "channel_post" | "edited_channel_post";
	received_at: string;
	chat: {
		id: number | null;
		title?: string;
		username?: string;
		type: "channel";
	};
	message: TelegramChannelMessage;
}

type EnvLike = Env & {
	TELEGRAM_WEBHOOK_SECRET?: string;
	TELEGRAM_WEBHOOK_PATH?: string;
	GITHUB_GIST_ID?: string;
	GITHUB_GIST_TOKEN?: string;
	GITHUB_GIST_FILENAME?: string;
};

const defaultWebhookPath = "/webhooks/telegram";
const defaultGistFilename = "telegram_message.jsonl";
const githubApiBase = "https://api.github.com";

export default {
	async fetch(request: Request, env: EnvLike, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		const webhookPath = env.TELEGRAM_WEBHOOK_PATH || defaultWebhookPath;

		if (request.method === "GET" && url.pathname === "/healthz") {
			return json(
				{
					ok: true,
					service: "telegram-webhook",
				},
				200,
			);
		}

		if (url.pathname !== webhookPath) {
			return json({ ok: false, error: "not_found" }, 404);
		}

		if (request.method !== "POST") {
			return json({ ok: false, error: "method_not_allowed" }, 405, {
				Allow: "POST",
			});
		}

		if (!isAuthorized(request, env)) {
			return json({ ok: false, error: "unauthorized" }, 401);
		}

		let update: TelegramWebhookUpdate;

		try {
			update = (await request.json()) as TelegramWebhookUpdate;
		} catch {
			return json({ ok: false, error: "invalid_json" }, 400);
		}

		const acceptedUpdate = normalizeAcceptedUpdate(update);
		if (!acceptedUpdate) {
			return json({ ok: false, error: "unsupported_update" }, 400);
		}

		let persistResult: PersistResult = {
			stored: false,
			duplicate: false,
		};

		try {
			persistResult = await persistAcceptedUpdate(update, acceptedUpdate, env);
		} catch (error) {
			console.error("Failed to persist Telegram update", error);
			return json({ ok: false, error: "gist_persist_failed" }, 502);
		}

		ctx.waitUntil(
			logAcceptedUpdate({
				updateId: update.update_id,
				eventType: acceptedUpdate.eventType,
				messageId: acceptedUpdate.message.message_id,
			}),
		);

		return json(
			{
				ok: true,
				accepted: true,
				updateId: update.update_id,
				eventType: acceptedUpdate.eventType,
				messageId: acceptedUpdate.message.message_id,
				stored: persistResult.stored,
				duplicate: persistResult.duplicate,
			},
			202,
		);
	},
} satisfies ExportedHandler<EnvLike>;

function isAuthorized(request: Request, env: EnvLike): boolean {
	const expectedSecret = env.TELEGRAM_WEBHOOK_SECRET;
	if (!expectedSecret) {
		return true;
	}

	const actualSecret = request.headers.get("x-telegram-bot-api-secret-token");
	return actualSecret === expectedSecret;
}

function normalizeAcceptedUpdate(update: TelegramWebhookUpdate) {
	if (update.channel_post) {
		return {
			eventType: "channel_post" as const,
			message: update.channel_post,
		};
	}

	if (update.edited_channel_post) {
		return {
			eventType: "edited_channel_post" as const,
			message: update.edited_channel_post,
		};
	}

	return null;
}

async function persistAcceptedUpdate(
	update: TelegramWebhookUpdate,
	acceptedUpdate: NonNullable<ReturnType<typeof normalizeAcceptedUpdate>>,
	env: EnvLike,
): Promise<PersistResult> {
	if (!env.GITHUB_GIST_ID || !env.GITHUB_GIST_TOKEN) {
		return { stored: false, duplicate: false };
	}

	const gistFilename = env.GITHUB_GIST_FILENAME || defaultGistFilename;
	const gist = await fetchGist(env.GITHUB_GIST_ID, env.GITHUB_GIST_TOKEN);
	const currentContent = normalizeGistFileContent(gist.files?.[gistFilename]?.content);

	if (hasUpdateId(currentContent, update.update_id)) {
		return {
			stored: false,
			duplicate: true,
		};
	}

	const nextLine = JSON.stringify(toPersistedTelegramEvent(update, acceptedUpdate));
	const nextContent = currentContent ? `${currentContent}\n${nextLine}` : nextLine;
	await updateGistFile(env.GITHUB_GIST_ID, env.GITHUB_GIST_TOKEN, gistFilename, nextContent);

	return {
		stored: true,
		duplicate: false,
	};
}

async function fetchGist(gistId: string, token: string): Promise<GistResponse> {
	const response = await fetch(`${githubApiBase}/gists/${gistId}`, {
		method: "GET",
		headers: githubHeaders(token),
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch gist ${gistId}: ${response.status}`);
	}

	return (await response.json()) as GistResponse;
}

async function updateGistFile(gistId: string, token: string, filename: string, content: string) {
	const response = await fetch(`${githubApiBase}/gists/${gistId}`, {
		method: "PATCH",
		headers: githubHeaders(token),
		body: JSON.stringify({
			files: {
				[filename]: {
					content,
				},
			},
		}),
	});

	if (!response.ok) {
		throw new Error(`Failed to update gist ${gistId}: ${response.status}`);
	}
}

function githubHeaders(token: string): HeadersInit {
	return {
		accept: "application/vnd.github+json",
		authorization: `Bearer ${token}`,
		"content-type": "application/json; charset=utf-8",
		"x-github-api-version": "2022-11-28",
	};
}

function normalizeGistFileContent(content?: string): string {
	if (!content) {
		return "";
	}

	const trimmed = content.trim();
	if (!trimmed || trimmed === "{}") {
		return "";
	}

	return trimmed;
}

function hasUpdateId(content: string, updateId: number): boolean {
	if (!content) {
		return false;
	}

	return content.split("\n").some((line) => {
		try {
			const parsed = JSON.parse(line) as { update_id?: unknown };
			return parsed.update_id === updateId;
		} catch {
			return false;
		}
	});
}

function toPersistedTelegramEvent(
	update: TelegramWebhookUpdate,
	acceptedUpdate: NonNullable<ReturnType<typeof normalizeAcceptedUpdate>>,
): PersistedTelegramEvent {
	const chat = acceptedUpdate.message.chat;

	return {
		schema_version: 1,
		update_id: update.update_id,
		event_type: acceptedUpdate.eventType,
		received_at: new Date().toISOString(),
		chat: {
			id: chat?.id ?? null,
			title: chat?.title,
			username: chat?.username,
			type: "channel",
		},
		message: acceptedUpdate.message,
	};
}

async function logAcceptedUpdate(payload: {
	updateId: number;
	eventType: "channel_post" | "edited_channel_post";
	messageId: number;
}) {
	console.log("Accepted Telegram update", payload);
}

function json(body: unknown, status = 200, headers?: HeadersInit): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"content-type": "application/json; charset=utf-8",
			...headers,
		},
	});
}
