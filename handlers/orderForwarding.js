import CONFIG from '../config.js';
import { logger } from '../utils/logger.js';
import { getSessionAdminManager } from '../utils/sessionManager.js';

/**
 * 📤 Order Forwarding System (Enhanced & Compatible)
 * 
 * ✅ Integrates with your existing messageHandler.js
 * ✅ Forward to main admin (919174406375)
 * ✅ Forward to session-specific admin
 * ✅ Forward to order group
 * ✅ Track order count per session
 * ✅ PDF link in confirmation
 * ✅ Hindi + English bilingual messages
 */

// Order counters per session (exported for messageHandler)
const orderCounters = new Map();

/**
 * Update order count for session
 */
function updateOrderCount(sessionName) {
  if (!orderCounters.has(sessionName)) {
    orderCounters.set(sessionName, 1);
  } else {
    orderCounters.set(sessionName, orderCounters.get(sessionName) + 1);
  }
  return orderCounters.get(sessionName);
}

/**
 * Get order count for session
 */
export function getOrderCount(sessionName) {
  return orderCounters.get(sessionName) || 0;
}

/**
 * Reset order count for session
 */
export function resetOrderCount(sessionName) {
  orderCounters.set(sessionName, 0);
  logger.info(`[ORDER] Reset count for ${sessionName}`);
}

/**
 * Forward order to admins and group (Main Function)
 * @param {Object} sock - WhatsApp socket
 * @param {string} sessionName - Session name
 * @param {Object} orderData - Order data from messageHandler
 * @returns {Object} - Results of forwarding
 */
