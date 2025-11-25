// ═══════════════════════════════════════════════════════════════
// 🚀 ENHANCED MESSAGE HANDLER v2.0 - PRODUCTION READY
// ═══════════════════════════════════════════════════════════════
// Features:
// ✅ Pincode → Post Office/Area Selection (User chooses from list)
// ✅ Manual Address Entry Option (User can type custom address)
// ✅ Bilingual Messages (Hindi + English)
// ✅ Error-Free with Deep Error Handling
// ✅ Admin Test Mode
// ✅ Duplicate Order Prevention
// ✅ PDF Preview System
// ✅ Confirmation at Every Step
// ✅ Back Navigation Support
// ✅ Image Rotation System
// ✅ Auto Reminder System (6 hours)
// ═══════════════════════════════════════════════════════════════

import { fetchPinDetails } from './utils/pincodeHelper.js';
import { saveOrder } from './utils/database.js';
import CONFIG from './config.js';
import fs from 'fs';
import { forwardOrder, sendOrderConfirmation } from './handlers/orderForwarding.js';

// ═══════════════════════════════════════════════════════════════
// 🗂️ STATE MANAGEMENT
// ═══════════════════════════════════════════════════════════════

const userStates = new Map();
const reminderTimeouts = new Map();
const userOrderCompleted = new Map();
const duplicateOrders = new Map();

// ═══════════════════════════════════════════════════════════════
// 📚 HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

const BOOK_DESCRIPTIONS = [
  "यह पुस्तक सच्चे आध्यात्मिक ज्ञान का खजाना है जो सभी जीवन समस्याओं को हल करती है। | This book contains the treasure of true spiritual knowledge that solves all life problems.",
  "पूर्ण परमात्मा को कैसे प्राप्त करें और मोक्ष पाएं, पवित्र शास्त्रों से प्रमाण सहित। | Learn how to attain God and salvation with evidence from holy scriptures.",
  "रोग-शोक, दुख-दारिद्र से छुटकारा पाने का सही मार्ग। | The right way to get rid of disease, sorrow, and poverty.",
  "ज्ञान गंगा! इस पुस्तक ने हजारों जीवन बदल दिए हैं। | Gyan Ganga! This book has changed thousands of lives!",
  "सच्चे सतगुरु की पहचान और पूर्ण मोक्ष का मार्ग। | True introduction of Satguru and path to complete salvation.",
  "वेद, गीता, कुरान, बाइबिल का असली अर्थ समझें। | Understand real meaning of Vedas, Geeta, Quran, Bible.",
  "जन्म-मृत्यु के चक्र से छूटने का एकमात्र उपाय। | The only way to escape the cycle of birth and death.",
  "84 लाख योनियों में भटकने से बचें, सतनाम की महिमा जानें। | Avoid wandering in 84 lakh life forms, know glory of Satnam.",
  "काल के जाल से कैसे निकलें? सतलोक कैसे जाएं? | How to escape Kaal's trap? How to reach Satlok?",
  "संत रामपाल जी महाराज ने मोक्ष का सही मार्ग दिखाया है। | Sant Rampal Ji Maharaj has shown the right path to salvation."
];

function getRandomDescription() {
  return BOOK_DESCRIPTIONS[Math.floor(Math.random() * BOOK_DESCRIPTIONS.length)];
}

function isYes(txt) {
  const yes = ['1','yes','ok','haan','ha','हाँ','हा','done','order','yes.','ok.','haan.','haa','y','Y','ha.','जी','ji','han','theek','theek hai','ठीक है'];
  return yes.includes(txt.trim().toLowerCase());
}

function isNo(txt) {
  const no = ['2','no','nahi','ना','नहीं','no.','nahi.','nope','n','N','nhi','cancel','गलत','galat','naa'];
  return no.includes(txt.trim().toLowerCase());
}

function isBack(txt) {
  const back = ['back','पीछे','peeche','0','बैक','वापस','vapas','go back'];
  return back.includes(txt.trim().toLowerCase());
}

function autoBook(text) {
  const low = text.trim().toLowerCase();
  if (low.includes('ganga') || low.includes('ज्ञान') || low.includes('gyan')) return 'ज्ञान गंगा';
  if (low.includes('jeene') || low.includes('rah') || low.includes('living') || low.includes('जीने') || low.includes('way')) return 'जीने की राह';
  return null;
}

function getRotatedImage(userJid) {
  try {
    const base = '/sdcard/DCIM/gyan ganga seva/';
    if (!fs.existsSync(base)) return null;
    
    const files = fs.readdirSync(base).filter(f => f.match(/\.(jpg|jpeg|png)$/i));
    if (!files.length) return null;
    
    const idx = Math.abs(userJid.split('').reduce((s, c) => s + c.charCodeAt(0), 0)) % files.length;
    return base + files[idx];
  } catch {
    return null;
  }
}

