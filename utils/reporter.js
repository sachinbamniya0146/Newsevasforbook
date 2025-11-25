// ═══════════════════════════════════════════════════════════════════════════
// 📊 DAILY REPORT GENERATOR - Auto 6:30 PM Reports
// ═══════════════════════════════════════════════════════════════════════════

import CONFIG from '../config_v3.js';
import { logger } from './realtimeLogger.js';
import fs from 'fs';
import cron from 'node-cron';

/**
 * Generate daily report
 */
export async function generateDailyReport() {
  try {
    logger.info('Reporter', '📊 Generating daily report...');

    const ordersData = loadOrders();
    const today = new Date().toISOString().split('T')[0];
    const todayOrders = ordersData.filter(o => o.timestamp.startsWith(today));

    // Session-wise breakdown
    const sessionStats = {};
    todayOrders.forEach(order => {
      const session = order.sessionName || 'unknown';
      if (!sessionStats[session]) {
        sessionStats[session] = { count: 0, orders: [] };
      }
      sessionStats[session].count++;
      sessionStats[session].orders.push(order);
    });

    // Format report
    const report = formatReport(todayOrders, sessionStats);

    logger.success('Reporter', '✅ Daily report generated');
    return report;

  } catch (err) {
    logger.error('Reporter', `❌ Report generation failed: ${err.message}`);
    return null;
  }
}

/**
 * Send daily report to admins
 */
export async function sendDailyReport(sock) {
  try {
    const report = await generateDailyReport();
    if (!report) return;

    // Send to Main Admin
    if (CONFIG.DAILY_REPORT.SEND_TO_MAIN_ADMIN) {
      await sock.sendMessage(CONFIG.MAIN_ADMIN.JID, { text: report });
      logger.success('Reporter', '✅ Report sent to Main Admin');
    }

    // Send to Session Admins
    if (CONFIG.DAILY_REPORT.SEND_TO_SESSION_ADMINS) {
      for (const [sessionName, admin] of Object.entries(CONFIG.SESSION_ADMINS)) {
        if (admin.JID) {
          await sock.sendMessage(admin.JID, { text: report });
          logger.success('Reporter', `✅ Report sent to ${sessionName} admin`);
        }
      }
    }

  } catch (err) {
    logger.error('Reporter', `❌ Failed to send report: ${err.message}`);
  }
}

/**
 * Schedule daily report
 */
export function scheduleDailyReport(sock) {
  if (!CONFIG.DAILY_REPORT.ENABLED) {
    logger.info('Reporter', 'Daily reports disabled in config');
    return;
  }

  const [hour, minute] = CONFIG.DAILY_REPORT.TIME.split(':');
  const cronTime = `${minute} ${hour} * * *`;

  cron.schedule(cronTime, () => {
    logger.info('Reporter', '⏰ Scheduled report time reached');
    sendDailyReport(sock);
  }, {
    timezone: CONFIG.DAILY_REPORT.TIMEZONE
  });

  logger.success('Reporter', `✅ Daily report scheduled for ${CONFIG.DAILY_REPORT.TIME}`);
}

function formatReport(todayOrders, sessionStats) {
  const date = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  let report = `📊 *Daily Report - ${date}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  report += `📦 *Total Orders Today:* ${todayOrders.length}\n\n`;

  // Session breakdown
  if (Object.keys(sessionStats).length > 0) {
    report += `📱 *Session-wise Breakdown:*\n\n`;
    for (const [session, stats] of Object.entries(sessionStats)) {
      report += `*${session}*\n├─ Orders: ${stats.count}\n└─ Status: ✅ Active\n\n`;
    }
  }

  report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🙏 *Sant Rampal Ji Maharaj*`;

  return report;
}

function loadOrders() {
  try {
    const ordersPath = CONFIG.PATHS.ORDERS;
    if (fs.existsSync(ordersPath)) {
      return JSON.parse(fs.readFileSync(ordersPath, 'utf8'));
    }
    return [];
  } catch {
    return [];
  }
}
