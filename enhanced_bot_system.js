import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  Browsers,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  delay,
  makeInMemoryStore,
  WASocket
} from '@whiskeysockets/baileys';
import P from 'pino';
import readline from 'readline';
import qrcode from 'qrcode-terminal';
import fs from 'fs-extra';
import path from 'path';
import { handleMessage } from './handlers/messageHandler.js';
import { handleAdminCommand, updateActiveSessions } from './handlers/adminHandler.js';
import { initScheduler, stopScheduler } from './utils/scheduler.js';
import { getBulkSender } from './utils/bulkSender.js';
import CONFIG from './config.js';

// ==================== ENHANCED LOGGER ====================
class Logger {
  constructor() {
    this.logFile = './logs/bot.log';
    this.ensureLogDir();
  }

  ensureLogDir() {
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  format(level, msg) {
    const timestamp = new Date().toLocaleString('hi-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    return `[${timestamp}] [${level}] ${msg}`;
  }

  writeToFile(level, msg) {
    try {
      const logEntry = this.format(level, msg) + '\n';
      fs.appendFileSync(this.logFile, logEntry);
    } catch (error) {
      // Silent fail for logging errors
    }
  }

  info(msg) {
    const formatted = this.format('INFO', msg);
    console.log(`\x1b[36m${formatted}\x1b[0m`);
    this.writeToFile('INFO', msg);
  }

  success(msg) {
    const formatted = this.format('SUCCESS', msg);
    console.log(`\x1b[32m${formatted}\x1b[0m`);
    this.writeToFile('SUCCESS', msg);
  }

  warn(msg) {
    const formatted = this.format('WARN', msg);
    console.log(`\x1b[33m${formatted}\x1b[0m`);
    this.writeToFile('WARN', msg);
  }

  error(msg) {
    const formatted = this.format('ERROR', msg);
    console.log(`\x1b[31m${formatted}\x1b[0m`);
    this.writeToFile('ERROR', msg);
  }

  debug(msg) {
    if (process.env.DEBUG === 'true') {
      const formatted = this.format('DEBUG', msg);
      console.log(`\x1b[35m${formatted}\x1b[0m`);
      this.writeToFile('DEBUG', msg);
    }
  }
}

const logger = new Logger();

// ==================== ADVANCED CONNECTION MANAGER ====================
class ConnectionManager {
  constructor() {
    this.sessions = new Map();
    this.retryMap = new Map();
    this.reconnectTimers = new Map();
    this.healthCheckTimers = new Map();
    this.sessionStats = new Map();
    this.connectionAttempts = new Map();
    
    // Advanced retry configuration
    this.maxRetries = 15;
    this.baseRetryDelay = 5000; // 5 seconds
    this.maxRetryDelay = 120000; // 2 minutes
    this.healthCheckInterval = 60000; // 1 minute
    this.connectionTimeout = 90000; // 90 seconds
    
    // Connection state tracking
    this.connectingStates = new Set();
    this.lastSuccessfulConnection = new Map();
    this.failedConnectionCount = new Map();
  }

  getRetryDelay(retryCount) {
    // Exponential backoff with jitter
    const exponentialDelay = Math.min(
      this.baseRetryDelay * Math.pow(1.5, retryCount),
      this.maxRetryDelay
    );
    const jitter = Math.random() * 3000; // 0-3 seconds random jitter
    return Math.floor(exponentialDelay + jitter);
  }

  isConnecting(sessionName) {
    return this.connectingStates.has(sessionName);
  }

  markConnecting(sessionName) {
    this.connectingStates.add(sessionName);
  }

  markNotConnecting(sessionName) {
    this.connectingStates.delete(sessionName);
  }

  canAttemptConnection(sessionName) {
    const attempts = this.connectionAttempts.get(sessionName) || 0;
    const lastSuccess = this.lastSuccessfulConnection.get(sessionName);
    
    // Reset attempts if last success was more than 1 hour ago
    if (lastSuccess && (Date.now() - lastSuccess) > 3600000) {
      this.connectionAttempts.set(sessionName, 0);
      return true;
    }
    
    return attempts < this.maxRetries;
  }

  recordConnectionAttempt(sessionName) {
    const attempts = (this.connectionAttempts.get(sessionName) || 0) + 1;
    this.connectionAttempts.set(sessionName, attempts);
  }

  recordSuccessfulConnection(sessionName) {
    this.lastSuccessfulConnection.set(sessionName, Date.now());
    this.connectionAttempts.set(sessionName, 0);
    this.failedConnectionCount.set(sessionName, 0);
  }

  recordFailedConnection(sessionName) {
    const failed = (this.failedConnectionCount.get(sessionName) || 0) + 1;
    this.failedConnectionCount.set(sessionName, failed);
  }

  shouldThrottle(sessionName) {
    const failed = this.failedConnectionCount.get(sessionName) || 0;
    return failed > 5; // Throttle after 5 consecutive failures
  }

  getSession(sessionName) {
    return this.sessions.get(sessionName);
  }

  getAllSessions() {
    return this.sessions;
  }

  addSession(sessionName, socket) {
    this.sessions.set(sessionName, socket);
    this.recordSuccessfulConnection(sessionName);
    this.startHealthCheck(sessionName);
  }

  removeSession(sessionName) {
    this.sessions.delete(sessionName);
    this.stopHealthCheck(sessionName);
    this.stopReconnectTimer(sessionName);
  }

  startHealthCheck(sessionName) {
    this.stopHealthCheck(sessionName);
    
    const timer = setInterval(async () => {
      const socket = this.sessions.get(sessionName);
      if (!socket || !socket.user) {
        logger.warn(`[${sessionName}] Health check failed - socket not connected`);
        this.removeSession(sessionName);
        return;
      }

      try {
        // Ping check - just verify socket is responsive
        if (socket.ws && socket.ws.readyState === 1) {
          logger.debug(`[${sessionName}] Health check passed`);
        } else {
          logger.warn(`[${sessionName}] WebSocket not in OPEN state`);
        }
      } catch (error) {
        logger.warn(`[${sessionName}] Health check error: ${error.message}`);
      }
    }, this.healthCheckInterval);

    this.healthCheckTimers.set(sessionName, timer);
  }

  stopHealthCheck(sessionName) {
    const timer = this.healthCheckTimers.get(sessionName);
    if (timer) {
      clearInterval(timer);
      this.healthCheckTimers.delete(sessionName);
    }
  }

  scheduleReconnect(sessionName, mode, phone, delayMs) {
    this.stopReconnectTimer(sessionName);
    
    logger.info(`[${sessionName}] Reconnect scheduled in ${Math.floor(delayMs / 1000)}s`);
    
    const timer = setTimeout(() => {
      this.reconnectTimers.delete(sessionName);
      if (!this.isConnecting(sessionName)) {
        connect(sessionName, mode, phone).catch(err => {
          logger.error(`[${sessionName}] Reconnect failed: ${err.message}`);
        });
      }
    }, delayMs);

    this.reconnectTimers.set(sessionName, timer);
  }

  stopReconnectTimer(sessionName) {
    const timer = this.reconnectTimers.get(sessionName);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(sessionName);
    }
  }

  cleanup() {
    // Clean up all timers
    for (const [sessionName] of this.healthCheckTimers) {
      this.stopHealthCheck(sessionName);
    }
    for (const [sessionName] of this.reconnectTimers) {
      this.stopReconnectTimer(sessionName);
    }
  }

  getStats(sessionName) {
    if (!this.sessionStats.has(sessionName)) {
      this.sessionStats.set(sessionName, {
        messagesReceived: 0,
        messagesHandled: 0,
        errors: 0,
        lastActivity: null,
        connectedAt: new Date(),
        reconnectCount: 0
      });
    }
    return this.sessionStats.get(sessionName);
  }

  updateStats(sessionName, action) {
    const stats = this.getStats(sessionName);
    
    if (action === 'message_received') stats.messagesReceived++;
    if (action === 'message_handled') stats.messagesHandled++;
    if (action === 'error') stats.errors++;
    if (action === 'reconnect') stats.reconnectCount++;
    
    stats.lastActivity = new Date();
    this.sessionStats.set(sessionName, stats);
  }
}

// Global connection manager instance
const connectionManager = new ConnectionManager();

// ==================== MESSAGE DEDUPLICATION ====================
class MessageDeduplicator {
  constructor(maxSize = 2000) {
    this.processedMessages = new Map();
    this.maxSize = maxSize;
    this.cleanupInterval = 300000; // 5 minutes
    this.startCleanup();
  }

