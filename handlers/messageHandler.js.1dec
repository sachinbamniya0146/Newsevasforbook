import { fetchPinDetails } from '../utils/pincodeHelper.js';
import { saveOrder } from '../utils/database.js';
import { sendToOrderGroup } from '../utils/groupManager.js';
import { getSessionAdmin } from '../utils/sessionAdminManager.js';
import CONFIG from '../config.js';
import fs from 'fs';

const userStates = new Map();
const orderCounters = new Map();
const reminderTimeouts = new Map();
const userOrderCompleted = new Map();
const duplicateOrders = new Map();

// Enhanced Book Descriptions (60+ variations)
const BOOK_DESCRIPTIONS = [
  "इस पुस्तक में सच्चे आध्यात्मिक ज्ञान का खजाना है जो आपके जीवन की सभी समस्याओं का समाधान देता है। | This book contains the treasure of true spiritual knowledge that solves all life problems.",
  "यह पुस्तक आपको बताती है कि परमात्मा को कैसे पाएं और मोक्ष कैसे प्राप्त करें। सद्ग्रंथों के प्रमाण सहित। | Learn how to attain God and salvation with evidence from holy scriptures.",
  "जीवन की सभी परेशानियों - बीमारी, गरीबी, दुख - से मुक्ति का सही तरीका इस पुस्तक में है। | The right way to get rid of all troubles - disease, poverty, sorrow - is in this book.",
  "यह पुस्तक हजारों लोगों की ज़िंदगी बदल चुकी है! आध्यात्मिक ज्ञान से भरपूर। | This book has changed thousands of lives! Full of spiritual knowledge.",
  "परमात्मा कबीर साहेब का सच्चा परिचय और पूर्ण मोक्ष का मार्ग इस पुस्तक में है। | True introduction of Supreme God Kabir and path to complete salvation in this book."
];

function getRandomDescription() {
  return BOOK_DESCRIPTIONS[Math.floor(Math.random() * BOOK_DESCRIPTIONS.length)];
}

function isYes(txt) {
  const yes = ['1','yes','ok','haan','ha','हाँ','done','order','yes.','ok.','haan.','haa','y','Y','ha.','ہاں','ji','जी','han','theek'];
  return yes.includes(txt.trim().toLowerCase());
}

function isNo(txt) {
  const no = ['2','no','nahi','ना','नहीं','no.','nahi.','nope','नहि','n','N','nhi','cancel','نہیں','galat'];
  return no.includes(txt.trim().toLowerCase());
}

function isBack(txt) {
  const back = ['back','वापस','peeche','0','⬅️','पीछे','vapas'];
  return back.includes(txt.trim().toLowerCase());
}

