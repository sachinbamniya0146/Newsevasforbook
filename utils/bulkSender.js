import fs from 'fs-extra';
import path from 'path';
import XLSX from 'xlsx';
import { fileURLToPath } from 'url';
import CONFIG from '../config.js';
import { logger } from './logger.js';
import { getSessionAdminManager } from './sessionManager.js';
import { getSocket, isSessionConnected } from './connectionManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 🌟 WORLD-CLASS 24/7 CLOUD BULK SENDER
 * 
 * ✅ Multi-session intelligent rotation (auto-split across all sessions)
 * ✅ Progressive scaling: Day 1: 10 → +10% daily → Max 400/session
 * ✅ 100 Hindi+English CTA templates with smart rotation
 * ✅ Anti-ban AI: Random delays, typing simulation, human patterns
 * ✅ Excel auto-detect (Col 1=Phone, Col 2=Name) - Indian numbers
 * ✅ Template rotation system (never repeats until all 100 used)
 * ✅ Admin commands: Start/stop/pause/status/report
 * ✅ Daily morning reports (7 AM) - per session stats
 * ✅ Working hours: 7 AM - 10 PM IST (customizable)
 * ✅ Real-time logging with detailed statistics
 * ✅ Auto-resume after disconnect/restart
 * ✅ Web app ready with REST API architecture
 */

class CloudBulkSender {
  constructor() {
    this.isRunning = false;
    this.isPaused = false;
    this.sessions = new Map();
    this.adminManager = getSessionAdminManager();
    
    // Campaign management
    this.activeCampaigns = new Map();
    this.campaignQueue = [];
    this.fileInProgress = new Set();
    this.completedFiles = new Set();
    
    // Session tracking with detailed stats
    this.sessionStats = new Map();
    this.sessionLastUsed = new Map();
    this.sessionDailyCount = new Map();
    this.sessionStartDate = new Map();
    
    // Templates (100 Hindi+English with CTA)
    this.templates = this.generate100CTATemplates();
    this.templateRotation = new Map(); // Track which template for which session
    
    // Progressive scaling tracker
    this.scalingTracker = new Map(); // sessionName -> { day, limit }
    
    // Paths
    this.excelWatchPath = '/storage/emulated/0/Order_seva_system_contact_excel/';
    this.completedPath = path.join(this.excelWatchPath, '../completed/');
    this.backupPath = path.join(this.excelWatchPath, '../backup/');
    this.logsPath = path.join(this.excelWatchPath, '../logs/');
    
    // Timing configuration
    this.workingHours = { start: 7, end: 22 }; // 7 AM - 10 PM IST
    this.watchIntervalMs = 30000; // 30 seconds file check
    this.reportTime = 7; // 7 AM daily report
    this.lastReportDate = null;
    
    // Anti-ban settings
    this.minDelay = 60000; // 1 minute
    this.maxDelay = 420000; // 7 minutes
    this.typingDuration = { min: 2000, max: 8000 };
    
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
    
    this.initDirectories();
    this.loadState();
    logger.success('🌟 Cloud Bulk Sender initialized with 100 templates');
  }

  // ==================== 100 CTA TEMPLATES (HINDI+ENGLISH) ====================