  getMessageId(msg) {
    const from = msg.key?.remoteJid || '';
    const msgId = msg.key?.id || '';
    const timestamp = msg.messageTimestamp || Date.now();
    return `${from}_${msgId}_${timestamp}`;
  }

  isProcessed(messageId) {
    return this.processedMessages.has(messageId);
  }

  markProcessed(messageId) {
    this.processedMessages.set(messageId, Date.now());
    
    if (this.processedMessages.size > this.maxSize) {
      this.cleanup();
    }
  }

  cleanup() {
    const now = Date.now();
    const expireTime = 600000; // 10 minutes
    
    for (const [id, timestamp] of this.processedMessages.entries()) {
      if (now - timestamp > expireTime) {
        this.processedMessages.delete(id);
      }
    }
    
    logger.debug(`Cleaned up message cache. Size: ${this.processedMessages.size}`);
  }

  startCleanup() {
    setInterval(() => this.cleanup(), this.cleanupInterval);
  }
}

const messageDeduplicator = new MessageDeduplicator();

// ==================== UTILITY FUNCTIONS ====================
const rl = readline.createInterface({ 
  input: process.stdin, 
  output: process.stdout 
});

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
  
  // Handle Indian numbers
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    cleaned = cleaned.substring(2);
  }
  
  if (cleaned.length < 10) return null;
  if (cleaned.length === 10 && /^[6-9]/.test(cleaned)) {
    return cleaned;
  }
  
  return cleaned.length === 10 ? cleaned : null;
}

