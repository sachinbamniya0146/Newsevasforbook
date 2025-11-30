import fs from 'fs';
import path from 'path';
import CONFIG from '../config.js';

const SESSION_ADMINS_FILE = './data/session_admins.json';

// ==================== FILE OPERATIONS ====================

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
      console.log(`[SessionAdmin] Loaded ${Object.keys(parsed || {}).length} admin mapping(s)`);
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
    console.log(`[SessionAdmin] Saved ${Object.keys(admins).length} admin mapping(s)`);
    return true;
  } catch (e) {
    console.error('[SessionAdmin] Save error:', e.message);
    return false;
  }
}

// ==================== CORE FUNCTIONS ====================

/**
 * Get admin JID for a session
 * @param {string} sessionName - Session name
 * @returns {string|null} - Admin JID or null
 */
export async function getSessionAdmin(sessionName) {
  const admins = loadSessionAdmins();
  const adminJID = admins[sessionName] || null;
  
  if (adminJID) {
    console.log(`[SessionAdmin] ${sessionName} → ${adminJID.split('@')[0]}`);
  }
  
  return adminJID;
}

/**
 * Set admin for a session
 * @param {string} sessionName - Session name
 * @param {string} adminJID - Admin WhatsApp JID (919876543210@s.whatsapp.net)
 * @returns {boolean} - Success status
 */
export async function setSessionAdmin(sessionName, adminJID) {
  const admins = loadSessionAdmins();
  
  // Validate JID format
  if (!adminJID.includes('@s.whatsapp.net')) {
    console.error('[SessionAdmin] Invalid JID format');
    return false;
  }
  
  admins[sessionName] = adminJID;
  const saved = saveSessionAdmins(admins);
  
  if (saved) {
    const adminPhone = adminJID.split('@')[0];
    console.log(`[SessionAdmin] ✅ Set ${sessionName} → +${adminPhone}`);
    return true;
  }
  return false;
}

/**
 * Remove admin for a session
 * @param {string} sessionName - Session name
 * @returns {boolean} - Success status
 */
export async function removeSessionAdmin(sessionName) {
  const admins = loadSessionAdmins();
  
  if (admins[sessionName]) {
    const removedJID = admins[sessionName];
    delete admins[sessionName];
    const saved = saveSessionAdmins(admins);
    
    if (saved) {
      console.log(`[SessionAdmin] ✅ Removed admin for ${sessionName}`);
      return true;
    }
  } else {
    console.log(`[SessionAdmin] No admin found for ${sessionName}`);
  }
  return false;
}

/**
 * Get all session admins
 * @returns {Object} - Object with session -> admin JID mappings
 */
export async function getAllSessionAdmins() {
  return loadSessionAdmins();
}

/**
 * Check if JID is admin for any session
 * @param {string} jid - WhatsApp JID
 * @returns {boolean} - True if admin for any session
 */
export async function isSessionAdmin(jid) {
  const admins = loadSessionAdmins();
  return Object.values(admins).includes(jid);
}

/**
 * Get sessions managed by an admin
 * @param {string} adminJid - Admin WhatsApp JID
 * @returns {Array} - Array of session names
 */
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

/**
 * Notify session admin
 * @param {Object} sock - WhatsApp socket
 * @param {string} sessionName - Session name
 * @param {string} adminJid - Admin JID
 * @param {string} message - Message to send
 * @returns {boolean} - Success status
 */
export async function notifySessionAdmin(sock, sessionName, adminJid, message) {
  try {
    await sock.sendMessage(adminJid, { text: message });
    console.log(`[SessionAdmin] ✅ Notified ${sessionName} admin: ${adminJid.split('@')[0]}`);
    return true;
  } catch (e) {
    console.error(`[SessionAdmin] Notify error:`, e.message);
    return false;
  }
}

// ==================== ADMIN COMMAND HANDLERS ====================

/**
 * Handle session admin commands (from main admin via WhatsApp)
 * @param {Object} sock - WhatsApp socket
 * @param {string} from - Sender JID
 * @param {string} text - Message text
 * @param {boolean} isMainAdmin - Is sender the main admin
 * @returns {boolean} - True if command was handled
 */
