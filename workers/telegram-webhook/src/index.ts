interface TelegramPhotoSize {
	file_id: string;
	file_unique_id: string;
	width: number;
	height: number;
	file_size?: number;
	public_url?: string;
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
	TELEGRAM_BOT_TOKEN?: string;
	GITHUB_CONTENT_TOKEN?: string;
	GITHUB_GIST_ID?: string;
	GITHUB_GIST_TOKEN?: string;
	GITHUB_GIST_FILENAME?: string;
	GITHUB_REPO_OWNER?: string;
	GITHUB_REPO_NAME?: string;
	GITHUB_REPO_BRANCH?: string;
	GITHUB_REPO_DISPATCH_TOKEN?: string;
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
			return json(
				{
					ok: true,
					accepted: false,
					ignored: true,
					reason: "unsupported_update",
					updateId: update.update_id,
				},
				202,
			);
		}

		let persistResult: PersistResult = {
			stored: false,
			duplicate: false,
		};

		try {
			persistResult = await persistAcceptedUpdate(update, acceptedUpdate, env);
		} catch (error) {
			console.error("Failed to persist Telegram update", error);
			return json(
				{
					ok: false,
					error: "gist_persist_failed",
					detail: error instanceof Error ? error.message : "unknown_error",
				},
				502,
			);
		}

		ctx.waitUntil(
			Promise.all([
				logAcceptedUpdate({
					updateId: update.update_id,
					eventType: acceptedUpdate.eventType,
					messageId: acceptedUpdate.message.message_id,
				}),
				triggerRepositoryDispatch(update, acceptedUpdate, persistResult, env),
			]),
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

	const persistedMessage = await persistPhoto(acceptedUpdate.message, env);
	const nextLine = JSON.stringify(toPersistedTelegramEvent(update, acceptedUpdate, persistedMessage));
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
		const detail = await responseDetail(response);
		throw new Error(`Failed to fetch gist ${gistId}: ${response.status} ${detail}`.trim());
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
		const detail = await responseDetail(response);
		throw new Error(`Failed to update gist ${gistId}: ${response.status} ${detail}`.trim());
	}
}

function githubHeaders(token: string): HeadersInit {
	return {
		accept: "application/vnd.github+json",
		authorization: `Bearer ${token}`,
		"content-type": "application/json; charset=utf-8",
		"user-agent": "telegram-webhook-worker",
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
	message: TelegramChannelMessage = acceptedUpdate.message,
): PersistedTelegramEvent {
	const chat = message.chat;

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
		message,
	};
}

async function persistPhoto(message: TelegramChannelMessage, env: EnvLike): Promise<TelegramChannelMessage> {
	if (!message.photo || message.photo.length === 0) {
		return message;
	}

	if (
		!env.TELEGRAM_BOT_TOKEN ||
		!env.GITHUB_CONTENT_TOKEN ||
		!env.GITHUB_REPO_OWNER ||
		!env.GITHUB_REPO_NAME
	) {
		throw new Error("Telegram photo persistence is not configured");
	}

	const largest = [...message.photo].sort(
		(left, right) => right.width * right.height - left.width * left.height,
	)[0];
	const filePath = await getTelegramFilePath(largest.file_id, env.TELEGRAM_BOT_TOKEN);
	const imageResponse = await fetch(
		`https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${filePath}`,
	);
	if (!imageResponse.ok) {
		throw new Error(`Failed to download Telegram photo: ${imageResponse.status}`);
	}

	const extension = safeExtension(filePath);
	const repositoryPath =
		`public/images/channels/telegram/${message.message_id}-${largest.file_unique_id}.${extension}`;
	await putRepositoryFile(repositoryPath, await imageResponse.arrayBuffer(), env);
	const publicUrl = `/${repositoryPath.replace(/^public\//, "")}`;

	return {
		...message,
		photo: message.photo.map((photo) =>
			photo.file_id === largest.file_id ? { ...photo, public_url: publicUrl } : photo,
		),
	};
}

