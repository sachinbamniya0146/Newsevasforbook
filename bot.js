import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  Browsers,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  delay,
  WASocket
} from '@whiskeysockets/baileys';
import P from 'pino';
import readline from 'readline';
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import { handleMessage, initializeReporting } from './handlers/messageHandler.js';
import { handleAdminCommand, updateActiveSessions } from './handlers/adminHandler.js';
import { 
  handleSessionAdminCommand, 
  handlePendingAdminSetup,
  getAllSessionAdmins,
  setSessionAdmin,
  displayAllAdmins
} from './utils/sessionAdminManager.js';
import { initScheduler, stopScheduler } from './utils/scheduler.js';
import { getBulkSender } from './utils/bulkSender.js';
import CONFIG from './config.js';

// ========================= ENHANCED LOGGER =========================
const logger = {
  info: (msg) => console.log(`\x1b[36m[${new Date().toLocaleTimeString('hi-IN')}] ℹ️  ${msg}\x1b[0m`),
  success: (msg) => console.log(`\x1b[32m[${new Date().toLocaleTimeString('hi-IN')}] ✅ ${msg}\x1b[0m`),
  warn: (msg) => console.log(`\x1b[33m[${new Date().toLocaleTimeString('hi-IN')}] ⚠️  ${msg}\x1b[0m`),
  error: (msg) => console.log(`\x1b[31m[${new Date().toLocaleTimeString('hi-IN')}] ❌ ${msg}\x1b[0m`),
  debug: (msg) => console.log(`\x1b[90m[${new Date().toLocaleTimeString('hi-IN')}] 🔍 ${msg}\x1b[0m`)
};

// ========================= GLOBALS =========================
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const sessions = new Map();
const retryMap = new Map();
const sessionStats = new Map();
const processedMessages = new Set();
const pairingCodeCache = new Map();
const pendingAdminSetup = new Map();
const connectionAttempts = new Map();
let schedulerInitialized = false;
let autoReconnectEnabled = true;
let totalMessagesHandled = 0;
let reportingInitialized = false;

// ========================= UTILITY FUNCTIONS =========================
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
  // Ensure country code for 10-digit numbers (default India)
  if (cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }
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
  
  // Keep only last 1000 messages
  if (processedMessages.size > 1000) {
    const arr = Array.from(processedMessages);
    processedMessages.clear();
    arr.slice(-500).forEach(id => processedMessages.add(id));
  }
}

