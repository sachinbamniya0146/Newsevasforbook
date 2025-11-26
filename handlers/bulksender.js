import fs from 'fs-extra';
import path from 'path';
import XLSX from 'xlsx';
import { fileURLToPath } from 'url';
import CONFIG from '../config.js';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 🌟 WORLD-CLASS ADVANCED BULK SENDER
 * 
 * ✅ AUTO-START: Automatically starts at 6 AM, stops at 11 PM
 * ✅ SMART EXCEL: Auto-detects phone & name from ANY column/row
 * ✅ PROGRESSIVE SCALING: Day 1: 10 → +15-20% daily → Max 400/session
 * ✅ 100 PREMIUM TEMPLATES: Hindi+English with rotation
 * ✅ ANTI-BAN AI: Typing simulation, human delays, smart patterns
 * ✅ INDIAN NUMBERS: Auto-adds +91 to 10-digit numbers
 * ✅ MULTI-SESSION: All active WhatsApp sessions used
 * ✅ NO REPEATS: Advanced duplicate prevention
 * ✅ ONE-TIME NOTIFICATIONS: Admin notified only once per event
 * ✅ SMART DELAYS: Based on message volume
 * ✅ AUTO-RECOVERY: Continues after restart
 */

class AdvancedBulkSender {
  constructor() {
    this.isRunning = false;
    this.isPaused = false;
    this.autoStartEnabled = true; // Auto-start feature
    this.sessions = new Map();
    
    // Campaign management
    this.activeCampaigns = new Map();
    this.campaignQueue = [];
    this.fileInProgress = new Set();
    this.completedFiles = new Set();
    this.processedNumbers = new Set(); // NO REPEATS
    
    // Session tracking
    this.sessionStats = new Map();
    this.sessionLastUsed = new Map();
    this.sessionDailyCount = new Map();
    this.sessionStartDate = new Map();
    
    // Templates (100 premium templates)
    this.templates = this.generate100PremiumTemplates();
    this.templateRotation = new Map();
    
    // Progressive scaling (15-20% daily increase)
    this.scalingTracker = new Map();
    this.dailyIncreasePercent = 17.5; // Average of 15-20%
    
    // Paths
    this.excelWatchPath = '/storage/emulated/0/Order_seva_system_contact_excel/';
    this.completedPath = path.join(this.excelWatchPath, '../completed/');
    this.backupPath = path.join(this.excelWatchPath, '../backup/');
    this.logsPath = path.join(this.excelWatchPath, '../logs/');
    
    // Timing configuration (6 AM - 11 PM IST)
    this.workingHours = { start: 6, end: 23 }; // 6 AM - 11 PM
    this.watchIntervalMs = 30000; // 30 seconds
    this.reportTime = 9; // 9 AM daily report
    this.lastReportDate = null;
    
    // Smart delays (based on volume)
    this.minDelay = 45000;  // 45 seconds
    this.maxDelay = 300000; // 5 minutes
    this.typingDuration = { min: 3000, max: 9000 }; // 3-9 seconds
    
    // Admin notification tracking (ONE TIME ONLY)
    this.adminNotified = {
      botStarted: false,
      bulkStarted: false,
      lastFileDetected: null
    };
    
    // Global statistics
    this.globalStats = {
      totalSent: 0,
      totalFailed: 0,
      totalRetries: 0,
      campaignsCompleted: 0,
      filesProcessed: 0,
      startTime: new Date().toISOString(),
      lastRestart: new Date().toISOString()
    };
    
    // Main loop control
    this.mainLoopRunning = false;
    this.autoStartCheckInterval = null;
    
    this.initDirectories();
    this.loadState();
    this.startAutoScheduler(); // Auto-start scheduler
    logger.success('🌟 Advanced Bulk Sender initialized');
  }

  // ==================== AUTO-START SCHEDULER ====================

  startAutoScheduler() {
    // Check every minute for auto-start/stop
    this.autoStartCheckInterval = setInterval(() => {
      this.checkAutoStartStop();
    }, 60000); // Every 1 minute
    
    logger.info('⏰ Auto-scheduler enabled (6 AM - 11 PM IST)');
  }

