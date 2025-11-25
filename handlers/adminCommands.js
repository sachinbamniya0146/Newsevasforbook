import { logger } from '../utils/logger.js';
import CONFIG from '../config.js';
import { getSessionAdminManager } from '../utils/sessionManager.js';
import { getBulkSender } from '../utils/bulkSender.js';
import { 
  getActiveSessions, 
  getAllSessionInfo, 
  isSessionConnected,
  shutdownSession,
  getSocket
} from '../utils/connectionManager.js';
import {
  initiateRemotePairing,
  getActivePairingRequests,
  cancelPairingRequest
} from '../utils/pairingManager.js';

/**
 * 🎛️ AdminCommands - Complete Admin Control System
 * 
 * Features:
 * ✅ Main menu with all options
 * ✅ Session management (add/remove/list admins)
 * ✅ Bulk sender control (start/pause/resume/stop)
 * ✅ Campaign statistics & reports
 * ✅ Remote pairing system
 * ✅ Session health monitoring
 * ✅ Excel file management
 * ✅ System status & diagnostics
 * ✅ Per-session admin forwarding setup
 */

class AdminCommands {
  constructor() {
    this.sessionAdminManager = getSessionAdminManager();
    this.bulkSender = getBulkSender();
    
    // Command prefix
    this.prefix = '/';
    
    // Admin conversation state (for multi-step commands)
    this.conversationState = new Map(); // adminJID -> { command, step, data }
    
    logger.success('✅ AdminCommands initialized');
  }

  // ==================== COMMAND ROUTING ====================

  /**
   * Handle incoming admin message
   */
  async handleAdminMessage(sock, message, adminJID) {
    try {
      const text = message.message?.conversation || 
                   message.message?.extendedTextMessage?.text || '';
      
      if (!text) return;
      
      // Check if admin is in conversation
      if (this.conversationState.has(adminJID)) {
        await this.handleConversation(sock, text, adminJID);
        return;
      }
      
      // Check if command
      if (text.startsWith(this.prefix)) {
        await this.executeCommand(sock, text, adminJID, message);
        return;
      }
      
      // Default: show help
      // (Optional - comment out if you don't want auto-help)
      
    } catch (error) {
      logger.error(`❌ Admin message handler error: ${error.message}`);
    }
  }

  /**
   * Execute command
   */
  async executeCommand(sock, text, adminJID, message) {
    try {
      const args = text.slice(1).trim().split(/\s+/);
      const command = args[0].toLowerCase();
      const params = args.slice(1);
      
      logger.info(`📝 Admin command: ${command} from ${adminJID.split('@')[0]}`);
      
      // Route to appropriate handler
      switch (command) {
        // Main menu
        case 'menu':
        case 'start':
        case 'help':
          await this.showMainMenu(sock, adminJID);
          break;
        
        // Session admin management
        case 'addadmin':
          await this.addSessionAdmin(sock, adminJID, params);
          break;
        
        case 'removeadmin':
          await this.removeSessionAdmin(sock, adminJID, params);
          break;
        
        case 'listadmins':
          await this.listSessionAdmins(sock, adminJID);
          break;
        
        // Bulk sender control
        case 'bulkstart':
          await this.startBulkSender(sock, adminJID);
          break;
        
        case 'bulkpause':
          await this.pauseBulkSender(sock, adminJID);
          break;
        
        case 'bulkresume':
          await this.resumeBulkSender(sock, adminJID);
          break;
        
        case 'bulkstop':
          await this.stopBulkSender(sock, adminJID);
          break;
        
        case 'bulkstatus':
          await this.showBulkStatus(sock, adminJID);
          break;
        
        // Campaign management
        case 'campaigns':
          await this.showCampaigns(sock, adminJID);
          break;
        
        case 'campaigninfo':
          await this.showCampaignInfo(sock, adminJID, params);
          break;
        
        // Statistics & reports
        case 'stats':
        case 'report':
          await this.showStatistics(sock, adminJID);
          break;
        
        case 'sessionstats':
          await this.showSessionStats(sock, adminJID);
          break;
        
        // Remote pairing
        case 'pair':
          await this.startRemotePairing(sock, adminJID, params);
          break;
        
        case 'pairinglist':
          await this.showPairingRequests(sock, adminJID);
          break;
        
        case 'cancelpair':
          await this.cancelPairing(sock, adminJID, params);
          break;
        
        // Session management
        case 'sessions':
          await this.showSessions(sock, adminJID);
          break;
        
        case 'sessioninfo':
          await this.showSessionInfo(sock, adminJID, params);
          break;
        
        case 'shutdownsession':
          await this.shutdownSessionCommand(sock, adminJID, params);
          break;
        
        // System
        case 'system':
        case 'status':
          await this.showSystemStatus(sock, adminJID);
          break;
        
        case 'ping':
          await this.ping(sock, adminJID);
          break;
        
        // Unknown command
        default:
          await this.sendMessage(sock, adminJID, 
            `❌ Unknown command: *${command}*\n\n` +
            `Type */menu* to see all available commands.`
          );
      }
      
    } catch (error) {
      logger.error(`❌ Execute command error: ${error.message}`);
      await this.sendMessage(sock, adminJID, 
        `❌ *Error executing command*\n\n${error.message}`
      );
    }
  }

