export default {
  // 🔑 MAIN ADMIN (Default - Sabhi orders yaha jayenge)
  ADMIN: {
    JID: '919174406375@s.whatsapp.net',
    PHONE: '919174406375',
    NAME: 'Main Admin',
    PRIVILEGES: 'FULL'
  },
  
  // 📱 PER-SESSION ADMIN MAPPING
  // Format: { 'session_name': '919876543210@s.whatsapp.net' }
  SESSION_ADMINS: {
    // Runtime me admin commands se fill hoga
    // Example: 'satish1': '919876543210@s.whatsapp.net'
  },
  
  // 🏢 ORDER GROUP
  ORDER_GROUP_NAME: 'Order_received_on_WhatsApp',
  USER_GROUP_LINK: 'https://chat.whatsapp.com/LcTW8DuZzV23uhVc7BBcAu',
  
  // 📚 BOOK PDFS
  BOOK_PDFS: {
    'ज्ञान गंगा': {
      'हिंदी': 'https://www.jagatgururampalji.org/gyan_ganga_hindi.pdf',
      'English': 'https://www.jagatgururampalji.org/gyan_ganga_english.pdf',
      'ਪੰਜਾਬੀ': 'https://www.jagatgururampalji.org/jeene-ki-rah-punjabi.pdf',
      'ગુજરાતી': 'https://www.jagatgururampalji.org/jeene-ki-rah-gujarati.pdf',
      'मराठी': 'https://www.jagatgururampalji.org/jeene-ki-rah-marathi.pdf',
      'తెలుగు': 'https://www.jagatgururampalji.org/jeene-ki-rah-telugu.pdf',
      'ಕನ್ನಡ': 'https://www.jagatgururampalji.org/jkr-kannad.pdf',
      'ଓଡ଼ିଆ': 'https://www.jagatgururampalji.org/jkr-odia.pdf',
      'മലയാളം': 'https://www.jagatgururampalji.org/gyan-ganga-malayalam.pdf',
      'বাংলা': 'https://www.jagatgururampalji.org/jeene-ki-rah-bengali.pdf',
      'नेपाली': 'https://www.jagatgururampalji.org/jeene-ki-rah-nepali.pdf',
      'اردو': 'https://www.jagatgururampalji.org/gyan_ganga_urdu.pdf',
      'سنڌي': 'https://www.jagatgururampalji.org/gyan_ganga_sindhi.pdf',
      'Français': 'https://www.jagatgururampalji.org/gyan_ganga_french.pdf'
    },
    'जीने की राह': {
      'हिंदी': 'https://www.jagatgururampalji.org/jeene-ki-rah.pdf',
      'English': 'https://www.jagatgururampalji.org/way-of-living.pdf',
      'ਪੰਜਾਬੀ': 'https://www.jagatgururampalji.org/jeene-ki-rah-punjabi.pdf',
      'ગુજરાતી': 'https://www.jagatgururampalji.org/jeene-ki-rah-gujarati.pdf',
      'मराठी': 'https://www.jagatgururampalji.org/jeene-ki-rah-marathi.pdf',
      'తెలుగు': 'https://www.jagatgururampalji.org/jeene-ki-rah-telugu.pdf',
      'ಕನ್ನಡ': 'https://www.jagatgururampalji.org/jkr-kannad.pdf',
      'ଓଡ଼ିଆ': 'https://www.jagatgururampalji.org/jkr-odia.pdf',
      'മലയാളം': 'https://www.jagatgururampalji.org/jkr_malayalam.pdf',
      'বাংলা': 'https://www.jagatgururampalji.org/jeene-ki-rah-bengali.pdf',
      'नेपाली': 'https://www.jagatgururampalji.org/jeene-ki-rah-nepali.pdf',
      'اردو': 'https://www.jagatgururampalji.org/jeene-ki-rah-urdu-india.pdf',
      'سنڌي': 'https://www.jagatgururampalji.org/gyan_ganga_sindhi.pdf',
      'Français': 'https://www.jagatgururampalji.org/way-of-living.pdf'
    }
  },

  // 💬 MESSAGES
  DELIVERY_MSG: `📦 *डिलीवरी:* 7-21 दिन (निःशुल्क)\n_7-21 days (Free)_`,
  SUPPORT_CONTACT: `📞 *सहायता / Support:*\n+91 8586003472\n+91 9555000808`,
  BOT_NAME: 'Waseva Satguru Bot',
  BOT_VERSION: '5.0.0',
  
  WELCOME_MSG: `🙏 *नमस्ते! Namaste!*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📚 *संत रामपाल जी महाराज* की निःशुल्क पुस्तक सेवा

_Free Book Service by Sant Rampal Ji Maharaj_

हम आपको निःशुल्क पुस्तक भेजना चाहते हैं जो कि पूर्ण रूप से निःशुल्क है, delivery भी फ्री है, कोई चार्ज नहीं है।

_We want to send you a completely free book, delivery is also free, no charges at all._

📖 *पुस्तक में क्या है?*

जीते जी मुक्ति पाने का उपाय इस पुस्तक में बताया गया है। मरने का इंतजार मत करें।

_Way to attain liberation while alive explained in this book. Don't wait for death._

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*कौनसी पुस्तक चाहिए?*

_Which book would you like?_

1️⃣ ज्ञान गंगा (Gyan Ganga)

2️⃣ जीने की राह (Way of Living)

3️⃣ पहले PDF देखना चाहते हैं? (Want to see PDF first?)

*1 भेजें यदि ज्ञान गंगा चाहिए*

*2 भेजें यदि जीने की राह चाहिए*

*3 या pdf भेजें यदि पहले पुस्तक देखना चाहते हैं*`,

  ORDER_SUCCESS_MSG: `🎉 *ऑर्डर सफलतापूर्वक दर्ज!*\n_Order Successfully Placed!_`,
  GROUP_JOIN_MSG: `📢 *हमारे WhatsApp ग्रुप से जुड़ें:*\n_Join our WhatsApp Group:_`,

  // 📌 CONNECTION STABILITY
  CONNECTION: {
    MAX_RETRIES: 20,
    INITIAL_RETRY_DELAY_MS: 2000,
    MAX_RETRY_DELAY_MS: 120000,
    EXPONENTIAL_BACKOFF: true,
    KEEP_ALIVE_INTERVAL_MS: 20000,
    AUTO_RECONNECT: true,
    CONNECTION_TIMEOUT_MS: 120000,
    HEARTBEAT_INTERVAL_MS: 25000,
    NOTIFY_ADMIN_ON_DISCONNECT: true,
    NOTIFY_ADMIN_ON_RECONNECT: true,
    STABLE_CONNECTION_THRESHOLD: 120000,
    MAINTAIN_SESSION_PERSISTENCE: true,
    USE_STORE_FOR_MESSAGES: true
  },

  // 📲 REMOTE PAIRING (5 minutes validity)
  REMOTE_PAIRING: {
    ENABLED: true,
    ADMIN_CAN_PAIR: true,
    PAIRING_CODE_FORWARD: true,
    PAIRING_CODE_EXPIRY_MINUTES: 5, // Extended to 5 minutes
    SESSION_NAME_PROMPT: true,
    PHONE_NUMBER_PROMPT: true,
    PAIRING_SUCCESS_NOTIFY: true,
    PAIRING_FAILURE_NOTIFY: true,
    PAIRING_COMMAND: 'pair'
  },

  // 📊 ORDER FORWARDING
  ORDER_FORWARDING: {
    FORWARD_TO_MAIN_ADMIN: true,
    FORWARD_TO_SESSION_ADMIN: true,
    FORWARD_TO_GROUP: true,
    INCLUDE_SESSION_INFO: true,
    INCLUDE_ORDER_COUNT: true,
    SESSION_ADMIN_PRIORITY: 'BOTH' // Both main + session admin
  },

  // 🛡️ BULK SENDING
  BULK: {
    EXCEL_FOLDER_PATH: process.env.EXCEL_FOLDER_PATH || '/storage/emulated/0/Order_seva_system_contact_excel/',
    MOVE_COMPLETED_TO: '/storage/emulated/0/Order_seva_system_contact_excel/completed/',
    COLUMN_NUMBER: 1,
    COLUMN_NAME: 2,
    SKIP_HEADER_ROW: true,
    ADMIN_NUMBER: '919174406375',
    BUSINESS_HOURS: {
      ENABLED: true,
      START_HOUR: 9,
      END_HOUR: 20
    },
    DAY_1_LIMIT: 10,
    DAILY_INCREMENT_PERCENT: 10,
    MAX_DAILY_LIMIT: 400,
    MIN_DELAY_SECONDS: 60,
    MAX_DELAY_SECONDS: 420,
    TYPING_DURATION_MIN_MS: 2000,
    TYPING_DURATION_MAX_MS: 5000,
    ROTATION_STRATEGY: 'intelligent',
    SESSION_COOLDOWN_MINUTES: 20,
    MAX_MESSAGES_PER_SESSION_HOUR: 25,
    RUN_24_7: true,
    AUTO_RESUME: true
  },

  // 🔔 NOTIFICATIONS
  NOTIFICATIONS: {
    SESSION_CONNECTED: true,
    SESSION_DISCONNECTED: true,
    NEW_ORDER_RECEIVED: true,
    DAILY_REPORT_ENABLED: true,
    PAIRING_CODE_NOTIFICATION: true,
    SESSION_ADMIN_ADDED: true,
    SESSION_ADMIN_REMOVED: true
  },

  // 🗂️ DATA PATHS
  DATA_PATHS: {
    ORDERS_DB: './data/orders.json',
    SESSION_ADMINS_DB: './data/session_admins.json',
    BULK_STATE_DB: './data/bulk_state.json',
    TEMPLATES_DB: './data/templates.json',
    LOGS_DIR: './logs',
    SESSIONS_DIR: './sessions'
  },

  // 🔒 SECURITY
  SECURITY: {
    ADMIN_ONLY_COMMANDS: true,
    SESSION_ADMIN_COMMANDS: true,
    ENABLE_COMMAND_LOGGING: true,
    RESTRICT_PAIRING_TO_ADMIN: true
  }
};
