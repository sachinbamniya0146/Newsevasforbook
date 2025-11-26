import { fetchPinDetails } from '../utils/pincodeHelper.js';
import { saveOrder } from '../utils/database.js';
import CONFIG from '../config.js';
import fs from 'fs';
import { forwardOrder, sendOrderConfirmation } from '../handlers/orderForwarding.js';

const userStates = new Map();
const reminderTimeouts = new Map();
const userOrderCompleted = new Map();
const duplicateOrders = new Map();

// --- HELPER FUNCTIONS (Preserved) ---

const BOOK_DESCRIPTIONS = [
  "This book contains the treasure of true spiritual knowledge that solves all life problems.",
  "Learn how to attain God and salvation with evidence from holy scriptures.",
  "रोग-शोक, दुख-दारिद्र से छुटकारा पाने का सही मार्ग इस पुस्तक में है।",
  "जीने की राह - The right way to get rid of all troubles - disease, poverty, sorrow - is in this book.",
  "ज्ञान गंगा! This book has changed thousands of lives! Full of spiritual knowledge.",
  "True introduction of Supreme God Kabir and path to complete salvation in this book.",
  "संत कौन? साधना क्या? How to identify true saint? What is true worship? Learn in this book.",
  "वेद, गीता, कुरान, बाइबिल का असली अर्थ समझें।",
  "Understand real meaning of Vedas, Geeta, Quran, Bible. Essence of all religions is one.",
  "जन्म-मृत्यु के चक्र से छूटने का एकमात्र उपाय इस पुस्तक में बताया गया है।",
  "84 लाख योनियों में भटकने से बचें। सतनाम और सारनाम की महिमा जानें।",
  "काल के जाल से कैसे निकलें? सतलोक कैसे जाएं? पूरी जानकारी।",
  "Sant Rampal Ji Maharaj has shown the right path to salvation in this book.",
  "जीने की कला - This book teaches the right art of living that gives peace and happiness.",
  "धर्म के नाम पर पाखंड का पर्दाफाश! जानें सच्चा धर्म क्या है।",
  "True meaning of Kabir Saheb's nectar words explained in this book.",
  "दुख, दर्द, चिंता से हमेशा के लिए छुटकारा चाहिए? यह पुस्तक पढ़ें।",
  "Taking refuge of true Satguru washes away all sins. Learn how.",
  "भक्ति की सही विधि नहीं पता? step-by-step explained in this book.",
  "पूर्ण परमात्मा कौन है? Who is complete God? Understand difference in this book.",
  "सृष्टि रचना का असली रहस्य जो आपको कहीं और नहीं मिलेगा।",
  "मनुष्य जीवन का असली उद्देश्य क्या है? पैसा कमाना या मोक्ष? जानें।",
  "स्वर्ग-नरक से परे सतलोक है जहां कोई दुख नहीं। कैसे जाएं? पढ़ें पुस्तक।",
  "Everyone is sad in Kaal Lok. There is eternal happiness in Satlok. Know difference.",
  "There is huge difference between God and Supreme God. Understand in this book.",
  "राम, कृष्ण के अवतारों का असली रहस्य क्या है? Complete info in book.",
  "पाप-पुण्य का सिद्धांत और कर्म का विधान सही तरीके से समझाया गया है।",
  "गीता, वेद, कुरान के गूढ़ रहस्य इस पुस्तक में खोले गए हैं।",
  "Miracles happen in life through true worship. Explained with examples.",
  "Essence of Garibdas Ji's nectar words given in this book.",
  "नानक देव जी द्वारा दिया गया सत्य ज्ञान इस पुस्तक में विस्तार से है।",
  "This is the only way to attain salvation in this dark age. Don't waste time.",
  "Thousands changed their lives after reading Tatvagyan. You can change too.",
  "Even impossible becomes possible by grace of Satguru. Have faith.",
  "Way to attain liberation while alive explained in this book. Don't wait for death.",
  "सच्चे धर्म और पाखंड में बड़ा अंतर है। सावधान रहें, धोखा न खाएं।",
  "Understand true relationship between soul and Supreme Soul. We are all His parts.",
  "Various practices of devotion path explained. Do according to your convenience.",
  "Life of Sant Rampal Ji Maharaj is inspiring. Change your life after reading.",
  "Millions took Naam initiation after reading this book and became happy.",
  "Complete solution to spiritual curiosity in this book. Answers to all questions.",
  "This book is priceless for your family. Make everyone read.",
  "True knowledge gives both success and peace in life.",
  "स्कूल-कॉलेज में जो ज्ञान नहीं मिलेगा, वह इस पुस्तक में है।",
  "Identifying complete saint is very important. Beware of wrong guru.",
  "नाम दीक्षा लेने से सभी पाप नष्ट होते हैं। निःशुल्क है, जल्दी लें।",
  "मृत्यु के बाद क्या होता है? हम कहां जाते हैं? जानकारी इस पुस्तक में।",
  "गरीबी, बीमारी से परेशान हैं? भक्ति का सही मार्ग जानें।",
  "गृह क्लेश हो रहा है? शांति चाहिए? यह पुस्तक पढ़ें।",
  "मन की शांति कैसे मिले? तनाव कैसे दूर हो? समाधान पुस्तक में।",
  "सच्चा सुख क्या है? धन-दौलत से नहीं मिलता। सही रास्ता जानें।",
  "भगवान को कैसे पाएं? प्रार्थना-ibadat कैसे करें? पढ़ें पुस्तक।",
  "यह पुस्तक 100% निःशुल्क है। कोई चार्ज नहीं। होम डिलीवरी फ्री।",
  "Gyan Ganga book has 1000+ pages of spiritual knowledge. Priceless.",
  "Way of Living book can be read by people of all religions. For everyone.",
  "अंधविश्वास नहीं, विज्ञान है। प्रमाण के साथ ज्ञान है इस पुस्तक में।",
  "Guarantee of attaining salvation is with method explained in this book.",
  "Time is very less. Human life is rare. Order book quickly.",
  "Your family's welfare will happen from this book. Give to everyone.",
  "This book is life-changing. Must read once.",
  "सत्य धर्म, सत्य भक्ति, सत्य ज्ञान - सब कुछ इस पुस्तक में।",
  "Millions worldwide have adopted this knowledge. You adopt too."
];