  // ==================== MAIN MENU ====================

  async showMainMenu(sock, adminJID) {
    const menu = `🎛️ *ADMIN CONTROL PANEL*
${'='.repeat(35)}

📱 *SESSION ADMIN MANAGEMENT:*
/addadmin <session> <phone>
  ↳ Set admin for specific session
/removeadmin <session>
  ↳ Remove session admin
/listadmins
  ↳ Show all session-admin mappings

📤 *BULK SENDER CONTROL:*
/bulkstart - Start 24/7 bulk sender
/bulkpause - Pause bulk sender
/bulkresume - Resume bulk sender
/bulkstop - Stop bulk sender
/bulkstatus - Show bulk sender status

📊 *CAMPAIGN MANAGEMENT:*
/campaigns - List active campaigns
/campaigninfo <id> - Campaign details
/stats - Global statistics
/sessionstats - Per-session statistics

🔐 *REMOTE PAIRING:*
/pair <session> <phone>
  ↳ Link WhatsApp remotely
/pairinglist - Active pairing requests
/cancelpair <session> - Cancel pairing

📱 *SESSION MANAGEMENT:*
/sessions - List all sessions
/sessioninfo <name> - Session details
/shutdownsession <name> - Shutdown session

⚙️ *SYSTEM:*
/system - System status
/ping - Check bot status
/menu - Show this menu

${'='.repeat(35)}
👑 *Main Admin:* ${CONFIG.ADMIN.PHONE}`;

    await this.sendMessage(sock, adminJID, menu);
  }

  // ==================== SESSION ADMIN MANAGEMENT ====================

  /**
   * Add session-specific admin
   * Usage: /addadmin satish1 9876543210
   */
  async addSessionAdmin(sock, adminJID, params) {
    try {
      // Check if main admin only
      if (!this.sessionAdminManager.isMainAdmin(adminJID)) {
        await this.sendMessage(sock, adminJID, 
          `❌ *Permission Denied*\n\nOnly main admin can add session admins.`
        );
        return;
      }
      
      // Check parameters
      if (params.length < 2) {
        await this.sendMessage(sock, adminJID,
          `❌ *Invalid Usage*\n\n` +
          `Correct format:\n` +
          `/addadmin <session_name> <phone_number>\n\n` +
          `Example:\n` +
          `/addadmin satish1 9876543210`
        );
        return;
      }
      
      const sessionName = params[0].toLowerCase().trim();
      const phoneNumber = params[1];
      
      // Add session admin
      const result = await this.sessionAdminManager.addSessionAdmin(sessionName, phoneNumber);
      
      if (result.success) {
        await this.sendMessage(sock, adminJID,
          `✅ *Session Admin Added*\n\n` +
          `📱 Session: *${result.sessionName}*\n` +
          `👤 Admin: *${result.adminPhone}*\n\n` +
          `Orders from session "${result.sessionName}" will now be forwarded to:\n` +
          `• Main Admin: ${CONFIG.ADMIN.PHONE}\n` +
          `• Session Admin: ${result.adminPhone}\n` +
          `• Group: ${CONFIG.ORDER_GROUP_NAME}`
        );
      } else {
        await this.sendMessage(sock, adminJID,
          `❌ *Failed to Add Admin*\n\n${result.error}`
        );
      }
      
    } catch (error) {
      logger.error(`❌ Add session admin error: ${error.message}`);
      await this.sendMessage(sock, adminJID, `❌ Error: ${error.message}`);
    }
  }