// ==================== STORE MANAGEMENT ====================
function createMessageStore(sessionName) {
  const store = makeInMemoryStore({
    logger: P({ level: 'silent' })
  });
  
  const storePath = `./sessions/${sessionName}/store.json`;
  
  // Load existing store
  if (fs.existsSync(storePath)) {
    try {
      store.readFromFile(storePath);
    } catch (error) {
      logger.warn(`[${sessionName}] Could not read store file`);
    }
  }
  
  // Save store periodically
  setInterval(() => {
    try {
      store.writeToFile(storePath);
    } catch (error) {
      logger.debug(`[${sessionName}] Store save error: ${error.message}`);
    }
  }, 30000);
  
  return store;
}

// ==================== ENHANCED CONNECTION FUNCTION ====================
async function connect(name, mode, phone = null) {
  if (connectionManager.isConnecting(name)) {
    logger.warn(`[${name}] Already connecting, skipping duplicate attempt`);
    return;
  }

  if (!connectionManager.canAttemptConnection(name)) {
    logger.error(`[${name}] Max connection attempts reached`);
    return;
  }

  connectionManager.markConnecting(name);
  connectionManager.recordConnectionAttempt(name);

  try {
    logger.info(`[${name}] Initializing connection (mode: ${mode})`);
    
    const sessionPath = path.join('./sessions', name);
    await fs.ensureDir(sessionPath);
    
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();
    
    // Create message store
    const store = createMessageStore(name);
    
    const sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, P({ level: 'silent' }))
      },
      logger: P({ level: 'silent' }),
      browser: Browsers.ubuntu('Chrome'),
      printQRInTerminal: false,
      syncFullHistory: false,
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: true,
      connectTimeoutMs: 90000,
      defaultQueryTimeoutMs: undefined,
      keepAliveIntervalMs: 25000,
      emitOwnEvents: false,
      fireInitQueries: true,
      retryRequestDelayMs: 250,
      maxMsgRetryCount: 5,
      msgRetryCounterMap: {},
      getMessage: async (key) => {
        if (store) {
          const msg = await store.loadMessage(key.remoteJid, key.id);
          return msg?.message || undefined;
        }
        return undefined;
      }
    });

    // Bind store to socket
    if (store) {
      store.bind(sock.ev);
    }

    let pairingCodeAttempted = false;
    let connectionEstablished = false;
    let qrRetryCount = 0;
    const maxQrRetries = 3;

    // Connection timeout handler
    const connectionTimeout = setTimeout(() => {
      if (!connectionEstablished) {
        logger.error(`[${name}] Connection timeout after 90s`);
        sock.end(undefined);
      }
    }, 90000);

    sock.ev.on('creds.update', saveCreds);
    
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr, isNewLogin } = update;

      // QR Code handling with retry logic
      if (mode === 'qr' && qr && !state.creds.registered) {
        qrRetryCount++;
        
        if (qrRetryCount <= maxQrRetries) {
          console.log(`\n${'='.repeat(50)}`);
          console.log(`📱 SCAN QR CODE [${name}] - Attempt ${qrRetryCount}/${maxQrRetries}`);
          console.log(`${'='.repeat(50)}`);
          qrcode.generate(qr, { small: true });
          console.log(`\n⏱️  QR expires in 60 seconds`);
          console.log(`📲 WhatsApp > Linked Devices > Link a Device\n`);
        } else {
          logger.error(`[${name}] QR retry limit reached`);
          sock.end(undefined);
        }
      }

      // Pairing code handling (improved stability)
      if (mode === 'pair' && !pairingCodeAttempted && !state.creds.registered && phone) {
        if (connection === 'open' || connection === 'connecting') {
          pairingCodeAttempted = true;
          
          await delay(3000); // Wait for stable connection
          
          try {
            const cleanPhone = normalizePhone(phone);
            if (!cleanPhone) {
              throw new Error('Invalid phone number format');
            }
            
            logger.info(`[${name}] Requesting pairing code for ${cleanPhone}`);
            const code = await sock.requestPairingCode(cleanPhone);
            
            console.log(`\n${'='.repeat(50)}`);
            console.log(`🔐 PAIRING CODE FOR [${name}]`);
            console.log(`${'='.repeat(50)}`);
            console.log(`📱 Phone: +91${cleanPhone}`);
            console.log(`🔑 Code: ${code}`);
            console.log(`${'='.repeat(50)}`);
            console.log(`\n⏱️  Valid for 1 minute`);
            console.log(`📲 Enter code in: WhatsApp > Linked Devices > Link with Phone Number\n`);

            // Send code to admin
            try {
              const adminJid = CONFIG.ADMIN?.JID;
              if (adminJid) {
                const pairMessage = `🔐 *Pairing Code Generated*\n\n` +
                  `📱 Session: *${name}*\n` +
                  `☎️ Phone: +91${cleanPhone}\n` +
                  `🔑 Code: \`${code}\`\n\n` +
                  `⏱️ Valid for 1 minute\n\n` +
                  `Enter this code in WhatsApp:\n` +
                  `Settings > Linked Devices > Link with Phone Number`;
                
                await sock.sendMessage(adminJid, { text: pairMessage });
              }
            } catch (e) {
              logger.warn(`[${name}] Could not send pairing code to admin: ${e.message}`);
            }
          } catch (e) {
            logger.error(`[${name}] Pairing error: ${e.message}`);
            sock.end(undefined);
          }
        }
      }

      // Connection opened successfully
      if (connection === 'open') {
        clearTimeout(connectionTimeout);
        connectionEstablished = true;
        connectionManager.markNotConnecting(name);
        
        logger.success(`✅ [${name}] Connected at ${getTimestamp()}`);
        
        connectionManager.addSession(name, sock);
        connectionManager.retryMap.delete(name);

        // Update admin handler
        updateActiveSessions(connectionManager.getAllSessions());
        
        // Update bulk sender
        try {
          const bulkSender = getBulkSender();
          bulkSender.updateSessions(connectionManager.getAllSessions());
        } catch (e) {
          logger.warn('Bulk sender update pending');
        }

        // Initialize scheduler (only once)
        if (connectionManager.getAllSessions().size === 1 && !global.schedulerInitialized) {
          try {
            initScheduler(sock);
            global.schedulerInitialized = true;
            logger.success('✅ Scheduler initialized');
          } catch (e) {
            logger.error(`Scheduler init error: ${e.message}`);
          }
        }
        
        // Send startup notification
        try {
          const adminJid = CONFIG.ADMIN?.JID;
          if (adminJid) {
            const startupMsg = `🚀 *Session Connected*\n\n` +
              `📱 Session: ${name}\n` +
              `📞 Phone: ${sock.user?.id?.split(':')[0] || 'Unknown'}\n` +
              `⏰ Time: ${getTimestamp()}\n` +
              `🔄 Total Sessions: ${connectionManager.getAllSessions().size}\n` +
              `📊 Scheduler: ${global.schedulerInitialized ? '✅' : '⏳'}\n` +
              `📤 Bulk Sender: ✅ Ready\n\n` +
              `Use *help* to see commands`;
            
            await sock.sendMessage(adminJid, { text: startupMsg });
          }
        } catch (e) {
          logger.warn(`[${name}] Could not send startup notification`);
        }
      }

      // Connection closed - handle reconnection
      if (connection === 'close') {
        clearTimeout(connectionTimeout);
        connectionManager.markNotConnecting(name);
        
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldRetry = statusCode !== DisconnectReason.loggedOut;
        
        logger.warn(`[${name}] Disconnected: code=${statusCode} at ${getTimestamp()}`);

        // Remove from active sessions
        connectionManager.removeSession(name);
        updateActiveSessions(connectionManager.getAllSessions());
        
        // Update bulk sender
        try {
          const bulkSender = getBulkSender();
          bulkSender.updateSessions(connectionManager.getAllSessions());
        } catch (e) {
          // Bulk sender might not be initialized yet
        }

        // Handle specific disconnect reasons
        if (statusCode === 401 || statusCode === 515) {
          logger.error(`[${name}] Session invalid (code: ${statusCode})`);
          logger.error(`[${name}] Action required: Delete ./sessions/${name} and reconnect`);
          connectionManager.failedConnectionCount.delete(name);
          connectionManager.connectionAttempts.delete(name);
        }
        else if (statusCode === DisconnectReason.loggedOut) {
          logger.error(`[${name}] Logged out from WhatsApp`);
          connectionManager.connectionAttempts.delete(name);
        }
        else if (shouldRetry && global.autoReconnectEnabled) {
          const retries = connectionManager.retryMap.get(name) || 0;
          
          if (retries < connectionManager.maxRetries && !connectionManager.shouldThrottle(name)) {
            connectionManager.retryMap.set(name, retries + 1);
            connectionManager.recordFailedConnection(name);
            
            const delayTime = connectionManager.getRetryDelay(retries);
            
            logger.info(`[${name}] Retry ${retries + 1}/${connectionManager.maxRetries} in ${Math.floor(delayTime/1000)}s`);
            
            connectionManager.scheduleReconnect(name, mode, phone, delayTime);
          } else if (connectionManager.shouldThrottle(name)) {
            logger.error(`[${name}] Connection throttled due to repeated failures`);
            logger.error(`[${name}] Wait 10 minutes before manual reconnect`);
          } else {
            logger.error(`[${name}] Max retries reached (${connectionManager.maxRetries})`);
            connectionManager.connectionAttempts.delete(name);
          }
        }
        else {
          logger.error(`[${name}] Connection closed, auto-reconnect disabled`);
        }
      }
    });

    // Enhanced message handler with deduplication
    sock.ev.on('messages.upsert', async ({ messages }) => {
      for (const m of messages) {
        try {
          if (!m.message || m.key.fromMe) continue;
          
          const messageId = messageDeduplicator.getMessageId(m);
          
          if (messageDeduplicator.isProcessed(messageId)) {
            logger.debug(`[${name}] Duplicate message skipped`);
            continue;
          }
          
          messageDeduplicator.markProcessed(messageId);
          
          const from = m.key?.remoteJid;
          const msgText = m.message?.conversation || 
                         m.message?.extendedTextMessage?.text || '';
          
          connectionManager.updateStats(name, 'message_received');
          
          const isAdmin = CONFIG.ADMIN && from === CONFIG.ADMIN.JID;
          
          // Handle admin commands first
          if (isAdmin && msgText.trim()) {
            const handled = await handleAdminCommand(sock, from, msgText, isAdmin);
            if (handled) {
              connectionManager.updateStats(name, 'message_handled');
              continue;
            }
          }
          
          // Handle regular messages
          await handleMessage(sock, m, name);
          connectionManager.updateStats(name, 'message_handled');
          
        } catch (e) {
          logger.error(`[${name}] Message handler error: ${e.message}`);
          connectionManager.updateStats(name, 'error');
        }
      }
    });

    // Enhanced error handlers
    sock.ev.on('connection.error', (error) => {
      logger.error(`[${name}] Connection error: ${error.message}`);
    });

  } catch (e) {
    connectionManager.markNotConnecting(name);
    logger.error(`[${name}] Connection setup error: ${e.message}`);
    
    // Retry on setup errors
    if (connectionManager.canAttemptConnection(name)) {
      const delayTime = connectionManager.getRetryDelay(
        connectionManager.connectionAttempts.get(name) || 0
      );
      connectionManager.scheduleReconnect(name, mode, phone, delayTime);
    }
  }
}

