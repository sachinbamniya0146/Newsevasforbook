import { fetchPinDetails } from '../utils/pincodeHelper.js';
import { saveOrder } from '../utils/database.js';
import { forwardOrderToAll } from '../utils/orderForwarding.js';
import CONFIG from '../config.js';
import fs from 'fs';

// ========================= STATE MANAGEMENT =========================
const userStates = new Map();
const orderCounters = new Map();
const reminderTimeouts = new Map();
const userOrderCompleted = new Map();
const userLanguagePreference = new Map();
const sessionOrderStats = new Map();

// ========================= SUPPORTED LANGUAGES =========================
const SUPPORTED_LANGUAGES = {
  'hi': 'हिंदी',
  'en': 'English',
  'pa': 'ਪੰਜਾਬੀ',
  'bn': 'বাংলা',
  'te': 'తెలుగు',
  'mr': 'मराठी',
  'ta': 'தமிழ்',
  'gu': 'ગુજરાતી',
  'kn': 'ಕನ್ನಡ',
  'ml': 'മലയാളം',
  'or': 'ଓଡ଼ିଆ',
  'ur': 'اردو'
};

const LANGUAGE_CODE_MAP = {
  '1': 'hi', '2': 'en', '3': 'pa', '4': 'bn', '5': 'te',
  '6': 'mr', '7': 'ta', '8': 'gu', '9': 'kn', '10': 'ml',
  '11': 'or', '12': 'ur'
};

// ========================= BOOK DESCRIPTIONS =========================
const BOOK_DESCRIPTIONS = [
  "इस पुस्तक में सच्चे आध्यात्मिक ज्ञान का खजाना है। | This book contains true spiritual knowledge.",
  "यह पुस्तक आपको बताती है कि परमात्मा को कैसे पाएं। | Learn how to attain God.",
  "जीवन की सभी परेशानियों का सही समाधान। | Solution to all life problems.",
  "यह पुस्तक हजारों लोगों की ज़िंदगी बदल चुकी है! | This book has changed thousands of lives!",
  "परमात्मा कबीर साहेब का सच्चा परिचय। | True introduction of Supreme God Kabir."
];

// ========================= HELPER FUNCTIONS =========================
function getRandomDescription() {
  return BOOK_DESCRIPTIONS[Math.floor(Math.random() * BOOK_DESCRIPTIONS.length)];
}

function isYes(txt) {
  const yes = ['1','yes','ok','haan','ha','हां','done','order','haa','y','ji','जी','han','theek'];
  return yes.includes(txt.trim().toLowerCase());
}

function isNo(txt) {
  const no = ['2','no','nahi','ना','नहीं','nope','n','cancel'];
  return no.includes(txt.trim().toLowerCase());
}

function isBack(txt) {
  const back = ['back','वापस','peeche','0','⬅️','पीछे','vapas'];
  return back.includes(txt.trim().toLowerCase());
}

function autoBook(text) {
  const low = text.trim().toLowerCase();
  if (low.includes('ganga') || low.includes('ज्ञान') || low.includes('gyan')) return 'ज्ञान गंगा';
  if (low.includes('jeene') || low.includes('जीने') || low.includes('living') || low.includes('राह')) return 'जीने की राह';
  return null;
}

function updateOrderCount(sessionName) {
  if (!orderCounters.has(sessionName)) orderCounters.set(sessionName, 1);
  else orderCounters.set(sessionName, orderCounters.get(sessionName) + 1);
  return orderCounters.get(sessionName);
}

function getRotatedImage(userJid) {
  try {
    const base = '/sdcard/DCIM/gyan ganga seva/';
    if (!fs.existsSync(base)) return null;
    const files = fs.readdirSync(base).filter(f => f.match(/\.(jpg|jpeg|png)$/i));
    if (!files.length) return null;
    const idx = Math.abs((userJid || '').split('').reduce((s, c) => s + c.charCodeAt(0), 0)) % files.length;
    return base + files[idx];
  } catch {
    return null;
  }
}

function detectLanguage(text) {
  const hindiRegex = /[\u0900-\u097F]/;
  const punjabiRegex = /[\u0A00-\u0A7F]/;
  const bengaliRegex = /[\u0980-\u09FF]/;
  const teluguRegex = /[\u0C00-\u0C7F]/;
  const tamilRegex = /[\u0B80-\u0BFF]/;
  const gujaratiRegex = /[\u0A80-\u0AFF]/;
  const kannadaRegex = /[\u0C80-\u0CFF]/;
  const malayalamRegex = /[\u0D00-\u0D7F]/;
  const odiaRegex = /[\u0B00-\u0B7F]/;
  const urduRegex = /[\u0600-\u06FF]/;
  
  if (hindiRegex.test(text)) return 'hi';
  if (punjabiRegex.test(text)) return 'pa';
  if (bengaliRegex.test(text)) return 'bn';
  if (teluguRegex.test(text)) return 'te';
  if (tamilRegex.test(text)) return 'ta';
  if (gujaratiRegex.test(text)) return 'gu';
  if (kannadaRegex.test(text)) return 'kn';
  if (malayalamRegex.test(text)) return 'ml';
  if (odiaRegex.test(text)) return 'or';
  if (urduRegex.test(text)) return 'ur';
  
  return 'hi'; // Default
}