  /**
   * Remove session-specific admin
   * Usage: /removeadmin satish1
   */
  async removeSessionAdmin(sock, adminJID, params) {
    try {
      // Check if main admin only
      if (!this.sessionAdminManager.isMainAdmin(adminJID)) {
        await this.sendMessage(sock, adminJID, 
          `❌ *Permission Denied*\n\nOnly main admin can remove session admins.`
        );
        return;
      }
      
      if (params.length < 1) {
        await this.sendMessage(sock, adminJID,
          `❌ *Invalid Usage*\n\n` +
          `Format: /removeadmin <session_name>\n` +
          `Example: /removeadmin satish1`
        );
        return;
      }
      
      const sessionName = params[0].toLowerCase().trim();
      
      const result = await this.sessionAdminManager.removeSessionAdmin(sessionName);
      
      if (result.success) {
        await this.sendMessage(sock, adminJID,
          `✅ *Session Admin Removed*\n\n` +
          `📱 Session: *${result.sessionName}*\n\n` +
          `Orders will now only forward to main admin.`
        );
      } else {
        await this.sendMessage(sock, adminJID,
          `❌ *Failed to Remove*\n\n${result.error}`
        );
      }
      
    } catch (error) {
      logger.error(`❌ Remove session admin error: ${error.message}`);
      await this.sendMessage(sock, adminJID, `❌ Error: ${error.message}`);
    }
  }

  /**
   * List all session-admin mappings
   */
  async listSessionAdmins(sock, adminJID) {
    try {
      const mappings = this.sessionAdminManager.listSessionAdmins();
      
      if (mappings.length === 0) {
        await this.sendMessage(sock, adminJID,
          `📋 *Session Admin Mappings*\n\n` +
          `No session-specific admins configured.\n\n` +
          `All orders forward to main admin:\n` +
          `👑 ${CONFIG.ADMIN.PHONE}`
        );
        return;
      }
      
      let message = `📋 *Session Admin Mappings*\n`;
      message += `${'='.repeat(30)}\n\n`;
      
      for (const mapping of mappings) {
        message += `📱 *${mapping.session}*\n`;
        message += `   ↳ Admin: ${mapping.adminPhone}\n\n`;
      }
      
      message += `${'='.repeat(30)}\n`;
      message += `👑 Main Admin: ${CONFIG.ADMIN.PHONE}\n`;
      message += `📊 Total Mappings: ${mappings.length}`;
      
      await this.sendMessage(sock, adminJID, message);
      
    } catch (error) {
      logger.error(`❌ List admins error: ${error.message}`);
      await this.sendMessage(sock, adminJID, `❌ Error: ${error.message}`);
    }
  }

  // ==================== BULK SENDER CONTROL ====================

  async startBulkSender(sock, adminJID) {
    try {
      // Check if main admin only
      if (!this.sessionAdminManager.isMainAdmin(adminJID)) {
        await this.sendMessage(sock, adminJID, 
          `❌ *Permission Denied*\n\nOnly main admin can control bulk sender.`
        );
        return;
      }
      
      const result = this.bulkSender.start();
      
      if (result.success) {
        await this.sendMessage(sock, adminJID,
          `🚀 *BULK SENDER STARTED*\n\n` +
          `✅ 24/7 operation mode activated\n` +
          `📁 Watching: ${CONFIG.BULK.EXCEL_FOLDER_PATH}\n` +
          `⏰ Business Hours: ${CONFIG.BULK.START_HOUR_IST}:00 - ${CONFIG.BULK.END_HOUR_IST}:00 IST\n\n` +
          `The system will automatically:\n` +
          `• Detect new Excel files\n` +
          `• Create campaigns\n` +
          `• Distribute across sessions\n` +
          `• Send messages with anti-ban delays\n` +
          `• Move completed files to archive\n\n` +
          `Use /bulkstatus to check progress.`
        );
      } else {
        await this.sendMessage(sock, adminJID,
          `❌ *Failed to Start*\n\n${result.error}`
        );
      }
      
    } catch (error) {
      logger.error(`❌ Start bulk sender error: ${error.message}`);
      await this.sendMessage(sock, adminJID, `❌ Error: ${error.message}`);
    }
  }

  async pauseBulkSender(sock, adminJID) {
    try {
      if (!this.sessionAdminManager.isMainAdmin(adminJID)) {
        await this.sendMessage(sock, adminJID, `❌ Permission denied.`);
        return;
      }
      
      const result = this.bulkSender.pause();
      
      if (result.success) {
        await this.sendMessage(sock, adminJID,
          `⏸️ *BULK SENDER PAUSED*\n\n` +
          `All campaigns temporarily paused.\n` +
          `Use /bulkresume to continue.`
        );
      } else {
        await this.sendMessage(sock, adminJID, `❌ ${result.error}`);
      }
      
    } catch (error) {
      logger.error(`❌ Pause bulk sender error: ${error.message}`);
      await this.sendMessage(sock, adminJID, `❌ Error: ${error.message}`);
    }
  }

