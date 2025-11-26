export default {
  // 👑 MAIN ADMIN (Default - Sabhi orders yaha jayenge)
  ADMIN: {
    JID: '919174406375@s.whatsapp.net',
    PHONE: '919174406375',
    NAME: 'Main Admin',
    PRIVILEGES: 'FULL'
  },
  
  // 📱 PER-SESSION ADMIN MAPPING
  // Har WhatsApp session ke liye alag admin set kar sakte ho
  // Admin menu se dynamically add/remove hoga
  // Format: { 'session_name': '919876543210@s.whatsapp.net' }
  SESSION_ADMINS: {
    // Runtime me admin commands se fill hoga
    // Example: 'satish1': '919876543210@s.whatsapp.net'
  },
  
  // 🏢 ORDER GROUP
  ORDER_GROUP_NAME: 'Order_received_on_WhatsApp',
  USER_GROUP_LINK: 'https://chat.whatsapp.com/LcTW8DuZzV23uhVc7BBcAu',
  
  // 📚 BOOK PDFS (Complete - Preserved from existing system)
  BOOK_PDFS: {
    'ज्ञान गंगा': {
      'हिन्दी': 'https://www.jagatgururampalji.org/gyan_ganga_hindi.pdf',
      'English': 'https://www.jagatgururampalji.org/gyan_ganga_english.pdf',
      'ਪੰਜਾਬੀ': 'https://www.jagatgururampalji.org/jeene-ki-rah-punjabi.pdf',
      'ગુજરાતી': 'https://www.jagatgururampalji.org/jeene-ki-rah-gujarati.pdf',
      'मराठी': 'https://www.jagatgururampalji.org/jeene-ki-rah-marathi.pdf',
      'தமிழ்': 'https://www.jagatgururampalji.org/gyan_ganga_hindi.pdf',
      'తెలుగు': 'https://www.jagatgururampalji.org/jeene-ki-rah-telugu.pdf',
      'ಕನ್ನಡ': 'https://www.jagatgururampalji.org/jkr-kannad.pdf',
      'ଓଡ଼ିଆ': 'https://www.jagatgururampalji.org/jkr-odia.pdf',
      'മലയാളം': 'https://www.jagatgururampalji.org/gyan-ganga-malayalam.pdf',
      'অসমীয়া': 'https://www.jagatgururampalji.org/jeene-ki-rah-bengali.pdf',
      'नेपाली': 'https://www.jagatgururampalji.org/jeene-ki-rah-nepali.pdf',
      'বাংলা': 'https://www.jagatgururampalji.org/jeene-ki-rah-bengali.pdf',
      'اردو': 'https://www.jagatgururampalji.org/gyan_ganga_urdu.pdf',
      'سنڌي': 'https://www.jagatgururampalji.org/gyan_ganga_sindhi.pdf',
      'Español': 'https://www.jagatgururampalji.org/gyan_ganga_hindi.pdf',
      'Français': 'https://www.jagatgururampalji.org/gyan_ganga_french.pdf'
    },
    'जीने की राह': {
      'हिन्दी': 'https://www.jagatgururampalji.org/jeene-ki-rah.pdf',
      'English': 'https://www.jagatgururampalji.org/way-of-living.pdf',
      'ਪੰਜਾਬੀ': 'https://www.jagatgururampalji.org/jeene-ki-rah-punjabi.pdf',
      'ગુજરાતી': 'https://www.jagatgururampalji.org/jeene-ki-rah-gujarati.pdf',
      'मराठी': 'https://www.jagatgururampalji.org/jeene-ki-rah-marathi.pdf',
      'தமிழ்': 'https://www.jagatgururampalji.org/jeene-ki-rah.pdf',
      'తెలుగు': 'https://www.jagatgururampalji.org/jeene-ki-rah-telugu.pdf',
      'ಕನ್ನಡ': 'https://www.jagatgururampalji.org/jkr-kannad.pdf',
      'ଓଡ଼ିଆ': 'https://www.jagatgururampalji.org/jkr-odia.pdf',
      'മലയാളം': 'https://www.jagatgururampalji.org/jkr_malayalam.pdf',
      'অসমীয়া': 'https://www.jagatgururampalji.org/jeene-ki-rah-bengali.pdf',
      'नेपाली': 'https://www.jagatgururampalji.org/jeene-ki-rah-nepali.pdf',
      'বাংলা': 'https://www.jagatgururampalji.org/jeene-ki-rah-bengali.pdf',
      'اردو': 'https://www.jagatgururampalji.org/jeene-ki-rah-urdu-india.pdf',
      'سنڌي': 'https://www.jagatgururampalji.org/gyan_ganga_sindhi.pdf',
      'Español': 'https://www.jagatgururampalji.org/jeene-ki-rah.pdf',
      'Français': 'https://www.jagatgururampalji.org/way-of-living.pdf'
    }
  },

  // 💬 MESSAGES (Preserved)
  DELIVERY_MSG: `📦 *डिलीवरी:* 7-21 दिन (निःशुल्क)\n_7-21 days (Free)_`,
  SUPPORT_CONTACT: `📞 *सहायता / Support:*\n+91 8586003472\n+91 9555000808`,
  BOT_NAME: 'Waseva Satguru Bot',
  BOT_VERSION: '4.0.0',
  WELCOME_MSG: `🙏 *नमस्ते! Namaste!*\n🌳 वेद-गीता प्रमाणित मोक्षज्ञान\n_Vedic Knowledge for Salvation_`,
  ORDER_SUCCESS_MSG: `🎉 *ऑर्डर सफलतापूर्वक दर्ज!*\n_Order Successfully Placed!_`,
  GROUP_JOIN_MSG: `📢 *हमारे WhatsApp ग्रुप से जुड़ें:*\n_Join our WhatsApp Group:_`,

  // 🔌 CONNECTION STABILITY (FIX 440 ERROR - PERMANENT LINK)
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
    DISCONNECT_NOTIFICATION_COOLDOWN: 600000,
    STABLE_CONNECTION_THRESHOLD: 120000,
    ENABLE_PRESENCE_UPDATES: true,
    DISABLE_OFFLINE_MODE: true,
    PREVENT_LOGOUT_ON_440: true,
    MAINTAIN_SESSION_PERSISTENCE: true,
    USE_STORE_FOR_MESSAGES: true
  },

  // 📲 REMOTE PAIRING (Admin 919174406375 se remotely pair karo)
  REMOTE_PAIRING: {
    ENABLED: true,
    ADMIN_CAN_PAIR: true,
    PAIRING_CODE_FORWARD: true,
    PAIRING_CODE_EXPIRY_MINUTES: 5,
    SESSION_NAME_PROMPT: true,
    PHONE_NUMBER_PROMPT: true,
    PAIRING_SUCCESS_NOTIFY: true,
    PAIRING_FAILURE_NOTIFY: true,
    PAIRING_COMMAND: 'pair'
  },

  // 📊 ORDER FORWARDING (Multi-Admin System)
  ORDER_FORWARDING: {
    FORWARD_TO_MAIN_ADMIN: true,
    FORWARD_TO_SESSION_ADMIN: true,
    FORWARD_TO_GROUP: true,
    INCLUDE_SESSION_INFO: true,
    INCLUDE_ORDER_COUNT: true,
    SESSION_ADMIN_PRIORITY: 'BOTH'
  },

  // 🛡️ BULK SENDING (24/7 with Rotation + Anti-Ban)
  BULK: {
    // Excel Settings
    EXCEL_FOLDER_PATH: process.env.EXCEL_FOLDER_PATH || '/storage/emulated/0/Order_seva_system_contact_excel/',
    MOVE_COMPLETED_TO: '/storage/emulated/0/Order_seva_system_contact_excel/completed/',
    COLUMN_NUMBER: 1,
    COLUMN_NAME: 2,
    SKIP_HEADER_ROW: true,
    
    // Admin Number
    ADMIN_NUMBER: '919174406375',
    
    // Business Hours (9 AM - 8 PM IST)
    BUSINESS_HOURS: {
      ENABLED: true,
      START_HOUR: 9,
      END_HOUR: 20,
      LUNCH_BREAK: false,
      LUNCH_START: 13,
      LUNCH_END: 14
    },
    BUSINESS_HOURS_ONLY: true,
    START_HOUR_IST: 9,
    END_HOUR_IST: 20,
    EXCLUDE_LUNCH_HOURS: false,
    LUNCH_START_HOUR: 13,
    LUNCH_END_HOUR: 14,
    
    // Progressive Scaling (Day 1: 8-10, then +10% daily, max 400)
    DAY_1_LIMIT: 10,
    START_MESSAGES: 10,
    DAILY_INCREMENT_PERCENT: 10,
    INCREMENT_PERCENT: 10,
    MAX_DAILY_LIMIT: 400,
    MAX_PER_DAY: 400,
    
    // Human-like Delays (1-7 min random)
    MIN_DELAY_SECONDS: 60,
    MAX_DELAY_SECONDS: 420,
    MIN_SECONDS: 60,
    MAX_SECONDS: 420,
    RANDOMIZATION_FACTOR: 0.45,
    
    // Typing Simulation
    TYPING_DURATION_MIN_MS: 2000,
    TYPING_DURATION_MAX_MS: 5000,
    PRESENCE_ENABLED: true,
    TYPING_INDICATOR: true,
    TYPING_SIMULATION: true,
    DELAYS: {
      MIN_SECONDS: 60,
      MAX_SECONDS: 420,
      TYPING_SIMULATION: true
    },
    
    // Multi-Session Rotation (Intelligent Load Balancing)
    ROTATION_STRATEGY: 'intelligent',
    SESSION_COOLDOWN_MINUTES: 20,
    MAX_MESSAGES_PER_SESSION_HOUR: 25,
    AUTO_DISTRIBUTE_LOAD: true,
    
    // Scaling Configuration
    SCALING: {
      START_MESSAGES: 10,
      INCREMENT_PERCENT: 10,
      MAX_PER_DAY: 400
    },
    
    // Content Quality
    MIN_MESSAGE_LENGTH: 20,
    MAX_MESSAGE_LENGTH: 350,
    PERSONALIZATION_REQUIRED: true,
    
    // Template System (100 Templates)
    USE_TEMPLATE_ROTATION: true,
    TEMPLATES_COUNT: 100,
    TEMPLATE_PERSONALIZATION: true,
    
    // Anti-Ban Features
    ENABLE_MESSAGE_SPACING: true,
    ENABLE_SESSION_WARMUP: true,
    ENABLE_CONTENT_VARIATION: true,
    VERIFY_NUMBER_BEFORE_SEND: true,
    
    // 24/7 Operation
    RUN_24_7: true,
    AUTO_RESUME: true,
    RETRY_FAILED: true,
    
    // Reporting
    DAILY_REPORT_TIME: '18:30',
    SEND_ADMIN_NOTIFICATIONS: true,
    LOG_EVERY_N_MESSAGES: 5
  },

  // 🔔 NOTIFICATIONS
  NOTIFICATIONS: {
    SESSION_CONNECTED: true,
    SESSION_DISCONNECTED: true,
    SESSION_RECONNECTED: true,
    NEW_ORDER_RECEIVED: true,
    DAILY_REPORT_ENABLED: true,
    BULK_CAMPAIGN_COMPLETE: true,
    ERROR_ALERTS: true,
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

  // 🔐 SECURITY
  SECURITY: {
    ADMIN_ONLY_COMMANDS: true,
    SESSION_ADMIN_COMMANDS: true,
    ENABLE_COMMAND_LOGGING: true,
    RESTRICT_PAIRING_TO_ADMIN: true
  }
};
