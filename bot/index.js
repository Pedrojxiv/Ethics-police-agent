import { Client, Events, GatewayIntentBits } from 'discord.js';

// Nome do header que o nó Webhook do n8n confere (credencial Header Auth).
const SECRET_HEADER = 'X-Moderation-Secret';
const REQUEST_TIMEOUT_MS = 10_000;

const { DISCORD_TOKEN, N8N_WEBHOOK_URL, N8N_WEBHOOK_SECRET } = process.env;

const missing = Object.entries({ DISCORD_TOKEN, N8N_WEBHOOK_URL, N8N_WEBHOOK_SECRET })
  .filter(([, value]) => !value)
  .map(([name]) => name);
if (missing.length > 0) {
  console.error(`Variáveis faltando no .env: ${missing.join(', ')}`);
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // intent privilegiado: ativar no Developer Portal
  ],
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Bot ouvinte conectado como ${readyClient.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
  // Só mensagens de membros humanos em servidores. Mensagens de outros bots
  // (inclusive deste) e de webhooks são ignoradas.
  if (message.author.bot || message.webhookId) return;
  if (!message.inGuild() || message.system) return;
  if (!message.content.trim()) return;

  const payload = {
    guildId: message.guildId,
    channelId: message.channelId,
    messageId: message.id,
    userId: message.author.id,
    username: message.author.username,
    content: message.content,
  };

  try {
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [SECRET_HEADER]: N8N_WEBHOOK_SECRET,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error(`n8n respondeu ${response.status} para a mensagem ${message.id}`);
    }
  } catch (error) {
    console.error(`Falha ao enviar a mensagem ${message.id} ao n8n: ${error.message}`);
  }
});

const shutdown = async () => {
  await client.destroy();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

client.login(DISCORD_TOKEN);