  async resumeBulkSender(sock, adminJID) {
    try {
      if (!this.sessionAdminManager.isMainAdmin(adminJID)) {
        await this.sendMessage(sock, adminJID, `❌ Permission denied.`);
        return;
      }
      
      const result = this.bulkSender.resume();
      
      if (result.success) {
        await this.sendMessage(sock, adminJID,
          `▶️ *BULK SENDER RESUMED*\n\n` +
          `Campaigns will continue from where they left off.`
        );
      } else {
        await this.sendMessage(sock, adminJID, `❌ ${result.error}`);
      }
      
    } catch (error) {
      logger.error(`❌ Resume bulk sender error: ${error.message}`);
      await this.sendMessage(sock, adminJID, `❌ Error: ${error.message}`);
    }
  }

  async stopBulkSender(sock, adminJID) {
    try {
      if (!this.sessionAdminManager.isMainAdmin(adminJID)) {
        await this.sendMessage(sock, adminJID, `❌ Permission denied.`);
        return;
      }
      
      const result = this.bulkSender.stop();
      
      if (result.success) {
        await this.sendMessage(sock, adminJID,
          `🛑 *BULK SENDER STOPPED*\n\n` +
          `All campaigns stopped.\n` +
          `Use /bulkstart to restart.`
        );
      } else {
        await this.sendMessage(sock, adminJID, `❌ ${result.error}`);
      }
      
    } catch (error) {
      logger.error(`❌ Stop bulk sender error: ${error.message}`);
      await this.sendMessage(sock, adminJID, `❌ Error: ${error.message}`);
    }
  }

  async showBulkStatus(sock, adminJID) {
    try {
      const status = this.bulkSender.getStatus();
      
      let message = `📊 *BULK SENDER STATUS*\n`;
      message += `${'='.repeat(30)}\n\n`;
      
      message += `🔄 *State:* ${status.isRunning ? '✅ Running' : '🔴 Stopped'}${status.isPaused ? ' (Paused)' : ''}\n`;
      message += `🚀 Active Campaigns: ${status.activeCampaigns}\n`;
      message += `📋 Queued: ${status.queuedCampaigns}\n\n`;
      
      message += `📈 *Global Stats:*\n`;
      message += `✅ Sent: ${status.globalStats.totalSent}\n`;
      message += `❌ Failed: ${status.globalStats.totalFailed}\n`;
      message += `🔄 Retries: ${status.globalStats.totalRetries}\n`;
      message += `✅ Campaigns Done: ${status.globalStats.campaignsCompleted}\n`;
      message += `📁 Files Processed: ${status.globalStats.filesProcessed}\n\n`;
      
      if (status.sessions && status.sessions.length > 0) {
        message += `📱 *Sessions (${status.sessions.length}):*\n`;
        for (const session of status.sessions) {
          const health = session.health === 'good' ? '✅' : 
                        session.health === 'warning' ? '⚠️' : '❌';
          const conn = session.connected ? '🟢' : '🔴';
          message += `${health}${conn} ${session.name}: ${session.sent} sent\n`;
        }
      }
      
      await this.sendMessage(sock, adminJID, message);
      
    } catch (error) {
      logger.error(`❌ Show bulk status error: ${error.message}`);
      await this.sendMessage(sock, adminJID, `❌ Error: ${error.message}`);
    }
  }

  // ==================== CAMPAIGN MANAGEMENT ====================

  async showCampaigns(sock, adminJID) {
    try {
      const campaigns = this.bulkSender.getAllCampaignsInfo();
      
      if (campaigns.length === 0) {
        await this.sendMessage(sock, adminJID,
          `📋 *Active Campaigns*\n\n` +
          `No active campaigns.\n\n` +
          `Add Excel files to:\n${CONFIG.BULK.EXCEL_FOLDER_PATH}`
        );
        return;
      }
      
      let message = `📋 *ACTIVE CAMPAIGNS*\n`;
      message += `${'='.repeat(30)}\n\n`;
      
      for (const campaign of campaigns) {
        message += `🚀 *${campaign.name}*\n`;
        message += `   📊 Progress: ${campaign.progress}%\n`;
        message += `   ✅ Sent: ${campaign.sent}/${campaign.totalContacts}\n`;
        message += `   ❌ Failed: ${campaign.failed}\n`;
        message += `   🔄 Retries: ${campaign.retries}\n`;
        message += `   📅 Started: ${new Date(campaign.startedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}\n`;
        message += `\n`;
      }
      
      message += `Total: ${campaigns.length} campaign(s)`;
      
      await this.sendMessage(sock, adminJID, message);
      
    } catch (error) {
      logger.error(`❌ Show campaigns error: ${error.message}`);
      await this.sendMessage(sock, adminJID, `❌ Error: ${error.message}`);
    }
  }

