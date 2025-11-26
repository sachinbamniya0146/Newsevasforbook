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
import { handleAdminCommand, updateActiveSessions } from './handlers/adminHandler.js';
import { initScheduler, stopScheduler } from './utils/scheduler.js';
import { getBulkSender } from './utils/bulkSender.js';
import CONFIG from './config.js';

// ==================== LOGGER ====================
const logger = {
  info: (msg) => console.log(`[${new Date().toLocaleTimeString('hi-IN')}] ℹ️  ${msg}`),
  success: (msg) => console.log(`[${new Date().toLocaleTimeString('hi-IN')}] ✅ ${msg}`),
  warn: (msg) => console.log(`[${new Date().toLocaleTimeString('hi-IN')}] ⚠️  ${msg}`),
  error: (msg) => console.log(`[${new Date().toLocaleTimeString('hi-IN')}] ❌ ${msg}`)
};

// ==================== GLOBALS ====================
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const sessions = new Map();
const retryMap = new Map();
const sessionStats = new Map();
const processedMessages = new Set();
let schedulerInitialized = false;
let autoReconnectEnabled = true;
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

function getMessageId(msg) {
  const from = msg.key?.remoteJid || '';
  const msgId = msg.key?.id || '';
  const timestamp = msg.messageTimestamp || Date.now();
  return `${from}_${msgId}_${timestamp}`;
}

function isMessageProcessed(messageId) {
  return processedMessages.has(messageId);
}

function markMessageProcessed(messageId) {
  processedMessages.add(messageId);
  
  if (processedMessages.size > 1000) {
    const arr = Array.from(processedMessages);
    processedMessages.clear();
    arr.slice(-500).forEach(id => processedMessages.add(id));
  }
}

