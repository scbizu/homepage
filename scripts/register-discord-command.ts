const applicationId = process.env.DISCORD_APPLICATION_ID;
const botToken = process.env.DISCORD_BOT_TOKEN;

if (!applicationId || !botToken) {
  throw new Error("DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN are required");
}

const response = await fetch(`https://discord.com/api/v10/applications/${applicationId}/commands`, {
  method: "POST",
  headers: {
    Authorization: `Bot ${botToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    name: "Post",
    type: 3,
    integration_types: [0],
    contexts: [0],
  }),
});

if (!response.ok) {
  throw new Error(`Failed to register Discord command: ${response.status} ${await response.text()}`);
}

const command = (await response.json()) as { id: string; name: string };
console.log(`Registered Discord command ${command.name} (${command.id})`);

export {};