  async showCampaignInfo(sock, adminJID, params) {
    try {
      if (params.length < 1) {
        await this.sendMessage(sock, adminJID,
          `❌ Usage: /campaigninfo <campaign_id>`
        );
        return;
      }
      
      const campaignId = params[0];
      const info = this.bulkSender.getCampaignInfo(campaignId);
      
      if (!info) {
        await this.sendMessage(sock, adminJID,
          `❌ Campaign not found: ${campaignId}`
        );
        return;
      }
      
      let message = `📊 *CAMPAIGN DETAILS*\n`;
      message += `${'='.repeat(30)}\n\n`;
      message += `🆔 ID: ${info.id}\n`;
      message += `📋 Name: *${info.name}*\n`;
      message += `📊 Status: ${info.status}\n\n`;
      message += `📈 *Progress:*\n`;
      message += `   ${info.progress}% complete\n`;
      message += `   ${info.sent}/${info.totalContacts} sent\n\n`;
      message += `✅ Sent: ${info.sent}\n`;
      message += `❌ Failed: ${info.failed}\n`;
      message += `🔄 Retries: ${info.retries}\n\n`;
      message += `📅 Started: ${new Date(info.startedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`;
      
      await this.sendMessage(sock, adminJID, message);
      
    } catch (error) {
      logger.error(`❌ Show campaign info error: ${error.message}`);
      await this.sendMessage(sock, adminJID, `❌ Error: ${error.message}`);
    }
  }

  // ==================== STATISTICS ====================

  async showStatistics(sock, adminJID) {
    try {
      const status = this.bulkSender.getStatus();
      const sessions = getAllSessionInfo();
      
      let message = `📊 *SYSTEM STATISTICS*\n`;
      message += `${'='.repeat(30)}\n\n`;
      
      message += `📈 *Global Stats:*\n`;
      message += `✅ Total Sent: ${status.globalStats.totalSent}\n`;
      message += `❌ Total Failed: ${status.globalStats.totalFailed}\n`;
      message += `🔄 Total Retries: ${status.globalStats.totalRetries}\n`;
      message += `✅ Campaigns Completed: ${status.globalStats.campaignsCompleted}\n`;
      message += `📁 Files Processed: ${status.globalStats.filesProcessed}\n\n`;
      
      message += `📱 *Sessions:*\n`;
      message += `   Total: ${Object.keys(sessions).length}\n`;
      message += `   Connected: ${Object.values(sessions).filter(s => s.state === 'connected').length}\n`;
      message += `   Stable: ${Object.values(sessions).filter(s => s.state === 'stable').length}\n\n`;
      
      message += `🚀 *Bulk Sender:*\n`;
      message += `   Status: ${status.isRunning ? '✅ Running' : '🔴 Stopped'}\n`;
      message += `   Active Campaigns: ${status.activeCampaigns}\n`;
      message += `   Queued: ${status.queuedCampaigns}\n\n`;
      
      message += `⏰ *System Uptime:*\n`;
      const uptime = Date.now() - new Date(status.globalStats.startTime).getTime();
      const hours = Math.floor(uptime / (1000 * 60 * 60));
      const mins = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
      message += `   ${hours}h ${mins}m`;
      
      await this.sendMessage(sock, adminJID, message);
      
    } catch (error) {
      logger.error(`❌ Show statistics error: ${error.message}`);
      await this.sendMessage(sock, adminJID, `❌ Error: ${error.message}`);
    }
  }

  async showSessionStats(sock, adminJID) {
    try {
      const status = this.bulkSender.getStatus();
      
      if (!status.sessions || status.sessions.length === 0) {
        await this.sendMessage(sock, adminJID,
          `📱 *Session Statistics*\n\nNo sessions available.`
        );
        return;
      }
      
      let message = `📱 *SESSION STATISTICS*\n`;
      message += `${'='.repeat(30)}\n\n`;
      
      for (const session of status.sessions) {
        const health = session.health === 'good' ? '✅' : 
                      session.health === 'warning' ? '⚠️' : 
                      session.health === 'critical' ? '❌' : '🔴';
        const conn = session.connected ? '🟢 Online' : '🔴 Offline';
        
        message += `${health} *${session.name}*\n`;
        message += `   Status: ${conn}\n`;
        message += `   Sent: ${session.sent}\n`;
        message += `   Failed: ${session.failed}\n`;
        message += `   Health: ${session.health}\n`;
        message += `\n`;
      }
      
      await this.sendMessage(sock, adminJID, message);
      
    } catch (error) {
      logger.error(`❌ Show session stats error: ${error.message}`);
      await this.sendMessage(sock, adminJID, `❌ Error: ${error.message}`);
    }
  }