// ========================= SESSION STATISTICS =========================
function updateSessionStats(sessionName, action = 'order') {
  if (!sessionOrderStats.has(sessionName)) {
    sessionOrderStats.set(sessionName, {
      total: 0,
      today: 0,
      last24Hours: 0,
      lastReset: Date.now(),
      orders: []
    });
  }
  
  const stats = sessionOrderStats.get(sessionName);
  const now = Date.now();
  
  if (action === 'order') {
    stats.total++;
    stats.today++;
    stats.last24Hours++;
    stats.orders.push({ timestamp: now, action: 'order' });
  }
  
  // Reset daily counter at midnight
  const lastResetDate = new Date(stats.lastReset).getDate();
  const currentDate = new Date().getDate();
  if (lastResetDate !== currentDate) {
    stats.today = 0;
    stats.lastReset = now;
  }
  
  // Clean up orders older than 24 hours
  stats.orders = stats.orders.filter(o => (now - o.timestamp) < 86400000);
  stats.last24Hours = stats.orders.length;
  
  sessionOrderStats.set(sessionName, stats);
  return stats;
}

function getSessionStats(sessionName) {
  return sessionOrderStats.get(sessionName) || {
    total: 0,
    today: 0,
    last24Hours: 0,
    orders: []
  };
}

// ========================= REMINDER SYSTEM =========================
function scheduleReminder(sock, from, state, sessionName, isAdmin) {
  if (reminderTimeouts.has(from)) clearTimeout(reminderTimeouts.get(from));
  const reminderTime = 6 * 60 * 60 * 1000; // 6 hours
  
  reminderTimeouts.set(from, setTimeout(async () => {
    if (userStates.has(from)) {
      const imgPath = getRotatedImage(from);
      let remTxt = isAdmin
        ? `🛠️ *[Admin Test Mode Reminder]*\nआप अभी भी Test-Mode में हैं।\n(Reply 'exit' या 0 छोड़ने के लिए)`
        : `🙏 आपकी निःशुल्क पुस्तक का ऑर्डर अधूरा है!\nYour free book order is pending.\nकृपया reply करें।`;
      
      if (imgPath && fs.existsSync(imgPath)) {
        await sock.sendMessage(from, { image: { url: imgPath }, caption: remTxt });
      } else {
        await sock.sendMessage(from, { text: remTxt });
      }
    }
  }, reminderTime));
}

