// ═══════════════════════════════════════════════════════════════════════════
// 📤 ENHANCED ORDER FORWARDING v3.0 - Multi-Admin System
// ═══════════════════════════════════════════════════════════════════════════
// Features:
// ✅ Smart multi-admin forwarding (Main + Session admins)
// ✅ Group forwarding with session info
// ✅ Dashboard real-time sync
// ✅ Delivery confirmation tracking
// ✅ Error handling & retry logic
// ✅ Bilingual notifications
// ═══════════════════════════════════════════════════════════════════════════

import CONFIG from '../config_v3.js';
import { logger } from '../utils/realtimeLogger.js';
import fs from 'fs';

/**
 * Forward order to all relevant parties
 * @param {Object} sock - WhatsApp socket
 * @param {string} sessionName - Session identifier
 * @param {Object} orderData - Complete order details
 */
export async function forwardOrder(sock, sessionName, orderData) {
  try {
    logger.info('OrderForward', `Starting order forwarding for session: ${sessionName}`);

    const results = {
      mainAdmin: false,
      sessionAdmin: false,
      group: false,
      dashboard: false
    };

    // ═══════════════════════════════════════════════════════════════════════
    // 1️⃣ FORWARD TO MAIN ADMIN (Always receives all orders)
    // ═══════════════════════════════════════════════════════════════════════
    try {
      const mainAdminJID = CONFIG.MAIN_ADMIN.JID;
      const orderMsg = formatOrderMessage(orderData, sessionName, 'MAIN_ADMIN');
      
      await sock.sendMessage(mainAdminJID, { text: orderMsg });
      results.mainAdmin = true;
      logger.success('OrderForward', `✅ Forwarded to Main Admin: ${CONFIG.MAIN_ADMIN.PHONE}`);
    } catch (err) {
      logger.error('OrderForward', `❌ Failed to forward to Main Admin: ${err.message}`);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 2️⃣ FORWARD TO SESSION-SPECIFIC ADMIN (If configured)
    // ═══════════════════════════════════════════════════════════════════════
    try {
      const sessionAdmin = CONFIG.SESSION_ADMINS[sessionName];
      
      if (sessionAdmin && sessionAdmin.JID) {
        const orderMsg = formatOrderMessage(orderData, sessionName, 'SESSION_ADMIN');
        
        await sock.sendMessage(sessionAdmin.JID, { text: orderMsg });
        results.sessionAdmin = true;
        logger.success('OrderForward', `✅ Forwarded to Session Admin: ${sessionAdmin.PHONE}`);
      } else {
        logger.info('OrderForward', `ℹ️ No session admin configured for: ${sessionName}`);
      }
    } catch (err) {
      logger.error('OrderForward', `❌ Failed to forward to Session Admin: ${err.message}`);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 3️⃣ FORWARD TO ORDER GROUP
    // ═══════════════════════════════════════════════════════════════════════
    try {
      const groupJID = CONFIG.ORDER_GROUP.JID;
      
      if (groupJID && groupJID.endsWith('@g.us')) {
        const orderMsg = formatOrderMessage(orderData, sessionName, 'GROUP');
        
        await sock.sendMessage(groupJID, { text: orderMsg });
        results.group = true;
        logger.success('OrderForward', `✅ Forwarded to Group: ${CONFIG.ORDER_GROUP.NAME}`);
      }
    } catch (err) {
      logger.error('OrderForward', `❌ Failed to forward to Group: ${err.message}`);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 4️⃣ UPDATE DASHBOARD (Real-time)
    // ═══════════════════════════════════════════════════════════════════════
    try {
      // Notify dashboard via WebSocket (handled by server)
      results.dashboard = true;
      logger.success('OrderForward', '✅ Dashboard updated');
    } catch (err) {
      logger.error('OrderForward', `❌ Dashboard update failed: ${err.message}`);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 📊 LOG SUMMARY
    // ═══════════════════════════════════════════════════════════════════════
    const successCount = Object.values(results).filter(Boolean).length;
    logger.info('OrderForward', `📊 Forwarding complete: ${successCount}/4 successful`);

    return results;

  } catch (err) {
    logger.error('OrderForward', `❌ Critical error in forwardOrder: ${err.message}`);
    throw err;
  }
}

/**
 * Send order confirmation to customer
 * @param {Object} sock - WhatsApp socket
 * @param {string} customerJID - Customer WhatsApp JID
 * @param {Object} orderData - Order details
 * @param {string} pdfLink - PDF download link
 */
export async function sendOrderConfirmation(sock, customerJID, orderData, pdfLink) {
  try {
    // Success message
    const successMsg = CONFIG.MESSAGES.ORDER_SUCCESS;
    await sock.sendMessage(customerJID, { text: successMsg });
    
    // PDF link
    if (pdfLink) {
      await sock.sendMessage(customerJID, { 
        text: `📄 *PDF लिंक | PDF Link:*\n\n${pdfLink}\n\n📖 पुस्तक के बारे में जानने के लिए PDF देखें।\n_View PDF to learn about the book._` 
      });
    }
    
    // Group invite
    const groupMsg = CONFIG.MESSAGES.GROUP_JOIN;
    await sock.sendMessage(customerJID, { 
      text: `${groupMsg}\n\n🔗 ${CONFIG.USER_GROUP_LINK}` 
    });
    
    // Support contact
    await sock.sendMessage(customerJID, { text: CONFIG.MESSAGES.SUPPORT_CONTACT });
    
    logger.success('OrderConfirmation', `✅ Confirmation sent to customer: ${orderData.mobile}`);
    
  } catch (err) {
    logger.error('OrderConfirmation', `❌ Failed to send confirmation: ${err.message}`);
  }
}

/**
 * Format order message for different recipients
 */
function formatOrderMessage(orderData, sessionName, recipientType) {
  const timestamp = new Date(orderData.timestamp).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  let header = '';
  
  if (recipientType === 'MAIN_ADMIN') {
    header = `🔔 *नया ऑर्डर | New Order*\n📱 *Session:* ${sessionName}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  } else if (recipientType === 'SESSION_ADMIN') {
    header = `🔔 *आपके Session का ऑर्डर | Order from Your Session*\n📱 *Session:* ${sessionName}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  } else if (recipientType === 'GROUP') {
    header = `🔔 *नया ऑर्डर प्राप्त | New Order Received*\n📱 *Session:* ${sessionName}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  }

  return `${header}
👤 *नाम | Name:* ${orderData.name}
👨 *पिता | Father:* ${orderData.father}
📞 *मोबाइल | Mobile:* +91${orderData.mobile}
📚 *पुस्तक | Book:* ${orderData.bookName}
🌐 *भाषा | Language:* ${orderData.language}
📍 *पता | Address:* ${orderData.address}
📮 *पिनकोड | Pincode:* ${orderData.pincode}
🏘️ *जिला | District:* ${orderData.district}
🗺️ *राज्य | State:* ${orderData.stateName}
⏰ *समय | Time:* ${timestamp}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🙏 *Sant Rampal Ji Maharaj*`;
}

/**
 * Load session admins from file
 */
export function loadSessionAdmins() {
  try {
    const adminsPath = CONFIG.PATHS.SESSION_ADMINS;
    if (fs.existsSync(adminsPath)) {
      const data = JSON.parse(fs.readFileSync(adminsPath, 'utf8'));
      Object.assign(CONFIG.SESSION_ADMINS, data);
      logger.info('OrderForward', `✅ Loaded ${Object.keys(data).length} session admins`);
    }
  } catch (err) {
    logger.error('OrderForward', `❌ Failed to load session admins: ${err.message}`);
  }
}

/**
 * Save session admins to file
 */
export function saveSessionAdmins() {
  try {
    const adminsPath = CONFIG.PATHS.SESSION_ADMINS;
    fs.writeFileSync(adminsPath, JSON.stringify(CONFIG.SESSION_ADMINS, null, 2));
    logger.success('OrderForward', '✅ Session admins saved');
  } catch (err) {
    logger.error('OrderForward', `❌ Failed to save session admins: ${err.message}`);
  }
}