  // ==================== REMOTE PAIRING ====================

  /**
   * Start remote pairing
   * Usage: /pair satish1 9876543210
   */
  async startRemotePairing(sock, adminJID, params) {
    try {
      if (!this.sessionAdminManager.isMainAdmin(adminJID)) {
        await this.sendMessage(sock, adminJID, `❌ Permission denied.`);
        return;
      }
      
      if (params.length < 2) {
        await this.sendMessage(sock, adminJID,
          `❌ *Invalid Usage*\n\n` +
          `Format: /pair <session_name> <phone_number>\n` +
          `Example: /pair satish1 9876543210\n\n` +
          `This will generate a pairing code for linking WhatsApp.`
        );
        return;
      }
      
      const sessionName = params[0].toLowerCase().trim();
      const phoneNumber = params[1];
      
      const result = await initiateRemotePairing(sessionName, phoneNumber, adminJID);
      
      if (result.success) {
        await this.sendMessage(sock, adminJID,
          `🔐 *PAIRING INITIATED*\n\n` +
          `📱 Session: *${result.sessionName}*\n` +
          `📞 Phone: *${result.phoneNumber}*\n` +
          `⏳ Expires: ${result.expiresIn}\n\n` +
          `Pairing code will be forwarded to you shortly.\n` +
          `Enter it in WhatsApp on phone ${result.phoneNumber}.`
        );
      } else {
        await this.sendMessage(sock, adminJID,
          `❌ *Pairing Failed*\n\n${result.error}`
        );
      }
      
    } catch (error) {
      logger.error(`❌ Start pairing error: ${error.message}`);
      await this.sendMessage(sock, adminJID, `❌ Error: ${error.message}`);
    }
  }

  async showPairingRequests(sock, adminJID) {
    try {
      const requests = getActivePairingRequests();
      
      if (requests.length === 0) {
        await this.sendMessage(sock, adminJID,
          `🔐 *Active Pairing Requests*\n\nNo active pairing requests.`
        );
        return;
      }
      
      let message = `🔐 *ACTIVE PAIRING REQUESTS*\n`;
      message += `${'='.repeat(30)}\n\n`;
      
      for (const req of requests) {
        message += `📱 *${req.sessionName}*\n`;
        message += `   Phone: ${req.phoneNumber}\n`;
        message += `   Status: ${req.status}\n`;
        message += `   Has Code: ${req.hasCode ? 'Yes' : 'No'}\n`;
        message += `   Admin: ${req.adminJID}\n\n`;
      }
      
      await this.sendMessage(sock, adminJID, message);
      
    } catch (error) {
      logger.error(`❌ Show pairing requests error: ${error.message}`);
      await this.sendMessage(sock, adminJID, `❌ Error: ${error.message}`);
    }
  }