// ========================= PAIRING CODE MANAGEMENT =========================
function storePairingCode(sessionName, code) {
  const expiryTime = Date.now() + (5 * 60 * 1000);
  pairingCodeCache.set(sessionName, {
    code,
    expiryTime,
    used: false,
    createdAt: Date.now()
  });
  
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

// ========================= BULK SENDER UPDATE =========================
function updateBulkSenderSessions() {
  try {
    const bulkSender = getBulkSender();
    bulkSender.updateSessions(sessions);
    logger.debug(`Bulk sender updated: ${sessions.size} session(s)`);
  } catch (e) {
    logger.debug('Bulk sender update skipped');
  }
}

// ========================= ENHANCED CONNECTION FUNCTION =========================
async function connect(name, mode, phone = null, adminPhone = null) {
  try {
    logger.info(`🔌 Connecting: ${name} (mode: ${mode})`);
    
    // Create sessions directory if not exists
    if (!fs.existsSync('./sessions')) {
      fs.mkdirSync('./sessions', { recursive: true });
    }
    
    const { state, saveCreds } = await useMultiFileAuthState('./sessions/' + name);
    const { version } = await fetchLatestBaileysVersion();
    
    logger.debug(`Baileys version: ${version.join('.')}`);
    
    const sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, P({ level: 'silent' }))
      },
      logger: P({ level: 'silent' }),
      browser: Browsers.macOS('Desktop'),
      printQRInTerminal: false,
      syncFullHistory: false,
      markOnlineOnConnect: true,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,
      emitOwnEvents: false,
      fireInitQueries: true,
      generateHighQualityLinkPreview: false,
      shouldIgnoreJid: (jid) => jid?.endsWith('@broadcast') || jid?.endsWith('@newsletter'),
      retryRequestDelayMs: 250,
      maxMsgRetryCount: 3,
      getMessage: async (key) => {
        return { conversation: '' };
      }
    });

    let pairingCodeAttempted = false;
    let connectionRetries = connectionAttempts.get(name) || 0;
    const MAX_CONNECTION_RETRIES = 5;

    // ==================== CREDENTIALS UPDATE ====================
    sock.ev.on('creds.update', saveCreds);
    
    // ==================== CONNECTION UPDATE ====================
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr, isNewLogin } = update;

      logger.debug(`[${name}] Connection: ${connection || 'none'}`);

      // ==================== QR CODE MODE ====================
      if (mode === 'qr' && qr && !state.creds.registered) {
        console.log(`\n┌──────────────────────────────────────────────┐`);
        console.log(`📱 SESSION: ${name}`);
        console.log(`📸 Scan QR code with WhatsApp`);
        console.log(`├──────────────────────────────────────────────┤`);
        qrcode.generate(qr, { small: true });
        console.log(`├──────────────────────────────────────────────┤`);
        console.log(`📱 WhatsApp > Linked Devices > Link a Device`);
        console.log(`└──────────────────────────────────────────────┘\n`);
      }

      // ==================== PAIRING CODE MODE ====================
      if ((mode === 'pair' || mode === 'pairing') && !pairingCodeAttempted && !state.creds.registered && phone) {
        // Only attempt pairing when connecting or open
        if (connection === 'connecting' || connection === 'open') {
          pairingCodeAttempted = true;
          
          await delay(3000); // Wait for connection to stabilize
          
          try {
            const cleanPhone = normalizePhone(phone);
            if (!cleanPhone) {
              throw new Error('Invalid phone number format');
            }
            
            logger.info(`📞 Requesting pairing code for +${cleanPhone}...`);
            
            const code = await sock.requestPairingCode(cleanPhone);
            
            if (!code) {
              throw new Error('Failed to generate pairing code');
            }
            
            storePairingCode(name, code);
            
            const expiryTime = new Date(Date.now() + 5 * 60 * 1000);
            
            console.log(`\n┌────────────────────────────────────────────────┐`);
            console.log(`🔑 PAIRING CODE GENERATED`);
            console.log(`├────────────────────────────────────────────────┤`);
            console.log(`📱 Session: ${name}`);
            console.log(`📞 Phone: +${cleanPhone}`);
            console.log(`🔐 Code: ${code}`);
            console.log(`⏰ Valid until: ${expiryTime.toLocaleTimeString('hi-IN')}`);
            console.log(`⏳ Expires in: 5 minutes`);
            
            // Display admin info if provided
            if (adminPhone) {
              const cleanAdminPhone = normalizePhone(adminPhone);
              if (cleanAdminPhone) {
                const adminJID = `${cleanAdminPhone}@s.whatsapp.net`;
                pendingAdminSetup.set(name, {
                  adminJID,
                  adminPhone: cleanAdminPhone,
                  setupPending: true
                });
                console.log(`├────────────────────────────────────────────────┤`);
                console.log(`👤 Session Admin: +${cleanAdminPhone}`);
                console.log(`📋 Will be configured after connection`);
              }
            }
            
            console.log(`├────────────────────────────────────────────────┤`);
            console.log(`📲 How to use:`);
            console.log(`   1. Open WhatsApp on your phone`);
            console.log(`   2. Go to Settings > Linked Devices`);
            console.log(`   3. Tap "Link a Device"`);
            console.log(`   4. Tap "Link with Phone Number"`);
            console.log(`   5. Enter: ${code}`);
            console.log(`└────────────────────────────────────────────────┘\n`);

            // Forward to main admin
            try {
              if (sessions.size > 0) {
                const firstSession = Array.from(sessions.values())[0];
                const adminJid = CONFIG.ADMIN?.JID || '919174406375@s.whatsapp.net';
                
                let pairMessage = `🔑 *Pairing Code Generated*\n\n`;
                pairMessage += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
                pairMessage += `📱 Session: *${name}*\n`;
                pairMessage += `📞 Phone: +${cleanPhone}\n`;
                pairMessage += `🔐 Code: \`${code}\`\n\n`;
                pairMessage += `⏰ Valid until: ${expiryTime.toLocaleTimeString('hi-IN')}\n`;
                pairMessage += `⏳ Expires in: 5 minutes\n`;
                pairMessage += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

                if (adminPhone) {
                  const cleanAdminPhone = normalizePhone(adminPhone);
                  pairMessage += `👤 *Session Admin:* +${cleanAdminPhone}\n\n`;
                  pairMessage += `Orders from "${name}" will forward to:\n`;
                  pairMessage += `✅ Main Admin (You)\n`;
                  pairMessage += `✅ Session Admin (+${cleanAdminPhone})\n`;
                  pairMessage += `✅ Order Group\n\n`;
                }

                pairMessage += `📲 *How to use:*\n`;
                pairMessage += `Settings > Linked Devices > Link with Phone Number\n\n`;
                pairMessage += `Enter code: ${code}`;

                await firstSession.sendMessage(adminJid, { text: pairMessage });
                logger.success('✅ Pairing code sent to admin');
              }
            } catch (e) {
              logger.warn(`Could not forward pairing code: ${e.message}`);
            }
          } catch (e) {
            logger.error(`❌ Pairing error: ${e.message}`);
            pairingCodeAttempted = false; // Allow retry
          }
        }
      }

      // ==================== CONNECTION OPENED ====================
      if (connection === 'open') {
        logger.success(`✅ CONNECTED: ${name} at ${getTimestamp()}`);
        
        markPairingCodeUsed(name);
        connectionAttempts.delete(name);
        
        sessions.set(name, sock);
        retryMap.delete(name);
        
        sessionStats.set(name, {
          messagesReceived: 0,
          messagesHandled: 0,
          errors: 0,
          lastActivity: new Date(),
          connectedAt: new Date()
        });

        // ==================== SETUP SESSION ADMIN ====================
        if (pendingAdminSetup.has(name)) {
          const adminSetup = pendingAdminSetup.get(name);
          
          await delay(2000); // Wait for connection to stabilize
          
          try {
            await setSessionAdmin(name, adminSetup.adminJID);
            logger.success(`✅ Session admin set: ${name} -> +${adminSetup.adminPhone}`);
            
            // Notify main admin
            try {
              const mainAdminJID = CONFIG.ADMIN?.JID;
              if (mainAdminJID) {
                const phoneNum = sock.user?.id?.split(':')[0] || 'Unknown';
                
                const notifyMsg = `✅ *Session Connected & Admin Set*\n\n`;
                notifyMsg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
                notifyMsg += `📱 Session: *${name}*\n`;
                notifyMsg += `📞 Phone: +${phoneNum}\n\n`;
                notifyMsg += `👤 *Session Admin:*\n`;
                notifyMsg += `+${adminSetup.adminPhone}\n\n`;
                notifyMsg += `📋 *Order Forwarding:*\n`;
                notifyMsg += `✅ Main Admin (You)\n`;
                notifyMsg += `✅ Session Admin (+${adminSetup.adminPhone})\n`;
                notifyMsg += `✅ Order Group\n\n`;
                notifyMsg += `All orders from "${name}" will be forwarded to all three destinations.\n`;
                notifyMsg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
                
                await sock.sendMessage(mainAdminJID, { text: notifyMsg });
              }
            } catch (e) {
              logger.warn(`Could not notify main admin: ${e.message}`);
            }
            
            // Notify session admin
            try {
              await delay(1000);
              
              const welcomeMsg = `🎉 *Welcome as Session Admin!*\n\n`;
              welcomeMsg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
              welcomeMsg += `📱 Session: *${name}*\n\n`;
              welcomeMsg += `You are now the admin for this WhatsApp session.\n\n`;
              welcomeMsg += `📋 *What this means:*\n`;
              welcomeMsg += `✅ You will receive all order notifications\n`;
              welcomeMsg += `✅ Orders also sent to main admin\n`;
              welcomeMsg += `✅ Orders posted in order group\n\n`;
              welcomeMsg += `🙏 Thank you for managing this session!\n`;
              welcomeMsg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
              
              await sock.sendMessage(adminSetup.adminJID, { text: welcomeMsg });
            } catch (e) {
              logger.warn(`Could not notify session admin: ${e.message}`);
            }
            
            pendingAdminSetup.delete(name);
          } catch (e) {
            logger.error(`Failed to set session admin: ${e.message}`);
          }
        }

        updateActiveSessions(sessions);
        updateBulkSenderSessions();

        // ==================== INITIALIZE SCHEDULER (ONCE) ====================
        if (!schedulerInitialized && sessions.size === 1) {
          schedulerInitialized = true;
          try {
            initScheduler(sock);
            logger.success('✅ Scheduler initialized (6:30 PM reports)');
          } catch (e) {
            logger.error(`❌ Scheduler init error: ${e.message}`);
            schedulerInitialized = false;
          }
        }
        
        // ==================== INITIALIZE REPORTING (ONCE) ====================
        if (!reportingInitialized && sessions.size >= 1) {
          reportingInitialized = true;
          try {
            initializeReporting(sock);
            logger.success('✅ Daily reporting initialized');
          } catch (e) {
            logger.error(`❌ Reporting init error: ${e.message}`);
            reportingInitialized = false;
          }
        }
        
        // ==================== STARTUP NOTIFICATION (ONCE) ====================
        if (!global.botStartupNotificationSent && sessions.size === 1) {
          try {
            const adminJid = CONFIG.ADMIN?.JID;
            if (adminJid) {
              await delay(2000);
              
              const startupMsg = `🚀 *Bot Started Successfully*\n\n`;
              startupMsg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
              startupMsg += `📱 Session: ${name}\n`;
              startupMsg += `⏰ Time: ${getTimestamp()}\n`;
              startupMsg += `📊 Scheduler: ${schedulerInitialized ? '✅ Active' : '❌ Inactive'}\n`;
              startupMsg += `📈 Reporting: ${reportingInitialized ? '✅ Active' : '❌ Inactive'}\n`;
              startupMsg += `🌐 Languages: 15 Indian languages\n`;
              startupMsg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
              startupMsg += `📋 Send "help" for admin commands`;
              
              await sock.sendMessage(adminJid, { text: startupMsg });
              global.botStartupNotificationSent = true;
              logger.success('✅ Startup notification sent');
            }
          } catch (e) {
            logger.warn(`Startup notification failed: ${e.message}`);
          }
        }
        
        // ==================== HEARTBEAT ====================
        const heartbeatInterval = setInterval(async () => {
          if (!sessions.has(name)) {
            clearInterval(heartbeatInterval);
            return;
          }
          
          try {
            if (sock.user?.id) {
              await sock.fetchStatus(sock.user.id);
            }
          } catch (e) {
            logger.debug(`[${name}] Heartbeat: ${e.message}`);
          }
        }, 30000); // Every 30 seconds
      }

      // ==================== CONNECTION CLOSED ====================
      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        const shouldRetry = code !== DisconnectReason.loggedOut;
        const reason = lastDisconnect?.error?.message || 'Unknown';
        
        logger.warn(`[${name}] Disconnected: ${code} - ${reason}`);

        sessions.delete(name);
        updateActiveSessions(sessions);
        updateBulkSenderSessions();

        // ==================== HANDLE DIFFERENT DISCONNECT REASONS ====================
        if (code === 401 || code === 515) {
          logger.error(`[${name}] ❌ Session invalid - delete ./sessions/${name} and reconnect`);
          sessionStats.delete(name);
          retryMap.delete(name);
          pairingCodeCache.delete(name);
          pendingAdminSetup.delete(name);
          connectionAttempts.delete(name);
        }
        else if (code === 440) {
          logger.error(`[${name}] ❌ Connection replaced - logged in elsewhere`);
          sessionStats.delete(name);
          retryMap.delete(name);
          connectionAttempts.delete(name);
        }
        else if (code === 428) {
          logger.error(`[${name}] ❌ Connection closed by server - wait before reconnecting`);
          await delay(10000);
          if (autoReconnectEnabled && connectionRetries < MAX_CONNECTION_RETRIES) {
            logger.info(`[${name}] Retrying connection...`);
            connect(name, mode, phone, adminPhone);
          }
        }
        else if (shouldRetry && autoReconnectEnabled) {
          connectionRetries++;
          connectionAttempts.set(name, connectionRetries);
          
          const retries = retryMap.get(name) || 0;
          
          if (retries < 10 && connectionRetries <= MAX_CONNECTION_RETRIES) {
            retryMap.set(name, retries + 1);
            const delayTime = Math.min(5000 * Math.pow(1.5, retries), 60000);
            
            logger.info(`[${name}] 🔄 Retry ${retries + 1}/10 in ${Math.floor(delayTime/1000)}s...`);
            
            await delay(delayTime);
            connect(name, mode, phone, adminPhone);
          } else {
            logger.error(`[${name}] ❌ Max retries reached`);
            sessionStats.delete(name);
            retryMap.delete(name);
            connectionAttempts.delete(name);
          }
        }
        else {
          logger.error(`[${name}] ❌ Logged out from WhatsApp`);
          sessionStats.delete(name);
          retryMap.delete(name);
          connectionAttempts.delete(name);
        }
      }
    });

    // ==================== MESSAGE HANDLER ====================
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
          
          // Handle admin commands first
          if (isAdmin && msgText.trim()) {
            // Session admin commands
            const handled1 = await handleSessionAdminCommand(sock, from, msgText, isAdmin);
            if (handled1) {
              updateSessionStats(name, 'message_handled');
              continue;
            }
            
            // General admin commands
            const handled2 = await handleAdminCommand(sock, from, msgText, isAdmin);
            if (handled2) {
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
    logger.error(`[${name}] ❌ Connection error: ${e.message}`);
    logger.debug(e.stack);
  }
}

