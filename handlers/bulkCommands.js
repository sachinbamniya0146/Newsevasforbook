import { getBulkSender } from '../utils/bulkSender.js';
import { logger } from '../utils/logger.js';

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
          ? '🚀 *Bulk Sender Started!*\n\n✅ 24/7 mode activated\n✅ Auto-watching Excel folder\n✅ Progressive scaling enabled'
          : `❌ Error: ${startResult.error}`;
        break;
        
      case '/bulk stop':
      case '/bulk off':
        const stopResult = bulkSender.stop();
        response = stopResult.success
          ? '🛑 *Bulk Sender Stopped!*\n\n✅ State saved\n✅ Can resume anytime'
          : `❌ Error: ${stopResult.error}`;
        break;
        
      case '/bulk pause':
        const pauseResult = bulkSender.pause();
        response = pauseResult.success
          ? '⏸️ *Bulk Sender Paused!*\n\nUse /bulk resume to continue'
          : `❌ Error: ${pauseResult.error}`;
        break;
        
      case '/bulk resume':
        const resumeResult = bulkSender.resume();
        response = resumeResult.success
          ? '▶️ *Bulk Sender Resumed!*\n\n✅ Processing continues'
          : `❌ Error: ${resumeResult.error}`;
        break;
        
      case '/bulk status':
      case '/bulk info':
        const status = await bulkSender.getStatus();
        response = formatStatusMessage(status);
        break;
        
      case '/bulk report':
        await bulkSender.sendDailyReport();
        response = '📊 Report sent!';
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
        response = `📚 *BULK SENDER COMMANDS*\n\n` +
          `🔧 *Control:*\n` +
          `/bulk start - Start 24/7 sender\n` +
          `/bulk stop - Stop sender\n` +
          `/bulk pause - Pause temporarily\n` +
          `/bulk resume - Resume sending\n\n` +
          `📊 *Information:*\n` +
          `/bulk status - Full system status\n` +
          `/bulk stats - Global statistics\n` +
          `/bulk sessions - Session details\n` +
          `/bulk report - Get daily report\n` +
          `/bulk help - Show this menu\n\n` +
          `📂 *Excel Path:*\n` +
          `/storage/emulated/0/Order_seva_system_contact_excel/\n\n` +
          `✨ *Features:*\n` +
          `• 100 Hindi+English CTA templates\n` +
          `• Progressive scaling (Day 1: 10 → Max 400)\n` +
          `• Anti-ban with random delays (1-7 min)\n` +
          `• Auto Indian number detection\n` +
          `• Name personalization from Excel\n` +
          `• Working hours: 7 AM - 10 PM IST\n` +
          `• Auto-resume after restart`;
        break;
        
      default:
        if (command.startsWith('/bulk')) {
          response = '❌ Unknown command. Use /bulk help for available commands.';
        }
        return; // Not a bulk command
    }
    
    if (response) {
      await sock.sendMessage(sender, { text: response });
    }
    
  } catch (error) {
    logger.error(`Bulk command error: ${error.message}`);
    await sock.sendMessage(sender, {
      text: `❌ Error executing command: ${error.message}`
    });
  }
}

function formatStatusMessage(status) {
  const businessStatus = status.businessHours ? '🟢 Active' : '🔴 Inactive';
  const runningStatus = status.running ? (status.paused ? '⏸️ Paused' : '🟢 Running') : '🔴 Stopped';
  
  let msg = `📊 *BULK SENDER STATUS*\n\n`;
  msg += `🔄 System: ${runningStatus}\n`;
  msg += `⏰ Business Hours: ${businessStatus}\n`;
  msg += `📱 Sessions: ${status.sessions}\n`;
  msg += `🚀 Active Campaigns: ${status.activeCampaigns}\n`;
  msg += `📥 Queued: ${status.queuedCampaigns}\n\n`;
  
  msg += `🌐 *GLOBAL STATS*\n`;
  msg += `✅ Sent: ${status.globalStats.totalSent}\n`;
  msg += `❌ Failed: ${status.globalStats.totalFailed}\n`;
  msg += `🔄 Retries: ${status.globalStats.totalRetries}\n`;
  msg += `🎯 Completed: ${status.globalStats.campaignsCompleted}\n`;
  
  return msg;
}

function formatStatsMessage(status) {
  let msg = `📈 *DETAILED STATISTICS*\n\n`;
  
  msg += `🌐 *Global Performance*\n`;
  msg += `├ Total Sent: ${status.globalStats.totalSent}\n`;
  msg += `├ Total Failed: ${status.globalStats.totalFailed}\n`;
  msg += `├ Success Rate: ${((status.globalStats.totalSent / (status.globalStats.totalSent + status.globalStats.totalFailed) * 100) || 0).toFixed(1)}%\n`;
  msg += `├ Retries: ${status.globalStats.totalRetries}\n`;
  msg += `├ Campaigns Done: ${status.globalStats.campaignsCompleted}\n`;
  msg += `└ Files Processed: ${status.globalStats.filesProcessed}\n\n`;
  
  msg += `📱 *Session Summary*\n`;
  for (const session of status.sessionStats) {
    const connected = session.connected ? '🟢' : '🔴';
    msg += `\n${connected} ${session.name}\n`;
    msg += `├ Day: ${session.scaling?.day || 1}\n`;
    msg += `├ Limit: ${session.dailyLimit}\n`;
    msg += `├ Today: ${session.todaySent}/${session.dailyLimit}\n`;
    msg += `└ Total: ${session.sent}\n`;
  }
  
  return msg;
}

function formatSessionsMessage(status) {
  let msg = `📱 *SESSION DETAILS*\n\n`;
  
  for (const session of status.sessionStats) {
    const connected = session.connected ? '🟢 Connected' : '🔴 Disconnected';
    const successRate = ((session.sent / (session.sent + session.failed) * 100) || 0).toFixed(1);
    
    msg += `*${session.name}*\n`;
    msg += `━━━━━━━━━━━━━━━━\n`;
    msg += `Status: ${connected}\n`;
    msg += `Health: ${session.health}\n`;
    msg += `Day: ${session.scaling?.day || 1}\n`;
    msg += `Daily Limit: ${session.dailyLimit}\n`;
    msg += `Today Sent: ${session.todaySent}/${session.dailyLimit}\n`;
    msg += `Total Sent: ${session.sent}\n`;
    msg += `Failed: ${session.failed}\n`;
    msg += `Success Rate: ${successRate}%\n`;
    msg += `Started: ${new Date(session.startDate).toLocaleDateString('en-IN')}\n\n`;
  }
  
  return msg;
}
