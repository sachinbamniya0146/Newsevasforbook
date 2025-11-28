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
import { 
  handleSessionAdminCommand, 
  handlePendingAdminSetup,
  getAllSessionAdmins
} from './utils/sessionAdminManager.js';
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
const pairingCodeCache = new Map(); // Store pairing codes with expiry
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

// ==================== PAIRING CODE MANAGEMENT ====================
function storePairingCode(sessionName, code) {
  const expiryTime = Date.now() + (5 * 60 * 1000); // 5 minutes
  pairingCodeCache.set(sessionName, {
    code,
    expiryTime,
    used: false
  });
  
  // Auto-cleanup after expiry
  setTimeout(() => {
    const cached = pairingCodeCache.get(sessionName);
    if (cached && !cached.used) {
      logger.warn(`Pairing code for ${sessionName} expired`);
      pairingCodeCache.delete(sessionName);
    }
  }, 5 * 60 * 1000);
}

function getPairingCode(sessionName) {
  const cached = pairingCodeCache.get(sessionName);
  if (!cached) return null;
  
  if (Date.now() > cached.expiryTime) {
    pairingCodeCache.delete(sessionName);
    return null;
  }
  
  return cached.code;
}

function markPairingCodeUsed(sessionName) {
  const cached = pairingCodeCache.get(sessionName);
  if (cached) {
    cached.used = true;
    pairingCodeCache.set(sessionName, cached);
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
      connectTimeoutMs: CONFIG.CONNECTION.CONNECTION_TIMEOUT_MS || 120000,
      keepAliveIntervalMs: CONFIG.CONNECTION.KEEP_ALIVE_INTERVAL_MS || 30000,
      defaultQueryTimeoutMs: 60000,
      emitOwnEvents: false,
      fireInitQueries: true,
      generateHighQualityLinkPreview: false,
      syncFullHistory: false,
      shouldIgnoreJid: (jid) => jid.endsWith('@broadcast'),
      getMessage: async (key) => {
        return { conversation: '' };
      }
    });

    let pairingCodeAttempted = false;
    let connectionRetries = 0;
    const MAX_CONNECTION_RETRIES = 3;

    sock.ev.on('creds.update', saveCreds);
    
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr, isNewLogin } = update;

      // QR Code Mode
      if (mode === 'qr' && qr && !state.creds.registered) {
        console.log(`\n┌──────────── SCAN QR [${name}] ────────────┐`);
        qrcode.generate(qr, { small: true });
        console.log(`WhatsApp > Linked Devices > Scan QR\n`);
      }

      // Pairing Code Mode (Enhanced with 5min validity)
      if ((mode === 'pair') && !pairingCodeAttempted && !state.creds.registered && phone) {
        if (connection === 'open' || connection === 'connecting') {
          pairingCodeAttempted = true;
          await delay(2500);
          try {
            const cleanPhone = normalizePhone(phone);
            if (!cleanPhone) throw new Error('Invalid phone number format');
            
            const code = await sock.requestPairingCode(cleanPhone);
            
            // Store with 5-minute expiry
            storePairingCode(name, code);
            
            console.log(`\n┌────────────────────────────────────────┐`);
            console.log(`📱 SESSION: ${name}`);
            console.log(`🔑 PAIRING CODE: ${code}`);
            console.log(`⏰ VALID FOR: 5 minutes`);
            console.log(`└────────────────────────────────────────┘\n`);

            // Forward to admin
            try {
              const adminJid = CONFIG.ADMIN?.JID || '919174406375@s.whatsapp.net';
              const expiryTime = new Date(Date.now() + 5 * 60 * 1000);
              const pairMessage = `📱 *Pairing Code Generated*

Session: *${name}*
Phone: +${cleanPhone}
Code: \`${code}\`

⏰ Valid until: ${expiryTime.toLocaleTimeString('hi-IN')}
⏳ Expires in: 5 minutes

Enter this code in WhatsApp:
Settings > Linked Devices > Link with Phone Number`;
              await sock.sendMessage(adminJid, { text: pairMessage });
            } catch (e) {
              logger.warn(`Could not forward pairing code: ${e.message}`);
            }
          } catch (e) {
            logger.error(`Pairing error: ${e.message}`);
          }
        }
      }

      // Connection Opened
      if (connection === 'open') {
        logger.success(`✅ CONNECTED: ${name} at ${getTimestamp()}`);
        
        // Mark pairing code as used
        if (mode === 'pair') {
          markPairingCodeUsed(name);
        }
        
        sessions.set(name, sock);
        retryMap.delete(name);
        connectionRetries = 0;
        
        sessionStats.set(name, {
          messagesReceived: 0,
          messagesHandled: 0,
          errors: 0,
          lastActivity: new Date(),
          connectedAt: new Date()
        });

        // Update admin handler
        updateActiveSessions(sessions);
        
        // Update bulk sender
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
        
        // Send SINGLE startup notification
        if (!global.botStartupNotificationSent && sessions.size === 1) {
          try {
            const adminJid = CONFIG.ADMIN?.JID;
            if (adminJid) {
              const startupMsg = `🚀 *Bot Started*

Session: ${name}
Time: ${getTimestamp()}
Scheduler: ${schedulerInitialized ? '✅' : '❌'}

📊 Send "help" for commands`;
              await sock.sendMessage(adminJid, { text: startupMsg });
              global.botStartupNotificationSent = true;
            }
          } catch (e) {
            logger.warn(`Startup notification failed: ${e.message}`);
          }
        }
        
        // Setup heartbeat
        const heartbeatInterval = setInterval(async () => {
          if (!sessions.has(name)) {
            clearInterval(heartbeatInterval);
            return;
          }
          
          try {
            await sock.fetchStatus(sock.user.id);
          } catch (e) {
            logger.warn(`[${name}] Heartbeat failed: ${e.message}`);
          }
        }, CONFIG.CONNECTION.HEARTBEAT_INTERVAL_MS || 25000);
      }

      // Connection Closed
      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        const shouldRetry = code !== DisconnectReason.loggedOut;
        logger.warn(`[${name}] Disconnected: code=${code} at ${getTimestamp()}`);

        // Remove from sessions
        sessions.delete(name);
        updateActiveSessions(sessions);
        updateBulkSenderSessions();

        // Handle different disconnect reasons
        if (code === 401 || code === 515) {
          logger.error(`[${name}] Session invalid - delete ./sessions/${name} and reconnect`);
          sessionStats.delete(name);
          retryMap.delete(name);
          pairingCodeCache.delete(name);
        }
        else if (code === 440) {
          // Connection was replaced (logged in elsewhere)
          logger.error(`[${name}] Connection replaced - logged in elsewhere`);
          // Don't auto-retry for 440
          sessionStats.delete(name);
          retryMap.delete(name);
        }
        else if (shouldRetry && autoReconnectEnabled) {
          connectionRetries++;
          const retries = retryMap.get(name) || 0;
          
          if (retries < CONFIG.CONNECTION.MAX_RETRIES && connectionRetries <= MAX_CONNECTION_RETRIES) {
            retryMap.set(name, retries + 1);
            const delayTime = Math.min(
              CONFIG.CONNECTION.INITIAL_RETRY_DELAY_MS * Math.pow(2, retries),
              CONFIG.CONNECTION.MAX_RETRY_DELAY_MS
            );
            logger.info(`[${name}] Retry ${retries + 1}/${CONFIG.CONNECTION.MAX_RETRIES} in ${delayTime/1000}s...`);
            await delay(delayTime);
            connect(name, mode, phone);
          } else {
            logger.error(`[${name}] Max retries reached`);
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

    // SINGLE MESSAGE HANDLER
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
          
          // Check for pending admin setup
          if (isAdmin && global.pendingAdminSetup) {
            const handled = await handlePendingAdminSetup(sock, m);
            if (handled) {
              updateSessionStats(name, 'message_handled');
              continue;
            }
          }
          
          // Handle session admin commands (main admin only)
          if (isAdmin && msgText.trim()) {
            const handled = await handleSessionAdminCommand(sock, from, msgText, isAdmin);
            if (handled) {
              updateSessionStats(name, 'message_handled');
              continue;
            }
          }
          
          // Handle admin commands
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
  console.log(`\n┌────────────────────────────────────────────────────┐`);
  console.log(`🌟  ${CONFIG.BOT_NAME || 'Gyan Ganga Seva Bot'}  🌟`);
  console.log(`Version ${CONFIG.BOT_VERSION || '5.0.0'} | ${getTimestamp()}`);
  console.log(`├────────────────────────────────────────────────────┤`);
  console.log(`📱 Sessions: ${sessions.size} | Messages: ${totalMessagesHandled}`);
  console.log(`⏰ Scheduler: ${schedulerInitialized ? '✅ Running' : '❌ Inactive'}`);
  console.log(`📤 Bulk Sender: ✅ Ready`);
  console.log(`🔄 Auto-Reconnect: ${autoReconnectEnabled ? '✅ ON' : '❌ OFF'}`);
  console.log(`└────────────────────────────────────────────────────┘`);
  console.log(`\n📋 MENU OPTIONS:\n`);
  console.log(`1️⃣  - Link WhatsApp (Pairing Code - 5min)`);
  console.log(`2️⃣  - Link WhatsApp (QR Code)`);
  console.log(`3️⃣  - Show Active Sessions`);
  console.log(`4️⃣  - Session Statistics`);
  console.log(`5️⃣  - Remove Session`);
  console.log(`6️⃣  - Toggle Auto-Reconnect`);
  console.log(`7️⃣  - Session Admins`);
  console.log(`8️⃣  - Bulk Sender Status`);
  console.log(`0️⃣  - Exit Bot`);
  console.log(`└────────────────────────────────────────────────────┘\n`);

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
    
    logger.info(`Starting: ${name} (+${phone})`);
    connect(name, 'pair', phone);
    console.log(`\n✅ Pairing code will appear in 3-5 seconds`);
    console.log(`⏰ Code will be valid for 5 minutes\n`);
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
    console.log(`\n┌────────────────────────────────────────────────────┐`);
    console.log(`📊 ACTIVE SESSIONS: ${sessions.size}`);
    console.log(`├────────────────────────────────────────────────────┤`);
    if (sessions.size === 0) {
      console.log('❌ No active sessions');
    } else {
      let i = 1;
      for (const [name, sock] of sessions) {
        const jid = sock.user?.id || 'Unknown';
        const phone = jid.split(':')[0];
        const stats = sessionStats.get(name);
        console.log(`\n${i}. ${name} - +${phone}`);
        if (stats) {
          console.log(`   📨 Received: ${stats.messagesReceived}`);
          console.log(`   ✅ Handled: ${stats.messagesHandled}`);
          console.log(`   ⏰ Last: ${stats.lastActivity?.toLocaleTimeString('hi-IN') || 'N/A'}`);
        }
        i++;
      }
    }
    console.log(`\n└────────────────────────────────────────────────────┘\n`);
    setTimeout(menu, 1000);
  }
  
  else if (choice === '4') {
    console.log(`\n┌────────────────────────────────────────────────────┐`);
    console.log(`📊 SESSION STATISTICS`);
    console.log(`├────────────────────────────────────────────────────┤`);
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
    console.log(`└────────────────────────────────────────────────────┘\n`);
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
      const admins = await getAllSessionAdmins();
      
      console.log(`\n┌────────────────────────────────────────────────────┐`);
      console.log(`📱 SESSION ADMINS`);
      console.log(`├────────────────────────────────────────────────────┤`);
      
      if (Object.keys(admins).length === 0) {
        console.log('❌ No session admins configured');
        console.log('\nℹ️  Set via WhatsApp: Send "setadmin <session>" to main admin');
      } else {
        for (const [session, jid] of Object.entries(admins)) {
          const phone = jid.split('@')[0];
          console.log(`\n📱 ${session}`);
          console.log(`   Admin: +${phone}`);
        }
      }
      
      console.log(`\n└────────────────────────────────────────────────────┘\n`);
    } catch (e) {
      logger.error(`Error loading admins: ${e.message}`);
    }
    setTimeout(menu, 1000);
  }
  
  else if (choice === '8') {
    try {
      const bulkSender = getBulkSender();
      const status = await bulkSender.getStatus();
      
      console.log(`\n┌────────────────────────────────────────────────────┐`);
      console.log(`📤 BULK SENDER STATUS`);
      console.log(`├────────────────────────────────────────────────────┤`);
      console.log(`Status: ${status.running ? '🟢 Running' : '🔴 Stopped'}${status.paused ? ' (PAUSED)' : ''}`);
      console.log(`Business Hours: ${status.businessHours ? '🟢 Active' : '🔴 Inactive'}`);
      console.log(`Sessions: ${status.sessions}`);
      console.log(`Active Campaigns: ${status.activeCampaigns}`);
      console.log(`Queued: ${status.queuedCampaigns}`);
      console.log(`\n📊 Global Stats:`);
      console.log(`Total Sent: ${status.globalStats.totalSent}`);
      console.log(`Total Failed: ${status.globalStats.totalFailed}`);
      console.log(`Campaigns Completed: ${status.globalStats.campaignsCompleted}`);
      console.log(`└────────────────────────────────────────────────────┘\n`);
    } catch (e) {
      logger.error(`Error getting bulk status: ${e.message}`);
    }
    setTimeout(menu, 1000);
  }
  
  else if (choice === '0') {
    console.log(`\n┌────────────────────────────────────────────────────┐`);
    console.log(`👋 Exiting ${CONFIG.BOT_NAME || 'Bot'}...`);
    console.log(`💾 ${sessions.size} session(s) saved`);
    console.log(`📨 Total messages: ${totalMessagesHandled}`);
    console.log(`⏰ Stopped: ${getTimestamp()}`);
    console.log(`└────────────────────────────────────────────────────┘\n`);
    
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
  console.log('\n┌────────────────────────────────────────────────────┐');
  console.log(`🚀 ${CONFIG.BOT_NAME || 'Gyan Ganga Seva Bot'}`);
  console.log(`📦 Version: ${CONFIG.BOT_VERSION || '5.0.0'}`);
  console.log(`⏰ Started: ${getTimestamp()}`);
  console.log('└────────────────────────────────────────────────────┘\n');

  logger.info('Initializing bot...');
  
  const restored = await autoStartAll();
  
  if (restored > 0) {
    console.log(`\n┌────────────────────────────────────────────────────┐`);
    logger.success(`Restored ${restored} session(s)`);
    logger.info(`Admin: ${CONFIG.ADMIN?.PHONE || 'Not configured'}`);
    console.log(`└────────────────────────────────────────────────────┘\n`);
  } else {
    console.log(`\n┌────────────────────────────────────────────────────┐`);
    logger.warn('No saved sessions found');
    logger.info('Link your first WhatsApp account from menu');
    console.log(`└────────────────────────────────────────────────────┘\n`);
  }

  await delay(1000);
  menu();
})();

// ==================== ERROR HANDLERS ====================
process.on('SIGINT', () => {
  console.log(`\n\n┌────────────────────────────────────────────────────┐`);
  logger.info('Bot stopping gracefully...');
  console.log(`💾 Saved ${sessions.size} session(s)`);
  console.log(`📨 Handled ${totalMessagesHandled} messages`);
  console.log(`⏰ Stopped: ${getTimestamp()}`);
  console.log(`└────────────────────────────────────────────────────┘\n`);
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
