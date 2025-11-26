import makeWASocket, { useMultiFileAuthState, DisconnectReason, Browsers } from '@whiskeysockets/baileys';
import P from 'pino';

async function getGroupId() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState('./sessions/main');
    
    const sock = makeWASocket({
      auth: state,
      logger: P({ level: 'silent' }),
      printQRInTerminal: false,
      browser: Browsers.ubuntu('Chrome')
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log('Connection closed. Reconnect:', shouldReconnect);
        if (shouldReconnect) {
          setTimeout(() => getGroupId(), 3000);
        } else {
          console.log('❌ Session logged out. Please login again.');
          process.exit(1);
        }
      }

      if (connection === 'open') {
        console.log(`✅ Connected! Fetching groups...
`);
        
        try {
          const groups = await sock.groupFetchAllParticipating();
          
          if (Object.keys(groups).length === 0) {
            console.log('❌ No groups found. Make sure bot is added to groups.');
          } else {
            console.log(`📢 Found ${Object.keys(groups).length} groups:
`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            
            for (const [jid, group] of Object.entries(groups)) {
              console.log(`📢 Group Name: ${group.subject}`);
              console.log(`   JID: ${jid}`);
              console.log(`   Members: ${group.participants.length}`);
              console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            }
            
            console.log(`
💡 Copy the JID of "Order_received_on_WhatsApp" group`);
            console.log(`💡 Paste it in config.js as ORDER_GROUP_JID`);
          }
        } catch (e) {
          console.error('❌ Error fetching groups:', e.message);
        }
        
        process.exit(0);
      }

      if (connection === 'connecting') {
        console.log('🔄 Connecting to WhatsApp...');
      }
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log(`
💡 Make sure you have a valid session in ./sessions/main`);
    console.log('💡 Run bot.js first to create a session');
    process.exit(1);
  }
}

getGroupId();