export async function handleSessionAdminCommand(sock, from, text, isMainAdmin) {
  const cmd = text.toLowerCase().trim();
  const args = text.split(' ');
  
  // Only main admin can manage session admins
  if (!isMainAdmin) {
    return false;
  }
  
  // ==================== SET ADMIN COMMAND ====================
  if (cmd.startsWith('setadmin ')) {
    if (args.length < 2) {
      await sock.sendMessage(from, { 
        text: `❌ *Invalid Usage*

*Correct format:*
setadmin <session>

*Example:*
setadmin satish1

Then forward a message from the admin you want to set.` 
      });
      return true;
    }
    
    const sessionName = args[1];
    
    await sock.sendMessage(from, { 
      text: `📱 *Setting admin for session:* ${sessionName}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Please do ONE of the following:

1️⃣ *Forward a message* from the person you want as admin

2️⃣ *Send their phone number* in this format:
   919876543210

⏳ Waiting for admin contact...` 
    });
    
    // Store pending admin setup
    global.pendingAdminSetup = { sessionName, from };
    
    return true;
  }
  
  // ==================== REMOVE ADMIN COMMAND ====================
  if (cmd.startsWith('removeadmin ')) {
    if (args.length < 2) {
      await sock.sendMessage(from, { 
        text: `❌ *Invalid Usage*

*Correct format:*
removeadmin <session>

*Example:*
removeadmin satish1` 
      });
      return true;
    }
    
    const sessionName = args[1];
    const removed = await removeSessionAdmin(sessionName);
    
    if (removed) {
      await sock.sendMessage(from, { 
        text: `✅ *Session Admin Removed*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 Session: *${sessionName}*

Orders will now only forward to:
• Main Admin (You)
• Order Group` 
      });
    } else {
      await sock.sendMessage(from, { 
        text: `❌ *No Admin Found*

Session: *${sessionName}*

This session doesn't have a separate admin configured.` 
      });
    }
    
    return true;
  }
  
  // ==================== LIST ADMINS COMMAND ====================
  if (cmd === 'listadmins' || cmd === 'admins') {
    const admins = await getAllSessionAdmins();
    
    if (Object.keys(admins).length === 0) {
      await sock.sendMessage(from, { 
        text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 *SESSION ADMINS*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❌ No session admins configured yet.

*To add a session admin:*
setadmin <session>

*Example:*
setadmin satish1` 
      });
      return true;
    }
    
    let msg = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 *SESSION ADMINS*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;
    
    for (const [session, jid] of Object.entries(admins)) {
      const phone = jid.split('@')[0];
      msg += `📱 *${session}*\n`;
      msg += `   👤 Admin: +${phone}\n`;
      msg += `   📋 Receives orders from this session\n\n`;
    }
    
    msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Total: ${Object.keys(admins).length} session(s)

*Commands:*
• setadmin <session> - Add admin
• removeadmin <session> - Remove admin`;
    
    await sock.sendMessage(from, { text: msg });
    return true;
  }
  
  return false;
}

/**
 * Handle pending admin setup (when main admin forwards contact or sends number)
 * @param {Object} sock - WhatsApp socket
 * @param {Object} msg - Message object
 * @returns {boolean} - True if handled
 */
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
      let phone = phoneMatch[0].replace(/^0+/, '');
      // Remove 91 prefix if exists and add it back
      if (phone.startsWith('91') && phone.length === 12) {
        phone = phone;
      } else if (phone.length === 10) {
        phone = '91' + phone;
      }
      if (phone.length >= 10) {
        adminJid = `${phone}@s.whatsapp.net`;
      }
    }
    
    if (!adminJid) {
      await sock.sendMessage(from, { 
        text: `❌ *Could not extract admin contact*

Please do ONE of the following:

1️⃣ *Forward a message* from the admin
2️⃣ *Send their phone number:* 919876543210

Or send "cancel" to cancel.` 
      });
      return true;
    }
    
    // Set the admin
    const success = await setSessionAdmin(sessionName, adminJid);
    
    if (success) {
      const adminPhone = adminJid.split('@')[0];
      
      await sock.sendMessage(from, { 
        text: `✅ *Session Admin Set Successfully!*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 Session: *${sessionName}*
👤 Admin: +${adminPhone}

📋 *Order Forwarding Setup:*

Orders from "${sessionName}" will now be forwarded to:

1️⃣ *Main Admin* (You)
   ${CONFIG.ADMIN.PHONE}

2️⃣ *Session Admin*
   +${adminPhone}

3️⃣ *Order Group*
   ${CONFIG.ORDER_GROUP_NAME}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Triple forwarding activated!` 
      });
      
      // Notify the new admin
      try {
        await sock.sendMessage(adminJid, { 
          text: `🎉 *You are now a Session Admin!*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 Session: *${sessionName}*

*What this means:*

✅ You will receive all order notifications from this WhatsApp session
✅ Orders are also sent to the main admin
✅ Orders are posted in the order group

*Your Responsibilities:*

📋 Monitor orders from this session
📦 Coordinate with main admin if needed
🙏 Help manage this session's orders

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Thank you for managing this session!` 
        });
      } catch (e) {
        console.error('[SessionAdmin] Could not notify new admin:', e.message);
      }
    } else {
      await sock.sendMessage(from, { 
        text: `❌ *Failed to set admin*

Session: ${sessionName}

Please try again or contact support.` 
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

// ==================== UTILITY FUNCTIONS ====================

/**
 * Check if a session has a dedicated admin
 * @param {string} sessionName - Session name
 * @returns {boolean} - True if session has admin
 */
export async function hasSessionAdmin(sessionName) {
  const admins = loadSessionAdmins();
  return !!admins[sessionName];
}

/**
 * Get session admin phone number
 * @param {string} sessionName - Session name
 * @returns {string|null} - Phone number or null
 */
export async function getSessionAdminPhone(sessionName) {
  const adminJID = await getSessionAdmin(sessionName);
  if (adminJID) {
    return adminJID.split('@')[0];
  }
  return null;
}

/**
 * Get statistics about session admins
 * @returns {Object} - Statistics
 */
export function getSessionAdminStats() {
  const admins = loadSessionAdmins();
  
  return {
    totalMappings: Object.keys(admins).length,
    sessions: Object.keys(admins),
    admins: [...new Set(Object.values(admins))].map(jid => jid.split('@')[0])
  };
}

// ==================== EXPORTS ====================

export default {
  getSessionAdmin,
  setSessionAdmin,
  removeSessionAdmin,
  getAllSessionAdmins,
  isSessionAdmin,
  getAdminSessions,
  notifySessionAdmin,
  handleSessionAdminCommand,
  handlePendingAdminSetup,
  hasSessionAdmin,
  getSessionAdminPhone,
  getSessionAdminStats
};