function getRandomDescription() {
  return BOOK_DESCRIPTIONS[Math.floor(Math.random() * BOOK_DESCRIPTIONS.length)];
}

function isYes(txt) {
  const yes = ['1','yes','ok','haan','ha','हाँ','done','order','yes.','ok.','haan.','haa','y','Y','ha.','जी','ji','han','theek'];
  return yes.includes(txt.trim().toLowerCase());
}

function isNo(txt) {
  const no = ['2','no','nahi','ना','नहीं','no.','nahi.','nope','नहीं','n','N','nhi','cancel','गलत','galat'];
  return no.includes(txt.trim().toLowerCase());
}

function isBack(txt) {
  const back = ['back','पीछे','peeche','0','बैक','वापस','vapas'];
  return back.includes(txt.trim().toLowerCase());
}

function autoBook(text) {
  const low = text.trim().toLowerCase();
  if (low.includes('ganga') || low.includes('ज्ञान')) return 'ज्ञान गंगा';
  if (low.includes('jeene') || low.includes('rah') || low.includes('living') || low.includes('जीने')) return 'जीने की राह';
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
        ? "⚠️ *Admin Test Mode Reminder*\n\nStill in Test-Mode? You are still in Test Mode!\nReply *exit* or *0* to leave." 
        : "🙏 *Incomplete Order Reminder*\n\nनमस्ते! Your free book order is pending.\n\nकृपया reply करें ताकि हम आपको पुस्तक भेज सकें।";
        
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
    const welcome = `🙏 *Namaste!*
🌳 *Free Book Service by Sant Rampal Ji Maharaj*

📚 हम आपको पूर्णतः निःशुल्क पुस्तक भेजना चाहते हैं, डिलीवरी भी फ्री है।
_We want to send you a completely free book, delivery is also free, no charges at all._

✨ ${randomDesc}

❓ *कौन सी पुस्तक चाहिए?* _Which book would you like?_

1️⃣ ज्ञान गंगा (Gyan Ganga)
2️⃣ जीने की राह (Way of Living)
3️⃣ PDF (Want to see PDF first?)

👇 *1, 2 या 3 (pdf) लिखकर भेजें*`;
    
    await sock.sendMessage(from, { text: welcome });
    
  } else if (step === 'awaiting_language') {
    const bookName = state.bookName;
    const langs = state.availableLangs || (CONFIG.BOOK_PDFS[bookName] ? Object.keys(CONFIG.BOOK_PDFS[bookName]) : ['Hindi', 'English']);
    let langMenu = "";
    langs.forEach((lang, i) => langMenu += `${i + 1}. ${lang}\n`);
    
    await sock.sendMessage(from, { text: `📚 *${bookName}*\n\n❓ *किस भाषा में?* _Which language?_\n\n${langMenu}\n👇 *Send language number*` });
    
  } else if (step === 'awaiting_name') {
    await sock.sendMessage(from, { text: `✍️ *Language:* ${state.language}\n\nआपका पूरा नाम? (Your Full Name)\n\n_Example: Rahul Kumar_` });
    
  } else if (step === 'confirm_name') {
    await sock.sendMessage(from, { text: `✍️ *Name:* ${state.name}\n\nक्या यह सही है? (Is it correct?)\n\n1️⃣ हाँ (Yes)\n2️⃣ नहीं (No)` });
    
  } else if (step === 'awaiting_father') {
    await sock.sendMessage(from, { text: "👨‍🦳 पिता का नाम? (Father's Name)\n\n_Example: Ramesh Singh_" });
    
  } else if (step === 'confirm_father') {
    await sock.sendMessage(from, { text: `👨‍🦳 *Father's Name:* ${state.father}\n\nक्या यह सही है? (Is it correct?)\n\n1️⃣ हाँ (Yes)\n2️⃣ नहीं (No)` });
    
  } else if (step === 'awaiting_mobile') {
    await sock.sendMessage(from, { text: "📞 10-अंकों का मोबाइल नंबर?\n(10-digit Mobile Number)\n\n_Example: 9876543210_" });
    
  } else if (step === 'confirm_mobile') {
    await sock.sendMessage(from, { text: `📞 *Mobile:* ${state.mobile}\n\nक्या यह सही है? (Is it correct?)\n\n1️⃣ हाँ (Yes)\n2️⃣ नहीं (No)` });
    
  } else if (step === 'awaiting_pincode') {
    await sock.sendMessage(from, { text: "📮 6-अंकों का पिनकोड?\n(6-digit Pincode)\n\n_Example: 110001_" });
    
  } else if (step === 'awaiting_village') {
    let menu = "";
    if (state.villages && state.villages.length) {
      state.villages.forEach((v, i) => menu += `${i + 1}. ${v.split(',')[0]}\n`);
    }
    await sock.sendMessage(from, { text: `📮 *${state.pincode}*\n📍 ${state.district}, ${state.stateName}\n\nअपना गाँव/शहर चुनें...\nSelect your village/city...\n\n${menu}\n👇 *Send number*` });
    
  } else if (step === 'awaiting_confirmation') {
    await sock.sendMessage(from, { text: `📋 *Order Confirmation*\n\n👤 Name: ${state.name}\n👨 Father: ${state.father}\n📞 Mobile: +91${state.mobile}\n📚 Book: ${state.bookName}\n🌐 Language: ${state.language}\n📍 Address: ${state.address}\n📮 Pincode: ${state.pincode}\n🏘️ District: ${state.district}\n🗺️ State: ${state.stateName}` });
    await sock.sendMessage(from, { text: "✅ *Order Done?*\n\n1️⃣ हाँ (Yes, order done)\n2️⃣ नहीं (No, cancel)\n\n👇 *Send your reply*" });
  }
}