// ========================= ADMIN TEST MODE =========================
async function handleAdminTestMode(sock, from, text, state, sessionName) {
  let imgPath = getRotatedImage(from);
  
  if (!state.testMode) {
    if (text.toLowerCase() === "test" || text === "1") {
      state.testMode = true;
      userStates.set(from, state);
      const msg = `🛠️ *Admin Test Mode Activated!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ हर message पर image
✅ Full system testing
✅ Order simulation enabled

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 *Test Commands:*
- 'exit' or '0' = Exit Test Mode
- 'stats' = View statistics
- 'report' = Generate report

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔧 Reply to start testing...`;
      
      if (imgPath && fs.existsSync(imgPath)) {
        await sock.sendMessage(from, { image: { url: imgPath }, caption: msg });
      } else {
        await sock.sendMessage(from, { text: msg });
      }
      scheduleReminder(sock, from, state, sessionName, true);
      return true;
    }
    
    const msg = `🔐 *Admin Verified!*\n\nTest Mode शुरू करने के लिए:\n*'test'* या *'1'* भेजें`;
    
    if (imgPath && fs.existsSync(imgPath)) {
      await sock.sendMessage(from, { image: { url: imgPath }, caption: msg });
    } else {
      await sock.sendMessage(from, { text: msg });
    }
    return true;
  }
  
  // Handle test mode commands
  if (text.toLowerCase() === "exit" || text === "0") {
    userStates.delete(from);
    if (reminderTimeouts.has(from)) clearTimeout(reminderTimeouts.get(from));
    await sock.sendMessage(from, { text: "🚫 *Test Mode समाप्त!*\n_Test Mode Exited!_" });
    return true;
  }
  
  if (text.toLowerCase() === "stats") {
    const stats = getSessionStats(sessionName);
    const statsMsg = `📊 *${sessionName} Statistics*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 कुल ऑर्डर: ${stats.total}
📦 आज: ${stats.today}
📦 Last 24h: ${stats.last24Hours}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    await sock.sendMessage(from, { text: statsMsg });
    return true;
  }
  
  // Echo test message
  const echoMsg = `🔁 *[Test Mode Echo]*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 Your message: "${text}"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ℹ️ Commands: 'exit', 'stats'`;
  
  if (imgPath && fs.existsSync(imgPath)) {
    await sock.sendMessage(from, { image: { url: imgPath }, caption: echoMsg });
  } else {
    await sock.sendMessage(from, { text: echoMsg });
  }
  
  scheduleReminder(sock, from, state, sessionName, true);
  return true;
}

// ========================= RESEND MENU =========================
async function resendMenu(sock, from, state) {
  const step = state.step;
  
  try {
    if (step === 'awaiting_book' || step === 'awaiting_pdf_book') {
      const randomDesc = getRandomDescription();
      const welcome = `🙏 *नमस्ते! Namaste!*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 *संत रामपाल जी महाराज* की निःशुल्क पुस्तक सेवा
_Free Book Service by Sant Rampal Ji Maharaj_

हम आपको निःशुल्क पुस्तक भेजना चाहते हैं। Delivery भी फ्री है।
_We want to send you a free book. Delivery is also free._

📖 *पुस्तक में:*
${randomDesc}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*कौनसी पुस्तक चाहिए?*
_Which book would you like?_

1️⃣ ज्ञान गंगा (Gyan Ganga)
2️⃣ जीने की राह (Way of Living)
3️⃣ पहले PDF देखना चाहते हैं?

*1, 2 या 3 भेजें*`;
      await sock.sendMessage(from, { text: welcome });
    }
    
    else if (step === 'awaiting_language') {
      const bookName = state.bookName || 'ज्ञान गंगा';
      const langs = state.availableLangs || (CONFIG.BOOK_PDFS && CONFIG.BOOK_PDFS[bookName] ? Object.keys(CONFIG.BOOK_PDFS[bookName]) : ['हिंदी', 'English']);
      let langMenu = `✅ *${bookName}* चुना।\n✍️ लेखक: संत रामपाल जी महाराज\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nकिस भाषा में?\nWhich language?\n\n`;
      langs.forEach((lang, i) => langMenu += `${i + 1}. ${lang}\n`);
      langMenu += `\nभाषा का नंबर भेजें (Send number)`;
      await sock.sendMessage(from, { text: langMenu });
    }
    
    else if (step === 'awaiting_name') {
      await sock.sendMessage(from, { text: `✅ भाषा: *${state.language || 'हिंदी'}*\n\nअब अपना *पूरा नाम* भेजें:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nYour Full Name:\nउदाहरण: राज कुमार शर्मा` });
    }
    
    else if (step === 'confirm_name') {
      await sock.sendMessage(from, { text: `नाम (Name): *${state.name}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nक्या सही है? | Is it correct?\n\n✅ सही है तो: *1* / "हां" / "Yes"\n❌ बदलना है तो: *2* / "नहीं" / "No"` });
    }
    
    else if (step === 'awaiting_father') {
      await sock.sendMessage(from, { text: `अब अपने *पिता का नाम* लिखें:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nFather's Name:\nउदाहरण: संतोष कुमार शर्मा` });
    }
    
    else if (step === 'confirm_father') {
      await sock.sendMessage(from, { text: `पिता का नाम: *${state.father}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nक्या सही है? | Is it correct?\n\n✅ *1* / "हां"\n❌ *2* / "नहीं"` });
    }
    
    else if (step === 'awaiting_mobile') {
      await sock.sendMessage(from, { text: `अब *मोबाइल नंबर* (10-digit) भेजें:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nMobile Number:\nउदाहरण: 9876543210` });
    }
    
    else if (step === 'confirm_mobile') {
      await sock.sendMessage(from, { text: `मोबाइल नंबर: *${state.mobile}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nक्या सही है?\n\n✅ *1*\n❌ *2*` });
    }
    
    else if (step === 'awaiting_pincode') {
      await sock.sendMessage(from, { text: `अब *पिनकोड* (6-digit) भेजें:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nPincode:\nउदाहरण: 110001` });
    }
    
    else if (step === 'awaiting_location_choice') {
      let menu = "📍 *अपना क्षेत्र चुनें | Select Your Area:*\n\n";
      if (state.postOffices && state.postOffices.length) {
        state.postOffices.forEach((po, i) => {
          menu += `${i + 1}. ${po.name} (${po.branchType})\n`;
        });
        menu += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📮 नंबर भेजें (Send number)`;
      }
      await sock.sendMessage(from, { text: menu });
    }
    
    else if (step === 'awaiting_full_address') {
      await sock.sendMessage(from, { text: `✅ *पिनकोड:* ${state.pincode}\n📍 *जिला:* ${state.district}\n📍 *राज्य:* ${state.stateName}\n${state.selectedLocation ? `📮 *क्षेत्र:* ${state.selectedLocation}\n` : ''}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nअब अपना *पूरा पता विस्तार से* लिखें:\n_Complete address in detail:_\n\nजैसे: मकान नंबर, गली, गांव/शहर, landmark\n\n💡 जितना विस्तार से, उतना बेहतर!` });
    }
    
    else if (step === 'awaiting_confirmation') {
      await sock.sendMessage(from, { text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📋 *ऑर्डर कन्फर्मेशन*\n_Order Confirmation_\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n👤 नाम: ${state.name}\n👨 पिता: ${state.father}\n📞 मोबाइल: +91${state.mobile}\n📚 पुस्तक: ${state.bookName}\n🌐 भाषा: ${state.language}\n📍 पता: ${state.fullAddress}\n📮 पिनकोड: ${state.pincode}\n🏘️ जिला: ${state.district}\n🗺️ राज्य: ${state.stateName}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━` });
      await sock.sendMessage(from, { text: `✅ *Order Done* के लिए: *1* / "yes" / "order"\n❌ *Cancel* के लिए: *2* / "no"\n\nअपना जवाब भेजें:` });
    }
  } catch (error) {
    console.error(`❌ Resend Menu Error: ${error.message}`);
  }
}

