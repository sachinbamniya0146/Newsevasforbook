import CONFIG from '../config.js';

/**
 * Handle numeric menu selections from admin
 */
export async function handleAdminMenu(sock, message, from, menuChoice, activeSessions) {
  try {
    const choice = menuChoice.trim();
    
    switch(choice) {
      case '1':
        await showSessionManagementMenu(sock, from, activeSessions);
        break;
      case '2':
        await showBulkSenderMenu(sock, from);
        break;
      case '3':
        await showOrderManagementMenu(sock, from);
        break;
      case '4':
        await showSystemStatus(sock, from, activeSessions);
        break;
      case '5':
        await showSessionAdminMenu(sock, from);
        break;
      default:
        await sock.sendMessage(from, {
          text: `❌ Invalid option: ${choice}

Reply with 1-5 or use /help`
        });
    }
  } catch (error) {
    console.error(`[AdminMenu] Error: ${error.message}`);
    await sock.sendMessage(from, {
      text: `❌ Menu error: ${error.message}`
    });
  }
}

async function showSessionManagementMenu(sock, from, activeSessions) {
  let text = `📱 *SESSION MANAGEMENT*\n\n`;
  text += `🟢 *Active Sessions:* ${activeSessions.size}\n\n`;
  
  if (activeSessions.size > 0) {
    let index = 1;
    for (const [name, session] of activeSessions) {
      const phone = session.user?.id?.split(':')[0] || 'Unknown';
      text += `${index}. *${name}* - ${phone}\n`;
      index++;
    }
  } else {
    text += `❌ No active sessions\n`;
  }
  
  text += `\n📝 *Commands:*\n`;
  text += `/pair <session> <phone> - Add new session\n`;
  text += `/sessions - Refresh list\n\n`;
  text += `Reply *0* to return to main menu`;
  
  await sock.sendMessage(from, { text });
}

async function showBulkSenderMenu(sock, from) {
  let text = `📤 *BULK SENDER CONTROL*\n\n`;
  text += `Status: 🔴 Not Available in this version\n\n`;
  text += `📝 *Commands:*\n`;
  text += `/bulk start - Start sending\n`;
  text += `/bulk stop - Stop sending\n`;
  text += `/bulk status - Check status\n\n`;
  text += `Reply *0* to return to main menu`;
  
  await sock.sendMessage(from, { text });
}

async function showOrderManagementMenu(sock, from) {
  let text = `📦 *ORDER MANAGEMENT*\n\n`;
  text += `Order Group: ${CONFIG.ORDER_GROUP_NAME}\n`;
  text += `Main Admin: ${CONFIG.ADMIN.NAME}\n\n`;
  
  text += `📝 *Available Commands:*\n`;
  text += `/today - Today's orders\n`;
  text += `/pending - Pending orders\n`;
  text += `/search <mobile> - Search order\n`;
  text += `/export - Export to CSV\n\n`;
  
  text += `Reply *0* to return to main menu`;
  
  await sock.sendMessage(from, { text });
}

async function showSystemStatus(sock, from, activeSessions) {
  const uptime = process.uptime();
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  
  const memUsage = process.memoryUsage();
  const memMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  
  let text = `🏥 *SYSTEM STATUS*\n\n`;
  text += `Bot: ${CONFIG.BOT.NAME}\n`;
  text += `Version: ${CONFIG.BOT.VERSION}\n`;
  text += `Uptime: ${hours}h ${minutes}m\n`;
  text += `Memory: ${memMB} MB\n\n`;
  
  text += `📱 *Sessions:*\n`;
  text += `Active: ${activeSessions.size}\n`;
  text += `Auto-Reconnect: ✅\n\n`;
  
  text += `Reply *0* to return to main menu`;
  
  await sock.sendMessage(from, { text });
}

async function showSessionAdminMenu(sock, from) {
  let text = `👥 *SESSION ADMIN CONFIG*\n\n`;
  text += `Main Admin: ${CONFIG.ADMIN.NAME}\n`;
  text += `Phone: ${CONFIG.ADMIN.PHONE}\n\n`;
  
  text += `📝 *Commands:*\n`;
  text += `/addadmin <session> <phone> - Add admin\n`;
  text += `/listadmins - List all admins\n\n`;
  
  text += `Reply *0* to return to main menu`;
  
  await sock.sendMessage(from, { text });
}