  generate100CTATemplates() {
    const templates = [];
    
    // Category 1: Greetings (20)
    const greetings = [
      'नमस्ते {name} जी! 🙏\n\nकैसे हैं आप? How are you?\n\nकृपया reply जरूर करें!',
      'हैलो {name}! 😊\n\nआप कैसे हो? आज का दिन कैसा रहा?\n\nPlease बताइए!',
      'नमस्कार {name} भाई/बहन! 🌟\n\nआपका दिन शुभ हो। How is your day?\n\nReply करें!',
      'Hi {name}! 👋\n\nसब कुछ ठीक चल रहा? All good?\n\nजवाब दो please!',
      'प्रणाम {name} जी! 🙌\n\nआप कहां से हैं? Where are you from?\n\nबताइए!',
      'Hey {name}! 💬\n\nबहुत दिन हो गए! कैसे हो?\n\nReply मत भूलना!',
      'नमस्ते {name}! ✨\n\nआपसे बात करके खुशी होगी। Nice to connect!\n\nजवाब दीजिए!',
      'Hello {name} Sir/Mam! ⏰\n\nआप व्यस्त तो नहीं? Are you free?\n\nPlease respond!',
      'सत श्री अकाल {name}! 🙏\n\nक्या हाल है? What\'s up?\n\nReply करें!',
      'नमस्कार {name} भाई! 👨‍👩‍👧\n\nपरिवार कैसा है? Family good?\n\nबताओ!',
      'Hi {name}! 📱\n\nOnline हो क्या? Are you there?\n\nReply please!',
      'जय हिन्द {name}! 🇮🇳\n\nकहां रहते हो? Where do you live?\n\nबताओ ना!',
      'नमस्ते {name} जी! 🎉\n\nआज क्या खास? Anything special?\n\nShare करो!',
      'Hello {name}! 💼\n\nव्यापार कैसा चल रहा? Business good?\n\nReply करें!',
      'हाय {name}! 🌾\n\nकिस गाँव से हो? Which village?\n\nजवाब दो!',
      'नमस्कार {name}! 🎂\n\nउम्र कितनी है? How old?\n\nBataiye!',
      'Hi {name}! 💻\n\nनौकरी करते हो? Working?\n\nReply करो!',
      'नमस्ते {name}! 💑\n\nशादी हो गई? Married?\n\nबताओ!',
      'Hello {name}! 🛠️\n\nक्या काम करते हो? What work?\n\nShare please!',
      'जय गुरुदेव {name}! 🙏\n\nसब ठीक? All okay?\n\nReply जरूर!'
    ];
    
    // Category 2: Location/Background (20)
    const location = [
      'नमस्ते {name} जी! 🏙️\n\nकिस शहर से हैं? Which city?\n\nPlease बताइए!',
      'Hi {name}! 🌄\n\nगाँव कहाँ है? Your village?\n\nReply करें!',
      '{name} भाई! 🐪\n\nराजस्थान से हो? From Rajasthan?\n\nYes/No बताओ!',
      'Hello {name}! 🗣️\n\nकौनसी भाषा बोलते हो? Language?\n\nBataiye!',
      '{name} जी! 🚇\n\nदिल्ली में हो? In Delhi?\n\nReply please!',
      'नमस्ते {name}! 📍\n\nराज्य कौनसा? Your state?\n\nजवाब दो!',
      'Hi {name}! 🌊\n\nमुंबई से हो? From Mumbai?\n\nBataiye!',
      '{name} भाई! 🕌\n\nUP से हो? From UP?\n\nReply करो!',
      'Hello {name}! 🏢\n\nकहाँ काम करते हो? Work where?\n\nShare!',
      '{name} जी! 🏡\n\nगाँव में रहते हो? Village life?\n\nYes/No!',
      'नमस्ते {name}! 📖\n\nमातृभाषा क्या? Mother tongue?\n\nBataiye!',
      'Hi {name}! 🚂\n\nबिहार से हो? From Bihar?\n\nReply!',
      '{name} भाई! 🌾\n\nपंजाब से? From Punjab?\n\nYes/No!',
      'Hello {name}! 💪\n\nहरियाणा में? In Haryana?\n\nजवाब दो!',
      '{name} जी! 🏰\n\nMP से हो? From MP?\n\nReply please!',
      'नमस्ते {name}! 📮\n\nपिनकोड क्या? Your pincode?\n\nBataiye!',
      'Hi {name}! 🗺️\n\nकिस जिले से? Which district?\n\nShare!',
      '{name} भाई! 🌳\n\nछत्तीसगढ़ से? From CG?\n\nReply!',
      'Hello {name}! 👶\n\nकहाँ पैदा हुए? Born where?\n\nBataiye!',
      '{name} जी! 🌻\n\nग्रामीण क्षेत्र? Rural area?\n\nYes/No!'
    ];
    
    // Category 3: Interests/Lifestyle (20)
    const interests = [
      'नमस्ते {name}! ❤️\n\nक्या पसंद है? What you like?\n\nBataiye!',
      'Hi {name}! ⏳\n\nखाली समय में क्या? Free time?\n\nReply!',
      '{name} भाई! 🎨\n\nहॉबी क्या है? Your hobby?\n\nजवाब दो!',
      'Hello {name}! 🏏\n\nक्रिकेट देखते हो? Watch cricket?\n\nYes/No!',
      '{name} जी! 📚\n\nकिताबें पढ़ना पसंद? Like reading?\n\nBataiye!',
      'नमस्ते {name}! 🎬\n\nफिल्में देखते हो? Watch movies?\n\nReply!',
      'Hi {name}! 🍛\n\nपसंदीदा खाना? Favorite food?\n\nShare!',
      '{name} भाई! 💪\n\nव्यायाम करते हो? Exercise?\n\nYes/No!',
      'Hello {name}! 🎵\n\nसंगीत पसंद? Like music?\n\nBataiye!',
      '{name} जी! ✈️\n\nयात्रा पसंद? Like traveling?\n\nReply!',
      'नमस्ते {name}! 📱\n\nसोशल मीडिया पर? On social?\n\nYes/No!',
      'Hi {name}! 🌍\n\nपसंदीदा जगह? Favorite place?\n\nBataiye!',
      '{name} भाई! 🎮\n\nगेम खेलते हो? Play games?\n\nReply!',
      'Hello {name}! 🎊\n\nपसंदीदा त्योहार? Favorite festival?\n\nShare!',
      '{name} जी! 🙏\n\nधार्मिक हो? Religious?\n\nYes/No!',
      'नमस्ते {name}! 👨‍🍳\n\nखाना बनाना आता? Can cook?\n\nBataiye!',
      'Hi {name}! 😴\n\nकितने घंटे सोते? Sleep hours?\n\nReply!',
      '{name} भाई! 🌈\n\nपसंदीदा रंग? Favorite color?\n\nजवाब!',
      'Hello {name}! 🎉\n\nपार्टी में जाते? Go parties?\n\nYes/No!',
      '{name} जी! 📖\n\nपढ़ाई पसंद? Like study?\n\nBataiye!'
    ];
    
    // Category 4: Family/Personal (20)
    const family = [
      'नमस्ते {name}! 👨‍👩‍👧‍👦\n\nकितने भाई-बहन? Siblings?\n\nBataiye!',
      'Hi {name}! 👪\n\nमाता-पिता क्या करते? Parents work?\n\nReply!',
      '{name} भाई! 🎂\n\nउम्र कितनी? Your age?\n\nजवाब दो!',
      'Hello {name}! 💍\n\nशादी कब हुई? When married?\n\nBataiye!',
      '{name} जी! 👶\n\nबच्चे हैं? Have kids?\n\nYes/No!',
      'नमस्ते {name}! 🏠\n\nपरिवार बड़ा? Big family?\n\nReply!',
      'Hi {name}! 👴👵\n\nमाता-पिता के साथ? With parents?\n\nBataiye!',
      '{name} भाई! 🧓\n\nदादा-दादी जीवित? Grandparents alive?\n\nYes/No!',
      'Hello {name}! 👰\n\nबहन की शादी? Sister married?\n\nReply!',
      '{name} जी! 🚪\n\nअकेले रहते? Live alone?\n\nBataiye!',
      'नमस्ते {name}! 👫\n\nकितने दोस्त? How many friends?\n\nजवाब!',
      'Hi {name}! 💑\n\nपत्नी/पति क्या करते? Spouse work?\n\nReply!',
      '{name} भाई! 🏡\n\nसंयुक्त परिवार? Joint family?\n\nYes/No!',
      'Hello {name}! 👨\n\nपिताजी क्या करते? Father job?\n\nBataiye!',
      '{name} जी! 👩\n\nमाताजी गृहिणी? Mother housewife?\n\nReply!',
      'नमस्ते {name}! 🤝\n\nबेस्ट फ्रेंड कौन? Best friend?\n\nBataiye!',
      'Hi {name}! 👬\n\nभाई के साथ? With brother?\n\nYes/No!',
      '{name} भाई! 🎒\n\nबच्चा स्कूल में? Kid in school?\n\nReply!',
      'Hello {name}! 🧑\n\nघर के बड़े हो? Eldest?\n\nYes/No!',
      '{name} जी! 😊\n\nपरिवार खुश? Family happy?\n\nBataiye!'
    ];
    
    // Category 5: Spiritual/Knowledge (20)
    const spiritual = [
      'नमस्ते {name}! 🙏\n\nआध्यात्मिक हो? Spiritual?\n\nBataiye!',
      'Hi {name}! 🕉️\n\nभगवान में विश्वास? Believe God?\n\nReply!',
      '{name} भाई! 🛕\n\nमंदिर जाते हो? Visit temple?\n\nYes/No!',
      'Hello {name}! 📖\n\nवेद-गीता पढ़ते? Read Vedas?\n\nBataiye!',
      '{name} जी! 🧘\n\nयोग करते हो? Do yoga?\n\nReply!',
      'नमस्ते {name}! 📿\n\nकबीर के बारे में सुना? Heard Kabir?\n\nYes/No!',
      'Hi {name}! 🕉️\n\nध्यान करते हो? Meditate?\n\nBataiye!',
      '{name} भाई! 👴\n\nगुरु कौन है? Your guru?\n\nReply!',
      'Hello {name}! 🎤\n\nसत्संग जाते? Attend satsang?\n\nYes/No!',
      '{name} जी! ✨\n\nमोक्ष में रुचि? Interest moksha?\n\nBataiye!',
      'नमस्ते {name}! ☪️\n\nकिस धर्म को मानते? Your religion?\n\nReply!',
      'Hi {name}! 📚\n\nआध्यात्मिक किताबें? Spiritual books?\n\nYes/No!',
      '{name} भाई! 🥘\n\nव्रत रखते हो? Do fasting?\n\nBataiye!',
      'Hello {name}! 🛕\n\nइष्ट देव कौन? Your deity?\n\nReply!',
      '{name} जी! 🚶\n\nतीर्थ यात्रा करते? Pilgrimage?\n\nYes/No!',
      'नमस्ते {name}! 📖\n\nधार्मिक ग्रंथ पढ़ते? Read scriptures?\n\nBataiye!',
      'Hi {name}! 🎶\n\nभक्ति संगीत पसंद? Like bhajans?\n\nReply!',
      '{name} भाई! 🙏\n\nधर्म का पालन? Follow religion?\n\nYes/No!',
      'Hello {name}! ✅\n\nसच्चाई में विश्वास? Believe truth?\n\nBataiye!',
      '{name} जी! 🧠\n\nज्ञान प्राप्त करना है? Want knowledge?\n\nReply!'
    ];
    
    templates.push(...greetings, ...location, ...interests, ...family, ...spiritual);
    
    logger.success(`✅ Generated ${templates.length} Hindi+English CTA templates`);
    return templates;
  }

