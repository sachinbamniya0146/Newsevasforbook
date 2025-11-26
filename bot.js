import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  Browsers,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  delay
} from '@whiskeysockets/baileys';
import P from 'pino';
import readline from 'readline';
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import { handleMessage } from './handlers/messageHandler.js';
import { handleAdminCommand } from './handlers/adminHandler.js';
import { initScheduler, stopScheduler, getSchedulerStatus } from './utils/scheduler.js';
import CONFIG from './config.js';

// ==================== ENHANCED LOGGER ====================
const logger = {
  info: (msg) => console.log(`[${new Date().toLocaleTimeString('hi-IN')}] ℹ️  ${msg}`),
  success: (msg) => console.log(`[${new Date().toLocaleTimeString('hi-IN')}] ✅ ${msg}`),
  warn: (msg) => console.log(`[${new Date().toLocaleTimeString('hi-IN')}] ⚠️  ${msg}`),
  error: (msg) => console.log(`[${new Date().toLocaleTimeString('hi-IN')}] ❌ ${msg}`),
  debug: (msg) => console.log(`[${new Date().toLocaleTimeString('hi-IN')}] 🔍 ${msg}`)
};

// ==================== GLOBALS ====================
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const sessions = new Map();
const retryMap = new Map();
const sessionStats = new Map(); // Track stats per session
let schedulerInitialized = false;
let autoReconnectEnabled = true;
let backgroundMode = false;
let totalMessagesHandled = 0;

// ==================== UTILITY FUNCTIONS ====================
function ask(q) {
  return new Promise(r => rl.question(q, r));
}

function getTimestamp() {
  return new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}

function normalizePhone(phone) {
  if (!phone) return null;
  let cleaned = phone.toString().replace(/[^0-9]/g, '');
  cleaned = cleaned.replace(/^(\+|0+)/, '');
  if (cleaned.length < 10) return null;
  return cleaned;
}

function updateSessionStats(sessionName, action) {
  if (!sessionStats.has(sessionName)) {
    sessionStats.set(sessionName, {
      messagesReceived: 0,
      messagesHandled: 0,
      errors: 0,
      lastActivity: null,
      connectedAt: new Date()
    });
  }
  
  const stats = sessionStats.get(sessionName);
  
  if (action === 'message_received') stats.messagesReceived++;
  if (action === 'message_handled') {
    stats.messagesHandled++;
    totalMessagesHandled++;
  }
  if (action === 'error') stats.errors++;
  
  stats.lastActivity = new Date();
  sessionStats.set(sessionName, stats);
}

// ==================== HEALTH CHECK ====================
function performHealthCheck() {
  const health = {
    timestamp: getTimestamp(),
    activeSessions: sessions.size,
    schedulerRunning: schedulerInitialized,
    autoReconnect: autoReconnectEnabled,
    backgroundMode: backgroundMode,
    totalMessages: totalMessagesHandled,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    sessions: []
  };
  
  for (const [name, sock] of sessions) {
    const stats = sessionStats.get(name);
    health.sessions.push({
      name: name,
      phone: sock.user?.id?.split(':')[0] || 'Unknown',
      connected: sock.user ? true : false,
      stats: stats || {}
    });
  }
  
  return health;
}

