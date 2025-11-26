import { getBulkSender } from '../utils/bulkSender.js';
import { logger } from '../utils/logger.js';

/**
 * Handle bulk sender commands from admin
 * All commands start with /bulk
 */
export async function handleBulkCommands(sock, message, sender) {
  const bulkSender = getBulkSender();
  const text = message.conversation || message.extendedTextMessage?.text || '';
  const command = text.trim().toLowerCase();
  
  let response = '';
  
  try {
    switch (command) {
      case '/bulk start':
      case '/bulk on':
        const startResult = await bulkSender.start();
        response = startResult.success 
          ? '🚀 *Bulk Sender Started!*\n\n✅ 24/7 mode activated\n✅ Auto-watching Excel folder\n✅ Progressive scaling enabled\n\n📂 Upload Excel files to:\n`/storage/emulated/0/Order_seva_system_contact_excel/`'
          : `❌ Error: ${startResult.error}`;
        break;
        
      case '/bulk stop':
      case '/bulk off':
        const stopResult = bulkSender.stop();
        response = stopResult.success
          ? '🛑 *Bulk Sender Stopped!*\n\n✅ State saved\n✅ Can resume anytime\n\nUse /bulk start to restart'
          : `❌ Error: ${stopResult.error}`;
        break;
        
      case '/bulk pause':
        const pauseResult = bulkSender.pause();
        response = pauseResult.success
          ? '⏸️ *Bulk Sender Paused!*\n\nCampaigns paused temporarily.\nUse /bulk resume to continue'
          : `❌ Error: ${pauseResult.error}`;
        break;
        
      case '/bulk resume':
        const resumeResult = bulkSender.resume();
        response = resumeResult.success
          ? '▶️ *Bulk Sender Resumed!*\n\n✅ Processing continues\n✅ All campaigns active'
          : `❌ Error: ${resumeResult.error}`;
        break;
        
      case '/bulk status':
      case '/bulk info':
        const status = await bulkSender.getStatus();
        response = formatStatusMessage(status);
        break;
        
      case '/bulk report':
        await bulkSender.sendDailyReport();
        response = '📊 Full report sent successfully!';
        break;
        
      case '/bulk stats':
        const stats = await bulkSender.getStatus();
        response = formatStatsMessage(stats);
        break;
        
      case '/bulk sessions':
        const sessionsInfo = await bulkSender.getStatus();
        response = formatSessionsMessage(sessionsInfo);
        break;
        
      case '/bulk help':
      case '/bulk':
        response = `📚 *BULK SENDER COMMANDS*\n\n` +
          `🔧 *Control Commands:*\n` +
          `• /bulk start - Start 24/7 sender\n` +
          `• /bulk stop - Stop sender\n` +
          `• /bulk pause - Pause temporarily\n` +
          `• /bulk resume - Resume sending\n\n` +
          `📊 *Information Commands:*\n` +
          `• /bulk status - Full system status\n` +
          `• /bulk stats - Global statistics\n` +
          `• /bulk sessions - Session details\n` +
          `• /bulk report - Get daily report\n` +
          `• /bulk help - Show this menu\n\n` +
          `📂 *Excel Upload Path:*\n` +
          `\`/storage/emulated/0/Order_seva_system_contact_excel/\`\n\n` +
          `✨ *Key Features:*\n` +
          `✅ 100 Hindi+English CTA templates\n` +
          `✅ Progressive scaling (Day 1: 10 → Max 400)\n` +
          `✅ Anti-ban with random delays (1-7 min)\n` +
          `✅ Auto Indian number detection\n` +
          `✅ Name personalization from Excel\n` +
          `✅ Working hours: 7 AM - 10 PM IST\n` +
          `✅ Auto-resume after restart\n` +
          `✅ Multi-session rotation\n\n` +
          `📋 *Excel Format:*\n` +
          `Column 1: Phone (919876543210)\n` +
          `Column 2: Name (Optional)\n\n` +
          `💡 Just upload Excel and let it work 24/7!`;
        break;
        
      default:
        if (command.startsWith('/bulk')) {
          response = '❌ Unknown command.\n\nUse */bulk help* for available commands.';
        }
        return; // Not a bulk command
    }
    
    if (response) {
      await sock.sendMessage(sender, { text: response });
      logger.info(`[BulkCmd] Sent to admin: ${command}`);
    }
    
  } catch (error) {
    logger.error(`Bulk command error: ${error.message}`);
    await sock.sendMessage(sender, {
      text: `❌ *Error executing command*\n\n${error.message}\n\nTry /bulk help for available commands`
    });
  }
}

// ==================== FORMAT FUNCTIONS ====================

