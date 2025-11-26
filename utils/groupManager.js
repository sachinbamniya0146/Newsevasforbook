import CONFIG from '../config.js';

export async function sendToOrderGroup(sock, sessionName, message) {
  try {
    const groupJid = CONFIG.ORDER_GROUPS && CONFIG.ORDER_GROUPS[sessionName];
    
    if (!groupJid) {
      console.log('⚠️ No group for:', sessionName);
      return false;
    }
    
    await sock.sendMessage(groupJid, { text: message });
    console.log('✅ Sent to group:', groupJid);
    return true;
    
  } catch (error) {
    console.error('❌ Group error:', error);
    return false;
  }
}

export async function sendBulkToGroups(sock, message, sessions = []) {
  const results = [];
  
  for (const session of sessions) {
    const result = await sendToOrderGroup(sock, session, message);
    results.push({ session, success: result });
  }
  
  return results;
}