// ==================== CONNECTION FUNCTION ====================
async function connect(name, mode, phone = null) {
  try {
    logger.info(`Connecting session: ${name} (mode: ${mode})`);
    
    const { state, saveCreds } = await useMultiFileAuthState('./sessions/' + name);
    const { version } = await fetchLatestBaileysVersion();
    
    const sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, P({ level: 'silent' }))
      },
      logger: P({ level: 'silent' }),
      browser: Browsers.macOS('Safari'),
      printQRInTerminal: false,
      syncFullHistory: false,
      markOnlineOnConnect: true,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 30000,
      getMessage: async (key) => {
        return { conversation: '' };
      }
    });

    let pairingCodeAttempted = false;

    sock.ev.on('creds.update', saveCreds);
    
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      // QR Code Mode
      if (mode === 'qr' && qr && !state.creds.registered) {
        if (!backgroundMode) {
          console.log(`\n━━━━━━━━━━ SCAN QR [${name}] ━━━━━━━━━━`);
          qrcode.generate(qr, { small: true });
          console.log(`WhatsApp > Linked Devices > Scan QR\n`);
        } else {
          logger.info(`QR code ready for ${name} (background mode)`);
        }
      }

      // Pairing Code Mode
      if ((mode === 'pair') && !pairingCodeAttempted && !state.creds.registered && phone) {
        if (connection === 'open' || connection === 'connecting') {
          pairingCodeAttempted = true;
          await delay(2500);
          try {
            const cleanPhone = normalizePhone(phone);
            if (!cleanPhone) {
              throw new Error('Invalid phone number format');
            }
            
            const code = await sock.requestPairingCode(cleanPhone);
            
            if (!backgroundMode) {
              console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
              console.log(`📱 SESSION: ${name}`);
              console.log(`🔑 PAIRING CODE: ${code}`);
              console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
              console.log(`Steps:`);
              console.log(`1. Open WhatsApp (${cleanPhone})`);
              console.log(`2. Settings > Linked Devices`);
              console.log(`3. Link with phone number`);
              console.log(`4. Enter: ${code}`);
              console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
            } else {
              logger.success(`Pairing code for ${name}: ${code}`);
            }

            try {
              const adminJid = CONFIG.ADMIN?.JID || '919174406375@s.whatsapp.net';
              const pairMessage = `🔐 *Pairing Code*\n\nSession: *${name}*\nPhone: ${cleanPhone}\nCode: \`${code}\`\n\nEnter this code in WhatsApp:\nSettings > Linked Devices > Link with Phone Number`;
              await sock.sendMessage(adminJid, { text: pairMessage });
            } catch (e) {
              logger.warn(`Could not forward pairing code: ${e.message}`);
            }
          } catch (e) {
            logger.error(`Pairing error: ${e.message}`);
          }
        }
      }

      // Connected Successfully
      if (connection === 'open') {
        logger.success(`✅ CONNECTED: ${name} at ${getTimestamp()}`);
        sessions.set(name, sock);
        retryMap.delete(name);
        
        // Initialize session stats
        sessionStats.set(name, {
          messagesReceived: 0,
          messagesHandled: 0,
          errors: 0,
          lastActivity: new Date(),
          connectedAt: new Date()
        });

        // Initialize Scheduler (only once)
        if (!schedulerInitialized && sessions.size === 1) {
          schedulerInitialized = true;
          try {
            initScheduler(sock);
            logger.success('✅ Scheduler initialized - Daily reports at 6:30 PM');
          } catch (e) {
            logger.error(`❌ Scheduler init error: ${e.message}`);
            schedulerInitialized = false;
          }
        }
        
        // Send startup notification to admin
        try {
          const adminJid = CONFIG.ADMIN?.JID;
          if (adminJid) {
            const startupMsg = `🚀 *Bot Started*\n\nSession: ${name}\nTime: ${getTimestamp()}\nScheduler: ${schedulerInitialized ? '✅ Running' : '❌ Inactive'}\n\n📊 Send "report" for statistics\n⚙️ Send "help" for commands`;
            await sock.sendMessage(adminJid, { text: startupMsg });
          }
        } catch (e) {
          logger.debug(`Could not send startup notification: ${e.message}`);
        }
      }

      // Disconnected
      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        const shouldRetry = code !== DisconnectReason.loggedOut;
        logger.warn(`[${name}] Disconnected: code=${code} at ${getTimestamp()}`);

        if (code === 401) {
          logger.error(`[${name}] 401 - Session invalid/expired`);
          logger.info(`❌ Delete ./sessions/${name} folder and reconnect`);
          sessions.delete(name);
          sessionStats.delete(name);
          retryMap.delete(name);
        }
        else if (code === 515) {
          logger.warn(`[${name}] 515 - Need to restart (probably logged out)`);
          sessions.delete(name);
          sessionStats.delete(name);
          retryMap.delete(name);
        }
        else if (shouldRetry && autoReconnectEnabled) {
          const retries = retryMap.get(name) || 0;
          if (retries < 10) {
            retryMap.set(name, retries + 1);
            const delayTime = Math.min(3000 * (retries + 1), 30000); // Max 30s
            logger.info(`[${name}] Retry ${retries + 1}/10 in ${delayTime/1000}s...`);
            await delay(delayTime);
            connect(name, mode, phone);
          } else {
            logger.error(`[${name}] Max retries reached (10)`);
            sessions.delete(name);
            sessionStats.delete(name);
            retryMap.delete(name);
          }
        }
        else {
          logger.error(`[${name}] Logged out from WhatsApp`);
          sessions.delete(name);
          sessionStats.delete(name);
          retryMap.delete(name);
        }
      }
    });

    // Message Handler with Stats
    sock.ev.on('messages.upsert', async ({ messages }) => {
      for (const m of messages) {
        if (!m.message || m.key.fromMe) continue;
        
        const from = m.key.remoteJid;
        const msgText = m.message?.conversation || m.message?.extendedTextMessage?.text || '';
        
        updateSessionStats(name, 'message_received');
        
        try {
          const isAdmin = CONFIG.ADMIN && from === CONFIG.ADMIN.JID;
          
          // Handle admin commands first
          if (isAdmin) {
            const handled = await handleAdminCommand(sock, from, msgText, isAdmin);
            if (handled) {
              updateSessionStats(name, 'message_handled');
              continue;
            }
          }
          
          // Handle regular messages
          await handleMessage(sock, m, name);
          updateSessionStats(name, 'message_handled');
          
        } catch (e) {
          logger.error(`[${name}] Message error: ${e.message}`);
          updateSessionStats(name, 'error');
        }
      }
    });

  } catch (e) {
    logger.error(`[${name}] Connection error: ${e.message}`);
  }
}

