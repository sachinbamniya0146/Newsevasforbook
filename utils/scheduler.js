import cron from 'node-cron';
import { logger } from './logger.js';
import CONFIG from '../config.js';

let schedulerSocket = null;
let morningReportJob = null;
let eveningReportJob = null;

// ==================== INITIALIZE SCHEDULER ====================
export function initScheduler(sock) {
  schedulerSocket = sock;
  logger.info('📅 Scheduler initializing...');

  // Morning Report - 7:00 AM IST
  if (morningReportJob) morningReportJob.stop();
  morningReportJob = cron.schedule('0 7 * * *', async () => {
    try {
      logger.info('🌅 Sending morning report...');
      await sendScheduledReport('morning');
    } catch (error) {
      logger.error(`Morning report error: ${error.message}`);
    }
  }, {
    timezone: 'Asia/Kolkata'
  });

  // Evening Report - 8:00 PM IST
  if (eveningReportJob) eveningReportJob.stop();
  eveningReportJob = cron.schedule('0 20 * * *', async () => {
    try {
      logger.info('🌆 Sending evening report...');
      await sendScheduledReport('evening');
    } catch (error) {
      logger.error(`Evening report error: ${error.message}`);
    }
  }, {
    timezone: 'Asia/Kolkata'
  });

  logger.success('✅ Scheduler started (7 AM & 8 PM IST reports)');
}

// ==================== SEND SCHEDULED REPORT ====================
async function sendScheduledReport(type) {
  if (!schedulerSocket || !schedulerSocket.user) {
    logger.warn('⚠️ Scheduler socket not ready');
    return;
  }

  const adminJid = CONFIG.ADMIN.JID;
  const now = new Date();
  const istTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  
  const greeting = type === 'morning' ? '🌅 Good Morning!' : '🌆 Good Evening!';
  const timeStr = istTime.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  let report = `${greeting}\n\n`;
  report += `📊 *System Report*\n`;
  report += `━━━━━━━━━━━━━━━━━━━━\n`;
  report += `📅 Date: ${timeStr}\n`;
  report += `🤖 Bot: ${CONFIG.BOT.NAME}\n`;
  report += `📦 Version: ${CONFIG.BOT.VERSION}\n`;
  report += `✅ Status: Active\n\n`;
  
  report += `💡 *Quick Tips:*\n`;
  if (type === 'morning') {
    report += `• Check /bulk status for campaigns\n`;
    report += `• Drop Excel files to start sending\n`;
    report += `• Working hours: 7 AM - 10 PM IST\n`;
  } else {
    report += `• Review today's bulk stats\n`;
    report += `• Check session health\n`;
    report += `• Plan tomorrow's campaigns\n`;
  }
  
  report += `\nUse /help for all commands`;

  try {
    await schedulerSocket.sendMessage(adminJid, { text: report });
    logger.success(`✅ ${type} report sent to admin`);
  } catch (error) {
    logger.error(`Failed to send ${type} report: ${error.message}`);
  }
}

// ==================== MANUAL REPORT (EXPORT) ====================
export async function sendManualReport(sock) {
  if (!sock || !sock.user) {
    logger.warn('⚠️ Socket not ready for manual report');
    return false;
  }

  const adminJid = CONFIG.ADMIN.JID;
  const now = new Date();
  const istTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  
  const timeStr = istTime.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  let report = `📊 *Manual System Report*\n`;
  report += `━━━━━━━━━━━━━━━━━━━━\n`;
  report += `📅 Generated: ${timeStr}\n`;
  report += `🤖 Bot: ${CONFIG.BOT.NAME}\n`;
  report += `📦 Version: ${CONFIG.BOT.VERSION}\n`;
  report += `✅ Status: Active & Running\n\n`;
  
  report += `📱 *Available Commands:*\n`;
  report += `• /bulk start - Start bulk sender\n`;
  report += `• /bulk status - Check status\n`;
  report += `• /bulk stats - View statistics\n`;
  report += `• /bulk help - Full command list\n`;
  report += `• /pair <session> <phone> - Pair new device\n`;
  report += `• /help - General help\n\n`;
  
  report += `💡 All systems operational!`;

  try {
    await sock.sendMessage(adminJid, { text: report });
    logger.success('✅ Manual report sent to admin');
    return true;
  } catch (error) {
    logger.error(`Failed to send manual report: ${error.message}`);
    return false;
  }
}

// ==================== STOP SCHEDULER ====================
export function stopScheduler() {
  if (morningReportJob) {
    morningReportJob.stop();
    morningReportJob = null;
  }
  if (eveningReportJob) {
    eveningReportJob.stop();
    eveningReportJob = null;
  }
  schedulerSocket = null;
  logger.info('📅 Scheduler stopped');
}

// ==================== GET SCHEDULER STATUS ====================
export function getSchedulerStatus() {
  return {
    active: !!(morningReportJob && eveningReportJob),
    morningReportActive: !!morningReportJob,
    eveningReportActive: !!eveningReportJob,
    socketReady: !!(schedulerSocket && schedulerSocket.user)
  };
}