function scheduleReminder(sock, from, state, sessionName, isAdmin) {
  if (reminderTimeouts.has(from)) clearTimeout(reminderTimeouts.get(from));
  
  const reminderTime = 6 * 60 * 60 * 1000; // 6 hours
  
  reminderTimeouts.set(from, setTimeout(async () => {
    if (userStates.has(from)) {
      const imgPath = getRotatedImage(from);
      let remTxt = isAdmin 
        ? `⚠️ *Admin Test Mode Reminder*\n\nStill in Test-Mode? You are still in Test Mode!\nReply *exit* or *0* to leave.` 
        : `🙏 *अधूरा ऑर्डर रिमाइंडर | Incomplete Order Reminder*\n\nनमस्ते! आपका मुफ्त पुस्तक ऑर्डर लंबित है।\nYour free book order is pending.\n\nकृपया reply करें ताकि हम आपको पुस्तक भेज सकें।\nPlease reply so we can send you the book.`;
        
      if (imgPath && fs.existsSync(imgPath)) {
        await sock.sendMessage(from, { image: { url: imgPath }, caption: remTxt });
      } else {
        await sock.sendMessage(from, { text: remTxt });
      }
    }
  }, reminderTime));
}

async function resendMenu(sock, from, state) {
  const step = state.step;
  
  if (step === 'awaiting_book' || step === 'awaiting_pdf_book') {
    const randomDesc = getRandomDescription();
    const welcome = `🙏 *नमस्ते! Namaste!*\n🌳 *संत रामपाल जी महाराज की निःशुल्क पुस्तक सेवा*\n*Free Book Service by Sant Rampal Ji Maharaj*\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📚 हम आपको पूर्णतः निःशुल्क पुस्तक भेजना चाहते हैं, डिलीवरी भी फ्री है।\n_We want to send you a completely free book, delivery is also free, no charges at all._\n\n✨ ${randomDesc}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n❓ *कौन सी पुस्तक चाहिए?*\n*Which book would you like?*\n\n1️⃣ ज्ञान गंगा (Gyan Ganga)\n2️⃣ जीने की राह (Way of Living)\n3️⃣ PDF (पहले PDF देखना चाहते हैं? Want to see PDF first?)\n\n👇 *1, 2 या 3 (pdf) लिखकर भेजें*\n*Send 1, 2, or 3 (pdf)*`;
    
    await sock.sendMessage(from, { text: welcome });
    
  } else if (step === 'awaiting_language') {
    const bookName = state.bookName;
    const langs = state.availableLangs || (CONFIG.BOOK_PDFS[bookName] ? Object.keys(CONFIG.BOOK_PDFS[bookName]) : ['Hindi', 'English']);
    let langMenu = "";
    langs.forEach((lang, i) => langMenu += `${i + 1}. ${lang}\n`);
    
    await sock.sendMessage(from, { text: `📚 *${bookName}*\n\n❓ *किस भाषा में? | Which language?*\n\n${langMenu}\n👇 *भाषा नंबर भेजें | Send language number*` });
    
  } else if (step === 'awaiting_name') {
    await sock.sendMessage(from, { text: `✍️ *भाषा | Language:* ${state.language}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n👤 *आपका पूरा नाम? | Your Full Name?*\n\n_उदाहरण | Example: राहुल कुमार | Rahul Kumar_` });
    
  } else if (step === 'confirm_name') {
    await sock.sendMessage(from, { text: `✍️ *नाम | Name:* ${state.name}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n❓ *क्या यह सही है? | Is it correct?*\n\n1️⃣ हाँ (Yes)\n2️⃣ नहीं (No)` });
    
  } else if (step === 'awaiting_father') {
    await sock.sendMessage(from, { text: `👨‍🦳 *पिता का नाम? | Father's Name?*\n\n_उदाहरण | Example: रमेश सिंह | Ramesh Singh_` });
    
  } else if (step === 'confirm_father') {
    await sock.sendMessage(from, { text: `👨‍🦳 *पिता का नाम | Father's Name:* ${state.father}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n❓ *क्या यह सही है? | Is it correct?*\n\n1️⃣ हाँ (Yes)\n2️⃣ नहीं (No)` });
    
  } else if (step === 'awaiting_mobile') {
    await sock.sendMessage(from, { text: `📞 *10-अंकों का मोबाइल नंबर?*\n*10-digit Mobile Number?*\n\n_उदाहरण | Example: 9876543210_` });
    
  } else if (step === 'confirm_mobile') {
    await sock.sendMessage(from, { text: `📞 *मोबाइल | Mobile:* ${state.mobile}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n❓ *क्या यह सही है? | Is it correct?*\n\n1️⃣ हाँ (Yes)\n2️⃣ नहीं (No)` });
    
  } else if (step === 'awaiting_pincode') {
    await sock.sendMessage(from, { text: `📮 *6-अंकों का पिनकोड? | 6-digit Pincode?*\n\n_उदाहरण | Example: 110001_` });
    
  } else if (step === 'select_address_mode') {
    await sock.sendMessage(from, { text: `📮 *पिनकोड | Pincode:* ${state.pincode}\n📍 *जिला | District:* ${state.district}\n🗺️ *राज्य | State:* ${state.stateName}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n❓ *पता कैसे देना चाहते हैं?*\n*How would you like to provide address?*\n\n1️⃣ सूची से चुनें (Select from list of Post Offices)\n2️⃣ खुद टाइप करें (Type manually)\n\n👇 *1 या 2 भेजें | Send 1 or 2*` });
    
  } else if (step === 'awaiting_postoffice') {
    let menu = "";
    if (state.postOffices && state.postOffices.length) {
      state.postOffices.forEach((po, i) => menu += `${i + 1}. ${po}\n`);
    }
    await sock.sendMessage(from, { text: `📮 *${state.pincode}*\n📍 ${state.district}, ${state.stateName}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📬 *अपना पोस्ट ऑफिस/क्षेत्र चुनें*\n*Select your Post Office/Area*\n\n${menu}\n👇 *नंबर भेजें | Send number*` });
    
  } else if (step === 'awaiting_manual_address') {
    await sock.sendMessage(from, { text: `✍️ *अपना पूरा पता टाइप करें*\n*Type your complete address*\n\n_उदाहरण | Example:_\n_गांव/मोहल्ला, तहसील, जिला_\n_Village/Locality, Tehsil, District_\n\n👇 *पता लिखकर भेजें | Type and send address*` });
    
  } else if (step === 'confirm_manual_address') {
    await sock.sendMessage(from, { text: `📍 *आपका पता | Your Address:*\n${state.manualAddress}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n❓ *क्या यह सही है? | Is it correct?*\n\n1️⃣ हाँ (Yes)\n2️⃣ नहीं, फिर से लिखें (No, type again)` });
    
  } else if (step === 'awaiting_confirmation') {
    const addressDisplay = state.finalAddress || state.address || state.manualAddress;
    await sock.sendMessage(from, { text: `📋 *ऑर्डर की पुष्टि | Order Confirmation*\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n👤 *नाम | Name:* ${state.name}\n👨 *पिता | Father:* ${state.father}\n📞 *मोबाइल | Mobile:* +91${state.mobile}\n📚 *पुस्तक | Book:* ${state.bookName}\n🌐 *भाषा | Language:* ${state.language}\n📍 *पता | Address:* ${addressDisplay}\n📮 *पिनकोड | Pincode:* ${state.pincode}\n🏘️ *जिला | District:* ${state.district}\n🗺️ *राज्य | State:* ${state.stateName}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━` });
    await sock.sendMessage(from, { text: `✅ *ऑर्डर पक्का करें? | Confirm Order?*\n\n1️⃣ हाँ, ऑर्डर करें (Yes, Place Order)\n2️⃣ नहीं, रद्द करें (No, Cancel)\n\n👇 *1 या 2 भेजें | Send 1 or 2*` });
  }
}

