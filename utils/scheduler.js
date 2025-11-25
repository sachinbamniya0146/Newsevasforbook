import cron from 'node-cron';
import { getAllOrders, getOrdersByDateRange, getOrderStats } from './database.js';
import CONFIG from '../config.js';
import { logger } from './logger.js';

let scheduledTask = null;
let schedulerSock = null;

// Initialize scheduler
export function initScheduler(sock) {
  schedulerSock = sock;
  startScheduler(sock);
  logger.success('✅ Scheduler initialized successfully');
}

// Start scheduler
export function startScheduler(sock) {
  if (!sock) {
    logger.error('❌ Scheduler: No socket provided');
    return;
  }
  
  if (scheduledTask) {
    scheduledTask.stop();
    logger.info('🔄 Scheduler: Restarting...');
  }
  
  schedulerSock = sock;
  
  // Schedule daily report at 6:30 PM (18:30)
  scheduledTask = cron.schedule('30 18 * * *', async () => {
    logger.info('📊 Running scheduled daily report...');
    await sendDailyReport(schedulerSock);
  }, {
    timezone: "Asia/Kolkata"
  });
  
  logger.success('⏰ Scheduler started: Daily report at 6:30 PM IST');
  return scheduledTask;
}

// Stop scheduler
export function stopScheduler() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    logger.info('🛑 Scheduler stopped');
  }
}

// Send daily report
async function sendDailyReport(sock) {
  try {
    if (!sock || !sock.user) {
      logger.error('❌ Scheduler: Socket not ready');
      return;
    }
    
    const adminJid = CONFIG.ADMIN?.JID || '919174406375@s.whatsapp.net';
    
    logger.info('📊 Generating daily report...');
    
    // Get last 24 hours orders
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const last24HoursOrders = await getOrdersByDateRange(yesterday, now);
    const stats = await getOrderStats();
    
    logger.info(`📦 Last 24 hours: ${last24HoursOrders.length} orders`);
    logger.info(`📈 Total orders: ${stats.total}`);
    
    // Build report message
    let reportMsg = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 *DAILY ORDER REPORT*
📅 *Gyan Ganga Seva*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 Date: ${now.toLocaleDateString('hi-IN')}
⏰ Time: ${now.toLocaleTimeString('hi-IN')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 *Last 24 Hours:* ${last24HoursOrders.length} orders

📈 *Total Orders:* ${stats.total} orders

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 *Overall Statistics:*

• Today: ${stats.today} orders
• This Month: ${stats.thisMonth} orders
• Pending: ${stats.pending} orders
• Completed: ${stats.completed} orders

━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    // Add session-wise breakdown
    if (Object.keys(stats.sessionStats).length > 0) {
      reportMsg += `📱 *Session-wise Orders:*\n\n`;
      for (const [session, count] of Object.entries(stats.sessionStats)) {
        reportMsg += `   • ${session}: ${count} orders\n`;
      }
      reportMsg += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    }
    
    // Add book-wise breakdown
    if (Object.keys(stats.bookStats).length > 0) {
      reportMsg += `📚 *Book-wise Orders:*\n\n`;
      for (const [book, count] of Object.entries(stats.bookStats)) {
        reportMsg += `   • ${book}: ${count} orders\n`;
      }
      reportMsg += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    }
    
    // Add last 24 hours order details
    if (last24HoursOrders.length > 0) {
      reportMsg += `📋 *Last 24 Hours Orders (Detailed):*\n\n`;
      
      last24HoursOrders.forEach((order, idx) => {
        const orderTime = new Date(order.createdAt);
        reportMsg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        reportMsg += `*Order #${idx + 1}*\n\n`;
        reportMsg += `👤 Name: ${order.name}\n`;
        reportMsg += `👨 Father: ${order.father}\n`;
        reportMsg += `📞 Mobile: +91${order.mobile}\n\n`;
        reportMsg += `📚 Book: ${order.bookName}\n`;
        reportMsg += `🌐 Language: ${order.language}\n\n`;
        reportMsg += `📮 Post Office: ${order.postOffice || 'N/A'}\n`;
        reportMsg += `🏘️ Village/City: ${order.address}\n`;
        reportMsg += `📍 District: ${order.district}\n`;
        reportMsg += `🗺️ State: ${order.stateName}\n`;
        reportMsg += `📮 Pincode: ${order.pincode}\n\n`;
        reportMsg += `⏰ Ordered: ${orderTime.toLocaleString('hi-IN')}\n`;
        reportMsg += `📊 Status: ${order.status || 'pending'}\n\n`;
      });
      
      reportMsg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    } else {
      reportMsg += `📋 *Last 24 Hours Orders:*\n\n`;
      reportMsg += `No orders in last 24 hours.\n\n`;
      reportMsg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    }
    
    reportMsg += `✅ *Report Generated Successfully*\n\n`;
    reportMsg += `🔄 Next report: Tomorrow at 6:30 PM\n\n`;
    reportMsg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    
    // Send report to admin
    await sock.sendMessage(adminJid, { text: reportMsg });
    
    logger.success('✅ Daily report sent successfully to admin: ' + adminJid);
    
  } catch (error) {
    logger.error(`❌ Daily report error: ${error.message}`);
    
    // Send error notification to admin
    try {
      const adminJid = CONFIG.ADMIN?.JID || '919174406375@s.whatsapp.net';
      await sock.sendMessage(adminJid, { 
        text: `❌ *Daily Report Generation Failed!*

Error: ${error.message}

Time: ${new Date().toLocaleString('hi-IN')}

Please check the bot logs.` 
      });
    } catch (e) {
      logger.error('Failed to send error notification: ' + e.message);
    }
  }
}

// Manual trigger for testing
export async function sendManualReport(sock) {
  logger.info('📊 Sending manual daily report...');
  await sendDailyReport(sock || schedulerSock);
}

// Get scheduler status
export function getSchedulerStatus() {
  return {
    running: scheduledTask !== null,
    socketConnected: schedulerSock && schedulerSock.user ? true : false,
    nextRun: '6:30 PM IST daily'
  };
}