  async cancelPairing(sock, adminJID, params) {
    try {
      if (!this.sessionAdminManager.isMainAdmin(adminJID)) {
        await this.sendMessage(sock,adminJID, ❌ Permission denied.);
return;
}
if (params.length < 1) {
    await this.sendMessage(sock, adminJID,
      `❌ Usage: /cancelpair <session_name>`
    );
    return;
  }
  
  const sessionName = params[0].toLowerCase().trim();
  const result = await cancelPairingRequest(sessionName);
  
  if (result.success) {
    await this.sendMessage(sock, adminJID,
      `🛑 *Pairing Cancelled*\n\nSession: ${sessionName}`
    );
  } else {
    await this.sendMessage(sock, adminJID,
      `❌ ${result.error}`
    );
  }
  
} catch (error) {
  logger.error(`❌ Cancel pairing error: ${error.message}`);
  await this.sendMessage(sock, adminJID, `❌ Error: ${error.message}`);
}
}
// ==================== SESSION MANAGEMENT ====================
async showSessions(sock, adminJID) {
try {
const sessions = getActiveSessions();
const sessionInfo = getAllSessionInfo();
if (sessions.length === 0) {
    await this.sendMessage(sock, adminJID,
      `📱 *Active Sessions*\n\nNo active sessions.`
    );
    return;
  }
  
  let message = `📱 *ACTIVE SESSIONS*\n`;
  message += `${'='.repeat(30)}\n\n`;
  
  for (const sessionName of sessions) {
    const info = sessionInfo[sessionName];
    
    if (!info) continue;
    
    const status = info.state === 'connected' ? '🟢' : 
                  info.state === 'connecting' ? '🟡' : 
                  info.state === 'stable' ? '✅' : '🔴';
    
    message += `${status} *${sessionName}*\n`;
    message += `   State: ${info.state}\n`;
    message += `   Status: ${info.lastStatus}\n`;
    
    if (info.connectedAt) {
      const connTime = new Date(info.connectedAt).toLocaleString('en-IN', { 
        timeZone: 'Asia/Kolkata',
        dateStyle: 'short',
        timeStyle: 'short'
      });
      message += `   Connected: ${connTime}\n`;
    }
    
    if (info.retry > 0) {
      message += `   Retries: ${info.retry}\n`;
    }
    
    if (info.errors > 0) {
      message += `   Errors: ${info.errors}\n`;
    }
    
    message += `\n`;
  }
  
  message += `Total: ${sessions.length} session(s)`;
  
  await this.sendMessage(sock, adminJID, message);
  
} catch (error) {
  logger.error(`❌ Show sessions error: ${error.message}`);
  await this.sendMessage(sock, adminJID, `❌ Error: ${error.message}`);
}
}
async showSessionInfo(sock, adminJID, params) {
try {
if (params.length < 1) {
await this.sendMessage(sock, adminJID,
❌ Usage: /sessioninfo <session_name>
);
return;
}
const sessionName = params[0].toLowerCase().trim();
  const sessionInfo = getAllSessionInfo();
  const info = sessionInfo[sessionName];
  
  if (!info) {
    await this.sendMessage(sock, adminJID,
      `❌ Session not found: ${sessionName}`
    );
    return;
  }
  
  let message = `📱 *SESSION DETAILS*\n`;
  message += `${'='.repeat(30)}\n\n`;
  message += `📱 Name: *${sessionName}*\n`;
  message += `🔄 State: ${info.state}\n`;
  message += `📊 Status: ${info.lastStatus}\n`;
  
  if (info.connectedAt) {
    message += `⏰ Connected: ${new Date(info.connectedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}\n`;
  }
  
  message += `🔄 Retry Count: ${info.retry}\n`;
  message += `❌ Errors: ${info.errors}\n`;
  
  if (info.hasPairingCode) {
    message += `🔐 Has Pairing Code: Yes\n`;
  }
  
  // Check if this session has a specific admin
  const sessionAdmin = this.sessionAdminManager.getAdminForSession(sessionName);
  const mainAdmin = CONFIG.ADMIN.JID;
  
  if (sessionAdmin !== mainAdmin) {
    message += `\n👤 *Session Admin:*\n`;
    message += `   ${sessionAdmin.split('@')[0]}`;
  }
  
  await this.sendMessage(sock, adminJID, message);
  
} catch (error) {
  logger.error(`❌ Show session info error: ${error.message}`);
  await this.sendMessage(sock, adminJID, `❌ Error: ${error.message}`);
}
}
async shutdownSessionCommand(sock, adminJID, params) {
try {
if (!this.sessionAdminManager.isMainAdmin(adminJID)) {
await this.sendMessage(sock, adminJID, ❌ Permission denied.);
return;
}
if (params.length < 1) {
    await this.sendMessage(sock, adminJID,
      `❌ Usage: /shutdownsession <session_name>`
    );
    return;
  }
  
  const sessionName = params[0].toLowerCase().trim();
  const result = await shutdownSession(sessionName);
  
  if (result.success) {
    await this.sendMessage(sock, adminJID,
      `✅ *Session Shutdown*\n\nSession "${sessionName}" has been shutdown.`
    );
  } else {
    await this.sendMessage(sock, adminJID,
      `❌ ${result.error}`
    );
  }
  
} catch (error) {
  logger.error(`❌ Shutdown session error: ${error.message}`);
  await this.sendMessage(sock, adminJID, `❌ Error: ${error.message}`);
}
}
// ==================== SYSTEM ====================
async showSystemStatus(sock, adminJID) {
try {
const sessions = getActiveSessions();
const sessionInfo = getAllSessionInfo();
const bulkStatus = this.bulkSender.getStatus();
let message = `⚙️ *SYSTEM STATUS*\n`;
  message += `${'='.repeat(30)}\n\n`;
  
  message += `🤖 *Bot Info:*\n`;
  message += `   Name: ${CONFIG.BOT_NAME}\n`;
  message += `   Version: ${CONFIG.BOT_VERSION}\n\n`;
  
  message += `📱 *Sessions:*\n`;
  message += `   Total: ${sessions.length}\n`;
  message += `   Connected: ${Object.values(sessionInfo).filter(s => s.state === 'connected').length}\n`;
  message += `   Stable: ${Object.values(sessionInfo).filter(s => s.state === 'stable').length}\n\n`;
  
  message += `📤 *Bulk Sender:*\n`;
  message += `   Status: ${bulkStatus.isRunning ? '✅ Running' : '🔴 Stopped'}${bulkStatus.isPaused ? ' (Paused)' : ''}\n`;
  message += `   Active: ${bulkStatus.activeCampaigns} campaigns\n`;
  message += `   Queued: ${bulkStatus.queuedCampaigns}\n`;
  message += `   Sent: ${bulkStatus.globalStats.totalSent}\n`;
  message += `   Failed: ${bulkStatus.globalStats.totalFailed}\n\n`;
  
  message += `👑 *Admin:*\n`;
  message += `   Main: ${CONFIG.ADMIN.PHONE}\n`;
  
  const sessionAdmins = this.sessionAdminManager.listSessionAdmins();
  if (sessionAdmins.length > 0) {
    message += `   Session Admins: ${sessionAdmins.length}\n`;
  }
  
  message += `\n⏰ Current Time:\n`;
  message += `   ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`;
  
  await this.sendMessage(sock, adminJID, message);
  
} catch (error) {
  logger.error(`❌ Show system status error: ${error.message}`);
  await this.sendMessage(sock, adminJID, `❌ Error: ${error.message}`);
}
}
async ping(sock, adminJID) {
const start = Date.now();
await this.sendMessage(sock, adminJID, '🏓 Pong!');

const latency = Date.now() - start;

await this.sendMessage(sock, adminJID,
  `⚡ Response time: ${latency}ms\n` +
  `✅ Bot is running normally.`
);
}
// ==================== CONVERSATION HANDLER ====================
/**
Handle multi-step conversations
*/
async handleConversation(sock, text, adminJID) {
try {
const state = this.conversationState.get(adminJID);
if (!state) return;
// Handle based on current command
switch (state.command) {
case 'addadmin':
await this.handleAddAdminConversation(sock, text, adminJID, state);
break;
case 'pair':
await this.handlePairConversation(sock, text, adminJID, state);
break;
default:
// Unknown conversation, clear state
this.conversationState.delete(adminJID);
}
} catch (error) {
  logger.error(`❌ Handle conversation error: ${error.message}`);
  this.conversationState.delete(adminJID);
  await this.sendMessage(sock, adminJID, `❌ Error: ${error.message}`);
}
}
async handleAddAdminConversation(sock, text, adminJID, state) {
if (state.step === 'session') {
// Save session name
state.data.sessionName = text.toLowerCase().trim();
state.step = 'phone';
await this.sendMessage(sock, adminJID,
    `📞 Enter admin phone number for session "${state.data.sessionName}":\n\n` +
    `Example: 9876543210`
  );
  
  this.conversationState.set(adminJID, state);
  
} else if (state.step === 'phone') {
  // Complete the add admin process
  const sessionName = state.data.sessionName;
  const phoneNumber = text.trim();
  
  this.conversationState.delete(adminJID);
  
  await this.addSessionAdmin(sock, adminJID, [sessionName, phoneNumber]);
}
}
async handlePairConversation(sock, text, adminJID, state) {
if (state.step === 'session') {
state.data.sessionName = text.toLowerCase().trim();
state.step = 'phone';
await this.sendMessage(sock, adminJID,
    `📞 Enter phone number to link:\n\n` +
    `Example: 9876543210`
  );
  
  this.conversationState.set(adminJID, state);
  
} else if (state.step === 'phone') {
  const sessionName = state.data.sessionName;
  const phoneNumber = text.trim();
  
  this.conversationState.delete(adminJID);
  
  await this.startRemotePairing(sock, adminJID, [sessionName, phoneNumber]);
}
}
// ==================== UTILITY ====================
/**
Send message to admin
*/
async sendMessage(sock, jid, text) {
try {
await sock.sendMessage(jid, { text });
logger.trace(📤 Sent message to ${jid.split('@')[0]});
} catch (error) {
logger.error(❌ Send message error: ${error.message});
throw error;
}
}
/**
Check if user is admin
*/
isAdmin(jid) {
return this.sessionAdminManager.isAdmin(jid);
}
/**
Get admin level
*/
getAdminLevel(jid) {
return this.sessionAdminManager.getAdminLevel(jid);
}
}
// ==================== SINGLETON EXPORT ====================
let adminCommandsInstance = null;
export function getAdminCommands() {
if (!adminCommandsInstance) {
adminCommandsInstance = new AdminCommands();
}
return adminCommandsInstance;
}
export default { getAdminCommands };