// ==================== UPDATE BULK SENDER ====================
function updateBulkSenderSessions() {
  try {
    const bulkSender = getBulkSender();
    bulkSender.updateSessions(sessions);
    logger.success(`✅ Bulk sender updated with ${sessions.size} session(s)`);
  } catch (e) {
    logger.warn('Bulk sender update skipped');
  }
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

      if (mode === 'qr' && qr && !state.creds.registered) {
        console.log(`\n━━━━━━━━━━ SCAN QR [${name}] ━━━━━━━━━━`);
        qrcode.generate(qr, { small: true });
        console.log(`WhatsApp > Linked Devices > Scan QR\n`);
      }

      if ((mode === 'pair') && !pairingCodeAttempted && !state.creds.registered && phone) {
        if (connection === 'open' || connection === 'connecting') {
          pairingCodeAttempted = true;
          await delay(2500);
          try {
            const cleanPhone = normalizePhone(phone);
            if (!cleanPhone) throw new Error('Invalid phone number format');
            
            const code = await sock.requestPairingCode(cleanPhone);
            
            console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`📱 SESSION: ${name}`);
            console.log(`🔑 PAIRING CODE: ${code}`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

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

      if (connection === 'open') {
        logger.success(`✅ CONNECTED: ${name} at ${getTimestamp()}`);
        sessions.set(name, sock);
        retryMap.delete(name);
        
        sessionStats.set(name, {
          messagesReceived: 0,
          messagesHandled: 0,
          errors: 0,
          lastActivity: new Date(),
          connectedAt: new Date()
        });

        // Update admin handler with sessions
        updateActiveSessions(sessions);
        
        // Update bulk sender with sessions
        updateBulkSenderSessions();

        // Initialize Scheduler (only once)
        if (!schedulerInitialized && sessions.size === 1) {
          schedulerInitialized = true;
          try {
            initScheduler(sock);
            logger.success('✅ Scheduler initialized');
          } catch (e) {
            logger.error(`❌ Scheduler init error: ${e.message}`);
            schedulerInitialized = false;
          }
        }
        
        // Send startup notification
        try {
          const adminJid = CONFIG.ADMIN?.JID;
          if (adminJid) {
            const startupMsg = `🚀 *Bot Started*

Session: ${name}
Time: ${getTimestamp()}
Scheduler: ${schedulerInitialized ? '✅ Running' : '❌ Inactive'}
Bulk Sender: ✅ Ready

📊 Commands:
• help - Show all commands
• bulk status - Bulk sender status
• start bulk - Start bulk sender
• report - Order statistics`;
            await sock.sendMessage(adminJid, { text: startupMsg });
          }
        } catch (e) {
          logger.warn(`Could not send startup notification: ${e.message}`);
        }
      }

      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        const shouldRetry = code !== DisconnectReason.loggedOut;
        logger.warn(`[${name}] Disconnected: code=${code} at ${getTimestamp()}`);

        // Remove from sessions
        sessions.delete(name);
        updateActiveSessions(sessions);
        updateBulkSenderSessions();

        if (code === 401 || code === 515) {
          logger.error(`[${name}] Session invalid - delete ./sessions/${name} and reconnect`);
          sessionStats.delete(name);
          retryMap.delete(name);
        }
        else if (shouldRetry && autoReconnectEnabled) {
          const retries = retryMap.get(name) || 0;
          if (retries < 10) {
            retryMap.set(name, retries + 1);
            const delayTime = Math.min(3000 * (retries + 1), 30000);
            logger.info(`[${name}] Retry ${retries + 1}/10 in ${delayTime/1000}s...`);
            await delay(delayTime);
            connect(name, mode, phone);
          } else {
            logger.error(`[${name}] Max retries reached (10)`);
            sessionStats.delete(name);
            retryMap.delete(name);
          }
        }
        else {
          logger.error(`[${name}] Logged out from WhatsApp`);
          sessionStats.delete(name);
          retryMap.delete(name);
        }
      }
    });

    // SINGLE MESSAGE HANDLER - NO DUPLICATES
    sock.ev.on('messages.upsert', async ({ messages }) => {
      for (const m of messages) {
        try {
          if (!m.message || m.key.fromMe) continue;
          
          const messageId = getMessageId(m);
          
          if (isMessageProcessed(messageId)) {
            logger.warn(`⭕ Skipping duplicate message`);
            continue;
          }
          
          markMessageProcessed(messageId);
          
          const from = m.key?.remoteJid;
          const msgText = m.message?.conversation || m.message?.extendedTextMessage?.text || '';
          
          updateSessionStats(name, 'message_received');
          
          const isAdmin = CONFIG.ADMIN && from === CONFIG.ADMIN.JID;
          
          // Handle admin commands FIRST
          if (isAdmin && msgText.trim()) {
            const handled = await handleAdminCommand(sock, from, msgText, isAdmin);
            if (handled) {
              updateSessionStats(name, 'message_handled');
              continue;
            }
          }
          
          // Handle regular user messages
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
        await delay(3000);
      }
    }
    
    return restored;
  } catch (e) {
    logger.error('Auto-start error: ' + e.message);
    return 0;
  }
}

// ==================== MENU ====================
async function menu() {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🌟  ${CONFIG.BOT?.NAME || 'Gyan Ganga Seva Bot'}  🌟`);
  console.log(`Version ${CONFIG.BOT?.VERSION || '2.0.0'} | ${getTimestamp()}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📱 Sessions: ${sessions.size} | Messages: ${totalMessagesHandled}`);
  console.log(`⏰ Scheduler: ${schedulerInitialized ? '✅ Running' : '❌ Inactive'}`);
  console.log(`📤 Bulk Sender: ✅ Ready`);
  console.log(`🔄 Auto-Reconnect: ${autoReconnectEnabled ? '✅ ON' : '❌ OFF'}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`\n📋 MENU OPTIONS:\n`);
  console.log(`1️⃣  - Link WhatsApp (Pairing Code)`);
  console.log(`2️⃣  - Link WhatsApp (QR Code)`);
  console.log(`3️⃣  - Show Active Sessions`);
  console.log(`4️⃣  - Session Statistics`);
  console.log(`5️⃣  - Remove Session`);
  console.log(`6️⃣  - Toggle Auto-Reconnect`);
  console.log(`7️⃣  - Bulk Sender Status`);
  console.log(`0️⃣  - Exit Bot`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  const choice = await ask('👉 Enter choice: ');

  if (choice === '1') {
    const name = await ask('📝 Session name: ');
    if (!name || name.trim() === '') {
      logger.error('Invalid session name');
      return menu();
    }
    
    const phoneRaw = await ask('📞 Phone (919876543210): ');
    const phone = normalizePhone(phoneRaw);
    if (!phone || phone.length < 10) {
      logger.error('Invalid phone number');
      return menu();
    }
    
    logger.info(`Starting: ${name} (${phone})`);
    connect(name, 'pair', phone);
    console.log(`\n✅ Pairing code will appear in 3-5 seconds\n`);
    setTimeout(menu, 5000);
  }
  
  else if (choice === '2') {
    const name = await ask('📝 Session name: ');
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
    console.log(`Total Messages: ${totalMessagesHandled}`);
    console.log(`Active Sessions: ${sessions.size}\n`);
    
    for (const [name, stats] of sessionStats) {
      const uptime = stats.connectedAt ? Math.floor((Date.now() - stats.connectedAt.getTime()) / 1000 / 60) : 0;
      console.log(`📱 ${name}:`);
      console.log(`   Connected: ${uptime} minutes ago`);
      console.log(`   Received: ${stats.messagesReceived}`);
      console.log(`   Handled: ${stats.messagesHandled}`);
      console.log(`   Errors: ${stats.errors}`);
      console.log(`   Last: ${stats.lastActivity?.toLocaleString('hi-IN') || 'N/A'}\n`);
    }
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    setTimeout(menu, 1000);
  }
  
  else if (choice === '5') {
    const name = await ask('📝 Session to remove: ');
    if (sessions.has(name)) {
      sessions.delete(name);
      sessionStats.delete(name);
      updateActiveSessions(sessions);
      updateBulkSenderSessions();
      logger.success(`Removed session: ${name}`);
      console.log(`💡 Delete ./sessions/${name} folder to remove completely`);
    } else {
      logger.error(`Session not found: ${name}`);
    }
    setTimeout(menu, 1000);
  }
  
  else if (choice === '6') {
    autoReconnectEnabled = !autoReconnectEnabled;
    logger.success(`Auto-Reconnect ${autoReconnectEnabled ? 'ENABLED ✅' : 'DISABLED ❌'}`);
    setTimeout(menu, 1000);
  }
  
  else if (choice === '7') {
    try {
      const bulkSender = getBulkSender();
      const status = await bulkSender.getStatus();
      
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📤 BULK SENDER STATUS`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Status: ${status.running ? '🟢 Running' : '🔴 Stopped'}${status.paused ? ' (PAUSED)' : ''}`);
      console.log(`Business Hours: ${status.businessHours ? '🟢 Active' : '🔴 Inactive'}`);
      console.log(`Sessions: ${status.sessions}`);
      console.log(`Active Campaigns: ${status.activeCampaigns}`);
      console.log(`Queued: ${status.queuedCampaigns}`);
      console.log(`\n📊 Global Stats:`);
      console.log(`Total Sent: ${status.globalStats.totalSent}`);
      console.log(`Total Failed: ${status.globalStats.totalFailed}`);
      console.log(`Campaigns Completed: ${status.globalStats.campaignsCompleted}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    } catch (e) {
      logger.error(`Error getting bulk status: ${e.message}`);
    }
    setTimeout(menu, 1000);
  }
  
  else if (choice === '0') {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`👋 Exiting ${CONFIG.BOT?.NAME || 'Bot'}...`);
    console.log(`💾 ${sessions.size} session(s) saved`);
    console.log(`📨 Total messages: ${totalMessagesHandled}`);
    console.log(`⏰ Stopped: ${getTimestamp()}`);
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

// ==================== ERROR HANDLERS ====================
process.on('SIGINT', () => {
  console.log(`\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  logger.info('Bot stopping gracefully...');
  console.log(`💾 Saved ${sessions.size} session(s)`);
  console.log(`📨 Handled ${totalMessagesHandled} messages`);
  console.log(`⏰ Stopped: ${getTimestamp()}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  stopScheduler();
  process.exit(0);
});

process.on('uncaughtException', (e) => {
  if (!e.message.includes('Bad MAC') && 
      !e.message.includes('Connection Closed')) {
    logger.error(`Uncaught Exception: ${e.message}`);
  }
});

process.on('unhandledRejection', (e) => {
  if (e && e.message && 
      !e.message.includes('Bad MAC') && 
      !e.message.includes('Connection Closed')) {
    logger.error(`Unhandled Rejection: ${e.message}`);
  }
});
