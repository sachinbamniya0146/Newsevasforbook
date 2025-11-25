import makeWASocket, { useMultiFileAuthState, DisconnectReason, Browsers } from '@whiskeysockets/baileys';
import P from 'pino';

async function findGroups() {
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
      if (update.connection === 'open') {
        console.log(`
✅ Connected! Fetching all groups...
`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
        
        try {
          const groups = await sock.groupFetchAllParticipating();
          
          if (Object.keys(groups).length === 0) {
            console.log('❌ No groups found!');
            console.log('Make sure bot is added to groups first.');
          } else {
            console.log(`Found ${Object.keys(groups).length} groups:
`);
            
            for (const [jid, group] of Object.entries(groups)) {
              console.log(`📢 Group Name: ${group.subject}`);
              console.log(`   JID: ${jid}`);
              console.log(`   Members: ${group.participants.length}`);
              console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
            }
            
            console.log(`
💡 Copy the JID of "Order_received_on_WhatsApp" group`);
            console.log(`💡 Paste it in config.js as ORDER_GROUP_JID
`);
          }
        } catch (e) {
          console.error('❌ Error fetching groups:', e.message);
        }
        
        process.exit(0);
      }
      
      if (update.connection === 'close') {
        const shouldReconnect = update.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        if (shouldReconnect) {
          console.log('🔄 Connection closed, retrying...');
          setTimeout(() => findGroups(), 3000);
        } else {
          console.log('❌ Session logged out. Run bot.js first to create session.');
          process.exit(1);
        }
      }
      
      if (update.connection === 'connecting') {
        console.log('🔄 Connecting to WhatsApp...');
      }
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log(`
💡 Make sure you have connected bot first:`);
    console.log('   1. Run: node bot.js');
    console.log('   2. Connect using QR or Pairing code');
    console.log('   3. Then run: node find-group.js');
    process.exit(1);
  }
}

findGroups();