// ========================= AUTO-START =========================
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
        logger.info(`🔄 Restoring session: ${dir}`);
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

// ========================= ENHANCED MENU =========================
async function menu() {
  console.log(`\n┌────────────────────────────────────────────────────────┐`);
  console.log(`🌟  ${CONFIG.BOT_NAME || 'Gyan Ganga Seva Bot'}  🌟`);
  console.log(`📦 Version: ${CONFIG.BOT_VERSION || '6.0.0'} | ⏰ ${getTimestamp()}`);
  console.log(`├────────────────────────────────────────────────────────┤`);
  console.log(`📱 Active Sessions: ${sessions.size} | 📨 Messages: ${totalMessagesHandled}`);
  console.log(`⏰ Scheduler: ${schedulerInitialized ? '✅' : '❌'} | 📊 Reporting: ${reportingInitialized ? '✅' : '❌'}`);
  console.log(`🔄 Auto-Reconnect: ${autoReconnectEnabled ? '✅ ON' : '❌ OFF'}`);
  console.log(`🌐 Languages: 15 Indian Languages Supported`);
  console.log(`└────────────────────────────────────────────────────────┘`);
  console.log(`\n📋 MENU OPTIONS:\n`);
  console.log(`1️⃣  - Link WhatsApp (Pairing Code + Optional Admin)`);
  console.log(`2️⃣  - Link WhatsApp (QR Code)`);
  console.log(`3️⃣  - Show Active Sessions`);
  console.log(`4️⃣  - Session Statistics`);
  console.log(`5️⃣  - Remove Session`);
  console.log(`6️⃣  - Toggle Auto-Reconnect`);
  console.log(`7️⃣  - Session Admins Management`);
  console.log(`8️⃣  - Bulk Sender Status`);
  console.log(`9️⃣  - Test Connection`);
  console.log(`0️⃣  - Exit Bot`);
  console.log(`└────────────────────────────────────────────────────────┘\n`);

  const choice = await ask('👉 Enter choice: ');

  if (choice === '1') {
    const name = await ask('📝 Session name: ');
    if (!name || name.trim() === '') {
      logger.error('❌ Invalid session name');
      return menu();
    }
    
    const phoneRaw = await ask('📞 WhatsApp Phone (with country code, e.g., 919876543210): ');
    const phone = normalizePhone(phoneRaw);
    if (!phone || phone.length < 10) {
      logger.error('❌ Invalid phone number (need 10+ digits)');
      return menu();
    }
    
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📋 OPTIONAL: Setup Session Admin`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`\nDo you want to set a specific admin for this session?`);
    console.log(`If YES, orders from this session will forward to:`);
    console.log(`  1. Main Admin (${CONFIG.ADMIN?.PHONE || 'Not set'})`);
    console.log(`  2. Session Admin (number you provide)`);
    console.log(`  3. Order Group`);
    console.log(`\nIf NO, only main admin and group will receive orders.\n`);
    
    const wantAdmin = await ask('Setup session admin? (y/n): ');
    
    let adminPhone = null;
    if (wantAdmin.toLowerCase() === 'y' || wantAdmin.toLowerCase() === 'yes') {
      const adminRaw = await ask('👤 Session Admin Phone (919876543210): ');
      adminPhone = normalizePhone(adminRaw);
      
      if (!adminPhone || adminPhone.length < 10) {
        logger.warn('⚠️  Invalid admin phone, skipping admin setup');
        adminPhone = null;
      } else {
        logger.info(`✅ Session admin will be set: +${adminPhone}`);
      }
    }
    
    logger.info(`🚀 Starting pairing: ${name} (+${phone})${adminPhone ? ` with admin +${adminPhone}` : ''}`);
    connect(name, 'pair', phone, adminPhone);
    console.log(`\n✅ Pairing code will appear in 5-10 seconds`);
    console.log(`⏰ Code will be valid for 5 minutes`);
    console.log(`📱 Check WhatsApp: Settings > Linked Devices > Link with Phone Number\n`);
    setTimeout(menu, 8000);
  }
  
  else if (choice === '2') {
    const name = await ask('📝 Session name: ');
    if (!name || name.trim() === '') {
      logger.error('❌ Invalid session name');
      return menu();
    }
    
    logger.info(`🚀 Starting QR mode: ${name}`);
    connect(name, 'qr');
    console.log(`\n✅ QR code will appear in 5-10 seconds`);
    console.log(`📱 Scan with WhatsApp: Settings > Linked Devices\n`);
    setTimeout(menu, 8000);
  }
  
  else if (choice === '3') {
    console.log(`\n┌────────────────────────────────────────────────────────┐`);
    console.log(`📊 ACTIVE SESSIONS: ${sessions.size}`);
    console.log(`├────────────────────────────────────────────────────────┤`);
    if (sessions.size === 0) {
      console.log('❌ No active sessions');
    } else {
      let i = 1;
      const admins = await getAllSessionAdmins();
      for (const [name, sock] of sessions) {
        const jid = sock.user?.id || 'Unknown';
        const phone = jid.split(':')[0];
        const stats = sessionStats.get(name);
        const sessionAdmin = admins[name];
        
        console.log(`\n${i}. 📱 ${name}`);
        console.log(`   📞 Phone: +${phone}`);
        if (sessionAdmin) {
          const adminPhone = sessionAdmin.split('@')[0];
          console.log(`   👤 Admin: +${adminPhone}`);
        } else {
          console.log(`   👤 Admin: None (Main admin only)`);
        }
        if (stats) {
          console.log(`   📨 Received: ${stats.messagesReceived}`);
          console.log(`   ✅ Handled: ${stats.messagesHandled}`);
          console.log(`   ❌ Errors: ${stats.errors}`);
          console.log(`   ⏰ Last Activity: ${stats.lastActivity?.toLocaleTimeString('hi-IN') || 'N/A'}`);
          const uptime = stats.connectedAt ? Math.floor((Date.now() - stats.connectedAt.getTime()) / 60000) : 0;
          console.log(`   🕐 Uptime: ${uptime} minutes`);
        }
        i++;
      }
    }
    console.log(`\n└────────────────────────────────────────────────────────┘\n`);
    setTimeout(menu, 1000);
  }
  
  else if (choice === '4') {
    console.log(`\n┌────────────────────────────────────────────────────────┐`);
    console.log(`📊 DETAILED SESSION STATISTICS`);
    console.log(`├────────────────────────────────────────────────────────┤`);
    console.log(`📈 Total Messages Handled: ${totalMessagesHandled}`);
    console.log(`📱 Active Sessions: ${sessions.size}`);
    console.log(`🗂️  Processed Message Cache: ${processedMessages.size}\n`);
    
    for (const [name, stats] of sessionStats) {
      const uptime = stats.connectedAt ? Math.floor((Date.now() - stats.connectedAt.getTime()) / 1000 / 60) : 0;
      const errorRate = stats.messagesReceived > 0 ? ((stats.errors / stats.messagesReceived) * 100).toFixed(2) : 0;
      
      console.log(`📱 ${name}:`);
      console.log(`   🕐 Connected: ${uptime} minutes ago`);
      console.log(`   📨 Messages Received: ${stats.messagesReceived}`);
      console.log(`   ✅ Messages Handled: ${stats.messagesHandled}`);
      console.log(`   ❌ Errors: ${stats.errors} (${errorRate}%)`);
      console.log(`   ⏰ Last Activity: ${stats.lastActivity?.toLocaleString('hi-IN') || 'N/A'}`);
      console.log(`   📅 Connected At: ${stats.connectedAt?.toLocaleString('hi-IN') || 'N/A'}\n`);
    }
    console.log(`└────────────────────────────────────────────────────────┘\n`);
    setTimeout(menu, 1000);
  }
  
  else if (choice === '5') {
    const name = await ask('📝 Session name to remove: ');
    if (sessions.has(name)) {
      const sock = sessions.get(name);
      
      try {
        await sock.logout();
      } catch (e) {
        logger.warn('Could not logout gracefully');
      }
      
      sessions.delete(name);
      sessionStats.delete(name);
      retryMap.delete(name);
      connectionAttempts.delete(name);
      
      updateActiveSessions(sessions);
      updateBulkSenderSessions();
      
      logger.success(`✅ Removed session: ${name}`);
      console.log(`💡 TIP: Delete ./sessions/${name} folder to remove completely`);
      console.log(`   This prevents auto-restore on next startup\n`);
    } else {
      logger.error(`❌ Session not found: ${name}`);
    }
    setTimeout(menu, 1000);
  }
  
  else if (choice === '6') {
    autoReconnectEnabled = !autoReconnectEnabled;
    logger.success(`🔄 Auto-Reconnect ${autoReconnectEnabled ? 'ENABLED ✅' : 'DISABLED ❌'}`);
    setTimeout(menu, 1000);
  }
  
  else if (choice === '7') {
    try {
      const admins = await getAllSessionAdmins();
      
      console.log(`\n┌────────────────────────────────────────────────────────┐`);
      console.log(`👥 SESSION ADMINS MANAGEMENT`);
      console.log(`├────────────────────────────────────────────────────────┤`);
      
      if (Object.keys(admins).length === 0) {
        console.log('❌ No session admins configured');
        console.log('\n📋 How to setup:');
        console.log('   1. During pairing (Option 1)');
        console.log('   2. Via WhatsApp: Send "setadmin <session>" to main admin');
        console.log('   3. Via CLI: Use session admin commands\n');
      } else {
        for (const [session, jid] of Object.entries(admins)) {
          const phone = jid.split('@')[0];
          const isActive = sessions.has(session);
          console.log(`\n📱 ${session} ${isActive ? '🟢' : '🔴'}`);
          console.log(`   👤 Admin: +${phone}`);
          console.log(`   📝 JID: ${jid}`);
        }
      }
      
      console.log(`\n📊 Statistics:`);
      console.log(`   Total Sessions: ${sessions.size}`);
      console.log(`   With Admins: ${Object.keys(admins).length}`);
      console.log(`   Without Admins: ${sessions.size - Object.keys(admins).length}`);
      
      console.log(`\n└────────────────────────────────────────────────────────┘\n`);
    } catch (e) {
      logger.error(`❌ Error loading admins: ${e.message}`);
    }
    setTimeout(menu, 1000);
  }
  
  else if (choice === '8') {
    try {
      const bulkSender = getBulkSender();
      const status = await bulkSender.getStatus();
      
      console.log(`\n┌────────────────────────────────────────────────────────┐`);
      console.log(`📤 BULK SENDER STATUS`);
      console.log(`├────────────────────────────────────────────────────────┤`);
      console.log(`Status: ${status.running ? '🟢 Running' : '🔴 Stopped'}${status.paused ? ' (⏸️  PAUSED)' : ''}`);
      console.log(`Business Hours: ${status.businessHours ? '🟢 Active' : '🔴 Inactive'}`);
      console.log(`Available Sessions: ${status.sessions}`);
      console.log(`Active Campaigns: ${status.activeCampaigns}`);
      console.log(`Queued Campaigns: ${status.queuedCampaigns}`);
      console.log(`\n📊 Global Statistics:`);
      console.log(`   Total Sent: ${status.globalStats.totalSent}`);
      console.log(`   Total Failed: ${status.globalStats.totalFailed}`);
      console.log(`   Campaigns Completed: ${status.globalStats.campaignsCompleted}`);
      console.log(`   Success Rate: ${status.globalStats.totalSent > 0 ? ((status.globalStats.totalSent / (status.globalStats.totalSent + status.globalStats.totalFailed)) * 100).toFixed(2) : 0}%`);
      console.log(`\n└────────────────────────────────────────────────────────┘\n`);
    } catch (e) {
      logger.error(`❌ Error getting bulk status: ${e.message}`);
    }
    setTimeout(menu, 1000);
  }
  
  else if (choice === '9') {
    console.log(`\n┌────────────────────────────────────────────────────────┐`);
    console.log(`🔧 CONNECTION TEST`);
    console.log(`├────────────────────────────────────────────────────────┤`);
    
    if (sessions.size === 0) {
      console.log('❌ No active sessions to test');
    } else {
      console.log(`Testing ${sessions.size} session(s)...\n`);
      
      for (const [name, sock] of sessions) {
        try {
          console.log(`📱 ${name}:`);
          
          // Test 1: Check connection
          const isConnected = sock.ws?.readyState === 1;
          console.log(`   Connection: ${isConnected ? '✅ Active' : '❌ Inactive'}`);
          
          // Test 2: Fetch user status
          try {
            if (sock.user?.id) {
              await sock.fetchStatus(sock.user.id);
              console.log(`   Status Fetch: ✅ Success`);
            }
          } catch (e) {
            console.log(`   Status Fetch: ❌ Failed (${e.message})`);
          }
          
          // Test 3: Check stats
          const stats = sessionStats.get(name);
          if (stats) {
            const timeSinceLastActivity = stats.lastActivity ? Math.floor((Date.now() - stats.lastActivity.getTime()) / 1000 / 60) : -1;
            console.log(`   Last Activity: ${timeSinceLastActivity >= 0 ? `${timeSinceLastActivity} min ago` : 'Never'}`);
          }
          
          console.log('');
        } catch (e) {
          console.log(`   ❌ Test Failed: ${e.message}\n`);
        }
      }
    }
    
    console.log(`└────────────────────────────────────────────────────────┘\n`);
    setTimeout(menu, 1000);
  }
  
  else if (choice === '0') {
    console.log(`\n┌────────────────────────────────────────────────────────┐`);
    console.log(`👋 Shutting down ${CONFIG.BOT_NAME || 'Bot'}...`);
    console.log(`├────────────────────────────────────────────────────────┤`);
    console.log(`💾 Sessions saved: ${sessions.size}`);
    console.log(`📨 Total messages handled: ${totalMessagesHandled}`);
    console.log(`⏰ Shutdown time: ${getTimestamp()}`);
    console.log(`└────────────────────────────────────────────────────────┘\n`);
    
    // Cleanup
    try {
      stopScheduler();
      logger.success('✅ Scheduler stopped');
    } catch (e) {
      logger.warn('Scheduler stop error');
    }
    
    // Logout all sessions gracefully
    for (const [name, sock] of sessions) {
      try {
        await sock.end();
      } catch (e) {
        logger.debug(`Could not end ${name} gracefully`);
      }
    }
    
    rl.close();
    process.exit(0);
  }
  
  else {
    logger.error('❌ Invalid choice');
    setTimeout(menu, 500);
  }
}

// ========================= MAIN STARTUP =========================
(async () => {
  console.clear();
  console.log('\n┌────────────────────────────────────────────────────────┐');
  console.log(`🚀 ${CONFIG.BOT_NAME || 'Gyan Ganga Seva Bot'}`);
  console.log(`📦 Version: ${CONFIG.BOT_VERSION || '6.0.0'}`);
  console.log(`⏰ Started: ${getTimestamp()}`);
  console.log(`🌐 15 Indian Languages Support`);
  console.log('└────────────────────────────────────────────────────────┘\n');

  logger.info('🔧 Initializing bot systems...');
  
  // Ensure required directories
  const dirs = ['./sessions', './data', './logs'];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.success(`✅ Created directory: ${dir}`);
    }
  }
  
  // Auto-restore sessions
  logger.info('🔄 Checking for saved sessions...');
  const restored = await autoStartAll();
  
  if (restored > 0) {
    console.log(`\n┌────────────────────────────────────────────────────────┐`);
    logger.success(`✅ Restored ${restored} session(s)`);
    logger.info(`👤 Main Admin: ${CONFIG.ADMIN?.PHONE || 'Not configured'}`);
    console.log(`└────────────────────────────────────────────────────────┘\n`);
  } else {
    console.log(`\n┌────────────────────────────────────────────────────────┐`);
    logger.warn('⚠️  No saved sessions found');
    logger.info('📱 Link your first WhatsApp account from menu');
    console.log(`└────────────────────────────────────────────────────────┘\n`);
  }

  await delay(2000);
  menu();
})();

// ========================= ERROR HANDLERS =========================
process.on('SIGINT', async () => {
  console.log(`\n\n┌────────────────────────────────────────────────────────┐`);
  logger.info('🛑 Graceful shutdown initiated...');
  console.log(`├────────────────────────────────────────────────────────┤`);
  console.log(`💾 Saving ${sessions.size} session(s)...`);
  console.log(`📨 Total messages handled: ${totalMessagesHandled}`);
  console.log(`⏰ Shutdown time: ${getTimestamp()}`);
  
  try {
    stopScheduler();
    logger.success('✅ Scheduler stopped');
  } catch (e) {
    logger.warn('⚠️  Scheduler already stopped');
  }
  
  // Logout all sessions
  for (const [name, sock] of sessions) {
    try {
      await sock.end();
      logger.success(`✅ ${name} logged out`);
    } catch (e) {
      logger.debug(`${name} end error: ${e.message}`);
    }
  }
  
  console.log(`└────────────────────────────────────────────────────────┘\n`);
  rl.close();
  process.exit(0);
});

process.on('uncaughtException', (e) => {
  // Ignore common Baileys errors
  if (e.message?.includes('Bad MAC') || 
      e.message?.includes('Connection Closed') ||
      e.message?.includes('Stream Errored')) {
    return;
  }
  logger.error(`❌ Uncaught Exception: ${e.message}`);
  logger.debug(e.stack);
});

process.on('unhandledRejection', (e) => {
  // Ignore common Baileys errors
  if (e?.message?.includes('Bad MAC') || 
      e?.message?.includes('Connection Closed') ||
      e?.message?.includes('Stream Errored') ||
      e?.message?.includes('Socket Closed')) {
    return;
  }
  logger.error(`❌ Unhandled Rejection: ${e?.message || e}`);
  if (e?.stack) {
    logger.debug(e.stack);
  }
});

// ========================= GRACEFUL CLEANUP =========================
process.on('exit', (code) => {
  logger.info(`Process exiting with code: ${code}`);
});

// ========================= EXPORTS =========================
export { sessions, sessionStats, totalMessagesHandled };
