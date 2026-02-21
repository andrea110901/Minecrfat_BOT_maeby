const mineflayer = require('mineflayer');
const { Movements, pathfinder, GoalBlock } = require('mineflayer-pathfinder');
const express = require('express');
const config = require('./settings.json');

// --- Web server per Render ---
const app = express();
app.get('/', (req, res) => {
  res.send('Bot Minecraft online ✅');
});
app.listen(3000, () => {
  console.log('Web server Render attivo sulla porta 3000');
});

// --- Funzione per creare il bot ---
function createBot() {
  const bot = mineflayer.createBot({
    host: config.server.ip,
    port: config.server.port,
    username: config['bot-account'].username,
    password: config['bot-account'].password,
    auth: config['bot-account'].type,
    version: config.server.version
  });

  bot.loadPlugin(pathfinder);

  const mcData = require('minecraft-data')(bot.version);
  const defaultMove = new Movements(bot, mcData);
  bot.settings.colorsEnabled = false;

  let pendingPromise = Promise.resolve();

  function sendRegister(password) {
    return new Promise((resolve, reject) => {
      bot.chat(`/register ${password} ${password}`);
      bot.once('chat', (username, message) => {
        if (message.includes('successfully registered') || message.includes('already registered')) resolve();
        else reject(`Registration failed: ${message}`);
      });
    });
  }

  function sendLogin(password) {
    return new Promise((resolve, reject) => {
      bot.chat(`/login ${password}`);
      bot.once('chat', (username, message) => {
        if (message.includes('successfully logged in')) resolve();
        else reject(`Login failed: ${message}`);
      });
    });
  }

  bot.once('spawn', () => {
    console.log('[AfkBot] Bot connesso al server');

    if (config.utils['auto-auth'].enabled) {
      const password = config.utils['auto-auth'].password;
      pendingPromise = pendingPromise
        .then(() => sendRegister(password))
        .then(() => sendLogin(password))
        .catch(err => console.error('[ERROR]', err));
    }

    if (config.utils['chat-messages'].enabled) {
      const messages = config.utils['chat-messages'].messages;
      const delay = config.utils['chat-messages'].repeat ? config.utils['chat-messages']['repeat-delay'] : 0;

      if (config.utils['chat-messages'].repeat && delay > 0) {
        let i = 0;
        setInterval(() => {
          bot.chat(messages[i]);
          i = (i + 1) % messages.length;
        }, delay * 1000);
      } else {
        messages.forEach(msg => bot.chat(msg));
      }
    }

    if (config.position.enabled) {
      bot.pathfinder.setMovements(defaultMove);
      bot.pathfinder.setGoal(new GoalBlock(config.position.x, config.position.y, config.position.z));
    }

    if (config.utils['anti-afk'].enabled) {
      bot.setControlState('jump', true);
      if (config.utils['anti-afk'].sneak) bot.setControlState('sneak', true);
    }
  });

  if (config.utils['auto-reconnect']) {
    bot.on('end', () => setTimeout(createBot, config.utils['auto-reconnect-delay']));
  }

  bot.on('kicked', reason => console.log('[AfkBot] Kick:', reason));
  bot.on('error', err => console.log('[ERROR]', err.message));
  bot.on('death', () => console.log('[AfkBot] Il bot è morto e si è respawnato'));
  bot.on('goal_reached', () => console.log('[AfkBot] Goal raggiunto'));
}

// --- Avvio bot ---
createBot();
