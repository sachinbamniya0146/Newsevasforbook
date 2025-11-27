import fs from 'fs';
import path from 'path';
import CONFIG from '../config.js';

const SESSION_ADMINS_FILE = './data/session_admins.json';

// Ensure data directory exists
function ensureDataDir() {
  const dir = path.dirname(SESSION_ADMINS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Load session admins from file
function loadSessionAdmins() {
  ensureDataDir();
  try {
    if (fs.existsSync(SESSION_ADMINS_FILE)) {
      const data = fs.readFileSync(SESSION_ADMINS_FILE, 'utf8');
      const parsed = JSON.parse(data);
      return parsed || {};
    }
  } catch (e) {
    console.error('[SessionAdmin] Load error:', e.message);
  }
  return {};
}

// Save session admins to file
function saveSessionAdmins(admins) {
  ensureDataDir();
  try {
    fs.writeFileSync(SESSION_ADMINS_FILE, JSON.stringify(admins, null, 2));
    return true;
  } catch (e) {
    console.error('[SessionAdmin] Save error:', e.message);
    return false;
  }
}

// Get admin for a session
export async function getSessionAdmin(sessionName) {
  const admins = loadSessionAdmins();
  return admins[sessionName] || null;
}

// Set admin for a session
export async function setSessionAdmin(sessionName, adminJid) {
  const admins = loadSessionAdmins();
  admins[sessionName] = adminJid;
  const saved = saveSessionAdmins(admins);
  
  if (saved) {
    console.log(`[SessionAdmin] Set ${sessionName} → ${adminJid}`);
    return true;
  }
  return false;
}

// Remove admin for a session
export async function removeSessionAdmin(sessionName) {
  const admins = loadSessionAdmins();
  if (admins[sessionName]) {
    delete admins[sessionName];
    const saved = saveSessionAdmins(admins);
    
    if (saved) {
      console.log(`[SessionAdmin] Removed admin for ${sessionName}`);
      return true;
    }
  }
  return false;
}

// Get all session admins
export async function getAllSessionAdmins() {
  return loadSessionAdmins();
}

// Check if JID is admin for any session
export async function isSessionAdmin(jid) {
  const admins = loadSessionAdmins();
  return Object.values(admins).includes(jid);
}

// Get sessions managed by an admin
export async function getAdminSessions(adminJid) {
  const admins = loadSessionAdmins();
  const sessions = [];
  
  for (const [session, jid] of Object.entries(admins)) {
    if (jid === adminJid) {
      sessions.push(session);
    }
  }
  
  return sessions;
}

// Notify session admin
export async function notifySessionAdmin(sock, sessionName, adminJid, message) {
  try {
    await sock.sendMessage(adminJid, { text: message });
    console.log(`[SessionAdmin] Notified ${sessionName} admin: ${adminJid}`);
    return true;
  } catch (e) {
    console.error(`[SessionAdmin] Notify error:`, e.message);
    return false;
  }
}

// Handle admin commands
export async function handleSessionAdminCommand(sock, from, text, isMainAdmin) {
  const cmd = text.toLowerCase().trim();
  const args = text.split(' ');
  
  // Only main admin can manage session admins
  if (!isMainAdmin) {
    return false;
  }
  
  // Set admin for a session
  if (cmd.startsWith('setadmin ')) {
    if (args.length < 2) {
      await sock.sendMessage(from, { 
        text: `❌ Usage: setadmin <session>

Example: setadmin satish1

Then forward a message from the admin you want to set.` 
      });
      return true;
    }
    
    const sessionName = args[1];
    
    await sock.sendMessage(from, { 
      text: `📱 Setting admin for session: *${sessionName}*

Please forward a message from the person you want to set as admin, or send their number in format:

919876543210

Waiting for admin contact...` 
    });
    
    // Store pending admin setup
    global.pendingAdminSetup = { sessionName, from };
    
    return true;
  }
  
  // Remove admin for a session
  if (cmd.startsWith('removeadmin ')) {
    if (args.length < 2) {
      await sock.sendMessage(from, { 
        text: `❌ Usage: removeadmin <session>

Example: removeadmin satish1` 
      });
      return true;
    }
    
    const sessionName = args[1];
    const removed = await removeSessionAdmin(sessionName);
    
    if (removed) {
      await sock.sendMessage(from, { 
        text: `✅ Removed admin for session: *${sessionName}*` 
      });
    } else {
      await sock.sendMessage(from, { 
        text: `❌ No admin found for session: *${sessionName}*` 
      });
    }
    
    return true;
  }
  
  // List all session admins
  if (cmd === 'listadmins' || cmd === 'admins') {
    const admins = await getAllSessionAdmins();
    
    if (Object.keys(admins).length === 0) {
      await sock.sendMessage(from, { 
        text: `📱 *Session Admins*

No session admins configured yet.

Use *setadmin <session>* to add one.` 
      });
      return true;
    }
    
    let msg = `╔═══════════════════════════════╗

📱 *SESSION ADMINS*

╚═══════════════════════════════╝\n\n`;
    
    for (const [session, jid] of Object.entries(admins)) {
      const phone = jid.split('@')[0];
      msg += `📱 *${session}*\n`;
      msg += `   Admin: +${phone}\n\n`;
    }
    
    msg += `╔═══════════════════════════════╗\n\n`;
    msg += `Total: ${Object.keys(admins).length} session(s)`;
    
    await sock.sendMessage(from, { text: msg });
    return true;
  }
  
  return false;
}

// Handle pending admin setup (when main admin forwards contact)
export async function handlePendingAdminSetup(sock, msg) {
  if (!global.pendingAdminSetup) return false;
  
  const { sessionName, from } = global.pendingAdminSetup;
  
  try {
    // Check if message is from main admin
    const msgFrom = msg.key?.remoteJid;
    if (msgFrom !== from) return false;
    
    // Extract admin JID from message
    let adminJid = null;
    
    // Method 1: Forwarded contact
    if (msg.message?.contactMessage) {
      const vcard = msg.message.contactMessage.vcard;
      const match = vcard.match(/waid=(\d+)/);
      if (match) {
        adminJid = `${match[1]}@s.whatsapp.net`;
      }
    }
    
    // Method 2: Phone number in text
    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
    const phoneMatch = text.match(/\d{10,15}/);
    if (phoneMatch) {
      const phone = phoneMatch[0].replace(/^0+/, '');
      if (phone.length >= 10) {
        adminJid = `${phone}@s.whatsapp.net`;
      }
    }
    
    if (!adminJid) {
      await sock.sendMessage(from, { 
        text: `❌ Could not extract admin contact.

Please either:
1. Forward a message from the admin
2. Send their number: 919876543210

Or send "cancel" to cancel.` 
      });
      return true;
    }
    
    // Set the admin
    const success = await setSessionAdmin(sessionName, adminJid);
    
    if (success) {
      await sock.sendMessage(from, { 
        text: `✅ *Admin Set Successfully!*

Session: *${sessionName}*
Admin: ${adminJid.split('@')[0]}

Orders from this session will now be forwarded to both:
• Main Admin (you)
• Session Admin (${adminJid.split('@')[0]})` 
      });
      
      // Notify the new admin
      try {
        await sock.sendMessage(adminJid, { 
          text: `🎉 *You are now an Admin!*

Session: *${sessionName}*

You will receive all order notifications from this WhatsApp session.

╔═══════════════════════════════╗

📦 Orders will be forwarded to you automatically.

🙏 Thank you for managing this session!` 
        });
      } catch (e) {
        console.error('[SessionAdmin] Could not notify new admin:', e.message);
      }
    } else {
      await sock.sendMessage(from, { 
        text: `❌ Failed to set admin for session: ${sessionName}` 
      });
    }
    
    // Clear pending setup
    delete global.pendingAdminSetup;
    return true;
    
  } catch (e) {
    console.error('[SessionAdmin] Setup error:', e.message);
    delete global.pendingAdminSetup;
    return false;
  }
}