// ==================== AUTO-START FUNCTION ====================
async function autoStartAll() {
  try {
    const sessionsDir = './sessions';
    
    if (!fs.existsSync(sessionsDir)) {
      await fs.mkdir(sessionsDir, { recursive: true });
      logger.info('Created sessions directory');
      return 0;
    }
    
    const dirs = await fs.readdir(sessionsDir);
    let restored = 0;
    
    for (const dir of dirs) {
      const credsPath = path.join(sessionsDir, dir, 'creds.json');
      
      if (await fs.pathExists(credsPath)) {
        logger.info(`🔄 Restoring session: ${dir}`);
        
        connect(dir, 'qr').catch(err => {
          logger.error(`Failed to restore ${dir}: ${err.message}`);
        });
        
        restored++;
        await delay(4000); // Stagger connections
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
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🌟  ${CONFIG.BOT?.NAME || 'Gyan Ganga Seva Bot'}  🌟`);
  console.log(`Version ${CONFIG.BOT?.VERSION || '3.0.0'} | ${getTimestamp()}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`📱 Active Sessions: ${connectionManager.getAllSessions().size}`);
  console.log(`📊 Scheduler: ${global.schedulerInitialized ? '✅ Running' : '⏳ Pending'}`);
  console.log(`📤 Bulk Sender: ✅ Ready`);
  console.log(`🔄 Auto-Reconnect: ${global.autoReconnectEnabled ? '✅ ON' : '⏸️ OFF'}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`\n📋 MENU OPTIONS:\n`);
  console.log(`1️⃣  - Link WhatsApp (Pairing Code)`);
  console.log(`2️⃣  - Link WhatsApp (QR Code)`);
  console.log(`3️⃣  - Show Active Sessions`);
  console.log(`4️⃣  - Session Statistics`);
  console.log(`5️⃣  - Remove Session`);
  console.log(`6️⃣  - Toggle Auto-Reconnect`);
  console.log(`7️⃣  - Bulk Sender Status`);
  console.log(`8️⃣  - System Health Check`);
  console.log(`9️⃣  - Clear Session Cache`);
  console.log(`0️⃣  - Exit Bot`);
  console.log(`${'='.repeat(60)}\n`);

  const choice = await ask('👉 Enter choice: ');

  if (choice === '1') {
    const name = await ask('📝 Session name: ');
    if (!name || name.trim() === '') {
      logger.error('Invalid session name');
      return menu();
    }
    
    const phoneRaw = await ask('📞 Phone number (10 digits): ');
    const phone = normalizePhone(phoneRaw);
    
    if (!phone || phone.length !== 10) {
      logger.error('Invalid phone number. Must be 10 digits starting with 6-9');
      return menu();
    }
    
    logger.info(`Starting pairing for ${name} (+91${phone})`);
    connect(name, 'pair', phone);
    console.log(`\n✅ Pairing code will appear in 3-5 seconds\n`);
    setTimeout(menu, 6000);
  }
  
  else if (choice === '2') {
    const name = await ask('📝 Session name: ');
    if (!name || name.trim() === '') {
      logger.error('Invalid session name');
      return menu();
    }
    
    logger.info(`Starting QR mode for ${name}`);
    connect(name, 'qr');
    console.log(`\n✅ QR code will appear in 3-5 seconds\n`);
    setTimeout(menu, 6000);
  }
  
  else if (choice === '3') {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 ACTIVE SESSIONS: ${connectionManager.getAllSessions().size}`);
    console.log(`${'='.repeat(60)}`);
    
    if (connectionManager.getAllSessions().size === 0) {
      console.log('⚠️  No active sessions found');
    } else {
      let i = 1;
      for (const [name, sock] of connectionManager.getAllSessions()) {
        const jid = sock.user?.id || 'Unknown';
        const phone = jid.split(':')[0];
        const stats = connectionManager.getStats(name);
        
        console.log(`\n${i}. 📱 ${name}`);
        console.log(`   ☎️  Phone: +${phone}`);
        console.log(`   📨 Received: ${stats.messagesReceived}`);
        console.log(`   ✅ Handled: ${stats.messagesHandled}`);
        console.log(`   ❌ Errors: ${stats.errors}`);
        console.log(`   🔄 Reconnects: ${stats.reconnectCount}`);
        console.log(`   ⏰ Last Activity: ${stats.lastActivity?.toLocaleString('hi-IN') || 'N/A'}`);
        console.log(`   🕐 Connected: ${stats.connectedAt.toLocaleString('hi-IN')}`);
        i++;
      }
    }
    console.log(`\n${'='.repeat(60)}\n`);
    setTimeout(menu, 1000);
  }
  
  else if (choice === '4') {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 DETAILED SESSION STATISTICS`);
    console.log(`${'='.repeat(60)}`);
    
    let totalMessages = 0;
    let totalErrors = 0;
    
    for (const [name, stats] of connectionManager.sessionStats) {
      const uptime = stats.connectedAt ? 
        Math.floor((Date.now() - stats.connectedAt.getTime()) / 1000 / 60) : 0;
      
      totalMessages += stats.messagesHandled;
      totalErrors += stats.errors;
      
      console.log(`\n📱 Session: ${name}`);
      console.log(`   ⏱️  Uptime: ${uptime} minutes`);
      console.log(`   📨 Messages Received: ${stats.messagesReceived}`);
      console.log(`   ✅ Messages Handled: ${stats.messagesHandled}`);
      console.log(`   ❌ Errors: ${stats.errors}`);
      console.log(`   🔄 Reconnections: ${stats.reconnectCount}`);
      console.log(`   📊 Success Rate: ${stats.messagesReceived > 0 ? 
        ((stats.messagesHandled / stats.messagesReceived) * 100).toFixed(2) : 0}%`);
      console.log(`   🕐 Connected Since: ${stats.connectedAt.toLocaleString('hi-IN')}`);
      console.log(`   ⏰ Last Activity: ${stats.lastActivity?.toLocaleString('hi-IN') || 'N/A'}`);
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📈 OVERALL STATISTICS`);
    console.log(`${'='.repeat(60)}`);
    console.log(`   Total Sessions: ${connectionManager.getAllSessions().size}`);
    console.log(`   Total Messages: ${totalMessages}`);
    console.log(`   Total Errors: ${totalErrors}`);
    console.log(`   Error Rate: ${totalMessages > 0 ? 
      ((totalErrors / totalMessages) * 100).toFixed(2) : 0}%`);
    console.log(`${'='.repeat(60)}\n`);
    
    setTimeout(menu, 1000);
  }
  
  else if (choice === '5') {
    const name = await ask('📝 Session name to remove: ');
    
    if (connectionManager.getSession(name)) {
      const sock = connectionManager.getSession(name);
      
      try {
        sock.end(undefined);
      } catch (e) {
        logger.warn(`Error ending socket: ${e.message}`);
      }
      
      connectionManager.removeSession(name);
      updateActiveSessions(connectionManager.getAllSessions());
      
      try {
        const bulkSender = getBulkSender();
        bulkSender.updateSessions(connectionManager.getAllSessions());
      } catch (e) {
        // Ignore
      }
      
      logger.success(`Removed session: ${name}`);
      console.log(`\n💡 To permanently delete, remove: ./sessions/${name}/`);
    } else {
      logger.error(`Session not found: ${name}`);
    }
    
    setTimeout(menu, 1000);
  }
  
  else if (choice === '6') {
    global.autoReconnectEnabled = !global.autoReconnectEnabled;
    logger.success(`Auto-Reconnect ${global.autoReconnectEnabled ? 'ENABLED ✅' : 'DISABLED ⏸️'}`);
    setTimeout(menu, 1000);
  }
  
  else if (choice === '7') {
    try {
      const bulkSender = getBulkSender();
      const status = await bulkSender.getStatus();
      
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📤 BULK SENDER STATUS`);
      console.log(`${'='.repeat(60)}`);
      console.log(`🔄 Status: ${status.running ? '🟢 Running' : '🔴 Stopped'}${status.paused ? ' (PAUSED)' : ''}`);
      console.log(`⏰ Business Hours: ${status.businessHours ? '🟢 Active' : '🔴 Inactive'}`);
      console.log(`📱 Linked Sessions: ${status.sessions}`);
      console.log(`📋 Active Campaigns: ${status.activeCampaigns}`);
      console.log(`📂 Queued Campaigns: ${status.queuedCampaigns}`);
      
      console.log(`\n📊 GLOBAL STATISTICS`);
      console.log(`${'='.repeat(60)}`);
      console.log(`   ✅ Total Sent: ${status.globalStats.totalSent}`);
      console.log(`   ❌ Total Failed: ${status.globalStats.totalFailed}`);
      console.log(`   🔄 Total Retries: ${status.globalStats.totalRetries}`);
      console.log(`   🎯 Completed Campaigns: ${status.globalStats.campaignsCompleted}`);
      console.log(`   📁 Files Processed: ${status.globalStats.filesProcessed}`);
      
      if (status.sessionStats.length > 0) {
        console.log(`\n📱 SESSION DETAILS`);
        console.log(`${'='.repeat(60)}`);
        
        for (const sess of status.sessionStats) {
          console.log(`\n${sess.connected ? '🟢' : '🔴'} ${sess.name}`);
          console.log(`   Day: ${sess.scaling?.day || 1}`);
          console.log(`   Daily Limit: ${sess.dailyLimit}`);
          console.log(`   Today: ${sess.todaySent}/${sess.dailyLimit}`);
          console.log(`   Total Sent: ${sess.sent}`);
          console.log(`   Failed: ${sess.failed}`);
          console.log(`   Health: ${sess.health}`);
        }
      }
      
      console.log(`\n${'='.repeat(60)}\n`);
      console.log(`📂 Watching: /Order_seva_system_contact_excel/`);
      console.log(`⏰ Hours: 9 AM - 8 PM IST`);
      console.log(`\n💡 Commands: start bulk | stop bulk | pause bulk | resume bulk`);
      console.log(`${'='.repeat(60)}\n`);
      
    } catch (e) {
      logger.error(`Error getting bulk status: ${e.message}`);
    }
    
    setTimeout(menu, 1000);
  }
  
  else if (choice === '8') {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🏥 SYSTEM HEALTH CHECK`);
    console.log(`${'='.repeat(60)}`);
    
    // Check sessions
    console.log(`\n📱 Session Health:`);
    for (const [name, sock] of connectionManager.getAllSessions()) {
      const wsState = sock.ws?.readyState;
      const stateStr = wsState === 1 ? '🟢 OPEN' : 
                       wsState === 0 ? '🟡 CONNECTING' :
                       wsState === 2 ? '🟠 CLOSING' : '🔴 CLOSED';
      
      console.log(`   ${name}: ${stateStr}`);
      console.log(`      User: ${sock.user?.id ? '✅ Authenticated' : '❌ Not authenticated'}`);
      console.log(`      WebSocket: ${wsState !== undefined ? 'Connected' : 'Disconnected'}`);
    }
    
    // Check directories
    console.log(`\n📁 Directory Health:`);
    const dirs = [
      './sessions',
      './logs',
      '/sdcard/DCIM/gyan ganga seva',
      '/storage/emulated/0/Order_seva_system_contact_excel'
    ];
    
    for (const dir of dirs) {
      const exists = fs.existsSync(dir);
      console.log(`   ${exists ? '✅' : '❌'} ${dir}`);
    }
    
    // Check memory
    console.log(`\n💾 Memory Usage:`);
    const used = process.memoryUsage();
    console.log(`   RSS: ${Math.round(used.rss / 1024 / 1024)} MB`);
    console.log(`   Heap Used: ${Math.round(used.heapUsed / 1024 / 1024)} MB`);
    console.log(`   Heap Total: ${Math.round(used.heapTotal / 1024 / 1024)} MB`);
    
    // Check uptime
    console.log(`\n⏱️  Process Uptime: ${Math.floor(process.uptime() / 60)} minutes`);
    
    console.log(`\n${'='.repeat(60)}\n`);
    setTimeout(menu, 1000);
  }
  
  else if (choice === '9') {
    console.log(`\n🧹 Clearing session caches...`);
    
    let cleared = 0;
    const sessionsDir = './sessions';
    
    try {
      if (fs.existsSync(sessionsDir)) {
        const dirs = fs.readdirSync(sessionsDir);
        
        for (const dir of dirs) {
          const storePath = path.join(sessionsDir, dir, 'store.json');
          if (fs.existsSync(storePath)) {
            fs.unlinkSync(storePath);
            cleared++;
            logger.info(`Cleared cache for: ${dir}`);
          }
        }
      }
      
      logger.success(`✅ Cleared ${cleared} session cache(s)`);
    } catch (e) {
      logger.error(`Cache clear error: ${e.message}`);
    }
    
    setTimeout(menu, 2000);
  }
  
  else if (choice === '0') {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`👋 Shutting down ${CONFIG.BOT?.NAME || 'Bot'}...`);
    console.log(`${'='.repeat(60)}`);
    console.log(`💾 Active Sessions: ${connectionManager.getAllSessions().size}`);
    console.log(`📊 Total Messages Handled: ${
      Array.from(connectionManager.sessionStats.values())
        .reduce((sum, s) => sum + s.messagesHandled, 0)
    }`);
    console.log(`⏰ Stopped: ${getTimestamp()}`);
    console.log(`${'='.repeat(60)}\n`);
    
    // Cleanup
    connectionManager.cleanup();
    stopScheduler();
    
    // Gracefully close all sessions
    for (const [name, sock] of connectionManager.getAllSessions()) {
      try {
        logger.info(`Closing session: ${name}`);
        sock.end(undefined);
      } catch (e) {
        logger.warn(`Error closing ${name}: ${e.message}`);
      }
    }
    
    await delay(2000);
    process.exit(0);
  }
  
}