export async function forwardOrder(sock, sessionName, orderData) {
  try {
    const sessionAdminManager = getSessionAdminManager();
    
    // Update order count
    const orderCount = updateOrderCount(sessionName);
    
    // Format timestamp (IST)
    const now = new Date();
    const dateStr = now.toLocaleDateString('hi-IN', { timeZone: 'Asia/Kolkata' });
    const timeStr = now.toLocaleTimeString('hi-IN', { timeZone: 'Asia/Kolkata', hour12: true });
    
    // Create bilingual order message
    const orderMessage = `📦 *नया ऑर्डर!* _New Order!_

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 *Order #${orderCount}* | 📱 Session: *${sessionName}*
📅 ${dateStr} | ⏰ ${timeStr}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 *नाम (Name):* ${orderData.name}
👨 *पिता (Father):* ${orderData.father || orderData.fatherName || 'N/A'}
📞 *मोबाइल (Mobile):* +91${orderData.mobile || orderData.mobileNumber}
📖 *पुस्तक (Book):* ${orderData.bookName}
🌐 *भाषा (Language):* ${orderData.language}

📍 *पता (Address):* ${orderData.address}
📮 *पिनकोड (Pincode):* ${orderData.pincode}
🏘️ *डिस्ट्रिक्ट (District):* ${orderData.district}
🗺️ *राज्य (State):* ${orderData.stateName}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 *Session Stats:* ${getOrderCount(sessionName)} orders
🚀 *Status:* ✅ Ready to Ship`;
    
    // Get target admins
    const mainAdmin = CONFIG.ADMIN?.JID;
    const sessionAdmin = sessionAdminManager.getAdminForSession(sessionName);
    
    const recipients = [];
    
    // Add main admin (always forward unless explicitly disabled)
    if (CONFIG.ORDER_FORWARDING?.FORWARD_TO_MAIN_ADMIN !== false && mainAdmin) {
      recipients.push({
        jid: mainAdmin,
        type: 'main_admin',
        phone: CONFIG.ADMIN.PHONE
      });
    }
    
    // Add session-specific admin (if different from main)
    if (CONFIG.ORDER_FORWARDING?.FORWARD_TO_SESSION_ADMIN !== false && 
        sessionAdmin && 
        sessionAdmin !== mainAdmin) {
      recipients.push({
        jid: sessionAdmin,
        type: 'session_admin',
        phone: sessionAdmin.split('@')[0]
      });
    }
    
    // Results tracker
    const results = {
      mainAdmin: null,
      sessionAdmin: null,
      group: null,
      success: false,
      orderCount: orderCount
    };
    
    // Send to all admin recipients
    for (const recipient of recipients) {
      try {
        await sock.sendMessage(recipient.jid, { text: orderMessage });
        
        if (recipient.type === 'main_admin') {
          results.mainAdmin = true;
          logger.success(`✅ [ORDER] Forwarded to main admin: ${recipient.phone}`);
        } else if (recipient.type === 'session_admin') {
          results.sessionAdmin = true;
          logger.success(`✅ [ORDER] Forwarded to session admin: ${recipient.phone}`);
        }
        
        results.success = true;
        
      } catch (error) {
        logger.error(`❌ [ORDER] Failed to forward to ${recipient.type} (${recipient.phone}): ${error.message}`);
        
        if (recipient.type === 'main_admin') {
          results.mainAdmin = false;
        } else if (recipient.type === 'session_admin') {
          results.sessionAdmin = false;
        }
      }
    }
    
    // Forward to group if enabled
    if (CONFIG.ORDER_FORWARDING?.FORWARD_TO_GROUP !== false) {
      try {
        const groupResult = await forwardToGroup(sock, sessionName, orderMessage);
        results.group = groupResult;
      } catch (error) {
        logger.error(`❌ [ORDER] Group forwarding failed: ${error.message}`);
        results.group = false;
      }
    }
    
    return results;
    
  } catch (error) {
    logger.error(`❌ [ORDER] Forwarding error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Forward to order group
 */
async function forwardToGroup(sock, sessionName, message) {
  try {
    // Fetch all groups
    const groups = await sock.groupFetchAllParticipating();
    
    if (!groups) {
      throw new Error('No groups available');
    }
    
    const groupName = CONFIG.ORDER_GROUP_NAME || 'Order_received_on_WhatsApp';
    
    // Find matching group
    let targetGroup = null;
    for (const [id, group] of Object.entries(groups)) {
      if (group.subject && group.subject.toLowerCase().includes(groupName.toLowerCase())) {
        targetGroup = id;
        break;
      }
    }
    
    if (!targetGroup) {
      logger.warn(`⚠️ [ORDER] Group "${groupName}" not found`);
      return false;
    }
    
    // Send to group
    await sock.sendMessage(targetGroup, { text: message });
    logger.success(`✅ [ORDER] Forwarded to group: ${groupName}`);
    
    return true;
    
  } catch (error) {
    logger.error(`❌ [ORDER] Group forwarding error: ${error.message}`);
    throw error;
  }
}

/**
 * Send bilingual order confirmation to user (Enhanced)
 * @param {Object} sock - WhatsApp socket
 * @param {string} userJID - User JID
 * @param {Object} orderData - Order data
 * @param {string} pdfLink - PDF link (optional)
 */
export async function sendOrderConfirmation(sock, userJID, orderData, pdfLink) {
  try {
    // Bilingual confirmation message
    let confirmationMsg = `🎉 *ऑर्डर सफलतापूर्वक दर्ज!*
_Your order has been placed successfully!_

━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    
    // Add PDF link if available
    if (pdfLink) {
      confirmationMsg += `

📖 *${orderData.bookName} (${orderData.language})* PDF:
${pdfLink}

📥 *Download karein aur padhein* _Download and read_`;
    }
    
    // Delivery info (bilingual, 7-21 days as per your requirement)
    confirmationMsg += `

📦 *डिलीवरी:* 7-21 दिन (निःशुल्क)
_Delivery: 7-21 days (Free)_

✅ *Order confirmed*
🏠 *Address:* ${orderData.address}, ${orderData.pincode}
📱 *Mobile:* +91${orderData.mobile || orderData.mobileNumber}`;
    
    // Support contact (if configured)
    if (CONFIG.SUPPORT_CONTACT) {
      confirmationMsg += `

📞 ${CONFIG.SUPPORT_CONTACT}`;
    }
    
    // Group join link (if configured)
    if (CONFIG.USER_GROUP_LINK) {
      confirmationMsg += `

📢 *हमारे WhatsApp ग्रुप से जुड़ें:*
_Join our WhatsApp group:_
${CONFIG.USER_GROUP_LINK}`;
    }
    
    confirmationMsg += `

🙏 *धन्यवाद!* _Thank you!_`;
    
    await sock.sendMessage(userJID, { text: confirmationMsg });
    
    logger.success(`✅ [ORDER] Confirmation sent to user: ${userJID.split('@')[0]}`);
    
    return true;
    
  } catch (error) {
    logger.error(`❌ [ORDER] Confirmation send error: ${error.message}`);
    return false;
  }
}

/**
 * Get all order statistics
 */
export function getOrderStatistics() {
  const stats = {
    totalSessions: orderCounters.size,
    totalOrders: 0,
    perSession: {},
    timestamp: new Date().toISOString()
  };
  
  for (const [sessionName, count] of orderCounters.entries()) {
    stats.totalOrders += count;
    stats.perSession[sessionName] = count;
  }
  
  return stats;
}

/**
 * Export order counts for reporting
 */
export function exportOrderCounts() {
  return {
    counters: Object.fromEntries(orderCounters),
    timestamp: new Date().toISOString(),
    totalOrders: Array.from(orderCounters.values()).reduce((a, b) => a + b, 0)
  };
}

/**
 * Get formatted statistics message
 */
export function getOrderStatsMessage() {
  const stats = getOrderStatistics();
  
  let message = `📊 *ORDER STATISTICS*
${'='.repeat(30)}

`;
  message += `📦 Total Orders: ${stats.totalOrders}
`;
  message += `📱 Active Sessions: ${stats.totalSessions}

`;
  
  if (Object.keys(stats.perSession).length > 0) {
    message += `*Per Session:*
`;
    for (const [session, count] of Object.entries(stats.perSession)) {
      message += `  • ${session}: ${count} orders
`;
    }
  }
  
  message += `
⏰ Updated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`;
  
  return message;
}

// Default export
export default {
  forwardOrder,
  sendOrderConfirmation,
  getOrderCount,
  resetOrderCount,
  getOrderStatistics,
  exportOrderCounts,
  getOrderStatsMessage
};