function formatStatusMessage(status) {
  const businessStatus = status.businessHours ? '🟢 Active' : '🔴 Inactive';
  const runningStatus = status.running ? (status.paused ? '⏸️ Paused' : '🟢 Running') : '🔴 Stopped';
  
  let msg = `📊 *BULK SENDER STATUS*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;
  
  msg += `🔄 *System Status*\n`;
  msg += `├ Mode: ${runningStatus}\n`;
  msg += `├ Business Hours: ${businessStatus}\n`;
  msg += `├ Connected Sessions: ${status.sessions}\n`;
  msg += `├ Active Campaigns: ${status.activeCampaigns}\n`;
  msg += `└ Queued Campaigns: ${status.queuedCampaigns}\n\n`;
  
  msg += `🌐 *Global Statistics*\n`;
  msg += `├ Total Sent: ${status.globalStats.totalSent}\n`;
  msg += `├ Total Failed: ${status.globalStats.totalFailed}\n`;
  msg += `├ Retries: ${status.globalStats.totalRetries}\n`;
  msg += `├ Campaigns Done: ${status.globalStats.campaignsCompleted}\n`;
  msg += `└ Files Processed: ${status.globalStats.filesProcessed}\n\n`;
  
  const successRate = status.globalStats.totalSent > 0 
    ? ((status.globalStats.totalSent / (status.globalStats.totalSent + status.globalStats.totalFailed)) * 100).toFixed(1)
    : '0.0';
  
  msg += `📈 *Performance*\n`;
  msg += `└ Success Rate: ${successRate}%\n\n`;
  
  msg += `⏰ *Working Hours*\n`;
  msg += `└ 7:00 AM - 10:00 PM IST\n\n`;
  
  msg += `💡 Use /bulk help for more commands`;
  
  return msg;
}

function formatStatsMessage(status) {
  let msg = `📈 *DETAILED STATISTICS*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;
  
  msg += `🌐 *Global Performance*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  
  const totalMessages = status.globalStats.totalSent + status.globalStats.totalFailed;
  const successRate = totalMessages > 0 
    ? ((status.globalStats.totalSent / totalMessages) * 100).toFixed(1)
    : '0.0';
  
  msg += `Total Messages: ${totalMessages}\n`;
  msg += `✅ Sent: ${status.globalStats.totalSent}\n`;
  msg += `❌ Failed: ${status.globalStats.totalFailed}\n`;
  msg += `🔄 Retries: ${status.globalStats.totalRetries}\n`;
  msg += `📊 Success Rate: ${successRate}%\n`;
  msg += `🎯 Campaigns Done: ${status.globalStats.campaignsCompleted}\n`;
  msg += `📁 Files Processed: ${status.globalStats.filesProcessed}\n\n`;
  
  msg += `📱 *Session Summary*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  
  if (status.sessionStats.length === 0) {
    msg += `No sessions available\n`;
  } else {
    for (const session of status.sessionStats) {
      const connected = session.connected ? '🟢' : '🔴';
      const sessionSuccessRate = session.sent > 0
        ? ((session.sent / (session.sent + session.failed)) * 100).toFixed(1)
        : '0.0';
      
      msg += `\n${connected} *${session.name}*\n`;
      msg += `├ Day: ${session.scaling?.day || 1}\n`;
      msg += `├ Daily Limit: ${session.dailyLimit}\n`;
      msg += `├ Today Sent: ${session.todaySent}/${session.dailyLimit}\n`;
      msg += `├ Total Sent: ${session.sent}\n`;
      msg += `├ Failed: ${session.failed}\n`;
      msg += `└ Success: ${sessionSuccessRate}%\n`;
    }
  }
  
  msg += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `⏰ Started: ${new Date(status.globalStats.startTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}\n`;
  msg += `🔄 Last Restart: ${new Date(status.globalStats.lastRestart).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`;
  
  return msg;
}

function formatSessionsMessage(status) {
  let msg = `📱 *SESSION DETAILS*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;
  
  if (status.sessionStats.length === 0) {
    msg += `❌ No sessions available\n\n`;
    msg += `💡 Connect at least one WhatsApp session to use bulk sender`;
    return msg;
  }
  
  for (const session of status.sessionStats) {
    const connected = session.connected ? '🟢 Connected' : '🔴 Disconnected';
    const sessionTotal = session.sent + session.failed;
    const successRate = sessionTotal > 0
      ? ((session.sent / sessionTotal) * 100).toFixed(1)
      : '0.0';
    
    const remaining = session.dailyLimit - session.todaySent;
    const progress = session.dailyLimit > 0
      ? ((session.todaySent / session.dailyLimit) * 100).toFixed(1)
      : '0.0';
    
    msg += `*${session.name.toUpperCase()}*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `Status: ${connected}\n`;
    msg += `Health: ${session.health}\n\n`;
    
    msg += `📅 *Daily Progress*\n`;
    msg += `Day: ${session.scaling?.day || 1}\n`;
    msg += `Limit: ${session.dailyLimit} msgs/day\n`;
    msg += `Sent Today: ${session.todaySent}/${session.dailyLimit}\n`;
    msg += `Remaining: ${remaining}\n`;
    msg += `Progress: ${progress}%\n\n`;
    
    msg += `📊 *Total Stats*\n`;
    msg += `Total Sent: ${session.sent}\n`;
    msg += `Failed: ${session.failed}\n`;
    msg += `Success Rate: ${successRate}%\n`;
    msg += `Retries: ${session.retries}\n\n`;
    
    msg += `📈 *Scaling Info*\n`;
    msg += `Current Day: ${session.scaling?.day || 1}\n`;
    msg += `Current Limit: ${session.scaling?.limit || 10}\n`;
    msg += `Next Day Limit: ${Math.min(400, Math.floor((session.scaling?.limit || 10) * 1.1))}\n\n`;
    
    msg += `🕐 *Started*\n`;
    msg += `${new Date(session.startDate).toLocaleDateString('en-IN')}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;
  }
  
  msg += `💡 *Progressive Scaling*\n`;
  msg += `Day 1: 10 messages\n`;
  msg += `Each day: +10% increase\n`;
  msg += `Maximum: 400 messages/day`;
  
  return msg;
}

export default handleBulkCommands;