// ==================== INITIALIZATION ====================
global.autoReconnectEnabled = true;
global.schedulerInitialized = false;
global.totalMessagesHandled = 0;

// ==================== MAIN FUNCTION ====================
(async () => {
  console.clear();
  console.log('\n' + '='.repeat(60));
  console.log(`🚀 ${CONFIG.BOT?.NAME || 'Gyan Ganga Seva Bot'}`);
  console.log(`📦 Version: ${CONFIG.BOT?.VERSION || '3.0.0'}`);
  console.log(`⏰ Started: ${getTimestamp()}`);
  console.log('='.repeat(60) + '\n');

  logger.info('🔧 Initializing bot systems...');
  
  // Ensure required directories exist
  const requiredDirs = [
    './sessions',
    './logs',
    './backup',
    './data'
  ];
  
  for (const dir of requiredDirs) {
    await fs.ensureDir(dir);
  }
  
  logger.success('✅ Directory structure ready');
  
  // Auto-restore sessions
  logger.info('🔄 Attempting to restore previous sessions...');
  const restored = await autoStartAll();
  
  if (restored > 0) {
    console.log(`\n${'='.repeat(60)}`);
    logger.success(`✅ Restored ${restored} session(s)`);
    logger.info(`👤 Admin: ${CONFIG.ADMIN?.JID || 'Not configured'}`);
    logger.info(`📤 Bulk Sender: Ready`);
    logger.info(`⏰ Scheduler: Initializing...`);
    console.log(`${'='.repeat(60)}\n`);
  } else {
    console.log(`\n${'='.repeat(60)}`);
    logger.warn('⚠️  No saved sessions found');
    logger.info('💡 Link your first WhatsApp account from the menu');
    console.log(`${'='.repeat(60)}\n`);
  }

  await delay(2000);
  menu();
})();