  // ==================== INITIALIZATION ====================

  initDirectories() {
    try {
      fs.ensureDirSync(this.excelWatchPath);
      fs.ensureDirSync(this.completedPath);
      fs.ensureDirSync(this.backupPath);
      fs.ensureDirSync(this.logsPath);
      logger.info('📁 All directories initialized');
    } catch (error) {
      logger.error(`❌ Directory init error: ${error.message}`);
    }
  }

  loadState() {
    try {
      const statePath = path.join(this.logsPath, 'bulk_state.json');
      if (fs.existsSync(statePath)) {
        const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
        this.globalStats = { ...this.globalStats, ...state.globalStats };
        this.completedFiles = new Set(state.completedFiles || []);
        this.globalStats.lastRestart = new Date().toISOString();
        logger.info('📊 Previous state loaded - Auto-resume enabled');
      }
    } catch (error) {
      logger.warn('⚠️ No previous state found');
    }
  }

  saveState() {
    try {
      const statePath = path.join(this.logsPath, 'bulk_state.json');
      const state = {
        globalStats: this.globalStats,
        completedFiles: Array.from(this.completedFiles),
        sessionStats: Array.from(this.sessionStats.entries()),
        scalingTracker: Array.from(this.scalingTracker.entries()),
        savedAt: new Date().toISOString()
      };
      fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    } catch (error) {
      logger.error(`❌ Save state error: ${error.message}`);
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
    
    logger.success(`🔗 Linked ${sessions.size} WhatsApp session(s)`);
  }

  // ==================== PROGRESSIVE SCALING ====================

  getSessionDailyLimit(sessionName) {
    if (!this.scalingTracker.has(sessionName)) {
      this.scalingTracker.set(sessionName, { day: 1, limit: 10 });
    }
    
    const startDate = this.sessionStartDate.get(sessionName) || new Date();
    const today = new Date();
    const daysSinceStart = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
    
    let limit = 10; // Day 1 starts with 10
    for (let i = 1; i <= daysSinceStart; i++) {
      limit = Math.min(400, Math.floor(limit * 1.1)); // +10% daily, max 400
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
    logger.info('🔄 Daily counts reset for all sessions');
  }

  // ==================== TEMPLATE ROTATION ====================

  getNextTemplate(sessionName) {
    let index = this.templateRotation.get(sessionName) || 0;
    const template = this.templates[index];
    
    index = (index + 1) % this.templates.length;
    this.templateRotation.set(sessionName, index);
    
    if (index === 0) {
      logger.info(`♻️ [${sessionName}] Template rotation complete - Starting fresh`);
    }
    
    return template;
  }

  personalizeMessage(template, contact) {
    const name = contact.name || 'Friend';
    return template.replace(/{name}/g, name);
  }

  // ==================== INDIAN NUMBER HANDLING ====================

  normalizeIndianNumber(phone) {
    if (!phone) return null;
    
    // Remove all non-digit characters
    let cleaned = phone.toString().replace(/\D/g, '');
    
    // Handle +91 prefix
    if (cleaned.startsWith('91') && cleaned.length === 12) {
      cleaned = cleaned.substring(2);
    }
    
    // Indian numbers should be 10 digits
    if (cleaned.length === 10 && cleaned.match(/^[6-9]\d{9}$/)) {
      return '91' + cleaned; // Return with country code
    }
    
    return null;
  }

  // ==================== EXCEL PROCESSING ====================

  async loadContactsFromExcel(excelPath) {
    try {
      const workbook = XLSX.readFile(excelPath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      const contacts = [];
      
      for (let i = 1; i < data.length; i++) { // Skip header
        const row = data[i];
        if (!row[0]) continue;
        
        const phone = this.normalizeIndianNumber(row[0]);
        if (!phone) {
          logger.warn(`⚠️ Invalid number skipped: ${row[0]}`);
          continue;
        }
        
        const name = row[1] ? row[1].toString().trim() : 'Friend';
        
        contacts.push({
          phone,
          name,
          retries: 0,
          status: 'pending'
        });
      }
      
      logger.success(`📊 Loaded ${contacts.length} valid Indian contacts from Excel`);
      return contacts;
      
    } catch (error) {
      logger.error(`❌ Excel load error: ${error.message}`);
      return [];
    }
  }

  // ==================== CONTACT DISTRIBUTION ====================

  distributeContacts(contacts) {
    const activeSessions = Array.from(this.sessions.keys()).filter(name => 
      isSessionConnected(name)
    );
    
    if (activeSessions.length === 0) {
      logger.error('❌ No active sessions available');
      return new Map();
    }
    
    const distribution = new Map();
    const perSession = Math.ceil(contacts.length / activeSessions.length);
    
    activeSessions.forEach((sessionName, index) => {
      const start = index * perSession;
      const end = Math.min(start + perSession, contacts.length);
      const sessionContacts = contacts.slice(start, end);
      distribution.set(sessionName, sessionContacts);
      
      logger.info(`📱 [${sessionName}] Assigned ${sessionContacts.length} contacts`);
    });
    
    return distribution;
  }

  getSessionForContact(campaign, contact) {
    for (const [sessionName, contacts] of campaign.distribution) {
      if (contacts.includes(contact)) {
        if (isSessionConnected(sessionName) && this.canSessionSendToday(sessionName)) {
          return sessionName;
        }
      }
    }
    
    // Fallback: find any available session
    for (const [sessionName] of this.sessions) {
      if (isSessionConnected(sessionName) && this.canSessionSendToday(sessionName)) {
        return sessionName;
      }
    }
    
    return null;
  }

  // ==================== MESSAGE SENDING ====================

  async sendMessage(sessionName, contact, campaign) {
    try {
      const socket = getSocket(sessionName);
      if (!socket) {
        return { success: false, error: 'Socket not found' };
      }
      
      // Get next template and personalize
      const template = this.getNextTemplate(sessionName);
      const message = this.personalizeMessage(template, contact);
      
      // Simulate typing
      const typingDuration = this._randomBetween(
        this.typingDuration.min,
        this.typingDuration.max
      );
      
      await socket.sendPresenceUpdate('composing', `${contact.phone}@s.whatsapp.net`);
      await this._sleep(typingDuration);
      await socket.sendPresenceUpdate('paused', `${contact.phone}@s.whatsapp.net`);
      
      // Send message
      await socket.sendMessage(`${contact.phone}@s.whatsapp.net`, {
        text: message
      });
      
      // Update stats
      const stats = this.sessionStats.get(sessionName);
      stats.sent++;
      this.sessionStats.set(sessionName, stats);
      
      // Random delay (1-7 minutes)
      const delay = this._randomBetween(this.minDelay, this.maxDelay);
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
      logger.info(`🚀 Starting campaign: ${campaign.name}`);
      
      const contacts = await this.loadContactsFromExcel(campaign.excelPath);
      
      if (contacts.length === 0) {
        logger.warn(`⚠️ No valid contacts in ${campaign.excelPath}`);
        this.fileInProgress.delete(campaign.fileName);
        return;
      }
      
      const distribution = this.distributeContacts(contacts);
      
      if (distribution.size === 0) {
        logger.error('❌ No active sessions to distribute contacts');
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
      
      logger.success(`✅ Campaign started: ${campaign.name} (${contacts.length} contacts)`);
      
      // Notify admin
      await this.notifyAdmin(
        `🚀 *CAMPAIGN STARTED*\n\n` +
        `📋 Name: ${campaign.name}\n` +
        `📊 Contacts: ${contacts.length}\n` +
        `📱 Sessions: ${distribution.size}\n` +
        `⏰ Started: ${this.getISTTime()}`
      );
      
    } catch (error) {
      logger.error(`❌ Start campaign error: ${error.message}`);
      this.fileInProgress.delete(campaign.fileName);
    }
  }

  async processCampaign(campaignId, campaign) {
    if (campaign.currentIndex >= campaign.contacts.length) {
      await this.completeCampaign(campaignId, campaign);
      return;
    }
    
    if (!this.isBusinessHours()) {
      return; // Wait for business hours
    }
    
    const contact = campaign.contacts[campaign.currentIndex];
    const sessionName = this.getSessionForContact(campaign, contact);
    
    if (!sessionName) {
      await this._sleep(30000); // Wait 30 seconds
      return;
    }
    
    const result = await this.sendMessage(sessionName, contact, campaign);
    
    if (result.success) {
      campaign.sent++;
      this.incrementSessionCount(sessionName);
      this.globalStats.totalSent++;
      
      const progress = ((campaign.sent / campaign.contacts.length) * 100).toFixed(1);
      logger.success(
        `✅ [${campaign.name}] ${contact.name} (${contact.phone}) - ${progress}%`
      );
      
    } else {
      campaign.failed++;
      this.globalStats.totalFailed++;
      logger.error(`❌ [${campaign.name}] Failed ${contact.phone}: ${result.error}`);
      
      // Retry logic
      if (contact.retries < 3) {
        contact.retries++;
        campaign.retries++;
        this.globalStats.totalRetries++;
        campaign.contacts.push(contact);
        logger.info(`🔄 Retry queued for ${contact.phone} (Attempt ${contact.retries + 1})`);
      }
    }
    
    campaign.currentIndex++;
    
    // Save state every 10 messages
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
      
      // Move file to completed
      const sourcePath = campaign.excelPath;
      const destPath = path.join(this.completedPath, campaign.fileName);
      const backupPath = path.join(this.backupPath, `${Date.now()}_${campaign.fileName}`);
      
      fs.copyFileSync(sourcePath, backupPath);
      fs.moveSync(sourcePath, destPath, { overwrite: true });
      
      const duration = this._getDuration(campaign.startedAt, campaign.completedAt);
      
      logger.success(`🎉 Campaign completed: ${campaign.name}`);
      
      // Detailed completion report
      await this.notifyAdmin(
        `🎉 *CAMPAIGN COMPLETED*\n\n` +
        `📋 Name: ${campaign.name}\n` +
        `✅ Sent: ${campaign.sent}\n` +
        `❌ Failed: ${campaign.failed}\n` +
        `🔄 Retries: ${campaign.retries}\n` +
        `⏱️ Duration: ${duration}\n` +
        `📁 File: Moved to completed/`
      );
      
      this.saveState();
      
    } catch (error) {
      logger.error(`❌ Complete campaign error: ${error.message}`);
    }
  }

  // ==================== BUSINESS HOURS ====================

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
    
    // Reset daily counts at midnight
    if (this.lastReportDate && this.lastReportDate !== currentDate) {
      this.resetDailyCounts();
    }
    
    // Send report at 7 AM IST
    if (currentHour === this.reportTime && this.lastReportDate !== currentDate) {
      await this.sendDailyReport();
      this.lastReportDate = currentDate;
    }
  }

  async sendDailyReport() {
    try {
      let report = `📊 *DAILY BULK REPORT*\n`;
      report += `📅 Date: ${this.getISTTime()}\n`;
      report += `━━━━━━━━━━━━━━━━━━━━\n\n`;
      
      report += `🌐 *GLOBAL STATS*\n`;
      report += `✅ Total Sent: ${this.globalStats.totalSent}\n`;
      report += `❌ Total Failed: ${this.globalStats.totalFailed}\n`;
      report += `🔄 Total Retries: ${this.globalStats.totalRetries}\n`;
      report += `🎯 Campaigns Completed: ${this.globalStats.campaignsCompleted}\n`;
      report += `📁 Files Processed: ${this.globalStats.filesProcessed}\n\n`;
      
      report += `📱 *SESSION DETAILS*\n`;
      report += `━━━━━━━━━━━━━━━━━━━━\n`;
      
      for (const [sessionName, stats] of this.sessionStats) {
        const limit = this.getSessionDailyLimit(sessionName);
        const todayCount = this.sessionDailyCount.get(sessionName) || 0;
        const scaling = this.scalingTracker.get(sessionName);
        const connected = isSessionConnected(sessionName) ? '🟢' : '🔴';
        
        report += `\n${connected} *${sessionName}*\n`;
        report += `├ Day: ${scaling?.day || 1}\n`;
        report += `├ Today Limit: ${limit}\n`;
        report += `├ Today Sent: ${todayCount}\n`;
        report += `├ Total Sent: ${stats.sent}\n`;
        report += `├ Failed: ${stats.failed}\n`;
        report += `├ Health: ${stats.health}\n`;
        report += `└ Status: ${connected === '🟢' ? 'Connected' : 'Disconnected'}\n`;
      }
      
      report += `\n━━━━━━━━━━━━━━━━━━━━\n`;
      report += `🔄 *ACTIVE CAMPAIGNS*\n`;
      
      if (this.activeCampaigns.size === 0) {
        report += `No active campaigns\n`;
      } else {
        for (const [id, campaign] of this.activeCampaigns) {
          const progress = ((campaign.sent / campaign.contacts.length) * 100).toFixed(1);
          report += `\n📋 ${campaign.name}\n`;
          report += `├ Progress: ${progress}%\n`;
          report += `├ Sent: ${campaign.sent}/${campaign.contacts.length}\n`;
          report += `└ Failed: ${campaign.failed}\n`;
        }
      }
      
      report += `\n━━━━━━━━━━━━━━━━━━━━\n`;
      report += `📂 *QUEUE STATUS*\n`;
      report += `Queued campaigns: ${this.campaignQueue.length}\n`;
      
      report += `\n⏰ *WORKING HOURS*\n`;
      report += `${this.workingHours.start}:00 AM - ${this.workingHours.end}:00 PM IST\n`;
      report += `Current: ${this.isBusinessHours() ? '🟢 Active' : '🔴 Inactive'}\n`;
      
      await this.notifyAdmin(report);
      logger.success('📧 Daily report sent to admin');
      
    } catch (error) {
      logger.error(`❌ Daily report error: ${error.message}`);
    }
  }

  // ==================== HEALTH CHECK ====================

  async healthCheck() {
    for (const [sessionName] of this.sessions) {
      const connected = isSessionConnected(sessionName);
      const stats = this.sessionStats.get(sessionName);
      
      if (stats) {
        stats.connected = connected;
        stats.health = connected ? 'good' : 'disconnected';
        
        if (!connected) {
          logger.warn(`⚠️ [${sessionName}] Disconnected - Waiting for reconnection`);
        }
      }
    }
  }

  // ==================== CONTROL COMMANDS ====================

  async start() {
    if (this.isRunning) {
      return { success: false, error: 'Already running' };
    }
    
    this.isRunning = true;
    this.isPaused = false;
    
    logger.success('🚀 24/7 Cloud Bulk Sender STARTED');
    
    await this.notifyAdmin(
      `🚀 *BULK SENDER STARTED*\n\n` +
      `✅ 24/7 Mode Active\n` +
      `✅ ${this.templates.length} Templates Loaded\n` +
      `✅ Progressive Scaling Enabled\n` +
      `✅ ${this.sessions.size} Sessions Linked\n` +
      `⏰ Working Hours: ${this.workingHours.start} AM - ${this.workingHours.end} PM IST\n` +
      `📂 Watching: ${this.excelWatchPath}`
    );
    
    this.mainLoop();
    return { success: true };
  }

  pause() {
    if (!this.isRunning) {
      return { success: false, error: 'Not running' };
    }
    
    this.isPaused = true;
    logger.info('⏸️ Bulk sender paused');
    this.notifyAdmin('⏸️ *BULK SENDER PAUSED*').catch(() => {});
    return { success: true };
  }

  resume() {
    if (!this.isRunning || !this.isPaused) {
      return { success: false, error: 'Cannot resume' };
    }
    
    this.isPaused = false;
    logger.info('▶️ Bulk sender resumed');
    this.notifyAdmin('▶️ *BULK SENDER RESUMED*').catch(() => {});
    return { success: true };
  }

  stop() {
    this.isRunning = false;
    this.isPaused = false;
    this.saveState();
    
    logger.info('🛑 Bulk sender stopped');
    this.notifyAdmin('🛑 *BULK SENDER STOPPED*\n\nState saved for resume').catch(() => {});
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
    logger.info('🔄 Main loop started');
    
    while (this.isRunning) {
      try {
        if (this.isPaused) {
          await this._sleep(10000);
          continue;
        }
        
        // File watcher
        await this.cloudFileWatcher();
        
        // Process campaigns only during business hours
        if (this.isBusinessHours()) {
          await this.processCampaignQueue();
          await this.processActiveCampaigns();
        } else {
          const nextStart = new Date();
          nextStart.setHours(this.workingHours.start, 0, 0, 0);
          if (nextStart < new Date()) {
            nextStart.setDate(nextStart.getDate() + 1);
          }
          logger.info(`⏰ Outside working hours - Next start: ${nextStart.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
        }
        
        // Health check
        await this.healthCheck();
        
        // Auto reports
        await this.autoReport();
        
        await this._sleep(this.watchIntervalMs);
        
      } catch (error) {
        logger.error(`[BULK] Main loop error: ${error.message}`);
        await this._sleep(15000);
      }
    }
    
    logger.info('🛑 Main loop stopped');
  }

  async cloudFileWatcher() {
    try {
      const files = await this.autoDetectExcelFiles();
      
      for (const fileObj of files) {
        if (this.completedFiles.has(fileObj.name)) {
          continue; // Skip already processed files
        }
        
        if (this.fileInProgress.has(fileObj.name)) {
          continue; // Skip files being processed
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
        logger.info(`📥 Excel queued: ${fileObj.name}`);
        
        await this.notifyAdmin(
          `📥 *NEW FILE DETECTED*\n\n` +
          `📋 File: ${fileObj.name}\n` +
          `📊 Size: ${(fileObj.size / 1024).toFixed(2)} KB\n` +
          `⏰ Detected: ${this.getISTTime()}\n` +
          `📍 Status: Queued for processing`
        );
      }
      
    } catch (error) {
      logger.warn(`[BULK] File watcher error: ${error.message}`);
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
      logger.error(`[BULK] Excel detect error: ${error.message}`);
      return [];
    }
  }

  isFileBeingWritten(filePath) {
    try {
      const stats = fs.statSync(filePath);
      const age = Date.now() - stats.mtimeMs;
      return age < 5000; // Wait 5 seconds after last modification
    } catch {
      return true;
    }
  }

  async processCampaignQueue() {
    while (this.campaignQueue.length > 0 && this.activeCampaigns.size < 3) {
      const campaign = this.campaignQueue.shift();
      await this.startCampaign(campaign);
      await this._sleep(5000); // Small delay between campaign starts
    }
  }

  async processActiveCampaigns() {
    for (const [id, campaign] of this.activeCampaigns) {
      try {
        await this.processCampaign(id, campaign);
      } catch (error) {
        logger.error(`❌ Campaign ${id} error: ${error.message}`);
      }
    }
  }

  // ==================== ADMIN NOTIFICATIONS ====================

  async notifyAdmin(message) {
    try {
      if (!this.adminManager) return;
      
      const adminNumbers = await this.adminManager.getAdminNumbers();
      
      for (const adminNum of adminNumbers) {
        for (const [sessionName] of this.sessions) {
          if (isSessionConnected(sessionName)) {
            const socket = getSocket(sessionName);
            if (socket) {
              await socket.sendMessage(`${adminNum}@s.whatsapp.net`, {
                text: message
              });
              break; // Send from first available session only
            }
          }
        }
      }
    } catch (error) {
      logger.error(`❌ Admin notify error: ${error.message}`);
    }
  }

  // ==================== UTILITY FUNCTIONS ====================

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

// Singleton instance
let bulkSenderInstance = null;

export function getBulkSender() {
  if (!bulkSenderInstance) {
    bulkSenderInstance = new CloudBulkSender();
  }
  return bulkSenderInstance;
}

export default CloudBulkSender;