// ==================== AUTO-START ====================
async function autoStartAll() {
  try {
    if (!fs.existsSync('./sessions')) {
      fs.mkdirSync('./sessions', { recursive: true });
      logger.info('Created sessions directory');
      return 0;
    }
    
    const dirs = fs.readdirSync('./sessions');
    let restored = 0;
    
    for (const dir of dirs) {
      const credsPath = `./sessions/${dir}/creds.json`;
      if (fs.existsSync(credsPath)) {
        logger.info(`🔄 Restoring: ${dir}`);
        connect(dir, 'qr');
        restored++;
        await delay(3000); // Increased delay for stability
      }
    }
    
    return restored;
  } catch (e) {
    logger.error('Auto-start error: ' + e.message);
    return 0;
  }
}

// ==================== ENHANCED MENU ====================
async function menu() {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🌟  ${CONFIG.BOT?.NAME || 'Gyan Ganga Seva Bot'}  🌟`);
  console.log(`Version ${CONFIG.BOT?.VERSION || '2.0.0'} | ${getTimestamp()}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📱 Active Sessions: ${sessions.size} | Messages: ${totalMessagesHandled}`);
  console.log(`⏰ Scheduler: ${schedulerInitialized ? '✅ Running' : '❌ Inactive'}`);
  console.log(`🔄 Auto-Reconnect: ${autoReconnectEnabled ? '✅ ON' : '❌ OFF'}`);
  console.log(`🖥️  Background Mode: ${backgroundMode ? '✅ ON' : '❌ OFF'}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`\n📋 MENU OPTIONS:\n`);
  console.log(`1️⃣  - Link WhatsApp (Pairing Code)`);
  console.log(`2️⃣  - Link WhatsApp (QR Code)`);
  console.log(`3️⃣  - Show Active Sessions`);
  console.log(`4️⃣  - Session Statistics`);
  console.log(`5️⃣  - Remove Session`);
  console.log(`6️⃣  - Scheduler Status`);
  console.log(`7️⃣  - System Health Check`);
  console.log(`8️⃣  - Toggle Auto-Reconnect`);
  console.log(`9️⃣  - Toggle Background Mode`);
  console.log(`🔄 - Restart All Sessions`);
  console.log(`0️⃣  - Exit Bot`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  const choice = await ask('👉 Enter choice: ');

  if (choice === '1') {
    const name = await ask('📝 Session name (wa1, wa2...): ');
    if (!name || name.trim() === '') {
      logger.error('Invalid session name');
      return menu();
    }
    
    const phoneRaw = await ask('📞 Phone (919876543210): ');
    const phone = normalizePhone(phoneRaw);
    if (!phone || phone.length < 10) {
      logger.error('Invalid phone number (min 10 digits)');
      return menu();
    }
    
    logger.info(`Starting: ${name} (${phone})`);
    connect(name, 'pair', phone);
    console.log(`\n✅ Pairing code will appear in 3-5 seconds\n`);
    setTimeout(menu, 5000);
  }
  
  else if (choice === '2') {
    const name = await ask('📝 Session name (wa1, wa2...): ');
    if (!name || name.trim() === '') {
      logger.error('Invalid session name');
      return menu();
    }
    
    logger.info(`Starting QR: ${name}`);
    connect(name, 'qr');
    console.log(`\n✅ QR code will appear in 3-5 seconds\n`);
    setTimeout(menu, 5000);
  }
  
  else if (choice === '3') {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📊 ACTIVE SESSIONS: ${sessions.size}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    if (sessions.size === 0) {
      console.log('❌ No active sessions');
    } else {
      let i = 1;
      for (const [name, sock] of sessions) {
        const jid = sock.user?.id || 'Unknown';
        const phone = jid.split(':')[0];
        const stats = sessionStats.get(name);
        console.log(`\n${i}. ${name} - ${phone}`);
        if (stats) {
          console.log(`   📨 Received: ${stats.messagesReceived}`);
          console.log(`   ✅ Handled: ${stats.messagesHandled}`);
          console.log(`   ⏰ Last: ${stats.lastActivity?.toLocaleTimeString('hi-IN') || 'N/A'}`);
        }
        i++;
      }
    }
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    setTimeout(menu, 1000);
  }
  
  else if (choice === '4') {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📊 SESSION STATISTICS`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Total Messages Handled: ${totalMessagesHandled}`);
    console.log(`Active Sessions: ${sessions.size}\n`);
    
    for (const [name, stats] of sessionStats) {
      const uptime = stats.connectedAt ? Math.floor((Date.now() - stats.connectedAt.getTime()) / 1000 / 60) : 0;
      console.log(`📱 ${name}:`);
      console.log(`   Connected: ${uptime} minutes ago`);
      console.log(`   Messages Received: ${stats.messagesReceived}`);
      console.log(`   Messages Handled: ${stats.messagesHandled}`);
      console.log(`   Errors: ${stats.errors}`);
      console.log(`   Last Activity: ${stats.lastActivity?.toLocaleString('hi-IN') || 'N/A'}\n`);
    }
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    setTimeout(menu, 1000);
  }
  
  else if (choice === '5') {
    const name = await ask('📝 Session to remove: ');
    if (sessions.has(name)) {
      sessions.delete(name);
      sessionStats.delete(name);
      logger.success(`Removed session: ${name}`);
      console.log(`💡 Delete ./sessions/${name} folder to remove completely`);
    } else {
      logger.error(`Session not found: ${name}`);
    }
    setTimeout(menu, 1000);
  }
  
  else if (choice === '6') {
    const status = getSchedulerStatus();
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`⏰ SCHEDULER STATUS\n`);
    console.log(`Running: ${status.running ? '✅ Yes' : '❌ No'}`);
    console.log(`Socket Connected: ${status.socketConnected ? '✅ Yes' : '❌ No'}`);
    console.log(`Next Run: ${status.nextRun}`);
    console.log(`Schedule: Daily at 6:30 PM IST`);
    console.log(`Admin: ${CONFIG.ADMIN?.JID || 'Not configured'}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    setTimeout(menu, 1000);
  }
  
  else if (choice === '7') {
    const health = performHealthCheck();
    const uptimeHours = Math.floor(health.uptime / 3600);
    const uptimeMinutes = Math.floor((health.uptime % 3600) / 60);
    
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🏥 SYSTEM HEALTH CHECK\n`);
    console.log(`⏰ Time: ${health.timestamp}`);
    console.log(`🕐 Uptime: ${uptimeHours}h ${uptimeMinutes}m`);
    console.log(`📱 Active Sessions: ${health.activeSessions}`);
    console.log(`📨 Total Messages: ${health.totalMessages}`);
    console.log(`⏰ Scheduler: ${health.schedulerRunning ? '✅ Running' : '❌ Inactive'}`);
    console.log(`🔄 Auto-Reconnect: ${health.autoReconnect ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`🖥️  Background Mode: ${health.backgroundMode ? '✅ ON' : '❌ OFF'}`);
    console.log(`💾 Memory: ${Math.round(health.memory.heapUsed / 1024 / 1024)}MB / ${Math.round(health.memory.heapTotal / 1024 / 1024)}MB`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    setTimeout(menu, 1000);
  }
  
  else if (choice === '8') {
    autoReconnectEnabled = !autoReconnectEnabled;
    logger.success(`Auto-Reconnect ${autoReconnectEnabled ? 'ENABLED ✅' : 'DISABLED ❌'}`);
    setTimeout(menu, 1000);
  }
  
  else if (choice === '9') {
    backgroundMode = !backgroundMode;
    logger.success(`Background Mode ${backgroundMode ? 'ENABLED ✅' : 'DISABLED ❌'}`);
    if (backgroundMode) {
      console.log(`💡 Bot will run silently. Check logs for activity.`);
    }
    setTimeout(menu, 1000);
  }
  
  else if (choice === 'restart' || choice === 'r') {
    logger.info('Restarting all sessions...');
    const sessionNames = Array.from(sessions.keys());
    
    // Close all sessions
    for (const name of sessionNames) {
      sessions.delete(name);
      sessionStats.delete(name);
      logger.info(`Closed: ${name}`);
    }
    
    // Restart after delay
    await delay(2000);
    const restored = await autoStartAll();
    logger.success(`Restarted ${restored} session(s)`);
    setTimeout(menu, 3000);
  }
  
  else if (choice === '0') {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`👋 Exiting ${CONFIG.BOT?.NAME || 'Bot'}...`);
    console.log(`💾 ${sessions.size} session(s) saved`);
    console.log(`📨 Total messages handled: ${totalMessagesHandled}`);
    console.log(`⏰ Stopped at: ${getTimestamp()}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    stopScheduler();
    process.exit(0);
  }
  
  else {
    logger.error('Invalid choice');
    setTimeout(menu, 500);
  }
}

