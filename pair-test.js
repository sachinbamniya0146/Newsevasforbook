import { makeWASocket, useMultiFileAuthState, Browsers, makeCacheableSignalKeyStore, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import P from 'pino';
import readline from 'readline';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(q) {
  return new Promise(r => rl.question(q, r));
}

async function main() {
  const sessionName = 'test1';
  const { state, saveCreds } = await useMultiFileAuthState('./sessions/' + sessionName);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, P({ level: 'silent' }))
    },
    logger: P({ level: 'info' }),
    browser: Browsers.ubuntu('PairTest'),
    printQRInTerminal: false,
    syncFullHistory: false
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    console.log('connection.update:', connection, lastDisconnect?.error?.output?.statusCode);
  });

  const phone = await ask('Phone (with country code, e.g. 919876543210): ');
  try {
    const code = await sock.requestPairingCode(phone.trim());
    console.log('Pairing Code:', code);
    console.log('Enter this in WhatsApp > Linked Devices > Link with phone number');
  } catch (e) {
    console.error('Pairing error:', e);
  }
}

main();