// --- MAIN HANDLER ---

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

    // --- ADMIN TEST MODE ---
    if (isAdmin) {
      let imgPath = getRotatedImage(from);
      
      if (!state.testMode) {
        if (text.toLowerCase() === 'test' || text === '1') {
          state.testMode = true;
          userStates.set(from, state);
          
          const caption = "🛠️ *Test Mode activated for admin!*\n\nआपको अब यूजर जैसा मैसेज आएगा। (You will receive messages like a user)\nReply *0* or *exit* to leave.";
          
          if (imgPath && fs.existsSync(imgPath)) {
            await sock.sendMessage(from, { image: { url: imgPath }, caption });
          } else {
            await sock.sendMessage(from, { text: caption });
          }
          scheduleReminder(sock, from, state, sessionName, true);
          return;
        }
        // Only respond to specific commands if not in test mode
        if (text !== 'test' && text !== '1') return;
      }
      
      if (text.toLowerCase() === 'exit' || text === '0') {
        userStates.delete(from);
        if (reminderTimeouts.has(from)) clearTimeout(reminderTimeouts.get(from));
        await sock.sendMessage(from, { text: "🛠️ *Test Mode Deactivated*\n\nExited Test Mode." });
        return;
      }
    }

    // --- ORDER FREQUENCY CHECK ---
    if (userOrderCompleted.has(from)) {
      const lastOrder = userOrderCompleted.get(from);
      const diff = Date.now() - lastOrder;
      const sixh = 6 * 60 * 60 * 1000;
      
      if (diff < sixh) {
        const imgPath = getRotatedImage(from);
        const remindText = `🙏 *Your order is already placed!*\n\nआप ${Math.ceil((sixh - diff) / (60 * 60 * 1000))} घंटे बाद नया ऑर्डर कर सकते हैं।\n(You can place new order after a few hours)`;
        
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

    // --- INITIAL GREETING / AUTO DETECT ---
    if (!userStates.has(from)) {
      let auto = autoBook(text);
      const imgPath = getRotatedImage(from);
      const randomDesc = getRandomDescription();
      
      let welcome = `🙏 *Namaste!*
🌳 *Free Book Service by Sant Rampal Ji Maharaj*

📚 हम आपको पूर्णतः निःशुल्क पुस्तक भेजना चाहते हैं, डिलीवरी भी फ्री है।
_We want to send you a completely free book, delivery is also free, no charges at all._

✨ ${randomDesc}

❓ *कौन सी पुस्तक चाहिए?* _Which book would you like?_

1️⃣ ज्ञान गंगा (Gyan Ganga)
2️⃣ जीने की राह (Way of Living)
3️⃣ PDF (Want to see PDF first?)

👇 *1, 2 या 3 (pdf) लिखकर भेजें*`;

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

    // --- BACK NAVIGATION ---
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
        'awaiting_village': 'awaiting_pincode',
        'awaiting_confirmation': 'awaiting_village',
        'awaiting_pdf_language': 'awaiting_pdf_book',
        'pdf_shown': 'awaiting_book'
      };
      
      if (prev[state.step]) {
        state.step = prev[state.step];
        userStates.set(from, state);
        await sock.sendMessage(from, { text: "🔙 *Previous step resumed!*" });
        await resendMenu(sock, from, state);
        return;
      }
    }

    // ==================== FLOW LOGIC ====================

    // 1. BOOK SELECTION
    if (state.step === 'awaiting_book') {
      let book = null;
      if (text === '1') book = 'ज्ञान गंगा';
      else if (text === '2') book = 'जीने की राह';
      else if (text.toLowerCase() === 'pdf' || text === '3') {
        state.step = 'awaiting_pdf_book';
        userStates.set(from, state);
        await sock.sendMessage(from, { text: "📄 *PDF Mode*\n\n❓ कौन सी पुस्तक का PDF देखना है?\n\n1️⃣ ज्ञान गंगा\n2️⃣ जीने की राह\n\n👇 *1 या 2 लिखकर भेजें*" });
        return;
      } else {
        book = autoBook(text);
      }

      if (!book) {
        await sock.sendMessage(from, { text: "❌ *Invalid Option*\n\n👇 Please send:\n*1* for Gyan Ganga\n*2* for Way of Living\n*3* for PDF" });
        return;
      }

      state.bookName = book;
      const langs = CONFIG.BOOK_PDFS[book] ? Object.keys(CONFIG.BOOK_PDFS[book]) : ['Hindi', 'English'];
      
      let langMenu = "";
      langs.forEach((lang, i) => langMenu += `${i + 1}. ${lang}\n`);
      
      await sock.sendMessage(from, { text: `📚 *${book}*\n\n❓ *किस भाषा में?* _Which language?_\n\n${langMenu}\n👇 *Send language number*` });
      
      state.availableLangs = langs;
      state.step = 'awaiting_language';
      userStates.set(from, state);
      return;
    }

    // 2. LANGUAGE SELECTION
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
        await sock.sendMessage(from, { text: "❌ *Invalid Language*\n\n👇 कृपया सही नंबर भेजें (Send correct number)." });
        return;
      }

      state.language = langSelected;
      await sock.sendMessage(from, { text: `✍️ *Language:* ${state.language}\n\nआपका पूरा नाम? (Your Full Name)\n\n_Example: Rahul Kumar_` });
      state.step = 'awaiting_name';
      userStates.set(from, state);
      return;
    }

    // 3. NAME
    if (state.step === 'awaiting_name') {
      state.name = text;
      await sock.sendMessage(from, { text: `✍️ *Name:* ${state.name}\n\nक्या यह सही है? (Is it correct?)\n\n1️⃣ हाँ (Yes)\n2️⃣ नहीं (No)` });
      state.step = 'confirm_name';
      userStates.set(from, state);
      return;
    }

    if (state.step === 'confirm_name') {
      if (isNo(text)) {
        state.step = 'awaiting_name';
        await sock.sendMessage(from, { text: "✍️ *Re-enter Name:*\n\nकृपया अपना सही नाम लिखें।" });
        userStates.set(from, state);
        return;
      }
      if (!isYes(text)) {
        await sock.sendMessage(from, { text: "❌ *Reply 1 (Yes) or 2 (No)*" });
        return;
      }
      await sock.sendMessage(from, { text: "👨‍🦳 पिता का नाम? (Father's Name)\n\n_Example: Ramesh Singh_" });
      state.step = 'awaiting_father';
      userStates.set(from, state);
      return;
    }

    // 4. FATHER NAME
    if (state.step === 'awaiting_father') {
      state.father = text;
      await sock.sendMessage(from, { text: `👨‍🦳 *Father:* ${state.father}\n\nक्या यह सही है? (Is it correct?)\n\n1️⃣ हाँ (Yes)\n2️⃣ नहीं (No)` });
      state.step = 'confirm_father';
      userStates.set(from, state);
      return;
    }

    if (state.step === 'confirm_father') {
      if (isNo(text)) {
        state.step = 'awaiting_father';
        await sock.sendMessage(from, { text: "👨‍🦳 *Re-enter Father's Name:*" });
        userStates.set(from, state);
        return;
      }
      if (!isYes(text)) {
        await sock.sendMessage(from, { text: "❌ *Reply 1 (Yes) or 2 (No)*" });
        return;
      }
      await sock.sendMessage(from, { text: "📞 10-अंकों का मोबाइल नंबर?\n(10-digit Mobile Number)\n\n_Example: 9876543210_" });
      state.step = 'awaiting_mobile';
      userStates.set(from, state);
      return;
    }

    // 5. MOBILE
    if (state.step === 'awaiting_mobile') {
      const mob = text.replace(/[^0-9]/g, '');
      if (mob.length !== 10) {
        await sock.sendMessage(from, { text: "❌ *Invalid Number*\n\nकृपया 10 अंकों का मोबाइल नंबर भेजें।\n_Please send 10-digit mobile number._" });
        return;
      }

      // Check duplicate
      const dupKey = `${state.name.toLowerCase().trim()}|${mob}`;
      if (duplicateOrders.has(dupKey)) {
        await sock.sendMessage(from, { text: "⚠️ *Already Ordered*\n\nआपने इस नाम और नंबर से पहले ही ऑर्डर कर दिया है।\n_You have already placed an order._\n\nधन्यवाद! 🙏" });
        userStates.delete(from);
        return;
      }

      state.mobile = mob;
      await sock.sendMessage(from, { text: `📞 *Mobile:* ${state.mobile}\n\nक्या यह सही है? (Is it correct?)\n\n1️⃣ हाँ (Yes)\n2️⃣ नहीं (No)` });
      state.step = 'confirm_mobile';
      userStates.set(from, state);
      return;
    }

    if (state.step === 'confirm_mobile') {
      if (isNo(text)) {
        state.step = 'awaiting_mobile';
        await sock.sendMessage(from, { text: "📞 *Re-enter Mobile Number:*" });
        userStates.set(from, state);
        return;
      }
      if (!isYes(text)) {
        await sock.sendMessage(from, { text: "❌ *Reply 1 (Yes) or 2 (No)*" });
        return;
      }
      await sock.sendMessage(from, { text: "📮 6-अंकों का पिनकोड?\n(6-digit Pincode)\n\n_Example: 110001_" });
      state.step = 'awaiting_pincode';
      userStates.set(from, state);
      return;
    }

    // 6. PINCODE
    if (state.step === 'awaiting_pincode') {
      const pin = text.replace(/[^0-9]/g, '');
      if (pin.length !== 6) {
        await sock.sendMessage(from, { text: "❌ *Invalid Pincode*\n\nकृपया 6 अंकों का पिनकोड भेजें।\n_Enter 6-digit pincode._" });
        return;
      }

      const pinInfo = await fetchPinDetails(pin);
      
      if (!pinInfo || !pinInfo.success || !pinInfo.postOffices || pinInfo.postOffices.length === 0) {
        await sock.sendMessage(from, { text: "❌ *Pincode Not Found*\n\nकृपया सही पिनकोड भेजें या पुनः प्रयास करें। (Try again)" });
        return;
      }

      state.pincode = pin;
      state.district = pinInfo.district;
      state.stateName = pinInfo.state;
      state.villages = pinInfo.postOffices.map(po => `${po.name}, ${po.district}, ${po.state}`);

      let menu = "";
      state.villages.forEach((v, i) => menu += `${i + 1}. ${v.split(',')[0]}\n`);

      await sock.sendMessage(from, { text: `📮 *${state.pincode}*\n📍 ${state.district}, ${state.stateName}\n\nअपना गाँव/शहर चुनें...\nSelect your village/city...\n\n${menu}\n👇 *Send number*` });
      state.step = 'awaiting_village';
      userStates.set(from, state);
      return;
    }

    // 7. VILLAGE SELECTION
    if (state.step === 'awaiting_village') {
      let sel = null;
      const idx = parseInt(text) - 1;
      
      if (!isNaN(idx) && idx >= 0 && state.villages && idx < state.villages.length) {
        sel = state.villages[idx].split(',')[0];
      } else if (state.villages) {
        const match = state.villages.find(v => v.split(',')[0].toLowerCase().includes(text.toLowerCase()));
        if (match) sel = match.split(',')[0];
      }

      if (!sel) {
        await sock.sendMessage(from, { text: "❌ *Invalid Selection*\n\nकृपया लिस्ट से सही नंबर चुनें।" });
        return;
      }

      state.address = sel;
      
      await sock.sendMessage(from, { text: `📋 *Order Confirmation*\n\n👤 Name: ${state.name}\n👨 Father: ${state.father}\n📞 Mobile: +91${state.mobile}\n📚 Book: ${state.bookName}\n🌐 Language: ${state.language}\n📍 Address: ${state.address}\n📮 Pincode: ${state.pincode}\n🏘️ District: ${state.district}\n🗺️ State: ${state.stateName}` });
      await sock.sendMessage(from, { text: "✅ *Confirm Order?*\n\n1️⃣ हाँ (Yes, Place Order)\n2️⃣ नहीं (No, Cancel)\n\n👇 *Reply 1 or 2*" });
      
      state.step = 'awaiting_confirmation';
      userStates.set(from, state);
      return;
    }

    // 8. FINAL CONFIRMATION
    if (state.step === 'awaiting_confirmation') {
      if (isNo(text)) {
        await sock.sendMessage(from, { text: "❌ *Order Cancelled*" });
        userStates.delete(from);
        if (reminderTimeouts.has(from)) clearTimeout(reminderTimeouts.get(from));
        return;
      }

      if (!isYes(text)) {
        await sock.sendMessage(from, { text: "❌ *Reply 1 to Confirm or 2 to Cancel*" });
        return;
      }

      // Save Order
      const orderData = {
        name: state.name,
        father: state.father,
        mobile: state.mobile,
        bookName: state.bookName,
        language: state.language,
        address: state.address,
        pincode: state.pincode,
        district: state.district,
        stateName: state.stateName,
        whatsapp: from,
        sessionName: sessionName,
        timestamp: new Date().toISOString()
      };

      await saveOrder(orderData);

      const dupKey = `${state.name.toLowerCase().trim()}|${state.mobile}`;
      duplicateOrders.set(dupKey, Date.now());

      // PDF Link
      const pdfLink = CONFIG.BOOK_PDFS[state.bookName]?.[state.language];

      // Send confirmations
      await sendOrderConfirmation(sock, from, orderData, pdfLink);
      await forwardOrder(sock, sessionName, orderData);

      userOrderCompleted.set(from, Date.now());
      userStates.delete(from);
      if (reminderTimeouts.has(from)) clearTimeout(reminderTimeouts.get(from));
      return;
    }

    // 9. PDF FLOW
    if (state.step === 'awaiting_pdf_book') {
      let book = null;
      if (text === '1') book = 'ज्ञान गंगा';
      else if (text === '2') book = 'जीने की राह';
      else book = autoBook(text);

      if (!book) {
        await sock.sendMessage(from, { text: "❌ Invalid book choice" });
        return;
      }
      
      state.pdfBook = book;
      const langs = CONFIG.BOOK_PDFS[book] ? Object.keys(CONFIG.BOOK_PDFS[book]) : ['Hindi', 'English'];
      let langMenu = "";
      langs.forEach((lang, i) => langMenu += `${i + 1}. ${lang}\n`);
      
      await sock.sendMessage(from, { text: `📄 *${book} PDF*\n\nभाषा चुनें (Select Language):\n${langMenu}\n👇 *Send number*` });
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
        await sock.sendMessage(from, { text: "❌ Invalid number" });
        return;
      }
      
      const pdfLink = CONFIG.BOOK_PDFS[state.pdfBook]?.[langSelected];
      await sock.sendMessage(from, { text: `📄 *${state.pdfBook} (${langSelected})*\n\n🔗 Link: ${pdfLink}\n\n👇 *निःशुल्क पुस्तक मंगवाने के लिए 1 भेजें*` });
      
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
    console.error("Message Handler Error:", err);
    try {
      const from = msg.key?.remoteJid;
      if (from) await sock.sendMessage(from, { text: "⚠️ *Error occurred!* Please try again." });
    } catch {}
  }
}