async function getTelegramFilePath(fileId: string, botToken: string): Promise<string> {
	const response = await fetch(
		`https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`,
	);
	if (!response.ok) {
		throw new Error(`Telegram getFile failed: ${response.status}`);
	}

	const data = (await response.json()) as { ok?: boolean; result?: { file_path?: string } };
	if (!data.ok || !data.result?.file_path) {
		throw new Error("Telegram getFile returned no file path");
	}
	return data.result.file_path;
}

async function putRepositoryFile(path: string, bytes: ArrayBuffer, env: EnvLike) {
	const branch = env.GITHUB_REPO_BRANCH || "main";
	const apiUrl = `${githubApiBase}/repos/${env.GITHUB_REPO_OWNER}/${env.GITHUB_REPO_NAME}/contents/${path}`;
	const headers = githubHeaders(env.GITHUB_CONTENT_TOKEN!);
	const encoded = toBase64(bytes);
	const existing = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}`, { headers });

	if (existing.ok) {
		const data = (await existing.json()) as { content?: string };
		if ((data.content ?? "").replace(/\s/g, "") === encoded) {
			return;
		}
		throw new Error(`Telegram image already exists with different content: ${path}`);
	}
	if (existing.status !== 404) {
		throw new Error(`Failed to inspect Telegram image: ${existing.status}`);
	}

	const response = await fetch(apiUrl, {
		method: "PUT",
		headers,
		body: JSON.stringify({
			message: `data: add Telegram image ${path.split("/").at(-1)}`,
			content: encoded,
			branch,
		}),
	});
	if (!response.ok) {
		throw new Error(`Failed to upload Telegram image: ${response.status}`);
	}
}

function safeExtension(filePath: string): string {
	const extension = filePath.split(".").at(-1)?.toLowerCase();
	return extension && /^[a-z0-9]{1,8}$/.test(extension) ? extension : "jpg";
}

function toBase64(bytes: ArrayBuffer): string {
	let binary = "";
	for (const byte of new Uint8Array(bytes)) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary);
}

async function logAcceptedUpdate(payload: {
	updateId: number;
	eventType: "channel_post" | "edited_channel_post";
	messageId: number;
}) {
	console.log("Accepted Telegram update", payload);
}

async function triggerRepositoryDispatch(
	update: TelegramWebhookUpdate,
	acceptedUpdate: NonNullable<ReturnType<typeof normalizeAcceptedUpdate>>,
	persistResult: PersistResult,
	env: EnvLike,
) {
	if (!persistResult.stored || persistResult.duplicate) {
		return;
	}

	if (!env.GITHUB_REPO_OWNER || !env.GITHUB_REPO_NAME || !env.GITHUB_REPO_DISPATCH_TOKEN) {
		return;
	}

	const response = await fetch(
		`${githubApiBase}/repos/${env.GITHUB_REPO_OWNER}/${env.GITHUB_REPO_NAME}/dispatches`,
		{
			method: "POST",
			headers: githubHeaders(env.GITHUB_REPO_DISPATCH_TOKEN),
			body: JSON.stringify({
				event_type: "telegram-sync",
				client_payload: {
					platform: "telegram",
					update_id: update.update_id,
					message_id: acceptedUpdate.message.message_id,
				},
			}),
		},
	);

	if (!response.ok) {
		const detail = await responseDetail(response);
		throw new Error(
			`Failed to dispatch GitHub workflow ${env.GITHUB_REPO_OWNER}/${env.GITHUB_REPO_NAME}: ${response.status} ${detail}`.trim(),
		);
	}
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

async function responseDetail(response: Response): Promise<string> {
	try {
		const data = (await response.json()) as { message?: unknown };
		if (typeof data.message === "string" && data.message.length > 0) {
			return data.message;
		}
	} catch {
	}

	return "";
}
