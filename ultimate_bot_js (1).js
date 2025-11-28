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
  getAllSessionAdmins,
  setSessionAdmin
} from './utils/sessionAdminManager.js';
import { initScheduler, stopScheduler } from './utils/scheduler.js';
import { getBulkSender } from './utils/bulkSender.js';
import CONFIG from './config.js';

// ==================== ENHANCED LOGGER (IST TIME) ====================
const logger = {
  info: (msg) => {
    const time = new Date().toLocaleString('en-IN', { 
      timeZone: 'Asia/Kolkata', 
      hour12: true,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    console.log(`[${time}] ℹ️  ${msg}`);
  },
  success: (msg) => {
    const time = new Date().toLocaleString('en-IN', { 
      timeZone: 'Asia/Kolkata', 
      hour12: true,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    console.log(`[${time}] ✅ ${msg}`);
  },
  warn: (msg) => {
    const time = new Date().toLocaleString('en-IN', { 
      timeZone: 'Asia/Kolkata', 
      hour12: true,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    console.log(`[${time}] ⚠️  ${msg}`);
  },
  error: (msg) => {
    const time = new Date().toLocaleString('en-IN', { 
      timeZone: 'Asia/Kolkata', 
      hour12: true,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    console.log(`[${time}] ❌ ${msg}`);
  }
};

// ==================== GLOBALS ====================
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const sessions = new Map();
const retryMap = new Map();
const sessionStats = new Map();
const processedMessages = new Set();
const pairingCodeCache = new Map();
const connectionStates = new Map(); // Track connection states
let schedulerInitialized = false;
let autoReconnectEnabled = true;
let totalMessagesHandled = 0;
let botStartupNotificationSent = false;

// ==================== UTILITY FUNCTIONS ====================
function ask(q) {
  return new Promise((r) => rl.question(q, r));
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
    arr.slice(-500).forEach((id) => processedMessages.add(id));
  }
}

// ==================== PAIRING CODE MANAGEMENT (5-MINUTE VALIDITY) ====================
function storePairingCode(sessionName, code) {
  const expiryTime = Date.now() + 5 * 60 * 1000; // 5 minutes
  pairingCodeCache.set(sessionName, {
    code,
    expiryTime,
    used: false,
    createdAt: Date.now()
  });

  setTimeout(() => {
    const cached = pairingCodeCache.get(sessionName);
    if (cached && !cached.used) {
      logger.warn(`⏰ Pairing code expired for ${sessionName}`);
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

// ==================== BULK SENDER HELPERS ====================
function updateBulkSenderSessions() {
  try {
    const bulkSender = getBulkSender();
    if (bulkSender && typeof bulkSender.updateSessions === 'function') {
      bulkSender.updateSessions(sessions);
      logger.success(`✅ Bulk sender updated with ${sessions.size} session(s)`);
    }
  } catch (e) {
    logger.warn('⚠️ Bulk sender update skipped: ' + e.message);
  }
}

function ensureBulkSenderRunning() {
  try {
    const bulkSender = getBulkSender();
    if (!bulkSender) return;

    const status = bulkSender.getStatus ? bulkSender.getStatus() : { running: false };
    
    if (!status.running && typeof bulkSender.start === 'function') {
      bulkSender.start();
      logger.success('📤 Bulk sender auto-started');
    } else {
      logger.info('📤 Bulk sender already running');
    }
  } catch (e) {
    logger.warn('⚠️ Could not auto-start bulk sender: ' + e.message);
  }
}

// ==================== SESSION ADMIN SETUP DURING PAIRING ====================
async function setupSessionAdmin(sock, sessionName, adminPhone) {
  try {
    const adminJid = `${adminPhone}@s.whatsapp.net`;
    const success = await setSessionAdmin(sessionName, adminJid);

    if (success) {
      logger.success(`✅ Session Admin set: ${sessionName} → +${adminPhone}`);

      // Notify main admin
      if (CONFIG.ADMIN?.JID) {
        const notifyMsg = `✅ *Session Admin Configured*\n\n` +
          `📱 Session: *${sessionName}*\n` +
          `👤 Admin: +${adminPhone}\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `📦 Orders from this session will be forwarded to:\n\n` +
          `• Main Admin (you)\n` +
          `• Session Admin (+${adminPhone})\n` +
          `• Order Group\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
        
        await sock.sendMessage(CONFIG.ADMIN.JID, { text: notifyMsg });
      }

      // Notify session admin
      try {
        const welcomeMsg = `🎉 *Welcome Session Admin!*\n\n` +
          `You are now the admin for session: *${sessionName}*\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `📦 You will receive all order notifications from this WhatsApp session.\n\n` +
          `✅ Orders will be forwarded automatically\n` +
          `✅ You can manage orders directly\n\n` +
          `🙏 Thank you for managing this session!\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
        
        await sock.sendMessage(adminJid, { text: welcomeMsg });
        logger.success(`✅ Session admin notified: +${adminPhone}`);
      } catch (e) {
        logger.warn(`⚠️ Could not notify session admin: ${e.message}`);
      }

      return true;
    }

    return false;
  } catch (error) {
    logger.error(`❌ Session admin setup error: ${error.message}`);
    return false;
  }
}

// ==================== ENHANCED CONNECTION FUNCTION (STABLE & PERSISTENT) ====================
async function connect(name, mode, phone = null, sessionAdminPhone = null) {
  try {
    logger.info(`🔗 Connecting: ${name} (mode: ${mode})`);

    // Check if already connecting
    if (connectionStates.get(name) === 'connecting') {
      logger.warn(`⚠️ [${name}] Already connecting, skipping duplicate`);
      return;
    }

    connectionStates.set(name, 'connecting');

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
      printQRInTerminal: mode === 'qr',
      syncFullHistory: false,
      markOnlineOnConnect: true,
      connectTimeoutMs: 60000, // 60 seconds
      keepAliveIntervalMs: 30000, // 30 seconds
      defaultQueryTimeoutMs: 60000,
      emitOwnEvents: false,
      fireInitQueries: true,
      generateHighQualityLinkPreview: false,
      shouldIgnoreJid: (jid) => jid.endsWith('@broadcast'),
      getMessage: async () => ({ conversation: '' })
    });

    let connectionRetries = 0;
    const MAX_CONNECTION_RETRIES = 5;
    let reconnectTimeout = null;

    sock.ev.on('creds.update', saveCreds);

    // === PAIRING CODE FLOW (5-MINUTE VALIDITY) ===
    if (mode === 'pair' && !state.creds.registered && phone) {
      setTimeout(async () => {
        try {
          const cleanPhone = normalizePhone(phone);
          if (!cleanPhone) throw new Error('Invalid phone number format');

          logger.info(`📞 Requesting pairing code for +${cleanPhone}...`);
          const code = await sock.requestPairingCode(cleanPhone);

          // Store with 5-minute expiry
          storePairingCode(name, code);

          console.log('\n╔════════════════════════════════════════════════════╗');
          console.log(`║  📱 SESSION: ${name.padEnd(40)} ║`);
          console.log(`║  🔑 PAIRING CODE: ${code.padEnd(36)} ║`);
          console.log(`║  ⏰ VALID FOR: 5 minutes                          ║`);
          console.log(`║  📲 Enter in WhatsApp > Linked Devices            ║`);
          console.log('╚════════════════════════════════════════════════════╝\n');

          // Forward to admin (non-blocking)
          if (CONFIG.ADMIN?.JID) {
            try {
              const expiryTime = new Date(Date.now() + 5 * 60 * 1000);
              const pairMessage = `📱 *Pairing Code Generated*\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `Session: *${name}*\n` +
                `Phone: +${cleanPhone}\n` +
                `Code: \`${code}\`\n\n` +
                `⏰ Valid until: ${expiryTime.toLocaleTimeString('hi-IN', { timeZone: 'Asia/Kolkata' })}\n` +
                `⏳ Expires in: 5 minutes\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `📲 Enter this code in WhatsApp:\n` +
                `Settings > Linked Devices > Link with Phone Number\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

              await sock.sendMessage(CONFIG.ADMIN.JID, { text: pairMessage });
              logger.success('✅ Pairing code forwarded to admin');
            } catch (e) {
              logger.warn(`⚠️ Could not forward pairing code: ${e.message}`);
            }
          }
        } catch (e) {
          logger.error(`❌ Pairing error: ${e.message}`);
          connectionStates.delete(name);
        }
      }, 3000);
    }

    // === CONNECTION UPDATE HANDLER ===
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      // QR Code Display
      if (qr && mode === 'qr') {
        console.log('\n📱 Scan QR Code to link WhatsApp:\n');
        qrcode.generate(qr, { small: true });
        console.log('\n⏰ QR Code expires in 60 seconds. Scan quickly!\n');
      }

      // Connection Opened - SUCCESS
      if (connection === 'open') {
        connectionStates.set(name, 'open');
        logger.success(`✅ CONNECTED: ${name} at ${getTimestamp()}`);

        // Clear any pending reconnect
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
          reconnectTimeout = null;
        }

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

        // Update admin handler & bulk sender
        updateActiveSessions(sessions);
        updateBulkSenderSessions();
        
        // Auto-start bulk sender after first session connects
        if (sessions.size === 1) {
          setTimeout(() => {
            ensureBulkSenderRunning();
          }, 5000);
        }

        // Initialize Scheduler (only once)
        if (!schedulerInitialized && sessions.size === 1) {
          schedulerInitialized = true;
          try {
            initScheduler(sock);
            logger.success('✅ Scheduler initialized (7 AM & 8 PM reports)');
          } catch (e) {
            logger.error(`❌ Scheduler init error: ${e.message}`);
            schedulerInitialized = false;
          }
        }

        // Setup Session Admin if provided during pairing
        if (sessionAdminPhone && mode === 'pair') {
          await delay(3000);
          await setupSessionAdmin(sock, name, sessionAdminPhone);
        }

        // Single startup notification
        if (!botStartupNotificationSent && sessions.size === 1) {
          setTimeout(async () => {
            try {
              if (CONFIG.ADMIN?.JID) {
                const startupMsg = `🚀 *Bot Started Successfully*\n\n` +
                  `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                  `📱 Session: ${name}\n` +
                  `⏰ Time: ${getTimestamp()}\n` +
                  `📅 Scheduler: ${schedulerInitialized ? '✅ Active' : '❌ Inactive'}\n` +
                  `📤 Bulk Sender: ✅ Ready\n\n` +
                  `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                  `💡 Send "help" for admin commands\n` +
                  `📊 Send "stats" for statistics\n\n` +
                  `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
                
                await sock.sendMessage(CONFIG.ADMIN.JID, { text: startupMsg });
                botStartupNotificationSent = true;
                logger.success('✅ Startup notification sent to admin');
              }
            } catch (e) {
              logger.warn(`⚠️ Startup notification failed: ${e.message}`);
            }
          }, 5000);
        }

        // Heartbeat to keep connection alive
        const heartbeatInterval = setInterval(async () => {
          if (!sessions.has(name)) {
            clearInterval(heartbeatInterval);
            return;
          }

          try {
            // Silent heartbeat
            await sock.fetchStatus(sock.user.id);
          } catch (e) {
            // Ignore heartbeat errors
          }
        }, 30000); // Every 30 seconds
      }

      // Connection Closed - HANDLE GRACEFULLY
      if (connection === 'close') {
        connectionStates.set(name, 'closed');
        const code = lastDisconnect?.error?.output?.statusCode;
        const reason = lastDisconnect?.error?.message || 'Unknown';
        
        logger.warn(`⚠️ [${name}] Disconnected: code=${code}, reason=${reason}`);

        // Remove from active sessions
        sessions.delete(name);
        updateActiveSessions(sessions);
        updateBulkSenderSessions();

        // Handle specific disconnect reasons
        if (code === DisconnectReason.loggedOut || code === 401) {
          // Session logged out - don't reconnect, keep files
          logger.error(`❌ [${name}] Logged out. Please relink from menu.`);
          connectionStates.delete(name);
          sessionStats.delete(name);
          retryMap.delete(name);
          pairingCodeCache.delete(name);
        } 
        else if (code === DisconnectReason.connectionReplaced || code === 440) {
          // Connection replaced - don't reconnect
          logger.error(`❌ [${name}] Connection replaced - logged in elsewhere`);
          connectionStates.delete(name);
          sessionStats.delete(name);
          retryMap.delete(name);
        }
        else if (code === 515) {
          // Connection terminated - don't reconnect
          logger.error(`❌ [${name}] Connection terminated by WhatsApp`);
          connectionStates.delete(name);
          sessionStats.delete(name);
          retryMap.delete(name);
        }
        else if (autoReconnectEnabled) {
          // Auto-reconnect with exponential backoff
          connectionRetries++;
          const retries = retryMap.get(name) || 0;

          if (retries < MAX_CONNECTION_RETRIES && connectionRetries <= MAX_CONNECTION_RETRIES) {
            retryMap.set(name, retries + 1);
            
            // Exponential backoff: 5s, 10s, 20s, 40s, 80s
            const delayTime = Math.min(5000 * Math.pow(2, retries), 120000);
            
            logger.info(`🔄 [${name}] Reconnecting in ${delayTime / 1000}s (attempt ${retries + 1}/${MAX_CONNECTION_RETRIES})...`);
            
            reconnectTimeout = setTimeout(() => {
              connectionStates.delete(name);
              connect(name, mode, phone, sessionAdminPhone);
            }, delayTime);
          } else {
            logger.error(`❌ [${name}] Max retries reached. Please relink manually.`);
            connectionStates.delete(name);
            sessionStats.delete(name);
            retryMap.delete(name);
          }
        } else {
          logger.error(`❌ [${name}] Auto-reconnect disabled`);
          connectionStates.delete(name);
          sessionStats.delete(name);
          retryMap.delete(name);
        }
      }

      // Connection Connecting
      if (connection === 'connecting') {
        connectionStates.set(name, 'connecting');
        logger.info(`🔄 [${name}] Connecting...`);
      }
    });

    // === MESSAGE HANDLER (OPTIMIZED) ===
    sock.ev.on('messages.upsert', async ({ messages }) => {
      for (const m of messages) {
        try {
          if (!m.message || m.key.fromMe) continue;

          const messageId = getMessageId(m);

          if (isMessageProcessed(messageId)) {
            continue;
          }

          markMessageProcessed(messageId);

          const from = m.key?.remoteJid;
          const msgText = m.message?.conversation || m.message?.extendedTextMessage?.text || '';

          updateSessionStats(name, 'message_received');

          const isAdmin = CONFIG.ADMIN && from === CONFIG.ADMIN.JID;

          // Pending admin setup (forwarded contact)
          if (isAdmin && global.pendingAdminSetup) {
            const handled = await handlePendingAdminSetup(sock, m);
            if (handled) {
              updateSessionStats(name, 'message_handled');
              continue;
            }
          }

          // Session admin commands (from main admin)
          if (isAdmin && msgText.trim()) {
            const handled = await handleSessionAdminCommand(sock, from, msgText, isAdmin);
            if (handled) {
              updateSessionStats(name, 'message_handled');
              continue;
            }
          }

          // General admin commands
          if (isAdmin && msgText.trim()) {
            const handled = await handleAdminCommand(sock, from, msgText, isAdmin);
            if (handled) {
              updateSessionStats(name, 'message_handled');
              continue;
            }
          }

          // Regular user messages (order flow)
          await handleMessage(sock, m, name);
          updateSessionStats(name, 'message_handled');
          
        } catch (e) {
          // Silently handle Bad MAC and connection errors
          if (!e?.message?.includes('Bad MAC') && 
              !e?.message?.includes('Connection Closed') &&
              !e?.message?.includes('timed out')) {
            logger.error(`❌ [${name}] Message error: ${e.message}`);
            updateSessionStats(name, 'error');
          }
        }
      }
    });

  } catch (e) {
    logger.error(`❌ [${name}] Connection error: ${e.message}`);
    connectionStates.delete(name);
  }
}

// ==================== AUTO-START ALL SESSIONS ====================
async function autoStartAll() {
  try {
    if (!fs.existsSync('./sessions')) {
      fs.mkdirSync('./sessions', { recursive: true });
      logger.info('📁 Created sessions directory');
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

    if (restored > 0) {
      setTimeout(() => {
        ensureBulkSenderRunning();
      }, 10000);
    }

    return restored;
  } catch (e) {
    logger.error('❌ Auto-start error: ' + e.message);
    return 0;
  }
}

// ==================== ENHANCED MENU (BEAUTIFUL & FUNCTIONAL) ====================
async function menu() {
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log(`║  🌟  ${(CONFIG.BOT_NAME || 'Gyan Ganga Seva Bot').padEnd(44)}║`);
  console.log(`║  📦 Version ${(CONFIG.BOT_VERSION || '5.0.0').padEnd(40)}║`);
  console.log(`║  ⏰ ${getTimestamp().padEnd(44)}║`);
  console.log('╠════════════════════════════════════════════════════╣');
  console.log(`║  📱 Sessions: ${String(sessions.size).padEnd(37)}║`);
  console.log(`║  📨 Messages: ${String(totalMessagesHandled).padEnd(37)}║`);
  console.log(`║  ⏰ Scheduler: ${(schedulerInitialized ? '✅ Running' : '❌ Inactive').padEnd(36)}║`);
  console.log(`║  📤 Bulk: ${('✅ Ready').padEnd(41)}║`);
  console.log(`║  🔄 Auto-Reconnect: ${(autoReconnectEnabled ? '✅ ON' : '❌ OFF').padEnd(29)}║`);
  console.log('╚════════════════════════════════════════════════════╝');
  
  console.log('\n📋 MENU OPTIONS:\n');
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║  1️⃣  Link WhatsApp (Pairing + Session Admin)      ║');
  console.log('║  2️⃣  Link WhatsApp (QR Code)                      ║');
  console.log('║  3️⃣  Show Active Sessions                         ║');
  console.log('║  4️⃣  Session Statistics                           ║');
  console.log('║  5️⃣  Remove Session                               ║');
  console.log('║  6️⃣  Toggle Auto-Reconnect                        ║');
  console.log('║  7️⃣  Session Admins List                          ║');
  console.log('║  8️⃣  Bulk Sender Status                           ║');
  console.log('║  9️⃣  Edit Session Admin (CLI)                     ║');
  console.log('║  0️⃣  Exit Bot                                      ║');
  console.log('╚════════════════════════════════════════════════════╝\n');

  const choice = await ask('👉 Enter choice: ');

  if (choice === '1') {
    // Link with Pairing Code + Session Admin
    const name = await ask('📝 Session name: ');
    if (!name || name.trim() === '') {
      logger.error('❌ Invalid session name');
      return menu();
    }

    // Ask if they want to set session admin
    const wantAdmin = await ask('👤 Set session admin? (y/n): ');
    let sessionAdminPhone = null;

    if (wantAdmin.toLowerCase() === 'y' || wantAdmin.toLowerCase() === 'yes') {
      const adminPhoneRaw = await ask('📞 Session Admin phone (10 digits): ');
      const adminPhone = normalizePhone(adminPhoneRaw);

      if (adminPhone && adminPhone.length >= 10) {
        sessionAdminPhone = adminPhone;
        logger.success(`✅ Session admin will be set: +${adminPhone}`);
      } else {
        logger.warn('⚠️ Invalid admin phone, skipping...');
      }
    }

    const phoneRaw = await ask('📞 Phone to link (919876543210): ');
    const phone = normalizePhone(phoneRaw);
    if (!phone || phone.length < 10) {
      logger.error('❌ Invalid phone number');
      return menu();
    }

    logger.info(`🚀 Starting: ${name} (+${phone})`);
    if (sessionAdminPhone) {
      logger.info(`👤 Session Admin: +${sessionAdminPhone}`);
    }

    connect(name, 'pair', phone, sessionAdminPhone);
    
    console.log('\n╔════════════════════════════════════════════════════╗');
    console.log('║  ✅ Pairing code will appear in 3-5 seconds       ║');
    console.log('║  ⏰ Code valid for 5 minutes                      ║');
    if (sessionAdminPhone) {
      console.log('║  👤 Session admin will be auto-configured         ║');
    }
    console.log('╚════════════════════════════════════════════════════╝\n');
    
    setTimeout(menu, 5000);
  } 
  else if (choice === '2') {
    // Link with QR Code
    const name = await ask('📝 Session name: ');
    if (!name || name.trim() === '') {
      logger.error('❌ Invalid session name');
      return menu();
    }

    logger.info(`🚀 Starting QR: ${name}`);
    connect(name, 'qr');
    
    console.log('\n╔════════════════════════════════════════════════════╗');
    console.log('║  ✅ QR code will appear in 3-5 seconds            ║');
    console.log('║  📱 Scan with WhatsApp > Linked Devices           ║');
    console.log('╚════════════════════════════════════════════════════╝\n');
    
    setTimeout(menu, 5000);
  } 
  else if (choice === '3') {
    // Show Active Sessions
    console.log('\n╔════════════════════════════════════════════════════╗');
    console.log(`║  📊 ACTIVE SESSIONS: ${String(sessions.size).padEnd(30)}║`);
    console.log('╠════════════════════════════════════════════════════╣');
    
    if (sessions.size === 0) {
      console.log('║  ❌ No active sessions                             ║');
    } else {
      let i = 1;
      for (const [name, sock] of sessions) {
        const jid = sock.user?.id || 'Unknown';
        const phone = jid.split(':')[0];
        const stats = sessionStats.get(name);
        
        console.log(`║                                                    ║`);
        console.log(`║  ${i}. ${name.padEnd(44)}║`);
        console.log(`║     📞 +${phone.padEnd(41)}║`);
        
        if (stats) {
          console.log(`║     📨 Received: ${String(stats.messagesReceived).padEnd(32)}║`);
          console.log(`║     ✅ Handled: ${String(stats.messagesHandled).padEnd(33)}║`);
          const lastTime = stats.lastActivity?.toLocaleTimeString('hi-IN') || 'N/A';
          console.log(`║     ⏰ Last: ${lastTime.padEnd(36)}║`);
        }
        i++;
      }
    }
    
    console.log('╚════════════════════════════════════════════════════╝\n');
    setTimeout(menu, 1000);
  } 
  else if (choice === '4') {
    // Session Statistics
    console.log('\n╔════════════════════════════════════════════════════╗');
    console.log('║  📊 SESSION STATISTICS                             ║');
    console.log('╠════════════════════════════════════════════════════╣');
    console.log(`║  Total Messages: ${String(totalMessagesHandled).padEnd(33)}║`);
    console.log(`║  Active Sessions: ${String(sessions.size).padEnd(32)}║`);
    console.log('║                                                    ║');

    for (const [name, stats] of sessionStats) {
      const uptime = stats.connectedAt
        ? Math.floor((Date.now() - stats.connectedAt.getTime()) / 1000 / 60)
        : 0;
      
      console.log(`║  📱 ${name.padEnd(45)}║`);
      console.log(`║     ⏱️  Uptime: ${String(uptime).padEnd(34)} min ║`);
      console.log(`║     📨 Received: ${String(stats.messagesReceived).padEnd(32)}║`);
      console.log(`║     ✅ Handled: ${String(stats.messagesHandled).padEnd(33)}║`);
      console.log(`║     ❌ Errors: ${String(stats.errors).padEnd(34)}║`);
      const lastTime = stats.lastActivity?.toLocaleString('hi-IN', { 
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit'
      }) || 'N/A';
      console.log(`║     ⏰ Last: ${lastTime.padEnd(36)}║`);
      console.log('║                                                    ║');
    }
    
    console.log('╚════════════════════════════════════════════════════╝\n');
    setTimeout(menu, 1000);
  } 
  else if (choice === '5') {
    // Remove Session
    const name = await ask('📝 Session to remove: ');
    
    if (sessions.has(name)) {
      const sock = sessions.get(name);
      try {
        sock.end();
      } catch (e) {
        // Ignore
      }
      
      sessions.delete(name);
      sessionStats.delete(name);
      connectionStates.delete(name);
      retryMap.delete(name);
      
      updateActiveSessions(sessions);
      updateBulkSenderSessions();
      
      logger.success(`✅ Removed session: ${name}`);
      console.log(`\n💡 To permanently delete, remove: ./sessions/${name}\n`);
    } else {
      logger.error(`❌ Session not found: ${name}`);
    }
    
    setTimeout(menu, 1000);
  } 
  else if (choice === '6') {
    // Toggle Auto-Reconnect
    autoReconnectEnabled = !autoReconnectEnabled;
    logger.success(`🔄 Auto-Reconnect ${autoReconnectEnabled ? 'ENABLED ✅' : 'DISABLED ❌'}`);
    setTimeout(menu, 1000);
  } 
  else if (choice === '7') {
    // Session Admins List
    try {
      const admins = await getAllSessionAdmins();

      console.log('\n╔════════════════════════════════════════════════════╗');
      console.log('║  📱 SESSION ADMINS                                 ║');
      console.log('╠════════════════════════════════════════════════════╣');

      if (Object.keys(admins).length === 0) {
        console.log('║  ❌ No session admins configured                   ║');
        console.log('║                                                    ║');
        console.log('║  ℹ️  Set via:                                      ║');
        console.log('║     1. During pairing (Option 1)                  ║');
        console.log('║     2. WhatsApp: "setadmin <session>" to admin    ║');
      } else {
        for (const [session, jid] of Object.entries(admins)) {
          const phone = jid.split('@')[0];
          console.log('║                                                    ║');
          console.log(`║  📱 ${session.padEnd(45)}║`);
          console.log(`║     👤 Admin: +${phone.padEnd(34)}║`);
        }
      }

      console.log('╚════════════════════════════════════════════════════╝\n');
    } catch (e) {
      logger.error(`❌ Error loading admins: ${e.message}`);
    }
    
    setTimeout(menu, 1000);
  } 
  else if (choice === '8') {
    // Bulk Sender Status
    try {
      const bulkSender = getBulkSender();
      const status = await bulkSender.getStatus();

      console.log('\n╔════════════════════════════════════════════════════╗');
      console.log('║  📤 BULK SENDER STATUS                             ║');
      console.log('╠════════════════════════════════════════════════════╣');
      
      const runStatus = status.running 
        ? (status.paused ? '⏸️  Paused' : '🟢 Running') 
        : '🔴 Stopped';
      console.log(`║  Status: ${runStatus.padEnd(42)}║`);
      
      const bizStatus = status.businessHours ? '🟢 Active' : '🔴 Inactive';
      console.log(`║  Business Hours: ${bizStatus.padEnd(33)}║`);
      console.log(`║  Sessions: ${String(status.sessions).padEnd(39)}║`);
      console.log(`║  Active Campaigns: ${String(status.activeCampaigns).padEnd(31)}║`);
      console.log(`║  Queued: ${String(status.queuedCampaigns).padEnd(41)}║`);
      console.log('║                                                    ║');
      console.log('║  📊 Global Stats:                                  ║');
      console.log(`║     Total Sent: ${String(status.globalStats.totalSent).padEnd(32)}║`);
      console.log(`║     Total Failed: ${String(status.globalStats.totalFailed).padEnd(30)}║`);
      console.log(`║     Campaigns Done: ${String(status.globalStats.campaignsCompleted).padEnd(28)}║`);
      console.log('╚════════════════════════════════════════════════════╝\n');
      
      console.log('💡 Bulk Sender Commands (from Termux):');
      console.log('   • Send "bulk start" to admin WhatsApp');
      console.log('   • Send "bulk stop" to admin WhatsApp');
      console.log('   • Send "bulk status" to admin WhatsApp\n');
    } catch (e) {
      logger.error(`❌ Error getting bulk status: ${e.message}`);
    }
    
    setTimeout(menu, 1000);
  } 
  else if (choice === '9') {
    // Edit Session Admin (CLI)
    const sessionName = await ask('📝 Session name: ');
    if (!sessionName || !sessionName.trim()) {
      logger.error('❌ Invalid session name');
      return setTimeout(menu, 500);
    }
    
    const newAdminPhoneRaw = await ask('📞 New admin phone (or blank to remove): ');
    const newAdminPhone = newAdminPhoneRaw.trim() ? normalizePhone(newAdminPhoneRaw) : null;

    try {
      if (newAdminPhone) {
        if (newAdminPhone.length < 10) {
          logger.error('❌ Invalid phone number');
        } else {
          const ok = await setSessionAdmin(sessionName, `${newAdminPhone}@s.whatsapp.net`);
          if (ok) {
            logger.success(`✅ Session admin updated: ${sessionName} → +${newAdminPhone}`);
          } else {
            logger.error('❌ Failed to update (check session name)');
          }
        }
      } else {
        // Remove admin
        const { removeSessionAdmin } = await import('./utils/sessionAdminManager.js');
        const ok = await removeSessionAdmin(sessionName);
        if (ok) {
          logger.success(`✅ Session admin removed for: ${sessionName}`);
        } else {
          logger.error('❌ Failed to remove (check session name)');
        }
      }
    } catch (e) {
      logger.error(`❌ Error: ${e.message}`);
    }
    
    setTimeout(menu, 1000);
  } 
  else if (choice === '0') {
    // Exit Bot
    console.log('\n╔════════════════════════════════════════════════════╗');
    console.log(`║  👋 Exiting ${(CONFIG.BOT_NAME || 'Bot').padEnd(39)}║`);
    console.log(`║  💾 ${String(sessions.size)} session(s) saved${' '.padEnd(30)}║`);
    console.log(`║  📨 ${String(totalMessagesHandled)} messages handled${' '.padEnd(27)}║`);
    console.log(`║  ⏰ ${getTimestamp().padEnd(44)}║`);
    console.log('╚════════════════════════════════════════════════════╝\n');

    stopScheduler();
    
    // Gracefully close all sessions
    for (const [name, sock] of sessions) {
      try {
        sock.end();
        logger.info(`👋 Closed: ${name}`);
      } catch (e) {
        // Ignore
      }
    }
    
    process.exit(0);
  } 
  else {
    logger.error('❌ Invalid choice');
    setTimeout(menu, 500);
  }
}

// ==================== MAIN STARTUP ====================
(async () => {
  console.clear();
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log(`║  🚀 ${(CONFIG.BOT_NAME || 'Gyan Ganga Seva Bot').padEnd(45)}║`);
  console.log(`║  📦 Version: ${(CONFIG.BOT_VERSION || '5.0.0').padEnd(38)}║`);
  console.log(`║  ⏰ Started: ${getTimestamp().padEnd(38)}║`);
  console.log('╚════════════════════════════════════════════════════╝\n');

  logger.info('🔄 Initializing bot...');

  const restored = await autoStartAll();

  if (restored > 0) {
    console.log('\n╔════════════════════════════════════════════════════╗');
    logger.success(`✅ Restored ${restored} session(s)`);
    logger.info(`👤 Main Admin: ${CONFIG.ADMIN?.PHONE || 'Not configured'}`);
    console.log('╚════════════════════════════════════════════════════╝\n');
  } else {
    console.log('\n╔════════════════════════════════════════════════════╗');
    logger.warn('⚠️ No saved sessions found');
    logger.info('📱 Link your first WhatsApp from menu');
    console.log('╚════════════════════════════════════════════════════╝\n');
  }

  await delay(2000);
  menu();
})();

// ==================== ERROR HANDLERS ====================
process.on('SIGINT', () => {
  console.log('\n\n╔════════════════════════════════════════════════════╗');
  logger.info('🛑 Bot stopping gracefully...');
  console.log(`║  💾 Saved ${sessions.size} session(s)${' '.padEnd(28)}║`);
  console.log(`║  📨 Handled ${totalMessagesHandled} messages${' '.padEnd(25)}║`);
  console.log(`║  ⏰ Stopped: ${getTimestamp().padEnd(37)}║`);
  console.log('╚════════════════════════════════════════════════════╝\n');
  
  stopScheduler();
  
  // Close all sessions
  for (const [name, sock] of sessions) {
    try {
      sock.end();
    } catch (e) {
      // Ignore
    }
  }
  
  process.exit(0);
});

process.on('uncaughtException', (e) => {
  // Silently handle common errors
  if (!e?.message?.includes('Bad MAC') && 
      !e?.message?.includes('Connection Closed') &&
      !e?.message?.includes('timed out') &&
      !e?.message?.includes('ECONNRESET')) {
    logger.error(`❌ Uncaught Exception: ${e.message}`);
  }
});

process.on('unhandledRejection', (e) => {
  // Silently handle common errors
  if (e && e.message &&
      !e.message.includes('Bad MAC') &&
      !e.message.includes('Connection Closed') &&
      !e.message.includes('timed out') &&
      !e.message.includes('ECONNRESET')) {
    logger.error(`❌ Unhandled Rejection: ${e.message}`);
  }
});