  async checkAutoStartStop() {
    if (!this.autoStartEnabled) return;
    
    const now = new Date();
    const istHour = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })).getHours();
    
    // Auto-start at 6 AM
    if (istHour === this.workingHours.start && !this.isRunning) {
      logger.info('⏰ Auto-starting bulk sender (6 AM IST)');
      await this.start();
    }
    
    // Auto-stop at 11 PM
    if (istHour === this.workingHours.end && this.isRunning) {
      logger.info('⏰ Auto-stopping bulk sender (11 PM IST)');
      this.stop();
    }
  }

  // ==================== 100 PREMIUM TEMPLATES ====================

  generate100PremiumTemplates() {
    const templates = [];
    
    // Category 1: Warm Greetings (25)
    const greetings = [
      'नमस्ते {name} जी! 🙏\n\nआज का दिन कैसा रहा? How was your day?\n\n*कृपया reply जरूर करें!* ✨',
      'हैलो {name}! 😊\n\nसब कुछ ठीक चल रहा? Everything okay?\n\n*Please बताइए!* 💬',
      'प्रणाम {name} भाई/बहन! 🌟\n\nआपका दिन मंगलमय हो। Have a blessed day!\n\n*Reply करें!* 🌺',
      'Hi {name}! 👋\n\nबहुत दिन हो गए बात किए। Long time!\n\n*जवाब दो please!* ⭐',
      'सत श्री अकाल {name}! 🙏\n\nआप कैसे हो? How are you doing?\n\n*Reply जरूर करें!* 💫',
      'नमस्कार {name} जी! ✨\n\nआपसे मिलकर खुशी होगी। Nice to connect!\n\n*Please respond!* 🌈',
      'Hey {name}! 🎯\n\nव्यस्त तो नहीं? Not busy, right?\n\n*बताइए!* 📱',
      'जय हिन्द {name}! 🇮🇳\n\nसब कुशल मंगल? All well?\n\n*Reply please!* ✅',
      'हाय {name} भाई! 💫\n\nआज कुछ खास? Anything special today?\n\n*Share करो!* 🎉',
      'नमस्ते {name}! 🌸\n\nदिल से सुप्रभात। Good morning from heart!\n\n*जवाब दीजिए!* ☀️',
      'Hello {name} Sir/Mam! 🎊\n\nमिलकर अच्छा लगा। Good to meet you!\n\n*Bataiye!* 🙌',
      'प्रिय {name}! ❤️\n\nआपकी याद आई। Remembered you!\n\n*Reply करें!* 💭',
      'Dear {name}! 💼\n\nकाम कैसा चल रहा? How is work?\n\n*Please tell!* 🚀',
      'स्वागत {name} जी! 🏵️\n\nआप कहाँ से? Where from?\n\n*बताओ ना!* 🌍',
      'नमस्कार {name}! 🎭\n\nक्या हाल चाल? What is happening?\n\n*Share please!* 📢',
      'Namaste {name}! 🕉️\n\nआध्यात्मिक यात्रा कैसी? Spiritual journey?\n\n*Reply!* 🙏',
      'हेलो {name} भाई! 🎪\n\nपरिवार कैसा है? How is family?\n\n*बताइए!* 👨‍👩‍👧',
      'Hi friend {name}! 🤝\n\nदोस्ती अच्छी लगी। Liked our friendship!\n\n*Respond!* 💕',
      'भगवान की जय {name}! 🔱\n\nईश्वर की कृपा हो। May God bless!\n\n*Reply करो!* 🌟',
      'शुभ दिन {name}! 🌅\n\nआपका दिन शुभ हो। Have a great day!\n\n*बताओ!* ☀️',
      'राम राम {name} जी! 🙏\n\nसब ठीक-ठाक? All good?\n\n*Please reply!* ✨',
      'सुप्रभात {name}! 🌄\n\nनया दिन नई ऊर्जा! New day energy!\n\n*Share!* 💪',
      'गुड मॉर्निंग {name}! ☕\n\nचाय पी ली? Had tea?\n\n*Bataiye!* 😊',
      'शुभ संध्या {name}! 🌆\n\nशाम कैसी? How is evening?\n\n*Reply please!* 🌙',
      'नमन {name} जी! 🙇\n\nसम्मान से प्रणाम। Respectful greetings!\n\n*जवाब दें!* 🎯'
    ];
    
    // Category 2: Location & Background (25)
    const location = [
      'नमस्ते {name}! 🏙️\n\nआप किस शहर में रहते हैं? Which city?\n\n*Please बताइए!* 📍',
      'हैलो {name}! 🌄\n\nगाँव का नाम क्या है? Village name?\n\n*Reply करें!* 🏘️',
      'हाय {name} भाई! 🗺️\n\nराज्य कौनसा है? Which state?\n\n*बताओ!* 🇮🇳',
      'Hi {name}! 🗣️\n\nमातृभाषा क्या है? Mother tongue?\n\n*Share please!* 📖',
      'नमस्कार {name}! 🚇\n\nदिल्ली वाले हो? From Delhi?\n\n*Yes/No बताइए!* 🏛️',
      'Dear {name}! 🏛️\n\nराज्य की राजधानी? State capital?\n\n*बताओ ना!* 🏰',
      'प्रिय {name}! 🌊\n\nसमुद्र के पास रहते? Near sea?\n\n*Reply!* 🏖️',
      'Hello {name}! 🕌\n\nUP से हो क्या? From UP?\n\n*Bataiye!* 🙏',
      'हाय {name}! 🏢\n\nऑफिस कहाँ है? Office where?\n\n*Please tell!* 💼',
      'नमस्ते {name} जी! 🏡\n\nगाँव में रहते या शहर? Village or city?\n\n*Reply करें!* 🌾',
      'Hi friend {name}! 📮\n\nपिनकोड क्या है? Your pincode?\n\n*Share!* 📬',
      'हैलो {name}! 🚂\n\nबिहार वाले? From Bihar?\n\n*Yes/No!* 🌾',
      'नमस्कार {name}! 🌾\n\nपंजाब से हो? Punjab?\n\n*बताइए!* 🎵',
      'Dear {name}! 💪\n\nहरियाणा में रहते? In Haryana?\n\n*Reply!* 🏋️',
      'प्रणाम {name}! 🏰\n\nMP वाले हो? From MP?\n\n*Bataiye!* 🕉️',
      'Hello {name}! 🌳\n\nछत्तीसगढ़ से? CG?\n\n*Please tell!* 🌲',
      'हाय {name}! 👶\n\nजन्म कहाँ हुआ? Birth place?\n\n*Share!* 🎂',
      'नमस्ते {name}! 🗺️\n\nजिला कौनसा? District?\n\n*Reply करें!* 📌',
      'Hi {name}! 🌻\n\nगाँव का माहौल? Village vibe?\n\n*Bataiye!* 🌾',
      'हैलो {name}! 🏛️\n\nपुराना शहर? Old city?\n\n*Yes/No!* 🕌',
      'नमस्कार {name}! 🌍\n\nदेश के किस कोने में? Which corner?\n\n*बताओ!* 🧭',
      'Dear {name}! 🏔️\n\nपहाड़ों में रहते? In hills?\n\n*Reply!* ⛰️',
      'प्रिय {name}! 🏜️\n\nराजस्थान से? Rajasthan?\n\n*Bataiye!* 🐪',
      'Hello {name}! 🌊\n\nगोवा में हो? In Goa?\n\n*Please tell!* 🏖️',
      'हाय {name}! 🏙️\n\nमेट्रो सिटी? Metro city?\n\n*Share!* 🚇'
    ];
    
    // Category 3: Interests & Hobbies (25)
    const interests = [
      'नमस्ते {name}! ❤️\n\nशौक क्या है? Your hobby?\n\n*बताइए!* 🎨',
      'हैलो {name}! ⏰\n\nखाली समय में क्या करते? Free time activity?\n\n*Reply!* 🎯',
      'हाय {name}! 🏏\n\nक्रिकेट पसंद है? Like cricket?\n\n*Yes/No!* 🏆',
      'Hi {name}! 📚\n\nकिताबें पढ़ते हो? Read books?\n\n*Bataiye!* 📖',
      'नमस्कार {name}! 🎬\n\nफिल्में देखते हो? Watch movies?\n\n*Please tell!* 🎥',
      'Dear {name}! 🍛\n\nपसंदीदा खाना? Favorite food?\n\n*Share!* 🍽️',
      'प्रिय {name}! 💪\n\nजिम जाते हो? Go to gym?\n\n*Reply करें!* 🏋️',
      'Hello {name}! 🎵\n\nसंगीत का शौक? Music lover?\n\n*Bataiye!* 🎶',
      'हाय {name}! ✈️\n\nघूमना पसंद? Like traveling?\n\n*Yes/No!* 🗺️',
      'नमस्ते {name}! 📱\n\nसोशल मीडिया पर? On social media?\n\n*Reply!* 💬',
      'Hi friend {name}! 🌍\n\nकौनसी जगह पसंद? Favorite place?\n\n*Share!* 📍',
      'हैलो {name}! 🎮\n\nगेमिंग करते? Gaming?\n\n*Bataiye!* 🕹️',
      'नमस्कार {name}! 🎊\n\nकौनसा त्योहार पसंद? Favorite festival?\n\n*Please tell!* 🎉',
      'Dear {name}! 🙏\n\nधार्मिक हो? Religious?\n\n*Yes/No!* 🕉️',
      'प्रणाम {name}! 👨‍🍳\n\nखाना बनाना आता? Can cook?\n\n*Reply!* 🍳',
      'Hello {name}! 😴\n\nकितने घंटे सोते? Sleep hours?\n\n*Bataiye!* 🌙',
      'हाय {name}! 🌈\n\nपसंदीदा रंग? Favorite color?\n\n*Share!* 🎨',
      'नमस्ते {name}! 🎉\n\nपार्टी पसंद है? Like parties?\n\n*Yes/No!* 🎊',
      'Hi {name}! 📖\n\nअध्ययन का शौक? Study hobby?\n\n*Reply!* ✏️',
      'हैलो {name}! 🏊\n\nस्विमिंग करते? Swimming?\n\n*Bataiye!* 🌊',
      'नमस्कार {name}! 🧘\n\nयोग करते हो? Do yoga?\n\n*Please tell!* 🕉️',
      'Dear {name}! 🚴\n\nसाइकिलिंग पसंद? Like cycling?\n\n*Share!* 🚵',
      'प्रिय {name}! 🎤\n\nगाना गाते हो? Sing songs?\n\n*Reply!* 🎶',
      'Hello {name}! 🏃\n\nदौड़ना पसंद? Like running?\n\n*Bataiye!* 🏃‍♂️',
      'हाय {name}! 📷\n\nफोटोग्राफी? Photography?\n\n*Yes/No!* 📸'
    ];
    
    // Category 4: Family & Personal (25)
    const family = [
      'नमस्ते {name}! 👨‍👩‍👧‍👦\n\nकितने भाई-बहन? Siblings count?\n\n*बताइए!* 👫',
      'हैलो {name}! 👪\n\nपरिवार कितने लोग? Family members?\n\n*Reply!* 🏠',
      'हाय {name}! 🎂\n\nउम्र कितनी है? Your age?\n\n*Please tell!* 📅',
      'Hi {name}! 💍\n\nशादी हो गई? Married?\n\n*Yes/No!* 💑',
      'नमस्कार {name}! 👶\n\nबच्चे हैं क्या? Have kids?\n\n*Bataiye!* 👨‍👩‍👧',
      'Dear {name}! 🏠\n\nबड़ा परिवार? Big family?\n\n*Share!* 👨‍👩‍👧‍👦',
      'प्रिय {name}! 👴👵\n\nदादा-दादी जिंदा? Grandparents alive?\n\n*Reply!* 🙏',
      'Hello {name}! 👰\n\nबहन की शादी हुई? Sister married?\n\n*Bataiye!* 💐',
      'हाय {name}! 🚪\n\nअकेले रहते हो? Living alone?\n\n*Yes/No!* 🏡',
      'नमस्ते {name}! 👫\n\nदोस्त कितने हैं? Friends count?\n\n*Reply!* 🤝',
      'Hi friend {name}! 💑\n\nपति/पत्नी क्या करते? Spouse work?\n\n*Share!* 💼',
      'हैलो {name}! 🏡\n\nसंयुक्त परिवार? Joint family?\n\n*Bataiye!* 👨‍👩‍👧‍👦',
      'नमस्कार {name}! 👨\n\nपिताजी क्या करते? Father occupation?\n\n*Please tell!* 💼',
      'Dear {name}! 👩\n\nमाताजी गृहिणी? Mother housewife?\n\n*Reply!* 🏠',
      'प्रणाम {name}! 🤝\n\nबेस्ट फ्रेंड कौन? Best friend?\n\n*Bataiye!* 👯',
      'Hello {name}! 👬\n\nभाई के साथ रहते? With brother?\n\n*Yes/No!* 🏠',
      'हाय {name}! 🎒\n\nबच्चे स्कूल में? Kids in school?\n\n*Share!* 🏫',
      'नमस्ते {name}! 🧑\n\nघर के बड़े हो? Eldest?\n\n*Reply!* 👨‍👩‍👧',
      'Hi {name}! 😊\n\nपरिवार खुश है? Family happy?\n\n*Bataiye!* ❤️',
      'हैलो {name}! 🎓\n\nपढ़ाई कितनी की? Education level?\n\n*Please tell!* 📚',
      'नमस्कार {name}! 💼\n\nनौकरी करते हो? Working?\n\n*Yes/No!* 🏢',
      'Dear {name}! 🏠\n\nअपना घर है? Own house?\n\n*Reply!* 🏡',
      'प्रिय {name}! 🎊\n\nजन्मदिन कब? Birthday when?\n\n*Share!* 🎂',
      'Hello {name}! 💑\n\nप्रेमी/प्रेमिका? Boy/Girlfriend?\n\n*Bataiye!* 💕',
      'हाय {name}! 👨‍👩‍👧\n\nपरिवार का सपोर्ट? Family support?\n\n*Reply!* 🤗'
    ];
    
    templates.push(...greetings, ...location, ...interests, ...family);
    
    logger.success(`✅ Generated ${templates.length} premium templates`);
    return templates;
  }

  // ==================== INITIALIZATION ====================

  initDirectories() {
    try {
      fs.ensureDirSync(this.excelWatchPath);
      fs.ensureDirSync(this.completedPath);
      fs.ensureDirSync(this.backupPath);
      fs.ensureDirSync(this.logsPath);
      logger.info('📁 All directories ready');
    } catch (error) {
      logger.error(`❌ Directory error: ${error.message}`);
    }
  }

  loadState() {
    try {
      const statePath = path.join(this.logsPath, 'bulk_state.json');
      if (fs.existsSync(statePath)) {
        const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
        this.globalStats = { ...this.globalStats, ...state.globalStats };
        this.completedFiles = new Set(state.completedFiles || []);
        this.processedNumbers = new Set(state.processedNumbers || []);
        this.globalStats.lastRestart = new Date().toISOString();
        logger.info('📊 Previous state loaded');
      }
    } catch (error) {
      logger.warn('⚠️ No previous state');
    }
  }

  saveState() {
    try {
      const statePath = path.join(this.logsPath, 'bulk_state.json');
      const state = {
        globalStats: this.globalStats,
        completedFiles: Array.from(this.completedFiles),
        processedNumbers: Array.from(this.processedNumbers).slice(-10000), // Keep last 10k
        sessionStats: Array.from(this.sessionStats.entries()),
        scalingTracker: Array.from(this.scalingTracker.entries()),
        savedAt: new Date().toISOString()
      };
      fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    } catch (error) {
      logger.error(`❌ Save error: ${error.message}`);
    }
  }

  updateSessions(sessions) {
    this.sessions = sessions;
    
    for (const [sessionName] of sessions) {
      if (!this.sessionStats.has(sessionName)) {
        this.sessionStats.set(sessionName, {
          sent: 0,
          failed: 0,
          retries: 0,
          health: 'good',
          connected: true,
          startDate: new Date().toISOString()
        });
        this.sessionStartDate.set(sessionName, new Date());
        this.scalingTracker.set(sessionName, { day: 1, limit: 10 });
        this.templateRotation.set(sessionName, 0);
      }
    }
    
    logger.success(`🔗 ${sessions.size} session(s) linked`);
  }

  // ==================== PROGRESSIVE SCALING (15-20% DAILY) ====================

  getSessionDailyLimit(sessionName) {
    if (!this.scalingTracker.has(sessionName)) {
      this.scalingTracker.set(sessionName, { day: 1, limit: 10 });
    }
    
    const startDate = this.sessionStartDate.get(sessionName) || new Date();
    const today = new Date();
    const daysSinceStart = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
    
    let limit = 10; // Day 1 starts with 10
    for (let i = 1; i <= daysSinceStart; i++) {
      // 15-20% increase (using 17.5% average)
      limit = Math.min(400, Math.floor(limit * (1 + this.dailyIncreasePercent / 100)));
    }
    
    const tracker = this.scalingTracker.get(sessionName);
    tracker.day = daysSinceStart + 1;
    tracker.limit = limit;
    this.scalingTracker.set(sessionName, tracker);
    
    return limit;
  }

  canSessionSendToday(sessionName) {
    const dailyLimit = this.getSessionDailyLimit(sessionName);
    const todayCount = this.sessionDailyCount.get(sessionName) || 0;
    return todayCount < dailyLimit;
  }

  incrementSessionCount(sessionName) {
    const count = (this.sessionDailyCount.get(sessionName) || 0) + 1;
    this.sessionDailyCount.set(sessionName, count);
    this.sessionLastUsed.set(sessionName, new Date());
  }

  resetDailyCounts() {
    this.sessionDailyCount.clear();
    logger.info('🔄 Daily counts reset');
  }

  // ==================== TEMPLATE ROTATION ====================

  getNextTemplate(sessionName) {
    let index = this.templateRotation.get(sessionName) || 0;
    const template = this.templates[index];
    
    index = (index + 1) % this.templates.length;
    this.templateRotation.set(sessionName, index);
    
    return template;
  }

  personalizeMessage(template, contact) {
    const name = contact.name || 'Friend';
    return template.replace(/{name}/g, name);
  }

  // ==================== SMART INDIAN NUMBER HANDLING ====================

  normalizeIndianNumber(phone) {
    if (!phone) return null;
    
    // Convert to string and clean
    let cleaned = phone.toString().trim().replace(/[^0-9]/g, '');
    
    // Remove leading zeros
    cleaned = cleaned.replace(/^0+/, '');
    
    // If already has 91 prefix and 12 digits total
    if (cleaned.startsWith('91') && cleaned.length === 12) {
      return cleaned; // Already good: 919876543210
    }
    
    // If 10 digits starting with 6-9 (valid Indian mobile)
    if (cleaned.length === 10 && cleaned.match(/^[6-9]\d{9}$/)) {
      return '91' + cleaned; // Add 91: 9876543210 -> 919876543210
    }
    
    // If 11 digits starting with 0 (like 09876543210)
    if (cleaned.length === 11 && cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
      if (cleaned.match(/^[6-9]\d{9}$/)) {
        return '91' + cleaned;
      }
    }
    
    return null; // Invalid number
  }

  // ==================== SMART EXCEL PROCESSING ====================

  async smartLoadContactsFromExcel(excelPath) {
    try {
      const workbook = XLSX.readFile(excelPath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      
      const contacts = [];
      const phonePattern = /^[+]?[0]?[9]?[1]?[6-9]\d{9}$/; // Smart phone detection
      
      // Analyze all rows and columns to find phone and name
      for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
        const row = data[rowIndex];
        if (!row || row.length === 0) continue;
        
        let foundPhone = null;
        let foundName = null;
        
        // Search for phone number in ANY column
        for (let colIndex = 0; colIndex < row.length; colIndex++) {
          const cell = row[colIndex];
          if (!cell) continue;
          
          const cellStr = cell.toString().trim();
          
          // Check if this looks like a phone number
          if (phonePattern.test(cellStr.replace(/[\s-]/g, ''))) {
            const normalized = this.normalizeIndianNumber(cellStr);
            if (normalized && !this.processedNumbers.has(normalized)) {
              foundPhone = normalized;
              // Try to find name in adjacent columns or same row
              for (let nameCol = 0; nameCol < row.length; nameCol++) {
                if (nameCol !== colIndex && row[nameCol]) {
                  const nameCandidate = row[nameCol].toString().trim();
                  // Check if it looks like a name (not a number)
                  if (nameCandidate && nameCandidate.length > 1 && !/^\d+$/.test(nameCandidate)) {
                    foundName = nameCandidate;
                    break;
                  }
                }
              }
              break;
            }
          }
        }
        
        // If phone found, add contact
        if (foundPhone) {
          contacts.push({
            phone: foundPhone,
            name: foundName || 'Friend',
            retries: 0,
            status: 'pending'
          });
          this.processedNumbers.add(foundPhone); // NO REPEATS
        }
      }
      
      logger.success(`📊 Smart detected ${contacts.length} unique contacts`);
      return contacts;
      
    } catch (error) {
      logger.error(`❌ Excel error: ${error.message}`);
      return [];
    }
  }

  // ==================== CONTACT DISTRIBUTION ====================

  distributeContacts(contacts) {
    const activeSessions = Array.from(this.sessions.keys()).filter(name => {
      const sock = this.sessions.get(name);
      return sock && sock.user;
    });
    
    if (activeSessions.length === 0) {
      logger.error('❌ No active sessions');
      return new Map();
    }
    
    const distribution = new Map();
    const perSession = Math.ceil(contacts.length / activeSessions.length);
    
    activeSessions.forEach((sessionName, index) => {
      const start = index * perSession;
      const end = Math.min(start + perSession, contacts.length);
      const sessionContacts = contacts.slice(start, end);
      distribution.set(sessionName, sessionContacts);
      
      logger.info(`📱 [${sessionName}] ${sessionContacts.length} contacts`);
    });
    
    return distribution;
  }

  getSessionForContact(campaign, contact) {
    for (const [sessionName, contacts] of campaign.distribution) {
      if (contacts.includes(contact)) {
        const sock = this.sessions.get(sessionName);
        if (sock && sock.user && this.canSessionSendToday(sessionName)) {
          return sessionName;
        }
      }
    }
    
    for (const [sessionName] of this.sessions) {
      const sock = this.sessions.get(sessionName);
      if (sock && sock.user && this.canSessionSendToday(sessionName)) {
        return sessionName;
      }
    }
    
    return null;
  }

  // ==================== SMART DELAYS (BASED ON VOLUME) ====================

  calculateSmartDelay(totalContacts, currentIndex) {
    // Faster delays for smaller campaigns
    if (totalContacts <= 50) {
      return this._randomBetween(30000, 120000); // 30s - 2min
    } else if (totalContacts <= 200) {
      return this._randomBetween(45000, 180000); // 45s - 3min
    } else {
      return this._randomBetween(this.minDelay, this.maxDelay); // 45s - 5min
    }
  }

  // ==================== MESSAGE SENDING WITH TYPING ====================

  async sendMessage(sessionName, contact, campaign) {
    try {
      const sock = this.sessions.get(sessionName);
      if (!sock || !sock.user) {
        return { success: false, error: 'Socket not connected' };
      }
      
      const template = this.getNextTemplate(sessionName);
      const message = this.personalizeMessage(template, contact);
      
      const jid = `${contact.phone}@s.whatsapp.net`;
      
      // 1. Start typing simulation
      const typingDuration = this._randomBetween(
        this.typingDuration.min,
        this.typingDuration.max
      );
      
      await sock.sendPresenceUpdate('composing', jid);
      await this._sleep(typingDuration);
      
      // 2. Pause typing
      await sock.sendPresenceUpdate('paused', jid);
      await this._sleep(500);
      
      // 3. Send message
      await sock.sendMessage(jid, { text: message });
      
      // 4. Mark as available
      await sock.sendPresenceUpdate('available', jid);
      
      // Update stats
      const stats = this.sessionStats.get(sessionName);
      stats.sent++;
      this.sessionStats.set(sessionName, stats);
      
      this.incrementSessionCount(sessionName);
      
      // Smart delay based on campaign size
      const delay = this.calculateSmartDelay(
        campaign.contacts.length,
        campaign.currentIndex
      );
      await this._sleep(delay);
      
      return { success: true };
      
    } catch (error) {
      const stats = this.sessionStats.get(sessionName);
      stats.failed++;
      this.sessionStats.set(sessionName, stats);
      
      return { success: false, error: error.message };
    }
  }

  // ==================== CAMPAIGN MANAGEMENT ====================

  async startCampaign(campaign) {
    try {
      logger.info(`🚀 Starting: ${campaign.name}`);
      
      const contacts = await this.smartLoadContactsFromExcel(campaign.excelPath);
      
      if (contacts.length === 0) {
        logger.warn(`⚠️ No valid contacts in ${campaign.excelPath}`);
        this.fileInProgress.delete(campaign.fileName);
        return;
      }
      
      const distribution = this.distributeContacts(contacts);
      
      if (distribution.size === 0) {
        logger.error('❌ No active sessions');
        this.fileInProgress.delete(campaign.fileName);
        return;
      }
      
      campaign.contacts = contacts;
      campaign.distribution = distribution;
      campaign.status = 'running';
      campaign.startedAt = new Date().toISOString();
      campaign.currentIndex = 0;
      campaign.sent = 0;
      campaign.failed = 0;
      campaign.retries = 0;
      
      this.activeCampaigns.set(campaign.id, campaign);
      
      logger.success(`✅ Campaign started: ${campaign.name}`);
      
      // ONE-TIME notification for campaign start
      await this.notifyAdmin(
        `🚀 *CAMPAIGN STARTED*\n\n` +
        `📋 ${campaign.name}\n` +
        `📊 ${contacts.length} contacts\n` +
        `📱 ${distribution.size} sessions\n` +
        `⏰ ${this.getISTTime()}`
      );
      
    } catch (error) {
      logger.error(`❌ Campaign error: ${error.message}`);
      this.fileInProgress.delete(campaign.fileName);
    }
  }

  async processCampaign(campaignId, campaign) {
    if (campaign.currentIndex >= campaign.contacts.length) {
      await this.completeCampaign(campaignId, campaign);
      return;
    }
    
    if (!this.isBusinessHours()) {
      return;
    }
    
    const contact = campaign.contacts[campaign.currentIndex];
    const sessionName = this.getSessionForContact(campaign, contact);
    
    if (!sessionName) {
      await this._sleep(30000);
      return;
    }
    
    const result = await this.sendMessage(sessionName, contact, campaign);
    
    if (result.success) {
      campaign.sent++;
      this.globalStats.totalSent++;
      
      const progress = ((campaign.sent / campaign.contacts.length) * 100).toFixed(1);
      logger.success(`✅ [${campaign.name}] ${contact.name} - ${progress}%`);
      
    } else {
      campaign.failed++;
      this.globalStats.totalFailed++;
      
      if (contact.retries < 3) {
        contact.retries++;
        campaign.retries++;
        this.globalStats.totalRetries++;
        campaign.contacts.push(contact);
      }
    }
    
    campaign.currentIndex++;
    
    if (campaign.sent % 10 === 0) {
      this.saveState();
    }
  }

  async completeCampaign(campaignId, campaign) {
    try {
      campaign.status = 'completed';
      campaign.completedAt = new Date().toISOString();
      
      this.activeCampaigns.delete(campaignId);
      this.fileInProgress.delete(campaign.fileName);
      this.completedFiles.add(campaign.fileName);
      this.globalStats.campaignsCompleted++;
      this.globalStats.filesProcessed++;
      
      const sourcePath = campaign.excelPath;
      const destPath = path.join(this.completedPath, campaign.fileName);
      const backupPath = path.join(this.backupPath, `${Date.now()}_${campaign.fileName}`);
      
      fs.copyFileSync(sourcePath, backupPath);
      fs.moveSync(sourcePath, destPath, { overwrite: true });
      
      const duration = this._getDuration(campaign.startedAt, campaign.completedAt);
      
      logger.success(`🎉 Completed: ${campaign.name}`);
      
      // ONE-TIME completion notification
      await this.notifyAdmin(
        `🎉 *CAMPAIGN COMPLETED*\n\n` +
        `📋 ${campaign.name}\n` +
        `✅ Sent: ${campaign.sent}\n` +
        `❌ Failed: ${campaign.failed}\n` +
        `⏱️ Duration: ${duration}\n` +
        `📁 Moved to completed/`
      );
      
      this.saveState();
      
    } catch (error) {
      logger.error(`❌ Complete error: ${error.message}`);
    }
  }

  // ==================== BUSINESS HOURS (6 AM - 11 PM) ====================

  isBusinessHours() {
    const now = new Date();
    const istHour = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })).getHours();
    return istHour >= this.workingHours.start && istHour < this.workingHours.end;
  }

  getISTTime() {
    return new Date().toLocaleString('en-IN', { 
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  }

  // ==================== DAILY REPORTS ====================

  async autoReport() {
    const now = new Date();
    const istDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const currentDate = istDate.toDateString();
    const currentHour = istDate.getHours();
    
    if (this.lastReportDate && this.lastReportDate !== currentDate) {
      this.resetDailyCounts();
    }
    
    if (currentHour === this.reportTime && this.lastReportDate !== currentDate) {
      await this.sendDailyReport();
      this.lastReportDate = currentDate;
    }
  }

  async sendDailyReport() {
    try {
      let report = `📊 *DAILY BULK REPORT*\n`;
      report += `📅 ${this.getISTTime()}\n`;
      report += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
      
      report += `🌐 *GLOBAL STATS*\n`;
      report += `✅ Sent: ${this.globalStats.totalSent}\n`;
      report += `❌ Failed: ${this.globalStats.totalFailed}\n`;
      report += `🔄 Retries: ${this.globalStats.totalRetries}\n`;
      report += `🎯 Completed: ${this.globalStats.campaignsCompleted}\n\n`;
      
      report += `📱 *SESSION STATS*\n`;
      for (const [sessionName, stats] of this.sessionStats) {
        const limit = this.getSessionDailyLimit(sessionName);
        const todayCount = this.sessionDailyCount.get(sessionName) || 0;
        const scaling = this.scalingTracker.get(sessionName);
        const sock = this.sessions.get(sessionName);
        const connected = sock && sock.user ? '🟢' : '🔴';
        
        report += `\n${connected} ${sessionName}\n`;
        report += `├ Day: ${scaling?.day || 1}\n`;
        report += `├ Limit: ${limit}\n`;
        report += `├ Today: ${todayCount}/${limit}\n`;
        report += `└ Total: ${stats.sent}\n`;
      }
      
      report += `\n━━━━━━━━━━━━━━━━━━━━━\n`;
      report += `📋 Active: ${this.activeCampaigns.size}\n`;
      report += `📂 Queued: ${this.campaignQueue.length}\n`;
      report += `⏰ Hours: 6 AM - 11 PM\n`;
      
      await this.notifyAdmin(report);
      logger.success('📧 Daily report sent');
      
    } catch (error) {
      logger.error(`❌ Report error: ${error.message}`);
    }
  }

  // ==================== CONTROL COMMANDS ====================

  async start() {
    if (this.isRunning) {
      return { success: false, error: 'Already running' };
    }
    
    if (this.sessions.size === 0) {
      return { success: false, error: 'No sessions' };
    }
    
    this.isRunning = true;
    this.isPaused = false;
    
    logger.success('🚀 Bulk Sender STARTED');
    
    // ONE-TIME notification (only if not already notified)
    if (!this.adminNotified.bulkStarted) {
      await this.notifyAdmin(
        `🚀 *BULK SENDER STARTED*\n\n` +
        `✅ Auto-mode Active\n` +
        `✅ ${this.templates.length} Templates\n` +
        `✅ ${this.sessions.size} Sessions\n` +
        `⏰ 6 AM - 11 PM IST\n` +
        `📊 Daily Increase: 15-20%`
      );
      this.adminNotified.bulkStarted = true;
    }
    
    if (!this.mainLoopRunning) {
      this.mainLoop();
    }
    
    return { success: true };
  }

  pause() {
    if (!this.isRunning) {
      return { success: false, error: 'Not running' };
    }
    
    this.isPaused = true;
    logger.info('⏸️ Paused');
    this.notifyAdmin('⏸️ *PAUSED*').catch(() => {});
    return { success: true };
  }

  resume() {
    if (!this.isRunning || !this.isPaused) {
      return { success: false, error: 'Cannot resume' };
    }
    
    this.isPaused = false;
    logger.info('▶️ Resumed');
    this.notifyAdmin('▶️ *RESUMED*').catch(() => {});
    return { success: true };
  }

  stop() {
    this.isRunning = false;
    this.isPaused = false;
    this.saveState();
    
    logger.info('🛑 Stopped');
    this.notifyAdmin('🛑 *STOPPED*\n\nState saved').catch(() => {});
    return { success: true };
  }

  async getStatus() {
    const status = {
      running: this.isRunning,
      paused: this.isPaused,
      businessHours: this.isBusinessHours(),
      sessions: this.sessions.size,
      activeCampaigns: this.activeCampaigns.size,
      queuedCampaigns: this.campaignQueue.length,
      processedNumbers: this.processedNumbers.size,
      globalStats: this.globalStats,
      sessionStats: Array.from(this.sessionStats.entries()).map(([name, stats]) => ({
        name,
        ...stats,
        dailyLimit: this.getSessionDailyLimit(name),
        todaySent: this.sessionDailyCount.get(name) || 0,
        scaling: this.scalingTracker.get(name)
      }))
    };
    
    return status;
  }

  // ==================== MAIN LOOP ====================

  async mainLoop() {
    if (this.mainLoopRunning) {
      return;
    }
    
    this.mainLoopRunning = true;
    logger.info('🔄 Main loop started');
    
    while (this.isRunning) {
      try {
        if (this.isPaused) {
          await this._sleep(10000);
          continue;
        }
        
        await this.cloudFileWatcher();
        
        if (this.isBusinessHours()) {
          await this.processCampaignQueue();
          await this.processActiveCampaigns();
        }
        
        await this.healthCheck();
        await this.autoReport();
        
        await this._sleep(this.watchIntervalMs);
        
      } catch (error) {
        logger.error(`Loop error: ${error.message}`);
        await this._sleep(15000);
      }
    }
    
    this.mainLoopRunning = false;
    logger.info('🛑 Loop stopped');
  }

  async cloudFileWatcher() {
    try {
      const files = await this.autoDetectExcelFiles();
      
      for (const fileObj of files) {
        if (this.completedFiles.has(fileObj.name) || this.fileInProgress.has(fileObj.name)) {
          continue;
        }
        
        this.fileInProgress.add(fileObj.name);
        
        const campaign = {
          id: `campaign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: path.parse(fileObj.name).name,
          excelPath: fileObj.path,
          fileName: fileObj.name,
          status: 'queued',
          queuedAt: new Date().toISOString()
        };
        
        this.campaignQueue.push(campaign);
        logger.info(`📥 Queued: ${fileObj.name}`);
        
        // ONE-TIME notification per file
        if (this.adminNotified.lastFileDetected !== fileObj.name) {
          await this.notifyAdmin(
            `📥 *NEW FILE*\n\n` +
            `📋 ${fileObj.name}\n` +
            `📊 ${(fileObj.size / 1024).toFixed(2)} KB\n` +
            `⏰ ${this.getISTTime()}`
          );
          this.adminNotified.lastFileDetected = fileObj.name;
        }
      }
      
    } catch (error) {
      logger.warn(`Watcher error: ${error.message}`);
    }
  }

  async autoDetectExcelFiles() {
    try {
      if (!fs.existsSync(this.excelWatchPath)) {
        return [];
      }
      
      return fs.readdirSync(this.excelWatchPath)
        .filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'))
        .filter(f => !this.fileInProgress.has(f))
        .filter(f => !this.completedFiles.has(f))
        .filter(f => !this.isFileBeingWritten(path.join(this.excelWatchPath, f)))
        .map(f => ({
          name: f,
          path: path.join(this.excelWatchPath, f),
          size: fs.statSync(path.join(this.excelWatchPath, f)).size,
          created: fs.statSync(path.join(this.excelWatchPath, f)).birthtime
        }))
        .sort((a, b) => a.created - b.created);
        
    } catch (error) {
      return [];
    }
  }

  isFileBeingWritten(filePath) {
    try {
      const stats = fs.statSync(filePath);
      const age = Date.now() - stats.mtimeMs;
      return age < 5000;
    } catch {
      return true;
    }
  }

  async processCampaignQueue() {
    while (this.campaignQueue.length > 0 && this.activeCampaigns.size < 3) {
      const campaign = this.campaignQueue.shift();
      await this.startCampaign(campaign);
      await this._sleep(5000);
    }
  }

  async processActiveCampaigns() {
    for (const [id, campaign] of this.activeCampaigns) {
      try {
        await this.processCampaign(id, campaign);
      } catch (error) {
        logger.error(`Campaign error: ${error.message}`);
      }
    }
  }

  async healthCheck() {
    for (const [sessionName] of this.sessions) {
      const sock = this.sessions.get(sessionName);
      const connected = sock && sock.user;
      const stats = this.sessionStats.get(sessionName);
      
      if (stats) {
        stats.connected = connected;
        stats.health = connected ? 'good' : 'disconnected';
      }
    }
  }

  // ==================== ADMIN NOTIFICATIONS (ONE-TIME) ====================

  async notifyAdmin(message) {
    try {
      const adminJid = CONFIG.ADMIN?.JID;
      if (!adminJid) return;
      
      for (const [sessionName] of this.sessions) {
        const sock = this.sessions.get(sessionName);
        if (sock && sock.user) {
          await sock.sendMessage(adminJid, { text: message });
          break;
        }
      }
    } catch (error) {
      logger.error(`Notify error: ${error.message}`);
    }
  }

  // ==================== UTILITY ====================

  _randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  async _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  _getDuration(startTime, endTime) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diff = end - start;
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  }
}

// Singleton
let bulkSenderInstance = null;

export function getBulkSender() {
  if (!bulkSenderInstance) {
    bulkSenderInstance = new AdvancedBulkSender();
  }
  return bulkSenderInstance;
}

export default AdvancedBulkSender;
    
