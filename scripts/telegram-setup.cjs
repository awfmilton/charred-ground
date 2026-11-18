'use strict';
// One-time Telegram bot setup: registers the webhook (with its secret token), the command list,
// the chat menu button that opens the game, and the bot descriptions.
//
//   node scripts/telegram-setup.cjs            # apply, using .env / the environment
//   node scripts/telegram-setup.cjs --dry-run  # print the calls without sending them
//
// Needs TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET and PUBLIC_BASE_URL (the HTTPS origin that serves
// index.html and /api). Enabling the Main Mini App, its loading-screen icon and the /newapp short
// name are done in @BotFather by hand; they have no Bot API method.

const { loadProjectEnv } = require('./serve.cjs');
const { createBotApi, telegramConfig } = require('./telegram.cjs');

const COMMANDS = [
  { command: 'play', description: 'Open Charred Ground' },
  { command: 'help', description: 'How to play and invite friends' },
  { command: 'terms', description: 'Purchase terms' },
  { command: 'support', description: 'Help with the game' },
  { command: 'paysupport', description: 'Help with a Stars purchase' }
];

function plan(env) {
  const cfg = telegramConfig(env);
  const problems = [];
  if (!cfg.token) problems.push('TELEGRAM_BOT_TOKEN is not set.');
  if (!cfg.webhookSecret || !/^[A-Za-z0-9_-]{16,256}$/.test(cfg.webhookSecret)) problems.push('TELEGRAM_WEBHOOK_SECRET must be 16-256 characters of A-Z, a-z, 0-9, _ or -.');
  if (!/^https:\/\//.test(cfg.publicBaseUrl) && !cfg.testEnv) problems.push('PUBLIC_BASE_URL must be the https:// origin that serves the game.');
  const base = cfg.publicBaseUrl;
  return {
    cfg,
    problems,
    calls: [
      ['setWebhook', {
        url: `${base}/api/telegram/webhook`,
        secret_token: cfg.webhookSecret,
        allowed_updates: ['message', 'inline_query', 'pre_checkout_query'],
        drop_pending_updates: false
      }],
      ['setMyCommands', { commands: COMMANDS }],
      ['setChatMenuButton', { menu_button: { type: 'web_app', text: 'Play', web_app: { url: `${base}/` } } }],
      ['setMyShortDescription', { short_description: 'Turn-based 3D artillery for up to six commanders.' }],
      ['setMyDescription', { description: 'Charred Ground: aim, trust the wind and leave a crater. Play solo against AI or invite friends to a battle in any chat. Tap Play to start.' }]
    ]
  };
}

async function main() {
  loadProjectEnv();
  const dry = process.argv.includes('--dry-run');
  const { cfg, problems, calls } = plan(process.env);
  if (problems.length) {
    for (const p of problems) console.error('✗ ' + p);
    process.exitCode = 1;
    return;
  }
  const bot = createBotApi({ token: cfg.token, testEnv: cfg.testEnv });
  for (const [method, params] of calls) {
    const shown = method === 'setWebhook' ? { ...params, secret_token: '<hidden>' } : params;
    if (dry) {
      console.log(`[dry-run] ${method} ${JSON.stringify(shown)}`);
      continue;
    }
    await bot.call(method, params);
    console.log(`✓ ${method}`);
  }
  if (!dry) {
    const info = await bot.call('getWebhookInfo', {});
    console.log(`Webhook: ${info.url} (pending updates: ${info.pending_update_count}${info.last_error_message ? `, last error: ${info.last_error_message}` : ''})`);
  }
  console.log('\nStill to do by hand in @BotFather:');
  console.log('  1. /mybots → your bot → Bot Settings → Configure Mini App → Enable Mini App, URL ' + cfg.publicBaseUrl + '/');
  console.log('  2. In the same screen, upload the loading-screen icon and set the light/dark colours (#101713).');
  console.log('  3. /newapp → short name "play" (set TELEGRAM_APP_SHORT_NAME=play) for t.me/<bot>/play links.');
  console.log('  4. /setinline → enable inline mode (placeholder: "invite friends…") for in-chat invites.');
}

if (require.main === module) main().catch(e => { console.error(e.message); process.exitCode = 1; });
module.exports = { plan, COMMANDS };
