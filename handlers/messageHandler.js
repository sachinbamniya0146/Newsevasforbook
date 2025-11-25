import { fetchPinDetails } from '../utils/pincodeHelper.js';
import { saveOrder } from '../utils/database.js';
import { sendToOrderGroup } from '../utils/groupManager.js';
import CONFIG from '../config.js';
import fs from 'fs';

const userStates = new Map();
const orderCounters = new Map();
const reminderTimeouts = new Map();
const userOrderCompleted = new Map();
const duplicateOrders = new Map();

// 📚 Enhanced Book Descriptions
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
  const yes = ['1','yes','ok','haan','ha','हाँ','done','order','yes.','ok.','haan.','haa','y','Y','ha.','ہاں','ji','जी','han','theek','sahi','right','correct'];
  return yes.includes(txt.trim().toLowerCase());
}

function isNo(txt) {
  const no = ['2','no','nahi','ना','नहीं','no.','nahi.','nope','नहि','n','N','nhi','cancel','نہیں','galat','wrong'];
  return no.includes(txt.trim().toLowerCase());
}

function isBack(txt) {
  const back = ['back','वापस','peeche','0','⬅️','पीछे','vapas','previous'];
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

function getTotalOrders() {
  let total = 0;
  orderCounters.forEach(count => total += count);
  return total;
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

// Realistic typing simulation
async function sendTyping(sock, from, duration = 2000) {
  try {
    await sock.sendPresenceUpdate('composing', from);
    await new Promise(r => setTimeout(r, duration));
    await sock.sendPresenceUpdate('paused', from);
  } catch (e) {
    console.error('Typing simulation error:', e);
  }
}

// Progressive loading messages
async function showProgressiveLoading(sock, from, messages, delays) {
  for (let i = 0; i < messages.length; i++) {
    await sendTyping(sock, from, delays[i] || 1500);
    await sock.sendMessage(from, { text: messages[i] });
    if (i < messages.length - 1) {
      await new Promise(r => setTimeout(r, 800));
    }
  }
}

function scheduleReminder(sock, from, state, sessionName, isAdmin) {
  if (reminderTimeouts.has(from)) clearTimeout(reminderTimeouts.get(from));
  const reminderTime = 6 * 60 * 60 * 1000;
  reminderTimeouts.set(from, setTimeout(async () => {
    if (userStates.has(from)) {
      const imgPath = getRotatedImage(from);
      let remTxt = isAdmin
        ? `🛠️ *[Admin Test Mode Reminder]*\n\nआप अभी भी Test-Mode में हैं।\n(You are still in Test Mode!)\n\n(Reply 'exit' या 0 छोड़ने के लिए)`
        : `🙏 आपकी निःशुल्क पुस्तक का ऑर्डर अधूरा है!\n\nYour free book order is pending.\n\nकृपया reply करें शुरू करने हेतु।`;
      if (imgPath && fs.existsSync(imgPath)) {
        await sock.sendMessage(from, { image: { url: imgPath }, caption: remTxt });
      } else {
        await sock.sendMessage(from, { text: remTxt });
      }
    }
  }, reminderTime));
}

async function handleAdminCommands(sock, from, text) {
  const cmd = text.toLowerCase().trim();
  
  if (cmd === 'report' || cmd === 'stats' || cmd === 'status') {
    const total = getTotalOrders();
    let sessionReport = '*📊 Session-wise Order Report:*\n\n';
    orderCounters.forEach((count, session) => {
      sessionReport += `📱 ${session}: ${count} orders\n`;
    });
    
    const reportMsg = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📈 *Order Statistics Report*\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📦 *Total Orders:* ${total}\n\n${sessionReport}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n👥 *Active Users:* ${userStates.size}\n\n🔄 *Completed Orders:* ${userOrderCompleted.size}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📅 Date: ${new Date().toLocaleDateString('hi-IN')}\n⏰ Time: ${new Date().toLocaleTimeString('hi-IN')}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    await sock.sendMessage(from, { text: reportMsg });
    return true;
  }
  
  if (cmd === 'help' || cmd === 'commands') {
    const helpMsg = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n🛠️ *Admin Commands*\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📊 *report* - Order statistics\n📈 *stats* - Same as report\n📋 *status* - System status\n\n🧪 *test* - Enter test mode\n🚫 *exit* - Exit test mode\n\n❓ *help* - Show this menu\n📜 *commands* - Show commands\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    
    await sock.sendMessage(from, { text: helpMsg });
    return true;
  }
  
  return false;
}

async function resendMenu(sock, from, state) {
  const step = state.step;
  if (step === 'awaiting_book' || step === 'awaiting_pdf_book') {
    const randomDesc = getRandomDescription();
    const welcome = `🙏 *नमस्ते! Namaste!*\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📚 *संत रामपाल जी महाराज* की निःशुल्क पुस्तक सेवा\n\n_Free Book Service by Sant Rampal Ji Maharaj_\n\n📦 पुस्तक *20 दिनों में निःशुल्क* घर पहुंचेगी!\n\n_Book will reach home in 20 days - completely FREE!_\n\n🆓 *बिल्कुल निःशुल्क! कोई चार्ज नहीं!*\n\n_Absolutely FREE! No charges!_\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📖 *पुस्तक में क्या है?*\n\n${randomDesc}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n*कौनसी पुस्तक चाहिए?*\n\n_Which book would you like?_\n\n1️⃣ ज्ञान गंगा (Gyan Ganga)\n\n2️⃣ जीने की राह (Way of Living)\n\n3️⃣ पहले PDF देखना चाहते हैं? (Want to see PDF first?)\n\n*1 भेजें यदि ज्ञान गंगा चाहिए*\n\n*2 भेजें यदि जीने की राह चाहिए*\n\n*3 या pdf भेजें यदि पहले पुस्तक देखना चाहते हैं*`;
    await sock.sendMessage(from, { text: welcome });
  } else if (step === 'awaiting_language') {
    const bookName = state.bookName || 'ज्ञान गंगा';
    const langs = state.availableLangs || (CONFIG.BOOK_PDFS && CONFIG.BOOK_PDFS[bookName] ? Object.keys(CONFIG.BOOK_PDFS[bookName]) : ['हिंदी', 'English']);
    let langMenu = "";
    langs.forEach((lang, i) => langMenu += `${i + 1}. ${lang}\n`);
    await sock.sendMessage(from, { text: `✅ *${bookName}* चुना।\n\n✍️ लेखक: संत रामपाल जी महाराज\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nकिस भाषा में?\n\nWhich language?\n\n${langMenu}\nभाषा का नंबर भेजें (Send language number)` });
  } else if (step === 'awaiting_name') {
    await sock.sendMessage(from, { text: `✅ भाषा: *${state.language || 'हिंदी'}*\n\nअब अपना *पूरा नाम* भेजें:\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nYour Full Name:\n\nउदाहरण (Example): राज कुमार शर्मा` });
  } else if (step === 'confirm_name') {
    await sock.sendMessage(from, { text: `नाम (Name): *${state.name}*\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nक्या सही है? | Is it correct?\n\n✅ सही है तो: *1* / "हाँ" / "Yes"\n\n❌ बदलना है तो: *2* / "नहीं" / "No"` });
  } else if (step === 'awaiting_father') {
    await sock.sendMessage(from, { text: `अब अपने *पिता का नाम* लिखें:\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nFather's Name:\n\nउदाहरण (Example): संतोष कुमार शर्मा` });
  } else if (step === 'confirm_father') {
    await sock.sendMessage(from, { text: `पिता का नाम (Father's Name): *${state.father}*\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nक्या सही है? | Is it correct?\n\n✅ सही है तो: *1* / "हाँ" / "Yes"\n\n❌ बदलना है तो: *2* / "नहीं" / "No"` });
  } else if (step === 'awaiting_mobile') {
    await sock.sendMessage(from, { text: `अब *मोबाइल नंबर* (10-digit) भेजें:\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nMobile Number:\n\nउदाहरण (Example): 9876543210` });
  } else if (step === 'confirm_mobile') {
    await sock.sendMessage(from, { text: `मोबाइल नंबर (Mobile): *${state.mobile}*\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nक्या सही है? | Is it correct?\n\n✅ सही है तो: *1* / "हाँ" / "Yes"\n\n❌ बदलना है तो: *2* / "नहीं" / "No"` });
  } else if (step === 'awaiting_pincode') {
    await sock.sendMessage(from, { text: `अब *पिनकोड* (6-digit) भेजें:\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nPincode:\n\nउदाहरण (Example): 465227` });
  } else if (step === 'confirm_pincode') {
    await sock.sendMessage(from, { text: `पिनकोड (Pincode): *${state.pincode}*\n\n📍 जिला (District): ${state.district || ''}\n\n📍 राज्य (State): ${state.stateName || ''}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nक्या यह पिनकोड सही है?\n\nIs this pincode correct?\n\n✅ सही है तो: *1* / "हाँ" / "Yes"\n\n❌ बदलना है तो: *2* / "नहीं" / "No"` });
  } else if (step === 'awaiting_block') {
    let menu = "";
    if (state.blocks && state.blocks.length) {
      state.blocks.forEach((block, i) => menu += `${i + 1}. ${block}\n`);
    }
    await sock.sendMessage(from, { text: `✅ पिनकोड: *${state.pincode}*\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n🏛️ *अपना तहसील/ब्लॉक चुनें:*\n\n_Select your Tehsil/Block:_\n\n${menu}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nनंबर भेजें (Send number)\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
  } else if (step === 'awaiting_postoffice') {
    let menu = "";
    if (state.postOffices && state.postOffices.length) {
      state.postOffices.forEach((po, i) => menu += `${i + 1}. ${po.name}\n`);
    }
    await sock.sendMessage(from, { text: `✅ तहसील/ब्लॉक: *${state.selectedBlock}*\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📮 *अपना Post Office चुनें:*\n\n_Select your Post Office:_\n\n${menu}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nनंबर भेजें (Send number)\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
  } else if (step === 'awaiting_village') {
    let menu = "";
    if (state.villages && state.villages.length) {
      state.villages.forEach((v, i) => menu += `${i + 1}. ${v}\n`);
    }
    await sock.sendMessage(from, { text: `✅ Post Office: *${state.selectedPostOffice}*\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n🏘️ *अपना गांव/शहर चुनें:*\n\n_Select your village/city:_\n\n${menu}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nनंबर भेजें (Send number)\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
  } else if (step === 'awaiting_confirmation') {
    await sock.sendMessage(from, { text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📋 *ऑर्डर कन्फर्मेशन*\n\n_Order Confirmation_\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nनाम (Name): ${state.name}\n\nपिता (Father): ${state.father}\n\nमोबाइल (Mobile): +91${state.mobile}\n\nपुस्तक (Book): ${state.bookName}\n\nभाषा (Language): ${state.language}\n\nतहसील/ब्लॉक (Tehsil/Block): ${state.selectedBlock}\n\nPost Office: ${state.selectedPostOffice}\n\nपता (Address): ${state.address}\n\nपिनकोड (Pincode): ${state.pincode}\n\nजिला (District): ${state.district}\n\nराज्य (State): ${state.stateName}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━` });
    await sock.sendMessage(from, { text: `✅ *Order Done* के लिए: *1* / "yes" / "order" / "done"\n\n❌ *Cancel* के लिए: *2* / "no" / "cancel"\n\nअपना जवाब भेजें (Send your reply):\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
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

    // Admin Commands Handler
    if (isAdmin && !state.testMode) {
      const handled = await handleAdminCommands(sock, from, text);
      if (handled) return;
    }

    // Admin Test Mode Handler
    if (isAdmin) {
      let imgPath = getRotatedImage(from);
      if (!state.testMode) {
        if (text.toLowerCase() === "test" || text === "1") {
          state.testMode = true;
          userStates.set(from, state);
          if (imgPath && fs.existsSync(imgPath)) {
            await sock.sendMessage(from, { image: { url: imgPath }, caption: `🛠️ *Test Mode activated for admin!*\n\nहर message पर image जाएगा।\n\n(Reply '0'/exit to leave)` });
          } else {
            await sock.sendMessage(from, { text: `🛠️ *Test Mode activated for admin!*\n\n(Reply '0'/exit to leave)` });
          }
          scheduleReminder(sock, from, state, sessionName, true);
          return;
        }
        if (imgPath && fs.existsSync(imgPath)) {
          await sock.sendMessage(from, { image: { url: imgPath }, caption: `✅ Admin verified!\n\n🧪 Test Mode: *test* या *1*\n📊 Report: *report* या *stats*\n❓ Help: *help* या *commands*` });
        } else {
          await sock.sendMessage(from, { text: `✅ Admin verified!\n\n🧪 Test Mode: *test* या *1*\n📊 Report: *report* या *stats*\n❓ Help: *help* या *commands*` });
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
        await sock.sendMessage(from, { image: { url: imgPath }, caption: `🔁 *[Test Mode]*\n\nAdmin message: "${text}"\n\n(Reply '0'/exit to leave)` });
      } else {
        await sock.sendMessage(from, { text: `🔁 *[Test Mode]*\n\nAdmin message: "${text}"\n\n(Reply '0'/exit to leave)` });
      }
      scheduleReminder(sock, from, state, sessionName, true);
      return;
    }

    // Duplicate Order Check
    if (userOrderCompleted.has(from)) {
      const lastOrder = userOrderCompleted.get(from);
      const diff = Date.now() - lastOrder;
      const sixh = 6 * 60 * 60 * 1000;
      if (diff < sixh) {
        const imgPath = getRotatedImage(from);
        const remindText = `🙏 आपका ऑर्डर पहले ही दर्ज हो चुका है!\n\nYour order is already placed!\n\nनया ऑर्डर ${Math.ceil((sixh - diff) / (60 * 60 * 1000))} घंटे बाद कर सकते हैं।\n\nYou can place new order after ${Math.ceil((sixh - diff) / (60 * 60 * 1000))} hours.`;
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

    // New User Welcome
    if (!userStates.has(from)) {
      let auto = autoBook(text);
      const imgPath = getRotatedImage(from);
      const randomDesc = getRandomDescription();
      let welcome = `🙏 *नमस्ते! Namaste!*\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📚 *संत रामपाल जी महाराज* की निःशुल्क पुस्तक सेवा\n\n_Free Book Service by Sant Rampal Ji Maharaj_\n\n📦 पुस्तक *20 दिनों में निःशुल्क* घर पहुंचेगी!\n\n_Book will reach home in 20 days - completely FREE!_\n\n🆓 *बिल्कुल निःशुल्क! कोई चार्ज नहीं!*\n\n_Absolutely FREE! No charges!_\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📖 *पुस्तक में क्या है?*\n\n${randomDesc}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n*कौनसी पुस्तक चाहिए?*\n\n_Which book would you like?_\n\n1️⃣ ज्ञान गंगा (Gyan Ganga)\n\n2️⃣ जीने की राह (Way of Living)\n\n3️⃣ पहले PDF देखना चाहते हैं? (Want to see PDF first?)\n\n*1 भेजें यदि ज्ञान गंगा चाहिए*\n\n*2 भेजें यदि जीने की राह चाहिए*\n\n*3 या pdf भेजें यदि पहले पुस्तक देखना चाहते हैं*`;
      
      await sendTyping(sock, from, 2000);
      
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

    // Back Navigation
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
        confirm_pincode: 'awaiting_pincode',
        awaiting_block: 'confirm_pincode',
        awaiting_postoffice: 'awaiting_block',
        awaiting_village: 'awaiting_postoffice',
        awaiting_confirmation: 'awaiting_village',
        awaiting_pdf_language: 'awaiting_pdf_book',
        pdf_shown: 'awaiting_book'
      };
      if (prev[state.step]) {
        state.step = prev[state.step];
        userStates.set(from, state);
        await sock.sendMessage(from, { text: `⬅️ पिछला स्टेप चालू हो गया!\n\n_Previous step resumed!_\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━` });
        await resendMenu(sock, from, state);
      }
      return;
    }

    // PDF Book Selection
    if (state.step === 'awaiting_pdf_book') {let book = null;
      if (text === '1') book = 'ज्ञान गंगा';
      else if (text === '2') book = 'जीने की राह';
      else book = autoBook(text);
      if (!book) {
        const randomDesc = getRandomDescription();
        await sock.sendMessage(from, { text: `कौनसी पुस्तक का PDF देखना चाहते हैं?\n\nWhich book PDF do you want to see?\n\n📖 ${randomDesc}\n\n1️⃣ ज्ञान गंगा (Gyan Ganga)\n\n2️⃣ जीने की राह (Way of Living)\n\n1 या 2 भेजें (Send 1 or 2)\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }
      state.pdfBook = book;
      const langs = CONFIG.BOOK_PDFS && CONFIG.BOOK_PDFS[book] ? Object.keys(CONFIG.BOOK_PDFS[book]) : ['हिंदी', 'English'];
      let langMenu = "";
      langs.forEach((lang, i) => langMenu += `${i + 1}. ${lang}\n`);
      
      await sendTyping(sock, from, 1500);
      await sock.sendMessage(from, { text: `✅ *${book}* PDF\n\nकिस भाषा में पढ़ना चाहते हैं?\n\nWhich language?\n\n${langMenu}\nभाषा का नंबर भेजें (Send language number)\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
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
      
      await sendTyping(sock, from, 2000);
      
      if (pdfLink) {
        await sock.sendMessage(from, { text: `📖 *${state.pdfBook} (${langSelected})* PDF:\n\n${pdfLink}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📚 *इस पुस्तक में:*\n\n${randomDesc}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📚 कृपया PDF देखें और हमें बताएं!\n\nPlease view the PDF and let us know!\n\n📦 अगर आपको *निःशुल्क पुस्तक* चाहिए (20 दिनों में घर पहुंचेगी), तो अपना नाम, पता भेजें।\n\nIf you want the *free physical book* (will reach home in 20 days), send us your name & address.\n\n1️⃣ ज्ञान गंगा (Gyan Ganga) के लिए 1 भेजें\n\n2️⃣ जीने की राह (Way of Living) के लिए 2 भेजें\n\nया पुस्तक का नाम लिखें। (Or write book name directly)` });
      }
      state.step = 'pdf_shown';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }

    // PDF Shown - Book Selection
    if (state.step === 'pdf_shown') {
      let book = null;
      if (text === '1') book = 'ज्ञान गंगा';
      else if (text === '2') book = 'जीने की राह';
      else book = autoBook(text);
      if (!book) {
        const randomDesc = getRandomDescription();
        await sock.sendMessage(from, { text: `कौनसी पुस्तक ऑर्डर करना चाहते हैं?\n\nWhich book do you want to order?\n\n📖 ${randomDesc}\n\n1️⃣ ज्ञान गंगा\n\n2️⃣ जीने की राह\n\n1 या 2 भेजें\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }
      state.bookName = book;
      const langs = CONFIG.BOOK_PDFS && CONFIG.BOOK_PDFS[book] ? Object.keys(CONFIG.BOOK_PDFS[book]) : ['हिंदी', 'English'];
      let langMenu = "";
      langs.forEach((lang, i) => langMenu += `${i + 1}. ${lang}\n`);
      
      await sendTyping(sock, from, 1500);
      await sock.sendMessage(from, { text: `✅ *${book}* चुना।\n\n✍️ लेखक: संत रामपाल जी महाराज\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nकिस भाषा में?\n\nWhich language?\n\n${langMenu}\nभाषा का नंबर भेजें (Send language number)\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
      state.availableLangs = langs;
      state.step = 'awaiting_language';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }

    // Book Selection
    if (state.step === 'awaiting_book') {
      let book = null;
      if (text === '1') book = 'ज्ञान गंगा';
      else if (text === '2') book = 'जीने की राह';
      else if (text.toLowerCase() === 'pdf' || text === '3') {
        state.step = 'awaiting_pdf_book';
        userStates.set(from, state);
        const randomDesc = getRandomDescription();
        await sendTyping(sock, from, 1500);
        await sock.sendMessage(from, { text: `📖 पहले PDF देखना चाहते हैं!\n\nYou want to see PDF first!\n\n${randomDesc}\n\nकौनसी पुस्तक का PDF?\n\nWhich book PDF?\n\n1️⃣ ज्ञान गंगा\n\n2️⃣ जीने की राह\n\n1 या 2 भेजें (Send 1 or 2)\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      } else {
        book = autoBook(text);
      }
      if (!book) {
        const randomDesc = getRandomDescription();
        await sock.sendMessage(from, { text: `❌ कृपया 1, 2, या 3/pdf भेजें।\n\n_Send 1, 2, or 3/pdf._\n\n📖 ${randomDesc}\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }
      state.bookName = book;
      const langs = CONFIG.BOOK_PDFS && CONFIG.BOOK_PDFS[book] ? Object.keys(CONFIG.BOOK_PDFS[book]) : ['हिंदी', 'English'];
      let langMenu = "";
      langs.forEach((lang, i) => langMenu += `${i + 1}. ${lang}\n`);
      
      await sendTyping(sock, from, 1500);
      await sock.sendMessage(from, { text: `✅ *${book}* चुना।\n\n✍️ लेखक: संत रामपाल जी महाराज\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nकिस भाषा में?\n\nWhich language?\n\n${langMenu}\nभाषा का नंबर भेजें (Send language number)\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
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
      
      await sendTyping(sock, from, 1200);
      await sock.sendMessage(from, { text: `✅ भाषा (Language): *${state.language}*\n\nअब अपना *पूरा नाम* भेजें:\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nYour Full Name:\n\nउदाहरण (Example): राज कुमार शर्मा\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
      state.step = 'awaiting_name';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }

    // Name Input
    if (state.step === 'awaiting_name') {
      state.name = text;
      
      await sendTyping(sock, from, 1000);
      await sock.sendMessage(from, { text: `नाम (Name): *${state.name}*\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nक्या आपने सही (Correct) नाम लिखा है?\n\nIs the name above correct?\n\n✅ सही है तो reply करें: *1* / "हाँ" / "Yes"\n\n❌ बदलना है तो reply करें: *2* / "नहीं" / "No"\n\nउदाहरण (Example): 1\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
      state.step = 'confirm_name';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }

    // Name Confirmation
    if (state.step === 'confirm_name') {
      if (isNo(text)) {
        state.step = 'awaiting_name';
        await sock.sendMessage(from, { text: `🔄 कोई बात नहीं! (No problem!)\n\nकृपया फिर से अपना *पूरा नाम* लिखें:\n\nRe-enter your full name:\n\nउदाहरण (Example): राज कुमार शर्मा\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
        userStates.set(from, state);
        return;
      }
      if (!isYes(text)) {
        await sock.sendMessage(from, { text: `कृपया सही जवाब दें:\n\n✅ सही है तो: *1* / "हाँ" / "Yes"\n\n❌ नहीं तो: *2* / "नहीं" / "No"\n\nPlease reply *1* (Yes) or *2* (No)\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }
      
      await sendTyping(sock, from, 1000);
      await sock.sendMessage(from, { text: `अब अपने *पिता का नाम* लिखें:\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nFather's Name:\n\nउदाहरण (Example): संतोष कुमार शर्मा\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
      state.step = 'awaiting_father';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }

    // Father Name Input
    if (state.step === 'awaiting_father') {
      state.father = text;
      
      await sendTyping(sock, from, 1000);
      await sock.sendMessage(from, { text: `पिता का नाम (Father's Name): *${state.father}*\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nक्या ऊपर लिखा *पिता का नाम* सही है?\n\nIs your father's name correct?\n\n✅ सही है तो reply करें: *1* / "हाँ" / "Yes"\n\n❌ बदलना है तो reply करें: *2* / "नहीं" / "No"\n\nउदाहरण (Example): 1\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
      state.step = 'confirm_father';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }

    // Father Name Confirmation
    if (state.step === 'confirm_father') {
      if (isNo(text)) {
        state.step = 'awaiting_father';
        await sock.sendMessage(from, { text: `🔄 कोई बात नहीं! (No problem!)\n\nफिर से *पिता का नाम* लिखें:\n\nRe-enter father's name:\n\nउदाहरण (Example): संतोष कुमार\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
        userStates.set(from, state);
        return;
      }
      if (!isYes(text)) {
        await sock.sendMessage(from, { text: `कृपया सही जवाब दें:\n\n✅ सही है तो: *1* / "हाँ" / "Yes"\n\n❌ नहीं तो: *2* / "नहीं" / "No"\n\nPlease reply *1* (Yes) or *2* (No)\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }
      
      await sendTyping(sock, from, 1000);
      await sock.sendMessage(from, { text: `अब *मोबाइल नंबर* (10-digit) भेजें:\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nMobile Number:\n\nउदाहरण (Example): 9876543210\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
      state.step = 'awaiting_mobile';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }

    // Mobile Input
    if (state.step === 'awaiting_mobile') {
      const mob = text.replace(/[^0-9]/g, "");
      if (mob.length !== 10) {
        await sock.sendMessage(from, { text: `❌ 10 अंक का नंबर दें\n\n(Enter 10-digit mobile number)\n\nउदाहरण (Example): 9876543210\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }
      const dupKey = `${state.name.toLowerCase().trim()}_${mob}`;
      if (duplicateOrders.has(dupKey)) {
        await sock.sendMessage(from, { text: `⚠️ *आपने पहले ही ऑर्डर कर दिया है!*\n\nYou have already placed an order before!\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nअब आप मुफ्त में पुस्तक नहीं ले सकते हैं।\n\nYou cannot get a free book again.\n\nअगर कोई पड़ोसी/मित्र को निःशुल्क पुस्तक देनी है, तो उनके नंबर से हमें मैसेज करवा दो।\n\nIf you want to send a free book to a neighbor/friend, ask them to message us from their number.\n\n🙏 धन्यवाद! Thank you!` });
        userStates.delete(from);
        if (reminderTimeouts.has(from)) clearTimeout(reminderTimeouts.get(from));
        return;
      }
      state.mobile = mob;
      
      await sendTyping(sock, from, 1000);
      await sock.sendMessage(from, { text: `मोबाइल नंबर (Mobile): *${state.mobile}*\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nक्या यह मोबाइल नंबर सही है?\n\nIs this mobile number correct?\n\n✅ सही है तो: *1* / "हाँ" / "Yes"\n\n❌ नहीं तो: *2* / "नहीं" / "No"\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
      state.step = 'confirm_mobile';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }

    // Mobile Confirmation
    if (state.step === 'confirm_mobile') {
      if (isNo(text)) {
        state.step = 'awaiting_mobile';
        await sock.sendMessage(from, { text: `फिर से 10-digit मोबाइल नंबर भेजें:\n\nRe-enter 10-digit mobile:\n\nउदाहरण (Example): 9876543210\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
        userStates.set(from, state);
        return;
      }
      if (!isYes(text)) {
        await sock.sendMessage(from, { text: `कृपया *1* (Yes/हाँ) या *2* (No/नहीं) भेजें।\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }
      
      await sendTyping(sock, from, 1000);
      await sock.sendMessage(from, { text: `अब *पिनकोड* (6-digit) भेजें:\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nPincode:\n\nउदाहरण (Example): 465227\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
      state.step = 'awaiting_pincode';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }

    // Pincode Input
    if (state.step === 'awaiting_pincode') {
      const pin = text.replace(/[^0-9]/g, "");
      if (pin.length !== 6) {
        await sock.sendMessage(from, { text: `❌ 6 अंक का पिनकोड दर्ज करें\n\n(Enter 6-digit pincode)\n\nउदाहरण (Example): 465227\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }
      
      // Progressive loading simulation
      await showProgressiveLoading(sock, from, [
        `⏳ कृपया प्रतीक्षा करें...\n\n_Please wait..._\n\n🔍 पिनकोड की जानकारी खोज रहे हैं।\n\nSearching pincode details.`,
        `📡 सर्वर से कनेक्ट हो रहे हैं...\n\n_Connecting to server..._\n\n⏳ थोड़ा इंतज़ार करें।\n\nPlease hold on.`,
        `🔄 डेटा प्राप्त कर रहे हैं...\n\n_Fetching data..._\n\n✨ लगभग तैयार है।\n\nAlmost ready.`
      ], [1800, 1600, 1400]);
      
      let pinData = null;
      for (let i = 0; i < 10; i++) {
        const pinInfo = await fetchPinDetails(pin);
        if (pinInfo && pinInfo.success) {
          pinData = pinInfo;
          break;
        }
        await new Promise(r => setTimeout(r, 900));
      }
      
      if (!pinData || !pinData.postOffices || !pinData.postOffices.length) {
        await sock.sendMessage(from, { text: `❌ पिनकोड verify नहीं हुआ। फिर से try करें।\n\n(Pincode verification failed. Try again.)\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }
      
      state.pincode = pin;
      state.district = pinData.district || '';
      state.stateName = pinData.state || '';
      state.postOffices = pinData.postOffices;
      
      // Extract unique blocks/tehsils from post offices
      const blocksSet = new Set();
      pinData.postOffices.forEach(po => {
        if (po.block) blocksSet.add(po.block);
      });
      state.blocks = Array.from(blocksSet).sort();
      
      // If no blocks found, use district as default
      if (state.blocks.length === 0) {
        state.blocks = [state.district || 'मुख्य क्षेत्र / Main Area'];
      }
      
      await sendTyping(sock, from, 1500);
      await sock.sendMessage(from, { text: `✅ पिनकोड सत्यापित! (Pincode Verified!)\n\n📍 पिनकोड (Pincode): *${pin}*\n\n📍 जिला (District): *${state.district}*\n\n📍 राज्य (State): *${state.stateName}*\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nक्या यह पिनकोड सही है?\n\nIs this pincode correct?\n\n✅ सही है तो: *1* / "हाँ" / "Yes"\n\n❌ बदलना है तो: *2* / "नहीं" / "No"\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
      
      state.step = 'confirm_pincode';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }

    // Pincode Confirmation
    if (state.step === 'confirm_pincode') {
      if (isNo(text)) {
        state.step = 'awaiting_pincode';
        await sock.sendMessage(from, { text: `फिर से 6-digit पिनकोड भेजें:\n\nRe-enter 6-digit pincode:\n\nउदाहरण (Example): 465227\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
        userStates.set(from, state);
        return;
      }
      if (!isYes(text)) {
        await sock.sendMessage(from, { text: `कृपया *1* (Yes/हाँ) या *2* (No/नहीं) भेजें।\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }
      
      let blockMenu = "";
      if (state.blocks && state.blocks.length) {
        state.blocks.forEach((block, i) => blockMenu += `${i + 1}. ${block}\n`);
      }
      
      await sendTyping(sock, from, 1500);
      await sock.sendMessage(from, { text: `✅ पिनकोड: *${state.pincode}*\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n🏛️ *अपना तहसील/ब्लॉक चुनें:*\n\n_Select your Tehsil/Block:_\n\n${blockMenu}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nनंबर भेजें (Send number)\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
      
      state.step = 'awaiting_block';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }

    // Block/Tehsil Selection
    if (state.step === 'awaiting_block') {
      let selectedBlock = null;
      const idx = parseInt(text) - 1;
      
      if (!isNaN(idx) && idx >= 0 && state.blocks && idx < state.blocks.length) {
        selectedBlock = state.blocks[idx];
      } else if (state.blocks) {
        const match = state.blocks.find(b => 
          b.toLowerCase().includes(text.toLowerCase())
        );
        if (match) selectedBlock = match;
      }
      
      if (!selectedBlock) {
        await sock.sendMessage(from, { text: `❌ सही नंबर भेजें। (Send correct number from list)\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }
      
      state.selectedBlock = selectedBlock;
      
      // Filter post offices by selected block
      state.filteredPostOffices = state.postOffices.filter(po => 
        po.block === selectedBlock || !po.block
      );
      
      if (!state.filteredPostOffices.length) {
        state.filteredPostOffices = state.postOffices;
      }
      
      let poMenu = "";
      state.filteredPostOffices.forEach((po, i) => poMenu += `${i + 1}. ${po.name}\n`);
      
      await sendTyping(sock, from, 1500);
      await sock.sendMessage(from, { text: `✅ तहसील/ब्लॉक: *${state.selectedBlock}*\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📮 *अपना Post Office चुनें:*\n\n_Select your Post Office:_\n\n${poMenu}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nनंबर भेजें (Send number)\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
      
      state.step = 'awaiting_postoffice';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }

    // Post Office Selection
    if (state.step === 'awaiting_postoffice') {
      let selectedPO = null;
      const idx = parseInt(text) - 1;
      
      if (!isNaN(idx) && idx >= 0 && state.filteredPostOffices && idx < state.filteredPostOffices.length) {
        selectedPO = state.filteredPostOffices[idx];
      } else if (state.filteredPostOffices) {
        const match = state.filteredPostOffices.find(po => 
          po.name.toLowerCase().includes(text.toLowerCase())
        );
        if (match) selectedPO = match;
      }
      
      if (!selectedPO) {
        await sock.sendMessage(from, { text: `❌ सही नंबर भेजें। (Send correct number from list)\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }
      
      state.selectedPostOffice = selectedPO.name;
      state.villages = selectedPO.villages || [];
      
      if (!state.villages.length) {
        await sock.sendMessage(from, { text: `❌ इस Post Office में कोई गांव/शहर नहीं मिला।\n\nNo villages/cities found for this post office.\n\nकृपया दूसरा Post Office चुनें।\n\nPlease select another post office.\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }
      
      let villageMenu = "";
      state.villages.forEach((v, i) => villageMenu += `${i + 1}. ${v}\n`);
      
      await sendTyping(sock, from, 1500);
      await sock.sendMessage(from, { text: `✅ Post Office: *${state.selectedPostOffice}*\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n🏘️ *अपना गांव/शहर चुनें:*\n\n_Select your village/city:_\n\n${villageMenu}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nनंबर भेजें (Send number)\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
      
      state.step = 'awaiting_village';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }

    // Village Selection
    if (state.step === 'awaiting_village') {
      let sel = null;
      const idx = parseInt(text) - 1;
      
      if (!isNaN(idx) && idx >= 0 && state.villages && idx < state.villages.length) {
        sel = state.villages[idx];
      } else if (state.villages) {
        const match = state.villages.find(v => v.toLowerCase().includes(text.toLowerCase()));
        if (match) sel = match;
      }
      
      if (!sel) {
        await sock.sendMessage(from, { text: `❌ सही नंबर भेजें। (Send correct number from list)\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }
      
      state.address = sel;
      
      await sendTyping(sock, from, 2000);
      await sock.sendMessage(from, { text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📋 *ऑर्डर कन्फर्मेशन*\n\n_Order Confirmation_\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n👤 नाम (Name): ${state.name}\n\n👨 पिता (Father): ${state.father}\n\n📞 मोबाइल (Mobile): +91${state.mobile}\n\n📚 पुस्तक (Book): ${state.bookName}\n\n🌐 भाषा (Language): ${state.language}\n\n🏛️ तहसील/ब्लॉक (Tehsil/Block): ${state.selectedBlock}\n\n📮 Post Office: ${state.selectedPostOffice}\n\n🏘️ पता (Address): ${state.address}\n\n📮 पिनकोड (Pincode): ${state.pincode}\n\n🏛️ जिला (District): ${state.district}\n\n🗺️ राज्य (State): ${state.stateName}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📦 पुस्तक *20 दिनों में निःशुल्क* घर पहुंचेगी।\n\nBook will reach your home in *20 days - FREE!*\n\n🆓 *बिल्कुल निःशुल्क!*\n\n_Completely FREE!_\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━` });
      
      await new Promise(r => setTimeout(r, 1000));
      await sock.sendMessage(from, { text: `✅ *Order Done* के लिए: *1* / "yes" / "order" / "done"\n\n❌ *Cancel* के लिए: *2* / "no" / "cancel"\n\nअपना जवाब भेजें (Send your reply):\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
      
      state.step = 'awaiting_confirmation';
      userStates.set(from, state);
      scheduleReminder(sock, from, state, sessionName, false);
      return;
    }

    // Final Confirmation
    if (state.step === 'awaiting_confirmation') {
      if (isNo(text)) {
        await sock.sendMessage(from, { text: `❌ ऑर्डर रद्द!\n\nOrder Cancelled!\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nकोई बात नहीं! फिर से शुरू करने के लिए कोई भी मैसेज भेजें।\n\nNo problem! Send any message to start again.` });
        userStates.delete(from);
        if (reminderTimeouts.has(from)) clearTimeout(reminderTimeouts.get(from));
        return;
      }
      
      if (!isYes(text)) {
        await sock.sendMessage(from, { text: `कृपया *1*/yes/order/done या *2*/no/cancel भेजें\n\n(Please send *1* to confirm or *2* to cancel)\n\n⬅️ पीछे जाने के लिए *0* भेजें` });
        return;
      }
      
      // Show processing animation
      await showProgressiveLoading(sock, from, [
        `⏳ ऑर्डर प्रोसेस हो रहा है...\n\n_Processing your order..._\n\n🔄 कृपया प्रतीक्षा करें।\n\nPlease wait.`,
        `✨ विवरण सहेजा जा रहा है...\n\n_Saving details..._\n\n📝 लगभग पूरा हो गया।\n\nAlmost complete.`,
        `🎯 ऑर्डर फाइनल हो रहा है...\n\n_Finalizing order..._\n\n✅ बस हो गया!\n\nJust done!`
      ], [1500, 1300, 1200]);
      
      const dupKey = `${state.name.toLowerCase().trim()}_${state.mobile}`;
      duplicateOrders.set(dupKey, Date.now());
      
      const orderData = {
        name: state.name,
        father: state.father,
        mobile: state.mobile,
        bookName: state.bookName,
        language: state.language,
        block: state.selectedBlock,
        postOffice: state.selectedPostOffice,
        address: state.address,
        pincode: state.pincode,
        district: state.district,
        stateName: state.stateName,
        whatsapp: from,
        timestamp: new Date().toISOString()
      };
      
      await saveOrder(orderData);
      
      const orderCount = updateOrderCount(sessionName);
      const totalOrders = getTotalOrders();
      const now = new Date();
      const dateStr = now.toLocaleDateString('hi-IN');
      const timeStr = now.toLocaleTimeString('hi-IN');
      const pdfLink = CONFIG.BOOK_PDFS && CONFIG.BOOK_PDFS[state.bookName] && CONFIG.BOOK_PDFS[state.bookName][state.language] ? CONFIG.BOOK_PDFS[state.bookName][state.language] : '';
      
      await sendTyping(sock, from, 1500);
      await sock.sendMessage(from, { text: `🎉 *ऑर्डर सफलतापूर्वक दर्ज!*\n\n_Your order is placed successfully!_\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n✅ *Order ID: #${orderCount}*\n\n📦 आपकी पुस्तक *20 दिनों में निःशुल्क* घर पहुंचेगी।\n\nYour book will reach your home in *20 days - FREE!*\n\n🆓 *बिल्कुल निःशुल्क! कोई चार्ज नहीं!*\n\n*Completely free! No charges!*\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📍 डिलीवरी पता (Delivery Address):\n\n${state.name}\nS/O ${state.father}\n${state.address}\nPost: ${state.selectedPostOffice}\nTehsil: ${state.selectedBlock}\n${state.district}, ${state.stateName}\nPIN: ${state.pincode}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n🙏 धन्यवाद! Thank you!` });
      
      if (pdfLink) {
        await new Promise(r => setTimeout(r, 800));
        await sock.sendMessage(from, { text: `📖 *${state.bookName} (${state.language})* PDF:\n\n${pdfLink}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📚 पुस्तक आने तक PDF पढ़ सकते हैं।\n\nYou can read the PDF until the book arrives.\n\n💡 यह पुस्तक आपके जीवन को बदल देगी!\n\nThis book will transform your life!` });
      }
      
      if (CONFIG.USER_GROUP_LINK) {
        await new Promise(r => setTimeout(r, 800));
        await sock.sendMessage(from, { text: `📢 *हमारे WhatsApp ग्रुप से जुड़ें:*\n\n_Join our WhatsApp group:_\n\n${CONFIG.USER_GROUP_LINK}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n✨ यहाँ रोज़ आध्यात्मिक ज्ञान मिलता है।\n\nDaily spiritual knowledge shared here.\n\n🙏 संत रामपाल जी महाराज के सत्संग।\n\nSatsang by Sant Rampal Ji Maharaj.` });
      }
      
      const fwMsg = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📦 *नया ऑर्डर! NEW ORDER!*\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📊 *Order #${orderCount}* (Session)\n📈 *Total Orders: ${totalOrders}*\n\n📅 Date: ${dateStr}\n⏰ Time: ${timeStr}\n📱 Session: ${sessionName}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n👤 *Customer Details:*\n\n👤 नाम (Name): ${state.name}\n👨 पिता (Father): ${state.father}\n📞 Mobile: +91${state.mobile}\n💬 WhatsApp: ${from}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📚 *Book Details:*\n\n📖 पुस्तक (Book): ${state.bookName}\n🌐 भाषा (Language): ${state.language}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📍 *Complete Delivery Address:*\n\n${state.name}\nS/O ${state.father}\n🏘️ Village/City: ${state.address}\n📮 Post Office: ${state.selectedPostOffice}\n🏛️ Tehsil/Block: ${state.selectedBlock}\n📍 Pincode: ${state.pincode}\n🏛️ District: ${state.district}\n🗺️ State: ${state.stateName}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📦 Delivery Time: 20 days\n🆓 Free Book Service\n✅ Order Confirmed\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n🙏 जय गुरुदेव! Jai Gurudev!`;
      
      try {
        if (CONFIG.ADMIN && CONFIG.ADMIN.JID) {
          await sock.sendMessage(CONFIG.ADMIN.JID, { text: fwMsg });
          console.log('✅ Order forwarded to admin:', CONFIG.ADMIN.JID);
        }
      } catch (e) {
        console.error('❌ Admin send error:', e);
      }
      
      try {
        await sendToOrderGroup(sock, sessionName, fwMsg);
        console.log('✅ Order forwarded to group for session:', sessionName);
      } catch (e) {
        console.error('❌ Group send error:', e);
      }
      
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
        await sock.sendMessage(from, { text: `❌ त्रुटि आई! (Error occurred!)\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nकोई तकनीकी समस्या हुई है।\n\nThere was a technical issue.\n\nफिर से try करें। (Please try again.)\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nकोई भी मैसेज भेजकर शुरू करें।\n\nSend any message to start.\n\n🙏 धन्यवाद!` });
        userStates.delete(from);
        if (reminderTimeouts.has(from)) clearTimeout(reminderTimeouts.get(from));
      }
    } catch (e2) {
      console.error('Error in error handler:', e2);
    }
  }
}
