import CONFIG from '../config.js';
import { getSessionAdmin } from './sessionAdminManager.js';

/**
 * 📤 ENHANCED TRIPLE ORDER FORWARDING SYSTEM
 * 
 * ✅ Forward to Main Admin (919174406375)
 * ✅ Forward to Session-Specific Admin (if configured)
 * ✅ Forward to Order Group (Order_received_on_WhatsApp)
 * ✅ Bilingual messages (Hindi + English)
 * ✅ Complete order details with formatting
 * ✅ Error handling for each target
 * ✅ Success/failure tracking
 */

/**
 * Forward order to all three destinations
 * @param {Object} sock - WhatsApp socket
 * @param {string} sessionName - Session name
 * @param {Object} orderData - Complete order data
 * @returns {Object} - Forwarding results
 */
export async function forwardOrderToAll(sock, sessionName, orderData) {
  try {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📤 FORWARDING ORDER FROM: ${sessionName}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    // Format timestamp (IST)
    const now = new Date();
    const dateStr = now.toLocaleDateString('hi-IN', { 
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
    const timeStr = now.toLocaleTimeString('hi-IN', { 
      timeZone: 'Asia/Kolkata', 
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    
    // Create bilingual order message
    const orderMessage = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 *नया ऑर्डर!* _New Order!_
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📱 *Session:* ${sessionName}
📅 *Date:* ${dateStr}
⏰ *Time:* ${timeStr}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 *CUSTOMER DETAILS*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 *नाम (Name):* ${orderData.name}
👨 *पिता (Father):* ${orderData.father || orderData.fatherName || 'N/A'}
📞 *मोबाइल (Mobile):* +91${orderData.mobile || orderData.mobileNumber}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 *BOOK DETAILS*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📖 *पुस्तक (Book):* ${orderData.bookName}
🌐 *भाषा (Language):* ${orderData.language}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 *DELIVERY ADDRESS*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📍 *पता (Address):*
${orderData.fullAddress || orderData.address}

${orderData.selectedLocation ? `📮 *क्षेत्र (Area):* ${orderData.selectedLocation}\n` : ''}
📮 *पिनकोड (Pincode):* ${orderData.pincode}
🏘️ *जिला (District):* ${orderData.district}
🗺️ *राज्य (State):* ${orderData.stateName}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ *STATUS:* Ready to Ship
📦 *डिलीवरी:* 7-21 दिन (निःशुल्क)
_Delivery: 7-21 days (Free)_
━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    
    // Results tracker
    const results = {
      mainAdmin: null,
      sessionAdmin: null,
      group: null,
      success: false,
      timestamp: new Date().toISOString()
    };
    
    // ==================== 1. FORWARD TO MAIN ADMIN ====================
    try {
      const mainAdminJID = CONFIG.ADMIN?.JID;
      
      if (mainAdminJID) {
        await sock.sendMessage(mainAdminJID, { text: orderMessage });
        results.mainAdmin = true;
        console.log(`✅ [1/3] Main Admin: ${CONFIG.ADMIN.PHONE}`);
      } else {
        results.mainAdmin = false;
        console.log(`❌ [1/3] Main Admin JID not configured`);
      }
    } catch (error) {
      results.mainAdmin = false;
      console.error(`❌ [1/3] Main Admin forward failed: ${error.message}`);
    }
    
    // ==================== 2. FORWARD TO SESSION ADMIN ====================
    try {
      const sessionAdminJID = await getSessionAdmin(sessionName);
      
      // Only forward if session admin exists AND is different from main admin
      if (sessionAdminJID && sessionAdminJID !== CONFIG.ADMIN?.JID) {
        await sock.sendMessage(sessionAdminJID, { text: orderMessage });
        results.sessionAdmin = true;
        const adminPhone = sessionAdminJID.split('@')[0];
        console.log(`✅ [2/3] Session Admin (${sessionName}): ${adminPhone}`);
      } else {
        results.sessionAdmin = null; // No separate session admin
        console.log(`ℹ️  [2/3] No separate session admin for: ${sessionName}`);
      }
    } catch (error) {
      results.sessionAdmin = false;
      console.error(`❌ [2/3] Session Admin forward failed: ${error.message}`);
    }
    
    // ==================== 3. FORWARD TO ORDER GROUP ====================
    try {
      const groupResult = await forwardToOrderGroup(sock, orderMessage);
      results.group = groupResult;
      
      if (groupResult) {
        console.log(`✅ [3/3] Order Group: ${CONFIG.ORDER_GROUP_NAME}`);
      } else {
        console.log(`❌ [3/3] Order Group forward failed`);
      }
    } catch (error) {
      results.group = false;
      console.error(`❌ [3/3] Order Group forward failed: ${error.message}`);
    }
    
    // Overall success if at least main admin got the message
    results.success = results.mainAdmin === true;
    
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📊 FORWARDING SUMMARY:`);
    console.log(`   Main Admin: ${results.mainAdmin ? '✅' : '❌'}`);
    console.log(`   Session Admin: ${results.sessionAdmin === true ? '✅' : results.sessionAdmin === false ? '❌' : 'N/A'}`);
    console.log(`   Order Group: ${results.group ? '✅' : '❌'}`);
    console.log(`   Overall: ${results.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    return results;
    
  } catch (error) {
    console.error(`❌ ORDER FORWARDING ERROR: ${error.message}`);
    return { 
      success: false, 
      error: error.message,
      mainAdmin: false,
      sessionAdmin: false,
      group: false
    };
  }
}

/**
 * Forward to order group
 * @param {Object} sock - WhatsApp socket
 * @param {string} message - Message to forward
 * @returns {boolean} - Success status
 */
async function forwardToOrderGroup(sock, message) {
  try {
    // Fetch all groups
    const groups = await sock.groupFetchAllParticipating();
    
    if (!groups) {
      throw new Error('No groups available');
    }
    
    const groupName = CONFIG.ORDER_GROUP_NAME || 'Order_received_on_WhatsApp';
    
    // Find matching group (case-insensitive search)
    let targetGroupJID = null;
    
    for (const [jid, group] of Object.entries(groups)) {
      if (group.subject && group.subject.toLowerCase().includes(groupName.toLowerCase())) {
        targetGroupJID = jid;
        break;
      }
    }
    
    if (!targetGroupJID) {
      console.warn(`⚠️ Group not found: "${groupName}"`);
      console.log(`💡 Available groups:`);
      
      for (const [jid, group] of Object.entries(groups)) {
        console.log(`   - ${group.subject} (${jid})`);
      }
      
      return false;
    }
    
    // Send to group
    await sock.sendMessage(targetGroupJID, { text: message });
    return true;
    
  } catch (error) {
    console.error(`❌ Group forwarding error: ${error.message}`);
    return false;
  }
}

/**
 * Send bilingual confirmation to user (Enhanced)
 * @param {Object} sock - WhatsApp socket
 * @param {string} userJID - User JID
 * @param {Object} orderData - Order data
 * @param {string} pdfLink - PDF link (optional)
 * @returns {boolean} - Success status
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

📥 *Download करें और पढ़ें* _Download and read_`;
    }
    
    // Delivery info (bilingual, 7-21 days)
    confirmationMsg += `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 *DELIVERY DETAILS*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 *डिलीवरी:* 7-21 दिन (निःशुल्क)
_Delivery: 7-21 days (Free)_

✅ *Order Confirmed*
🏠 *Address:* ${orderData.fullAddress || orderData.address}
📮 *Pincode:* ${orderData.pincode}
🏘️ *District:* ${orderData.district}
🗺️ *State:* ${orderData.stateName}
📱 *Mobile:* +91${orderData.mobile || orderData.mobileNumber}`;
    
    // Support contact (if configured)
    if (CONFIG.SUPPORT_CONTACT) {
      confirmationMsg += `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📞 *सहायता / Support:*
${CONFIG.SUPPORT_CONTACT}`;
    }
    
    // Group join link (if configured)
    if (CONFIG.USER_GROUP_LINK) {
      confirmationMsg += `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📢 *हमारे WhatsApp ग्रुप से जुड़ें:*
_Join our WhatsApp group:_

${CONFIG.USER_GROUP_LINK}`;
    }
    
    confirmationMsg += `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🙏 *धन्यवाद!* _Thank you!_
━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    
    await sock.sendMessage(userJID, { text: confirmationMsg });
    
    console.log(`✅ Order confirmation sent to user: ${userJID.split('@')[0]}`);
    return true;
    
  } catch (error) {
    console.error(`❌ Confirmation send error: ${error.message}`);
    return false;
  }
}

/**
 * Get order statistics
 * @returns {Object} - Statistics
 */
export function getOrderStatistics() {
  // This would typically load from database
  // For now, returning basic structure
  return {
    total: 0,
    today: 0,
    thisWeek: 0,
    thisMonth: 0,
    pending: 0,
    completed: 0,
    timestamp: new Date().toISOString()
  };
}

// Default export
export default {
  forwardOrderToAll,
  sendOrderConfirmation,
  getOrderStatistics
};
