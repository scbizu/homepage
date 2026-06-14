# homepage

我的手帐
# Discord publishing

The Discord integration exposes a Message Context Menu command:
`Apps -> Post`. It sends signed HTTP interactions to the
`workers/discord-interactions` Worker, persists the first image under
`public/images/channels/discord`, appends the event to a Gist, and triggers
the channel sync deployment workflow.

Configure Worker secrets with `wrangler secret put`:

- `DISCORD_PUBLIC_KEY`
- `DISCORD_APPLICATION_ID`
- `GITHUB_GIST_TOKEN`
- `GITHUB_REPO_DISPATCH_TOKEN`
- `GITHUB_CONTENT_TOKEN`

Configure `DISCORD_ALLOWED_GUILD_ID` and the GitHub/Gist variables in
`workers/discord-interactions/wrangler.jsonc`, then deploy the Worker and set
its `/interactions/discord` URL as the Discord Interaction Endpoint URL.

Register the global message command once:

```sh
DISCORD_APPLICATION_ID=... DISCORD_BOT_TOKEN=... bun run discord:register-command
```

The GitHub Actions repository also needs `DISCORD_GIST_RAW_URL`, pointing to
the raw `discord_message.jsonl` Gist file.
