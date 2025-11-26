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
const processedMessages = new Set(); // 🔥 DUPLICATE MESSAGE PREVENTION
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

// 🔥 CREATE UNIQUE MESSAGE ID
function getMessageId(msg) {
  const from = msg.key?.remoteJid || '';
  const msgId = msg.key?.id || '';
  const timestamp = msg.messageTimestamp || Date.now();
  return `${from}_${msgId}_${timestamp}`;
}

// 🔥 CHECK IF MESSAGE ALREADY PROCESSED
function isMessageProcessed(messageId) {
  return processedMessages.has(messageId);
}

// 🔥 MARK MESSAGE AS PROCESSED
function markMessageProcessed(messageId) {
  processedMessages.add(messageId);
  
  // Auto-cleanup old messages (keep only last 1000)
  if (processedMessages.size > 1000) {
    const arr = Array.from(processedMessages);
    processedMessages.clear();
    arr.slice(-500).forEach(id => processedMessages.add(id));
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
            
            console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`📱 SESSION: ${name}`);
            console.log(`🔑 PAIRING CODE: ${code}`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

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
        
        // Initialize Bulk Sender
        try {
          const bulkSender = getBulkSender();
          bulkSender.updateSessions(sessions);
          logger.success('✅ Bulk sender linked to sessions');
        } catch (e) {
          logger.warn(`Bulk sender not available: ${e.message}`);
        }
        
        // Send startup notification
        try {
          const adminJid = CONFIG.ADMIN?.JID;
          if (adminJid) {
            const startupMsg = `🚀 *Bot Started*\n\nSession: ${name}\nTime: ${getTimestamp()}\nScheduler: ${schedulerInitialized ? '✅ Running' : '❌ Inactive'}\n\n📊 Send "report" for statistics\n⚙️ Send "help" for commands`;
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

        if (code === 401 || code === 515) {
          logger.error(`[${name}] Session invalid - delete ./sessions/${name} and reconnect`);
          sessions.delete(name);
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

    // 🔥 SINGLE MESSAGE HANDLER - NO DUPLICATES
    sock.ev.on('messages.upsert', async ({ messages }) => {
      for (const m of messages) {
        try {
          // Skip if no message or from self
          if (!m.message || m.key.fromMe) continue;
          
          // 🔥 CREATE UNIQUE MESSAGE ID
          const messageId = getMessageId(m);
          
          // 🔥 CHECK IF ALREADY PROCESSED
          if (isMessageProcessed(messageId)) {
            logger.warn(`⏭️ Skipping duplicate message: ${messageId.substring(0, 30)}...`);
            continue;
          }
          
          // 🔥 MARK AS PROCESSED IMMEDIATELY
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
              continue; // ✅ Stop here - don't process as regular message
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
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🌟  ${CONFIG.BOT?.NAME || 'Gyan Ganga Seva Bot'}  🌟`);
  console.log(`Version ${CONFIG.BOT?.VERSION || '2.0.0'} | ${getTimestamp()}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📱 Active Sessions: ${sessions.size} | Messages: ${totalMessagesHandled}`);
  console.log(`⏰ Scheduler: ${schedulerInitialized ? '✅ Running' : '❌ Inactive'}`);
  console.log(`🔄 Auto-Reconnect: ${autoReconnectEnabled ? '✅ ON' : '❌ OFF'}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`\n📋 MENU OPTIONS:\n`);
  console.log(`1️⃣  - Link WhatsApp (Pairing Code)`);
  console.log(`2️⃣  - Link WhatsApp (QR Code)`);
  console.log(`3️⃣  - Show Active Sessions`);
  console.log(`4️⃣  - Session Statistics`);
  console.log(`5️⃣  - Remove Session`);
  console.log(`6️⃣  - Toggle Auto-Reconnect`);
  console.log(`0️⃣  - Exit Bot`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

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
    autoReconnectEnabled = !autoReconnectEnabled;
    logger.success(`Auto-Reconnect ${autoReconnectEnabled ? 'ENABLED ✅' : 'DISABLED ❌'}`);
    setTimeout(menu, 1000);
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
  console.log(`⏰ Stopped at: ${getTimestamp()}`);
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
