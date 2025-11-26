import { 
  getOrderStats, 
  getTodayOrders, 
  getPendingOrders, 
  searchOrderByMobile, 
  getAllOrders,
  exportOrdersToCSV
} from '../utils/database.js';
import { sendManualReport } from '../utils/scheduler.js';
import CONFIG from '../config.js';

// Global active sessions reference
let activeSessions = new Map();

/**
 * Update active sessions reference
 */
export function updateActiveSessions(sessions) {
  activeSessions = sessions;
  console.log(`[AdminHandler] Updated active sessions: ${sessions.size}`);
}

/**
 * Get active sessions
 */
export function getActiveSessions() {
  return activeSessions;
}

/**
 * Get specific session by name
 */
export function getSession(name) {
  return activeSessions.get(name);
}

/**
 * Get first available active session
 */
export function getFirstActiveSession() {
  if (activeSessions.size === 0) return null;
  return activeSessions.values().next().value;
}

/**
 * Check if any sessions are active
 */
export function hasActiveSessions() {
  return activeSessions.size > 0;
}

/**
 * Main admin command handler - THIS IS THE EXPORT BOT.JS NEEDS
 */
export async function handleAdminCommand(sock, from, text, isAdmin) {
  if (!isAdmin) {
    return false;
  }
  
  const cmd = text.toLowerCase().trim();
  const args = text.split(' ');
  
  try {
    // Manual Daily Report
    if (cmd === 'reportnow' || cmd === 'dailyreport' || cmd === '/report') {
      await sock.sendMessage(from, { 
        text: `⏳ Generating daily report...

Please wait...` 
      });
      
      try {
        await sendManualReport(sock);
        
        await sock.sendMessage(from, { 
          text: `✅ Daily report generated and sent successfully!

Check your messages above.` 
        });
      } catch (error) {
        await sock.sendMessage(from, { 
          text: `❌ Failed to generate report!

Error: ${error.message}` 
        });
      }
      
      return true;
    }
    
    // Statistics Report
    if (cmd === 'report' || cmd === 'stats' || cmd === 'status' || cmd === '/stats') {
      const stats = await getOrderStats();
      
      let sessionReport = '';
      for (const [session, count] of Object.entries(stats.sessionStats)) {
        sessionReport += `📱 ${session}: *${count}* orders\n`;
      }
      
      let bookReport = '';
      for (const [book, count] of Object.entries(stats.bookStats)) {
        bookReport += `📚 ${book}: *${count}* orders\n`;
      }
      
      const reportMsg = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 *ORDER STATISTICS REPORT*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 *Total Orders:* ${stats.total}
📅 *Today's Orders:* ${stats.today}
📆 *This Month:* ${stats.thisMonth}
⏳ *Pending:* ${stats.pending}
✅ *Completed:* ${stats.completed}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📱 *Session-wise Orders:*

${sessionReport || 'No orders yet'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📚 *Book-wise Orders:*

${bookReport || 'No orders yet'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 Date: ${new Date().toLocaleDateString('hi-IN')}
⏰ Time: ${new Date().toLocaleTimeString('hi-IN')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      await sock.sendMessage(from, { text: reportMsg });
      return true;
    }
    
    // Today's Orders
    if (cmd === 'today' || cmd === '/today') {
      const todayOrders = await getTodayOrders();
      
      if (!todayOrders.length) {
        await sock.sendMessage(from, { 
          text: `📅 *Today's Orders*

No orders today yet.` 
        });
        return true;
      }
      
      let orderList = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 *TODAY'S ORDERS (${todayOrders.length})*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      
      todayOrders.forEach((order, idx) => {
        orderList += `${idx + 1}. *${order.name}*\n`;
        orderList += `   📞 ${order.mobile}\n`;
        orderList += `   📚 ${order.bookName} (${order.language})\n`;
        orderList += `   📍 ${order.address}, ${order.district}\n`;
        orderList += `   ⏰ ${new Date(order.createdAt).toLocaleTimeString('hi-IN')}\n\n`;
      });
      
      await sock.sendMessage(from, { text: orderList });
      return true;
    }
    
    // Pending Orders
    if (cmd === 'pending' || cmd === '/pending') {
      const pendingOrders = await getPendingOrders();
      
      if (!pendingOrders.length) {
        await sock.sendMessage(from, { 
          text: `⏳ *Pending Orders*

No pending orders.` 
        });
        return true;
      }
      
      let orderList = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⏳ *PENDING ORDERS (${pendingOrders.length})*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      
      pendingOrders.slice(0, 20).forEach((order, idx) => {
        orderList += `${idx + 1}. *${order.name}*\n`;
        orderList += `   ID: ${order.id}\n`;
        orderList += `   📞 ${order.mobile}\n`;
        orderList += `   📚 ${order.bookName}\n`;
        orderList += `   📍 ${order.district}, ${order.stateName}\n\n`;
      });
      
      if (pendingOrders.length > 20) {
        orderList += `\n... and ${pendingOrders.length - 20} more`;
      }
      
      await sock.sendMessage(from, { text: orderList });
      return true;
    }
    
    // Search by Mobile
    if (cmd.startsWith('search ') || cmd.startsWith('/search ')) {
      const mobile = args[1];
      
      if (!mobile) {
        await sock.sendMessage(from, { 
          text: `❌ Usage: search <mobile number>

Example: search 9876543210` 
        });
        return true;
      }
      
      const orders = await searchOrderByMobile(mobile);
      
      if (!orders.length) {
        await sock.sendMessage(from, { 
          text: `🔍 No orders found for mobile: ${mobile}` 
        });
        return true;
      }
      
      let orderList = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 *SEARCH RESULTS (${orders.length})*

Mobile: ${mobile}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      
      orders.forEach((order, idx) => {
        orderList += `${idx + 1}. *${order.name}*\n`;
        orderList += `   ID: ${order.id}\n`;
        orderList += `   📚 ${order.bookName} (${order.language})\n`;
        orderList += `   📍 ${order.address}\n`;
        orderList += `   📅 ${new Date(order.createdAt).toLocaleDateString('hi-IN')}\n`;
        orderList += `   Status: ${order.status || 'pending'}\n\n`;
      });
      
      await sock.sendMessage(from, { text: orderList });
      return true;
    }
    
    // Export to CSV
    if (cmd === 'export' || cmd === '/export') {
      await sock.sendMessage(from, { 
        text: `⏳ Exporting orders to CSV...

Please wait...` 
      });
      
      const csvPath = await exportOrdersToCSV();
      
      if (csvPath) {
        await sock.sendMessage(from, { 
          text: `✅ Orders exported successfully!

File: ${csvPath}

Total orders: ${(await getAllOrders()).length}` 
        });
      } else {
        await sock.sendMessage(from, { 
          text: `❌ Export failed or no orders to export.` 
        });
      }
      
      return true;
    }
    
    // Sessions List
    if (cmd === 'sessions' || cmd === '/sessions') {
      let msg = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📱 *ACTIVE SESSIONS (${activeSessions.size})*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      
      if (activeSessions.size === 0) {
        msg += `No active sessions.\n\n`;
      } else {
        let idx = 1;
        for (const [name, sock] of activeSessions) {
          const jid = sock.user?.id || 'Unknown';
          const phone = jid.split(':')[0];
          msg += `${idx}. *${name}*\n`;
          msg += `   Phone: ${phone}\n`;
          msg += `   Status: 🟢 Connected\n\n`;
          idx++;
        }
      }
      
      msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
      
      await sock.sendMessage(from, { text: msg });
      return true;
    }
    
    // Help Command
    if (cmd === 'help' || cmd === 'commands' || cmd === '/help') {
      const helpMsg = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🛠️ *ADMIN COMMANDS*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 *Statistics:*
• *report* - Full order statistics
• *stats* - Same as report
• *status* - System status

📋 *Orders:*
• *today* - Today's orders
• *pending* - Pending orders
• *search <mobile>* - Search by mobile

📁 *Data Management:*
• *export* - Export orders to CSV

📅 *Reports:*
• *reportnow* - Manual daily report
• *dailyreport* - Same as reportnow

📱 *Sessions:*
• *sessions* - List all sessions

❓ *Help:*
• *help* - Show this menu
• *commands* - Show commands

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 Examples:
   search 9876543210
   today
   report
   reportnow
   sessions

━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
      
      await sock.sendMessage(from, { text: helpMsg });
      return true;
    }
    
    return false;
    
  } catch (error) {
    console.error(`[AdminHandler] Command error: ${error.message}`);
    await sock.sendMessage(from, {
      text: `❌ Error: ${error.message}`
    });
    return true;
  }
}

/**
 * Main admin message handler (alternative entry point)
 */
export async function handleAdminMessage(sock, message) {
  try {
    const from = message.key.remoteJid;
    const isAdmin = CONFIG.ADMIN && from === CONFIG.ADMIN.JID;
    
    if (!isAdmin) {
      return false;
    }

    const msg = message.message;
    const text = msg?.conversation || 
                 msg?.extendedTextMessage?.text || 
                 '';

    if (!text) return false;

    // Handle command
    return await handleAdminCommand(sock, from, text, isAdmin);
    
  } catch (error) {
    console.error(`[AdminHandler] Error: ${error.message}`);
    return false;
  }
}