function autoBook(text) {
  const low = text.trim().toLowerCase();
  if (low.includes('ganga') || low.includes('ज्ञान')) return 'ज्ञान गंगा';
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

function scheduleReminder(sock, from, state, sessionName, isAdmin) {
  if (reminderTimeouts.has(from)) clearTimeout(reminderTimeouts.get(from));
  const reminderTime = 6 * 60 * 60 * 1000;
  reminderTimeouts.set(from, setTimeout(async () => {
    if (userStates.has(from)) {
      const imgPath = getRotatedImage(from);
      let remTxt = isAdmin
        ? `🛠️ *[Admin Test Mode Reminder]*\nआप अभी भी Test-Mode में हैं।\n(You are still in Test Mode!)\n(Reply 'exit' या 0 छोड़ने के लिए)`
        : `🙏 आपकी निःशुल्क पुस्तक का ऑर्डर अधूरा है!\nYour free book order is pending.\nकृपया reply करें शुरू करने हेतु।`;
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
    const welcome = `🙏 *नमस्ते! Namaste!*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 *संत रामपाल जी महाराज* की निःशुल्क पुस्तक सेवा
_Free Book Service by Sant Rampal Ji Maharaj_

हम आपको निःशुल्क पुस्तक भेजना चाहते हैं जो कि पूर्ण रूप से निःशुल्क है, delivery भी फ्री है, कोई चार्ज नहीं है।
_We want to send you a completely free book, delivery is also free, no charges at all._

📖 *पुस्तक में क्या है?*
${randomDesc}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*कौनसी पुस्तक चाहिए?*
_Which book would you like?_

1️⃣ ज्ञान गंगा (Gyan Ganga)
2️⃣ जीने की राह (Way of Living)
3️⃣ पहले PDF देखना चाहते हैं? (Want to see PDF first?)

*1 भेजें यदि ज्ञान गंगा चाहिए*
*2 भेजें यदि जीने की राह चाहिए*
*3 या pdf भेजें यदि पहले पुस्तक देखना चाहते हैं*`;
    await sock.sendMessage(from, { text: welcome });
  }
  
  else if (step === 'awaiting_language') {
    const bookName = state.bookName || 'ज्ञान गंगा';
    const langs = state.availableLangs || (CONFIG.BOOK_PDFS && CONFIG.BOOK_PDFS[bookName] ? Object.keys(CONFIG.BOOK_PDFS[bookName]) : ['हिंदी', 'English']);
    let langMenu = "";
    langs.forEach((lang, i) => langMenu += `${i + 1}. ${lang}\n`);
    await sock.sendMessage(from, { text: `✅ *${bookName}* चुना।\n✍️ लेखक: संत रामपाल जी महाराज\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nकिस भाषा में?\nWhich language?\n\n${langMenu}\nभाषा का नंबर भेजें (Send language number)` });
  }
  
  else if (step === 'awaiting_name') {
    await sock.sendMessage(from, { text: `✅ भाषा: *${state.language || 'हिंदी'}*\n\nअब अपना *पूरा नाम* भेजें:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nYour Full Name:\nउदाहरण (Example): राज कुमार शर्मा` });
  }
  
  else if (step === 'confirm_name') {
    await sock.sendMessage(from, { text: `नाम (Name): *${state.name}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nक्या सही है? | Is it correct?\n\n✅ सही है तो: *1* / "हाँ" / "Yes"\n❌ बदलना है तो: *2* / "नहीं" / "No"` });
  }
  
  else if (step === 'awaiting_father') {
    await sock.sendMessage(from, { text: `अब अपने *पिता का नाम* लिखें:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nFather's Name:\nउदाहरण (Example): संतोष कुमार शर्मा` });
  }
  
  else if (step === 'confirm_father') {
    await sock.sendMessage(from, { text: `पिता का नाम (Father's Name): *${state.father}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nक्या सही है? | Is it correct?\n\n✅ सही है तो: *1* / "हाँ" / "Yes"\n❌ बदलना है तो: *2* / "नहीं" / "No"` });
  }
  
  else if (step === 'awaiting_mobile') {
    await sock.sendMessage(from, { text: `अब *मोबाइल नंबर* (10-digit) भेजें:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nMobile Number:\nउदाहरण (Example): 9876543210` });
  }
  
  else if (step === 'confirm_mobile') {
    await sock.sendMessage(from, { text: `मोबाइल नंबर (Mobile): *${state.mobile}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nक्या सही है? | Is it correct?\n\n✅ सही है तो: *1* / "हाँ" / "Yes"\n❌ बदलना है तो: *2* / "नहीं" / "No"` });
  }
  
  else if (step === 'awaiting_pincode') {
    await sock.sendMessage(from, { text: `अब *पिनकोड* (6-digit) भेजें:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nPincode:\nउदाहरण (Example): 110001` });
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
    await sock.sendMessage(from, { text: `✅ *पिनकोड:* ${state.pincode}\n📍 *जिला:* ${state.district}\n📍 *राज्य:* ${state.stateName}\n${state.selectedLocation ? `📮 *क्षेत्र:* ${state.selectedLocation}` : ''}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nअब अपना *पूरा पता विस्तार से* लिखें:\n_Now write your complete address in detail:_\n\nजैसे (Example):\nमकान नंबर, गली का नाम, गांव/शहर, नजदीकी स्थान\n_House no., street, village/city, landmark_\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💡 जितना विस्तार से लिखेंगे, उतना बेहतर!\n_More details = Better delivery!_` });
  }
  
  else if (step === 'awaiting_confirmation') {
    await sock.sendMessage(from, { text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📋 *ऑर्डर कन्फर्मेशन*\n_Order Confirmation_\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nनाम (Name): ${state.name}\nपिता (Father): ${state.father}\nमोबाइल (Mobile): +91${state.mobile}\nपुस्तक (Book): ${state.bookName}\nभाषा (Language): ${state.language}\nपता (Address): ${state.fullAddress}\nपिनकोड (Pincode): ${state.pincode}\nजिला (District): ${state.district}\nराज्य (State): ${state.stateName}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━` });
    await sock.sendMessage(from, { text: `✅ *Order Done* के लिए: *1* / "yes" / "order" / "done"\n❌ *Cancel* के लिए: *2* / "no" / "cancel"\n\nअपना जवाब भेजें (Send your reply):` });
  }
}

export async function handleMessage(sock, msg, sessionName = 'WhatsApp') {
  try {
    const from = msg.key?.remoteJid ?? msg.key?.participant ?? '';
    if (!from) return;
    if (from.endsWith('@g.us')) {
      console.log('Ignoring group message from:', from);
      return;
    }
    
    const textRaw = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
    const text = textRaw.trim();
    if (!text) return;
    
    const isAdmin = CONFIG.ADMIN && from === CONFIG.ADMIN.JID;
    let state = userStates.get(from) || {};

    // Admin Test Mode
    if (isAdmin) {
      let imgPath = getRotatedImage(from);
      if (!state.testMode) {
        if (text.toLowerCase() === "test" || text === "1") {
          state.testMode = true;
          userStates.set(from, state);
          if (imgPath && fs.existsSync(imgPath)) {
            await sock.sendMessage(from, { image: { url: imgPath }, caption: `🛠️ *Test Mode activated for admin!*\nहर message पर image जाएगा।\n(Reply '0'/exit to leave)` });
          } else {
            await sock.sendMessage(from, { text: `🛠️ *Test Mode activated for admin!*\n(Reply '0'/exit to leave)` });
          }
          scheduleReminder(sock, from, state, sessionName, true);
          return;
        }
        if (imgPath && fs.existsSync(imgPath)) {
          await sock.sendMessage(from, { image: { url: imgPath }, caption: `Admin verified!\nTest Mode चालू करने के लिए 'test' या 1 भेजें।` });
        } else {
          await sock.sendMessage(from, { text: `Admin verified!\nTest Mode चालू करने के लिए 'test' या 1 भेजें।` });
        }
        return;
      }
      
      if (text.toLowerCase() === "exit" || text === "0") {
        userStates.delete(from);
        if (reminderTimeouts.has(from)) clearTimeout(reminderTimeouts.get(from));
        await sock.sendMessage(from, { text: "🚫 Test Mode समाप्त! (Exited Test Mode)" });
        return;
      }
      
      if (imgPath && fs.existsSync(imgPath)) {
        await sock.sendMessage(from, { image: { url: imgPath }, caption: `🔁 *[Test Mode]*\nAdmin message: "${text}"\n(Reply '0'/exit to leave)` });
      } else {
        await sock.sendMessage(from, { text: `🔁 *[Test Mode]*\nAdmin message: "${text}"\n(Reply '0'/exit to leave)` });
      }
      scheduleReminder(sock, from, state, sessionName, true);
      return;
    }

    // Check if user already ordered recently
    if (userOrderCompleted.has(from)) {
      const lastOrder = userOrderCompleted.get(from);
      const diff = Date.now() - lastOrder;
      const sixh = 6 * 60 * 60 * 1000;
      if (diff < sixh) {
        const imgPath = getRotatedImage(from);
        const remindText = `🙏 आपका ऑर्डर पहले ही दर्ज हो चुका है!\nYour order is already placed!\n\nनया ऑर्डर ${Math.ceil((sixh - diff) / (60 * 60 * 1000))} घंटे बाद कर सकते हैं।\nYou can place new order after ${Math.ceil((sixh - diff) / (60 * 60 * 1000))} hours.`;
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

    // Start new conversation
    if (!userStates.has(from)) {
      let auto = autoBook(text);
      const imgPath = getRotatedImage(from);
      const randomDesc = getRandomDescription();
      let welcome = `🙏 *नमस्ते! Namaste!*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 *संत रामपाल जी महाराज* की निःशुल्क पुस्तक सेवा
_Free Book Service by Sant Rampal Ji Maharaj_

हम आपको निःशुल्क पुस्तक भेजना चाहते हैं जो कि पूर्ण रूप से निःशुल्क है, delivery भी फ्री है, कोई चार्ज नहीं है।
_We want to send you a completely free book, delivery is also free, no charges at all._

📖 *पुस्तक में क्या है?*
${randomDesc}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*कौनसी पुस्तक चाहिए?*
_Which book would you like?_

1️⃣ ज्ञान गंगा (Gyan Ganga)
2️⃣ जीने की राह (Way of Living)
3️⃣ पहले PDF देखना चाहते हैं? (Want to see PDF first?)

*1 भेजें यदि ज्ञान गंगा चाहिए*
*2 भेजें यदि जीने की राह चाहिए*
*3 या pdf भेजें यदि पहले पुस्तक देखना चाहते हैं*`;

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

    state = userStates.get(from);
    state.lastActive = Date.now();
    userStates.set(from, state);

    // Handle back button
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
        await sock.sendMessage(from, { text: `⬅️ पिछला स्टेप चालू हो गया!\n_Previous step resumed!_\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━` });
        await resendMenu(sock, from, state);
      }
      return;
    }

    // PDF Book Selection
    if (state.step === 'awaiting_pdf_book') {
      let book = null;
      if (text === '1') book = 'ज्ञान गंगा';
      else if (text === '2') book = 'जीने की राह';
      else book = autoBook(text);
      
      if (!book) {
        const randomDesc = getRandomDescription();
        await sock.sendMessage(from, { text: `कौनसी पुस्तक का PDF देखना चाहते हैं?\nWhich book PDF do you want to see?\n\n📖 ${randomDesc}\n\n1️⃣ ज्ञान गंगा (Gyan Ganga)\n2️⃣ जीने की राह (Way of Living)\n\n1 या 2 भेजें (Send 1 or 2)\n\n⬅️ पीछे जाने के लिए *0* भेजें\n_Send *0* to go back_` });
        return;
      }
      
      state.pdfBook = book;
      const langs = CONFIG.BOOK_PDFS && CONFIG.BOOK_PDFS[book] ? Object.keys(CONFIG.BOOK_PDFS[book]) : ['हिंदी', 'English'];
      let langMenu = "";
      langs.forEach((lang, i) => langMenu += `${i + 1}. ${lang}\n`);
      await sock.sendMessage(from, { text: `✅ *${book}* PDF\n\nकिस भाषा में पढ़ना चाहते हैं?\nWhich language?\n\n${langMenu}\nभाषा का नंबर भेजें (Send language number)\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
      state.availablePdfLangs = langs;
      state.step = 'awaiting_pdf_language';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }

    // PDF Language Selection
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
        await sock.sendMessage(from, { text: `❌ सही भाषा नंबर भेजें। (Send correct language number)\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }
      
      const pdfLink = CONFIG.BOOK_PDFS && CONFIG.BOOK_PDFS[state.pdfBook] && CONFIG.BOOK_PDFS[state.pdfBook][langSelected] ? CONFIG.BOOK_PDFS[state.pdfBook][langSelected] : '';
      const randomDesc = getRandomDescription();
      
      if (pdfLink) {
        await sock.sendMessage(from, { text: `📖 *${state.pdfBook} (${langSelected})* PDF:\n\n${pdfLink}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📚 *इस पुस्तक में:*\n${randomDesc}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📚 कृपया PDF देखें और हमें बताएं!\nPlease view the PDF and let us know!\n\nअगर आपको निःशुल्क पुस्तक चाहिए तो अपना नाम, पता भेजें।\nIf you want the free physical book, send us your name & address.\n\n1️⃣ ज्ञान गंगा (Gyan Ganga) के लिए 1 भेजें\n2️⃣ जीने की राह (Way of Living) के लिए 2 भेजें\n\nया पुस्तक का नाम लिखें। (Or write book name directly)` });
      }
      
      state.step = 'pdf_shown';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }

    // After PDF shown - book selection
    if (state.step === 'pdf_shown') {
      let book = null;
      if (text === '1') book = 'ज्ञान गंगा';
      else if (text === '2') book = 'जीने की राह';
      else book = autoBook(text);
      
      if (!book) {
        const randomDesc = getRandomDescription();
        await sock.sendMessage(from, { text: `कौनसी पुस्तक ऑर्डर करना चाहते हैं?\nWhich book do you want to order?\n\n📖 ${randomDesc}\n\n1️⃣ ज्ञान गंगा\n2️⃣ जीने की राह\n\n1 या 2 भेजें\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }
      
      state.bookName = book;
      const langs = CONFIG.BOOK_PDFS && CONFIG.BOOK_PDFS[book] ? Object.keys(CONFIG.BOOK_PDFS[book]) : ['हिंदी', 'English'];
      let langMenu = "";
      langs.forEach((lang, i) => langMenu += `${i + 1}. ${lang}\n`);
      await sock.sendMessage(from, { text: `✅ *${book}* चुना।\n✍️ लेखक: संत रामपाल जी महाराज\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nकिस भाषा में?\nWhich language?\n\n${langMenu}\nभाषा का नंबर भेजें (Send language number)\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
      state.availableLangs = langs;
      state.step = 'awaiting_language';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }

    // Book Selection (Main Flow)
    if (state.step === 'awaiting_book') {
      let book = null;
      if (text === '1') book = 'ज्ञान गंगा';
      else if (text === '2') book = 'जीने की राह';
      else if (text.toLowerCase() === 'pdf' || text === '3') {
        state.step = 'awaiting_pdf_book';
        userStates.set(from, state);
        const randomDesc = getRandomDescription();
        await sock.sendMessage(from, { text: `📖 पहले PDF देखना चाहते हैं!\nYou want to see PDF first!\n\n${randomDesc}\n\nकौनसी पुस्तक का PDF?\nWhich book PDF?\n\n1️⃣ ज्ञान गंगा\n2️⃣ जीने की राह\n\n1 या 2 भेजें (Send 1 or 2)\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      } else {
        book = autoBook(text);
      }
      
      if (!book) {
        const randomDesc = getRandomDescription();
        await sock.sendMessage(from, { text: `❌ कृपया 1, 2, या 3/pdf भेजें।\n_Send 1, 2, or 3/pdf._\n\n📖 ${randomDesc}\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }
      
      state.bookName = book;
      const langs = CONFIG.BOOK_PDFS && CONFIG.BOOK_PDFS[book] ? Object.keys(CONFIG.BOOK_PDFS[book]) : ['हिंदी', 'English'];
      let langMenu = "";
      langs.forEach((lang, i) => langMenu += `${i + 1}. ${lang}\n`);
      await sock.sendMessage(from, { text: `✅ *${book}* चुना।\n✍️ लेखक: संत रामपाल जी महाराज\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nकिस भाषा में?\nWhich language?\n\n${langMenu}\nभाषा का नंबर भेजें (Send language number)\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
      state.availableLangs = langs;
      state.step = 'awaiting_language';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }

    // Language Selection
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
        await sock.sendMessage(from, { text: `❌ सही भाषा नंबर भेजें। (Send correct language number)\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }
      
      state.language = langSelected;
      await sock.sendMessage(from, { text: `✅ भाषा (Language): *${state.language}*\n\nअब अपना *पूरा नाम* भेजें:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nYour Full Name:\nउदाहरण (Example): राज कुमार शर्मा\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
      state.step = 'awaiting_name';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }

    // Name Input
    if (state.step === 'awaiting_name') {
      state.name = text;
      await sock.sendMessage(from, { text: `नाम (Name): *${state.name}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nक्या आपने सही (Correct) नाम लिखा है?\nIs the name above correct?\n\n✅ सही है तो reply करें: *1* / "हाँ" / "Yes"\n❌ बदलना है तो reply करें: *2* / "नहीं" / "No"\n\nउदाहरण (Example): 1\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
      state.step = 'confirm_name';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }

    // Confirm Name
    if (state.step === 'confirm_name') {
      if (isNo(text)) {
        state.step = 'awaiting_name';
        await sock.sendMessage(from, { text: `🔄 कोई बात नहीं! (No problem!)\nकृपया फिर से अपना *पूरा नाम* लिखें:\nRe-enter your full name:\n\nउदाहरण (Example): राज कुमार शर्मा\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
        userStates.set(from, state);
        return;
      }
      
      if (!isYes(text)) {
        await sock.sendMessage(from, { text: `कृपया सही जवाब दें:\n\n✅ सही है तो: *1* / "हाँ" / "Yes"\n❌ नहीं तो: *2* / "नहीं" / "No"\n\nPlease reply *1* (Yes) or *2* (No)\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }
      
      await sock.sendMessage(from, { text: `अब अपने *पिता का नाम* लिखें:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nFather's Name:\nउदाहरण (Example): संतोष कुमार शर्मा\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
      state.step = 'awaiting_father';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }

    // Father's Name Input
    if (state.step === 'awaiting_father') {
      state.father = text;
      await sock.sendMessage(from, { text: `पिता का नाम (Father's Name): *${state.father}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nक्या ऊपर लिखा *पिता का नाम* सही है?\nIs your father's name correct?\n\n✅ सही है तो reply करें: *1* / "हाँ" / "Yes"\n❌ बदलना है तो reply करें: *2* / "नहीं" / "No"\n\nउदाहरण (Example): 1\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
      state.step = 'confirm_father';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }

    // Confirm Father's Name
    if (state.step === 'confirm_father') {
      if (isNo(text)) {
        state.step = 'awaiting_father';
        await sock.sendMessage(from, { text: `🔄 कोई बात नहीं! (No problem!)\nफिर से *पिता का नाम* लिखें:\nRe-enter father's name:\n\nउदाहरण (Example): संतोष कुमार\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
        userStates.set(from, state);
        return;
      }
      
      if (!isYes(text)) {
        await sock.sendMessage(from, { text: `कृपया सही जवाब दें:\n\n✅ सही है तो: *1* / "हाँ" / "Yes"\n❌ नहीं तो: *2* / "नहीं" / "No"\n\nPlease reply *1* (Yes) or *2* (No)\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }
      
      await sock.sendMessage(from, { text: `अब *मोबाइल नंबर* (10-digit) भेजें:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nMobile Number:\nउदाहरण (Example): 9876543210\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
      state.step = 'awaiting_mobile';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }

    // Mobile Number Input
    if (state.step === 'awaiting_mobile') {
      const mob = text.replace(/[^0-9]/g, "");
      if (mob.length !== 10) {
        await sock.sendMessage(from, { text: `❌ 10 अंक का नंबर दें\n(Enter 10-digit mobile number)\n\nउदाहरण (Example): 9876543210\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }
      
      const dupKey = `${state.name.toLowerCase().trim()}_${mob}`;
      if (duplicateOrders.has(dupKey)) {
        await sock.sendMessage(from, { text: `⚠️ *आपने पहले ही ऑर्डर कर दिया है!*\nYou have already placed an order before!\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nअब आप मुफ्त में पुस्तक नहीं ले सकते हैं।\nYou cannot get a free book again.\n\nअगर कोई पड़ोसी/मित्र को निःशुल्क पुस्तक देनी है, तो उनके नंबर से हमें मैसेज करवा दो।\nIf you want to send a free book to a neighbor/friend, ask them to message us from their number.\n\n🙏 धन्यवाद! Thank you!` });
        userStates.delete(from);
        if (reminderTimeouts.has(from)) clearTimeout(reminderTimeouts.get(from));
        return;
      }
      
      state.mobile = mob;
      await sock.sendMessage(from, { text: `मोबाइल नंबर (Mobile): *${state.mobile}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nक्या यह मोबाइल नंबर सही है?\nIs this mobile number correct?\n\n✅ सही है तो: *1* / "हाँ" / "Yes"\n❌ नहीं तो: *2* / "नहीं" / "No"\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
      state.step = 'confirm_mobile';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }

    // Confirm Mobile
    if (state.step === 'confirm_mobile') {
      if (isNo(text)) {
        state.step = 'awaiting_mobile';
        await sock.sendMessage(from, { text: `फिर से 10-digit मोबाइल नंबर भेजें:\nRe-enter 10-digit mobile:\n\nउदाहरण (Example): 9876543210\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
        userStates.set(from, state);
        return;
      }
      
      if (!isYes(text)) {
        await sock.sendMessage(from, { text: `कृपया *1* (Yes/हाँ) या *2* (No/नहीं) भेजें।\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }
      
      await sock.sendMessage(from, { text: `अब *पिनकोड* (6-digit) भेजें:\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nPincode:\nउदाहरण (Example): 110001\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
      state.step = 'awaiting_pincode';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }

    // Pincode Input - NEW ENHANCED FLOW
    if (state.step === 'awaiting_pincode') {
      const pin = text.replace(/[^0-9]/g, "");
      if (pin.length !== 6) {
        await sock.sendMessage(from, { text: `❌ 6 अंक का पिनकोड दर्ज करें\n(Enter 6-digit pincode)\n\nउदाहरण (Example): 110001\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }
      
      await sock.sendMessage(from, { text: `⏳ कृपया प्रतीक्षा करें...\n_Please wait..._\n\nआपके पिनकोड का डेटा निकाला जा रहा है।\n_Fetching your pincode data..._` });
      
      let pinInfo = null;
      for (let i = 0; i < 10; i++) {
        pinInfo = await fetchPinDetails(pin);
        if (pinInfo && pinInfo.success && pinInfo.postOffices && pinInfo.postOffices.length) {
          break;
        }
        await new Promise(r => setTimeout(r, 900));
      }
      
      if (!pinInfo || !pinInfo.success || !pinInfo.postOffices || !pinInfo.postOffices.length) {
        await sock.sendMessage(from, { text: `❌ पिनकोड verify नहीं हुआ। फिर से try करें।\n(Pincode verification failed. Try again.)\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }
      
      state.pincode = pin;
      state.district = pinInfo.district || '';
      state.stateName = pinInfo.state || '';
      state.postOffices = pinInfo.postOffices;
      
      let menu = `✅ *पिनकोड:* ${pin}\n📍 *जिला (District):* ${state.district}\n📍 *राज्य (State):* ${state.stateName}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📍 *अपना क्षेत्र चुनें | Select Your Area:*\n\n`;
      
      state.postOffices.forEach((po, i) => {
        menu += `${i + 1}. ${po.name} (${po.branchType})\n`;
      });
      
      menu += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📮 नंबर भेजें (Send number)\n\n⬅️ पीछे जाने के लिए *0* भेजें`;
      
      await sock.sendMessage(from, { text: menu });
      state.step = 'awaiting_location_choice';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }

    // Location Choice - NEW STEP
    if (state.step === 'awaiting_location_choice') {
      const idx = parseInt(text) - 1;
      
      if (isNaN(idx) || idx < 0 || !state.postOffices || idx >= state.postOffices.length) {
        await sock.sendMessage(from, { text: `❌ सही नंबर भेजें। (Send correct number from list)\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }
      
      const selected = state.postOffices[idx];
      state.selectedLocation = `${selected.name} (${selected.branchType})`;
      
      await sock.sendMessage(from, { text: `✅ *पिनकोड:* ${state.pincode}\n📍 *जिला:* ${state.district}\n📍 *राज्य:* ${state.stateName}\n📮 *क्षेत्र:* ${state.selectedLocation}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nअब अपना *पूरा पता विस्तार से* लिखें:\n_Now write your complete address in detail:_\n\nजैसे (Example):\nमकान नंबर, गली का नाम, गांव/शहर, नजदीकी स्थान\n_House no., street, village/city, landmark_\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💡 जितना विस्तार से लिखेंगे, उतना बेहतर!\n_More details = Better delivery!_\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
      
      state.step = 'awaiting_full_address';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }

    // Full Address Input - NEW STEP
    if (state.step === 'awaiting_full_address') {
      if (text.trim().length < 10) {
        await sock.sendMessage(from, { text: `❌ कृपया पूरा पता विस्तार से लिखें।\n_Please write complete address in detail._\n\nकम से कम 10 अक्षर चाहिए।\n_Minimum 10 characters required._\n\nजैसे:\nमकान नंबर 123, गली नंबर 5, सरस्वती नगर, बस स्टैंड के पास\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }
      
      state.fullAddress = text.trim();
      
      await sock.sendMessage(from, { text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📋 *ऑर्डर कन्फर्मेशन*\n_Order Confirmation_\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n👤 नाम (Name): ${state.name}\n👨 पिता (Father): ${state.father}\n📞 मोबाइल (Mobile): +91${state.mobile}\n📖 पुस्तक (Book): ${state.bookName}\n🌐 भाषा (Language): ${state.language}\n📍 पता (Address): ${state.fullAddress}\n📮 क्षेत्र (Area): ${state.selectedLocation}\n📮 पिनकोड (Pincode): ${state.pincode}\n🏘️ जिला (District): ${state.district}\n🗺️ राज्य (State): ${state.stateName}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━` });
      
      await sock.sendMessage(from, { text: `✅ *Order Done* के लिए: *1* / "yes" / "order" / "done"\n❌ *Cancel* के लिए: *2* / "no" / "cancel"\n\nअपना जवाब भेजें (Send your reply):\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
      
      state.step = 'awaiting_confirmation';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }

    // Final Confirmation
    if (state.step === 'awaiting_confirmation') {
      if (isNo(text)) {
        await sock.sendMessage(from, { text: `❌ ऑर्डर रद्द!\nOrder Cancelled!` });
        userStates.delete(from);
        if (reminderTimeouts.has(from)) clearTimeout(reminderTimeouts.get(from));
        return;
      }
      
      if (!isYes(text)) {
        await sock.sendMessage(from, { text: `कृपया *1*/yes/order/done या *2*/no/cancel भेजें\n(Please send *1* to confirm or *2* to cancel)\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }

      const dupKey = `${state.name.toLowerCase().trim()}_${state.mobile}`;
      duplicateOrders.set(dupKey, Date.now());

      const orderData = {
        name: state.name,
        father: state.father,
        mobile: state.mobile,
        bookName: state.bookName,
        language: state.language,
        fullAddress: state.fullAddress,
        selectedLocation: state.selectedLocation,
        pincode: state.pincode,
        district: state.district,
        stateName: state.stateName,
        whatsapp: from,
        sessionName: sessionName,
        timestamp: new Date().toISOString()
      };
      
      await saveOrder(orderData);
      
      const orderCount = updateOrderCount(sessionName);
      const now = new Date();
      const dateStr = now.toLocaleDateString('hi-IN');
      const timeStr = now.toLocaleTimeString('hi-IN');
      const pdfLink = CONFIG.BOOK_PDFS && CONFIG.BOOK_PDFS[state.bookName] && CONFIG.BOOK_PDFS[state.bookName][state.language] ? CONFIG.BOOK_PDFS[state.bookName][state.language] : '';
      
      if (pdfLink) {
        await sock.sendMessage(from, { text: `🎉 *ऑर्डर सफलतापूर्वक दर्ज!*\n_Your order is placed successfully!_\n\n📖 *${state.bookName} (${state.language})* PDF:\n${pdfLink}\n\n📥 PDF अभी डाउनलोड करें!\n_Download PDF now!_\n\n🙏 धन्यवाद! Thank you!` });
      }
      
      if (CONFIG.USER_GROUP_LINK) {
        await sock.sendMessage(from, { text: `📢 *हमारे WhatsApp ग्रुप से जुड़ें:*\n_Join our WhatsApp group:_\n\n${CONFIG.USER_GROUP_LINK}\n\n📦 *डिलीवरी:* 7-21 दिन (निःशुल्क)\n_Delivery: 7-21 days (Free)_` });
      }
      
      const fwMsg = `📦 *नया ऑर्डर!* (Order #${orderCount})\n📅 Date: ${dateStr}\n⏰ Time: ${timeStr}\n📱 Session: ${sessionName}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n👤 नाम (Name): ${state.name}\n👨 पिता (Father): ${state.father}\n📞 मोबाइल (Mobile): +91${state.mobile}\n📖 पुस्तक (Book): ${state.bookName}\n🌐 भाषा (Language): ${state.language}\n📍 पता (Address): ${state.fullAddress}\n📮 क्षेत्र (Area): ${state.selectedLocation}\n📮 पिनकोड (Pincode): ${state.pincode}\n🏘️ जिला (District): ${state.district}\n🗺️ राज्य (State): ${state.stateName}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
      
      // Forward to Main Admin
      try {
        if (CONFIG.ADMIN && CONFIG.ADMIN.JID) {
          await sock.sendMessage(CONFIG.ADMIN.JID, { text: fwMsg });
          console.log('✅ Order forwarded to main admin');
        }
      } catch (e) {
        console.error('❌ Main admin forward error:', e.message);
      }
      
      // Forward to Session Admin (if exists)
      try {
        const sessionAdmin = await getSessionAdmin(sessionName);
        if (sessionAdmin && sessionAdmin !== CONFIG.ADMIN.JID) {
          await sock.sendMessage(sessionAdmin, { text: fwMsg });
          console.log(`✅ Order forwarded to session admin: ${sessionAdmin}`);
        }
      } catch (e) {
        console.error('❌ Session admin forward error:', e.message);
      }
      
      // Forward to Group
      await sendToOrderGroup(sock, sessionName, fwMsg);
      
      userOrderCompleted.set(from, Date.now());
      userStates.delete(from);
      if (reminderTimeouts.has(from)) clearTimeout(reminderTimeouts.get(from));
      return;
    }

  } catch (err) {
    console.error('Handler error:', err);
    try {
      const from = msg.key?.remoteJid ?? msg.key?.participant ?? '';
      if (from && !from.endsWith('@g.us')) {
        await sock.sendMessage(from, { text: `❌ त्रुटि आई! (Error occurred!)\nफिर से try करें। (Please try again.)` });
        userStates.delete(from);
        if (reminderTimeouts.has(from)) clearTimeout(reminderTimeouts.get(from));
      }
    } catch (e2) {
      console.error('Error in error handler:', e2);
    }
  }
}