// ==================== MAIN ====================
(async () => {
  console.clear();
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🚀 ${CONFIG.BOT?.NAME || 'Gyan Ganga Seva Bot'}`);
  console.log(`📦 Version: ${CONFIG.BOT?.VERSION || '2.0.0'}`);
  console.log(`⏰ Started: ${getTimestamp()}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  logger.info('Initializing bot...');
  
  const restored = await autoStartAll();
  
  if (restored > 0) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    logger.success(`Restored ${restored} session(s)`);
    logger.info('Daily reports scheduled at 6:30 PM IST');
    logger.info(`Admin: ${CONFIG.ADMIN?.JID || 'Not configured'}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  } else {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    logger.warn('No saved sessions found');
    logger.info('Link your first WhatsApp account from menu');
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  }

  await delay(1000);
  menu();
})();

// ==================== ENHANCED ERROR HANDLERS ====================
process.on('SIGINT', () => {
  console.log(`\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  logger.info('Bot stopping gracefully...');
  console.log(`💾 Saved ${sessions.size} session(s)`);
  console.log(`📨 Handled ${totalMessagesHandled} messages`);
  console.log(`⏰ Stopped at: ${getTimestamp()}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  stopScheduler();
  process.exit(0);
});

process.on('uncaughtException', (e) => {
  if (!e.message.includes('Bad MAC') && 
      !e.message.includes('Connection Closed') &&
      !e.message.includes('Stream Errored')) {
    logger.error(`Uncaught Exception: ${e.message}`);
  }
});

process.on('unhandledRejection', (e) => {
  if (e && e.message && 
      !e.message.includes('Bad MAC') && 
      !e.message.includes('Connection Closed') &&
      !e.message.includes('Stream Errored')) {
    logger.error(`Unhandled Rejection: ${e.message}`);
  }
});

// Keep alive for 24/7 operation
setInterval(() => {
  if (sessions.size === 0 && autoReconnectEnabled && !backgroundMode) {
    logger.warn('No active sessions - consider linking a WhatsApp account');
  }
}, 30 * 60 * 1000); // Every 30 minutes