// ═══════════════════════════════════════════════════════════════
// 🎯 MAIN MESSAGE HANDLER
// ═══════════════════════════════════════════════════════════════

export async function handleMessage(sock, msg, sessionName = 'WhatsApp') {
  try {
    const from = msg.key?.remoteJid || msg.key?.participant;
    if (!from) return;
    if (from.endsWith('@g.us')) return; // Ignore groups

    const textRaw = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
    const text = textRaw.trim();
    if (!text) return;

    const isAdmin = (CONFIG.ADMIN && from === CONFIG.ADMIN.JID);
    let state = userStates.get(from) || { step: 'start' };

    // ═════════════════════════════════════════════════════════════
    // 🛠️ ADMIN TEST MODE
    // ═════════════════════════════════════════════════════════════
    if (isAdmin) {
      let imgPath = getRotatedImage(from);
      
      if (!state.testMode) {
        if (text.toLowerCase() === 'test' || text === '1') {
          state.testMode = true;
          userStates.set(from, state);
          
          const caption = "🛠️ *टेस्ट मोड चालू | Test Mode Activated!*\n\nआपको अब यूजर जैसा मैसेज आएगा।\nYou will receive messages like a user.\n\n*0* या *exit* भेजकर बाहर निकलें।\nReply *0* or *exit* to leave.";
          
          if (imgPath && fs.existsSync(imgPath)) {
            await sock.sendMessage(from, { image: { url: imgPath }, caption });
          } else {
            await sock.sendMessage(from, { text: caption });
          }
          scheduleReminder(sock, from, state, sessionName, true);
          return;
        }
        if (text !== 'test' && text !== '1') return;
      }
      
      if (text.toLowerCase() === 'exit' || text === '0') {
        userStates.delete(from);
        if (reminderTimeouts.has(from)) clearTimeout(reminderTimeouts.get(from));
        await sock.sendMessage(from, { text: "🛠️ *टेस्ट मोड बंद | Test Mode Deactivated*\n\nExited Test Mode." });
        return;
      }
    }

    // ═════════════════════════════════════════════════════════════
    // 🔒 ORDER FREQUENCY CHECK (Duplicate Prevention)
    // ═════════════════════════════════════════════════════════════
    if (userOrderCompleted.has(from)) {
      const lastOrder = userOrderCompleted.get(from);
      const diff = Date.now() - lastOrder;
      const sixh = 6 * 60 * 60 * 1000;
      
      if (diff < sixh) {
        const imgPath = getRotatedImage(from);
        const hoursLeft = Math.ceil((sixh - diff) / (60 * 60 * 1000));
        const remindText = `🙏 *आपका ऑर्डर पहले से दर्ज है! | Your order is already placed!*\n\nआप ${hoursLeft} घंटे बाद नया ऑर्डर कर सकते हैं।\nYou can place new order after ${hoursLeft} hours.`;
        
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

    // ═════════════════════════════════════════════════════════════
    // 🎬 INITIAL GREETING / AUTO DETECT BOOK
    // ═════════════════════════════════════════════════════════════
    if (!userStates.has(from)) {
      let auto = autoBook(text);
      const imgPath = getRotatedImage(from);
      const randomDesc = getRandomDescription();
      
      let welcome = `🙏 *नमस्ते! Namaste!*\n🌳 *संत रामपाल जी महाराज की निःशुल्क पुस्तक सेवा*\n*Free Book Service by Sant Rampal Ji Maharaj*\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📚 हम आपको पूर्णतः निःशुल्क पुस्तक भेजना चाहते हैं, डिलीवरी भी फ्री है।\n_We want to send you a completely free book, delivery is also free, no charges at all._\n\n✨ ${randomDesc}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n❓ *कौन सी पुस्तक चाहिए?*\n*Which book would you like?*\n\n1️⃣ ज्ञान गंगा (Gyan Ganga)\n2️⃣ जीने की राह (Way of Living)\n3️⃣ PDF (पहले PDF देखना चाहते हैं? Want to see PDF first?)\n\n👇 *1, 2 या 3 (pdf) लिखकर भेजें*\n*Send 1, 2, or 3 (pdf)*`;

      if (text.toLowerCase() === 'pdf' || text === '3') {
        state.step = 'awaiting_pdf_book';
        userStates.set(from, state);
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

    state = userStates.get(from);
    state.lastActive = Date.now();
    userStates.set(from, state);

    // ═════════════════════════════════════════════════════════════
    // ◀️ BACK NAVIGATION
    // ═════════════════════════════════════════════════════════════
    if (isBack(text)) {
      const prev = {
        'awaiting_language': 'awaiting_book',
        'awaiting_name': 'awaiting_language',
        'confirm_name': 'awaiting_name',
        'awaiting_father': 'confirm_name',
        'confirm_father': 'awaiting_father',
        'awaiting_mobile': 'confirm_father',
        'confirm_mobile': 'awaiting_mobile',
        'awaiting_pincode': 'confirm_mobile',
        'select_address_mode': 'awaiting_pincode',
        'awaiting_postoffice': 'select_address_mode',
        'awaiting_manual_address': 'select_address_mode',
        'confirm_manual_address': 'awaiting_manual_address',
        'awaiting_confirmation': 'awaiting_postoffice',
        'awaiting_pdf_language': 'awaiting_pdf_book',
        'pdf_shown': 'awaiting_book'
      };
      
      if (prev[state.step]) {
        state.step = prev[state.step];
        userStates.set(from, state);
        await sock.sendMessage(from, { text: "🔙 *पिछला स्टेप फिर से | Previous step resumed!*" });
        await resendMenu(sock, from, state);
        return;
      }
    }

    // ═════════════════════════════════════════════════════════════
    // 📖 FLOW LOGIC - STEP BY STEP
    // ═════════════════════════════════════════════════════════════

    // ─────────────────────────────────────────────────────────────
    // 1️⃣ BOOK SELECTION
    // ─────────────────────────────────────────────────────────────
    if (state.step === 'awaiting_book') {
      let book = null;
      if (text === '1') book = 'ज्ञान गंगा';
      else if (text === '2') book = 'जीने की राह';
      else if (text.toLowerCase() === 'pdf' || text === '3') {
        state.step = 'awaiting_pdf_book';
        userStates.set(from, state);
        await sock.sendMessage(from, { text: `📄 *PDF मोड | PDF Mode*\n\n❓ *कौन सी पुस्तक का PDF देखना है?*\n*Which book's PDF would you like to see?*\n\n1️⃣ ज्ञान गंगा\n2️⃣ जीने की राह\n\n👇 *1 या 2 लिखकर भेजें | Send 1 or 2*` });
        return;
      } else {
        book = autoBook(text);
      }

      if (!book) {
        await sock.sendMessage(from, { text: `❌ *गलत विकल्प | Invalid Option*\n\n👇 कृपया भेजें | Please send:\n*1* - ज्ञान गंगा (Gyan Ganga)\n*2* - जीने की राह (Way of Living)\n*3* - PDF देखना चाहें (Want PDF)` });
        return;
      }

      state.bookName = book;
      const langs = CONFIG.BOOK_PDFS[book] ? Object.keys(CONFIG.BOOK_PDFS[book]) : ['Hindi', 'English'];
      
      let langMenu = "";
      langs.forEach((lang, i) => langMenu += `${i + 1}. ${lang}\n`);
      
      await sock.sendMessage(from, { text: `📚 *${book}*\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n❓ *किस भाषा में? | Which language?*\n\n${langMenu}\n👇 *भाषा नंबर भेजें | Send language number*` });
      
      state.availableLangs = langs;
      state.step = 'awaiting_language';
      userStates.set(from, state);
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // 2️⃣ LANGUAGE SELECTION
    // ─────────────────────────────────────────────────────────────
    if (state.step === 'awaiting_language') {
      const langIdx = parseInt(text) - 1;
      let langSelected = null;
      const langs = state.availableLangs || ['Hindi', 'English'];

      if (!isNaN(langIdx) && langIdx >= 0 && langIdx < langs.length) {
        langSelected = langs[langIdx];
      } else {
        langSelected = langs.find(l => l.toLowerCase().includes(text.toLowerCase()));
      }

      if (!langSelected) {
        await sock.sendMessage(from, { text: "❌ *गलत भाषा | Invalid Language*\n\n👇 कृपया सही नंबर भेजें\nPlease send correct number." });
        return;
      }

      state.language = langSelected;
      await sock.sendMessage(from, { text: `✍️ *भाषा | Language:* ${state.language}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n👤 *आपका पूरा नाम? | Your Full Name?*\n\n_उदाहरण | Example: राहुल कुमार | Rahul Kumar_` });
      state.step = 'awaiting_name';
      userStates.set(from, state);
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // 3️⃣ NAME ENTRY & CONFIRMATION
    // ─────────────────────────────────────────────────────────────
    if (state.step === 'awaiting_name') {
      if (text.length < 2) {
        await sock.sendMessage(from, { text: "❌ *बहुत छोटा नाम | Name too short*\n\nकृपया पूरा नाम लिखें | Please enter full name." });
        return;
      }
      state.name = text;
      await sock.sendMessage(from, { text: `✍️ *नाम | Name:* ${state.name}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n❓ *क्या यह सही है? | Is it correct?*\n\n1️⃣ हाँ (Yes)\n2️⃣ नहीं (No)` });
      state.step = 'confirm_name';
      userStates.set(from, state);
      return;
    }

    if (state.step === 'confirm_name') {
      if (isNo(text)) {
        state.step = 'awaiting_name';
        await sock.sendMessage(from, { text: "✍️ *नाम फिर से लिखें | Re-enter Name*\n\nकृपया अपना सही नाम लिखें।\nPlease enter your correct name." });
        userStates.set(from, state);
        return;
      }
      if (!isYes(text)) {
        await sock.sendMessage(from, { text: "❌ *कृपया 1 (हाँ) या 2 (नहीं) भेजें*\n*Please reply 1 (Yes) or 2 (No)*" });
        return;
      }
      await sock.sendMessage(from, { text: `👨‍🦳 *पिता का नाम? | Father's Name?*\n\n_उदाहरण | Example: रमेश सिंह | Ramesh Singh_` });
      state.step = 'awaiting_father';
      userStates.set(from, state);
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // 4️⃣ FATHER NAME ENTRY & CONFIRMATION
    // ─────────────────────────────────────────────────────────────
    if (state.step === 'awaiting_father') {
      if (text.length < 2) {
        await sock.sendMessage(from, { text: "❌ *बहुत छोटा नाम | Name too short*\n\nकृपया पूरा नाम लिखें | Please enter full name." });
        return;
      }
      state.father = text;
      await sock.sendMessage(from, { text: `👨‍🦳 *पिता का नाम | Father's Name:* ${state.father}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n❓ *क्या यह सही है? | Is it correct?*\n\n1️⃣ हाँ (Yes)\n2️⃣ नहीं (No)` });
      state.step = 'confirm_father';
      userStates.set(from, state);
      return;
    }

    if (state.step === 'confirm_father') {
      if (isNo(text)) {
        state.step = 'awaiting_father';
        await sock.sendMessage(from, { text: "👨‍🦳 *पिता का नाम फिर से | Re-enter Father's Name*" });
        userStates.set(from, state);
        return;
      }
      if (!isYes(text)) {
        await sock.sendMessage(from, { text: "❌ *कृपया 1 (हाँ) या 2 (नहीं) भेजें*\n*Please reply 1 (Yes) or 2 (No)*" });
        return;
      }
      await sock.sendMessage(from, { text: `📞 *10-अंकों का मोबाइल नंबर?*\n*10-digit Mobile Number?*\n\n_उदाहरण | Example: 9876543210_` });
      state.step = 'awaiting_mobile';
      userStates.set(from, state);
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // 5️⃣ MOBILE NUMBER ENTRY & CONFIRMATION
    // ─────────────────────────────────────────────────────────────
    if (state.step === 'awaiting_mobile') {
      const mob = text.replace(/[^0-9]/g, '');
      if (mob.length !== 10) {
        await sock.sendMessage(from, { text: "❌ *गलत नंबर | Invalid Number*\n\nकृपया 10 अंकों का मोबाइल नंबर भेजें।\n_Please send 10-digit mobile number._" });
        return;
      }

      // Duplicate Check
      const dupKey = `${state.name.toLowerCase().trim()}|${mob}`;
      if (duplicateOrders.has(dupKey)) {
        await sock.sendMessage(from, { text: "⚠️ *पहले से ऑर्डर किया हुआ | Already Ordered*\n\nआपने इस नाम और नंबर से पहले ही ऑर्डर कर दिया है।\n_You have already placed an order with this name and number._\n\nधन्यवाद! 🙏" });
        userStates.delete(from);
        return;
      }

      state.mobile = mob;
      await sock.sendMessage(from, { text: `📞 *मोबाइल | Mobile:* ${state.mobile}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n❓ *क्या यह सही है? | Is it correct?*\n\n1️⃣ हाँ (Yes)\n2️⃣ नहीं (No)` });
      state.step = 'confirm_mobile';
      userStates.set(from, state);
      return;
    }

    if (state.step === 'confirm_mobile') {
      if (isNo(text)) {
        state.step = 'awaiting_mobile';
        await sock.sendMessage(from, { text: "📞 *मोबाइल नंबर फिर से | Re-enter Mobile Number*" });
        userStates.set(from, state);
        return;
      }
      if (!isYes(text)) {
        await sock.sendMessage(from, { text: "❌ *कृपया 1 (हाँ) या 2 (नहीं) भेजें*\n*Please reply 1 (Yes) or 2 (No)*" });
        return;
      }
      await sock.sendMessage(from, { text: `📮 *6-अंकों का पिनकोड? | 6-digit Pincode?*\n\n_उदाहरण | Example: 110001_` });
      state.step = 'awaiting_pincode';
      userStates.set(from, state);
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // 6️⃣ PINCODE ENTRY & FETCH POST OFFICES
    // ─────────────────────────────────────────────────────────────
    if (state.step === 'awaiting_pincode') {
      const pin = text.replace(/[^0-9]/g, '');
      if (pin.length !== 6) {
        await sock.sendMessage(from, { text: "❌ *गलत पिनकोड | Invalid Pincode*\n\nकृपया 6 अंकों का पिनकोड भेजें।\n_Enter 6-digit pincode._" });
        return;
      }

      // Loading message
      await sock.sendMessage(from, { text: `⏳ *कृपया प्रतीक्षा करें...*\n*Please wait...*\n\nपिनकोड ${pin} की जानकारी ला रहे हैं...\nFetching details for pincode ${pin}...` });

      // Fetch pincode details with retry logic
      let pinInfo = null;
      for (let attempt = 0; attempt < 10; attempt++) {
        pinInfo = await fetchPinDetails(pin);
        if (pinInfo && pinInfo.success && pinInfo.postOffices && pinInfo.postOffices.length) {
          break;
        }
        await new Promise(r => setTimeout(r, 900));
      }

      if (!pinInfo || !pinInfo.postOffices || !pinInfo.postOffices.length) {
        await sock.sendMessage(from, { text: "❌ *पिनकोड नहीं मिला | Pincode Not Found*\n\nकृपया सही पिनकोड भेजें या पुनः प्रयास करें।\nPlease send correct pincode or try again." });
        return;
      }

      state.pincode = pin;
      state.district = pinInfo.district;
      state.stateName = pinInfo.state;
      state.postOffices = pinInfo.postOffices;

      // Show address mode selection
      await sock.sendMessage(from, { text: `📮 *पिनकोड | Pincode:* ${state.pincode}\n📍 *जिला | District:* ${state.district}\n🗺️ *राज्य | State:* ${state.stateName}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n❓ *पता कैसे देना चाहते हैं?*\n*How would you like to provide address?*\n\n1️⃣ सूची से चुनें (Select from list of ${state.postOffices.length} Post Offices)\n2️⃣ खुद टाइप करें (Type manually)\n\n👇 *1 या 2 भेजें | Send 1 or 2*` });
      
      state.step = 'select_address_mode';
      userStates.set(from, state);
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // 7️⃣ ADDRESS MODE SELECTION (List or Manual)
    // ─────────────────────────────────────────────────────────────
    if (state.step === 'select_address_mode') {
      if (text === '1') {
        // Show Post Office List
        let menu = "";
        if (state.postOffices && state.postOffices.length) {
          state.postOffices.forEach((po, i) => menu += `${i + 1}. ${po}\n`);
        }
        await sock.sendMessage(from, { text: `📮 *${state.pincode}*\n📍 ${state.district}, ${state.stateName}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📬 *अपना पोस्ट ऑफिस/क्षेत्र चुनें*\n*Select your Post Office/Area*\n\n${menu}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n👇 *नंबर भेजें | Send number*\n\n_या 0 भेजकर पीछे जाएं | Or send 0 to go back_` });
        state.step = 'awaiting_postoffice';
        userStates.set(from, state);
        return;
      } else if (text === '2') {
        // Manual Address Entry
        await sock.sendMessage(from, { text: `✍️ *अपना पूरा पता टाइप करें*\n*Type your complete address*\n\n_उदाहरण | Example:_\n_गांव रामपुर, तहसील आगरा, जिला आगरा_\n_Village Rampur, Tehsil Agra, District Agra_\n\n👇 *पता लिखकर भेजें | Type and send address*` });
        state.step = 'awaiting_manual_address';
        userStates.set(from, state);
        return;
      } else {
        await sock.sendMessage(from, { text: "❌ *गलत विकल्प | Invalid Option*\n\n👇 कृपया भेजें:\n*1* - सूची से चुनें (Select from list)\n*2* - खुद टाइप करें (Type manually)" });
        return;
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 8️⃣ POST OFFICE SELECTION (From List)
    // ─────────────────────────────────────────────────────────────
    if (state.step === 'awaiting_postoffice') {
      let sel = null;
      const idx = parseInt(text) - 1;
      
      if (!isNaN(idx) && idx >= 0 && state.postOffices && idx < state.postOffices.length) {
        sel = state.postOffices[idx];
      } else if (state.postOffices) {
        const match = state.postOffices.find(po => po.toLowerCase().includes(text.toLowerCase()));
        if (match) sel = match;
      }

      if (!sel) {
        await sock.sendMessage(from, { text: "❌ *गलत चयन | Invalid Selection*\n\nकृपया लिस्ट से सही नंबर चुनें।\nPlease select correct number from list." });
        return;
      }

      state.finalAddress = sel;
      state.address = sel;
      
      // Show final confirmation
      await sock.sendMessage(from, { text: `📋 *ऑर्डर की पुष्टि | Order Confirmation*\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n👤 *नाम | Name:* ${state.name}\n👨 *पिता | Father:* ${state.father}\n📞 *मोबाइल | Mobile:* +91${state.mobile}\n📚 *पुस्तक | Book:* ${state.bookName}\n🌐 *भाषा | Language:* ${state.language}\n📍 *पता | Address:* ${state.finalAddress}\n📮 *पिनकोड | Pincode:* ${state.pincode}\n🏘️ *जिला | District:* ${state.district}\n🗺️ *राज्य | State:* ${state.stateName}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━` });
      await sock.sendMessage(from, { text: `✅ *ऑर्डर पक्का करें? | Confirm Order?*\n\n1️⃣ हाँ, ऑर्डर करें (Yes, Place Order)\n2️⃣ नहीं, रद्द करें (No, Cancel)\n\n👇 *1 या 2 भेजें | Send 1 or 2*` });
      
      state.step = 'awaiting_confirmation';
      userStates.set(from, state);
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // 9️⃣ MANUAL ADDRESS ENTRY
    // ─────────────────────────────────────────────────────────────
    if (state.step === 'awaiting_manual_address') {
      if (text.length < 5) {
        await sock.sendMessage(from, { text: "❌ *पता बहुत छोटा | Address too short*\n\nकृपया पूरा पता लिखें।\nPlease enter complete address." });
        return;
      }
      
      state.manualAddress = text;
      await sock.sendMessage(from, { text: `📍 *आपका पता | Your Address:*\n${state.manualAddress}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n❓ *क्या यह सही है? | Is it correct?*\n\n1️⃣ हाँ (Yes)\n2️⃣ नहीं, फिर से लिखें (No, type again)` });
      state.step = 'confirm_manual_address';
      userStates.set(from, state);
      return;
    }

    if (state.step === 'confirm_manual_address') {
      if (isNo(text)) {
        state.step = 'awaiting_manual_address';
        await sock.sendMessage(from, { text: "✍️ *पता फिर से लिखें | Re-enter Address*\n\nकृपया अपना सही पता लिखें।\nPlease enter your correct address." });
        userStates.set(from, state);
        return;
      }
      if (!isYes(text)) {
        await sock.sendMessage(from, { text: "❌ *कृपया 1 (हाँ) या 2 (नहीं) भेजें*\n*Please reply 1 (Yes) or 2 (No)*" });
        return;
      }

      state.finalAddress = state.manualAddress;
      state.address = state.manualAddress;
      
      // Show final confirmation
      await sock.sendMessage(from, { text: `📋 *ऑर्डर की पुष्टि | Order Confirmation*\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n👤 *नाम | Name:* ${state.name}\n👨 *पिता | Father:* ${state.father}\n📞 *मोबाइल | Mobile:* +91${state.mobile}\n📚 *पुस्तक | Book:* ${state.bookName}\n🌐 *भाषा | Language:* ${state.language}\n📍 *पता | Address:* ${state.finalAddress}\n📮 *पिनकोड | Pincode:* ${state.pincode}\n🏘️ *जिला | District:* ${state.district}\n🗺️ *राज्य | State:* ${state.stateName}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━` });
      await sock.sendMessage(from, { text: `✅ *ऑर्डर पक्का करें? | Confirm Order?*\n\n1️⃣ हाँ, ऑर्डर करें (Yes, Place Order)\n2️⃣ नहीं, रद्द करें (No, Cancel)\n\n👇 *1 या 2 भेजें | Send 1 or 2*` });
      
      state.step = 'awaiting_confirmation';
      userStates.set(from, state);
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // 🔟 FINAL ORDER CONFIRMATION
    // ─────────────────────────────────────────────────────────────
    if (state.step === 'awaiting_confirmation') {
      if (isNo(text)) {
        await sock.sendMessage(from, { text: "❌ *ऑर्डर रद्द | Order Cancelled*\n\nआपका ऑर्डर रद्द कर दिया गया है।\nYour order has been cancelled." });
        userStates.delete(from);
        if (reminderTimeouts.has(from)) clearTimeout(reminderTimeouts.get(from));
        return;
      }

      if (!isYes(text)) {
        await sock.sendMessage(from, { text: "❌ *कृपया 1 (हाँ) या 2 (नहीं) भेजें*\n*Please reply 1 (Yes) or 2 (No)*" });
        return;
      }

      // ═══════════════════════════════════════════════════════════
      // 💾 SAVE ORDER
      // ═══════════════════════════════════════════════════════════
      const orderData = {
        name: state.name,
        father: state.father,
        mobile: state.mobile,
        bookName: state.bookName,
        language: state.language,
        address: state.finalAddress || state.address || state.manualAddress,
        pincode: state.pincode,
        district: state.district,
        stateName: state.stateName,
        whatsapp: from,
        timestamp: new Date().toISOString(),
        sessionName: sessionName
      };

      await saveOrder(orderData);

      const dupKey = `${state.name.toLowerCase().trim()}|${state.mobile}`;
      duplicateOrders.set(dupKey, Date.now());

      // PDF Link
      const pdfLink = CONFIG.BOOK_PDFS[state.bookName]?.[state.language];

      // ═══════════════════════════════════════════════════════════
      // 📨 SEND CONFIRMATIONS & FORWARD ORDER
      // ═══════════════════════════════════════════════════════════
      
      // 1. Send User Confirmation (with PDF & Group Link)
      await sendOrderConfirmation(sock, from, orderData, pdfLink);

      // 2. Forward Order to Admins & Group (Session-aware)
      await forwardOrder(sock, sessionName, orderData);

      // ═══════════════════════════════════════════════════════════
      // 🧹 CLEANUP
      // ═══════════════════════════════════════════════════════════
      userOrderCompleted.set(from, Date.now());
      userStates.delete(from);
      if (reminderTimeouts.has(from)) clearTimeout(reminderTimeouts.get(from));
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // 📄 PDF FLOW (if user selected PDF initially)
    // ─────────────────────────────────────────────────────────────
    if (state.step === 'awaiting_pdf_book') {
      let book = null;
      if (text === '1') book = 'ज्ञान गंगा';
      else if (text === '2') book = 'जीने की राह';
      else book = autoBook(text);

      if (!book) {
        await sock.sendMessage(from, { text: "❌ *गलत विकल्प | Invalid Option*\n\n👇 कृपया भेजें:\n*1* - ज्ञान गंगा\n*2* - जीने की राह" });
        return;
      }
      
      state.pdfBook = book;
      const langs = CONFIG.BOOK_PDFS[book] ? Object.keys(CONFIG.BOOK_PDFS[book]) : ['Hindi', 'English'];
      let langMenu = "";
      langs.forEach((lang, i) => langMenu += `${i + 1}. ${lang}\n`);
      
      await sock.sendMessage(from, { text: `📄 *${book} PDF*\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n❓ *भाषा चुनें | Select Language:*\n\n${langMenu}\n👇 *नंबर भेजें | Send number*` });
      state.availablePdfLangs = langs;
      state.step = 'awaiting_pdf_language';
      userStates.set(from, state);
      return;
    }

    if (state.step === 'awaiting_pdf_language') {
      const langIdx = parseInt(text) - 1;
      let langSelected = null;
      const langs = state.availablePdfLangs;
      
      if (!isNaN(langIdx) && langIdx >= 0 && langIdx < langs.length) {
        langSelected = langs[langIdx];
      }
      
      if (!langSelected) {
        await sock.sendMessage(from, { text: "❌ *गलत नंबर | Invalid number*\n\nकृपया सही नंबर भेजें।\nPlease send correct number." });
        return;
      }
      
      const pdfLink = CONFIG.BOOK_PDFS[state.pdfBook]?.[langSelected];
      await sock.sendMessage(from, { text: `📄 *${state.pdfBook} (${langSelected})*\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n🔗 *PDF Link:*\n${pdfLink}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📚 *निःशुल्क पुस्तक मंगवाने के लिए 1 भेजें*\n*Send 1 to order free physical book*` });
      
      state.step = 'pdf_shown';
      userStates.set(from, state);
      return;
    }
    
    if (state.step === 'pdf_shown') {
      if (text === '1') {
        state.step = 'awaiting_book';
        userStates.set(from, state);
        await resendMenu(sock, from, state);
      }
      return;
    }

  } catch (err) {
    console.error("❌ Message Handler Error:", err);
    console.error("Stack:", err.stack);
    try {
      const from = msg.key?.remoteJid;
      if (from) {
        await sock.sendMessage(from, { 
          text: "⚠️ *त्रुटि | Error occurred!*\n\nकृपया पुनः प्रयास करें।\nPlease try again.\n\nयदि समस्या बनी रहे तो कृपया संपर्क करें:\nIf problem persists, please contact:\n+91 8586003472" 
        });
      }
    } catch {}
  }
}

// ═══════════════════════════════════════════════════════════════
// 📊 EXPORT STATS (For Dashboard)
// ═══════════════════════════════════════════════════════════════

export function getHandlerStats() {
  return {
    activeUsers: userStates.size,
    activeReminders: reminderTimeouts.size,
    completedOrders: userOrderCompleted.size,
    duplicatePrevented: duplicateOrders.size
  };
}

export function clearUserState(jid) {
  userStates.delete(jid);
  if (reminderTimeouts.has(jid)) {
    clearTimeout(reminderTimeouts.get(jid));
    reminderTimeouts.delete(jid);
  }
}
