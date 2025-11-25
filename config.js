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

  // 🏢 ORDER GROUP & LINKS
  ORDER_GROUP_NAME: 'Order_received_on_WhatsApp',
  USER_GROUP_LINK: 'https://chat.whatsapp.com/LcTW8DuZzV23uhVc7BBcAu',
  
  // 📚 BOOK PDFS (Complete - All Languages)
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

  // 💬 BOT MESSAGES
  BOT: {
    NAME: 'Gyan Ganga Seva Bot',
    VERSION: '5.0.0',
    TIMEZONE: 'Asia/Kolkata'
  },

  DELIVERY_MSG: `📦 *डिलीवरी:* 20 दिन (निःशुल्क)
_20 days (Free Delivery)_`,

  SUPPORT_CONTACT: `📞 *सहायता / Support:*
+91 8586003472
+91 9555000808`,

  WELCOME_MSG: `🙏 *नमस्ते! Namaste!*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📚 *संत रामपाल जी महाराज* की निःशुल्क पुस्तक सेवा

_Free Book Service by Sant Rampal Ji Maharaj_

हम आपको *बिल्कुल निःशुल्क पुस्तक* भेजना चाहते हैं। पुस्तक *20 दिनों में* आपके घर पहुंच जाएगी। *कोई चार्ज नहीं*, *डिलीवरी फ्री!*

_We want to send you a completely free book. Book will reach your home in 20 days. No charges, free delivery!_`,

  ORDER_SUCCESS_MSG: `🎉 *ऑर्डर सफलतापूर्वक दर्ज!*

_Your order is placed successfully!_

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 आपकी पुस्तक *20 दिनों में* आपके घर पहुंच जाएगी।

Your book will reach your home in *20 days*.

🆓 *बिल्कुल निःशुल्क! कोई चार्ज नहीं!*

*Completely free! No charges!*`,

  GROUP_JOIN_MSG: `📢 *हमारे WhatsApp ग्रुप से जुड़ें:*

_Join our WhatsApp group:_

यहाँ रोज़ आध्यात्मिक ज्ञान मिलता है।

Daily spiritual knowledge shared here.`,

  // 🔌 CONNECTION STABILITY (Enhanced)
  CONNECTION: {
    MAX_RETRIES: 25,
    INITIAL_RETRY_DELAY_MS: 2000,
    MAX_RETRY_DELAY_MS: 120000,
    EXPONENTIAL_BACKOFF: true,
    KEEP_ALIVE_INTERVAL_MS: 30000,
    AUTO_RECONNECT: true,
    CONNECTION_TIMEOUT_MS: 90000,
    HEARTBEAT_INTERVAL_MS: 25000,
    NOTIFY_ADMIN_ON_DISCONNECT: true,
    NOTIFY_ADMIN_ON_RECONNECT: true,
    DISCONNECT_NOTIFICATION_COOLDOWN: 600000,
    STABLE_CONNECTION_THRESHOLD: 120000,
    ENABLE_PRESENCE_UPDATES: true,
    DISABLE_OFFLINE_MODE: true,
    PREVENT_LOGOUT_ON_440: true,
    MAINTAIN_SESSION_PERSISTENCE: true,
    USE_STORE_FOR_MESSAGES: true,
    WEBSOCKET_RECONNECT: true,
    HANDLE_BAD_MAC: true,
    IGNORE_DECRYPTION_ERRORS: true,
    SESSION_BACKUP_ENABLED: true,
    AUTO_RESTORE_SESSION: true
  },

  // 📲 REMOTE PAIRING (Enhanced)
  REMOTE_PAIRING: {
    ENABLED: true,
    ADMIN_CAN_PAIR: true,
    PAIRING_CODE_FORWARD: true,
    PAIRING_CODE_EXPIRY_MINUTES: 5,
    SESSION_NAME_PROMPT: true,
    PHONE_NUMBER_PROMPT: true,
    PAIRING_SUCCESS_NOTIFY: true,
    PAIRING_FAILURE_NOTIFY: true,
    PAIRING_COMMAND: '/pair',
    AUTO_RETRY_ON_FAILURE: true,
    MAX_PAIRING_ATTEMPTS: 3,
    PAIRING_DELAY_MS: 2500
  },

  // 📊 ORDER FORWARDING (Enhanced)
  ORDER_FORWARDING: {
    FORWARD_TO_MAIN_ADMIN: true,
    FORWARD_TO_SESSION_ADMIN: true,
    FORWARD_TO_GROUP: true,
    INCLUDE_SESSION_INFO: true,
    INCLUDE_ORDER_COUNT: true,
    INCLUDE_TIMESTAMP: true,
    SESSION_ADMIN_PRIORITY: 'BOTH',
    FORMAT_ORDER_MESSAGE: true,
    ADD_ORDER_NUMBER: true,
    INCLUDE_CUSTOMER_DETAILS: true,
    INCLUDE_DELIVERY_INFO: true
  },

  // 🛡️ BULK SENDING (Production Ready)
  BULK: {
    ENABLED: true,
    EXCEL_FOLDER_PATH: '/storage/emulated/0/Order_seva_system_contact_excel/',
    MOVE_COMPLETED_TO: '/storage/emulated/0/Order_seva_system_contact_excel/completed/',
    COLUMN_NUMBER: 1,
    COLUMN_NAME: 2,
    SKIP_HEADER_ROW: true,
    
    // Business Hours
    BUSINESS_HOURS: {
      ENABLED: true,
      START_HOUR: 9,
      END_HOUR: 20,
      LUNCH_BREAK: false,
      LUNCH_START: 13,
      LUNCH_END: 14,
      TIMEZONE: 'Asia/Kolkata'
    },
    
    // Daily Limits with Smart Scaling
    SCALING: {
      DAY_1_LIMIT: 10,
      START_MESSAGES: 10,
      DAILY_INCREMENT_PERCENT: 10,
      MAX_DAILY_LIMIT: 400,
      MAX_PER_DAY: 400,
      AUTO_SCALE: true,
      SMART_SCALING: true
    },
    
    // Delays & Randomization
    DELAYS: {
      MIN_DELAY_SECONDS: 60,
      MAX_DELAY_SECONDS: 420,
      RANDOMIZATION_FACTOR: 0.45,
      TYPING_DURATION_MIN_MS: 2000,
      TYPING_DURATION_MAX_MS: 5000
    },
    
    // Message Quality
    MESSAGE: {
      MIN_LENGTH: 20,
      MAX_LENGTH: 350,
      PERSONALIZATION_REQUIRED: true,
      USE_TEMPLATE_ROTATION: true,
      TEMPLATES_COUNT: 100,
      TEMPLATE_PERSONALIZATION: true
    },
    
    // Session Management
    SESSION: {
      ROTATION_STRATEGY: 'intelligent',
      SESSION_COOLDOWN_MINUTES: 20,
      MAX_MESSAGES_PER_SESSION_HOUR: 25,
      AUTO_DISTRIBUTE_LOAD: true,
      ENABLE_SESSION_WARMUP: true
    },
    
    // Safety Features
    SAFETY: {
      TYPING_INDICATOR: true,
      TYPING_SIMULATION: true,
      PRESENCE_ENABLED: true,
      VERIFY_NUMBER_BEFORE_SEND: true,
      ENABLE_MESSAGE_SPACING: true,
      ENABLE_CONTENT_VARIATION: true
    },
    
    // Automation
    AUTOMATION: {
      RUN_24_7: true,
      AUTO_RESUME: true,
      RETRY_FAILED: true,
      DAILY_REPORT_TIME: '18:30',
      SEND_ADMIN_NOTIFICATIONS: true,
      LOG_EVERY_N_MESSAGES: 5
    }
  },

  // 🔔 NOTIFICATIONS (Enhanced)
  NOTIFICATIONS: {
    SESSION_CONNECTED: true,
    SESSION_DISCONNECTED: true,
    SESSION_RECONNECTED: true,
    NEW_ORDER_RECEIVED: true,
    DAILY_REPORT_ENABLED: true,
    DAILY_REPORT_TIME: '18:30',
    BULK_CAMPAIGN_COMPLETE: true,
    BULK_CAMPAIGN_START: true,
    ERROR_ALERTS: true,
    PAIRING_CODE_NOTIFICATION: true,
    SESSION_ADMIN_ADDED: true,
    SESSION_ADMIN_REMOVED: true,
    LOW_BALANCE_ALERT: false,
    HIGH_FAILURE_RATE_ALERT: true,
    SYSTEM_HEALTH_CHECK: true
  },

  // 🗂️ DATA PATHS (Organized)
  DATA_PATHS: {
    ORDERS_DB: './data/orders.json',
    SESSION_ADMINS_DB: './data/session_admins.json',
    BULK_STATE_DB: './data/bulk_state.json',
    TEMPLATES_DB: './data/templates.json',
    STATS_DB: './data/stats.json',
    LOGS_DIR: './logs',
    SESSIONS_DIR: './sessions',
    BACKUP_DIR: './backups',
    EXCEL_ARCHIVE: './excel_archive'
  },

  // 🔐 SECURITY (Enhanced)
  SECURITY: {
    ADMIN_ONLY_COMMANDS: true,
    SESSION_ADMIN_COMMANDS: true,
    ENABLE_COMMAND_LOGGING: true,
    RESTRICT_PAIRING_TO_ADMIN: true,
    RATE_LIMIT_ENABLED: true,
    MAX_ORDERS_PER_USER_PER_DAY: 1,
    DUPLICATE_ORDER_DETECTION: true,
    DUPLICATE_COOLDOWN_HOURS: 6,
    BLOCK_SPAM_USERS: true,
    SECURITY_LOGS: true
  },

  // 📈 ANALYTICS & REPORTING
  ANALYTICS: {
    ENABLED: true,
    TRACK_ORDER_COUNT: true,
    TRACK_SESSION_COUNT: true,
    TRACK_BULK_STATS: true,
    DAILY_SUMMARY: true,
    WEEKLY_SUMMARY: false,
    MONTHLY_SUMMARY: true,
    EXPORT_TO_CSV: true,
    REALTIME_DASHBOARD: false
  },

  // 🎯 PERFORMANCE OPTIMIZATION
  PERFORMANCE: {
    CACHE_ENABLED: true,
    CACHE_TTL_SECONDS: 3600,
    DATABASE_CLEANUP_DAYS: 90,
    LOG_RETENTION_DAYS: 30,
    MEMORY_LIMIT_MB: 512,
    AUTO_CLEANUP: true,
    COMPRESSION_ENABLED: true
  },

  // 🌐 LOCALIZATION
  LOCALIZATION: {
    DEFAULT_LANGUAGE: 'हिन्दी',
    SUPPORTED_LANGUAGES: [
      'हिन्दी', 'English', 'ਪੰਜਾਬੀ', 'ગુજરાતી', 'मराठी',
      'தமிழ்', 'తెలుగు', 'ಕನ್ನಡ', 'ଓଡ଼ିଆ', 'മലയാളം',
      'অসমীয়া', 'नेपाली', 'বাংলা', 'اردو', 'سنڌي',
      'Español', 'Français'
    ],
    AUTO_DETECT_LANGUAGE: false,
    BILINGUAL_MESSAGES: true
  },

  // ⚙️ ADVANCED FEATURES
  ADVANCED: {
    MULTI_SESSION_SUPPORT: true,
    SESSION_POOLING: true,
    LOAD_BALANCING: true,
    FAILOVER_ENABLED: true,
    BACKUP_SESSION_COUNT: 0,
    HEALTH_CHECK_INTERVAL_MS: 300000,
    AUTO_RESTART_ON_CRASH: true,
    GRACEFUL_SHUTDOWN: true,
    STATE_PERSISTENCE: true
  },

  // 🔧 DEVELOPER OPTIONS
  DEV: {
    DEBUG_MODE: false,
    VERBOSE_LOGGING: false,
    CONSOLE_LOGGING: true,
    FILE_LOGGING: true,
    TEST_MODE: false,
    DRY_RUN: false,
    MOCK_ORDERS: false,
    SKIP_VALIDATIONS: false
  }

};
