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

// Simple logger
const logger = {
  info: (msg) => console.log(`[INFO] ${msg}`),
  success: (msg) => console.log(`[SUCCESS] ${msg}`),
  warn: (msg) => console.log(`[WARN] ${msg}`),
  error: (msg) => console.log(`[ERROR] ${msg}`)
};

// ==================== GLOBALS ====================
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const sessions = new Map();
const retryMap = new Map();
let schedulerInitialized = false;
let autoReconnectEnabled = true;

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

// ==================== CONNECTION FUNCTION ====================
async function connect(name, mode, phone = null) {
  try {
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
        console.log(`\n========= SCAN QR [${name}] =========`);
        qrcode.generate(qr, { small: true });
        console.log(`WhatsApp > Linked Devices > Scan QR\n`);
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
          retryMap.delete(name);
        }
        else if (shouldRetry && autoReconnectEnabled) {
          const retries = retryMap.get(name) || 0;
          if (retries < 5) {
            retryMap.set(name, retries + 1);
            const delayTime = 3000 * (retries + 1);
            logger.info(`[${name}] Retry ${retries + 1}/5 in ${delayTime/1000}s...`);
            await delay(delayTime);
            connect(name, mode, phone);
          } else {
            logger.error(`[${name}] Max retries reached`);
            sessions.delete(name);
            retryMap.delete(name);
          }
        }
        else {
          logger.error(`[${name}] Logged out from WhatsApp`);
          sessions.delete(name);
          retryMap.delete(name);
        }
      }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
      for (const m of messages) {
        if (!m.message || m.key.fromMe) continue;
        const from = m.key.remoteJid;
        const msgText = m.message?.conversation || m.message?.extendedTextMessage?.text || '';
        
        try {
          const isAdmin = CONFIG.ADMIN && from === CONFIG.ADMIN.JID;
          
          // Handle admin commands
          if (isAdmin) {
            const handled = await handleAdminCommand(sock, from, msgText, isAdmin);
            if (handled) continue;
          }
          
          // Handle regular messages
          await handleMessage(sock, m, name);
        } catch (e) {
          logger.error(`[${name}] Message error: ${e.message}`);
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
        await delay(2000);
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
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🌟 ${CONFIG.BOT?.NAME || 'Gyan Ganga Seva Bot'} 🌟`);
  console.log(`Version ${CONFIG.BOT?.VERSION || '2.0.0'}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`1 - Link WhatsApp (Pairing Code)`);
  console.log(`2 - Link WhatsApp (QR Code)`);
  console.log(`3 - Show Active Sessions`);
  console.log(`4 - Remove Session`);
  console.log(`5 - Scheduler Status`);
  console.log(`6 - System Health`);
  console.log(`7 - Toggle Auto-Reconnect`);
  console.log(`0 - Exit Bot`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  const choice = await ask('Enter choice: ');

  if (choice === '1') {
    const name = await ask('Session name (wa1, wa2...): ');
    if (!name || name.trim() === '') {
      console.log('❌ Invalid session name');
      return menu();
    }
    
    const phoneRaw = await ask('Phone (919876543210): ');
    const phone = normalizePhone(phoneRaw);
    if (!phone || phone.length < 10) {
      console.log('❌ Invalid phone number (min 10 digits)');
      return menu();
    }
    
    logger.info(`Starting: ${name} (${phone})`);
    connect(name, 'pair', phone);
    console.log(`\n✅ Pairing code will appear in 3-5 seconds\n`);
    setTimeout(menu, 5000);
  }
  
  else if (choice === '2') {
    const name = await ask('Session name (wa1, wa2...): ');
    if (!name || name.trim() === '') {
      console.log('❌ Invalid session name');
      return menu();
    }
    
    logger.info(`Starting QR: ${name}`);
    connect(name, 'qr');
    console.log(`\n✅ QR code will appear in 3-5 seconds\n`);
    setTimeout(menu, 5000);
  }
  
  else if (choice === '3') {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📊 ACTIVE SESSIONS: ${sessions.size}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    if (sessions.size === 0) {
      console.log('❌ No active sessions');
    } else {
      let i = 1;
      for (const [name, sock] of sessions) {
        const jid = sock.user?.id || 'Unknown';
        const phone = jid.split(':')[0];
        console.log(`${i}. ${name} - ${phone}`);
        i++;
      }
    }
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    setTimeout(menu, 1000);
  }
  
  else if (choice === '4') {
    const name = await ask('Session to remove: ');
    if (sessions.has(name)) {
      sessions.delete(name);
      console.log(`✅ Removed session: ${name}`);
      console.log(`💡 Delete ./sessions/${name} folder to remove completely`);
    } else {
      console.log(`❌ Session not found: ${name}`);
    }
    setTimeout(menu, 1000);
  }
  
  else if (choice === '5') {
    const status = getSchedulerStatus();
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`⏰ SCHEDULER STATUS\n`);
    console.log(`Running: ${status.running ? '✅ Yes' : '❌ No'}`);
    console.log(`Socket Connected: ${status.socketConnected ? '✅ Yes' : '❌ No'}`);
    console.log(`Next Run: ${status.nextRun}`);
    console.log(`Admin: ${CONFIG.ADMIN?.JID || '919174406375@s.whatsapp.net'}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    setTimeout(menu, 1000);
  }
  
  else if (choice === '6') {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🏥 SYSTEM HEALTH\n`);
    console.log(`Active Sessions: ${sessions.size}`);
    console.log(`Scheduler: ${schedulerInitialized ? '✅ Running' : '❌ Not initialized'}`);
    console.log(`Auto-Reconnect: ${autoReconnectEnabled ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`Time: ${getTimestamp()}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    setTimeout(menu, 1000);
  }
  
  else if (choice === '7') {
    autoReconnectEnabled = !autoReconnectEnabled;
    console.log(`\n${autoReconnectEnabled ? '✅ Auto-Reconnect ENABLED' : '❌ Auto-Reconnect DISABLED'}\n`);
    setTimeout(menu, 1000);
  }
  
  else if (choice === '0') {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`👋 Exiting ${CONFIG.BOT?.NAME || 'Bot'}...`);
    console.log(`💾 ${sessions.size} session(s) saved`);
    console.log(`⏰ Stopped at: ${getTimestamp()}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    stopScheduler();
    process.exit(0);
  }
  
  else {
    console.log('❌ Invalid choice');
    setTimeout(menu, 500);
  }
}

// ==================== MAIN ====================
(async () => {
  console.log('\n');
  logger.success(`🚀 ${CONFIG.BOT?.NAME || 'Gyan Ganga Seva Bot'} - Ready`);
  logger.info(`📦 Version: ${CONFIG.BOT?.VERSION || '2.0.0'}`);
  logger.info(`⏰ Started at: ${getTimestamp()}`);

  const restored = await autoStartAll();
  if (restored > 0) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ Restored ${restored} session(s)`);
    console.log(`⏰ Daily reports at 6:30 PM`);
    console.log(`📱 Admin: ${CONFIG.ADMIN?.JID || '919174406375@s.whatsapp.net'}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  } else {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📱 No saved sessions`);
    console.log(`💡 Link your first WhatsApp account`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  }

  menu();
})();

// ==================== ERROR HANDLERS ====================
process.on('SIGINT', () => {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`👋 Bot stopped gracefully`);
  console.log(`💾 ${sessions.size} session(s) saved`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  stopScheduler();
  process.exit(0);
});

process.on('uncaughtException', (e) => {
  if (!e.message.includes('Bad MAC') && !e.message.includes('Connection Closed')) {
    logger.error(`Uncaught Exception: ${e.message}`);
  }
});

process.on('unhandledRejection', (e) => {
  if (e && e.message && !e.message.includes('Bad MAC') && !e.message.includes('Connection Closed')) {
    logger.error(`Unhandled Rejection: ${e.message}`);
  }
});
