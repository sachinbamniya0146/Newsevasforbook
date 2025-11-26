import { 
  getOrderStats, 
  getTodayOrders, 
  getPendingOrders, 
  searchOrderByMobile, 
  getAllOrders,
  exportOrdersToCSV
} from '../utils/database.js';
import { sendManualReport } from '../utils/scheduler.js';
import { getBulkSender } from '../utils/bulkSender.js';
import CONFIG from '../config.js';

let activeSessions = new Map();

export function updateActiveSessions(sessions) {
  activeSessions = sessions;
  
  // Update bulk sender with sessions
  try {
    const bulkSender = getBulkSender();
    bulkSender.updateSessions(sessions);
  } catch (e) {
    console.log('[AdminHandler] Bulk sender not available yet');
  }
  
  console.log(`[AdminHandler] Updated active sessions: ${sessions.size}`);
}

export function getActiveSessions() {
  return activeSessions;
}

export function getSession(name) {
  return activeSessions.get(name);
}

export function getFirstActiveSession() {
  if (activeSessions.size === 0) return null;
  return activeSessions.values().next().value;
}

export function hasActiveSessions() {
  return activeSessions.size > 0;
}

/**
 * Main admin command handler
 */
export async function handleAdminCommand(sock, from, text, isAdmin) {
  if (!isAdmin) {
    return false;
  }
  
  const cmd = text.toLowerCase().trim();
  const args = text.split(' ');
  
  try {
    // ==================== BULK SENDER COMMANDS ====================
    
    // Start Bulk Sender
    if (cmd === 'start bulk' || cmd === 'bulk start' || cmd === '/bulk start') {
      const bulkSender = getBulkSender();
      const result = await bulkSender.start();
      
      if (result.success) {
        await sock.sendMessage(from, { 
          text: `✅ *BULK SENDER STARTED*

🚀 System running
📊 Auto-detecting Excel files
⏰ Hours: 6 AM - 11 PM IST
📱 Sessions: ${bulkSender.sessions.size}
📈 Daily +15-20%

Drop Excel files to start!` 
        });
      } else {
        await sock.sendMessage(from, { 
          text: `❌ *FAILED*\n\nError: ${result.error}` 
        });
      }
      
      return true;
    }
    
    // Stop Bulk Sender
    if (cmd === 'stop bulk' || cmd === 'bulk stop' || cmd === '/bulk stop') {
      const bulkSender = getBulkSender();
      const result = bulkSender.stop();
      
      if (result.success) {
        await sock.sendMessage(from, { 
          text: `🛑 *STOPPED*\n\n✅ State saved\n\nUse "start bulk" to resume` 
        });
      } else {
        await sock.sendMessage(from, { 
          text: `❌ Error: ${result.error}` 
        });
      }
      
      return true;
    }
    
    // Pause
    if (cmd === 'pause bulk' || cmd === 'bulk pause' || cmd === '/bulk pause') {
      const bulkSender = getBulkSender();
      const result = bulkSender.pause();
      
      if (result.success) {
        await sock.sendMessage(from, { 
          text: `⏸️ *PAUSED*\n\nUse "resume bulk" to continue` 
        });
      } else {
        await sock.sendMessage(from, { 
          text: `❌ ${result.error}` 
        });
      }
      
      return true;
    }
    
    // Resume
    if (cmd === 'resume bulk' || cmd === 'bulk resume' || cmd === '/bulk resume') {
      const bulkSender = getBulkSender();
      const result = bulkSender.resume();
      
      if (result.success) {
        await sock.sendMessage(from, { 
          text: `▶️ *RESUMED*\n\nCampaigns continuing...` 
        });
      } else {
        await sock.sendMessage(from, { 
          text: `❌ ${result.error}` 
        });
      }
      
      return true;
    }
    
    // Bulk Status (ENHANCED)
    if (cmd === 'bulk status' || cmd === 'status bulk' || cmd === '/bulk status' || cmd === 'bulk' || cmd === 'bs') {
      const bulkSender = getBulkSender();
      const status = await bulkSender.getStatus();
      
      let msg = `━━━━━━━━━━━━━━━━━━━━━\n📊 *BULK STATUS*\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
      
      const runIcon = status.running ? '🟢' : '🔴';
      const pauseTxt = status.paused ? ' (PAUSED)' : '';
      const hourIcon = status.businessHours ? '🟢' : '🔴';
      
      msg += `${runIcon} *Status:* ${status.running ? 'Running' : 'Stopped'}${pauseTxt}\n`;
      msg += `${hourIcon} *Hours:* ${status.businessHours ? 'Active' : 'Off (6AM-11PM)'}\n`;
      msg += `📱 *Sessions:* ${status.sessions}\n`;
      msg += `📋 *Active:* ${status.activeCampaigns}\n`;
      msg += `📂 *Queue:* ${status.queuedCampaigns}\n`;
      msg += `🔢 *Processed:* ${status.processedNumbers}\n\n`;
      
      msg += `━━━━━━━━━━━━━━━━━━━━━\n🌐 *GLOBAL*\n\n`;
      msg += `✅ Sent: ${status.globalStats.totalSent}\n`;
      msg += `❌ Failed: ${status.globalStats.totalFailed}\n`;
      msg += `🔄 Retries: ${status.globalStats.totalRetries}\n`;
      msg += `🎯 Done: ${status.globalStats.campaignsCompleted}\n\n`;
      
      if (status.sessionStats.length > 0) {
        msg += `━━━━━━━━━━━━━━━━━━━━━\n📱 *SESSIONS*\n\n`;
        
        for (const sess of status.sessionStats) {
          const icon = sess.connected ? '🟢' : '🔴';
          const percent = sess.dailyLimit > 0 ? Math.round((sess.todaySent / sess.dailyLimit) * 100) : 0;
          
          msg += `${icon} *${sess.name}*\n`;
          msg += `├ Day ${sess.scaling?.day || 1} → ${sess.dailyLimit}/day\n`;
          msg += `├ Today: ${sess.todaySent}/${sess.dailyLimit} (${percent}%)\n`;
          msg += `└ Total: ${sess.sent}\n\n`;
        }
      }
      
      msg += `━━━━━━━━━━━━━━━━━━━━━\n⏰ 6 AM - 11 PM IST\n📈 +15-20% daily`;
      
      await sock.sendMessage(from, { text: msg });
      return true;
    }
    
    // Bulk Report
    if (cmd === 'bulk report' || cmd === 'report bulk' || cmd === '/bulk report' || cmd === 'br') {
      const bulkSender = getBulkSender();
      await bulkSender.sendDailyReport();
      
      await sock.sendMessage(from, { 
        text: `✅ Report sent above!` 
      });
      
      return true;
    }
    
    // ==================== ORDER SYSTEM COMMANDS ====================
    
    // Manual Daily Report
    if (cmd === 'reportnow' || cmd === 'dailyreport' || cmd === '/report') {
      await sock.sendMessage(from, { 
        text: `⏳ Generating daily report...

Please wait...` 
      });
      
      try {
        await sendManualReport(sock);
        
        await sock.sendMessage(from, { 
          text: `✅ Daily report generated!

Check above messages.` 
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
      
      const reportMsg = `━━━━━━━━━━━━━━━━━━━━━

📊 *ORDER STATISTICS REPORT*

━━━━━━━━━━━━━━━━━━━━━

📦 *Total Orders:* ${stats.total}
📅 *Today's Orders:* ${stats.today}
📆 *This Month:* ${stats.thisMonth}
⏳ *Pending:* ${stats.pending}
✅ *Completed:* ${stats.completed}

━━━━━━━━━━━━━━━━━━━━━

📱 *Session-wise Orders:*

${sessionReport || 'No orders yet'}
━━━━━━━━━━━━━━━━━━━━━

📚 *Book-wise Orders:*

${bookReport || 'No orders yet'}
━━━━━━━━━━━━━━━━━━━━━

📅 Date: ${new Date().toLocaleDateString('hi-IN')}
⏰ Time: ${new Date().toLocaleTimeString('hi-IN')}

━━━━━━━━━━━━━━━━━━━━━`;

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
      
      let orderList = `━━━━━━━━━━━━━━━━━━━━━

📅 *TODAY'S ORDERS (${todayOrders.length})*

━━━━━━━━━━━━━━━━━━━━━\n\n`;
      
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
      
      let orderList = `━━━━━━━━━━━━━━━━━━━━━

⏳ *PENDING ORDERS (${pendingOrders.length})*

━━━━━━━━━━━━━━━━━━━━━\n\n`;
      
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
          text: `❌ Usage: search <mobile>

Example: search 9876543210` 
        });
        return true;
      }
      
      const orders = await searchOrderByMobile(mobile);
      
      if (!orders.length) {
        await sock.sendMessage(from, { 
          text: `🔍 No orders found for: ${mobile}` 
        });
        return true;
      }
      
      let orderList = `━━━━━━━━━━━━━━━━━━━━━

🔍 *SEARCH RESULTS (${orders.length})*

Mobile: ${mobile}

━━━━━━━━━━━━━━━━━━━━━\n\n`;
      
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
          text: `✅ Orders exported!

File: ${csvPath}

Total: ${(await getAllOrders()).length} orders` 
        });
      } else {
        await sock.sendMessage(from, { 
          text: `❌ Export failed or no orders.` 
        });
      }
      
      return true;
    }
    
    // Sessions List
    if (cmd === 'sessions' || cmd === '/sessions') {
      let msg = `━━━━━━━━━━━━━━━━━━━━━

📱 *ACTIVE SESSIONS (${activeSessions.size})*

━━━━━━━━━━━━━━━━━━━━━\n\n`;
      
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
      
      msg += `━━━━━━━━━━━━━━━━━━━━━`;
      
      await sock.sendMessage(from, { text: msg });
      return true;
    }
    
    // Help Command
    if (cmd === 'help' || cmd === 'commands' || cmd === '/help') {
      const helpMsg = `━━━━━━━━━━━━━━━━━━━━━

🛠️ *ADMIN COMMANDS*

━━━━━━━━━━━━━━━━━━━━━

🚀 *BULK SENDER:*
• *start bulk* - Start bulk sender
• *stop bulk* - Stop bulk sender
• *pause bulk* - Pause campaigns
• *resume bulk* - Resume campaigns
• *bulk status* - Get status
• *bulk report* - Detailed report

━━━━━━━━━━━━━━━━━━━━━

📊 *Statistics:*
• *report* - Full statistics
• *stats* - Same as report
• *status* - System status

━━━━━━━━━━━━━━━━━━━━━

📋 *Orders:*
• *today* - Today's orders
• *pending* - Pending orders
• *search <mobile>* - Search

━━━━━━━━━━━━━━━━━━━━━

📁 *Data:*
• *export* - Export to CSV

━━━━━━━━━━━━━━━━━━━━━

📅 *Reports:*
• *reportnow* - Daily report
• *dailyreport* - Same

━━━━━━━━━━━━━━━━━━━━━

📱 *Sessions:*
• *sessions* - List sessions

━━━━━━━━━━━━━━━━━━━━━

❓ *Help:*
• *help* - Show this menu
• *commands* - Show commands

━━━━━━━━━━━━━━━━━━━━━

💡 Examples:
   start bulk
   bulk status
   search 9876543210
   today
   report

━━━━━━━━━━━━━━━━━━━━━`;
      
      await sock.sendMessage(from, { text: helpMsg });
      return true;
    }
    
    return false;
    
  } catch (error) {
    console.error(`[AdminHandler] Error: ${error.message}`);
    await sock.sendMessage(from, {
      text: `❌ Error: ${error.message}`
    });
    return true;
  }
}

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

    return await handleAdminCommand(sock, from, text, isAdmin);
    
  } catch (error) {
    console.error(`[AdminHandler] Error: ${error.message}`);
    return false;
  }
}