// ========================= MAIN MESSAGE HANDLER =========================
export async function handleMessage(sock, msg, sessionName = 'WhatsApp') {
  try {
    const from = msg.key?.remoteJid ?? msg.key?.participant ?? '';
    if (!from) return;
    
    // Ignore group messages
    if (from.endsWith('@g.us')) {
      console.log('Ignoring group message from:', from);
      return;
    }
    
    const textRaw = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
    const text = textRaw.trim();
    if (!text) return;
    
    const isAdmin = CONFIG.ADMIN && from === CONFIG.ADMIN.JID;
    let state = userStates.get(from) || {};
    
    // Detect user language
    if (!userLanguagePreference.has(from)) {
      const detected = detectLanguage(text);
      userLanguagePreference.set(from, detected);
    }
    
    // ==================== ADMIN TEST MODE ====================
    if (isAdmin) {
      const handled = await handleAdminTestMode(sock, from, text, state, sessionName);
      if (handled) return;
    }
    
    // ==================== CHECK RECENT ORDERS ====================
    if (userOrderCompleted.has(from)) {
      const lastOrder = userOrderCompleted.get(from);
      const diff = Date.now() - lastOrder;
      const sixh = 6 * 60 * 60 * 1000;
      
      if (diff < sixh) {
        const imgPath = getRotatedImage(from);
        const remindText = `🙏 आपका ऑर्डर पहले ही दर्ज हो चुका है!\nYour order is already placed!\n\nनया ऑर्डर ${Math.ceil((sixh - diff) / (60 * 60 * 1000))} घंटे बाद कर सकते हैं।`;
        
        if (imgPath && fs.existsSync(imgPath)) {
          await sock.sendMessage(from, { image: { url: imgPath }, caption: remindText });
        } else {
          await sock.sendMessage(from, { text: remindText });
        }
        return;
      } else {
        userOrderCompleted.delete(from);
      }
    }
    
    // ==================== NEW CONVERSATION START ====================
    if (!userStates.has(from)) {
      let auto = autoBook(text);
      const imgPath = getRotatedImage(from);
      const randomDesc = getRandomDescription();
      
      let welcome = `🙏 *नमस्ते! Namaste!*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 *संत रामपाल जी महाराज* की निःशुल्क पुस्तक सेवा
_Free Book Service by Sant Rampal Ji Maharaj_

हम आपको पूर्णतः निःशुल्क पुस्तक भेजना चाहते हैं। delivery भी फ्री है।
_We want to send you a completely free book. Delivery is also free._

📖 *पुस्तक में:*
${randomDesc}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*कौनसी पुस्तक चाहिए?*
_Which book would you like?_

1️⃣ ज्ञान गंगा (Gyan Ganga)
2️⃣ जीने की राह (Way of Living)
3️⃣ पहले PDF देखना चाहते हैं?

*1, 2 या 3 भेजें*`;
      
      if (text.toLowerCase() === 'pdf' || text === '3') {
        state.step = 'awaiting_pdf_book';
        userStates.set(from, state);
        if (imgPath && fs.existsSync(imgPath)) {
          await sock.sendMessage(from, { image: { url: imgPath }, caption: welcome });
        } else {
          await sock.sendMessage(from, { text: welcome });
        }
        scheduleReminder(sock, from, state, sessionName, false);
        return;
      } else if (auto) {
        state.bookName = auto;
        state.step = 'awaiting_language';
        userStates.set(from, state);
      } else {
        state.step = 'awaiting_book';
        userStates.set(from, state);
      }
      
      if (imgPath && fs.existsSync(imgPath)) {
        await sock.sendMessage(from, { image: { url: imgPath }, caption: welcome });
      } else {
        await sock.sendMessage(from, { text: welcome });
      }
      
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }
    
    // ==================== CONTINUE EXISTING CONVERSATION ====================
    state = userStates.get(from);
    state.lastActive = Date.now();
    userStates.set(from, state);
    
    // Handle back navigation
    if (isBack(text)) {
      const prev = {
        awaiting_language: 'awaiting_book',
        awaiting_name: 'awaiting_language',
        confirm_name: 'awaiting_name',
        awaiting_father: 'confirm_name',
        confirm_father: 'awaiting_father',
        awaiting_mobile: 'confirm_father',
        confirm_mobile: 'awaiting_mobile',
        awaiting_pincode: 'confirm_mobile',
        awaiting_location_choice: 'awaiting_pincode',
        awaiting_full_address: 'awaiting_location_choice',
        awaiting_confirmation: 'awaiting_full_address',
        awaiting_pdf_language: 'awaiting_pdf_book',
        pdf_shown: 'awaiting_book'
      };
      
      if (prev[state.step]) {
        state.step = prev[state.step];
        userStates.set(from, state);
        await sock.sendMessage(from, { text: `⬅️ पिछला स्टेप!\n_Previous step!_\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━` });
        await resendMenu(sock, from, state);
      }
      return;
    }
    
    // ==================== BOOK SELECTION ====================
    if (state.step === 'awaiting_book') {
      let book = null;
      if (text === '1') book = 'ज्ञान गंगा';
      else if (text === '2') book = 'जीने की राह';
      else if (text === '3') {
        state.step = 'awaiting_pdf_book';
        userStates.set(from, state);
        const randomDesc = getRandomDescription();
        await sock.sendMessage(from, { text: `कौनसी पुस्तक का PDF देखना चाहते हैं?\n\n📖 ${randomDesc}\n\n1️⃣ ज्ञान गंगा\n2️⃣ जीने की राह\n\n1 या 2 भेजें\n\n⬅️ पीछे: *0*` });
        return;
      }
      else book = autoBook(text);
      
      if (!book) {
        await sock.sendMessage(from, { text: `❌ कृपया 1, 2 या 3 भेजें\n_Please send 1, 2 or 3_` });
        return;
      }
      
      state.bookName = book;
      state.step = 'awaiting_language';
      userStates.set(from, state);
      
      const langs = CONFIG.BOOK_PDFS && CONFIG.BOOK_PDFS[book] ? Object.keys(CONFIG.BOOK_PDFS[book]) : ['हिंदी', 'English'];
      let langMenu = `✅ *${book}* चुना।\n✍️ लेखक: संत रामपाल जी महाराज\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nकिस भाषा में?\n_Which language?_\n\n`;
      langs.forEach((lang, i) => langMenu += `${i + 1}. ${lang}\n`);
      langMenu += `\nभाषा का नंबर भेजें`;
      
      await sock.sendMessage(from, { text: langMenu });
      state.availableLangs = langs;
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }
    
    // ==================== LANGUAGE SELECTION ====================
    if (state.step === 'awaiting_language') {
      const langIdx = parseInt(text) - 1;
      let langSelected;
      const langs = state.availableLangs || ['हिंदी', 'English'];
      
      if (!isNaN(langIdx) && langIdx >= 0 && langIdx < langs.length) {
        langSelected = langs[langIdx];
      } else {
        langSelected = langs.find(l => l && l.toLowerCase() === text.toLowerCase());
      }
      
      if (!langSelected) {
        await sock.sendMessage(from, { text: `❌ सही नंबर भेजें\n_Send correct number_\n\n⬅️ पीछे: *0*` });
        return;
      }
      
      state.language = langSelected;
      state.step = 'awaiting_name';
      userStates.set(from, state);
      
      await sock.sendMessage(from, { text: `✅ भाषा: *${langSelected}*\n\nअब अपना *पूरा नाम* भेजें:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n_Your Full Name:_\n\nउदाहरण: राज कुमार शर्मा` });
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }
    
    // ==================== NAME INPUT ====================
    if (state.step === 'awaiting_name') {
      if (text.length < 3) {
        await sock.sendMessage(from, { text: '❌ कम से कम 3 अक्षर का नाम\n_Minimum 3 characters_' });
        return;
      }
      
      state.name = text;
      state.step = 'confirm_name';
      userStates.set(from, state);
      
      await sock.sendMessage(from, { text: `नाम: *${text}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nक्या सही है?\n_Is it correct?_\n\n✅ सही है: *1* / "हां"\n❌ बदलना है: *2* / "नहीं"` });
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }
    
    // ==================== NAME CONFIRMATION ====================
    if (state.step === 'confirm_name') {
      if (isYes(text)) {
        state.step = 'awaiting_father';
        userStates.set(from, state);
        await sock.sendMessage(from, { text: `अब अपने *पिता का नाम* लिखें:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n_Father's Name:_\n\nउदाहरण: संतोष कुमार` });
        scheduleReminder(sock, from, state, sessionName, false);
        return;
      } else if (isNo(text)) {
        state.step = 'awaiting_name';
        userStates.set(from, state);
        await sock.sendMessage(from, { text: '✏️ अपना नाम फिर से लिखें:\n_Write your name again:_' });
        return;
      }
    }
    
    // ==================== FATHER NAME INPUT ====================
    if (state.step === 'awaiting_father') {
      if (text.length < 3) {
        await sock.sendMessage(from, { text: '❌ कम से कम 3 अक्षर\n_Minimum 3 characters_' });
        return;
      }
      
      state.father = text;
      state.step = 'confirm_father';
      userStates.set(from, state);
      
      await sock.sendMessage(from, { text: `पिता का नाम: *${text}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nक्या सही है?\n\n✅ *1* / "हां"\n❌ *2* / "नहीं"` });
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }
    
    // ==================== FATHER NAME CONFIRMATION ====================
    if (state.step === 'confirm_father') {
      if (isYes(text)) {
        state.step = 'awaiting_mobile';
        userStates.set(from, state);
        await sock.sendMessage(from, { text: `अब *मोबाइल नंबर* (10-digit) भेजें:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n_Mobile Number:_\n\nउदाहरण: 9876543210` });
        scheduleReminder(sock, from, state, sessionName, false);
        return;
      } else if (isNo(text)) {
        state.step = 'awaiting_father';
        userStates.set(from, state);
        await sock.sendMessage(from, { text: '✏️ पिता का नाम फिर से लिखें:' });
        return;
      }
    }
    
    // ==================== MOBILE INPUT ====================
    if (state.step === 'awaiting_mobile') {
      const cleaned = text.replace(/[^0-9]/g, '');
      if (cleaned.length !== 10) {
        await sock.sendMessage(from, { text: '❌ 10 अंक का मोबाइल नंबर चाहिए\n_Need 10-digit mobile number_' });
        return;
      }
      
      state.mobile = cleaned;
      state.step = 'confirm_mobile';
      userStates.set(from, state);
      
      await sock.sendMessage(from, { text: `मोबाइल: *${cleaned}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nक्या सही है?\n\n✅ *1*\n❌ *2*` });
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }
    
    // ==================== MOBILE CONFIRMATION ====================
    if (state.step === 'confirm_mobile') {
      if (isYes(text)) {
        state.step = 'awaiting_pincode';
        userStates.set(from, state);
        await sock.sendMessage(from, { text: `अब *पिनकोड* (6-digit) भेजें:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n_Pincode:_\n\nउदाहरण: 110001` });
        scheduleReminder(sock, from, state, sessionName, false);
        return;
      } else if (isNo(text)) {
        state.step = 'awaiting_mobile';
        userStates.set(from, state);
        await sock.sendMessage(from, { text: '✏️ मोबाइल नंबर फिर से भेजें:' });
        return;
      }
    }
    
    // ==================== PINCODE INPUT ====================
    if (state.step === 'awaiting_pincode') {
      const cleaned = text.replace(/[^0-9]/g, '');
      if (cleaned.length !== 6) {
        await sock.sendMessage(from, { text: '❌ 6 अंक का पिनकोड चाहिए\n_Need 6-digit pincode_' });
        return;
      }
      
      await sock.sendMessage(from, { text: '🔍 पिनकोड verify हो रहा है...\n_Verifying pincode..._' });
      
      const pinDetails = await fetchPinDetails(cleaned);
      
      if (!pinDetails || !pinDetails.district) {
        await sock.sendMessage(from, { text: '❌ Invalid pincode! कृपया सही पिनकोड भेजें:' });
        return;
      }
      
      state.pincode = cleaned;
      state.district = pinDetails.district;
      state.stateName = pinDetails.state;
      state.postOffices = pinDetails.postOffices || [];
      
      if (state.postOffices.length > 0) {
        state.step = 'awaiting_location_choice';
        userStates.set(from, state);
        
        let menu = `✅ पिनकोड: *${cleaned}*\n📍 जिला: *${pinDetails.district}*\n📍 राज्य: *${pinDetails.state}*\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📍 *अपना क्षेत्र चुनें:*\n\n`;
        
        state.postOffices.forEach((po, i) => {
          menu += `${i + 1}. ${po.name} (${po.branchType})\n`;
        });
        
        menu += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📮 नंबर भेजें`;
        
        await sock.sendMessage(from, { text: menu });
        scheduleReminder(sock, from, state, sessionName, false);
      } else {
        state.step = 'awaiting_full_address';
        userStates.set(from, state);
        
        await sock.sendMessage(from, { text: `✅ पिनकोड: *${cleaned}*\n📍 जिला: *${pinDetails.district}*\n📍 राज्य: *${pinDetails.state}*\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nअब अपना *पूरा पता* लिखें:\n\nजैसे: मकान नंबर, गली, गांव, landmark\n\n💡 जितना विस्तार से, उतना बेहतर!` });
        scheduleReminder(sock, from, state, sessionName, false);
      }
      return;
    }
    
    // ==================== LOCATION CHOICE ====================
    if (state.step === 'awaiting_location_choice') {
      const choice = parseInt(text);
      if (isNaN(choice) || choice < 1 || choice > state.postOffices.length) {
        await sock.sendMessage(from, { text: '❌ सही नंबर भेजें' });
        return;
      }
      
      state.selectedLocation = state.postOffices[choice - 1].name;
      state.step = 'awaiting_full_address';
      userStates.set(from, state);
      
      await sock.sendMessage(from, { text: `✅ क्षेत्र: *${state.selectedLocation}*\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nअब अपना *पूरा पता* लिखें:\n\nजैसे: मकान नंबर, गली, landmark\n\n💡 जितना विस्तार से, उतना बेहतर!` });
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }
    
    // ==================== FULL ADDRESS INPUT ====================
    if (state.step === 'awaiting_full_address') {
      if (text.length < 10) {
        await sock.sendMessage(from, { text: '❌ पता बहुत छोटा है! कृपया पूरा पता लिखें।' });
        return;
      }
      
      state.fullAddress = text;
      state.step = 'awaiting_confirmation';
      userStates.set(from, state);
      
      const confirmationMsg = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 *ऑर्डर कन्फर्मेशन*
_Order Confirmation_
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 *नाम:* ${state.name}
👨 *पिता:* ${state.father}
📞 *मोबाइल:* +91${state.mobile}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📚 *पुस्तक:* ${state.bookName}
🌐 *भाषा:* ${state.language}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📍 *पता:* ${state.fullAddress}
${state.selectedLocation ? `📮 *क्षेत्र:* ${state.selectedLocation}\n` : ''}📮 *पिनकोड:* ${state.pincode}
🏘️ *जिला:* ${state.district}
🗺️ *राज्य:* ${state.stateName}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
      
      await sock.sendMessage(from, { text: confirmationMsg });
      await sock.sendMessage(from, { text: `✅ *Order Done* के लिए: *1* / "yes" / "order"\n❌ *Cancel* के लिए: *2* / "no"\n\nअपना जवाब भेजें:` });
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }
    
    // ==================== FINAL CONFIRMATION ====================
    if (state.step === 'awaiting_confirmation') {
      if (isYes(text)) {
        await sock.sendMessage(from, { text: '⏳ आपका ऑर्डर process हो रहा है...\n_Processing your order..._' });
        
        // Prepare order data
        const orderData = {
          name: state.name,
          father: state.father,
          mobile: state.mobile,
          bookName: state.bookName,
          language: state.language,
          fullAddress: state.fullAddress,
          selectedLocation: state.selectedLocation || '',
          pincode: state.pincode,
          district: state.district,
          stateName: state.stateName,
          timestamp: new Date().toISOString(),
          sessionName: sessionName,
          userJID: from
        };
        
        // Save to database
        try {
          await saveOrder(orderData);
          console.log(`✅ Order saved: ${state.name}`);
        } catch (error) {
          console.error(`❌ Database save error: ${error.message}`);
        }
        
        // Forward to all destinations (Main Admin, Session Admin, Group)
        const forwardResult = await forwardOrderToAll(sock, sessionName, orderData);
        
        // Update statistics
        updateSessionStats(sessionName, 'order');
        updateOrderCount(sessionName);
        
        // Get PDF link if available
        const pdfLink = CONFIG.BOOK_PDFS && CONFIG.BOOK_PDFS[state.bookName] && CONFIG.BOOK_PDFS[state.bookName][state.language] 
          ? CONFIG.BOOK_PDFS[state.bookName][state.language] 
          : null;
        
        // Send confirmation to user
        let userConfirmation = `🎉 *ऑर्डर सफलतापूर्वक दर्ज!*
_Order Successfully Placed!_

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 *DELIVERY DETAILS*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 *डिलीवरी:* 7-21 दिन (निःशुल्क)
_Delivery: 7-21 days (Free)_

✅ *Order Confirmed*
🏠 *Address:* ${state.fullAddress}
📮 *Pincode:* ${state.pincode}
🏘️ *District:* ${state.district}
🗺️ *State:* ${state.stateName}
📱 *Mobile:* +91${state.mobile}`;
        
        if (pdfLink) {
          userConfirmation += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📖 *${state.bookName} (${state.language})* PDF:\n\n${pdfLink}\n\n📥 *Download करें और पढ़ें*\n_Download and read_`;
        }
        
        if (CONFIG.USER_GROUP_LINK) {
          userConfirmation += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📢 *हमारे WhatsApp ग्रुप से जुड़ें:*\n_Join our WhatsApp group:_\n\n${CONFIG.USER_GROUP_LINK}`;
        }
        
        userConfirmation += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🙏 *धन्यवाद!* _Thank you!_\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
        
        await sock.sendMessage(from, { text: userConfirmation });
        
        // Mark order as completed
        userOrderCompleted.set(from, Date.now());
        
        // Clear state
        userStates.delete(from);
        if (reminderTimeouts.has(from)) {
          clearTimeout(reminderTimeouts.get(from));
          reminderTimeouts.delete(from);
        }
        
        console.log(`✅ Order completed: ${state.name} | Session: ${sessionName}`);
        console.log(`📤 Forwarded to: Main Admin: ${forwardResult.mainAdmin ? '✅' : '❌'}, Session Admin: ${forwardResult.sessionAdmin ? '✅' : 'N/A'}, Group: ${forwardResult.group ? '✅' : '❌'}`);
        return;
        
      } else if (isNo(text)) {
        userStates.delete(from);
        if (reminderTimeouts.has(from)) {
          clearTimeout(reminderTimeouts.get(from));
          reminderTimeouts.delete(from);
        }
        
        await sock.sendMessage(from, { text: '❌ *Order Cancelled*\n\nकोई बात नहीं! आप फिर से order कर सकते हैं।\n_No problem! You can order again anytime._\n\n🙏 धन्यवाद!' });
        return;
      }
    }
    
    // ==================== PDF FLOW ====================
    if (state.step === 'awaiting_pdf_book') {
      let book = null;
      if (text === '1') book = 'ज्ञान गंगा';
      else if (text === '2') book = 'जीने की राह';
      else book = autoBook(text);
      
      if (!book) {
        await sock.sendMessage(from, { text: `❌ 1 या 2 भेजें\n_Send 1 or 2_` });
        return;
      }
      
      state.pdfBook = book;
      const langs = CONFIG.BOOK_PDFS && CONFIG.BOOK_PDFS[book] ? Object.keys(CONFIG.BOOK_PDFS[book]) : ['हिंदी', 'English'];
      let langMenu = `✅ *${book}* PDF\n\nकिस भाषा में?\n_Which language?_\n\n`;
      langs.forEach((lang, i) => langMenu += `${i + 1}. ${lang}\n`);
      langMenu += `\nभाषा का नंबर भेजें`;
      
      await sock.sendMessage(from, { text: langMenu });
      state.availablePdfLangs = langs;
      state.step = 'awaiting_pdf_language';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }
    
    if (state.step === 'awaiting_pdf_language') {
      const langIdx = parseInt(text) - 1;
      let langSelected;
      const langs = state.availablePdfLangs || ['हिंदी', 'English'];
      
      if (!isNaN(langIdx) && langIdx >= 0 && langIdx < langs.length) {
        langSelected = langs[langIdx];
      } else {
        langSelected = langs.find(l => l && l.toLowerCase() === text.toLowerCase());
      }
      
      if (!langSelected) {
        await sock.sendMessage(from, { text: `❌ सही नंबर भेजें` });
        return;
      }
      
      const pdfLink = CONFIG.BOOK_PDFS && CONFIG.BOOK_PDFS[state.pdfBook] && CONFIG.BOOK_PDFS[state.pdfBook][langSelected] 
        ? CONFIG.BOOK_PDFS[state.pdfBook][langSelected] 
        : '';
      
      if (pdfLink) {
        await sock.sendMessage(from, { text: `📖 *${state.pdfBook} (${langSelected})* PDF:\n\n${pdfLink}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📚 कृपया PDF देखें!\n_Please view the PDF!_\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nअगर निःशुल्क पुस्तक चाहिए:\n_If you want free physical book:_\n\n1️⃣ ज्ञान गंगा के लिए *1*\n2️⃣ जीने की राह के लिए *2*\n\nया पुस्तक का नाम लिखें` });
      }
      
      state.step = 'pdf_shown';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }
    
    if (state.step === 'pdf_shown') {
      let book = null;
      if (text === '1') book = 'ज्ञान गंगा';
      else if (text === '2') book = 'जीने की राह';
      else book = autoBook(text);
      
      if (!book) {
        await sock.sendMessage(from, { text: `कौनसी पुस्तक order करें?\n\n1️⃣ ज्ञान गंगा\n2️⃣ जीने की राह\n\n1 या 2 भेजें` });
        return;
      }
      
      state.bookName = book;
      state.step = 'awaiting_language';
      userStates.set(from, state);
      
      const langs = CONFIG.BOOK_PDFS && CONFIG.BOOK_PDFS[book] ? Object.keys(CONFIG.BOOK_PDFS[book]) : ['हिंदी', 'English'];
      let langMenu = `✅ *${book}*\n\nकिस भाषा में?\n\n`;
      langs.forEach((lang, i) => langMenu += `${i + 1}. ${lang}\n`);
      langMenu += `\nभाषा का नंबर भेजें`;
      
      await sock.sendMessage(from, { text: langMenu });
      state.availableLangs = langs;
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }
    
  } catch (error) {
    console.error(`❌ Message Handler Error: ${error.message}`);
    console.error(error.stack);
    
    // Send error notification to admin
    if (CONFIG.ADMIN?.JID) {
      try {
        await sock.sendMessage(CONFIG.ADMIN.JID, { 
          text: `❌ *Error in ${sessionName}*\n\nError: ${error.message}\n\nUser: ${from}\n\nTime: ${new Date().toLocaleString('hi-IN', { timeZone: 'Asia/Kolkata' })}` 
        });
      } catch (err) {
        console.error('Failed to send error notification to admin');
      }
    }
  }
}

// ========================= EXPORTS =========================
export default {
  handleMessage,
  getSessionStats,
  updateSessionStats
};