// ==================== GRACEFUL SHUTDOWN ====================
process.on('SIGINT', async () => {
  console.log(`\n\n${'='.repeat(60)}`);
  logger.info('🛑 Received shutdown signal (SIGINT)');
  console.log(`${'='.repeat(60)}`);
  
  logger.info('💾 Saving session states...');
  
  // Stop scheduler
  try {
    stopScheduler();
    logger.success('✅ Scheduler stopped');
  } catch (e) {
    logger.warn('Scheduler already stopped');
  }
  
  // Stop bulk sender
  try {
    const bulkSender = getBulkSender();
    bulkSender.stop();
    logger.success('✅ Bulk sender stopped');
  } catch (e) {
    logger.warn('Bulk sender stop error');
  }
  
  // Cleanup connection manager
  connectionManager.cleanup();
  logger.success('✅ Connection manager cleaned up');
  
  // Close all sessions gracefully
  logger.info('📱 Closing all sessions...');
  for (const [name, sock] of connectionManager.getAllSessions()) {
    try {
      sock.end(undefined);
      logger.info(`   ✅ Closed: ${name}`);
    } catch (e) {
      logger.warn(`   ⚠️  ${name}: ${e.message}`);
    }
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 Final Statistics:`);
  console.log(`   Sessions: ${connectionManager.getAllSessions().size}`);
  console.log(`   Messages: ${
    Array.from(connectionManager.sessionStats.values())
      .reduce((sum, s) => sum + s.messagesHandled, 0)
  }`);
  console.log(`   Uptime: ${Math.floor(process.uptime() / 60)} minutes`);
  console.log(`⏰ Stopped: ${getTimestamp()}`);
  console.log(`${'='.repeat(60)}\n`);
  
  logger.success('✅ Graceful shutdown complete');
  
  await delay(1000);
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('🛑 Received SIGTERM');
  process.emit('SIGINT');
});

// ==================== ERROR HANDLERS ====================
process.on('uncaughtException', (error) => {
  // Ignore common WhatsApp connection errors
  const ignoredErrors = [
    'Bad MAC',
    'Connection Closed',
    'WebSocket',
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND'
  ];
  
  const shouldIgnore = ignoredErrors.some(err => 
    error.message.includes(err)
  );
  
  if (!shouldIgnore) {
    logger.error(`Uncaught Exception: ${error.message}`);
    logger.error(`Stack: ${error.stack}`);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  // Ignore common WhatsApp promise rejections
  const ignoredReasons = [
    'Bad MAC',
    'Connection Closed',
    'WebSocket',
    'ECONNRESET',
    'ETIMEDOUT'
  ];
  
  const reasonStr = reason?.message || String(reason);
  const shouldIgnore = ignoredReasons.some(err => 
    reasonStr.includes(err)
  );
  
  if (!shouldIgnore) {
    logger.error(`Unhandled Rejection: ${reasonStr}`);
  }
});

// ==================== PERIODIC HEALTH MONITORING ====================
setInterval(() => {
  const activeSessions = connectionManager.getAllSessions().size;
  
  if (activeSessions === 0) {
    logger.warn('⚠️  No active sessions - system idle');
  }
  
  // Log memory if high
  const memUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  
  if (heapUsedMB > 500) {
    logger.warn(`⚠️  High memory usage: ${heapUsedMB} MB`);
  }
  
}, 300000); // Every 5 minutes

// ==================== AUTO-CLEANUP ====================
setInterval(() => {
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
    logger.debug('🧹 Garbage collection triggered');
  }
}, 600000); // Every 10 minutes

// ==================== EXPORTS ====================
export {
  connect,
  connectionManager,
  logger,
  getTimestamp,
  normalizePhone
};