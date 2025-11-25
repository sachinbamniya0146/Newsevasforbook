// ═══════════════════════════════════════════════════════════════════════════
// 🔧 ENHANCED CONFIG v3.0 - Multi-Admin + Cloud Features
// ═══════════════════════════════════════════════════════════════════════════

export default {

  // 👑 MAIN ADMIN (Receives ALL orders from ALL sessions)
  MAIN_ADMIN: {
    JID: '919174406375@s.whatsapp.net',
    PHONE: '919174406375',
    NAME: 'Main Admin',
    PRIVILEGES: 'FULL'
  },

  // 📱 PER-SESSION ADMIN MAPPING
  // Each WhatsApp session can have its own 2nd admin
  // Orders forward to: Main Admin + Session Admin + Group
  SESSION_ADMINS: {
    // Add dynamically from web UI or admin commands
    // Example: 'session1': { JID: '919876543210@s.whatsapp.net', PHONE: '919876543210', NAME: 'Session1 Admin' }
  },

  // 🏢 ORDER GROUP & LINKS
  ORDER_GROUP: {
    JID: 'ORDER_GROUP_JID@g.us', // Update with your group JID
    NAME: 'Order_received_on_WhatsApp',
    LINK: 'https://chat.whatsapp.com/LcTW8DuZzV23uhVc7BBcAu'
  },

  USER_GROUP_LINK: 'https://chat.whatsapp.com/LcTW8DuZzV23uhVc7BBcAu',

  // ⏰ DAILY REPORTS
  DAILY_REPORT: {
    ENABLED: true,
    TIME: '18:30', // 6:30 PM
    TIMEZONE: 'Asia/Kolkata',
    INCLUDE_STATS: true,
    SEND_TO_MAIN_ADMIN: true,
    SEND_TO_SESSION_ADMINS: true,
    SEND_TO_GROUP: false
  },

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
      'Français': 'https://www.jagatgururampalji.org/way-of-living.pdf'
    }
  },

  // 🛡️ BULK SENDING SYSTEM (Cloud-Level)
  BULK: {
    ENABLED: true,
    EXCEL_FOLDER: '/storage/emulated/0/Order_seva_system_contact_excel/',
    COMPLETED_FOLDER: '/storage/emulated/0/Order_seva_system_contact_excel/completed/',
    COLUMN_NUMBER: 1, // Phone number column
    COLUMN_NAME: 2, // Name column
    SKIP_HEADER_ROW: true,
    
    // Rate Limiting (WhatsApp ban protection)
    RATE_LIMIT: {
      MESSAGES_PER_HOUR: 50,
      MESSAGES_PER_DAY: 400,
      MIN_DELAY_SECONDS: 60,
      MAX_DELAY_SECONDS: 420,
      RANDOMIZATION_FACTOR: 0.45
    },
    
    // Session Management
    SESSION: {
      AUTO_ROTATE: true,
      COOLDOWN_MINUTES: 20,
      MAX_MESSAGES_PER_SESSION: 100,
      ENABLE_LOAD_BALANCING: true
    },
    
    // Notifications
    NOTIFICATIONS: {
      ON_START: true,
      ON_COMPLETE: true,
      ON_ERROR: true,
      PROGRESS_UPDATES: true,
      UPDATE_INTERVAL: 10 // Every 10 messages
    },
    
    // Business Hours
    BUSINESS_HOURS: {
      ENABLED: true,
      START_HOUR: 9,
      END_HOUR: 20,
      TIMEZONE: 'Asia/Kolkata'
    }
  },

  // 🌐 WEB DASHBOARD
  WEB: {
    ENABLED: true,
    PORT: 3000,
    HOST: '0.0.0.0',
    
    // Authentication
    AUTH: {
      ENABLED: true,
      USERNAME: 'admin',
      PASSWORD: 'seva@2025', // CHANGE THIS!
      SESSION_TIMEOUT: 24 * 60 * 60 * 1000 // 24 hours
    },
    
    // Public Access (for sharing)
    PUBLIC_ACCESS: {
      ENABLED: false, // Set true to allow public viewing
      ALLOWED_IPS: [], // Empty = all IPs allowed
      RATE_LIMIT: 100 // requests per minute
    }
  },

  // 📊 REAL-TIME LOGS
  LOGS: {
    ENABLED: true,
    CONSOLE: true,
    FILE: true,
    WEBSOCKET: true,
    
    FILE_PATH: './logs/system.log',
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    MAX_FILES: 5,
    
    LEVELS: {
      ERROR: true,
      WARNING: true,
      INFO: true,
      DEBUG: false,
      SUCCESS: true,
      PROGRESS: true
    }
  },

  // 📁 DATA PATHS
  PATHS: {
    ORDERS: './data/orders.json',
    SESSIONS: './data/sessions.json',
    TEMPLATES: './data/templates.json',
    CAMPAIGNS: './data/campaigns.json',
    SESSION_ADMINS: './data/session_admins.json',
    ANALYTICS: './data/analytics.json',
    LOGS_DIR: './logs',
    SESSIONS_DIR: './sessions',
    BACKUP_DIR: './backups'
  },

  // 🔐 SECURITY
  SECURITY: {
    ADMIN_ONLY_COMMANDS: true,
    RATE_LIMIT_ENABLED: true,
    MAX_ORDERS_PER_USER_PER_DAY: 1,
    DUPLICATE_COOLDOWN_HOURS: 6,
    BLOCK_SPAM_USERS: true,
    LOG_ALL_ACTIONS: true
  },

  // 📈 ANALYTICS
  ANALYTICS: {
    ENABLED: true,
    TRACK_ORDERS: true,
    TRACK_BULK_CAMPAIGNS: true,
    TRACK_SESSION_HEALTH: true,
    EXPORT_ENABLED: true
  },

  // 💬 MESSAGES
  MESSAGES: {
    DELIVERY_MSG: '📦 *डिलीवरी:* 20 दिन (निःशुल्क)\n_20 days (Free Delivery)_',
    
    SUPPORT_CONTACT: '📞 *सहायता / Support:*\n+91 8586003472\n+91 9555000808',
    
    ORDER_SUCCESS: '🎉 *ऑर्डर सफलतापूर्वक दर्ज!*\n\n_Your order is placed successfully!_\n\n📦 आपकी पुस्तक *20 दिनों में* आपके घर पहुंच जाएगी।\nYour book will reach your home in *20 days*.\n\n🆓 *बिल्कुल निःशुल्क! कोई चार्ज नहीं!*\n*Completely free! No charges!*',
    
    GROUP_JOIN: '📢 *हमारे WhatsApp ग्रुप से जुड़ें:*\n\n_Join our WhatsApp group:_\n\nयहाँ रोज़ आध्यात्मिक ज्ञान मिलता है।\nDaily spiritual knowledge shared here.'
  },

  // 🔄 CONNECTION SETTINGS
  CONNECTION: {
    MAX_RETRIES: 25,
    RETRY_DELAY_MS: 2000,
    KEEP_ALIVE_INTERVAL_MS: 30000,
    AUTO_RECONNECT: true,
    TIMEOUT_MS: 90000
  },

  // 🎯 PERFORMANCE
  PERFORMANCE: {
    CACHE_ENABLED: true,
    CACHE_TTL_SECONDS: 3600,
    DATABASE_CLEANUP_DAYS: 90,
    LOG_RETENTION_DAYS: 30,
    MEMORY_LIMIT_MB: 512,
    AUTO_CLEANUP: true
  },

  // 🌐 LOCALIZATION
  LOCALIZATION: {
    DEFAULT_LANGUAGE: 'हिन्दी',
    BILINGUAL_MESSAGES: true,
    SUPPORTED_LANGUAGES: [
      'हिन्दी', 'English', 'ਪੰਜਾਬੀ', 'ગુજરાતી', 'मराठी',
      'தமிழ்', 'తెలుగు', 'ಕನ್ನಡ', 'ଓଡ଼ିଆ', 'മലയാളം',
      'অসমীয়া', 'नेपाली', 'বাংলা', 'اردو', 'Français'
    ]
  },

  // 🔧 DEVELOPER OPTIONS
  DEV: {
    DEBUG_MODE: false,
    VERBOSE_LOGGING: false,
    TEST_MODE: false,
    MOCK_DATA: false
  },

  // 📱 BOT INFO
  BOT: {
    NAME: 'Gyan Ganga Seva Bot',
    VERSION: '3.0.0',
    DESCRIPTION: 'Sant Rampal Ji Maharaj - Free Book Service'
  }

};
